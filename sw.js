const CACHE_NAME = 'worship-setup-v2'; // Увеличил версию!
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './icon.svg',
  // ДОБАВЬТЕ сюда ваши JS/CSS файлы!
  // './main.js', './styles.css' и т.д.
];

// Установка
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Активация
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. ИГНОРИРУЕМ не-GET запросы (POST, PUT и т.д.)
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. НЕ кэшируем Firebase/auth запросы
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('firestore.googleapis.com') ||
      url.pathname.includes('auth') ||
      url.pathname.includes('identity')) {
    return; // Пусть Firebase сам управляет этими запросами
  }

  // 3. Для HTML - network first с cache fallback
  if (event.request.mode === 'navigate' || 
      event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        // Сохраняем в кэш при успешном ответе
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Офлайн - возвращаем из кэша
        return caches.match(event.request);
      })
    );
    return;
  }

  // 4. Для статики (JS, CSS, изображения) - cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Возвращаем из кэша И обновляем в фоне
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Игнорируем ошибки сети
        });
        return cachedResponse;
      }
      
      // Нет в кэше - идём в сеть
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse.ok) {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return networkResponse;
      });
    })
  );
});