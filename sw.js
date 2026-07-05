/* 🚀 v3.0.0: 独立 Service Worker — CacheFirst 离线缓存策略 */
const CACHE_NAME = 'mbolka-v3.0.2';
const CACHE_URLS = [
    '/', '/index.html',
    '/css/variables.css', '/css/base-layout.css', '/css/style.css',
    '/css/immersive.css', '/css/modals.css', '/css/components.css',
    '/css/cover-lib.css',
    '/js/globals.js', '/js/utils.js', '/js/storage.js',
    '/js/loader.js', '/js/audio-core.js', '/js/pip.js',
    '/js/visualizer.js', '/js/ui-core.js', '/js/cover-lib.js',
    '/js/gamepad.js', '/js/app.js', '/js/vibration.js',
    '/manifest.json'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(CACHE_URLS).catch(() => {});
        })
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => clients.claim())
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).catch(() => {
            return new Response('', {status: 503, statusText: 'Offline'});
        }))
    );
});
