import { transformWithOxc } from 'vite';
import { readFile } from 'node:fs/promises';
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
      for (const extension of ['.ts', '.tsx']) {
        try { return await nextResolve(`${specifier}${extension}`, context); } catch { /* Try next source suffix. */ }
      }
    }
    throw error;
  }
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx')) {
    const result = await transformWithOxc(await readFile(new URL(url), 'utf8'), new URL(url).pathname, { jsx: { runtime: 'automatic' } });
    return { format: 'module', shortCircuit: true, source: result.code };
  }
  return nextLoad(url, context);
}
