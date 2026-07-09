/*
 * MBolka Player - Utilities v3.6.3
 * Toast, formatting, encoding, settings persistence
 */

// 🚀 v3.0.2: Toast 即时更新 — 新消息立即替换当前气泡，重置消失计时
let _toastTimer = null;

const showToast = (msg, icon = '') => {
    clearTimeout(_toastTimer);
    el.toast.innerHTML = `${icon} ${escapeHTML(msg)}`;
    el.toast.classList.add('show');
    _toastTimer = setTimeout(() => {
        el.toast.classList.remove('show');
        // 🩹 v3.2.3: CSS transition 自然处理进出双向，无需强制重排
    }, 1800);
};

// 🚀 v3.4.x: 生成内联 SVG 图标标记（替换 JS 内残存的 emoji）
const iconSvg = (name) => `<svg class="ui-ico"><use href="#icon-${name}"/></svg>`;
// 🚀 v3.4.x: 动态切换收藏红心填充状态（filled=true 实心，false 描边轮廓）
const setHeartFilled = (container, filled) => {
  if (!container) return;
  const use = container.querySelector('use');
  if (use) use.setAttribute('href', filled ? '#icon-heart-filled' : '#icon-heart');
  container.classList.toggle('faved', !!filled);
};
// 🚀 v3.5.0: 统一图标切换 helper —— 优先切换按钮内 <use href>，避免覆盖文字/内置图标；
//           无 <use> 时整段替换为 SVG（可附带文字 label）。供播放/暂停、模式等高频图标切换复用。
const setBtnIcon = (btn, name, label = '') => {
  if (!btn) return;
  const u = btn.querySelector('use');
  if (u) u.setAttribute('href', `#icon-${name}`);
  else btn.innerHTML = label ? `${iconSvg(name)} ${label}` : iconSvg(name);
};
// 🚀 v3.5.0: 统一图标 + 文案 helper —— 用于「图标 + 文字状态」按钮（如音调、淡入淡出）。
//           集中 innerHTML 模板，后续改文案只动一处。
const setBtnText = (btn, iconName, text) => {
  if (!btn) return;
  btn.innerHTML = `${iconSvg(iconName)} ${text}`;
};
const formatTime = (sec) => { if (!sec || isNaN(sec)) return '0:00'; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
const decodeText = (str) => { if (!str) return ''; let s = str.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))); const txt = document.createElement("textarea"); txt.innerHTML = s; return txt.value; };

const saveSettingsNow = () => {
    try {
        localStorage.setItem('MBolka_Cfg_v3', JSON.stringify({
            // 🚀 核心修复：只保存滑块的物理数值，防止保存淡入淡出时的临时"0"音量
            followAccentColor: cfg.followAccentColor, bgImmersive: cfg.bgImmersive, wcoPseudoImmersive: cfg.wcoPseudoImmersive, useOppoSans: cfg.useOppoSans, oppoSansWeight: cfg.oppoSansWeight, oppoKeepEnglish: cfg.oppoKeepEnglish, blurAmt: cfg.blurAmt, vol: parseFloat(el.volSlider.value),
            isShuffle: isShuffle, isRepeatOne: isRepeatOne,
            customBgImg: cfg.customBgImg, customBgColor: cfg.customBgColor, customBgTopColor: cfg.customBgTopColor,
            darkMode: cfg.darkMode, lrcFontSize: cfg.lrcFontSize,
            lrcLineHeight: cfg.lrcLineHeight, lrcAlign: cfg.lrcAlign,
            themePreset: cfg.themePreset, playbackRate: playbackRate,
            preservesPitch: preservesPitch, crossfadeEnabled: crossfadeEnabled,
            crossfadeDuration: crossfadeDuration, crossfadeCurve: crossfadeCurve,
            crossfadeNormalize: crossfadeNormalize, 
            // 🚀 v2.8.2: 兼容旧版 performanceMode
            performanceMode: performanceMode,
            // 🚀 v2.8.2: 新增节能配置
            oneClickEnergyEnabled: cfg.oneClickEnergyEnabled,
            frameEnergyEnabled: cfg.frameEnergyEnabled,
            pipEnergyEnabled: cfg.pipEnergyEnabled,
            eqGains: eqGains, lyricsOffset: lyricsOffset,
            // 🚀 v2.8.5: 歌词对齐模式持久化
            lyricsAlignMode: lyricsAlignMode,
            // 🚀 v2.8.2: 兼容旧版 energySavingEnabled
            energySavingEnabled: cfg.pipEnergyEnabled,
            // 🚀 v3.0.1b: 震动配置持久化
            rumbleEnabled: cfg.rumbleEnabled,
            rumbleMode: cfg.rumbleMode,
            rumbleFloor: cfg.rumbleFloor,
            rumbleAutoFloor: cfg.rumbleAutoFloor,
            rumbleThrottle: cfg.rumbleThrottle,
            rumbleStrongGain: cfg.rumbleStrongGain,
            rumbleWeakGain: cfg.rumbleWeakGain,
            rumbleSwapMotors: cfg.rumbleSwapMotors,
            rumbleGain: cfg.rumbleGain
        }));
        localStorage.setItem('MBolka_Favorites_v3', JSON.stringify([...favorites]));
        // Save play stats
        if (Object.keys(playStats).length) {
            localStorage.setItem('MBolka_Stats', JSON.stringify(playStats));
        }
    } catch(e){}
};

// 🚀 v3.5.0: saveSettings 节流 —— 高频调用（滑块 oninput / 连续切换）合并落盘，避免每帧写 localStorage；
//           首次调用立即落盘（关键变更不丢），窗口内后续调用合并为一次末尾写入，页面隐藏时强制 flush。
let _saveSettingsTimer = null;
let _saveSettingsPending = false;
const saveSettings = () => {
    _saveSettingsPending = true;
    saveSettingsNow(); // 立即落盘首次变更
    if (_saveSettingsTimer) return; // 仍在节流窗口内 → 等待末尾合并写入
    _saveSettingsTimer = setTimeout(() => {
        _saveSettingsTimer = null;
        if (_saveSettingsPending) { _saveSettingsPending = false; saveSettingsNow(); }
    }, 400);
};
const flushSettings = () => {
    if (_saveSettingsTimer) { clearTimeout(_saveSettingsTimer); _saveSettingsTimer = null; }
    if (_saveSettingsPending) { _saveSettingsPending = false; saveSettingsNow(); }
};
// 页面隐藏/卸载时强制刷盘，避免节流窗口内的末次变更丢失
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSettings(); });
window.addEventListener('pagehide', flushSettings);
const loadSettings = () => {
    try {
        const stored = JSON.parse(localStorage.getItem('MBolka_Cfg_v3') || localStorage.getItem('MBolka_Cfg_v2'));
        if (stored) {
            cfg.followAccentColor = stored.followAccentColor ?? stored.colorMode ?? false;
            cfg.bgImmersive = stored.bgImmersive ?? false;
            cfg.wcoPseudoImmersive = stored.wcoPseudoImmersive ?? true;
            cfg.useOppoSans = stored.useOppoSans ?? false;
            cfg.oppoSansWeight = stored.oppoSansWeight ?? 'R';
            cfg.oppoKeepEnglish = stored.oppoKeepEnglish ?? false;
            cfg.blurAmt = stored.blurAmt ?? 40;
            audio.volume = stored.vol ?? 0.7;
            isShuffle = stored.isShuffle ?? false;
            isRepeatOne = stored.isRepeatOne ?? false;
            cfg.customBgImg = stored.customBgImg ?? null;
            cfg.customBgColor = stored.customBgColor ?? null;
            cfg.customBgTopColor = stored.customBgTopColor ?? null;
            cfg.darkMode = stored.darkMode ?? false;
            cfg.lrcFontSize = stored.lrcFontSize ?? 18;
            cfg.lrcLineHeight = stored.lrcLineHeight ?? 2.2;
            cfg.lrcAlign = stored.lrcAlign ?? 'center';
            cfg.themePreset = stored.themePreset ?? null;
            playbackRate = stored.playbackRate ?? 1.0;
            preservesPitch = stored.preservesPitch ?? true;
            crossfadeEnabled = stored.crossfadeEnabled ?? false;
            crossfadeDuration = stored.crossfadeDuration ?? 3;
            crossfadeCurve = stored.crossfadeCurve ?? 'exponential';
            crossfadeNormalize = stored.crossfadeNormalize ?? true;
            
            // 🚀 v2.8.2: 兼容旧版 performanceMode，映射到 frameEnergyEnabled
            performanceMode = stored.performanceMode ?? false;
            cfg.frameEnergyEnabled = stored.frameEnergyEnabled ?? performanceMode;
            
            eqGains = stored.eqGains ?? new Array(10).fill(0);
            lyricsOffset = stored.lyricsOffset ?? 0;
            
            // 🚀 v2.8.5: 恢复歌词对齐模式
            lyricsAlignMode = stored.lyricsAlignMode ?? 'center';
            updateLrcAlignUI();
            
            // 🚀 v2.8.2: 兼容旧版 energySavingEnabled，映射到 pipEnergyEnabled
            cfg.pipEnergyEnabled = stored.pipEnergyEnabled ?? stored.energySavingEnabled ?? true;
            cfg.oneClickEnergyEnabled = stored.oneClickEnergyEnabled ?? false;
            
            // 🚀 v3.0.1b: 震动配置恢复
            cfg.rumbleEnabled = stored.rumbleEnabled ?? true;
            cfg.rumbleMode = stored.rumbleMode ?? 'basscut';
            cfg.rumbleFloor = stored.rumbleFloor ?? 0.30;
            cfg.rumbleAutoFloor = stored.rumbleAutoFloor ?? true;
            cfg.rumbleThrottle = stored.rumbleThrottle ?? 50;
            cfg.rumbleStrongGain = stored.rumbleStrongGain ?? 2.0;
            cfg.rumbleWeakGain = stored.rumbleWeakGain ?? 0.4;
            cfg.rumbleSwapMotors = stored.rumbleSwapMotors ?? false;
            cfg.rumbleGain = stored.rumbleGain ?? 1.0;
            
            // 🚀 v2.8.2: 同步UI开关状态
            const oneClickToggle = document.getElementById('oneClickEnergyToggle');
            if (oneClickToggle) oneClickToggle.checked = cfg.oneClickEnergyEnabled;
            const frameToggle = document.getElementById('frameEnergyToggle');
            if (frameToggle) frameToggle.checked = cfg.frameEnergyEnabled;
            const pipToggle = document.getElementById('pipEnergyToggle');
            if (pipToggle) pipToggle.checked = cfg.pipEnergyEnabled;
            // 同时初始化双端滑块与百分比显示（修复刷新后音量条数字滞留默认 70%）
            el.volSlider.value = audio.volume;
            if (el.immVolSlider) el.immVolSlider.value = audio.volume;
            const volPercent = document.getElementById('volPercent');
            if (volPercent) volPercent.textContent = `${Math.round(audio.volume * 100)}%`;
            const immVolPercent = document.getElementById('immVolPercent');
            if (immVolPercent) immVolPercent.textContent = `${Math.round(audio.volume * 100)}%`;
            document.getElementById('blurSlider').value = cfg.blurAmt;
            document.getElementById('blurVal').textContent = `${cfg.blurAmt}px`;
            document.getElementById('lrcFontSizeSlider').value = cfg.lrcFontSize;
            document.getElementById('lrcLineHeightSlider').value = cfg.lrcLineHeight;
            document.getElementById('lrcFontSizeVal').textContent = `${cfg.lrcFontSize}px`;
            document.getElementById('lrcLineHeightVal').textContent = cfg.lrcLineHeight;
            applyLrcSettings();
            updateModeUI();
            updateSettingsUI();
            updateDarkModeUI();
            applyThemeLogic();
            if (cfg.themePreset) {
                document.documentElement.style.setProperty('--primary', cfg.themePreset);
                const rgbU = hexToRgb(cfg.themePreset);
                if (rgbU) document.documentElement.style.setProperty('--primary-rgb', `${rgbU.r}, ${rgbU.g}, ${rgbU.b}`);
            }
        }
        const favs = JSON.parse(localStorage.getItem('MBolka_Favorites_v3') || localStorage.getItem('MBolka_Favorites_v2'));
        if (favs) favorites = new Set(favs);
        const stats = JSON.parse(localStorage.getItem('MBolka_Stats') || '{}');
        if (stats) playStats = stats;
    } catch(e) { audio.volume = 0.7; }
};

// === IndexedDB 初始化 ===


// === 颜色提取与辅助 ===
const extractColor = (imgSrc) => {
    return new Promise((resolve) => {
        if (!imgSrc || imgSrc.startsWith('data:image/svg')) return resolve(null);
        const img = new Image();
        img.onload = () => {
            const cvs = document.createElement('canvas'); cvs.width = 32; cvs.height = 32;
            const ctx = cvs.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, 32, 32);
            try {
                const data = ctx.getImageData(0, 0, 32, 32).data; let r=0, g=0, b=0, count=0;
                for(let i=0; i<data.length; i+=16) { if(data[i]>20 && data[i]<235) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; count++; } }
                resolve(count > 0 ? `rgb(${~~(r/count)},${~~(g/count)},${~~(b/count)})` : null);
            } catch(e) { resolve(null); }
        }; img.onerror = () => resolve(null); img.src = imgSrc;
    });
};
const extractTopColor = (imgSrc, sampleHeight = 0.25) => {
    return new Promise((resolve) => {
        if (!imgSrc || imgSrc.startsWith('data:image/svg')) return resolve(null);
        const img = new Image();
        img.onload = () => {
            const cvs = document.createElement('canvas');
            const w = 64, h = Math.max(1, Math.round(w * sampleHeight));
            cvs.width = w; cvs.height = h;
            const ctx = cvs.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, img.width, img.height * sampleHeight, 0, 0, w, h);
            try {
                const data = ctx.getImageData(0, 0, w, h).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 16) {
                    if (data[i] > 20 && data[i] < 235) {
                        r += data[i]; g += data[i+1]; b += data[i+2]; count++;
                    }
                }
                resolve(count > 0 ? `rgb(${~~(r/count)},${~~(g/count)},${~~(b/count)})` : null);
            } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = imgSrc;
    });
};

// 🚀 v3.5.1: 从已加载的 DOM <img> 元素直接提取顶部颜色——避免 new Image() 对 blob URL 可能加载失败（CORS/revoke）
const extractTopColorFromElement = (imgEl, sampleHeight = 0.25) => {
    if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) return null;
    try {
        const cvs = document.createElement('canvas');
        const w = 64, h = Math.max(1, Math.round(w * sampleHeight));
        cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imgEl, 0, 0, imgEl.naturalWidth, Math.round(imgEl.naturalHeight * sampleHeight), 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
            if (data[i] > 20 && data[i] < 235) {
                r += data[i]; g += data[i+1]; b += data[i+2]; count++;
            }
        }
        return count > 0 ? `rgb(${~~(r/count)},${~~(g/count)},${~~(b/count)})` : null;
    } catch (e) { console.warn('[extractColor] 取色失败（可能 CORS 受限）:', e && e.message); return null; } // 🚀 v3.6.x: 记录失败原因便于调试
};

const getHueFromRgb = (rgbStr) => {
    if (!rgbStr) return 210; const match = rgbStr.match(/\d+/g); if (!match) return 210;
    let r = parseInt(match[0])/255, g = parseInt(match[1])/255, b = parseInt(match[2])/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b); let h = 0;
    if (max !== min) { const d = max - min; switch (max) { case r: h = (g-b)/d + (g<b?6:0); break; case g: h = (b-r)/d + 2; break; case b: h = (r-g)/d + 4; break; } h /= 6; } return h * 360;
};

// HTML 转义 — 统一入口
let _escapeDiv = null;
const escapeHTML = (str) => {
    if (!str) return '';
    if (!_escapeDiv) _escapeDiv = document.createElement('div'); // 🚀 v3.6.x: 复用同一 div，避免高频（歌词逐行）渲染时反复创建临时 DOM
    _escapeDiv.textContent = str;
    return _escapeDiv.innerHTML;
};
