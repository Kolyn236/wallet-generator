import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const nginx = readFileSync(new URL('../../docker/nginx/default.conf', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../../docker/nginx/security-headers.conf', import.meta.url), 'utf8');
const csp = headers.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
assert.equal((nginx.match(/include \/etc\/nginx\/security-headers.conf;/g) ?? []).length, 3,
  'Locations adding Cache-Control must include security headers rather than losing nginx inheritance');
assert.match(csp, /connect-src 'self' https:/, 'CSP must permit user-selected HTTPS publication endpoints');
assert.match(csp, /script-src 'self';/, 'Direct publication must not weaken script origin policy');
assert.match(csp, /frame-ancestors 'none'/);
assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
const dockerfile = readFileSync(new URL('../../docker/nginx/Dockerfile', import.meta.url), 'utf8');
assert.doesNotMatch(dockerfile, /ARG .*KEY|ENV VITE_.*(?:KEY|TOKEN|SECRET)/i);
const smoke = readFileSync(new URL('../../.github/workflows/integration-smoke.yml', import.meta.url), 'utf8');
assert.doesNotMatch(smoke, /debug:router api_ethereum_broadcast/, 'Smoke must not require removed broadcaster');
assert.match(smoke, /debug:router api_tron_prepare/);
assert.match(smoke, /debug:router api_tron_status/);
console.log('Public runtime CSP and frontend credential configuration guardrails passed.');
