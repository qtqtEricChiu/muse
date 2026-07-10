/*
 * MBolka Player — Window Controls Overlay Manager v3.6.6p1
 * WCO 标题栏：透明拖拽区 + 右侧系统窗口控制按钮（暗色去饱和）呈现 + 沉浸模式按钮挂载槽（v3.6.6p1）
 * 🚀 v3.6.5: 取消导航按钮迁移与原 header 隐藏，维持用户原布局；左侧标题栏仅作透明拖拽区。
 * 🚀 v3.6.6p1: 当 WCO 启用（即 Chrome 已隐藏原生标题栏）时，沉浸模式/主界面可调用 WCO.mountActions(node) 把常用按钮挂到标题栏右侧，腾出底部空间。卸载调用 WCO.unmountActions()；金刚键背景始终由 js/theme-color.js 驱动。
 * 🚀 v3.2.2: 显隐切换时刷新 PWA theme-color；enable 时同步当前曲目。
 */

const WCO = (() => {
    let _titlebar = null;
    let _trackTitleEl = null;
    let _actionsSlot = null;
    let _enabled = false;
    let _mountedNode = null;

    function init() {
        _titlebar = document.getElementById('wco-titlebar');
        _trackTitleEl = document.getElementById('wcoTrackTitle');
        _actionsSlot = document.getElementById('wcoActionsSlot');
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
        _syncTrackTitle();
        // 🚀 v3.2.2: 启用时立即同步当前正在播放的曲目
        _syncCurrentTrack();
    }

    function _disable() {
        if (!_enabled) return;
        _enabled = false;
        _titlebar.style.display = 'none';
        document.body.classList.remove('wco-active');
        // 关闭时若有挂载按钮，自动卸载
        unmountActions();
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

    // 🚀 v3.6.6p1: 沉浸模式 / 主界面把常用按钮挂到 WCO 标题栏右侧（仅在 WCO 启用 + 沉浸模式时调用）。
    // 采用「移动 DOM」而非 clone 方式，避免事件监听丢失：原节点从源容器移入 WCO 槽，卸载时再放回原位。
    // 节点归属「moveSource / moveNextSibling」用于卸载时精准还原位置。
    let _moveSource = null;
    let _moveNextSibling = null;
    function mountActions(node) {
        if (!_enabled || !_actionsSlot || !node) return false;
        if (_mountedNode) unmountActions();
        _moveSource = node.parentNode;
        _moveNextSibling = node.nextSibling;
        _actionsSlot.appendChild(node);
        _mountedNode = node;
        _actionsSlot.style.display = 'flex';
        return true;
    }
    function unmountActions() {
        if (_mountedNode && _moveSource) {
            try { _moveSource.insertBefore(_mountedNode, _moveNextSibling); } catch (_) {}
        } else if (_actionsSlot && _actionsSlot.firstChild) {
            // 兜底：找不到源容器时移回 body 末尾
            while (_actionsSlot.firstChild) document.body.appendChild(_actionsSlot.firstChild);
        }
        if (_actionsSlot) _actionsSlot.style.display = 'none';
        _mountedNode = null;
        _moveSource = null;
        _moveNextSibling = null;
    }

    return { init, setTrack, isActive, mountActions, unmountActions };
})();
