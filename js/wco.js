/*
 * MBolka Player — Window Controls Overlay Manager v3.6.3
 * WCO 标题栏：显示当前曲目 + 拖拽窗口
 * 🚀 v3.2.2: 显隐切换时刷新 PWA theme-color；enable 时同步当前曲目
 */

const WCO = (() => {
    let _titlebar = null;
    let _trackTitleEl = null;
    let _enabled = false;
    let _appHeader = null;
    let _navActions = null;
    let _wcoNav = null;

    function init() {
        _titlebar = document.getElementById('wco-titlebar');
        _trackTitleEl = document.getElementById('wcoTrackTitle');
        if (!_titlebar || !_trackTitleEl) return;

        if (!('windowControlsOverlay' in navigator)) return;

        const wco = navigator.windowControlsOverlay;

        if (wco.visible) _enable();

        wco.addEventListener('geometrychange', () => {
            if (wco.visible) _enable();
            else _disable();
            // 🚀 v3.2.2: 显隐切换后刷新 PWA 标题栏配色
            if (typeof ThemeColor !== 'undefined') ThemeColor.refresh();
        });
    }

    function _enable() {
        if (_enabled) return;
        _enabled = true;
        _titlebar.style.display = 'flex';
        document.body.classList.add('wco-active');
        // 🚀 v3.6.4: 将顶部导航按钮迁入 WCO 标题栏，实现伪沉浸统一
        if (!_appHeader) _appHeader = document.querySelector('.header');
        if (!_navActions) _navActions = document.querySelector('.nav-actions');
        if (!_wcoNav) _wcoNav = document.getElementById('wcoNav');
        if (_navActions && _wcoNav) _wcoNav.appendChild(_navActions);
        if (_appHeader) _appHeader.classList.add('wco-moved');
        _syncTrackTitle();
        // 🚀 v3.2.2: 启用时立即同步当前正在播放的曲目
        _syncCurrentTrack();
    }

    function _disable() {
        if (!_enabled) return;
        _enabled = false;
        _titlebar.style.display = 'none';
        document.body.classList.remove('wco-active');
        // 🚀 v3.6.4: 恢复导航按钮到原 header
        if (_navActions && _appHeader && _wcoNav && _navActions.parentNode === _wcoNav) {
            _appHeader.appendChild(_navActions);
        }
        if (_appHeader) _appHeader.classList.remove('wco-moved');
    }

    // 🚀 v3.2.2: 从全局播放状态同步当前曲目标题（切到 WCO 模式时兜底）
    function _syncCurrentTrack() {
        try {
            if (typeof playlist !== 'undefined' && typeof currentIndex !== 'undefined'
                && currentIndex >= 0 && playlist[currentIndex]) {
                const s = playlist[currentIndex];
                setTrack(s.title, s.artist);
            }
        } catch (_) {}
    }

    function setTrack(title, artist) {
        if (!_enabled || !_trackTitleEl) return;
        _trackTitleEl.textContent = (title && artist) ? `${title} — ${artist}` : 'MBolka Player';
    }

    function _syncTrackTitle() {
        const titleEl = document.getElementById('main-songTitle');
        const artistEl = document.getElementById('main-songArtist');
        if (titleEl && artistEl) {
            const t = titleEl.textContent || '';
            const a = artistEl.textContent || '';
            if (t && t !== 'MBolka Player Ultimate') _trackTitleEl.textContent = `${t} — ${a}`;
        }
    }

    function isActive() { return _enabled; }

    return { init, setTrack, isActive };
})();
