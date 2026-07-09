/*
 * MBolka Player - Globals v3.6.3
 * Worker inline, state variables, LUTs, EnergyMode enum, cfg, el references
 */

/**
 * MBolka Player - Ultimate Nexus v3.6.3
 * Main Application Logic
 * 
 * 🔥 v2.8.10 全球发行版：
 * - LRC 解析引擎基于 TME 真实编码格式完全重写（同时间戳配对）
 * - 创作信息（词曲编曲）保留并 UI 焕新为轻盈卡片样式
 * - 移除 (QQ音乐) 品牌标签，下一句歌词还原 Apple Music 统一模糊样式
 * - 前 5 句歌词 margin-top 逐句递减，避免贴顶
 * - 日语 [kana:] 罗马音注音解析与呈现
 * - 独立时间戳空行保留（单语有意空置）
 * - Crossfade 实验性警告提示，开启时立即初始化 AudioContext
 * - PWA 版本不展示安装按钮，检测到 PWA 运行时弹 toast 欢迎
 */

// === 核心状态与全局变量 ===
const audio = new Audio(); audio.crossOrigin = "anonymous";
let audioCtx, analyser, source, dataArray;
let spectrumCtxMain;
// 🔥 v3.6.0: 可视化/EQ 公共汇流节点——主槽 audio 与备用槽 cfAudioB 都汇入此，
// 经 EQ 链 → analyser → destination。交叉淡变期间双槽同时发声，频谱/均衡器均不冻结。
let visInputNode = null;

let playlist = [];     // 当前活跃播放队列
let musicLibrary = []; // 🚀 新增：导入的完整本地音乐库（不因播放模式而缩水）
let lrcMap = new Map(), playHistory = [];
let currentIndex = -1, isPlaying = false, isShuffle = false, isRepeatOne = false, isImmersiveMode = false;
let parsedLyrics = [], isUserScrollingLyrics = false, lyricsScrollTimeout = null;
let gamepadConnected = false, prevPadBtns = [], prevPadAxes = [];
let lyricsOffset = 0; // 歌词时间偏移(秒)
let lyricsAlignMode = 'center'; // 🚀 v2.8.5: 歌词对齐模式 'center' | 'top'

// A-B 重复
let abMode = false, abPointA = null, abPointB = null;

// 视觉特效参数
let particles = [], ripples = [];
const MAX_PARTICLES = 120, MAX_RIPPLES = 12;
let emitterX = window.innerWidth / 2, emitterY = window.innerHeight / 2;
let currentHue = 210, targetHue = 210, visTime = 0;
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
let bassHistory = [];
let immCanvasCleared = false; // 防止沉浸canvas残留

// 🚀 v2.5: 流沙波动相位
let sandPhaseA = 0, sandPhaseB = 0, sandPhaseC = 0;

// 🚀 v2.5-p2: 三角函数查表法 (LUT) — 用极小的内存换取零CPU浮点运算
// 128 点全圆查表，覆盖沉浸模式 48 点半弧、频谱 64 点环形等高频场景
const LUT_SIZE = 128;
const SIN_TABLE = [], COS_TABLE = [];
for (let i = 0; i < LUT_SIZE; i++) {
    const angle = (i / LUT_SIZE) * Math.PI * 2;
    SIN_TABLE.push(Math.sin(angle));
    COS_TABLE.push(Math.cos(angle));
}
// 便捷函数：将角度映射到查表索引
function lutSin(angle) {
    let idx = Math.round((angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * LUT_SIZE) % LUT_SIZE;
    return SIN_TABLE[idx];
}
function lutCos(angle) {
    let idx = Math.round((angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * LUT_SIZE) % LUT_SIZE;
    return COS_TABLE[idx];
}

// 播放引擎增强
let playbackRate = 1.0;
let preservesPitch = true;
let crossfadeEnabled = false;
let crossfadeDuration = 3; // 秒
let crossfadeCurve = 'exponential'; // 'exponential' | 'linear' | 'equal-power'
let crossfadeNormalize = true;      // 响度归一化
let isFading = false; // 🚀 全局淡入淡出锁，防止 timeupdate 触发多重定时器崩溃

// 🔥 v2.8.9: Crossfade 引擎全面重写 — Web Audio API GainNode 精确定时淡变
// 固定双音频槽位（永不交换），AudioContext 工厂模式懒初始化
let audioCtx_cf = null;          // crossfade 专用 AudioContext
let cfSourceNodeA = null;        // MediaElementSourceNode for audioA
let cfSourceNodeB = null;        // MediaElementSourceNode for audioB
let cfGainNodeA = null;          // GainNode for slot A
let cfGainNodeB = null;          // GainNode for slot B
let cfAnalyserA = null;          // AnalyserNode for slot A（响度归一化用）
let cfAnalyserB = null;          // AnalyserNode for slot B
let cfAudioB = null;             // 备用音频槽 B
let cfActive = 'A';              // 'A' 或 'B'，当前播放槽
let cfSlotIdxA = -1;             // 🔥 v3.6.3: 主槽(audio)当前装载的 playlist 索引（用于错位自愈）
let cfSlotIdxB = -1;             // 🔥 v3.6.3: 备用槽(cfAudioB)当前装载的 playlist 索引
let cfPreloadTimer = null;       // 预加载计时器
let cfRafId = null;              // 外部交叉淡变检测 rAF ID
let cfTransitionId = 0;          // 事务 ID，防止重叠
let cfAirLocked = false;         // 门禁锁，防止交叉淡变期间手动切歌
// 🔥 v3.6.2: 缓存当前进行中淡变的参数，用于 onAudioEnded 在后台 rAF 冻结时强制收尾
let _cfPendingNextIdx = -1;      // 下一首索引（cfFinishTransition 参数）
let _cfPendingNextVol = 1;       // 用户音量（cfFinishTransition 参数）

const cfGetActiveAudio = () => cfActive === 'A' ? audio : cfAudioB;
const cfGetPassiveAudio = () => cfActive === 'A' ? cfAudioB : audio;
const cfGetActiveGain = () => cfActive === 'A' ? cfGainNodeA : cfGainNodeB;
const cfGetPassiveGain = () => cfActive === 'A' ? cfGainNodeB : cfGainNodeA;
const cfGetActiveSource = () => cfActive === 'A' ? cfSourceNodeA : cfSourceNodeB;
const cfGetPassiveSource = () => cfActive === 'A' ? cfSourceNodeB : cfSourceNodeA;
const cfGetActiveAnalyser = () => cfActive === 'A' ? cfAnalyserA : cfAnalyserB;
const cfGetPassiveAnalyser = () => cfActive === 'A' ? cfAnalyserB : cfAnalyserA;

// 🔥 v3.6.0: 进度条 / 拖拽 / 歌词 / A-B / Media Session 等「控制面」统一跟随当前正在发声的槽。
// - 手动切歌或交叉淡变关闭 → 全局 audio（cfAudioB 不存在时退化为 audio）。
// - 交叉淡变进行中(FADING) → 返回正在淡入的新歌（被动槽），此时界面已将「下一首」视为当前曲。
// - 过渡完成后 → 返回新活跃槽（cfAudioB 或换回 cfAudioA）。
const getActivePlayAudio = () => {
    if (cfState === CfState.FADING) return cfGetPassiveAudio();
    return (crossfadeEnabled && cfAudioB) ? cfGetActiveAudio() : audio;
};

// 🔥 v3.6.0: 遍历所有音频槽（主槽 + 备用槽），用于统一绑定 timeupdate/loadedmetadata/error 等事件。
const forEachAudioEl = (cb) => {
    cb(audio);
    if (cfAudioB) cb(cfAudioB);
};

// 🔥 v2.8.9: 懒初始化 AudioContext（用户首次播放时创建，符合 Chrome 自动播放策略）
function cfEnsureContext() {
    if (audioCtx_cf) return true;
    try {
        audioCtx_cf = new (window.AudioContext || window.webkitAudioContext)();
        if (!cfAudioB) {
            cfAudioB = new Audio();
            cfAudioB.crossOrigin = 'anonymous';
            cfAudioB.preload = 'auto';
        }
        cfGainNodeA = audioCtx_cf.createGain();
        cfGainNodeB = audioCtx_cf.createGain();
        cfGainNodeA.gain.value = audio.volume;
        cfGainNodeB.gain.value = 0;
        cfAnalyserA = audioCtx_cf.createAnalyser();
        cfAnalyserB = audioCtx_cf.createAnalyser();
        cfAnalyserA.fftSize = 128;
        cfAnalyserB.fftSize = 128;
        cfSourceNodeA = audioCtx_cf.createMediaElementSource(audio);
        cfSourceNodeB = audioCtx_cf.createMediaElementSource(cfAudioB);
        cfSourceNodeA.connect(cfAnalyserA);
        cfAnalyserA.connect(cfGainNodeA).connect(audioCtx_cf.destination);
        cfSourceNodeB.connect(cfAnalyserB);
        cfAnalyserB.connect(cfGainNodeB).connect(audioCtx_cf.destination);
        // 主音频未启用交叉淡变时绕过增益（直通）
        cfGainNodeA.gain.value = audio.volume;
        return true;
    } catch (e) {
        console.warn('AudioContext 初始化失败，回退到裸切歌', e);
        audioCtx_cf = null;
        return false;
    }
}

// 🔥 v2.8.9: 初始化交叉淡变（替代 initAudioPool）
function initCrossfadeEngine() {
    cfAudioB = new Audio();
    cfAudioB.crossOrigin = 'anonymous';
    cfAudioB.preload = 'auto';
    cfActive = 'A';
    cfAirLocked = false;
    cfTransitionId = 0;
    // 🔥 v3.6.0: 备用槽 cfAudioB 绑定与「当前活跃槽」一致的事件处理器，
    // 交叉淡变切到 B 后进度条/时长/错误/媒体中心定位不冻结。
    if (typeof onProgressTick === 'function') cfAudioB.addEventListener('timeupdate', onProgressTick);
    if (typeof onAudioLoadedMetadata === 'function') cfAudioB.addEventListener('loadedmetadata', onAudioLoadedMetadata);
    if (typeof onAudioError === 'function') cfAudioB.addEventListener('error', onAudioError);
    // 🔥 v3.6.0: 备用槽「播放结束」统一绑定 onAudioEnded（与全局 audio 一致）。
    // 双槽永久绑定同一处理器，切歌/交叉淡变重置时不再置空 onended，
    // 避免「关闭淡入淡出后放完一首歌自动暂停（不续播）」的问题。
    cfAudioB.onended = onAudioEnded;
}

// 🔥 v2.8.9: AudioContext 状态枚举替代旧 CrossfadeState
const CfState = { IDLE: 0, PRELOADING: 1, FADING: 2 };
let cfState = CfState.IDLE;

// 均衡器
let eqFilters = [];
let eqMakeup = null; // 🚀 v3.5.4: 末端补偿增益节点，防止提升后峰值超出 0 dBFS 削波
let eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
let eqGains = new Array(10).fill(0); // dB

// 睡眠定时器
let sleepTimer = null;
let sleepEndTime = null;

// 性能模式
let performanceMode = false;
let targetFPS = 60;
let currentFPS = 60;
let fpsFrames = 0;
let fpsLastTime = performance.now();
let particleCount = MAX_PARTICLES; // 动态粒子数量

// 🚀 v2.8.4: 节能模式状态机 — 位标志叠加，支持多模式共存
const EnergyMode = {
    NONE: 0,
    ONE_CLICK: 1,    // 🔋 用户手动开启
    PIP_TEMP: 2,     // 📺 画中画临时节能
    FRAME_LIMIT: 4,  // 🎬 帧率限制（30fps）
    VISIBILITY: 8    // 👁 标签页隐藏
};
let energyModeFlags = EnergyMode.NONE;

function shouldBeEnergySaving() {
    return energyModeFlags !== EnergyMode.NONE;
}

// 🚀 v2.8.2: 新增节能模式状态机（保留旧变量向后兼容）
let oneClickEnergySaving = false;  // 🔋 一键节能：去除所有动效，保持亮度
let frameEnergySaving = false;     // 🎬 画面节能：仅降至30fps

// 偏好配置
let cfg = {
    followAccentColor: false,   // 🚀 v3.5.4: 封面取色（专辑封面取色 + 主题色逻辑；设置-外观「沉浸式外观」内开关）
    bgImmersive: false,         // 🚀 v3.5.0: 背景沉浸（专辑封面/自定义背景全屏沉浸 + 夜间半透明黑遮罩叠加）
    wcoPseudoImmersive: true,   // 🚀 v3.5.4: PWA WCO 标题栏伪沉浸（顶部取色驱动 theme-color）
    useOppoSans: false,         // 🚀 v3.5.4: 启用 OPPO Sans 3.0 跨域字体（R/M 字重）
    oppoSansWeight: 'R',        // 🚀 v3.5.4: OPPO Sans 字重 'R'=Regular / 'M'=Medium
    oppoKeepEnglish: false,     // 🚀 v3.5.4: OPPO Sans 仅替换中文字体，保留英文字体（Geist/CDN）
    customBgImg: null, customBgColor: null, blurAmt: 40,
    defaultColor: '#e8b4b8', darkMode: false, lrcFontSize: 18, lrcLineHeight: 2.2,
    lrcAlign: 'center', themePreset: null,
    // 🚀 v2.8.2: 节能配置重构
    oneClickEnergyEnabled: false,   // 一键节能开关状态
    frameEnergyEnabled: false,      // 画面节能开关状态
    pipEnergyEnabled: true,          // 临时节能开关状态
    // 🚀 v3.0.0: 震动反馈配置
    rumbleEnabled: true,             // 震动总开关
    rumbleMode: 'basscut',           // 'basscut'=去低频(默认) | 'spectrum'=频谱映射
    rumbleFloor: 0.30,               // 地板阈值
    rumbleAutoFloor: true,           // 自动地板
    rumbleThrottle: 50,              // 节流间隔 ms
    rumbleStrongGain: 2.0,           // Strong 独立增益
    rumbleWeakGain: 0.4,             // Weak 独立增益
    rumbleSwapMotors: false,         // 反转马达
    rumbleGain: 1.0,                 // 全局振幅
};
// 🚀 v2.8.2: 画中画临时节能状态标记
let pipTempEnergySaving = false; // 标记是否因画中画而进入的临时节能模式
// 🚀 v2.8.2+: Page Visibility API 优化变量
let visLoopPaused = false;
let currentAlbumColor = null, currentAlbumTopColor = null, hasCurrentAlbumArt = false;
// 🚀 v3.5.x: 专辑取色结果缓存——按文件指纹缓存，避免切歌/重载重复解码取色（CPU 优化）
const _albumColorCache = new Map();
function getAlbumColors(song, force) {
    if (!song || !song.art) return Promise.resolve({ color: null, top: null });
    const key = `${song.file.name}_${song.file.size}_${song.file.lastModified}`;
    const hit = _albumColorCache.get(key);
    if (hit && !force) return Promise.resolve(hit);
    return Promise.all([extractColor(song.art), extractTopColor(song.art, 0.2)]).then(([color, top]) => {
        const v = { color, top };
        _albumColorCache.set(key, v);
        if (_albumColorCache.size > 400) { // 简单上限：超过 400 首淘汰最旧一项，防 Map 无限增长
            const oldest = _albumColorCache.keys().next().value;
            _albumColorCache.delete(oldest);
        }
        return v;
    });
}
let favorites = new Set();
let currentViewMode = 'list';
let ctxMenuTarget = -1;

// IndexedDB
let idb = null;
const IDB_NAME = 'MBolkaPlayerDB', IDB_VERSION = 2;

// 目录句柄持久化
let directoryHandle = null;

// 播放统计
let playStats = {};

// === 预设主题色 ===
const themePresets = [
    { name: '玫瑰金', color: '#e8b4b8' },
    { name: '水母蓝', color: '#9ac8e2' },
    { name: '赛博朋克', color: '#ff00ff' },
    { name: '暖阳', color: '#ff8c42' },
    { name: '极光', color: '#00e5a0' },
    { name: '星夜', color: '#7c5cfc' },
    { name: '樱花', color: '#ff6b9d' },
    { name: '深海', color: '#00b4d8' },
    { name: '日落', color: '#ff6b35' },
    { name: '薄荷', color: '#48cae4' },
];

// === DOM 引用映射 ===
// 脚本在 body 末尾加载，DOM 已解析完成，直接初始化
// 使用 let 以便在需要时重新初始化
let el = {
    viewMain: document.getElementById('view-main'), viewImm: document.getElementById('view-immersive'),
    bgImg: document.getElementById('bg-layer-img'), bgColor: document.getElementById('bg-layer-color'),
    canvasImm: document.getElementById('immersive-bg-canvas'), canvasMain: document.getElementById('spectrumCanvasMain'),
    folderIn: document.getElementById('folderInput'), btnLoad: document.getElementById('btnLoadFolder'),
    btnPlay: document.getElementById('btnPlay'), btnPrev: document.getElementById('btnPrev'), btnNext: document.getElementById('btnNext'),
    progAreaMain: document.getElementById('main-progArea'), progFillMain: document.getElementById('main-progFill'),
    progTipMain: document.getElementById('main-progTip'),
    timeCur: document.getElementById('timeCur'), timeTot: document.getElementById('timeTot'), volSlider: document.getElementById('volSlider'),
    mainColAlbum: document.getElementById('main-col-album'), mainTitle: document.getElementById('main-songTitle'), mainArtist: document.getElementById('main-songArtist'), mainArt: document.getElementById('main-artImg'),
    artBox: document.getElementById('artBox'),
    lrcView: document.getElementById('lrcViewport'), lrcPanel: document.getElementById('lrcPanel'), btnToggleLrc: document.getElementById('btnToggleLrc'),
    toast: document.getElementById('toastMsg'), loadBar: document.getElementById('loadBar'), loadWrap: document.getElementById('loadWrap'),
    btnMode: document.getElementById('btnModeToggle'),
    padStatus: document.getElementById('gamepadStatus'), fileInfo: document.getElementById('fileInfo'),
    settingsModal: document.getElementById('settingsModal'), playlistModal: document.getElementById('playlistModal'), plContainer: document.getElementById('playlistContainer'),
    contextMenu: document.getElementById('contextMenu'),
    emptyState: document.getElementById('emptyState'),
    coverWallContainer: document.getElementById('coverWallContainer'),
    fileInfoModal: document.getElementById('fileInfoModal'), fileInfoContent: document.getElementById('fileInfoContent'),
    helpModal: document.getElementById('helpModal'),
    btnFavQuick: document.getElementById('btnFavQuick'),
    btnPipQuick: document.getElementById('btnPipQuick'),

    // 沉浸模式
    immTrackCard: document.getElementById('imm-trackCard'), immArt: document.getElementById('imm-artImg'), immTitle: document.getElementById('imm-songTitle'), immArtist: document.getElementById('imm-songArtist'),
    immLrcCenter: document.getElementById('imm-lyricsCenter'), immCurrLine: document.getElementById('imm-currLine'), immNextLine: document.getElementById('imm-nextLine'),
    immProgArea: document.getElementById('imm-progArea'), immProgFill: document.getElementById('imm-progFill'), immProgTip: document.getElementById('imm-progTip'),
    immBtnPlay: document.getElementById('imm-btnPlay'), immBtnPrev: document.getElementById('imm-btnPrev'), immBtnNext: document.getElementById('imm-btnNext'), immBtnMode: document.getElementById('imm-btnMode'),
    immExitHint: document.getElementById('immExitHint'),
};

// === 工具函数 ===
