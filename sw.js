const CACHE_VERSION = 'worship-setup-v1';
 
// Всё, что нужно, чтобы приложение стартовало без сети:
// сама страница + 3 файла Firebase SDK с CDN.
const PRECACHE_URLS = [
  './',
  './index.html',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];
 
// --- Установка: складываем всё в кэш заранее ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // addAll упадёт целиком, если хоть один запрос не удастся —
      // поэтому кэшируем по одному, чтобы отсутствие сети на один файл
      // не сорвало кэширование остальных.
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] Не удалось закэшировать при установке:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});
 
// --- Активация: чистим старые версии кэша ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});
 
// --- Стратегия запросов ---
// Firebase SDK и статика приложения: "cache-first, network fallback"
// (SDK версионирован в URL — если он есть в кэше, он точно актуален и без сети).
// Всё остальное (динамические запросы к Firebase Auth/Firestore API)
// НЕ трогаем — пусть идут в сеть напрямую, чтобы не кэшировать
// устаревшие данные пользователя или ответы авторизации.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
 
  const isAppShell = PRECACHE_URLS.some((cached) => url.endsWith(cached.replace('./', '')));
  const isFirebaseSDK = url.includes('gstatic.com/firebasejs');
 
  if (!isAppShell && !isFirebaseSDK) {
    return; // не наш случай — пропускаем, браузер сам сходит в сеть
  }
 
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Обновляем кэш в фоне, если сеть есть (stale-while-revalidate)
        fetch(event.request)
          .then((fresh) => {
            if (fresh && fresh.ok) {
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, fresh));
            }
          })
          .catch(() => {}); // офлайн — просто отдаём то, что уже закэшировано
        return cached;
      }
      // В кэше нет — идём в сеть, и если получилось, кэшируем на будущее
      return fetch(event.request).then((fresh) => {
        if (fresh && fresh.ok) {
          const clone = fresh.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return fresh;
      });
    })
  );
});