/* 🚀 v3.0.0: 独立 Service Worker — CacheFirst 离线缓存策略 */
const CACHE_NAME = 'mbolka-v3.3.3';
const RUNTIME_CACHE = 'mbolka-runtime-v3.3.3';
const CACHE_URLS = [
    '/', '/index.html',
    '/css/variables.css', '/css/base-layout.css', '/css/style.css',
    '/css/immersive.css', '/css/modals.css', '/css/components.css',
    '/css/cover-lib.css', '/css/wco.css',
    '/js/globals.js', '/js/utils.js', '/js/storage.js',
    '/js/loader.js', '/js/audio-core.js', '/js/pip.js',
    '/js/visualizer.js', '/js/ui-core.js', '/js/cover-lib.js',
    '/js/gamepad.js', '/js/app.js', '/js/vibration.js',
    '/js/theme-color.js', '/js/wco.js',
    '/manifest.json'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // 🚀 逐条预缓存，失败项记录日志而非静默吞掉
            return Promise.all(CACHE_URLS.map(url =>
                cache.add(url).catch(err => console.warn('[SW] 预缓存失败:', url, err))
            ));
        })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k))
        )).then(() => clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    e.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                // 🚀 运行时缓存：同源与跨域(CORS) GET 响应均缓存，离线/CDN 抖动时可复用
                if (res && res.ok && (req.url.startsWith('http://') || req.url.startsWith('https://'))) {
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
                }
                return res;
            }).catch(() => cached || new Response('', {status: 503, statusText: 'Offline'}));
        })
    );
});
