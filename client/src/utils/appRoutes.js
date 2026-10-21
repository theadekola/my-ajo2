export function routeFromUrl(value, origin = window.location.origin) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return '/notifications';
    const route = url.hash.startsWith('#/') ? url.hash.slice(1) : `${url.pathname}${url.search}`;
    return route.startsWith('/') && !route.startsWith('//') ? route : '/notifications';
  } catch { return '/notifications'; }
}
export function nativeBackRoute(hash, canGoBack) {
  const route = (hash.replace(/^#/, '') || '/').split('?')[0];
  if (['/','/auth','/dashboard'].includes(route)) return 'minimize';
  if (canGoBack && !['/', '/auth', '/groups', '/contributions', '/calendar', '/more', '/ask-ai'].includes(route)) return 'back';
  return '/dashboard';
}
