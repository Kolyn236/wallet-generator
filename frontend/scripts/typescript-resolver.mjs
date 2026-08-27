export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const extensionlessRelativeImport = (specifier.startsWith('./') || specifier.startsWith('../'))
      && !/\.[a-z0-9]+$/i.test(specifier);

    if (error?.code === 'ERR_MODULE_NOT_FOUND' && extensionlessRelativeImport) {
      return nextResolve(`${specifier}.ts`, context);
    }

    throw error;
  }
}
