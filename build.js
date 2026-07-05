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
    'cover-lib.js', 'gamepad.js', 'app.js', 'vibration.js'
];
const CSS_FILES = [
    'variables.css', 'base-layout.css', 'style.css',
    'immersive.css', 'modals.css', 'components.css', 'cover-lib.css'
];

async function build() {
    console.log('🔨 Building MBolka Player v3.0.0...');

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

    // Copy HTML + SW
    let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
    html = html.replace(/<script src="js\/.*?"><\/script>\n?/g, '')
               .replace(/<link rel="stylesheet" href="css\/.*?">\n?/g, '')
               .replace('</head>', '  <link rel="stylesheet" href="style.min.css">\n</head>')
               .replace('</body>', '  <script src="bundle.min.js"></script>\n</body>');
    fs.writeFileSync(path.join(DIST, 'index.html'), html);
    console.log(`  ✅ index.html`);

    fs.copyFileSync(path.join(SRC, 'sw.js'), path.join(DIST, 'sw.js'));
    fs.copyFileSync(path.join(SRC, 'manifest.json'), path.join(DIST, 'manifest.json'));
    console.log(`  ✅ sw.js + manifest.json`);

    console.log('\n✨ Build complete! Output in dist/');
}

build().catch(e => { console.error('Build failed:', e); process.exit(1); });
