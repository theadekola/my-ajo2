export async function resolve(specifier,context,nextResolve){
  if(specifier.endsWith('/db.js')&&!context.parentURL?.includes('/fixtures/'))return {url:new URL('./mockDatabase.mjs',import.meta.url).href,shortCircuit:true};
  return nextResolve(specifier,context);
}
