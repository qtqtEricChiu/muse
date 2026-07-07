/*
 * MBolka Player — Theme Color Manager v3.4.1
 * 动态更新 <meta name="theme-color">（控制 Windows Chrome PWA 系统顶 bar 颜色）
 * 🚀 v3.4.1: 修正 WCO 分支语义反转 bug。
 * MBolka 自绘 .wco-titlebar 永远 display:none，OS 接管整条标题区域，
 * meta theme-color 即顶 bar 颜色 → 始终跟随封面色/默认色/深色模式变化。
 */

const ThemeColor = (() => {
    let _meta = null;
    let _currentColor = null;
    let _isDarkMode = false;

    const FALLBACK_COLOR = '#180219'; // 🚀 v3.4.1: 极端兜底（无 cfg 且无取色结果时的最后保底紫）

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

    // 🚀 v3.4.1: 重新套用当前颜色（WCO 显隐切换时调用，无需重新传参）
    function refresh() {
        _applyColor();
    }

    function onDarkModeChange(isDark) {
        _isDarkMode = isDark;
        _applyColor();
    }

    function _applyColor() {
        // 🚀 v3.4.1: meta theme-color 始终跟随封面色 / 默认色 / 深色模式。
        // 优先级：封面色 > 深色模式（#0e0c16）> 主题默认色（cfg.defaultColor）> 兜底紫（FALLBACK_COLOR）
        let color;
        if (_currentColor && !_isDarkMode) {
            color = _currentColor;
        } else if (_isDarkMode) {
            color = '#0e0c16';
        } else if (typeof cfg !== 'undefined' && cfg.defaultColor) {
            color = cfg.defaultColor;
        } else {
            color = FALLBACK_COLOR;
        }
        getMeta().setAttribute('content', color);
    }

    return { update, refresh, onDarkModeChange };
})();
