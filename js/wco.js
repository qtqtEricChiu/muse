/*
 * MBolka Player — Window Controls Overlay Manager v3.2.0
 * WCO 标题栏：显示当前曲目 + 拖拽窗口
 */

const WCO = (() => {
    let _titlebar = null;
    let _trackTitleEl = null;
    let _enabled = false;

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
        });
    }

    function _enable() {
        if (_enabled) return;
        _enabled = true;
        _titlebar.style.display = 'flex';
        document.body.classList.add('wco-active');
        _syncTrackTitle();
    }

    function _disable() {
        if (!_enabled) return;
        _enabled = false;
        _titlebar.style.display = 'none';
        document.body.classList.remove('wco-active');
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
