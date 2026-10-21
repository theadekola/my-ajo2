self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'My Ajo', {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.type ? `myajo-${payload.type}` : undefined,
    data: { url: payload.url || '/notifications' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin);
  const route = target.origin === self.location.origin ? (target.hash.startsWith('#/') ? target.hash.slice(1) : target.pathname + target.search) : '/notifications';
  const destination = `${self.location.origin}/#${route.startsWith('/')&&!route.startsWith('//')?route:'/notifications'}`;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus().then(() => existing.navigate(destination));
    return self.clients.openWindow(destination);
  }));
});
