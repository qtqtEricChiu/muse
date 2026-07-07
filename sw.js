/* 🚀 v3.5.2: 独立 Service Worker — Network-First（带缓存回退）离线缓存策略
   ⚠️ 原 CacheFirst 会把 js/visualizer.js 等源码永久缓存（CACHE_NAME 写死 v3.3.3，
    install 不重跑），导致源码修改在浏览器里不生效。改为 Network-First：
   在线时始终拉取最新源码（开发改动即时可见），离线/失败时回退缓存。 */
const CACHE_NAME = 'mbolka-v3.5.2';
const RUNTIME_CACHE = 'mbolka-runtime-v3.5.2';
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
    // 🔧 v3.4.3: Network-First —— 在线优先回源，源码修改刷新即生效；失败/离线回退缓存
    e.respondWith(
        fetch(req).then(res => {
            // 仅缓存同源成功响应，避免误缓存跨域大资源
            if (res && res.ok && isSameOrigin(req.url)) {
                const copy = res.clone();
                caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
            }
            return res;
        }).catch(() => caches.match(req).then(cached =>
            cached || new Response('', { status: 503, statusText: 'Offline' })
        ))
    );
});

function isSameOrigin(url) {
    try { return new URL(url).origin === self.location.origin; } catch (_) { return false; }
}
