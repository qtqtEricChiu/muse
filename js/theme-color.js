/*
 * MBolka Player — Theme Color Manager v3.5.0
 * 动态更新 <meta name="theme-color">（控制 Windows Chrome PWA 系统顶 bar / WCO 右上金刚键背景色）
 * 🚀 v3.4.2: 新增顶部取色支持。当背景图片存在时，优先使用图片顶部附近颜色作为 theme-color，
 * 使 WCO 模式下系统窗口控制按钮（右上金刚键）的背景与页面顶部背景融合，达成假沉浸效果。
 */

const ThemeColor = (() => {
    let _meta = null;
    let _currentColor = null;
    let _topColor = null;
    let _isDarkMode = false;

    const FALLBACK_COLOR = '#180219';

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
        let color;
        if (_topColor && !_isDarkMode) {
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
        // 同步给 CSS 变量，供 WCO 自绘标题栏（如启用）跟随同色
        document.documentElement.style.setProperty('--wco-theme-color', color);
    }

    return { update, updateTopColor, refresh, onDarkModeChange };
})();
