/*
 * MBolka Player - Gamepad & Input v3.6.3
 * 2D focus navigation, keyboard/touch mappings, gamepad polling
 */

// 🚀 v3.0.2: 单功能精简状态 — 无长按/双击
let _comboState = {};
let _seekModeActive = false;
let _seekLastTime = 0;
let _rsVolLastTime = 0;          // 🚀 v3.4.2: 右摇杆音量连续调节的帧时间基准（dt 累加，去固定步进）
let _rightStickScrollTime = 0;
let _lrcBlurRestoreTimer = null;
let _rsFocusTimer = null;       // 🚀 v3.2.2: 右摇杆焦点延迟吸附
let _rsLastScrollTime = 0;
let _rsAccelStartTime = 0;       // 🚀 v3.3.0: 右摇杆加速度计时起点
let _cfAccelStartTime = 0;       // 🚀 v3.3.4: 曲库 coverflow 左摇杆横向滚动加速度计时起点
let _sliderHintLastTime = 0;      // 🚀 v3.4.x: 设置滑块焦点下左右拨杆提示 toast 节流
let _rsLrcStopTimer = null;       // 🚀 v3.4.2: 右摇杆滚动歌词时抑制自动跟随的复位计时
const FOCUS_DEAD_ZONE = 30;       // 🚀 v3.4.3: 2D 导航同排/同列死区常量（原 moveFocus2D 内联 30）
let _pipStateLastTime = 0;        // 🚀 v3.4.3: PiP 手柄状态转发节流时间基准（~30fps）
let _pollRunning = false;         // 🚀 v3.4.3: 手柄轮询运行标志（断开时停转省去空帧）

// 🩹 v3.2.3 P0: 惰性缓存 scrollable 引用，避免每帧 querySelectorAll 触发 reflow
let _cachedScrollable = null;
let _scrollableTimestamp = 0;

function invalidateScrollableCache() {
    _cachedScrollable = null;
    _scrollableTimestamp = 0;
}

function getActiveScrollable() {
    const now = Date.now();
    if (_cachedScrollable && (now - _scrollableTimestamp < 500)) return _cachedScrollable;
    const openModals = document.querySelectorAll('.modal-overlay.open');
    const topModal = openModals[openModals.length - 1];
    if (topModal) {
        // 🚀 v3.3.4: 网格模式（按艺术家/最近添加）下让右摇杆滚动曲库；coverflow 自行管理，不介入
        const clGrid = topModal.querySelector('#coverLibGrid');
        const cfMode = (typeof isCoverflowMode === 'function') ? isCoverflowMode() : true;
        if (clGrid && topModal.id === 'coverLibraryModal' && !cfMode) {
            _cachedScrollable = clGrid;
        } else {
            _cachedScrollable = topModal.querySelector('.settings-body')
                || topModal.querySelector('#playlistContainer')
                || topModal.querySelector('#albumDetailTracks')
                || topModal.querySelector('.album-detail-panel')
                || topModal.querySelector('.modal-content');
        }
    }
    _scrollableTimestamp = now;
    return _cachedScrollable;
}

const updateFocusContext = () => {
    // 🩹 v3.2.3 P0: modal 开/关时失效化 scrollable 缓存
    if (typeof invalidateScrollableCache === 'function') invalidateScrollableCache();

    focusableElements.forEach(el => el.classList.remove('gamepad-focus'));
    currentFocusIndex = -1;

    // 🩹 v3.2.3: 专辑详情面板 — 使用正确选择器（动态 overlay 携带 .open 类）
    const albumDetailOverlay = document.querySelector('#albumDetailOverlay.open');
    if (albumDetailOverlay) {
        focusableElements = Array.from(albumDetailOverlay.querySelectorAll('.focusable, button, [tabindex="0"]'));
        if (focusableElements.length > 0) {
            if (currentFocusIndex >= focusableElements.length || currentFocusIndex === -1) setFocus(0);
        }
        return;
    }

    // 🚀 v2.8.4: 按 z-index 优先级检测最上层浮窗
    const allModals = Array.from(document.querySelectorAll('.modal-overlay'));
    const activeModals = allModals.filter(m => {
        return m.classList.contains('open') && document.body.contains(m);
    }).sort((a, b) => {
        const zA = parseInt(getComputedStyle(a).zIndex) || 0;
        const zB = parseInt(getComputedStyle(b).zIndex) || 0;
        return zB - zA;
    });

    // 获取最上层浮窗
    const topModal = activeModals[0];

    // 🚀 核心：检测静态曲库弹窗
    const coverLibModal = document.getElementById('coverLibraryModal');

    if (topModal) {
        // 🩹 v2.8.8: 为每个浮窗类型收集所有可交互元素（含无 .focusable 类的原生元素）
        if (topModal.id === 'settingsModal') {
            // 🚀 v3.0.1: 仅收集活跃面板 + 全局控件，避免焦点泄漏到隐藏面板
            const activePanel = topModal.querySelector('.settings-panel.active');
            const globalSel = '.settings-tab-bar .focusable, .settings-tab-bar button, .settings-tab-bar input, .settings-tab-bar select, .modal-header .focusable, .modal-header button, .settings-footer .focusable';
            const globalCtrls = Array.from(topModal.querySelectorAll(globalSel));
            if (activePanel) {
                let panelFocus = Array.from(activePanel.querySelectorAll('.focusable, button, input[type="range"], input[type="checkbox"], select, [tabindex="0"]'));
                // 🚀 v3.2.1: 过滤隐藏/冗余元素
                panelFocus = panelFocus.filter(el => {
                    if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.closest('.toggle-switch')) return false;
                    const dropdown = el.closest('.custom-select-dropdown');
                    if (dropdown) {
                        const wrap = dropdown.closest('.custom-select-wrap');
                        if (wrap && !wrap.classList.contains('open')) return false;
                    }
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    return true;
                });
                focusableElements = [...globalCtrls, ...panelFocus];
            } else {
                focusableElements = globalCtrls;
            }
        } else if (topModal.id === 'playlistModal') {
            const container = el.plContainer;
            const headerEls = Array.from(topModal.querySelectorAll('.modal-header .focusable, .modal-header button, .playlist-tab-bar .focusable, .playlist-tab-bar button, .search-container .focusable, .search-container button'));
            const listEls = container ? Array.from(container.querySelectorAll('.focusable, button, [tabindex="0"]')) : [];
            // 🩹 v3.2.3: 列表项在前，header 在后。上翻时优先回到列表顶部
            focusableElements = [...listEls, ...headerEls];
        } else if (topModal.id === 'coverLibraryModal') {
            const headerEls = Array.from(topModal.querySelectorAll('.modal-header .focusable, .modal-header button, .cover-lib-tabs .focusable, .cover-lib-tabs button, .search-container .focusable'));
            const cfMode = (typeof isCoverflowMode === 'function') ? isCoverflowMode() : true;
            if (cfMode) {
                // 🚀 v3.3.3: coverflow 模式 —— 居中即焦点，网格卡片不纳入焦点系统（避免随滑动逐个跳变）
                focusableElements = [...headerEls];
            } else {
                // 🚀 v3.3.4: 网格模式（按艺术家/最近添加）—— 卡片纳入 2D 导航
                const gridCards = Array.from(topModal.querySelectorAll('#coverLibGrid .cover-lib-card.focusable'));
                focusableElements = [...headerEls, ...gridCards];
            }
        } else {
            // 其它浮窗：通用 .focusable 查询
            focusableElements = Array.from(topModal.querySelectorAll('.focusable'));
        }

        // 如果没有 focusable 元素，尝试聚焦弹窗内容
        if (focusableElements.length === 0 && topModal.querySelector('.modal-content')) {
            focusableElements = [topModal.querySelector('.modal-content')];
        }
    } else if (document.querySelector('.album-detail-panel')) {
        // 如果专辑详情打开，焦点锁定在详情内的按钮和歌曲行上
        focusableElements = Array.from(document.querySelector('.album-detail-panel').querySelectorAll('.focusable'));
    } else if (coverLibModal && coverLibModal.classList.contains('open')) {
        // 如果曲库打开，焦点锁定在 Tab 按钮和专辑卡片上
        focusableElements = Array.from(coverLibModal.querySelectorAll('.focusable'));
    } else if (el.helpModal.classList.contains('open')) {
        focusableElements = Array.from(el.helpModal.querySelectorAll('.focusable'));
    } else if (el.fileInfoModal.classList.contains('open')) {
        focusableElements = Array.from(el.fileInfoModal.querySelectorAll('.focusable'));
    } else if (el.settingsModal.classList.contains('open')) {
        focusableElements = Array.from(el.settingsModal.querySelectorAll('.focusable'));
    } else if (el.playlistModal.classList.contains('open')) {
        const modalFocus = Array.from(el.playlistModal.querySelectorAll('.focusable'));
        const listFocus = Array.from(el.plContainer.querySelectorAll('.focusable'));
        focusableElements = [...listFocus, ...modalFocus];
    } else if (isImmersiveMode) {
        focusableElements = Array.from(el.viewImm.querySelectorAll('.focusable'));
    } else {
        focusableElements = Array.from(el.viewMain.querySelectorAll('.focusable'));
    }
};

// 🚀 v3.2.1: 最近行/列优先 2D 导航
// 🩹 v3.2.3: 列表向上导航时优先滚动到列表顶部再跳到金刚区
const _scrollableContainers = '.playlist-items, #coverLibGrid, #playlistContainer, .settings-body, .album-detail-tracks';

const moveFocus2D = (dir) => {
    if (focusableElements.length === 0) return;
    
    if (currentFocusIndex === -1) {
        setFocus(0);
        return;
    }

    // 🩹 v3.2.3: 向上导航时检测：如果当前元素在可滚动容器内且容器未到顶部，先滚动
    if (dir === 'up') {
        const container = focusableElements[currentFocusIndex]?.closest(_scrollableContainers);
        if (container && container.scrollTop > 0) {
            // 检查当前元素是否在容器可见区域顶部附近
            const cr = container.getBoundingClientRect();
            const er = focusableElements[currentFocusIndex].getBoundingClientRect();
            const distFromTop = er.top - cr.top;
            if (distFromTop <= 60) {
                // 当前元素已经在可视区顶部 → 滚动容器向上
                container.scrollTop -= 80;
                return;
            }
        }
    }

    const currentEl = focusableElements[currentFocusIndex];
    const currentRect = currentEl.getBoundingClientRect();
    const curX = currentRect.left + currentRect.width / 2;
    const curY = currentRect.top + currentRect.height / 2;

    // 第一阶段：筛选候选
    const candidates = [];
    focusableElements.forEach((targetEl, idx) => {
        if (idx === currentFocusIndex) return;
        const targetRect = targetEl.getBoundingClientRect();
        if (targetRect.width === 0 || targetRect.height === 0) return;
        const tarX = targetRect.left + targetRect.width / 2;
        const tarY = targetRect.top + targetRect.height / 2;
        const dx = tarX - curX;
        const dy = tarY - curY;
        let isOpposite = false;
        const DEAD = FOCUS_DEAD_ZONE; // 🚀 v3.3.4: 同排/同列死区，导航方向须与当前元素明显错开，避免卡在 header 同一排（下不去卡片网格）
        switch(dir) {
            case 'left':  if (dx >= -DEAD) isOpposite = true; break;   // 排除同列（dx≈0）元素
            case 'right': if (dx <= DEAD) isOpposite = true; break;    // 排除同列
            case 'up':    if (dy >= -DEAD) isOpposite = true; break;   // 排除同排
            case 'down':  if (dy <= DEAD) isOpposite = true; break;    // 排除同排（header 陷阱）
        }
        if (isOpposite) return;
        candidates.push({ idx, dx, dy, targetRect });
    });

    if (candidates.length === 0) return;

    // 第二阶段：优先「对齐」候选（按交叉轴筛带）—— 横向导航锁同排、纵向导航锁同列，
    //   避免被「离轴但前进轴更近」的元素抢走（例：向右时下方 PiP 比同排歌词水平更近却错位，导致焦点乱跳）。
    //   ⚠️ 原实现误用「前进轴最近距离」做带：横向用 minAbsDx、纵向用 minAbsDy，
    //      会把真正同排/同列的目标排除掉。改为按对齐轴（横向按 |dy|、纵向按 |dx|）筛带即修复。
    // 第二阶段：按 |dy| 筛带 —— 横向=锁同排(交叉轴对齐)、纵向=锁最近下行(前进轴)，二者统一收敛到 |dy|
    //   • 横向：修复「右移时下方 PiP 比同排歌词更近却错位抢焦点」(v3.4.3 原修复，保留)
    //   • 纵向：修复「关闭键向下直接跳到同列深处滑块」的跨段跳——v3.4.3 误用 |dx| 对齐带导致该回归，
    //           改回 |dy|(=下行距离) 带后，纵向只在本段最近下行元素间选择，不再跨到深处滑块。
    const minAbsDy = Math.min(...candidates.map(c => Math.abs(c.dy)));
    const tol = Math.max(40, minAbsDy * 1.5);
    const band = candidates.filter(c => Math.abs(c.dy) <= tol);
    const pool = band.length ? band : candidates;

    // 第三阶段：评分
    let bestTargetIdx = -1;
    let minScore = Infinity;
    pool.forEach(c => {
        let score;
        if (dir === 'left' || dir === 'right') {
            score = Math.abs(c.dx) + Math.abs(c.dy) * 2.5;
        } else {
            score = Math.abs(c.dy) + Math.abs(c.dx) * 2.5;
        }
        const viewH = window.innerHeight;
        const viewW = window.innerWidth;
        if (c.targetRect.top < 0 || c.targetRect.bottom > viewH ||
            c.targetRect.left < 0 || c.targetRect.right > viewW) {
            score += 10000;
        }
        const area = c.targetRect.width * c.targetRect.height;
        score -= Math.log(area) * 0.5;
        // 🚀 v3.2.2: 同容器奖励 — 垂直导航优先留在当前滚动容器内（横向同理，避免从列表中跳出）
        const currentContainer = currentEl.closest(_scrollableContainers);
        const targetEl = focusableElements[c.idx];
        if (currentContainer && targetEl && targetEl.closest(_scrollableContainers) === currentContainer) {
            score -= 80;
        }
        if (score < minScore) { minScore = score; bestTargetIdx = c.idx; }
    });

    if (bestTargetIdx !== -1) setFocus(bestTargetIdx);
};

// 辅助设置聚焦函数，带滚动条视口自动跟随
function setFocus(idx, skipScroll) {
    if (currentFocusIndex >= 0 && focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('gamepad-focus');
    }
    currentFocusIndex = idx;
    const target = focusableElements[currentFocusIndex];
    target.classList.add('gamepad-focus');

    // 🚀 v3.3.3: 曲库已取消卡片焦点，不再由 setFocus 反向驱动 coverflow 居中的切换
    // 在 coverflow 中由 updateCoverflow 负责居中滚动，跳过 setFocus 自带的 scrollIntoView
    if (!skipScroll) {
        if (target.scrollIntoViewIfNeeded) {
            target.scrollIntoViewIfNeeded(false);
        } else {
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
}

// 保留旧 moveFocus 以兼容可能存在的调用，但内部委托给 2D 寻路
const moveFocus = (direction) => {
    if (direction === 1) moveFocus2D('down');
    else moveFocus2D('up');
};

// 🚀 v3.3.4: 横向导航 —— coverflow 模式左右切换居中唱片；网格模式走 2D 导航
const coverLibNav = (dir) => {
    const clModal = document.getElementById('coverLibraryModal');
    const clOpen = clModal && clModal.classList.contains('open');
    const cfMode = (typeof isCoverflowMode === 'function') ? isCoverflowMode() : true;
    if (clOpen && cfMode && typeof coverLibMoveCenter === 'function') {
        coverLibMoveCenter(dir === 'left' ? -1 : 1);
    } else {
        moveFocus2D(dir);
    }
};

const activateFocus = () => {
    // 🚀 v3.3.4: 曲库 coverflow(按专辑) 模式 —— A/Enter 始终作用于居中唱片（居中即焦点）；
    //           Tab/搜索/关闭分别由 LB·RB / Y / B 接管，不再让 A 误触头部按钮（避免"回到开头"）
    const clModal = document.getElementById('coverLibraryModal');
    const cfMode = (typeof isCoverflowMode === 'function') ? isCoverflowMode() : true;
    // 🩹 v3.3.4: 层级关系 —— 专辑详情打开时 A 键作用于详情曲目，而非上一级 coverflow 居中卡
    const albumDetailOpen = !!document.querySelector('#albumDetailOverlay.open');
    if (clModal && clModal.classList.contains('open') && cfMode && !albumDetailOpen) {
        const centerCard = (typeof getCoverLibCenterCard === 'function') ? getCoverLibCenterCard() : null;
        if (centerCard) { centerCard.click(); return; }
    }
    if (currentFocusIndex >= 0 && focusableElements[currentFocusIndex]) {
        // 🔧 v2.8.1 P3: 增强手柄确认逻辑，处理更多元素类型
        const focused = focusableElements[currentFocusIndex];
        if (focused.classList.contains('album-detail-track')) {
            // 专辑详情曲目：播放歌曲并关闭详情面板
            const detailPanel = document.querySelector('.album-detail-panel');
            if (detailPanel) {
                const trackIdx = Array.from(detailPanel.querySelectorAll('.album-detail-track')).indexOf(focused);
                if (trackIdx >= 0) {
                    const trackEls = detailPanel.querySelectorAll('.album-detail-track');
                    trackEls[trackIdx].click();
                }
            }
        } else {
            focused.click();
        }
    } else {
        togglePlay();
    }
};

updateFocusContext();

// === 键盘映射 ===
window.addEventListener('keydown', (e) => {
    // 🚀 v2.8: 快捷键优先处理（无视input聚焦限制）
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); el.btnLoad.click(); return; }
    if (e.shiftKey && e.key === 'Escape') { e.preventDefault(); closeAllModals(); if (isImmersiveMode) toggleImmersiveMode(); return; }
    
    // 输入框内忽略大部分快捷键
    if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target.type !== 'range') {
        if (e.key !== 'Escape') return;
    }
    
    switch(e.key.toLowerCase()) {
        case ' ': case 'enter': e.preventDefault(); activateFocus(); break;
        
        // 🚀 WASD与方向键全面升级为2D空间导航
        case 'w': case 'arrowup': e.preventDefault(); moveFocus2D('up'); break;
        case 's': case 'arrowdown': e.preventDefault(); moveFocus2D('down'); break;
        case 'a': case 'arrowleft': e.preventDefault(); coverLibNav('left'); break;
        case 'd': case 'arrowright': e.preventDefault(); e.shiftKey ? toggleDarkMode() : coverLibNav('right'); break;

        case 'j': getActivePlayAudio().currentTime -= 10; break;
        case 'k': getActivePlayAudio().currentTime += 10; break;
        case 'i': toggleImmersiveMode(); break;
        case 'm': case 'r': cyclePlayMode(); break;
        case 'c': case 'y': toggleColorMode(); break;
        // 🚀 v2.8: U = 收藏/取消收藏, Shift+F = 全屏
        case 'u': e.preventDefault(); toggleFavorite(currentIndex); break;
        case 'f': e.shiftKey ? toggleFullscreen() : (e.preventDefault(), toggleFavorite(currentIndex)); break;
        case 'l': el.btnToggleLrc.click(); break;
        case 'p':
            closeAllModals();
            el.playlistModal.classList.add('open');
            if (typeof _pushModal === 'function') _pushModal('playlistModal', null); // 🩹 v3.3.4: 推栈，确保 B 键逐级返回
            currentViewMode = 'list';
            renderPlaylist();
            if (typeof initPlaylistTabBar === 'function') initPlaylistTabBar();
            break;
        // 🚀 v2.8: / 聚焦播放列表搜索框
        case '/':
            if (el.playlistModal.classList.contains('open')) {
                e.preventDefault();
                const s = document.getElementById('searchInput');
                if (s) { s.focus(); s.select(); }
            }
            break;
        case 't': e.altKey ? (e.preventDefault(), showSleepQuickMenu()) : showStatsPanel(); break;
        case 'g': showCoverLibrary(); break;
        case 'q': togglePip(); break;
        case '?':
            e.preventDefault();
            closeAllModals();
            if (typeof _pushModal === 'function') _pushModal('helpModal', null);
            el.helpModal.classList.add('open');
            updateFocusContext();
            break;
        case 'escape':
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                const closed = handleGlobalClose();
                if (!closed && isImmersiveMode) {
                    toggleImmersiveMode();
                }
            }
            break;
    }
});

// === 移动端手势 ===
let gestureStartX = 0, gestureStartY = 0, gestureStartTime = 0;

document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        gestureStartX = e.touches[0].clientX;
        gestureStartY = e.touches[0].clientY;
        gestureStartTime = Date.now();
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const ct = e.target && e.target.closest ? e.target : null;
    if (ct && (ct.closest('button') || ct.closest('input') || ct.closest('.progress-area') || ct.closest('.modal-overlay'))) return;
    const dx = e.changedTouches[0].clientX - gestureStartX;
    const dy = e.changedTouches[0].clientY - gestureStartY;
    const dt = Date.now() - gestureStartTime;

    // 双击检测 (300ms内两次点击)
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 300) {
        const screenW = window.innerWidth;
        if (e.changedTouches[0].clientX < screenW * 0.4) {
            // 左侧双击 - 快退10秒
            getActivePlayAudio().currentTime = Math.max(0, getActivePlayAudio().currentTime - 10);
            showToast("快退 10秒", iconSvg('rewind'));
        } else {
            // 右侧双击 - 快进10秒
            getActivePlayAudio().currentTime = Math.min(getActivePlayAudio().duration, getActivePlayAudio().currentTime + 10);
            showToast("快进 10秒", iconSvg('fast-forward'));
        }
    }

    // 上下滑动调节音量 (非沉浸模式，非按钮区域)
    if (!isImmersiveMode && Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 50) {
        if (dy > 0) adjustVolume(-0.05);
        else adjustVolume(0.05);
    }

    // 沉浸模式左右长滑切歌
    if (isImmersiveMode && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) goPrev();
        else goNext();
    }
});

// === 手柄映射 ===
// 🚀 v3.0.2: 手柄按键指示器 — 单功能映射
function injectGamepadHints() {
    document.body.classList.add('gamepad-connected');
    const hints = [
        { id: 'btnPlay',         tag: '✕',    cls: 'pad-x',  tip: '播放/暂停' },
        { id: 'imm-btnPlay',     tag: '✕',    cls: 'pad-x',  tip: '播放/暂停' },
        { id: 'btnPrev',         tag: 'LB',   cls: 'pad-lb', tip: '上一首' },
        { id: 'imm-btnPrev',     tag: 'LB',   cls: 'pad-lb', tip: '上一首' },
        { id: 'btnNext',         tag: 'RB',   cls: 'pad-rb', tip: '下一首' },
        { id: 'imm-btnNext',     tag: 'RB',   cls: 'pad-rb', tip: '下一首' },
        { id: 'btnSettings',     tag: '☰',    cls: 'pad-menu', tip: '设置 (Menu)' },
        { id: 'btnFavQuick',     tag: 'Ⓨ',    cls: 'pad-y',  tip: '收藏 (Y)' },
        { id: 'btnToggleLrc',    tag: 'RS↕',  cls: 'pad-rs pad-wide', tip: '右摇杆上下=滚动歌词' },
        { id: 'btnEnterImmersive', tag: '↓',  cls: 'pad-dpad', tip: '沉浸舱 (十字键↓)' },
        { id: 'btnExitImmersive',  tag: '↓',  cls: 'pad-dpad', tip: '退出沉浸 (十字键↓)' },
        { id: 'btnToggleList',   tag: '←',    cls: 'pad-dpad', tip: '播放列表 (十字键←)' },
        { id: 'btnCoverLibrary', tag: '→',    cls: 'pad-dpad', tip: '曲库 (十字键→)' },
        { id: 'btnPipQuick',     tag: 'Ⓥ',    cls: 'pad-view', tip: '画中画 (View)' },
        { id: 'btnOpenHelpShortcuts', tag: '⑪', cls: 'pad-r3', tip: '快捷键帮助 (R3)' },
    ];
    hints.forEach(h => {
        const el = document.getElementById(h.id);
        if (!el || el.querySelector('.gamepad-badge')) return;
        el.style.position = el.style.position || 'relative';
        const badge = document.createElement('span');
        badge.className = `gamepad-badge ${h.cls}`;
        badge.textContent = h.tag;
        badge.title = h.tip;
        el.appendChild(badge);
    });
    // 🩹 v3.2.3: 关闭按钮统一标注 B 键（浮动 badge，不修改按钮文本）
    ['btnCloseSettings','btnCloseCoverLib','btnCloseList','btnCloseStats',
     'btnCloseAlbumDetail','btnCloseFileInfo','btnCloseHelp'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn && !btn.querySelector('.gamepad-badge')) {
            btn.style.position = 'relative';
            const b = document.createElement('span');
            b.className = 'gamepad-badge pad-b';
            b.textContent = 'ⓑ';
            b.title = '关闭/返回';
            btn.appendChild(b);
        }
    });
    // 🩹 v3.2.3: 退出沉浸舱 badge
    const immExitBtn = document.getElementById('btnExitImmersive');
    if (immExitBtn && !immExitBtn.querySelector('.gamepad-badge')) {
        immExitBtn.style.position = 'relative';
        const b = document.createElement('span');
        b.className = 'gamepad-badge pad-b';
        b.textContent = 'ⓑ';
        b.title = '关闭/返回 (B/Esc)';
        immExitBtn.appendChild(b);
    }
}

// 🚀 v3.0.2: 右摇杆滚动歌词时清除高斯模糊
function _lrcScrollBlurClear() {
    const lines = el.lrcView?.querySelectorAll('.lrc-line');
    if (!lines) return;
    lines.forEach(l => l.style.filter = 'blur(0px)');
    clearTimeout(_lrcBlurRestoreTimer);
    _lrcBlurRestoreTimer = setTimeout(() => {
        lines.forEach(l => l.style.filter = '');
    }, 800);
}
// 🚀 v3.4.2: 右摇杆滚动歌词时抑制自动跟随 + 关闭 smooth 滚动
//   复用 wheel/touch 的同一套「用户滚动中」语义：isUserScrollingLyrics=true 期间 syncLyrics 不抢滚；
//   停止 1.5s 后复位并重新对齐到当前行。scroll-behavior 临时改 auto，避免逐帧 scrollTop 被平滑动画拖慢。
function _rsLrcMarkScrolling() {
    isUserScrollingLyrics = true;
    el.lrcView.style.scrollBehavior = 'auto';
    // 🚀 v3.6.6p2: 右摇杆滚动歌词时显示滚动条
    el.lrcView.classList.add('lrc-scroll-active');
    clearTimeout(_rsLrcStopTimer);
    _rsLrcStopTimer = setTimeout(() => {
        isUserScrollingLyrics = false;
        el.lrcView.style.scrollBehavior = '';
        // 🚀 v3.6.6p2: 右摇杆停止后淡出隐藏滚动条
        el.lrcView.classList.remove('lrc-scroll-active');
        syncLyrics();
    }, 1500);
}
function removeGamepadHints() {
    document.body.classList.remove('gamepad-connected');
    document.querySelectorAll('.gamepad-badge').forEach(b => b.remove());
}
window.addEventListener("gamepadconnected", () => {
    gamepadConnected = true;
    // 🩹 v3.4.x: 用当前手柄真实按键/摇杆状态初始化，避免连接瞬间因 prevPadBtns=[] 误触发所有"刚按下"动作
    const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(p => p) : null;
    if (gp) {
        prevPadBtns = gp.buttons.map(b => b.pressed);
        prevPadAxes = Array.from(gp.axes);
    }
    el.padStatus.innerHTML = iconSvg('gamepad');
    el.padStatus.title = '手柄已连接 · ⓐ确认 · ⓑ返回';
    el.padStatus.style.color = 'var(--primary)';
    injectGamepadHints();
    // 🚀 v3.4.3: 手柄接入时若轮询已停转则重启（断开后会自动停转省电）
    if (!_pollRunning) { _pollRunning = true; requestAnimationFrame(pollGamepad); }
    // 🚀 v3.0.0: 检测震动支持
    if (isRumbleSupported()) {
        if (typeof initVibration === 'function') initVibration();
    }
});
window.addEventListener("gamepaddisconnected", () => {
    gamepadConnected = false;
    el.padStatus.innerHTML = iconSvg('keyboard');
    el.padStatus.title = '等待手柄接入';
    el.padStatus.style.color = 'var(--text-sub)';
    removeGamepadHints();
});

// 🩹 v2.8.8: 滑块微调模式状态
let sliderFineMode = false;
let currentSlider = null;

const pollGamepad = () => {
    let pad = null, btns = [];
    try {
        if (!gamepadConnected) return;
        pad = navigator.getGamepads()[0];
        if (pad) {
            btns = pad.buttons.map(b => b.pressed);

        // --- B 键（button 1）：最高优先级 — 全域退出/关闭 ---
        if (btns[1] && !prevPadBtns[1]) {
            // 如果在滑块微调模式，先退出微调
            if (sliderFineMode) {
                sliderFineMode = false;
                currentSlider = null;
                showToast("退出滑块微调", iconSvg('target'));
                updateFocusContext();
                return; // prevPadBtns/prevPadAxes 由 finally 统一同步
            }
            const closed = handleGlobalClose(); // 🚀 v3.4.3: handleGlobalClose 内部已调度 updateFocusContext（ui-core.js:135），此处不再重复
            if (!closed && isImmersiveMode) {
                toggleImmersiveMode();
            }
        }

        // --- A 键（button 0）：元素感知确认/激活 ---
        if (btns[0] && !prevPadBtns[0]) {
            // 如果已在微调模式，A键不做任何事（方向键负责调整）
            if (sliderFineMode) {
                return; // prevPadBtns/prevPadAxes 由 finally 统一同步
            }
            // 🩹 v2.8.8: 元素类型感知 — 滑块→微调、复选框→切换、下拉→聚焦
            if (currentFocusIndex >= 0 && focusableElements[currentFocusIndex]) {
                const target = focusableElements[currentFocusIndex];
                if (target.type === 'range') {
                    // 滑块 → 进入微调模式
                    sliderFineMode = true;
                    currentSlider = target;
                    showToast("滑块微调模式 · ⬅➡调整 · Ⓑ退出", iconSvg('target'));
                } else if (target.type === 'checkbox') {
                    target.checked = !target.checked;
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (target.tagName === 'SELECT') {
                    target.focus();
                } else {
                    activateFocus();
                }
            } else {
                activateFocus();
            }
        }

        // 🩹 v2.8.8: 滑块微调模式 — 方向键调整值
        if (sliderFineMode && currentSlider) {
            const step = parseFloat(currentSlider.step) || 1;
            const min = parseFloat(currentSlider.min) || 0;
            const max = parseFloat(currentSlider.max) || 100;

            const padLeft = btns[14] || (pad.axes[0] < -0.5 && Date.now() - lastNavTime > 200);
            const padRight = btns[15] || (pad.axes[0] > 0.5 && Date.now() - lastNavTime > 200);

            if (padLeft && !prevPadBtns[14] && !(pad.axes[0] < -0.5 && prevPadAxes && prevPadAxes[0] < -0.5)) {
                currentSlider.value = Math.max(min, parseFloat(currentSlider.value) - step);
                currentSlider.dispatchEvent(new Event('input', { bubbles: true }));
                lastNavTime = Date.now();
            }
            if (padRight && !prevPadBtns[15] && !(pad.axes[0] > 0.5 && prevPadAxes && prevPadAxes[0] > 0.5)) {
                currentSlider.value = Math.min(max, parseFloat(currentSlider.value) + step);
                currentSlider.dispatchEvent(new Event('input', { bubbles: true }));
                lastNavTime = Date.now();
            }

            return; // 微调模式下跳过后续焦点导航；prevPadBtns/prevPadAxes 由 finally 统一同步
        }

        // 🚀 v3.0.2: X=播放暂停 / Y=收藏（单功能，无长按/双击）
        if (btns[2] && !prevPadBtns[2]) togglePlay();
        if (btns[3] && !prevPadBtns[3]) {
            // 🩹 v3.2.4: 曲库打开时 Y 键聚焦搜索框
            const coverLib = document.getElementById('coverLibraryModal');
            if (coverLib && coverLib.classList.contains('open') && !document.querySelector('#albumDetailOverlay.open')) {
                const search = coverLib.querySelector('#coverLibSearch');
                if (search) { search.focus(); search.select(); }
            } else if (currentIndex >= 0) {
                toggleFavorite(currentIndex);
            }
        }

        // 🚀 v3.2.2: LB/RB — 设置/播放列表/曲库内切Tab，否则切歌
        if (btns[4] && !prevPadBtns[4]) {
            if (el.settingsModal.classList.contains('open')) {
                switchSettingsTab(-1);
            } else if (el.playlistModal.classList.contains('open')) {
                switchPlaylistTab(-1);
            } else if (document.getElementById('coverLibraryModal')?.classList.contains('open') && !document.querySelector('#albumDetailOverlay.open')) {
                switchCoverLibTab(-1);
            } else {
                goPrev();
            }
        }
        if (btns[5] && !prevPadBtns[5]) {
            if (el.settingsModal.classList.contains('open')) {
                switchSettingsTab(1);
            } else if (el.playlistModal.classList.contains('open')) {
                switchPlaylistTab(1);
            } else if (document.getElementById('coverLibraryModal')?.classList.contains('open') && !document.querySelector('#albumDetailOverlay.open')) {
                switchCoverLibTab(1);
            } else {
                goNext();
            }
        }

        // 🚀 v3.0.2: LT/RT 短按 = 快退/快进 5 秒（LT+RT 保留 Seek 模式）
        if (btns[6] && !prevPadBtns[6]) {
            getActivePlayAudio().currentTime = Math.max(0, getActivePlayAudio().currentTime - 5);
            showToast("快退 5秒", iconSvg('rewind'));
        }
        if (btns[7] && !prevPadBtns[7]) {
            getActivePlayAudio().currentTime = Math.min(getActivePlayAudio().duration || 0, getActivePlayAudio().currentTime + 5);
            showToast("快进 5秒", iconSvg('fast-forward'));
        }

        // 🚀 v3.0.2: View=PiP / Menu=设置
        if (btns[8] && !prevPadBtns[8]) togglePip();
        if (btns[9] && !prevPadBtns[9]) {
            closeAllModals();
            el.settingsModal.classList.add('open');
            if (typeof _pushModal === 'function') _pushModal('settingsModal', null); // 🩹 v3.3.4: 推栈，确保 B 键逐级返回
            renderThemePresets();
            renderEQPanel();
            updateFocusContext();
        }

        // 🚀 v3.0.2: L3=焦点模式切换 / R3=帮助页面
        if (btns[10] && !prevPadBtns[10]) toggleFocusMode();
        if (btns[11] && !prevPadBtns[11]) {
            closeAllModals();
            if (typeof _pushModal === 'function') _pushModal('helpModal', null);
            el.helpModal.classList.add('open');
            updateFocusContext();
        }

        // 🚀 v3.0.2: D-Pad 全新功能映射
        if (btns[12] && !prevPadBtns[12]) { toggleFullscreen(); }       // ↑ 全屏
        if (btns[13] && !prevPadBtns[13]) { toggleImmersiveMode(); }    // ↓ 沉浸舱
        if (btns[14] && !prevPadBtns[14]) {                             // ← 播放列表
            closeAllModals();
            el.playlistModal.classList.add('open');
            if (typeof _pushModal === 'function') _pushModal('playlistModal', null); // 🩹 v3.3.4: 推栈，确保 B 键逐级返回
            currentViewMode = 'list';
            renderPlaylist();
            if (typeof initPlaylistTabBar === 'function') initPlaylistTabBar(); // 🩹 v3.2.3
            updateFocusContext();
        }
        if (btns[15] && !prevPadBtns[15]) { showCoverLibrary(); }       // → 曲库

        // 左摇杆导航
        let stickX = pad.axes[0], stickY = pad.axes[1];
        const clModal = document.getElementById('coverLibraryModal');
        const clOpen = clModal && clModal.classList.contains('open');
        const cfMode = (typeof isCoverflowMode === 'function') ? isCoverflowMode() : true;
        // 🩹 v3.3.4: 层级关系 —— 专辑详情打开时曲库手柄逻辑应暂停，左摇杆不再控上一级 coverflow
        const albumDetailOpen = !!document.querySelector('#albumDetailOverlay.open');
        if (clOpen && cfMode && !albumDetailOpen) {
            // 🚀 v3.3.4: coverflow(按专辑) 模式 —— 左右=逐帧连续横向滚动 + 加速度（解决原 ±1 离散跳变的低帧率感）
            //   🩹 修复：coverflow grid 带 scroll-snap + smooth，小幅增量会被吸附/平滑动画抵消 → 完全不滚动。
            //           故滚动期间临时关闭 snap/smooth，并用 _clScrollSuppressUntil 抑制 onCoverflowScroll 回环；
            //           松手时把"视觉中心卡"定为新 center 并即时恢复 3D 景深。
            if (Math.abs(stickX) > 0.2) {
                const grid = clModal.querySelector('#coverLibGrid');
                if (grid) {
                    grid.style.scrollSnapType = 'none';   // 关闭吸附，确保增量即时生效
                    grid.style.scrollBehavior = 'auto';   // 关闭平滑，避免动画抵消
                    const now = Date.now();
                    if (_cfAccelStartTime === 0) _cfAccelStartTime = now;
                    const elapsed = now - _cfAccelStartTime;
                    const mag = Math.abs(stickX);
                    const speed = (4 + mag * 14) * Math.min(1 + elapsed / 700, 5); // 持续拨动越久越快，上限5倍
                    grid.scrollLeft += stickX * speed;   // 左推 stickX<0 → scrollLeft 减小（往前）；右推 → 往后
                    _clScrollSuppressUntil = now + 800;  // 抑制 onCoverflowScroll 的回拉重算，避免 scroll 事件回环
                    if (typeof enterCoverflowFlat === 'function') enterCoverflowFlat(); // 滚动时全部清晰
                }
            } else {
                // 松手 —— 恢复吸附/平滑，定格当前视觉中心卡为新 center 并恢复 3D
                _cfAccelStartTime = 0;
                const grid = clModal.querySelector('#coverLibGrid');
                if (grid) {
                    grid.style.scrollSnapType = '';
                    grid.style.scrollBehavior = '';
                    const cards = grid.querySelectorAll('.cover-lib-card');
                    if (cards.length) {
                        const mid = grid.scrollLeft + grid.clientWidth / 2;
                        let best = 0, bestD = Infinity;
                        cards.forEach((c, i) => {
                            const cm = c.offsetLeft + c.offsetWidth / 2;
                            const d = Math.abs(cm - mid);
                            if (d < bestD) { bestD = d; best = i; }
                        });
                        if (best !== coverLibCenter) coverLibCenter = best;
                        clearTimeout(_coverflowFlatTimer);   // 取消 enterCoverflowFlat 的 350ms 恢复定时器，避免拉回旧 center
                        _coverflowIsFlat = false;
                        _clScrollSuppressUntil = Date.now() + 800;
                        if (typeof updateCoverflow === 'function') updateCoverflow(); // 居中到新 center 并恢复景深
                    }
                }
            }
            // 上下仍用于跳到 Tab/头部（2D 导航，保留节流）
            if (Date.now() - lastNavTime > 200 && !(btns[6] && btns[7])) {
                if (stickY < -0.5) { moveFocus2D('up'); lastNavTime = Date.now(); }
                else if (stickY > 0.5) { moveFocus2D('down'); lastNavTime = Date.now(); }
            }
        } else {
            // 🚀 v3.4.x: 焦点在设置滑块上且左右拨动左摇杆 → 提示按 A 进入滑块微调
            const _focusEl = (currentFocusIndex >= 0) ? focusableElements[currentFocusIndex] : null;
            const _sliderFocused = _focusEl && _focusEl.type === 'range'
                && el.settingsModal.classList.contains('open') && !sliderFineMode;
            if (_sliderFocused) {
                // 🩹 v3.4.3 修复：焦点在设置滑块上时「卡死、任何方向都挪不开」
                //   原实现只拦截左右并提示按 A，但对上下完全不处理 → 焦点被困在滑块。
                //   现改为：上下仍可离开滑块做 2D 导航（自然退出），仅左右保留拦截+提示（避免误触离开滑块）。
                if (Date.now() - lastNavTime > 200 && !(btns[6] && btns[7])) {
                    if (stickY < -0.5) { moveFocus2D('up'); lastNavTime = Date.now(); }
                    else if (stickY > 0.5) { moveFocus2D('down'); lastNavTime = Date.now(); }
                    else if (stickX < -0.5 || stickX > 0.5) {
                        // 未进微调模式时，左右不离开滑块，提示按 A 进入微调
                        if (Date.now() - _sliderHintLastTime > 1500) {
                            _sliderHintLastTime = Date.now();
                            showToast('点击 Ⓐ 进入滑块微调（←→ 调整）', iconSvg('target'));
                        }
                    }
                }
            } else if (Date.now() - lastNavTime > 200 && !(btns[6] && btns[7])) {
                // 网格模式 / 其它浮窗 —— 2D 导航（含网格卡片左右/上下漫游）
                if (stickY < -0.5) { moveFocus2D('up'); lastNavTime = Date.now(); }
                else if (stickY > 0.5) { moveFocus2D('down'); lastNavTime = Date.now(); }
                else if (stickX < -0.5) { moveFocus2D('left'); lastNavTime = Date.now(); }
                else if (stickX > 0.5) { moveFocus2D('right'); lastNavTime = Date.now(); }
            }
        }

        // 🚀 v3.2.2: 右摇杆 — 水平=音量, 垂直=滚动+延迟焦点吸附
        const rightStickX = pad.axes[2] || 0;
        const rightStickY = pad.axes[3] || 0;
        // 🚀 v3.4.2: 右摇杆水平 = 音量，无级/类无级调节 —— 按偏转量与帧时间连续累加
        //   去掉原固定 ±0.02 + 150ms 门槛的步进感；偏角越大变化越快，松手即停，表现更连贯
        const rsNow = Date.now();
        if (_rsVolLastTime === 0) _rsVolLastTime = rsNow;
        const rsDt = (rsNow - _rsVolLastTime) / 1000; // 秒，帧率无关
        if (Math.abs(rightStickX) > 0.12) {
            const mag = Math.abs(rightStickX);
            const rate = 0.6 * mag * (0.5 + mag);     // 满偏≈0.9/s，偏角越小变化越细腻
            adjustVolumeContinuous(Math.sign(rightStickX) * rate * rsDt);
        }
        _rsVolLastTime = rsNow;
        // 🚀 v3.3.4: 右摇杆垂直滚动（页面 + 歌词），全程带加速度（拨动越久越快）
        if (Math.abs(rightStickY) > 0.2) {
            const now = Date.now();
            if (_rsAccelStartTime === 0) _rsAccelStartTime = now;
            const elapsed = now - _rsAccelStartTime;
            const mag = Math.abs(rightStickY);
            const speed = (4 + mag * 12) * Math.min(1 + elapsed / 700, 5); // 基础随幅度，持续拨动最多5倍速
            // 目标：优先当前打开浮窗的滚动容器；无浮窗且歌词可见则滚动歌词
            const topModalOpen = document.querySelector('.modal-overlay.open');
            let rsTarget = null, isLrc = false;
            if (topModalOpen) {
                rsTarget = getActiveScrollable();
            } else if (el.lrcPanel && el.lrcPanel.style.display !== 'none') {
                rsTarget = el.lrcView; isLrc = true;
            }
            if (rsTarget) {
                rsTarget.scrollTop += rightStickY * speed;
                if (isLrc) {
                    // 🚀 v3.4.2 修复：右摇杆滚歌词「几乎失效」
                    //   原仅清模糊，未置 isUserScrollingLyrics，导致 syncLyrics 每次 timeupdate
                    //   都平滑滚回当前行与手柄输入互相打架；同时关掉 scroll-behavior:smooth
                    //   避免逐帧 scrollTop 叠加被平滑动画拖慢。
                    _rsLrcMarkScrolling();
                    _lrcScrollBlurClear();
                } else {
                    clearTimeout(_rsFocusTimer);
                    // 🩹 v3.2.3 P1: 限制候选数为 50 个/找到 5 个即停，减少 getBoundingClientRect 调用
                    _rsFocusTimer = setTimeout(() => {
                        if (!rsTarget) return;
                        // 🚀 v3.4.3: 仅当当前焦点已滚出视口时才自动吸附，避免与左摇杆导航抢夺焦点
                        const curFocus = (currentFocusIndex >= 0) ? focusableElements[currentFocusIndex] : null;
                        if (curFocus && typeof curFocus.getBoundingClientRect === 'function') {
                            const r = curFocus.getBoundingClientRect();
                            const vw = window.innerWidth, vh = window.innerHeight;
                            if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) return;
                        }
                        const cr = rsTarget.getBoundingClientRect();
                        const visible = [];
                        const maxScan = Math.min(focusableElements.length, 50);
                        for (let i = 0; i < maxScan && visible.length < 5; i++) {
                            const fel = focusableElements[i];
                            if (!rsTarget.contains(fel)) continue;
                            const r = fel.getBoundingClientRect();
                            if (r.bottom > cr.top + 20 && r.top < cr.bottom - 20 && r.right > cr.left && r.left < cr.right) {
                                visible.push(fel);
                            }
                        }
                        if (visible.length > 0) {
                            visible.sort((a, b) => {
                                const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
                                return (ar.top + ar.left * 0.3) - (br.top + br.left * 0.3);
                            });
                            const idx = focusableElements.indexOf(visible[0]);
                            if (idx !== -1) setFocus(idx);
                        }
                    }, 450);
                }
            }
        } else {
            // 摇杆回中 — 重置加速度计时器
            _rsAccelStartTime = 0;
        }

        // 🚀 v3.0.0: Seek 模式 (LT + RT 双扳机)
        if (btns[6] && btns[7]) {
            if (!_seekModeActive) {
                _seekModeActive = true;
                showToast('按住左摇杆←→控制进度，松开退出', iconSvg('fast-forward'));
                el.progAreaMain?.classList.add('seek-active');
            }
            if (pad.axes.length >= 2) {
                const lx = pad.axes[0];
                if (Math.abs(lx) > 0.3) {
                    const now = performance.now();
                    if (now - _seekLastTime > 100) {
                        _seekLastTime = now;
                        const step = Math.abs(lx) > 0.7 ? 5 : 1;
                        getActivePlayAudio().currentTime = Math.max(0, Math.min(getActivePlayAudio().duration || 0, getActivePlayAudio().currentTime + (lx > 0 ? step : -step)));
                    }
                }
            }
        } else if (_seekModeActive) {
            _seekModeActive = false;
            el.progAreaMain?.classList.remove('seek-active');
            showToast('Seek 完成', iconSvg('fast-forward'));
        }

        prevPadBtns = btns.slice();
        prevPadAxes = Array.from(pad.axes);
    }

    // 🚀 v3.0.0: 转发 gamepad 状态到 PiP 窗口；🚀 v3.4.3: 节流到 ~30fps，避免每帧 ~60/s 的 postMessage 开销
    if (pad && typeof pipWindow !== 'undefined' && pipWindow && pipWindow.closed === false) {
        const _pipNow = Date.now();
        if (_pipNow - _pipStateLastTime > 33) {
            _pipStateLastTime = _pipNow;
            try {
                pipWindow.postMessage({
                    type: 'gamepad-state',
                    buttons: btns.slice(),
                    axes: Array.from(pad.axes)
                }, '*');
            } catch(e) {}
        }
    }
    } catch (err) {
        // 🛡 v3.3.1: 单帧异常隔离 — 任何按钮/焦点处理出错都不应拖垮整个手柄轮询循环
        console.error('[pollGamepad] 帧异常已被隔离，手柄循环继续运行：', err);
    } finally {
        // 始终同步上一帧按键状态，确保循环不会因异常而永久死亡
        try { if (btns && btns.length) prevPadBtns = btns.slice(); } catch (_) {}
        try { if (pad && pad.axes) prevPadAxes = Array.from(pad.axes); } catch (_) {}
        // 🚀 v3.4.3: 仅在手柄连接时续排下一帧；未连接则停转，省去空帧（连接时由 gamepadconnected 重启）
        if (gamepadConnected) requestAnimationFrame(pollGamepad);
        else _pollRunning = false;
    }
};

// 🩹 v2.8.8: 辅助函数 — 切换设置浮窗选项卡
function switchSettingsTab(direction) {
    const tabs = document.querySelectorAll('.settings-tab');
    const activeTab = document.querySelector('.settings-tab.active');
    if (!tabs.length || !activeTab) return;
    const currentIdx = Array.from(tabs).indexOf(activeTab);
    const newIdx = (currentIdx + direction + tabs.length) % tabs.length;
    tabs[newIdx].click();
    showToast(`${tabs[newIdx].textContent.trim()}`, iconSvg('file-text'));
    // 🚀 v3.0.1: 切换后自动聚焦新面板第一个元素；🚀 v3.4.3: 改用 rAF 等待面板重排后再取焦点，避免固定延时效脆
    requestAnimationFrame(() => {
        updateFocusContext();
        if (focusableElements.length > 0) setFocus(0);
    });
}

// 🩹 v2.8.8: 辅助函数 — 切换焦点模式（正常 ↔ 微调优先）
let focusMode = 'normal';
function toggleFocusMode() {
    focusMode = focusMode === 'normal' ? 'fine' : 'normal';
    showToast(`焦点模式: ${focusMode === 'normal' ? '正常导航' : '微调优先'}`, iconSvg('target'));
}
_pollRunning = true; requestAnimationFrame(pollGamepad);

// 🚀 v3.2.2: 播放列表 Tab 切换（全部 ↔ 收藏）
// 🩹 v3.2.3: 使用 playlist-tab-bar 驱动切换
function switchPlaylistTab(dir) {
    const bar = document.querySelector('#playlistModal .playlist-tab-bar');
    if (!bar) return;
    const tabs = Array.from(bar.querySelectorAll('.playlist-tab'));
    if (tabs.length < 2) return;
    const activeIdx = tabs.findIndex(t => t.classList.contains('active'));
    const nextIdx = (activeIdx + dir + tabs.length) % tabs.length;
    tabs[nextIdx].click(); // click 会触发 initPlaylistTabBar 绑定的切换逻辑
}

// 🚀 v3.2.2: 曲库 Tab 切换（按专辑 ↔ 按艺术家 ↔ 最近添加）
function switchCoverLibTab(dir) {
    const tabs = Array.from(document.querySelectorAll('#coverLibraryModal .cover-lib-tab'));
    if (tabs.length < 2) return;
    const activeIdx = tabs.findIndex(t => t.classList.contains('active'));
    const nextIdx = (activeIdx + dir + tabs.length) % tabs.length;
    tabs.forEach(t => t.classList.remove('active'));
    tabs[nextIdx].classList.add('active');
    tabs[nextIdx].click();
    setTimeout(() => {
        // 🚀 v3.3.4: 切换 Tab 后按当前模式刷新（coverflow 居中 / 网格重扫焦点）。
        // 🚀 v3.6.x: 180ms 为等待 Tab 切换后 DOM 重渲染完成再居中 coverflow 的经验值（rAF 双帧不稳时的回退）
        if (typeof refreshCoverLibAfterRender === 'function') refreshCoverLibAfterRender();
        else { if (typeof updateFocusContext === 'function') updateFocusContext(); if (typeof updateCoverflow === 'function') updateCoverflow(); }
    }, 180);
}

// === 音频输出设备选择 (v2.8.13) ===
// 🔥 v2.8.13: 音频输出设备选择功能（Windows Chrome/Edge 支持）
let audioOutputDevices = [];
let currentAudioOutputDeviceId = '';

