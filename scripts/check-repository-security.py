#!/usr/bin/env python3
"""Deterministic repository security guardrails for production and CI configuration."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []

KNOWN_PLACEHOLDER_SECRETS = {
    "change-me",
    "change-me-for-local-development",
    "local-development-only-change-me",
    "test-secret",
}


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    ERRORS.append(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def env_assignments(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in read_text(path).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def check_production_runtime() -> None:
    compose = read_text("compose.prod.yaml")
    require(
        re.search(r"(?m)^\s*APP_ENV:\s*['\"]?prod['\"]?\s*$", compose) is not None,
        "compose.prod.yaml must set APP_ENV to prod",
    )
    require(
        re.search(r"(?m)^\s*APP_DEBUG:\s*['\"]?0['\"]?\s*$", compose) is not None,
        "compose.prod.yaml must set APP_DEBUG to 0",
    )
    require(
        'APP_RUNTIME_OPTIONS: \'{"disable_dotenv":true}\'' in compose,
        "compose.prod.yaml must disable Symfony dotenv loading in production",
    )
    require(
        re.search(r"(?m)^\s*APP_SECRET:\s*\$\{APP_SECRET:\?[^}]+\}\s*$", compose) is not None,
        "compose.prod.yaml must require APP_SECRET instead of supplying a default",
    )

    for placeholder in KNOWN_PLACEHOLDER_SECRETS:
        if placeholder in compose:
            fail(f"compose.prod.yaml must not embed placeholder APP_SECRET value {placeholder!r}")

    prod_start = read_text("docker/php/start-prod.sh")
    require(
        '[ "${APP_ENV:-}" = "prod" ]' in prod_start,
        "docker/php/start-prod.sh must fail closed unless APP_ENV=prod",
    )
    require(
        '[ "${APP_DEBUG:-}" = "0" ]' in prod_start,
        "docker/php/start-prod.sh must fail closed unless APP_DEBUG=0",
    )
    require(
        '[ "${#secret}" -ge 32 ]' in prod_start,
        "docker/php/start-prod.sh must enforce the minimum APP_SECRET length",
    )
    for placeholder in KNOWN_PLACEHOLDER_SECRETS:
        require(
            placeholder in prod_start,
            f"docker/php/start-prod.sh must reject known placeholder APP_SECRET {placeholder!r}",
        )

    deploy_env = env_assignments("deploy/.env.production.example")
    require(
        deploy_env.get("APP_SECRET") == "",
        "deploy/.env.production.example must leave APP_SECRET blank",
    )
    for key, value in deploy_env.items():
        if key.endswith(("_RPC_URL", "_API_URL")) and value:
            fail(f"deploy/.env.production.example must leave credential-bearing provider URL {key} blank")

    root_env = env_assignments(".env.example")
    require(
        "APP_SECRET" not in root_env,
        ".env.example must not define APP_SECRET; production injects it outside Git",
    )
    for key, value in root_env.items():
        if key.endswith(("_RPC_URL", "_API_URL")) and value:
            fail(f".env.example must leave credential-bearing provider URL {key} blank")


def check_tracked_secret_files() -> None:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=False,
    )
    tracked = [entry.decode("utf-8") for entry in result.stdout.split(b"\0") if entry]
    forbidden_exact = {".env", "backend/.env", "deploy/.env", "deploy/.env.production", "deploy/.env.rates"}

    for path in tracked:
        if path in forbidden_exact:
            fail(f"secret-bearing runtime file must not be tracked: {path}")
            continue

        pure = PurePosixPath(path)
        if pure.parts and pure.parts[0] == "deploy":
            name = pure.name
            if (name == ".env" or name.startswith(".env.")) and not name.endswith(".example"):
                fail(f"deployment env file must not be tracked unless it is an .example template: {path}")


def check_csp() -> None:
    nginx = read_text("docker/nginx/default.conf")
    policies = re.findall(
        r'add_header\s+Content-Security-Policy\s+"([^"]+)"\s+always\s*;',
        nginx,
    )
    require(bool(policies), "docker/nginx/default.conf must define a Content-Security-Policy header")

    for index, policy in enumerate(policies, start=1):
        directives: dict[str, list[str]] = {}
        for raw_directive in policy.split(";"):
            tokens = raw_directive.strip().split()
            if tokens:
                directives[tokens[0]] = tokens[1:]

        require(
            directives.get("script-src") == ["'self'"],
            f"CSP #{index} must keep script-src restricted exactly to 'self'",
        )


def check_action_pins() -> None:
    workflow_dir = ROOT / ".github" / "workflows"
    workflow_paths = sorted((*workflow_dir.glob("*.yml"), *workflow_dir.glob("*.yaml")))
    require(bool(workflow_paths), "at least one GitHub Actions workflow must exist")

    uses_pattern = re.compile(r"^\s*(?:-\s*)?uses:\s*([^\s#]+)")
    sha_pattern = re.compile(r"^[0-9a-fA-F]{40}$")

    for workflow_path in workflow_paths:
        for line_number, line in enumerate(workflow_path.read_text(encoding="utf-8").splitlines(), start=1):
            match = uses_pattern.match(line)
            if not match:
                continue

            target = match.group(1)
            if target.startswith("./"):
                continue

            if "@" not in target:
                fail(f"{workflow_path.relative_to(ROOT)}:{line_number} uses an unpinned action: {target}")
                continue

            _, ref = target.rsplit("@", 1)
            if sha_pattern.fullmatch(ref) is None:
                fail(
                    f"{workflow_path.relative_to(ROOT)}:{line_number} must pin {target!r} "
                    "to a full 40-character commit SHA"
                )


def main() -> int:
    check_production_runtime()
    check_tracked_secret_files()
    check_csp()
    check_action_pins()

    if ERRORS:
        print("Repository security guardrails failed:", file=sys.stderr)
        for error in ERRORS:
            print(f" - {error}", file=sys.stderr)
        return 1

    print("Repository security guardrails passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
