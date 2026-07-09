/*
 * MBolka Player — Theme Color Manager v3.6.4
 * 动态更新 <meta name="theme-color">（控制 Windows Chrome PWA 系统顶 bar / WCO 右上金刚键背景色）
 * 🚀 v3.4.2: 新增顶部取色支持。当背景图片存在时，优先使用图片顶部附近颜色作为 theme-color，
 * 使 WCO 模式下系统窗口控制按钮（右上金刚键）的背景与页面顶部背景融合，达成假沉浸效果。
 * 🚀 v3.6.4: WCO 自绘标题栏（左侧色块）采用「去饱和度」算法——将右侧亮色块（强调色/主题色/专辑封面取色）
 * 转换为灰度明度灰度版本：L = 0.299R + 0.587G + 0.114B，再令 R=G=B=L。
 * 区别于粗暴的 RGB 同值相减，该算法提取人眼视觉亮度，保证任意色相都能得到一致的暗沉去饱和底色。
 */

const ThemeColor = (() => {
    let _meta = null;
    let _currentColor = null;
    let _topColor = null;
    let _isDarkMode = false;

    const FALLBACK_COLOR = '#180219';

    // ── 🚀 v3.6.4: 颜色解析与去饱和灰度算法 ──

    // 将 #rgb / #rrggbb / rgb(r,g,b) / rgba(r,g,b,a) 解析为 {r,g,b}
    function _parseRgb(str) {
        if (!str || typeof str !== 'string') return null;
        const s = str.trim();
        // 十六进制
        const mHex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (mHex) {
            let h = mHex[1];
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16)
            };
        }
        // rgb / rgba
        const mRgb = s.match(/rgba?\(([^)]+)\)/i);
        if (mRgb) {
            const parts = mRgb[1].split(',').map(p => parseFloat(p.trim()));
            return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0 };
        }
        return null;
    }

    // 去饱和灰度：L = 0.299R + 0.587G + 0.114B，三通道统一为 L
    // 返回 "rgb(L, L, L)" 字符串；解析失败返回 null
    function _toGrayscale(colorStr) {
        const rgb = _parseRgb(colorStr);
        if (!rgb) return null;
        const L = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
        const v = Math.max(0, Math.min(255, L));
        return `rgb(${v}, ${v}, ${v})`;
    }

    function getMeta() {
        if (!_meta) {
            _meta = document.querySelector('meta[name="theme-color"]');
            if (!_meta) {
                _meta = document.createElement('meta');
                _meta.name = 'theme-color';
                document.head.appendChild(_meta);
            }
        }
        return _meta;
    }

    function update(albumColor) {
        _currentColor = albumColor || null;
        _applyColor();
    }

    function updateTopColor(topColor) {
        _topColor = topColor || null;
        _applyColor();
    }

    function refresh() {
        _applyColor();
    }

    function onDarkModeChange(isDark) {
        _isDarkMode = isDark;
        _applyColor();
    }

    function _applyColor() {
        // 🚀 v3.4.2: 优先级：顶部取色（图片顶部附近）> 深色模式 > 专辑平均色 > 默认色 > 兜底色
        // 🚀 v3.5.4: 用户可在 设置-外观 关闭 WCO 伪沉浸，关闭时跳过顶部取色
        let color;
        const useTopColor = _topColor && !_isDarkMode && (typeof cfg === 'undefined' || cfg.wcoPseudoImmersive !== false);
        if (useTopColor) {
            color = _topColor;
        } else if (_isDarkMode) {
            color = '#0e0c16';
        } else if (_currentColor) {
            color = _currentColor;
        } else if (typeof cfg !== 'undefined' && cfg.defaultColor) {
            color = cfg.defaultColor;
        } else {
            color = FALLBACK_COLOR;
        }
        getMeta().setAttribute('content', color);
        // 同步给 CSS 变量，供 WCO 自绘标题栏（如启用）使用
        // 🚀 v3.6.4: 自绘标题栏（左侧色块）不再直接复用亮色，改用「去饱和灰度」版本
        // —— 即 L = 0.299R + 0.587G + 0.114B 的灰度明度，三通道统一赋值。
        // meta theme-color（右侧亮色块：系统窗口控制按钮）仍保留原始亮色。
        const wcoColor = _toGrayscale(color) || color;
        document.documentElement.style.setProperty('--wco-theme-color', wcoColor);
    }

    return { update, updateTopColor, refresh, onDarkModeChange };
})();
