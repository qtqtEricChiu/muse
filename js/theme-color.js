/*
 * MBolka Player — Theme Color Manager v3.6.6
 * 动态更新 <meta name="theme-color">（控制 Windows Chrome PWA 系统顶 bar / WCO 右上金刚键背景色）
 * 🚀 v3.4.2: 动态 theme-color，使 WCO 模式下系统窗口控制按钮（右上金刚键）背景与页面融合（假沉浸）。
 * 🚀 v3.6.5: 应用「去饱和灰度」算法到 右侧金刚键 背景。
 * 🚀 v3.6.6: 合并「深色主题取色算法」(toDarkColor) 作为 PWA WCO 标题栏取色算法：
 *   - 无论 Chrome 是否隐藏标题栏，只要开启了「封面取色」(followAccentColor)，标题栏即运用该取色算法
 *     （输入专辑封面亮色 RGB → 输出暗色沉浸底色 hsl(H,79%,5%)，粉色区间做 -56° 偏移），
 *     不再判断 Chrome 标题栏状态（移除 windowControlsOverlay / wcoPseudoImmersive 相关判断）。
 *   - 若用户关闭「封面取色」，标题栏继续应用主题色（深色模式 / 默认色 / 兜底色）。
 */

const ThemeColor = (() => {
    let _meta = null;
    let _currentColor = null;   // 专辑封面平均色（封面取色开启时驱动标题栏取色算法）
    let _topColor = null;       // 专辑封面顶部色（保留兼容，当前不再参与标题栏取色）
    let _isDarkMode = false;

    const FALLBACK_COLOR = '#180219';

    // ── 颜色解析 ──

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

    // ── 🚀 v3.6.6: 深色主题取色算法（来自 dark-theme-color.js）──
    // 输入右侧亮色 RGB，输出左侧暗色 RGB
    //   hsl(H, 79%, 5%)                    常规
    //   hsl(H - 56°, 79%, 5%)              粉移：H∈[335,360]∪[0,5] 且 S>28% 且 L>61%

    function rgbToHsl(r, g, b) {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
        const d = max - min;
        const l = (max + min) / 2;

        let h = 0, s = 0;
        if (d !== 0) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === rn) {
                h = ((gn - bn) / d) % 6;
            } else if (max === gn) {
                h = (bn - rn) / d + 2;
            } else {
                h = (rn - gn) / d + 4;
            }
            h = (h * 60 + 360) % 360;
        }
        return { h, s, l };
    }

    function hslToRgb(h, s, l) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;

        let r1, g1, b1;
        const hh = h % 360;
        if (hh < 60)      { r1 = c; g1 = x; b1 = 0; }
        else if (hh < 120) { r1 = x; g1 = c; b1 = 0; }
        else if (hh < 180) { r1 = 0; g1 = c; b1 = x; }
        else if (hh < 240) { r1 = 0; g1 = x; b1 = c; }
        else if (hh < 300) { r1 = x; g1 = 0; b1 = c; }
        else               { r1 = c; g1 = 0; b1 = x; }

        return {
            r: Math.round((r1 + m) * 255),
            g: Math.round((g1 + m) * 255),
            b: Math.round((b1 + m) * 255),
        };
    }

    function toDarkColor(r, g, b) {
        const { h, s, l } = rgbToHsl(r, g, b);

        // 粉色偏移判定：H∈[335,360]∪[0,5] 且 S>28% 且 L>61%
        const isPink = (h >= 335 || h <= 5) && s > 0.28 && l > 0.61;
        const hUse = isPink ? (h - 56 + 360) % 360 : h;

        return hslToRgb(hUse, 0.79, 0.05);
    }

    // 将任意 CSS 颜色字符串转为「深色主题取色」结果字符串；解析失败返回 null
    function _toDarkColorStr(colorStr) {
        const rgb = _parseRgb(colorStr);
        if (!rgb) return null;
        const { r, g, b } = toDarkColor(rgb.r, rgb.g, rgb.b);
        return `rgb(${r}, ${g}, ${b})`;
    }

    // ── meta 元素获取 ──

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
        // 🚀 v3.6.6: 主题色基准（封面取色关闭时使用）
        let themeColor;
        if (_isDarkMode) {
            themeColor = '#0e0c16';
        } else if (typeof cfg !== 'undefined' && cfg.defaultColor) {
            themeColor = cfg.defaultColor;
        } else {
            themeColor = FALLBACK_COLOR;
        }

        // 🚀 v3.6.6: 封面取色开启 → 标题栏运用深色取色算法；关闭 → 继续应用主题色。
        // 不再判断 Chrome 标题栏状态（WCO 是否可见 / wcoPseudoImmersive 均不再参与）。
        let wcoColor;
        if (typeof cfg !== 'undefined' && cfg.followAccentColor && _currentColor) {
            wcoColor = _toDarkColorStr(_currentColor) || themeColor;
        } else {
            wcoColor = themeColor;
        }

        getMeta().setAttribute('content', wcoColor);
        // 同步变量备用（自绘左侧标题栏保持透明，不套色块）
        document.documentElement.style.setProperty('--wco-theme-color', wcoColor);
    }

    return { update, updateTopColor, refresh, onDarkModeChange };
})();
