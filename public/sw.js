const CACHE_NAME = 'gastos-v2'; // Cambiamos a v2 para invalidar la versión anterior

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalación: Guarda archivos iniciales y fuerza la activación inmediata
self.addEventListener('install', (e) => {
  self.skipWaiting(); 
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activación: Elimina la versión antigua 'gastos-v1' automáticamente
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Estrategia Network First (Red primero, respaldo en caché si falla)
self.addEventListener('fetch', (e) => {
  // Ignorar peticiones API para que la base de datos siempre sea en vivo
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Si hay red, actualiza la copia del caché en segundo plano
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si no hay red (offline), usa el respaldo de la caché
        return caches.match(e.request);
      })
  );
});