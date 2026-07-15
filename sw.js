const CACHE_NAME = 'worship-setup-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './icon.svg'
  // ВАЖНО: Если у вас есть статические JS/CSS файлы без хэшей в имени, 
  // добавьте их сюда (например: './main.js', './styles.css')
];

// 1. Установка — кэшируем базовые файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Активируем новый SW сразу, не дожидаясь закрытия вкладок
});

// 2. Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // Берем под контроль все открытые страницы сразу
});

// 3. Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ШАГ А: Игнорируем не-GET запросы (POST, PUT, DELETE и т.д.)
  // Это критически важно для запросов авторизации/логина! 
  // Они всегда должны идти в сеть, иначе вы получите кэшированный (устаревший) ответ.
  if (request.method !== 'GET') {
    return;
  }

  // ШАГ Б: Для API-запросов используем стратегию "Сначала сеть"
  // Мы НЕ кэшируем ответы API, чтобы не показывать устаревший статус входа пользователя
  if (url.pathname.startsWith('/api/') || url.pathname.includes('auth') || url.pathname.includes('login')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Если сети нет, позволяем приложению самому обработать ошибку офлайн-режима
        // Можно вернуть кэш, но для авторизации это рискованно (может быть старый 401)
        return new Response(JSON.stringify({ error: 'offline' }), { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        });
      })
    );
    return;
  }

  // ШАГ В: Для статики (HTML, JS, CSS, картинки) используем "Сначала кэш, затем сеть с сохранением в кэш"
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Если есть в кэше – отдаем мгновенно (это убирает 3-секундную задержку)
      if (cachedResponse) {
        return cachedResponse;
      }

      // Если нет в кэше – идем в сеть
      return fetch(request).then((networkResponse) => {
        // Проверяем, что ответ валидный (статус 200, тип basic)
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Клонируем ответ, так как поток (stream) можно прочитать только один раз
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache); // Сохраняем в кэш для следующих запусков
        });

        return networkResponse;
      }).catch((error) => {
        // ШАГ Г: Если сети нет и ресурса нет в кэше
        // Для навигации (запрос HTML) возвращаем заглушку или главную страницу
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // Для остальных случаев пробрасываем ошибку, чтобы приложение могло её обработать
        throw error;
      });
    })
  );
});