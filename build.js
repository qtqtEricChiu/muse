/**
 * MBolka Player v3.0.0 — 生产构建脚本
 * 用法: npm install && node build.js
 * 依赖: npm i terser clean-css
 */
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(SRC, 'dist');
const JS_FILES = [
    'globals.js', 'utils.js', 'storage.js', 'loader.js',
    'audio-core.js', 'pip.js', 'visualizer.js', 'ui-core.js',
    'cover-lib.js', 'gamepad.js', 'app.js', 'vibration.js',
    'theme-color.js', 'wco.js'
];
const CSS_FILES = [
    'variables.css', 'base-layout.css', 'style.css',
    'immersive.css', 'modals.css', 'components.css', 'cover-lib.css',
    'wco.css'
];

async function build() {
    console.log('🔨 Building MBolka Player v3.4.1...');

    // Create dist directory
    if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

    // Minify JS
    const { minify } = require('terser');
    let jsBundle = '';
    for (const f of JS_FILES) {
        const code = fs.readFileSync(path.join(SRC, 'js', f), 'utf-8');
        jsBundle += `/* ${f} */\n${code}\n`;
    }
    const minified = await minify(jsBundle, { compress: true, mangle: true });
    fs.writeFileSync(path.join(DIST, 'bundle.min.js'), minified.code);
    console.log(`  ✅ bundle.min.js (${(minified.code.length / 1024).toFixed(1)} KB)`);

    // Minify CSS
    const CleanCSS = require('clean-css');
    let cssBundle = '';
    for (const f of CSS_FILES) {
        cssBundle += fs.readFileSync(path.join(SRC, 'css', f), 'utf-8') + '\n';
    }
    const cssResult = new CleanCSS({ level: 2 }).minify(cssBundle);
    fs.writeFileSync(path.join(DIST, 'style.min.css'), cssResult.styles);
    console.log(`  ✅ style.min.css (${(cssResult.styles.length / 1024).toFixed(1)} KB)`);

    // Copy HTML
    let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
    html = html.replace(/<script src="js\/.*?"><\/script>\n?/g, '')
               .replace(/<link rel="stylesheet" href="css\/.*?">\n?/g, '')
               .replace('</head>', '  <link rel="stylesheet" href="style.min.css">\n</head>')
               .replace('</body>', '  <script src="bundle.min.js"></script>\n</body>');
    fs.writeFileSync(path.join(DIST, 'index.html'), html);
    console.log(`  ✅ index.html`);

    // Copy static assets (favicon + PWA icons) — 分支部署时由根目录提供，dist 必须自带
    fs.copyFileSync(path.join(SRC, 'favicon.ico'), path.join(DIST, 'favicon.ico'));
    fs.cpSync(path.join(SRC, 'icons'), path.join(DIST, 'icons'), { recursive: true });
    fs.copyFileSync(path.join(SRC, 'manifest.json'), path.join(DIST, 'manifest.json'));
    console.log(`  ✅ favicon.ico + icons/ + manifest.json`);

    // Generate dist-specific Service Worker (相对路径，子路径 /muse/ 安全)
    const iconFiles = fs.readdirSync(path.join(SRC, 'icons'))
        .filter(f => /\.png$/i.test(f))
        .map(f => './icons/' + f);
    fs.writeFileSync(path.join(DIST, 'sw.js'), genSW([
        './', './index.html',
        './bundle.min.js', './style.min.css',
        './manifest.json', './favicon.ico',
        ...iconFiles
    ]));
    console.log(`  ✅ sw.js (dist, 相对路径)`);

    console.log('\n✨ Build complete! Output in dist/');
}

/**
 * 生成 dist 专用 Service Worker：预缓存列表用相对路径，子路径 (/muse/) 安全。
 */
function genSW(urls) {
    const list = JSON.stringify(urls, null, 12);
    return `/* MBolka Player v3.4.1 — dist Service Worker (相对路径, 子路径安全) */
const CACHE_NAME = 'mbolka-v3.4.1';
const RUNTIME_CACHE = 'mbolka-runtime-v3.4.1';
const CACHE_URLS = ${list};

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(cache =>
        Promise.all(CACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] 预缓存失败:', url, err))
        ))
    ));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(() => clients.claim()));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    e.respondWith(caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
            if (res && res.ok && (req.url.startsWith('http://') || req.url.startsWith('https://'))) {
                const copy = res.clone();
                caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
            }
            return res;
        }).catch(() => cached || new Response('', {status: 503, statusText: 'Offline'}));
    }));
});
`;
}

build().catch(e => { console.error('Build failed:', e); process.exit(1); });
