/*
 * MBolka Player - Gamepad & Input v3.0.2
 * 2D focus navigation, keyboard/touch mappings, gamepad polling
 */

// 🚀 v3.0.2: 单功能精简状态 — 无长按/双击
let _comboState = {};
let _seekModeActive = false;
let _seekLastTime = 0;
let _rightStickLastTime = 0;
let _rightStickScrollTime = 0;
let _lrcBlurRestoreTimer = null;

const updateFocusContext = () => {
    focusableElements.forEach(el => el.classList.remove('gamepad-focus'));
    currentFocusIndex = -1;

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

    // 🚀 核心：检测动态生成的专辑详情面板与静态曲库弹窗
    const albumDetailPanel = document.querySelector('.album-detail-panel');
    const coverLibModal = document.getElementById('coverLibraryModal');

    if (topModal) {
        // 🩹 v2.8.8: 为每个浮窗类型收集所有可交互元素（含无 .focusable 类的原生元素）
        if (topModal.id === 'settingsModal') {
            // 🚀 v3.0.1: 仅收集活跃面板 + 全局控件，避免焦点泄漏到隐藏面板
            const activePanel = topModal.querySelector('.settings-panel.active');
            const globalSel = '.settings-tab-bar .focusable, .settings-tab-bar button, .settings-tab-bar input, .settings-tab-bar select, .modal-header .focusable, .modal-header button, .settings-footer .focusable';
            const globalCtrls = Array.from(topModal.querySelectorAll(globalSel));
            if (activePanel) {
                const panelFocus = Array.from(activePanel.querySelectorAll('.focusable, button, input[type="range"], input[type="checkbox"], select, [tabindex="0"]'));
                focusableElements = [...globalCtrls, ...panelFocus];
            } else {
                focusableElements = globalCtrls;
            }
        } else if (topModal.id === 'playlistModal') {
            const container = currentViewMode === 'coverwall' ? el.coverWallContainer : el.plContainer;
            const modalFocus = Array.from(topModal.querySelectorAll('.focusable, input[type="text"], button'));
            const listFocus = Array.from(container.querySelectorAll('.focusable'));
            focusableElements = [...modalFocus, ...listFocus];
        } else if (topModal.id === 'coverLibraryModal') {
            focusableElements = Array.from(topModal.querySelectorAll('.focusable, .tab-button, .album-card'));
        } else {
            // 其它浮窗：通用 .focusable 查询
            focusableElements = Array.from(topModal.querySelectorAll('.focusable'));
        }

        // 如果没有 focusable 元素，尝试聚焦弹窗内容
        if (focusableElements.length === 0 && topModal.querySelector('.modal-content')) {
            focusableElements = [topModal.querySelector('.modal-content')];
        }
    } else if (albumDetailPanel) {
        // 如果专辑详情打开，焦点锁定在详情内的按钮和歌曲行上
        focusableElements = Array.from(albumDetailPanel.querySelectorAll('.focusable'));
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
        const container = currentViewMode === 'coverwall' ? el.coverWallContainer : el.plContainer;
        const modalFocus = Array.from(el.playlistModal.querySelectorAll('.focusable'));
        const listFocus = Array.from(container.querySelectorAll('.focusable'));
        focusableElements = [...modalFocus, ...listFocus];
    } else if (isImmersiveMode) {
        focusableElements = Array.from(el.viewImm.querySelectorAll('.focusable'));
    } else {
        focusableElements = Array.from(el.viewMain.querySelectorAll('.focusable'));
    }
};

// 🚀 升级为智能 2D 空间导航系统
const moveFocus2D = (dir) => {
    if (focusableElements.length === 0) return;
    
    // 如果当前没有任何焦点，默认激活第一个
    if (currentFocusIndex === -1) {
        setFocus(0);
        return;
    }

    const currentEl = focusableElements[currentFocusIndex];
    const currentRect = currentEl.getBoundingClientRect();
    const curX = currentRect.left + currentRect.width / 2;
    const curY = currentRect.top + currentRect.height / 2;

    let bestTargetIdx = -1;
    let minScore = Infinity;

    focusableElements.forEach((targetEl, idx) => {
        if (idx === currentFocusIndex) return;

        const targetRect = targetEl.getBoundingClientRect();

        // 🩹 v2.8.8: 跳过不可见元素（size=0 或 display:none）
        if (targetRect.width === 0 || targetRect.height === 0) return;

        const tarX = targetRect.left + targetRect.width / 2;
        const tarY = targetRect.top + targetRect.height / 2;

        const dx = tarX - curX;
        const dy = tarY - curY;

        // 过滤绝对不符合方向要求的元素（比如按"右"时，过滤掉所有在左边的元素）
        let isOpposite = false;
        switch(dir) {
            case 'left': if (dx >= 0) isOpposite = true; break;
            case 'right': if (dx <= 0) isOpposite = true; break;
            case 'up': if (dy >= 0) isOpposite = true; break;
            case 'down': if (dy <= 0) isOpposite = true; break;
        }
        if (isOpposite) return;

        // 🩹 v2.8.8: 增强二维加权评分 + 可见性惩罚 + 元素大小奖励
        let score = 0;
        if (dir === 'left' || dir === 'right') {
            score = Math.abs(dx) + Math.abs(dy) * 2.5;
        } else {
            score = Math.abs(dy) + Math.abs(dx) * 2.5;
        }

        // 🩹 视口外惩罚：目标元素在视口外 → 大幅增加评分，基本排除
        const viewH = window.innerHeight;
        const viewW = window.innerWidth;
        if (targetRect.top < 0 || targetRect.bottom > viewH ||
            targetRect.left < 0 || targetRect.right > viewW) {
            score += 10000;
        }

        // 🩹 元素大小奖励：优先导航到更大的交互元素（按钮 > 标签）
        const area = targetRect.width * targetRect.height;
        score -= Math.log(area) * 0.5;

        if (score < minScore) {
            minScore = score;
            bestTargetIdx = idx;
        }
    });

    if (bestTargetIdx !== -1) {
        setFocus(bestTargetIdx);
    }
};

// 辅助设置聚焦函数，带滚动条视口自动跟随
function setFocus(idx) {
    if (currentFocusIndex >= 0 && focusableElements[currentFocusIndex]) {
        focusableElements[currentFocusIndex].classList.remove('gamepad-focus');
    }
    currentFocusIndex = idx;
    const target = focusableElements[currentFocusIndex];
    target.classList.add('gamepad-focus');
    
    // 🚀 让滚轮自动平滑跟随焦点，防止焦点卡到屏幕外面
    if (target.scrollIntoViewIfNeeded) {
        target.scrollIntoViewIfNeeded(false);
    } else {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// 保留旧 moveFocus 以兼容可能存在的调用，但内部委托给 2D 寻路
const moveFocus = (direction) => {
    if (direction === 1) moveFocus2D('down');
    else moveFocus2D('up');
};

const activateFocus = () => {
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
        } else if (focused.classList.contains('eq-preset-btn')) {
            focused.click();
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
        case 'a': case 'arrowleft': e.preventDefault(); moveFocus2D('left'); break;
        case 'd': case 'arrowright': e.preventDefault(); moveFocus2D('right'); break;

        case 'j': audio.currentTime -= 10; break;
        case 'k': audio.currentTime += 10; break;
        case 'i': toggleImmersiveMode(); break;
        case 'm': case 'r': cyclePlayMode(); break;
        case 'c': case 'y': toggleColorMode(); break;
        // 🚀 v2.8: U = 收藏/取消收藏, Shift+F = 全屏
        case 'u': e.preventDefault(); toggleFavorite(); break;
        case 'f': e.shiftKey ? toggleFullscreen() : (e.preventDefault(), toggleFavorite()); break;
        // 🚀 v2.8: D = 深色模式切换
        case 'd': toggleDarkMode(); break;
        case 'l': el.btnToggleLrc.click(); break;
        case 'p':
            closeAllModals();
            el.playlistModal.classList.add('open');
            currentViewMode = 'list';
            renderPlaylist();
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
            audio.currentTime = Math.max(0, audio.currentTime - 10);
            showToast("⏪ 快退 10秒");
        } else {
            // 右侧双击 - 快进10秒
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
            showToast("⏩ 快进 10秒");
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
        { id: 'btnToggleLrc',    tag: 'RS↕',  cls: 'pad-rs', tip: '右摇杆上下=滚动歌词' },
        { id: 'btnEnterImmersive', tag: '↓',  cls: 'pad-dpad', tip: '沉浸舱 (十字键↓)' },
        { id: 'btnExitImmersive',  tag: 'ⓑ',  cls: 'pad-b',    tip: '返回 (B)' },
        { id: 'btnToggleList',   tag: '←',    cls: 'pad-dpad', tip: '播放列表 (十字键←)' },
        { id: 'btnCoverLibrary', tag: '→',    cls: 'pad-dpad', tip: '曲库 (十字键→)' },
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
    // 关闭按钮统一标注 B 键
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
function removeGamepadHints() {
    document.body.classList.remove('gamepad-connected');
    document.querySelectorAll('.gamepad-badge').forEach(b => b.remove());
}
window.addEventListener("gamepadconnected", () => {
    gamepadConnected = true;
    el.padStatus.innerHTML = `🎮`;
    el.padStatus.title = '手柄已连接 · ⓐ确认 · ⓑ返回';
    el.padStatus.style.color = 'var(--primary)';
    injectGamepadHints();
    // 🚀 v3.0.0: 检测震动支持
    if (isRumbleSupported()) {
        if (typeof initVibration === 'function') initVibration();
    }
});
window.addEventListener("gamepaddisconnected", () => {
    gamepadConnected = false;
    el.padStatus.innerHTML = `⌨️`;
    el.padStatus.title = '等待手柄接入';
    el.padStatus.style.color = 'var(--text-sub)';
    removeGamepadHints();
});

// 🩹 v2.8.8: 滑块微调模式状态
let sliderFineMode = false;
let currentSlider = null;

const pollGamepad = () => {
    if (!gamepadConnected) { requestAnimationFrame(pollGamepad); return; }
    const pad = navigator.getGamepads()[0];
    if (pad) {
        const btns = pad.buttons.map(b => b.pressed);

        // --- B 键（button 1）：最高优先级 — 全域退出/关闭 ---
        if (btns[1] && !prevPadBtns[1]) {
            // 如果在滑块微调模式，先退出微调
            if (sliderFineMode) {
                sliderFineMode = false;
                currentSlider = null;
                showToast("🎯 退出滑块微调");
                updateFocusContext();
                prevPadBtns = btns.slice();
                return;
            }
            const closed = handleGlobalClose();
            if (!closed && isImmersiveMode) {
                toggleImmersiveMode();
            }
        }

        // --- A 键（button 0）：元素感知确认/激活 ---
        if (btns[0] && !prevPadBtns[0]) {
            // 如果已在微调模式，A键不做任何事（方向键负责调整）
            if (sliderFineMode) {
                prevPadBtns = btns.slice();
                return;
            }
            // 🩹 v2.8.8: 元素类型感知 — 滑块→微调、复选框→切换、下拉→聚焦
            if (currentFocusIndex >= 0 && focusableElements[currentFocusIndex]) {
                const target = focusableElements[currentFocusIndex];
                if (target.type === 'range') {
                    // 滑块 → 进入微调模式
                    sliderFineMode = true;
                    currentSlider = target;
                    showToast("🎯 滑块微调模式 · ⬅➡调整 · Ⓑ退出");
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

            prevPadBtns = btns.slice();
            prevPadAxes = Array.from(pad.axes);
            return; // 微调模式下跳过后续焦点导航
        }

        // 🚀 v3.0.2: X=播放暂停 / Y=收藏（单功能，无长按/双击）
        if (btns[2] && !prevPadBtns[2]) togglePlay();
        if (btns[3] && !prevPadBtns[3]) {
            if (currentIndex >= 0) toggleFavorite(currentIndex);
        }

        // 🚀 v3.0.2: LB/RB — 设置内切Tab，否则切歌
        if (btns[4] && !prevPadBtns[4]) {
            if (el.settingsModal.classList.contains('open')) {
                switchSettingsTab(-1);
            } else {
                goPrev();
            }
        }
        if (btns[5] && !prevPadBtns[5]) {
            if (el.settingsModal.classList.contains('open')) {
                switchSettingsTab(1);
            } else {
                goNext();
            }
        }

        // 🚀 v3.0.2: LT/RT 短按 = 快退/快进 5 秒（LT+RT 保留 Seek 模式）
        if (btns[6] && !prevPadBtns[6]) {
            audio.currentTime = Math.max(0, audio.currentTime - 5);
            showToast("⏪ 快退 5秒");
        }
        if (btns[7] && !prevPadBtns[7]) {
            audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
            showToast("⏩ 快进 5秒");
        }

        // 🚀 v3.0.2: View=PiP / Menu=设置
        if (btns[8] && !prevPadBtns[8]) togglePip();
        if (btns[9] && !prevPadBtns[9]) {
            closeAllModals();
            el.settingsModal.classList.add('open');
            renderThemePresets();
            renderEQPanel();
            updateFocusContext();
        }

        // 🚀 v3.0.2: L3=焦点模式切换 / R3=帮助页面
        if (btns[10] && !prevPadBtns[10]) toggleFocusMode();
        if (btns[11] && !prevPadBtns[11]) {
            closeAllModals();
            el.helpModal.classList.add('open');
            updateFocusContext();
        }

        // 🚀 v3.0.2: D-Pad 全新功能映射
        if (btns[12] && !prevPadBtns[12]) { toggleFullscreen(); }       // ↑ 全屏
        if (btns[13] && !prevPadBtns[13]) { toggleImmersiveMode(); }    // ↓ 沉浸舱
        if (btns[14] && !prevPadBtns[14]) {                             // ← 播放列表
            closeAllModals();
            el.playlistModal.classList.add('open');
            currentViewMode = 'list';
            renderPlaylist();
            updateFocusContext();
        }
        if (btns[15] && !prevPadBtns[15]) { showCoverLibrary(); }       // → 曲库

        // 左摇杆导航（保持不变）
        let stickX = pad.axes[0], stickY = pad.axes[1];
        if (Date.now() - lastNavTime > 200) {
            if (stickY < -0.5) { moveFocus2D('up'); lastNavTime = Date.now(); }
            else if (stickY > 0.5) { moveFocus2D('down'); lastNavTime = Date.now(); }
            else if (stickX < -0.5) { moveFocus2D('left'); lastNavTime = Date.now(); }
            else if (stickX > 0.5) { moveFocus2D('right'); lastNavTime = Date.now(); }
        }

        // 🚀 v3.0.2: 右摇杆 — 水平=音量, 垂直=滚动歌词/子页面
        const rightStickX = pad.axes[2] || 0;
        const rightStickY = pad.axes[3] || 0;
        if (Date.now() - _rightStickLastTime > 150) {
            if (Math.abs(rightStickX) > 0.3) {
                const volDelta = rightStickX > 0 ? 0.02 : -0.02;
                adjustVolume(volDelta);
                _rightStickLastTime = Date.now();
            }
        }
        if (Date.now() - _rightStickScrollTime > 100) {
            if (Math.abs(rightStickY) > 0.3) {
                const scrollAmount = rightStickY > 0 ? 40 : -40;
                const openModals = document.querySelectorAll('.modal-overlay.open');
                if (openModals.length > 0) {
                    const topModal = openModals[openModals.length - 1];
                    const scrollTarget = topModal.querySelector('.modal-content') || topModal;
                    scrollTarget.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    setTimeout(() => {
                        updateFocusContext();
                        // 聚焦滚动容器内左上角最近的元素
                        const scRect = scrollTarget.getBoundingClientRect();
                        const scX = scRect.left, scY = scRect.top;
                        let bestIdx = -1, bestDist = Infinity;
                        focusableElements.forEach((el, i) => {
                            const r = el.getBoundingClientRect();
                            if (r.bottom < scRect.top || r.top > scRect.bottom) return; // 不在可视区
                            const ox = r.left - scX, oy = r.top - scY;
                            const dist = Math.abs(ox) * 0.5 + Math.abs(oy); // 水平权重减半
                            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
                        });
                        if (bestIdx >= 0) setFocus(bestIdx);
                        else if (focusableElements.length > 0) setFocus(0);
                    }, 150);
                } else if (el.lrcPanel.style.display !== 'none') {
                    el.lrcView.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    _lrcScrollBlurClear();
                }
                _rightStickScrollTime = Date.now();
            }
        }

        // 🚀 v3.0.0: Seek 模式 (LT + RT 双扳机)
        if (btns[6] && btns[7]) {
            if (!_seekModeActive) {
                _seekModeActive = true;
                showToast('🎯 按住左摇杆←→控制进度，松开退出', '⏩');
                el.progAreaMain?.classList.add('seek-active');
            }
            if (pad.axes.length >= 2) {
                const lx = pad.axes[0];
                if (Math.abs(lx) > 0.3) {
                    const now = performance.now();
                    if (now - _seekLastTime > 100) {
                        _seekLastTime = now;
                        const step = Math.abs(lx) > 0.7 ? 5 : 1;
                        audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + (lx > 0 ? step : -step)));
                    }
                }
            }
        } else if (_seekModeActive) {
            _seekModeActive = false;
            el.progAreaMain?.classList.remove('seek-active');
            showToast('✅ Seek 完成', '⏩');
        }

        prevPadBtns = btns.slice();
        prevPadAxes = Array.from(pad.axes);
    }

    // 🚀 v3.0.0: 转发 gamepad 状态到 PiP 窗口
    if (typeof pipWindow !== 'undefined' && pipWindow && pipWindow.closed === false) {
        try {
            pipWindow.postMessage({
                type: 'gamepad-state',
                buttons: btns.slice(),
                axes: Array.from(pad.axes)
            }, '*');
        } catch(e) {}
    }

    requestAnimationFrame(pollGamepad);
};

// 🩹 v2.8.8: 辅助函数 — 切换设置浮窗选项卡
function switchSettingsTab(direction) {
    const tabs = document.querySelectorAll('.settings-tab');
    const activeTab = document.querySelector('.settings-tab.active');
    if (!tabs.length || !activeTab) return;
    const currentIdx = Array.from(tabs).indexOf(activeTab);
    const newIdx = (currentIdx + direction + tabs.length) % tabs.length;
    tabs[newIdx].click();
    showToast(`📑 ${tabs[newIdx].textContent.trim()}`);
    // 🚀 v3.0.1: 切换后自动聚焦新面板第一个元素
    setTimeout(() => {
        updateFocusContext();
        if (focusableElements.length > 0) setFocus(0);
    }, 100);
}

// 🩹 v2.8.8: 辅助函数 — 切换焦点模式（正常 ↔ 微调优先）
let focusMode = 'normal';
function toggleFocusMode() {
    focusMode = focusMode === 'normal' ? 'fine' : 'normal';
    showToast(`🎯 焦点模式: ${focusMode === 'normal' ? '正常导航' : '微调优先'}`);
}
requestAnimationFrame(pollGamepad);

// === 音频输出设备选择 (v2.8.13) ===
// 🔥 v2.8.13: 音频输出设备选择功能（Windows Chrome/Edge 支持）
let audioOutputDevices = [];
let currentAudioOutputDeviceId = '';

