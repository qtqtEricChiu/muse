/*
 * MBolka Player — Theme Color Manager v3.2.2
 * 动态更新 <meta name="theme-color">
 * 🚀 v3.2.2: WCO 感知
 *   - 隐藏标题栏 (WCO active) → 全局固定 #180219
 *   - 显示标题栏            → 专辑封面色；无封面/取色失败 → 主题默认色
 */

const ThemeColor = (() => {
    let _meta = null;
    let _currentColor = null;
    let _isDarkMode = false;

    const HIDDEN_TITLEBAR_COLOR = '#180219'; // 🚀 v3.2.2: 隐藏标题栏时的统一背景色

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

    // 🚀 v3.2.2: 重新套用当前颜色（WCO 显隐切换时调用，无需重新传参）
    function refresh() {
        _applyColor();
    }

    function onDarkModeChange(isDark) {
        _isDarkMode = isDark;
        _applyColor();
    }

    function _applyColor() {
        let color;
        // 🚀 v3.2.2: 隐藏标题栏 → 全局统一 #180219（忽略封面色与深色模式）
        if (typeof WCO !== 'undefined' && WCO.isActive && WCO.isActive()) {
            color = HIDDEN_TITLEBAR_COLOR;
        } else if (_currentColor && !_isDarkMode) {
            color = _currentColor;
        } else if (_isDarkMode) {
            color = '#0e0c16';
        } else {
            // 无专辑封面时回调主题默认色
            color = (typeof cfg !== 'undefined' && cfg.defaultColor) ? cfg.defaultColor : '#e8b4b8';
        }
        getMeta().setAttribute('content', color);
    }

    return { update, refresh, onDarkModeChange };
})();
