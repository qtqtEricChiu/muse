/*
 * MBolka Player - Entry Point v3.0.1
 * Namespace export, initialization, event binding
 * All modules loaded via index.html <script> tags before this file
 */

// === 命名空间封装 ===
window.MBolka = {
    togglePlay, goNext, goPrev, cyclePlayMode,
    toggleImmersiveMode, toggleFullscreen, toggleDarkMode,
    togglePip, showCoverLibrary, showStatsPanel,
    searchPlaylist, exportPlaylist, importPlaylist,
    adjustLyricsOffset, setSleepTimer, exportErrorLogs,
    toggleFavorite,
    get playlist() { return playlist; },
    get currentIndex() { return currentIndex; },
    get isPlaying() { return isPlaying; },
    get favorites() { return favorites; },
};

// === 初始化 ===
// 使用 DOMContentLoaded 替代 load，确保 DOM 解析完成后立即执行（JS 在 body 末尾加载）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM 已经解析完成，立即执行
    initApp();
}

async function initApp() {
    await initIDB();
    await autoCleanOnStart(); // v3.0.2: 启动时清理过期缓存
    loadSettings();
    updateEmptyState();
    updateDarkModeUI();
    applyLrcSettings();
    initCrossfadeEngine();   // 🔥 v2.8.9: 初始化交叉淡变引擎
    cfSetupScanner();        // 🔥 v2.8.9: 交叉淡变扫描器
    updateFavQuickBtn();
    
    // 🔥 v2.8.13: 初始化音频输出设备选择功能
    initAudioOutputDeviceSelector();

    // 🚀 v3.0.0: 网络状态侦听
    updateNetworkStatus();

    // 🚀 v3.2.0: WCO 标题栏 + 动态 theme-color
    if (typeof WCO !== 'undefined') WCO.init();
    if (typeof ThemeColor !== 'undefined') ThemeColor.onDarkModeChange(cfg.darkMode);

    // 🚀 v3.0.1: 系统主题自动跟随
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    if (!localStorage.getItem('MBolka_Cfg_v3') && !localStorage.getItem('MBolka_Cfg_v2')) {
        cfg.darkMode = prefersDark.matches;
        updateDarkModeUI();
    }
    prefersDark.addEventListener('change', (e) => {
        if (!localStorage.getItem('MBolka_Cfg_v3_darkMode')) {
            cfg.darkMode = e.matches;
            updateDarkModeUI();
        }
    });
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) conn.addEventListener('change', updateNetworkStatus);

    // 从localStorage恢复错误日志到内存缓存
    try {
        const stored = JSON.parse(localStorage.getItem('MBolka_ErrorLogs') || '[]');
        if (stored.length) _errorLogsCache.push(...stored);
    } catch(e) {}

    // 尝试从持久化目录加载
    const loaded = await loadFromStoredDirectory();
    if (!loaded) {
        // 没有持久化目录，显示空状态
        updateEmptyState();
    }

    // 如果设置了EQ增益，初始化EQ
    if (eqGains.some(g => g !== 0) && audioCtx) {
        initEQ();
    }

    // === 统一事件绑定 (从 index.html 内联 script 迁移至此，确保加载时序一致) ===

    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => searchPlaylist(e.target.value));
    }

    // 导出按钮
    const btnExportM3U = document.getElementById('btnExportM3U');
    if (btnExportM3U) btnExportM3U.onclick = () => exportPlaylist('m3u');
    const btnExportJSON = document.getElementById('btnExportJSON');
    if (btnExportJSON) btnExportJSON.onclick = () => exportPlaylist('json');

    // 🚀 v2.8.2: 设置面板不再包含画中画按钮（仅保留主界面播放器入口）
    // (原 btnTogglePip 绑定已移除)

    // 歌词偏移按钮
    const btnLrcOffsetMinus = document.getElementById('btnLrcOffsetMinus');
    if (btnLrcOffsetMinus) btnLrcOffsetMinus.onclick = () => adjustLyricsOffset(-0.5);
    const btnLrcOffsetPlus = document.getElementById('btnLrcOffsetPlus');
    if (btnLrcOffsetPlus) btnLrcOffsetPlus.onclick = () => adjustLyricsOffset(0.5);
    const btnLrcOffsetMinusFine = document.getElementById('btnLrcOffsetMinusFine');
    if (btnLrcOffsetMinusFine) btnLrcOffsetMinusFine.onclick = () => adjustLyricsOffset(-0.1);
    const btnLrcOffsetPlusFine = document.getElementById('btnLrcOffsetPlusFine');
    if (btnLrcOffsetPlusFine) btnLrcOffsetPlusFine.onclick = () => adjustLyricsOffset(0.1);

    // 导出错误日志
    const btnExportLogs = document.getElementById('btnExportLogs');
    if (btnExportLogs) btnExportLogs.onclick = exportErrorLogs;

    // 清理缓存按钮
    const btnClearCache = document.getElementById('btnClearCache');
    if (btnClearCache) {
        btnClearCache.onclick = async () => {
            if (typeof clearAllCache === 'function') {
                await clearAllCache();
                if (typeof showToast === 'function') showToast('缓存已清理', iconSvg('check'));
            }
        };
    }

    // 睡眠定时器按钮
    const btnSleep15 = document.getElementById('btnSleep15');
    if (btnSleep15) btnSleep15.onclick = () => setSleepTimer(15);
    const btnSleep30 = document.getElementById('btnSleep30');
    if (btnSleep30) btnSleep30.onclick = () => setSleepTimer(30);
    const btnSleep60 = document.getElementById('btnSleep60');
    if (btnSleep60) btnSleep60.onclick = () => setSleepTimer(60);
    const btnSleepCancel = document.getElementById('btnSleepCancel');
    if (btnSleepCancel) btnSleepCancel.onclick = () => setSleepTimer(0);

    // 🚀 v2.8.2: 节能模式板块事件绑定

    // 一键节能开关
    const oneClickToggle = document.getElementById('oneClickEnergyToggle');
    if (oneClickToggle) {
        oneClickToggle.addEventListener('change', (e) => {
            cfg.oneClickEnergyEnabled = e.target.checked;
            oneClickEnergySaving = e.target.checked;
            if (e.target.checked) {
                enterEnergySaving(EnergyMode.ONE_CLICK);
            } else {
                exitEnergySaving(EnergyMode.ONE_CLICK);
                showToast("一键节能已关闭", iconSvg('zap'));
            }
            saveSettings();
        });
    }

    // 画面节能开关
    const frameToggle = document.getElementById('frameEnergyToggle');
    if (frameToggle) {
        frameToggle.addEventListener('change', (e) => {
            cfg.frameEnergyEnabled = e.target.checked;
            frameEnergySaving = e.target.checked;
            // 同步兼容旧版 performanceMode
            performanceMode = e.target.checked;
            showToast(frameEnergySaving ? "画面节能已开启 (30fps)" : "画面节能已关闭 (60fps)", iconSvg('zap'));
            saveSettings();
        });
    }

    // 临时节能开关
    const pipToggle = document.getElementById('pipEnergyToggle');
    if (pipToggle) {
        pipToggle.addEventListener('change', (e) => {
            cfg.pipEnergyEnabled = e.target.checked;
            showToast(cfg.pipEnergyEnabled ? "临时节能已开启" : "临时节能已关闭", iconSvg('zap'));
            saveSettings();
        });
    }

    // 🔧 v2.8.4: visibilitychange — 标签页隐藏时自动节能 + 暂停渲染
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 🚀 v2.8.2+: 暂停高频渲染循环
            visLoopPaused = true;
            if (lrcTimer) clearInterval(lrcTimer);

            // 如果画中画运行中，进入可见性节能
            if (pipWindow && !pipWindow.closed) {
                enterEnergySaving(EnergyMode.VISIBILITY);
            }
        } else {
            // 🚀 v2.8.2+: 恢复渲染
            visLoopPaused = false;

            // 🔧 v2.8.4: 只退出可见性节能，保留其他模式
            exitEnergySaving(EnergyMode.VISIBILITY);

            // 如果完全没有节能需求，恢复渲染
            if (!shouldBeEnergySaving() && analyser) {
                requestAnimationFrame(renderVisLoop);
            }

            // 🩹 v3.2.3: 节能模式下恢复标签页时重新启动歌词降频定时器
            if (shouldBeEnergySaving() && !lrcTimer) {
                lrcTimer = setInterval(() => syncLyrics(true), 500);
            }
        }
    });

    // 🔥 v2.8.10: PWA 检测 — 不展示安装按钮，仅弹 toast 欢迎 PWA 用户
    // 检测是否在 PWA (standalone) 模式下运行
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        setTimeout(() => showToast('🎉 尊敬的PWA版本用户，欢迎使用 MBolka Player'), 800);
    }
    // 🔥 v2.8.10: 不再监听 beforeinstallprompt 或展示安装按钮，保持界面简洁

    // 🔥 v2.8.10: 窗口 resize 时重新计算歌词居中
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (parsedLyrics.length && el.lrcPanel.style.display !== 'none') {
                syncLyrics(true);  // 强制重新计算居中位置
            }
        }, 150);  // 150ms 防抖
    });

    // 🔥 v2.8.13: 移动端竖屏自动进入沉浸模式
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const isPortrait = window.matchMedia("(orientation: portrait)");
        const handleOrientationChange = (e) => {
            if (e.matches) {
                // 竖屏模式，自动进入沉浸模式
                if (!isImmersiveMode) {
                    toggleImmersiveMode();
                }
            } else {
                // 横屏模式，退出沉浸模式
                if (isImmersiveMode) {
                    toggleImmersiveMode();
                }
            }
        };
        isPortrait.addEventListener('change', handleOrientationChange);
        // 初始检查
        handleOrientationChange(isPortrait);
    }
}
