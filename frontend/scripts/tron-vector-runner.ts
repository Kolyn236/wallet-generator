import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep this wrapper independent of the wallet implementation so it can be run
// alongside every existing vector command without changing their behavior.
const directory = dirname(fileURLToPath(import.meta.url));
const vectorScript = resolve(directory, 'tron-vector-test.ts');
execFileSync(process.execPath, ['--experimental-loader', resolve(directory, 'typescript-resolver.mjs'), vectorScript], {
  stdio: 'inherit',
});
