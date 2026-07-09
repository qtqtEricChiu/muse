/*
 * MBolka Player - UI Core v3.6.3
 * Modal management, button bindings, settings UI, theme presets, EQ panel, stats, BG settings
 */

// 🚀 v3.2.0: Modal 访问栈 — B 键/Esc 逐级返回
let _modalVisitStack = [];
function _pushModal(id, restore) { _modalVisitStack.push({ id, restore }); }
function _popModal() {
    if (!_modalVisitStack.length) return false;
    const entry = _modalVisitStack.pop();
    if (entry.restore) entry.restore();
    else setTimeout(() => updateFocusContext(), 100);
    return true;
}
function _clearModalStack() { _modalVisitStack = []; }

const _closeModalsSync = (isSwitching = false) => {
    // 寻找当前处于打开状态的弹窗
    const openModals = document.querySelectorAll('.modal-overlay.open');
    
    openModals.forEach(m => {
        m.classList.remove('open');
        
        // 🚀 只有当"切换窗口"时，为了防止两个大弹窗重叠，才让旧窗口瞬间消失（禁用 transition）
        if (isSwitching) {
            m.style.transition = 'none';
            const content = m.querySelector('.modal-content');
            if (content) content.style.transition = 'none';
            
            // 100ms 后立刻恢复 transition，绝不干扰下一次打开
            setTimeout(() => {
                m.style.transition = '';
                if (content) content.style.transition = '';
            }, 100);
        }
    });

    // 清理其他动态生成的面板
    const statsPanel = document.querySelector('.stats-grid');
    if (statsPanel) statsPanel.closest('.modal-overlay').remove();
    const detailPanel = document.querySelector('.album-detail-panel');
    if (detailPanel) detailPanel.closest('.modal-overlay').remove();
    
    updateFocusContext();
};

// 🩹 v2.8.8: 专用关闭函数 — 曲库/帮助/文件信息（手柄B键+Esc退出支持）
function closeCoverLibrary() {
    const modal = document.getElementById('coverLibraryModal');
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    setTimeout(() => updateFocusContext(), 400);
}
function closeHelp() {
    const modal = el.helpModal;
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    setTimeout(() => updateFocusContext(), 400);
}
function closeFileInfo() {
    const modal = el.fileInfoModal;
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    setTimeout(() => updateFocusContext(), 400);
}

// 正常关闭弹窗（点击Close、Esc、手柄B）：🚀 彻底恢复原本极具动感的 CSS 淡出和回弹缩小动画！
const closeAllModals = () => {
    _clearModalStack();       // 🚀 v3.2.0: 清空返回栈
    _closeModalsSync(false);
};

// === 🚀 v3.2.0: 栈驱动的全局返回（B 键/Esc 逐级返回） ===
function handleGlobalClose() {
    // 🩹 v3.3.4: 始终优先关闭"当前实际最上层(z-index 最高)的打开浮窗"。
    //   根因：播放列表等浮窗若叠在曲库上层打开却未推栈，旧逻辑按栈顶(曲库)关闭，
    //        导致最上层播放列表仍开着 → 手柄 B 看似"无法返回主界面"。现改为关闭真实最上层。
    const allModals = Array.from(document.querySelectorAll('.modal-overlay'));
    const openModals = allModals.filter(m => m.classList.contains('open') && document.body.contains(m));
    if (openModals.length === 0) {
        if (_modalVisitStack.length) _modalVisitStack.length = 0; // 清理可能残留的陈旧栈条目
        return false;
    }
    openModals.sort((a, b) => {
        const za = parseInt(getComputedStyle(a).zIndex) || 0;
        const zb = parseInt(getComputedStyle(b).zIndex) || 0;
        if (za !== zb) return zb - za;                 // z-index 高者在上
        // 同 z-index：DOM 中靠后(后绘制)的视为上层（如播放列表叠在曲库之上且同为 1000）
        return allModals.indexOf(b) - allModals.indexOf(a);
    });
    const realTop = openModals[0];

    // 弹掉与 realTop 不匹配的陈旧栈顶（这些条目指向被上层浮窗盖住、未推栈的浮窗）
    while (_modalVisitStack.length) {
        const s = _modalVisitStack[_modalVisitStack.length - 1];
        const sEl = document.getElementById(s.id) || document.querySelector(`[data-modal-id="${s.id}"]`);
        if (sEl === realTop) break; // 栈顶就是实际最上层 → 正常逐级返回
        _modalVisitStack.pop();      // 陈旧条目，丢弃
    }

    // 🩹 v2.8.8: 按浮窗类型使用专用关闭函数（确保动画+焦点正确）
    if (realTop.id === 'coverLibraryModal') {
        closeCoverLibrary();
    } else if (realTop.id === 'settingsModal') {
        closeSettings();
    } else if (realTop.id === 'playlistModal') {
        closePlaylist();
    } else if (realTop.id === 'helpModal') {
        closeHelp();
    } else if (realTop.id === 'fileInfoModal') {
        closeFileInfo();
    } else if (realTop.querySelector('.album-detail-panel')) {
        // 专辑详情 → 关闭详情面板
        const closeBtn = realTop.querySelector('#btnCloseAlbumDetail');
        if (closeBtn) closeBtn.click();
    } else {
        // 兜底：移除 open 触发退出动画，延迟清理
        realTop.classList.remove('open');
        setTimeout(() => {
            if (realTop.parentNode && !realTop.classList.contains('open')) {
                realTop.remove();
            }
            updateFocusContext();
        }, 400);
    }

    // 与实际最上层匹配的栈顶出栈（若有 restore 回调则执行）
    if (_modalVisitStack.length) {
        const top = _modalVisitStack[_modalVisitStack.length - 1];
        const topEl = document.getElementById(top.id) || document.querySelector(`[data-modal-id="${top.id}"]`);
        if (topEl === realTop) _popModal();
    }

    setTimeout(() => updateFocusContext(), 50); // 更新焦点到下层浮窗/主界面
    return true; // 成功关闭了一个弹窗
}

// 🩹 v2.8.8: 专用关闭函数 — 设置浮窗
function closeSettings() {
    const modal = el.settingsModal;
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    setTimeout(() => {
        if (!modal.classList.contains('open')) {
            updateFocusContext();
            saveSettings();
            showToast("设置已保存", iconSvg('settings'));
        }
    }, 400);
}

// 🩹 v2.8.8: 专用关闭函数 — 播放列表浮窗
function closePlaylist() {
    const modal = el.playlistModal;
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    setTimeout(() => {
        if (!modal.classList.contains('open')) {
            updateFocusContext();
        }
    }, 400);
}

// 切换窗口：旧窗口瞬间消失，新窗口优雅回弹展开
const safeTransition = (fn) => {
    _closeModalsSync(true); // 传参 true：让旧窗口瞬间消失，防止两个大弹窗叠在一起
    
    // 给浏览器 50ms 缓冲，确保旧窗口的 transition 禁用完全生效
    setTimeout(() => {
        if (document.startViewTransition) {
            document.startViewTransition(() => fn());
        } else {
            fn();
        }
    }, 50);
};

// === 顶级强力绑定顶部金刚键 ===
const bindBtn = (id, fn) => {
    const el = document.getElementById(id);
    if (el) {
        // 先移除旧绑定防重复，再用监听器强绑
        el.onclick = null; 
        el.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止任何可能的冒泡拦截
            fn();
        });
    }
};

bindBtn('btnLoadFolder', () => {
    if (window.showDirectoryPicker) pickAndLoadFolder();
    else el.folderIn.click();
});

bindBtn('btnToggleLrc', () => {
    const isH = el.lrcPanel.style.display === 'none';
    if (isH) {
        el.lrcPanel.style.display = 'flex';
        el.btnToggleLrc.classList.add('active');
        // 🔥 v3.6.1: 歌词栏淡入（高斯模糊→清晰）
        el.lrcPanel.classList.remove('lrc-panel-out');
        void el.lrcPanel.offsetWidth;
        el.lrcPanel.classList.add('lrc-panel-in');
        syncLyrics(true);
    } else {
        // 🔥 v3.6.1: 歌词栏淡出后再隐藏，保证出入场动画完整
        el.lrcPanel.classList.remove('lrc-panel-in');
        el.lrcPanel.classList.add('lrc-panel-out');
        setTimeout(() => {
            if (el.lrcPanel.classList.contains('lrc-panel-out')) {
                el.lrcPanel.style.display = 'none';
                el.btnToggleLrc.classList.remove('active');
                el.lrcPanel.classList.remove('lrc-panel-out');
            }
        }, 280);
    }
});

bindBtn('btnToggleList', () => {
    safeTransition(() => {
        _pushModal('playlistModal', null);
        el.playlistModal.classList.add('open');
        currentViewMode = 'list';
        renderPlaylist();
        initPlaylistTabBar(); // 🩹 v3.2.3: 初始化 tab-bar
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
    });
});

bindBtn('btnSettings', () => {
    safeTransition(() => {
        _pushModal('settingsModal', null);
        el.settingsModal.classList.add('open');
        renderThemePresets();
        renderEQPanel();
        initSettingsTabs(); // 🚀 v3.0.0: 初始化设置标签
        if (typeof updateCrossfadeEnergyLock === 'function') updateCrossfadeEnergyLock(); // 🚀 v3.6.x: 反映一键节能锁定态
        updateFocusContext();
    });
});

bindBtn('btnCoverLibrary', () => safeTransition(showCoverLibrary));
bindBtn('btnShowStats', () => safeTransition(showStatsPanel));
bindBtn('btnFavQuick', () => { if (currentIndex >= 0) toggleFavorite(currentIndex); });
bindBtn('btnPipQuick', togglePip);
bindBtn('btnOpenHelpShortcuts', () => {
    closeAllModals();
    el.helpModal.classList.add('open');
    if (typeof _pushModal === 'function') _pushModal('helpModal', null);
    updateFocusContext();
});

// 绑定关闭按钮
document.getElementById('btnCloseList').onclick = closeAllModals;
document.getElementById('btnCloseFileInfo').onclick = closeAllModals;
document.getElementById('btnCloseHelp').onclick = closeAllModals;
document.getElementById('btnCloseSettings').onclick = closeAllModals;
document.querySelectorAll('.modal-overlay').forEach(m => m.onclick = (e) => { if(e.target === m) closeAllModals(); });

document.getElementById('btnShowAll').onclick = () => {
    currentViewMode = 'list';
    document.getElementById('playlistModalTitle').textContent = '播放列表';
    
    // 🚀 核心改动：如果当前队列少于媒体库（如处于专辑播放中），点击全部一键恢复全库播放
    if (playlist.length < musicLibrary.length) {
        // 1. 记住当前正在播放的歌曲的唯一标识 (用文件名)
        const currentPlayingSong = playlist[currentIndex];
        const currentFileName = currentPlayingSong ? currentPlayingSong.file.name : null;
        
        // 2. 恢复全库
        playlist = [...musicLibrary];
        
        // 3. 🚀 核心修复：在新列表里重新寻找这首歌的 Index
        if (currentFileName) {
            const newIndex = playlist.findIndex(s => s.file.name === currentFileName);
            if (newIndex !== -1) {
                currentIndex = newIndex; // 纠正 Index，状态完美对齐！
            }
        }
        
        renderPlaylist();
        showToast("已恢复播放全部歌曲", iconSvg('music'));
    } else {
        renderPlaylist();
    }
};

document.getElementById('btnShowFavorites').onclick = () => {
    currentViewMode = 'list';
    document.getElementById('playlistModalTitle').innerHTML = iconSvg('heart') + ' 收藏';
    el.plContainer.innerHTML = '';
    el.coverWallContainer.style.display = 'none';
    el.plContainer.style.display = 'flex';
    playlist.forEach((s, i) => {
        if (!favorites.has(s.file.name)) return;
        const div = document.createElement('div');
        div.className = `pl-item focusable ${i === currentIndex ? 'active' : ''}`;
        div.dataset.index = i;
        div.innerHTML = `<span class="pl-title">${escapeHTML(s.title)}</span><span style="font-size:12px;opacity:0.6;">${escapeHTML(s.artist)}</span><span class="favorite-btn faved" data-idx="${i}">${iconSvg('heart-filled')}</span>`;
        div.onclick = (e) => {
            if (e.target.classList.contains('favorite-btn')) { e.stopPropagation(); toggleFavorite(i); return; }
            playAudio(i); closeAllModals();
        };
        el.plContainer.appendChild(div);
    });
    if (!el.plContainer.children.length) el.plContainer.innerHTML = '<div style="color:var(--text-sub); text-align:center; padding:20px;">还没有收藏任何歌曲</div>';
};

// 🩹 v3.2.3: 初始化播放列表 tab-bar 点击切换（与 gamepad.js 中的 switchPlaylistTab 配合）
function initPlaylistTabBar() {
    const bar = document.querySelector('#playlistModal .playlist-tab-bar');
    if (!bar || bar.dataset.inited) return;
    bar.dataset.inited = 'true';
    bar.querySelectorAll('.playlist-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const filter = tab.dataset.filter;
            bar.querySelectorAll('.playlist-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (filter === 'all') document.getElementById('btnShowAll')?.click();
            else if (filter === 'favorites') document.getElementById('btnShowFavorites')?.click();
        });
    });
}
// 在 btnShowAll 和 btnShowFavorites 的 onclick 中也会自动调用渲染，所以只需绑定一次点击事件

document.getElementById('btnEnterImmersive').onclick = toggleImmersiveMode;
document.getElementById('btnExitImmersive').onclick = toggleImmersiveMode;

el.viewImm.addEventListener('dblclick', (e) => {
    if (e.target === el.viewImm || e.target.closest('.imm-wrapper') && !e.target.closest('.imm-bottom') && !e.target.closest('.imm-topbar') && !e.target.closest('.imm-icon-btn')) {
        toggleImmersiveMode();
    }
});

let immSwipeY = 0;
el.viewImm.addEventListener('touchstart', (e) => {
    immSwipeY = e.touches[0].clientY;
}, { passive: true });
el.viewImm.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - immSwipeY;
    if (dy > 100 && Math.abs(dy) > Math.abs(e.changedTouches[0].clientX - immSwipeY)) {
        toggleImmersiveMode();
    }
});
el.immExitHint.onclick = toggleImmersiveMode;

function updateModeUI() {
    let icon, label;
    if (isRepeatOne) {
        icon = iconSvg('repeat'); label = '单曲循环';
    } else if (isShuffle) {
        icon = iconSvg('shuffle'); label = '随机';
    } else {
        icon = '⇄'; label = '顺序';
    }
    el.btnMode.innerHTML = `${icon} ${label}`;
    el.immBtnMode.innerHTML = `${icon} ${label}`;
    el.btnMode.classList.toggle('active', isShuffle || isRepeatOne);
    el.immBtnMode.classList.toggle('active', isShuffle || isRepeatOne);
}

// 🚀 v3.5.4: 应用 OPPO Sans 字体（覆盖 --font-body 变量）
function applyOppoSans() {
    const root = document.documentElement;
    if (cfg.useOppoSans) {
        const fam = cfg.oppoSansWeight === 'M' ? "'OPPO Sans 3.0 M'" : "'OPPO Sans 3.0 R'";
        if (cfg.oppoKeepEnglish) {
            // OPPO Sans 仅作为中文字体回退，英文字体保留 Geist/CDN
            root.style.setProperty('--font-body', "'Geist', " + fam + ", -apple-system, 'Segoe UI', Roboto, sans-serif");
        } else {
            root.style.setProperty('--font-body', fam + ", -apple-system, 'Segoe UI', Roboto, sans-serif");
        }
    } else {
        root.style.removeProperty('--font-body');
    }
}

function updateSettingsUI() {
    const btn = document.getElementById('btnToggleColorMode');
    if (btn) {
        btn.innerHTML = cfg.followAccentColor ? iconSvg('palette') + ' 关闭取色模式 (Y / C)' : iconSvg('palette') + ' 开启取色模式 (Y / C)';
        btn.style.color = cfg.followAccentColor ? 'var(--primary)' : '';
        btn.style.borderColor = cfg.followAccentColor ? 'var(--primary)' : '';
    }
    // 🚀 v2.8: 更新取色模式状态标签与预览条
    const label = document.getElementById('colorModeLabel');
    if (label) label.innerHTML = cfg.followAccentColor ? iconSvg('check') + ' 取色模式已激活 · 专辑封面驱动全域色彩' : iconSvg('square') + ' 取色模式未激活 · 使用预设主题色';
    const preview = document.getElementById('colorModePreview');
    if (preview) {
        preview.style.display = cfg.followAccentColor ? 'block' : 'none';
        if (cfg.followAccentColor && currentAlbumColor) preview.style.background = `linear-gradient(90deg, ${currentAlbumColor}, ${cfg.defaultColor})`;
    }
    // 🚀 v3.5.4: 同步外观新增开关（封面取色 / 背景沉浸）
    const faToggle = document.getElementById('followAccentToggle');
    if (faToggle) faToggle.checked = cfg.followAccentColor;
    const biToggle = document.getElementById('bgImmersiveToggle');
    if (biToggle) biToggle.checked = cfg.bgImmersive;
    // 🚀 v3.5.4: 同步标题栏伪沉浸开关
    const wpiToggle = document.getElementById('wcoPseudoImmersiveToggle');
    if (wpiToggle) wpiToggle.checked = cfg.wcoPseudoImmersive;
    // 🚀 v3.5.4: 同步 OPPO Sans 开关与字重
    const osToggle = document.getElementById('useOppoSansToggle');
    if (osToggle) osToggle.checked = cfg.useOppoSans;
    const osWeightBox = document.getElementById('oppoSansWeightBox');
    if (osWeightBox) osWeightBox.style.display = cfg.useOppoSans ? 'block' : 'none';
    document.querySelectorAll('.oppoSansWeightBtn').forEach(b => {
        b.classList.toggle('active', b.dataset.weight === cfg.oppoSansWeight);
    });
    // 🚀 v3.5.4: 同步保留英文字体开关
    const keToggle = document.getElementById('oppoKeepEnglishToggle');
    if (keToggle) keToggle.checked = cfg.oppoKeepEnglish;
    const keBox = document.getElementById('oppoKeepEnglishBox');
    if (keBox) keBox.style.display = cfg.useOppoSans ? 'block' : 'none';
    applyOppoSans();
}

const cyclePlayMode = () => {
    if (!isShuffle && !isRepeatOne) {
        isShuffle = true; isRepeatOne = false;
    } else if (isShuffle && !isRepeatOne) {
        isShuffle = false; isRepeatOne = true;
    } else {
        isShuffle = false; isRepeatOne = false;
    }
    updateModeUI();
    saveSettings();
    const label = isRepeatOne ? '单曲循环' : (isShuffle ? '随机播放' : '顺序播放');
    showToast(`${label}`, isRepeatOne ? iconSvg('repeat') : (isShuffle ? iconSvg('shuffle') : '⇄'));
};
el.btnMode.onclick = el.immBtnMode.onclick = cyclePlayMode;

function toggleColorMode() {
    cfg.followAccentColor = !cfg.followAccentColor;
    updateSettingsUI();
    applyThemeLogic();
    saveSettings();
    showToast(cfg.followAccentColor ? "已开启封面取色" : "已关闭封面取色", iconSvg('palette'));
};
// 🚀 v3.5.4: btnToggleColorMode 已并入「沉浸式外观」的封面取色开关，此处做空安全守卫
const btnToggleColorMode = document.getElementById('btnToggleColorMode');
if (btnToggleColorMode) btnToggleColorMode.onclick = toggleColorMode;
document.getElementById('btnToggleDarkMode')?.remove(); // 🚀 v3.5.x: 已替换为 toggle-switch
const darkModeToggle = document.getElementById('darkModeToggleSwitch');
if (darkModeToggle) {
    darkModeToggle.checked = cfg.darkMode;
    darkModeToggle.addEventListener('change', function() {
        toggleDarkMode(this.checked);
    });
}

// 🚀 v3.5.4: 设置-外观「封面取色」开关（与取色模式同源，统一驱动 --primary 随专辑封面；复用 followAccentToggle）
const followAccentToggle = document.getElementById('followAccentToggle');
if (followAccentToggle) followAccentToggle.addEventListener('change', () => {
    cfg.followAccentColor = followAccentToggle.checked;
    updateSettingsUI();
    applyThemeLogic();
    saveSettings();
    showToast(cfg.followAccentColor ? "已开启封面取色" : "已关闭封面取色", iconSvg('palette'));
});

// 🚀 v3.5.0: 设置-外观「背景沉浸」开关（专辑封面/自定义背景全屏沉浸 + 夜间半透明黑遮罩叠加）
const bgImmersiveToggle = document.getElementById('bgImmersiveToggle');
if (bgImmersiveToggle) bgImmersiveToggle.addEventListener('change', () => {
    cfg.bgImmersive = bgImmersiveToggle.checked;
    updateSettingsUI();
    applyBgImmersive();
    saveSettings();
    showToast(cfg.bgImmersive ? "已开启背景沉浸" : "已关闭背景沉浸", iconSvg('images'));
});

// 🚀 v3.5.4: PWA 检测 — 仅 standalone 模式显示标题栏伪沉浸开关
(function() {
    const box = document.getElementById('wcoPseudoImmersiveBox');
    if (!box) return;
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        box.style.display = 'flex'; // 恢复 flex 布局
    } else {
        box.style.display = 'none';
    }
})();

// 🚀 v3.5.4: 设置-外观「标题栏伪沉浸」开关（PWA 标题栏 theme-color 取封面/背景顶部颜色融合）
const wcoPseudoImmersiveToggle = document.getElementById('wcoPseudoImmersiveToggle');
if (wcoPseudoImmersiveToggle) wcoPseudoImmersiveToggle.addEventListener('change', () => {
    cfg.wcoPseudoImmersive = wcoPseudoImmersiveToggle.checked;
    updateSettingsUI();
    if (typeof ThemeColor !== 'undefined') ThemeColor.refresh();
    saveSettings();
    showToast(cfg.wcoPseudoImmersive ? "已开启标题栏伪沉浸" : "已关闭标题栏伪沉浸", iconSvg('layers'));
});

// 🚀 v3.5.4: 设置-外观「启用 OPPO Sans」开关
const useOppoSansToggle = document.getElementById('useOppoSansToggle');
if (useOppoSansToggle) useOppoSansToggle.addEventListener('change', () => {
    cfg.useOppoSans = useOppoSansToggle.checked;
    updateSettingsUI();
    applyOppoSans();
    saveSettings();
    showToast(cfg.useOppoSans ? "已启用 OPPO Sans" : "已恢复默认字体", iconSvg('type'));
});

// 🚀 v3.5.4: OPPO Sans 字重 R/M 切换
document.querySelectorAll('.oppoSansWeightBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        cfg.oppoSansWeight = btn.dataset.weight;
        updateSettingsUI();
        applyOppoSans();
        saveSettings();
        showToast("OPPO Sans 字重：" + (cfg.oppoSansWeight === 'M' ? 'Medium' : 'Regular'), iconSvg('type'));
    });
});

// 🚀 v3.5.4: 设置-外观「保留英文字体」开关（OPPO Sans 仅替换中文字体，保留 Geist/CDN 英文字体）
const oppoKeepEnglishToggle = document.getElementById('oppoKeepEnglishToggle');
if (oppoKeepEnglishToggle) oppoKeepEnglishToggle.addEventListener('change', () => {
    cfg.oppoKeepEnglish = oppoKeepEnglishToggle.checked;
    updateSettingsUI();
    applyOppoSans();
    saveSettings();
    showToast(cfg.oppoKeepEnglish ? "OPPO Sans 仅替换中文" : "OPPO Sans 替换全部字体", iconSvg('type'));
});

document.getElementById('blurSlider').oninput = function() {
    cfg.blurAmt = this.value;
    document.getElementById('blurVal').textContent = `${this.value}px`;
    const bv = document.getElementById('blurSliderVal');
    if (bv) bv.textContent = `${this.value}px`;
    applyThemeLogic(); saveSettings();
};

document.getElementById('lrcFontSizeSlider').oninput = function() {
    cfg.lrcFontSize = parseInt(this.value);
    document.getElementById('lrcFontSizeVal').textContent = `${this.value}px`;
    const fv = document.getElementById('lrcFontSizeSliderVal');
    if (fv) fv.textContent = `${this.value}px`;
    applyLrcSettings(); saveSettings();
};
document.getElementById('lrcLineHeightSlider').oninput = function() {
    cfg.lrcLineHeight = parseFloat(this.value);
    document.getElementById('lrcLineHeightVal').textContent = this.value;
    const lhv = document.getElementById('lrcLineHeightSliderVal');
    if (lhv) lhv.textContent = this.value;
    applyLrcSettings(); saveSettings();
};
document.querySelectorAll('.lrc-align-btn').forEach(btn => {
    btn.onclick = () => {
        cfg.lrcAlign = btn.dataset.align;
        applyLrcSettings(); saveSettings();
    };
});

// 🚀 v2.8.5: 歌词垂直对齐模式按钮
const btnLrcAlignCenter = document.getElementById('btnLrcAlignCenter');
const btnLrcAlignTop = document.getElementById('btnLrcAlignTop');
if (btnLrcAlignCenter) btnLrcAlignCenter.onclick = () => {
    lyricsAlignMode = 'center';
    updateLrcAlignUI();
    saveSettings();
    syncLyrics(true);
    showToast('歌词垂直居中');
};
if (btnLrcAlignTop) btnLrcAlignTop.onclick = () => {
    lyricsAlignMode = 'top';
    updateLrcAlignUI();
    saveSettings();
    syncLyrics(true);
    showToast('歌词偏上显示');
};

// === 🚀 v2.5: 预设主题色统一渲染与多场景同步引擎 ===
function renderThemePresets() {
    const grid = document.getElementById('themePresetGrid');
    if (!grid) return;
    grid.innerHTML = '';

    themePresets.forEach((t) => {
        const card = document.createElement('div');
        // 将外层卡片声明为 focusable，实现 2D 空间完美寻路
        card.className = `theme-preset-card focusable${cfg.themePreset === t.color ? ' active' : ''}`;
        card.tabIndex = 0;
        card.innerHTML = `
            <div class="theme-color-circle" style="background: linear-gradient(135deg, ${t.color}, rgba(0,0,0,0.4))"></div>
            <div class="theme-preset-label">${t.name}</div>
        `;
        card.onclick = () => {
            applyThemeColorAction(t.color, t.name);
        };
        grid.appendChild(card);
    });
    updateFocusContext();
}

// 核心行动：多场景一键联动同步
function applyThemeColorAction(color, name) {
    cfg.themePreset = color;
    cfg.defaultColor = color;
    document.documentElement.style.setProperty('--primary', color);

    // 🚀 v3.0.1b: 同步设置 RGB 分量 + 发光色
    const rgb = hexToRgb(color);
    if (rgb) {
        document.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        document.documentElement.style.setProperty('--primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
        document.documentElement.style.setProperty('--album-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
    }

    applyThemeLogic();
    saveSettings();
    renderThemePresets();

    // 2. 多场景 A：画中画悬浮窗颜色实时无缝同步
    if (pipWindow && !pipWindow.closed) {
        try {
            pipWindow.document.documentElement.style.setProperty('--primary', color);
            const pipFill = pipWindow.document.getElementById('pipProgFill');
            if (pipFill) pipFill.style.boxShadow = `0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
        } catch (e) { }
    }

    if (name) showToast(`主题已应用: ${name}`, iconSvg('palette'));
}

// 辅助函数：16进制转RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// 🚀 v2.5-p2: 标准 WCAG 相对亮度计算（sRGB 线性化 + 正确权重）
function getLuminance(colorStr) {
    if (!colorStr) return 1; // 视为白色（亮度 1）
    let r = 1, g = 1, b = 1;

    if (colorStr.startsWith('#')) {
        const rgb = hexToRgb(colorStr);
        if (rgb) { r = rgb.r / 255; g = rgb.g / 255; b = rgb.b / 255; }
    } else if (colorStr.startsWith('rgb')) {
        const match = colorStr.match(/\d+/g);
        if (match) {
            r = parseInt(match[0]) / 255;
            g = parseInt(match[1]) / 255;
            b = parseInt(match[2]) / 255;
        }
    }
    // sRGB → 线性光
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const R = lin(r), G = lin(g), B = lin(b);
    // WCAG 相对亮度（0..1）
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// 均衡器UI渲染
function renderEQPanel() {
    const eqContainer = document.getElementById('eqPanelContainer');
    if (!eqContainer) return;
    eqContainer.innerHTML = '';

    // 预设下拉菜单（替代原按钮阵列，风格与触觉-映射模式一致）
    const EQ_PRESET_LABELS = {
        flat: '平直 (Flat)', pop: '流行 (Pop)', rock: '摇滚 (Rock)', classical: '古典 (Classical)',
        vocal: '人声 (Vocal)', bass: '重低音 (Bass)', electronic: '电子 (Electronic)', jazz: '爵士 (Jazz)'
    };
    const EQ_PRESETS = ['flat','pop','rock','classical','vocal','bass','electronic','jazz'];
    const activePreset = (typeof matchEQPreset === 'function') ? matchEQPreset(eqGains) : 'flat';
    const presetWrap = document.createElement('div');
    presetWrap.className = 'eq-preset-row settings-row';
    presetWrap.innerHTML = `
        <span>预设</span>
        <div class="custom-select-wrap" id="eqPresetWrap">
            <select id="eqPresetSelect" aria-hidden="true" style="display:none;">
                ${EQ_PRESETS.map(p => `<option value="${p}">${EQ_PRESET_LABELS[p]}</option>`).join('')}
            </select>
            <button class="custom-select-trigger focusable" tabindex="0" data-select-id="eqPresetSelect">
                <span class="custom-select-value">${EQ_PRESET_LABELS[activePreset] || '自定义 (手动调节)'}</span>
                <svg class="custom-select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="custom-select-dropdown" data-select-id="eqPresetSelect">
                ${EQ_PRESETS.map(p => `<button class="custom-select-option" data-value="${p}">${EQ_PRESET_LABELS[p]}</button>`).join('')}
            </div>
        </div>
    `;
    eqContainer.appendChild(presetWrap);

    const eqPresetSelect = document.getElementById('eqPresetSelect');
    eqPresetSelect.value = EQ_PRESET_LABELS[activePreset] ? activePreset : '';
    eqPresetSelect.addEventListener('change', (e) => {
        if (e.target.value) setEQPreset(e.target.value);
    });
    // 动态生成的下拉需单独绑定事件并同步显示
    const eqPresetWrap = document.getElementById('eqPresetWrap');
    initCustomDropdownFor(eqPresetWrap);
    eqPresetWrap.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.value === activePreset));

    const panel = document.createElement('div');
    panel.className = 'eq-panel';

    const labels = ['32Hz','64Hz','125Hz','250Hz','500Hz','1kHz','2kHz','4kHz','8kHz','16kHz'];
    for (let i = 0; i < 10; i++) {
        const band = document.createElement('div');
        band.className = 'eq-band';
        band.innerHTML = `
            <label>${labels[i]}</label>
            <input type="range" id="eq-band-${i}" min="-12" max="12" step="0.5" value="${eqGains[i]}" class="focusable">
            <span class="eq-val" id="eq-val-${i}">${eqGains[i] > 0 ? '+' : ''}${eqGains[i]}dB</span>
        `;
        panel.appendChild(band);
    }
    eqContainer.appendChild(panel);

    // 绑定滑块事件
    for (let i = 0; i < 10; i++) {
        document.getElementById(`eq-band-${i}`).oninput = function() {
            const val = parseFloat(this.value);
            document.getElementById(`eq-val-${i}`).textContent = `${val > 0 ? '+' : ''}${val}dB`;
            setEQBand(i, val);
            // 🚀 v3.4.x: 手动调节滑块后，预设下拉标记为"自定义"
            const wrap = document.getElementById('eqPresetWrap');
            if (wrap) {
                const v = wrap.querySelector('.custom-select-value');
                if (v) v.textContent = '自定义 (手动调节)';
                wrap.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            }
        };
    }

    // 🩹 v3.2.3: 播放速度/音调/Crossfade 已在 HTML 中定义独立 drawer-box，此处仅绑定事件
    // 速度/音调
    const _speedSlider = document.getElementById('speedSlider');
    if (_speedSlider) {
        _speedSlider.value = playbackRate;
        _speedSlider.oninput = function() { setPlaybackRate(parseFloat(this.value)); };
    }
    // 🚀 v3.5.x: btnTogglePitch 替换为 pitchToggleSwitch
    const _pitchToggle = document.getElementById('pitchToggleSwitch');
    if (_pitchToggle) {
        _pitchToggle.checked = preservesPitch;
        _pitchToggle.addEventListener('change', function() {
            togglePitchPreserve(this.checked);
        });
    }

    // Crossfade
    const _cfToggle = document.getElementById('crossfadeToggleSwitch');
    const _cfSlider = document.getElementById('crossfadeSlider');
    if (_cfToggle) {
        _cfToggle.checked = crossfadeEnabled;
        _cfToggle.addEventListener('change', function() {
            crossfadeEnabled = this.checked;
            if (crossfadeEnabled) {
                cfSetupScanner();   // 🔥 v2.8.9 修复：开启时立即重启扫描器，无需手动切歌一次才生效
                cfPreloadNext();
            } else if (cfRafId) {
                cancelAnimationFrame(cfRafId);
                cfRafId = null;
            }
            saveSettings();
            showToast(crossfadeEnabled ? '淡入淡出已开启（实验性功能）' : '淡入淡出已关闭', iconSvg('alert'));
        });
    }
    if (_cfSlider) {
        _cfSlider.value = crossfadeDuration;
        document.getElementById('crossfadeVal').textContent = crossfadeDuration.toFixed(1) + 's';
        _cfSlider.oninput = function() {
            crossfadeDuration = parseFloat(this.value);
            document.getElementById('crossfadeVal').textContent = crossfadeDuration.toFixed(1) + 's';
            saveSettings();
        };
    }

    // 🔥 v3.6.0: 曲线选择按钮
    document.querySelectorAll('.cf-curve-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.curve === crossfadeCurve);
        btn.onclick = function() {
            document.querySelectorAll('.cf-curve-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            crossfadeCurve = this.dataset.curve;
            saveSettings();
            showToast(`淡变曲线: ${this.textContent}`, iconSvg('refresh'));
        };
    });

    // 🔥 v3.6.0: 响度归一化开关
    const _normToggle = document.getElementById('crossfadeNormalizeToggle');
    if (_normToggle) {
        _normToggle.checked = crossfadeNormalize;
        _normToggle.onchange = function() {
            crossfadeNormalize = this.checked;
            saveSettings();
            showToast(crossfadeNormalize ? '响度归一化已开启' : '响度归一化已关闭', iconSvg('refresh'));
        };
    }

    // 🚀 v3.6.x: 一键节能开启时锁定交叉淡变控件 + 显示提示（不丢用户设置，退出节能后恢复）
    //   在开关动作 (app.js) 与设置面板打开时都调用，确保锁定态即时反映。
    window.updateCrossfadeEnergyLock = function () {
        const locked = oneClickEnergySaving === true;
        const box = document.getElementById('crossfadeBox');
        const toggle = document.getElementById('crossfadeToggleSwitch');
        const slider = document.getElementById('crossfadeSlider');
        const norm = document.getElementById('crossfadeNormalizeToggle');
        const hint = document.getElementById('crossfadeEnergyHint');
        if (box) box.classList.toggle('cf-locked', locked);
        if (toggle) { toggle.disabled = locked; toggle.checked = crossfadeEnabled; }
        if (slider) slider.disabled = locked;
        if (norm) norm.disabled = locked;
        document.querySelectorAll('.cf-curve-btn').forEach(b => b.disabled = locked);
        if (hint) hint.style.display = locked ? 'flex' : 'none';
    };

    // 🚀 v2.8.2: 性能模式UI已整合到节能板块，此处不再单独显示
    // (保留兼容映射：旧版 performanceMode 已映射到 cfg.frameEnergyEnabled)
}

document.getElementById('btnSetBg').onclick = () => document.getElementById('bgInput').click();
document.getElementById('bgInput').onchange = (e) => {
    const f = e.target.files[0];
    if(f) {
        const r = new FileReader();
        r.onload = async (ev) => {
            cfg.customBgImg = ev.target.result;
            cfg.customBgColor = await extractColor(cfg.customBgImg);
            // 🚀 v3.4.2: 自定义背景同步采样顶部颜色，用于 WCO 假沉浸
            cfg.customBgTopColor = await extractTopColor(cfg.customBgImg, 0.2);
            applyThemeLogic(); saveSettings();
            showToast("自定义背景应用成功", iconSvg('images'));
        };
        r.readAsDataURL(f);
    }
};
document.getElementById('btnClearBg').onclick = () => {
    cfg.customBgImg = null; cfg.customBgColor = null; cfg.customBgTopColor = null;
    applyThemeLogic(); saveSettings();
    showToast("已恢复默认", iconSvg('trash'));
};

// === 统计面板 ===
function showStatsPanel() {
    closeAllModals();
    _pushModal('statsPanel', null);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
        <div class="modal-content" style="width:550px;max-height:85vh;">
            <div class="modal-header">
                <h2 style="font-size:20px;">${iconSvg('bar-chart')} 音乐统计</h2>
                <button class="btn-glass focusable" id="btnCloseStats" tabindex="0" style="padding:6px 12px;">关闭</button>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${playlist.length}</div>
                    <div class="stat-label">曲库总数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${favorites.size}</div>
                    <div class="stat-label">收藏歌曲</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formatTime(getTotalListenTime())}</div>
                    <div class="stat-label">总听歌时长</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(playStats).length}</div>
                    <div class="stat-label">播放过歌曲</div>
                </div>
            </div>
            <div class="drawer-title" style="margin-top:16px;">🏆 最爱Top10</div>
            <div class="stat-top-list" id="statTopList"></div>
        </div>
    `;
    document.body.appendChild(modal);

    const topList = getTopSongs(10);
    const listEl = modal.querySelector('#statTopList');
    topList.forEach((s, i) => {
        const item = document.createElement('div');
        item.className = 'stat-top-item';
        item.innerHTML = `
            <span class="rank">${i + 1}</span>
            <span class="song-name">${escapeHTML(s.title)} - ${escapeHTML(s.artist)}</span>
            <span class="play-count">${s.count}次</span>
        `;
        listEl.appendChild(item);
    });

    modal.querySelector('#btnCloseStats').onclick = () => { modal.remove(); modal = null; };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); modal = null; } };
}

// ===== 音频输出设备选择 (v2.8.13) =====

const initAudioOutputDeviceSelector = () => {
    const audioEl = document.querySelector('audio');
    if (!audioEl || typeof audioEl.setSinkId !== 'function') {
        const box = document.getElementById('audioOutputBox');
        if (box) box.style.display = 'none';
        return;
    }
    const box = document.getElementById('audioOutputBox');
    if (box) box.style.display = '';
    enumerateAudioOutputDevices();
};

const enumerateAudioOutputDevices = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const select = document.getElementById('audioOutputSelect');
        if (!select) return;
        // 保留默认选项，清除后续动态项
        while (select.options.length > 1) select.remove(1);
        for (const d of devices) {
            if (d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications') {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `音频设备 ${d.deviceId.slice(0, 8)}`;
                select.appendChild(opt);
            }
        }
    } catch (_) { /* enumerateDevices 需要权限，静默失败 */ }
};

const handleAudioOutputDeviceChange = (deviceId) => {
    const audioEl = document.querySelector('audio');
    if (!audioEl || typeof audioEl.setSinkId !== 'function') return;
    audioEl.setSinkId(deviceId || '').catch(err => {
        console.warn('[AudioOutput] setSinkId failed:', err);
    });
};

// 音频输出设备选择器事件绑定
{
    const select = document.getElementById('audioOutputSelect');
    if (select) {
        select.addEventListener('change', () => handleAudioOutputDeviceChange(select.value));
    }
    const refreshBtn = document.getElementById('btnRefreshAudioDevices');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', enumerateAudioOutputDevices);
    }
}

// 🚀 v3.0.0: 震动配置事件绑定
{
    const rumbleToggle = document.getElementById('rumbleToggle');
    if (rumbleToggle) {
        rumbleToggle.checked = cfg.rumbleEnabled;
        // 初始同步指示器可见性
        const sriInit = document.getElementById('settingsRumbleIndicator');
        if (sriInit) sriInit.style.display = cfg.rumbleEnabled ? 'block' : 'none';
        rumbleToggle.addEventListener('change', (e) => {
            cfg.rumbleEnabled = e.target.checked;
            const sri = document.getElementById('settingsRumbleIndicator');
            if (sri) sri.style.display = cfg.rumbleEnabled ? 'block' : 'none';
            saveSettings();
        });
    }
    // 🚀 v3.0.2: 初始化自定义下拉菜单
    initCustomDropdowns();

    const rumbleModeSelect = document.getElementById('rumbleModeSelect');
    if (rumbleModeSelect) {
        rumbleModeSelect.value = cfg.rumbleMode;
        rumbleModeSelect.addEventListener('change', (e) => {
            cfg.rumbleMode = e.target.value;
            saveSettings();
        });
    }
    const rumbleFloorSlider = document.getElementById('rumbleFloorSlider');
    if (rumbleFloorSlider) {
        rumbleFloorSlider.value = cfg.rumbleFloor;
        document.getElementById('rumbleFloorVal').textContent = cfg.rumbleFloor.toFixed(2);
        rumbleFloorSlider.addEventListener('input', (e) => {
            cfg.rumbleFloor = parseFloat(e.target.value);
            document.getElementById('rumbleFloorVal').textContent = cfg.rumbleFloor.toFixed(2);
            saveSettings();
        });
    }
    const rumbleAutoFloorToggle = document.getElementById('rumbleAutoFloorToggle');
    if (rumbleAutoFloorToggle) {
        rumbleAutoFloorToggle.checked = cfg.rumbleAutoFloor;
        rumbleAutoFloorToggle.addEventListener('change', (e) => {
            cfg.rumbleAutoFloor = e.target.checked;
            saveSettings();
        });
    }
    const rumbleThrottleSelect = document.getElementById('rumbleThrottleSelect');
    if (rumbleThrottleSelect) {
        rumbleThrottleSelect.value = String(cfg.rumbleThrottle);
        rumbleThrottleSelect.addEventListener('change', (e) => {
            cfg.rumbleThrottle = parseInt(e.target.value);
            saveSettings();
        });
    }
    const rumbleStrongGainSlider = document.getElementById('rumbleStrongGainSlider');
    if (rumbleStrongGainSlider) {
        rumbleStrongGainSlider.value = cfg.rumbleStrongGain;
        document.getElementById('rumbleStrongGainVal').textContent = Math.round(cfg.rumbleStrongGain * 100) + '%';
        rumbleStrongGainSlider.addEventListener('input', (e) => {
            cfg.rumbleStrongGain = parseFloat(e.target.value);
            document.getElementById('rumbleStrongGainVal').textContent = Math.round(cfg.rumbleStrongGain * 100) + '%';
            saveSettings();
        });
    }
    const rumbleWeakGainSlider = document.getElementById('rumbleWeakGainSlider');
    if (rumbleWeakGainSlider) {
        rumbleWeakGainSlider.value = cfg.rumbleWeakGain;
        document.getElementById('rumbleWeakGainVal').textContent = Math.round(cfg.rumbleWeakGain * 100) + '%';
        rumbleWeakGainSlider.addEventListener('input', (e) => {
            cfg.rumbleWeakGain = parseFloat(e.target.value);
            document.getElementById('rumbleWeakGainVal').textContent = Math.round(cfg.rumbleWeakGain * 100) + '%';
            saveSettings();
        });
    }
    const rumbleSwapMotorsToggle = document.getElementById('rumbleSwapMotorsToggle');
    if (rumbleSwapMotorsToggle) {
        rumbleSwapMotorsToggle.checked = cfg.rumbleSwapMotors;
        rumbleSwapMotorsToggle.addEventListener('change', (e) => {
            cfg.rumbleSwapMotors = e.target.checked;
            saveSettings();
        });
    }
    const rumbleGainSlider = document.getElementById('rumbleGainSlider');
    if (rumbleGainSlider) {
        rumbleGainSlider.value = cfg.rumbleGain;
        document.getElementById('rumbleGainVal').textContent = Math.round(cfg.rumbleGain * 100) + '%';
        rumbleGainSlider.addEventListener('input', (e) => {
            cfg.rumbleGain = parseFloat(e.target.value);
            document.getElementById('rumbleGainVal').textContent = Math.round(cfg.rumbleGain * 100) + '%';
            saveSettings();
        });
    }
    // 🚀 v3.0.0: 震动测试按钮
    const btnTestRumble = document.getElementById('btnTestRumble');
    if (btnTestRumble) {
        btnTestRumble.addEventListener('click', () => {
            const gamepads = navigator.getGamepads();
            for (let i = 0; i < gamepads.length; i++) {
                const gp = gamepads[i];
                if (gp && gp.vibrationActuator) {
                    gp.vibrationActuator.playEffect('dual-rumble', {
                        startDelay: 0, duration: 500,
                        weakMagnitude: 0.5, strongMagnitude: 0.8
                    });
                    showToast('震动测试 (500ms)', iconSvg('zap'));
                    return;
                }
            }
            showToast('未检测到支持震动的手柄', iconSvg('alert'));
        });
    }
}

// 🚀 v3.0.2: 自定义下拉菜单初始化（替代 native select，手柄友好）
// 🚀 v3.4.x: 抽离单实例绑定 / 显示同步，供静态（触觉）与动态（EQ 预设）下拉复用
function initCustomDropdownFor(wrap) {
    if (!wrap || wrap.dataset.inited) return;
    wrap.dataset.inited = 'true';
    const trigger = wrap.querySelector('.custom-select-trigger');
    if (trigger) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrap.classList.contains('open');
            // 关闭其它已展开的下拉
            document.querySelectorAll('.custom-select-wrap.open').forEach(w => {
                if (w === wrap) return;
                w.classList.remove('open');
                w.querySelectorAll('.custom-select-option').forEach(o => o.setAttribute('tabindex', '-1'));
            });
            if (!isOpen) {
                wrap.classList.add('open');
                // 展开后选项可被手柄聚焦
                wrap.querySelectorAll('.custom-select-option').forEach(o => o.removeAttribute('tabindex'));
                setTimeout(() => updateFocusContext(), 50);
            } else {
                wrap.classList.remove('open');
                wrap.querySelectorAll('.custom-select-option').forEach(o => o.setAttribute('tabindex', '-1'));
            }
        });
    }
    wrap.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = opt.closest('.custom-select-dropdown');
            const select = document.getElementById(dropdown.dataset.selectId);
            if (!select) return;
            select.value = opt.dataset.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            wrap.querySelector('.custom-select-value').textContent = opt.textContent;
            wrap.classList.remove('open');
            dropdown.querySelectorAll('.custom-select-option').forEach(o => o.setAttribute('tabindex', '-1'));
            dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });
}

// 从隐藏 select 同步显示值到触发器与 selected 类
function syncCustomSelectDisplay(wrap) {
    if (!wrap) return;
    const select = wrap.querySelector('select');
    const valueEl = wrap.querySelector('.custom-select-value');
    const options = wrap.querySelectorAll('.custom-select-option');
    if (select && valueEl) {
        const matched = Array.from(select.options).find(o => o.value === select.value);
        if (matched) valueEl.textContent = matched.textContent;
        options.forEach(o => o.classList.toggle('selected', o.dataset.value === select.value));
    }
}

function initCustomDropdowns() {
    // 初始：所有选项设 tabindex=-1 避免手柄焦点泄漏到隐藏面板
    document.querySelectorAll('.custom-select-option').forEach(o => o.setAttribute('tabindex', '-1'));
    // 为每个 wrap 绑定展开/选项点击
    document.querySelectorAll('.custom-select-wrap').forEach(wrap => initCustomDropdownFor(wrap));
    // 点击外部关闭（仅绑定一次，避免重复）
    if (!window.__customSelectOutsideBound) {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-select-wrap')) {
                document.querySelectorAll('.custom-select-wrap.open').forEach(w => {
                    w.classList.remove('open');
                    w.querySelectorAll('.custom-select-option').forEach(o => o.setAttribute('tabindex', '-1'));
                });
            }
        });
        window.__customSelectOutsideBound = true;
    }
    // 初始同步显示值
    document.querySelectorAll('.custom-select-wrap').forEach(wrap => syncCustomSelectDisplay(wrap));
}

// 🚀 v3.0.1: 设置标签页切换 — 固定高度 + 切换动画（幂等，首次构建面板，后续仅激活）
let _tabsInited = false;

function initSettingsTabs() {
    const tabBar = document.querySelector('.settings-tab-bar');
    if (!tabBar) return;
    const tabs = tabBar.querySelectorAll('.settings-tab');
    if (!tabs.length) return;

    // 首次调用：构建面板、绑定事件
    if (!_tabsInited) {
        _tabsInited = true;

        const boxes = Array.from(document.querySelectorAll('#settingsModal .drawer-box'));
        const body = document.querySelector('.settings-body');
        if (!boxes.length || !body) return;

        // 🚀 v3.1.0: 标签组重新组织：音频-外观-触觉-性能-高级
        const tabKeywords = [
            ['载入音乐', '均衡器', '播放速度', '音调', 'Crossfade', '睡眠定时', '音频输出'],
            ['封面取色', '主题色', '背景图片', '显示调节', '歌词'],
            ['震动'],
            ['节能'],
            ['播放统计', '调试', '快捷键'],
        ];
        boxes.forEach(box => {
            if (box.dataset.tabGroup) return;
            const title = box.querySelector('.drawer-title');
            if (!title) { box.dataset.tabGroup = '4'; return; }
            const text = title.textContent || '';
            let assigned = false;
            tabKeywords.forEach((keywords, groupIdx) => {
                if (keywords.some(kw => text.includes(kw))) {
                    box.dataset.tabGroup = String(groupIdx);
                    assigned = true;
                }
            });
            if (!assigned) box.dataset.tabGroup = '4';
        });

        // 按标签组将 drawer-box 包装成面板
        const groups = {};
        boxes.forEach(box => {
            const g = box.dataset.tabGroup;
            if (!groups[g]) groups[g] = [];
            groups[g].push(box);
        });

        // 清空 body，重建为流式面板
        body.innerHTML = '';
        const panels = {};
        Object.keys(groups).sort((a, b) => a - b).forEach(g => {
            const panel = document.createElement('div');
            panel.className = 'settings-panel';
            panel.dataset.panelGroup = g;
            groups[g].forEach(box => panel.appendChild(box));
            body.appendChild(panel);
            panels[g] = panel;
        });

        // 锁定弹窗总高度：测量各面板取最大值 + 头尾固定区，body 内部独立滚动
        let maxH = 0;
        Object.values(panels).forEach(p => {
            p.style.display = 'block';
            p.style.animation = 'none';
            maxH = Math.max(maxH, p.scrollHeight);
            p.style.animation = '';
            p.style.display = '';
        });
        // 固定区：header(~52px) + tab-bar(~48px) + footer(~48px) + body padding(40px) = ~188px
        const modal = document.querySelector('.settings-modal-content');
        if (modal) {
            const totalH = maxH + 188;
            modal.style.height = Math.min(totalH, window.innerHeight * 0.85) + 'px';
        }

        // 切换逻辑（含进入动画）
        tabs.forEach((tab) => {
            tab.onclick = () => {
                const group = tab.dataset.tab;
                if (tab.classList.contains('active')) return;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                Object.keys(panels).forEach(g => {
                    panels[g].classList.toggle('active', g === group);
                });
                updateFocusContext();
            };
        });
    }

    // 每次打开都激活 Tab 0（重置 HTML 预置的 active，确保面板可见）
    tabs.forEach(t => t.classList.remove('active'));
    if (tabs[0]) tabs[0].click();
}

// 🚀 v3.0.0: 网络状态更新
function updateNetworkStatus() {
    const el = document.getElementById('networkStatus');
    if (!el) return;
    if (!navigator.onLine) {
        el.innerHTML = iconSvg('alert');
        el.className = 'network-status offline';
    } else {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
            el.innerHTML = iconSvg('zap');
            el.className = 'network-status slow';
        } else {
            el.innerHTML = iconSvg('zap');
            el.className = 'network-status online';
        }
    }
}

// ===== 诊断日志导出 =====

// 🔥 v3.6.1: 全面诊断快照导出（含播放器运行时状态、音频槽、淡变引擎、设置、错误日志）
const exportErrorLogs = () => {
    const logs = JSON.parse(localStorage.getItem('MBolka_ErrorLogs') || '[]');

    // 收集当前播放器状态
    const snapshot = {
        _exportedAt: new Date().toISOString(),
        _exportReason: 'manual',
        playback: {
            currentIndex,
            isPlaying,
            isShuffle,
            isRepeatOne,
            isImmersiveMode,
            playlistLength: playlist?.length ?? 0,
        },
        currentSong: (currentIndex >= 0 && playlist?.[currentIndex]) ? {
            title: playlist[currentIndex].title,
            artist: playlist[currentIndex].artist,
            fileSize: playlist[currentIndex].file?.size,
            hasArt: !!playlist[currentIndex].art,
        } : null,
        crossfade: {
            enabled: crossfadeEnabled,
            duration: crossfadeDuration,
            curve: crossfadeCurve,
            normalize: crossfadeNormalize,
            state: cfState === CfState.IDLE ? 'IDLE' : cfState === CfState.PRELOADING ? 'PRELOADING' : 'FADING',
            airLocked: cfAirLocked,
            activeSlot: cfActive,
            transitionId: cfTransitionId,
            pendingNextIdx: _cfPendingNextIdx,
            pendingNextVol: _cfPendingNextVol,
        },
        audioSlots: [
            {
                slot: 'A (audio)',
                src: audio?.src ? audio.src.slice(0, 80) + (audio.src.length > 80 ? '…' : '') : null,
                readyState: audio?.readyState,
                paused: audio?.paused,
                volume: audio?.volume,
                currentTime: audio?.currentTime,
                duration: audio?.duration,
                ended: audio?.ended,
            },
            {
                slot: 'B (cfAudioB)',
                src: cfAudioB?.src ? cfAudioB.src.slice(0, 80) + (cfAudioB.src.length > 80 ? '…' : '') : null,
                readyState: cfAudioB?.readyState,
                paused: cfAudioB?.paused,
                volume: cfAudioB?.volume,
                currentTime: cfAudioB?.currentTime,
                duration: cfAudioB?.duration,
                ended: cfAudioB?.ended,
            },
        ],
        visibility: {
            hidden: document.hidden,
            visibilityState: document.visibilityState,
        },
        performance: {
            memory: performance?.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            } : null,
            timing: performance?.timing ? {
                navigationStart: performance.timing.navigationStart,
                domComplete: performance.timing.domComplete,
            } : null,
        },
        config: (() => {
            try {
                const stored = JSON.parse(localStorage.getItem('MBolka_Cfg_v3') || localStorage.getItem('MBolka_Cfg_v2') || '{}');
                const { art, ...safe } = stored; // 排除 art blob
                return safe;
            } catch { return null; }
        })(),
        errors: logs,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `MBolka_Diagnostic_${new Date().toISOString().slice(0,19).replace(/[:]/g,'-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("诊断快照已导出", iconSvg('clipboard'));
};

// === 曲库独立面板 (v2.4.0 静态重构) ===
let coverLibSortMode = 'album'; // album / artist / recent
let coverLibAlbumSort = 'default'; // 🚀 仅 album 模式下的子排序：default（歌曲数降序）/ artist（同艺术家相邻+首字母）



// === 主题与模式控制 ===
function applyLrcSettings() {
    document.documentElement.style.setProperty('--lrc-font-size', `${cfg.lrcFontSize}px`);
    document.documentElement.style.setProperty('--lrc-line-height', cfg.lrcLineHeight);
    document.documentElement.style.setProperty('--lrc-align', cfg.lrcAlign);
    document.getElementById('lrcFontSizeVal').textContent = `${cfg.lrcFontSize}px`;
    document.getElementById('lrcLineHeightVal').textContent = cfg.lrcLineHeight;
    document.querySelectorAll('.lrc-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === cfg.lrcAlign));
}

// 🚀 v2.8.5: 歌词对齐模式UI更新
function updateLrcAlignUI() {
    const btnCenter = document.getElementById('btnLrcAlignCenter');
    const btnTop = document.getElementById('btnLrcAlignTop');
    if (btnCenter) btnCenter.classList.toggle('active', lyricsAlignMode === 'center');
    if (btnTop) btnTop.classList.toggle('active', lyricsAlignMode === 'top');
    // 切换 CSS 类到歌词视口
    if (el.lrcView) el.lrcView.classList.toggle('lyrics-align-top', lyricsAlignMode === 'top');
}

// === 核心视觉与主题逻辑 ===
const applyThemeLogic = () => {
    let targetColor = cfg.defaultColor; let showImg = false, showColor = false, bgUrl = '';

    if (cfg.followAccentColor) targetColor = cfg.customBgImg ? (cfg.customBgColor || targetColor) : (currentAlbumColor || targetColor);
    document.documentElement.style.setProperty('--primary', targetColor);
    // 🚀 v3.0.1b: 同步 RGB 分量
    const rgbP = hexToRgb(targetColor);
    if (rgbP) document.documentElement.style.setProperty('--primary-rgb', `${rgbP.r}, ${rgbP.g}, ${rgbP.b}`);

    // 🚀 v2.5-p2: 基于 WCAG 相对亮度选择可读前景色（对比白与近黑，取对比度高者）
    const lum = getLuminance(targetColor);
    const crWhite = (1 + 0.05) / (lum + 0.05);
    const crBlack = (lum + 0.05) / (0.011 + 0.05);
    const textOnPrimary = crWhite >= crBlack ? '#ffffff' : '#0a0a1a';
    document.documentElement.style.setProperty('--text-on-primary', textOnPrimary);

    document.documentElement.style.setProperty('--bg-blur', `${cfg.blurAmt}px`);
    targetHue = getHueFromRgb(targetColor);

    if (cfg.customBgImg) { showImg = true; bgUrl = cfg.customBgImg; }
    else if (hasCurrentAlbumArt && !cfg.followAccentColor) { showImg = true; bgUrl = el.mainArt.src; }
    else showColor = true;

    if (showImg) {
        el.bgImg.style.backgroundImage = `url(${bgUrl})`;
        el.bgImg.classList.add('active');
        el.bgColor.classList.remove('active');
        // 🚀 v3.4.2: 背景图片显示时，把图片顶部颜色同步给 ThemeColor，让 WCO 右上金刚键背景融入页面顶部
        (async () => {
            if (typeof ThemeColor === 'undefined') return;
            let topColor = null;
            if (cfg.customBgImg) {
                if (!cfg.customBgTopColor) cfg.customBgTopColor = await extractTopColor(cfg.customBgImg, 0.2);
                topColor = cfg.customBgTopColor;
            } else if (hasCurrentAlbumArt) {
                topColor = currentAlbumTopColor;
            }
            ThemeColor.updateTopColor(topColor);
        })();
    } else if (showColor) {
        // 🚀 v2.5: Canvas 流沙背景只需激活，颜色由 drawFlowingSand 实时渲染
        el.bgColor.classList.add('active');
        el.bgImg.classList.remove('active');
        // 🩹 v3.5.1: 不在此清除顶部取色——audio-core.js loadSong() 已从专辑封面提取并设置
        //           且已有 DOM <img> 兜底采样（extractTopColorFromElement）
        //           ThemeColor.updateTopColor(null);  // <-- 删除
    }

    // 🚀 v3.5.0: 背景沉浸遮罩随每次主题/背景刷新重算（确保与当前背景、夜间模式同步）
    applyBgImmersive();
    // 🩹 v3.5.1: 确保最终刷新 theme-color（配合 audio-core 的顶部取色 + followAccentColor 路径）
    if (typeof ThemeColor !== 'undefined') ThemeColor.refresh();
};

// 🚀 v3.5.0: 背景沉浸 — 把专辑封面/自定义背景变为全屏沉浸背板，并在夜间模式下叠加半透明黑遮罩。
// 遮罩采用「分层 alpha-over 合成」：沉浸基础遮罩(baseScrim) 与 夜间黑遮罩(darkScrim) 按
// 1-(1-a)*(1-b) 叠加计算，保证两者同时存在时不会简单相加溢出，而是正确加深而不丢失背景层次。
const applyBgImmersive = () => {
    const on = !!cfg.bgImmersive;
    document.body.classList.toggle('bg-immersive', on);
    const baseScrim = on ? 0.38 : 0;
    const darkScrim = (on && cfg.darkMode) ? 0.45 : 0;
    const finalAlpha = 1 - (1 - baseScrim) * (1 - darkScrim); // 叠加计算
    document.documentElement.style.setProperty('--bg-scrim-alpha', finalAlpha.toFixed(3));
};

function toggleDarkMode(force) {
    cfg.darkMode = force != null ? force : !cfg.darkMode;
    document.body.classList.toggle('dark-mode', cfg.darkMode);
    updateDarkModeUI();
    applyBgImmersive(); // 🚀 v3.5.0: 夜间模式切换需重算沉浸遮罩叠加
    saveSettings();
    showToast(cfg.darkMode ? "已开启深色/护眼模式" : "已恢复标准模式", cfg.darkMode ? iconSvg('moon') : iconSvg('sun'));
};
function updateDarkModeUI() {
    const toggle = document.getElementById('darkModeToggleSwitch');
    if (toggle) toggle.checked = cfg.darkMode;
    document.body.classList.toggle('dark-mode', cfg.darkMode);
}

// 🚀 v3.6.x: 沉浸模式切换后移除 will-change 的延时——与 CSS transition(0.5s) 留余量，
//   过早移除会让 GPU 层在动画尾段跳变；值统一在此管理，CSS 改动时同步更新
const IMM_WILLCHANGE_MS = 800;

function toggleImmersiveMode() {
    isImmersiveMode = !isImmersiveMode;

    // 🚀 v2.9.0: 切换前添加 will-change 让 GPU 准备图层
    el.viewMain.style.willChange = 'transform, opacity';
    el.viewImm.style.willChange = 'transform, opacity';

    if (isImmersiveMode) {
        el.viewMain.classList.add('hidden'); el.viewImm.classList.remove('hidden');
        document.body.style.background = 'var(--bg-darker)';
        immCanvasCleared = false;
        showToast("已进入沉浸式音乐舱", iconSvg('rocket'));
    } else {
        el.viewImm.classList.add('hidden'); el.viewMain.classList.remove('hidden');
        document.body.style.background = 'var(--bg-dark)';
        // 清理沉浸canvas - 修复canvas残留
        immCanvasCleared = true;
        const ctx = el.canvasImm.getContext('2d');
        ctx.clearRect(0, 0, el.canvasImm.width, el.canvasImm.height);
        particles = [];
        ripples = [];
        flowField = []; // 🚀 v2.7-preview2 P1: 释放流场大数组
        // 🚀 v3.4.3: 返回主界面立即强制流沙背景重绘，避免「返回后卡顿一秒才显示」
        if (typeof forceMainRedraw === 'function') forceMainRedraw();
    }
    updateFocusContext();

    // 🚀 v2.9.0: 动画结束后移除 will-change，释放 GPU 层
    setTimeout(() => {
        el.viewMain.style.willChange = 'auto';
        el.viewImm.style.willChange = 'auto';
    }, IMM_WILLCHANGE_MS);
}

const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(e=>{}); showToast("进入全屏", iconSvg('maximize')); }
    else { if (document.exitFullscreen) document.exitFullscreen(); showToast("退出全屏", iconSvg('minimize')); }
};
