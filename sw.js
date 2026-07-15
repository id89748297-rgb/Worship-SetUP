const CACHE_NAME = 'worship-setup-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

// Установка: сохраняем все файлы в кэш
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Кэширование файлов...');
      return cache.addAll(ASSETS);
    }).catch(err => {
      console.error('Ошибка кэширования:', err);
    })
  );
  // Активируем новый service worker сразу
  self.skipWaiting();
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('Удаление старого кэша:', key);
          return caches.delete(key);
        })
      );
    })
  );
  // Берём контроль над всеми страницами сразу
  self.clients.claim();
});

// Обработка запросов: сначала кэш, потом сеть
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Нашли в кэше - возвращаем
        return cached;
      }
      
      // Нет в кэше - загружаем из сети
      return fetch(event.request).then(response => {
        // Проверяем, что ответ валидный
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Клонируем ответ для сохранения в кэш
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Если сети нет и в кэше нет - возвращаем index.html
        return caches.match('./index.html');
      });
    })
  );
});