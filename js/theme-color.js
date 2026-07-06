/*
 * MBolka Player — Theme Color Manager v3.2.0
 * 动态更新 <meta name="theme-color">
 */

const ThemeColor = (() => {
    let _meta = null;
    let _currentColor = null;
    let _isDarkMode = false;

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
        _currentColor = albumColor;
        _applyColor();
    }

    function onDarkModeChange(isDark) {
        _isDarkMode = isDark;
        _applyColor();
    }

    function _applyColor() {
        let color;
        if (_currentColor && !_isDarkMode) {
            color = _currentColor;
        } else if (_isDarkMode) {
            color = '#0e0c16';
        } else {
            color = '#e8b4b8';
        }
        getMeta().setAttribute('content', color);
    }

    return { update, onDarkModeChange };
})();
