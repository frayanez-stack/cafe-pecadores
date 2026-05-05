// ══════════════════════════════════════════════════════
//  CAFÉ PECADORES ERP — Service Worker
//  Maneja: caché offline + notificaciones push
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'pecadores-erp-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── INSTALL ───────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Si falla algún recurso externo, continuar igual
        return cache.add('/index.html');
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH — Network First, Cache Fallback ─────────────
self.addEventListener('fetch', event => {
  // Solo manejar requests GET
  if (event.request.method !== 'GET') return;

  // No interceptar requests a Supabase (siempre necesitan red)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cachear respuesta exitosa
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red: servir desde caché
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback a index.html para rutas de la app
          return caches.match('/index.html');
        });
      })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: '☕ Pecadores ERP', body: 'Nueva notificación' };

  try {
    data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver app' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow(event.notification.data.url || '/');
      })
  );
});

// ── BACKGROUND SYNC (para cuando vuelve la red) ───────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // En una próxima versión: sincronizar datos guardados offline
  console.log('[SW] Sincronizando datos pendientes...');
}
