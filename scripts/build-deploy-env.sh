#!/bin/sh
set -eu

BASE_ENV="${DEPLOY_ENV_BASE:-.env.example}"
OVERRIDE_ENV="${1:-deploy/.env.rates}"
TARGET_ENV="${2:-.env}"

if [ ! -f "$BASE_ENV" ]; then
    echo "Base env file not found: $BASE_ENV" >&2
    exit 1
fi

if [ ! -f "$OVERRIDE_ENV" ]; then
    echo "Override env file not found: $OVERRIDE_ENV" >&2
    exit 1
fi

TARGET_DIR=$(dirname "$TARGET_ENV")
mkdir -p "$TARGET_DIR"
umask 077
TMP_ENV="${TARGET_ENV}.tmp.$$"
trap 'rm -f "$TMP_ENV"' EXIT HUP INT TERM

awk '
    FNR == NR {
        line = $0
        sub(/^[[:space:]]*/, "", line)
        if (line ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
            split(line, parts, "=")
            overrides[parts[1]] = 1
        }
        next
    }

    {
        line = $0
        probe = line
        sub(/^[[:space:]]*/, "", probe)
        if (probe ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
            split(probe, parts, "=")
            if (parts[1] in overrides) {
                next
            }
        }
        print line
    }
' "$OVERRIDE_ENV" "$BASE_ENV" > "$TMP_ENV"

printf '\n# Deployment overrides\n' >> "$TMP_ENV"
cat "$OVERRIDE_ENV" >> "$TMP_ENV"
printf '\n' >> "$TMP_ENV"

mv "$TMP_ENV" "$TARGET_ENV"
trap - EXIT HUP INT TERM

echo "Built $TARGET_ENV from $BASE_ENV + $OVERRIDE_ENV"
