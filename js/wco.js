/*
 * MBolka Player — Window Controls Overlay Manager v3.6.5
 * WCO 标题栏：透明拖拽区 + 右侧系统窗口控制按钮（暗色去饱和）呈现
 * 🚀 v3.6.5: 取消导航按钮迁移与原 header 隐藏，维持用户原布局；
 *   左侧标题栏仅作透明拖拽区，右侧金刚键背景由 theme-color.js 注入暗色去饱和值。
 * 🚀 v3.2.2: 显隐切换时刷新 PWA theme-color；enable 时同步当前曲目
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
            // 🚀 v3.2.2: 显隐切换后刷新 PWA 标题栏配色
            if (typeof ThemeColor !== 'undefined') ThemeColor.refresh();
        });
    }

    function _enable() {
        if (_enabled) return;
        _enabled = true;
        _titlebar.style.display = 'flex';
        document.body.classList.add('wco-active');
        // 🚀 v3.6.5: 不再迁移导航按钮 / 隐藏原 header —— 维持用户原设计，
        // 仅将左侧标题栏作为透明拖拽区，右侧系统按钮由 meta theme-color 暗色呈现。
        _syncTrackTitle();
        // 🚀 v3.2.2: 启用时立即同步当前正在播放的曲目
        _syncCurrentTrack();
    }

    function _disable() {
        if (!_enabled) return;
        _enabled = false;
        _titlebar.style.display = 'none';
        document.body.classList.remove('wco-active');
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
