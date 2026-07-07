/*
 * MBolka Player - Cover Library v3.5.1
 * Album/artist/recent grid views, album detail panel
 */

function showCoverLibrary() {
    closeAllModals();
    
    const modal = document.getElementById('coverLibraryModal');
    if (!modal) return;
    
    // 🚀 核心：像列表弹窗一样，通过添加 open 触发完美的 CSS 渐变与弹性放大动画
    modal.classList.add('open');
    if (typeof _pushModal === 'function') _pushModal('coverLibraryModal', null);

    // 初始化事件监听（只在第一次打开时绑定，防止重复绑定造成的内存泄露）
    if (!modal.dataset.init) {
        modal.dataset.init = "true";

        // 标签切换（🩹 v3.2.4: 80ms 防抖，避免快速点击触发多次全量渲染）
        modal.querySelectorAll('.cover-lib-tab').forEach(tab => {
            tab.onclick = () => {
                modal.querySelectorAll('.cover-lib-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                coverLibSortMode = tab.dataset.mode;
                clearTimeout(_tabSwitchTimer);
                _tabSwitchTimer = setTimeout(() => {
                    renderCoverLibGrid(modal.querySelector('#coverLibSearch').value);
                }, 80);
            };
        });

        // 搜索框输入（🚀 v3.5.0: 防抖 180ms，连续击键只触发一次全量重渲染）
        modal.querySelector('#coverLibSearch').addEventListener('input', (e) => {
            const v = e.target.value;
            clearTimeout(_coverLibSearchTimer);
            _coverLibSearchTimer = setTimeout(() => renderCoverLibGrid(v), 180);
        });

        // 关闭按钮
        modal.querySelector('#btnCloseCoverLib').onclick = closeAllModals;

        // 导入
        modal.querySelector('#btnImportPlaylist').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = (e) => {
                if (e.target.files[0]) importPlaylist(e.target.files[0]);
            };
            input.click();
        };
        
        // 允许点击遮罩层关闭
        modal.onclick = (e) => { if (e.target === modal) closeAllModals(); };

        // 🚀 v3.3.3: 鼠标滚轮切换居中唱片（仅 coverflow 模式接管；网格模式留给原生垂直滚动）
        const gridEl = modal.querySelector('#coverLibGrid');
        if (gridEl && !gridEl.dataset.wheelInit) {
            gridEl.dataset.wheelInit = 'true';
            gridEl.addEventListener('wheel', (e) => {
                if (typeof isCoverflowMode === 'function' && !isCoverflowMode()) return; // 网格模式：交给浏览器垂直滚动
                e.preventDefault();
                const dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
                if (dir !== 0 && typeof coverLibMoveCenter === 'function') coverLibMoveCenter(dir);
            }, { passive: false });
            // 🚀 v3.3.4: 拖动底部横向滚动条浏览专辑（只接管 coverflow，网格模式由 onCoverflowScroll 内部 return）
            gridEl.addEventListener('scroll', onCoverflowScroll, { passive: true });
        }
    }

    // 渲染网格
    renderCoverLibGrid();
    // 🚀 v3.3.4: 按模式刷新焦点（coverflow=仅头部居中即焦点；网格=头部+卡片纳入 2D 导航）
    setTimeout(() => {
        refreshCoverLibAfterRender();
    }, 200);
}

// 🚀 v3.3.1: 窗口化（无限滚动）渲染
//   旧实现 renderGridChunked 会把「全部专辑」一次性塞进 DOM（仅按 12/帧 限速但永不停止），
//   上千专辑时挂载数千卡片 + 数千 lazy <img> 导致主线程卡死、表现为「加载不出来」。
//   新方案：只渲染可视窗口（首屏 60 张），滚动到底部前 500px 再追加 30 张，DOM 量恒定可控。
//   分组（grouping）开销大，无搜索时缓存「分组结果 entries」复用，Tab 切换/搜索即时响应（不再缓存整个 DOM fragment）。

const _entriesCache = { album: null, artist: null, recent: null };
function invalidateGridCache() { Object.keys(_entriesCache).forEach(k => _entriesCache[k] = null); }

// 🩹 v3.2.4: Tab 防抖（保留）
let _tabSwitchTimer = null;

// 窗口化渲染状态
let _clGen = 0;              // 竞态保护：新渲染覆盖旧渲染
let _clGrid = null;          // 当前网格容器
let _clEntries = null;       // 当前全量 entries
let _clCreate = null;        // 卡片工厂
let _clRendered = 0;         // 已渲染数量
let _clScrollHandler = null;  // 挂在 grid 上的滚动监听（重建时移除）
const CL_INITIAL = 60;       // 首屏窗口
const CL_INCREMENT = 30;      // 每次滚动追加量
const CL_CHUNK = 12;          // 每帧子块（保持 60fps）

// 🚀 v3.3.3: coverflow 居中索引（当前正对屏幕中央的唱片）
let coverLibCenter = 0;

// 🚀 v3.3.3: 快速拖动防抖 —— 用户操作时暂时去掉 3D 偏移，停止后恢复
let _coverflowIsFlat = false;
let _coverflowFlatTimer = null;
// 🚀 v3.3.4: 拖动底部滚动条支持 —— 用户横向滚动后把"视觉中心"卡片设为新中心，并清除景深
let _clScrollSuppressUntil = 0;   // 程序化 scrollTo 期间抑制用户滚动重算，避免回环
let _clScrollCenterTimer = null;
// 🚀 v3.5.0: 搜索输入防抖定时器（合并连续击键，避免每字符一次全量重渲染）
let _coverLibSearchTimer = null;
// 🚀 v3.5.0: 卡片中心缓存（P0-3），松手重算时避免同步读 offsetLeft/offsetWidth 触发布局
let _cachedCardCenters = [];

function applyCoverflowFlat() {
    const grid = document.getElementById('coverLibGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.cover-lib-card');
    cards.forEach(c => {
        c.style.transform = 'none';
        c.style.opacity = '1';
        c.style.zIndex = 'auto';
        c.style.pointerEvents = '';
        c.style.filter = '';   // 🚀 v3.3.4: 操作时取消景深模糊，全部清晰
        c.classList.remove('cl-center');
    });
}

// 🩹 v3.3.4: 恢复 coverflow 滚动模式（吸附 + 平滑）。
//   连续滚动（滚轮/摇杆）期间临时关闭 snap/smooth，否则多次 scrollTo 被吸附/平滑动画互相抵消 → 封面不切（"滚动失效"）。
function restoreCoverflowScrollMode() {
    const grid = document.getElementById('coverLibGrid');
    if (grid) { grid.style.scrollSnapType = ''; grid.style.scrollBehavior = ''; }
}

/** 进入平坦模式：清空所有 3D 变换，350ms 无操作后恢复 coverflow */
function enterCoverflowFlat() {
    // 🩹 v3.3.4: 进入即关闭 grid 的吸附/平滑（与摇杆路径一致），修复滚轮连续滚动被抵消的失效问题
    const grid = document.getElementById('coverLibGrid');
    if (grid && typeof isCoverflowMode === 'function' && isCoverflowMode()) {
        grid.style.scrollSnapType = 'none';
        grid.style.scrollBehavior = 'auto';
    }
    if (_coverflowIsFlat) {
        clearTimeout(_coverflowFlatTimer);
    } else {
        _coverflowIsFlat = true;
        applyCoverflowFlat();
    }
    _coverflowFlatTimer = setTimeout(() => {
        _coverflowIsFlat = false;
        _clScrollSuppressUntil = Date.now() + 200; // 抑制 onCoverflowScroll 回环
        restoreCoverflowScrollMode();               // 恢复吸附/平滑
        updateCoverflow();
    }, 350);
}

// 🚀 v3.3.4: 曲库 coverflow 拖动底部横向滚动条浏览
//   拖动滚动条时进入平坦（清除景深模糊，全部清晰），松手后把"当前视觉中心"的卡片设为新中心并恢复 3D。
// 🚀 v3.5.0 (P0-3): 用 _cachedCardCenters 替代 offsetLeft/offsetWidth 读取，消除同步布局
function onCoverflowScroll() {
    if (typeof isCoverflowMode === 'function' && !isCoverflowMode()) return; // 网格模式不介入
    if (Date.now() < _clScrollSuppressUntil) return; // 程序化 scrollTo 不处理，避免回环
    enterCoverflowFlat(); // 拖动期间全部清晰
    clearTimeout(_clScrollCenterTimer);
    _clScrollCenterTimer = setTimeout(() => {
        const grid = document.getElementById('coverLibGrid');
        if (!grid) return;
        const cards = grid.querySelectorAll('.cover-lib-card');
        if (!cards.length) return;
        // 重建缓存（卡片数可能因窗口化渲染变化）
        if (!_cachedCardCenters.length || _cachedCardCenters.length !== cards.length) {
            _cachedCardCenters = Array.from(cards).map(c => c.offsetLeft + c.offsetWidth / 2);
        }
        // 用缓存找到距容器水平中心最近的卡片
        const mid = grid.scrollLeft + grid.clientWidth / 2;
        let best = 0, bestD = Infinity;
        for (let i = 0; i < _cachedCardCenters.length; i++) {
            const d = Math.abs(_cachedCardCenters[i] - mid);
            if (d < bestD) { bestD = d; best = i; }
        }
        coverLibCenter = best;
        clearTimeout(_coverflowFlatTimer);
        _coverflowIsFlat = false;
        _clScrollSuppressUntil = Date.now() + 500;
        updateCoverflow();
    }, 200);
}



// 🚀 v3.3.4: 当前是否处于 coverflow（按专辑）模式；艺术家/最近添加走旧版网格
function isCoverflowMode() { return coverLibSortMode === 'album'; }

// 🚀 v3.3.3: coverflow 核心 —— 根据「距中心偏移」给每张卡片注入 3D 变换，并把中心卡片滚到正中
// 🚀 v3.5.0 (P0-2): 增量 diff 更新 — 仅更新 off 发生变化的卡片，避免全量样式写入
// 🚀 v3.5.0 (P0-3): 滚动目标用 _cachedCardCenters 计算，消除 offsetLeft 触发布局
function updateCoverflow() {
    if (_coverflowIsFlat) { applyCoverflowFlat(); return; }
    const grid = document.getElementById('coverLibGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.cover-lib-card');
    if (!cards.length) return;

    // 🚀 v3.5.0: 重新计算卡片中心缓存（仅在网格变化时重建）
    if (!_cachedCardCenters.length || _cachedCardCenters.length !== cards.length) {
        _cachedCardCenters = Array.from(cards).map(c => c.offsetLeft + c.offsetWidth / 2);
    }

    cards.forEach((card, i) => {
        const off = i - coverLibCenter;
        const abs = Math.abs(off);
        const prev = parseInt(card.dataset.flowOff, 10);
        if (prev === off) return; // 🚀 v3.5.0: off 未变 → 跳过样式更新
        card.dataset.flowOff = String(off);

        const x = off * 54;
        const ry = off === 0 ? 0 : (off < 0 ? 42 : -42);
        const tz = -abs * 30;
        const scale = off === 0 ? 1 : Math.max(0.74, 1 - abs * 0.032);
        const blur = off === 0 ? 0 : Math.min(3, 1 + abs * 0.4);
        const idleOp = off === 0 ? 1 : Math.max(0.35, 1 - abs * 0.06);
        card.style.transform = `translateX(${x}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`;
        card.style.zIndex = String(200 - abs);
        card.style.opacity = String(idleOp);
        card.style.filter = off === 0 ? '' : `blur(${blur}px) brightness(0.85)`;
        card.style.pointerEvents = abs > 12 ? 'none' : '';
        card.classList.toggle('cl-center', off === 0);
    });
    // 整体横向滑动：用缓存中心计算 scrollTo 目标，避免读 offsetLeft/offsetWidth
    const cx = _cachedCardCenters[coverLibCenter];
    if (cx != null) {
        const target = cx - grid.clientWidth / 2;
        _clScrollSuppressUntil = Date.now() + 500;
        grid.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
}

// 🚀 v3.3.4: 渲染完成后统一刷新焦点上下文 / coverflow（两种模式共用）
function refreshCoverLibAfterRender() {
    if (typeof updateFocusContext === 'function') updateFocusContext();
    if (isCoverflowMode() && typeof updateCoverflow === 'function') {
        updateCoverflow();
        // 🚀 v3.3.4: coverflow 居中即焦点 —— 移除头部按钮的焦点高亮（避免误导 A 误触关闭），
        //           居中卡由 .cl-center 高亮，A 始终打开居中专辑
        const clModal = document.getElementById('coverLibraryModal');
        if (clModal) clModal.querySelectorAll('.gamepad-focus').forEach(e => e.classList.remove('gamepad-focus'));
    }
}

// 🚀 v3.3.4: 旧版网格的窗口化切片渲染（垂直网格，与 coverflow 横向前置加载解耦）
function renderGridChunked(grid, entries, createFn) {
    let i = 0;
    const CHUNK = 12;
    const gen = _clGen; // 🚀 v3.3.4: 竞态保护，快速切 Tab 时旧分块渲染中止
    function step() {
        if (gen !== _clGen) return; // 已被新渲染覆盖，中止旧分块（避免混入其它 Tab 的卡片）
        const end = Math.min(i + CHUNK, entries.length);
        const frag = document.createDocumentFragment();
        for (; i < end; i++) frag.appendChild(createFn(entries[i], i));
        if (gen !== _clGen) return;
        grid.appendChild(frag);
        if (i < entries.length) requestAnimationFrame(step);
        else if (typeof updateFocusContext === 'function') updateFocusContext(); // 全部渲染完再补一次焦点扫描
    }
    requestAnimationFrame(step);
}

// 设置居中索引（带边界钳制）。🚀 v3.3.3: 居中即焦点，不再驱动 gamepad 焦点系统
function setCoverLibCenter(idx) {
    const grid = document.getElementById('coverLibGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.cover-lib-card');
    if (!cards.length) return;
    coverLibCenter = Math.max(0, Math.min(cards.length - 1, idx));
    if (_coverflowIsFlat) {
        // 平坦模式：仅居中滚动，不设置 3D 变换
        const centerCard = cards[coverLibCenter];
        const target = centerCard.offsetLeft - (grid.clientWidth - centerCard.offsetWidth) / 2;
        _clScrollSuppressUntil = Date.now() + 500; // 🚀 v3.3.4: 同上，抑制回环
        // 🩹 v3.3.4: 用 auto 而非 smooth —— 平坦期间已临时关闭 snap/smooth，但 scrollTo 的 behavior 选项优先级高于内联样式，
        //           若写 smooth 会强制平滑动画，被后续滚轮 scrollTo 取消 → 抵消修复。auto 即时定位，连续滚轮才跟手。
        grid.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
    } else {
        updateCoverflow(); // 3D 模式：由 updateCoverflow 统一负责居中滚动
    }
}

// 🚀 v3.3.3: 返回当前居中（=事实焦点）的卡片，供确认键/手柄 A 使用
function getCoverLibCenterCard() {
    const grid = document.getElementById('coverLibGrid');
    if (!grid) return null;
    const cards = grid.querySelectorAll('.cover-lib-card');
    return cards[coverLibCenter] || null;
}

// 手柄左摇杆 / 方向键 / 滚轮 调用 —— 相对移动居中索引
function coverLibMoveCenter(dir) {
    enterCoverflowFlat(); // 进入平坦模式，防抖 350ms 后恢复 3D
    setCoverLibCenter(coverLibCenter + dir);
}

// 把"封面点击"统一为：点中心=打开，点非中心=先居中
function attachCoverCardClick(card, idx, openAction) {
    card.dataset.index = idx;
    card.onclick = () => {
        const ci = parseInt(card.dataset.index, 10);
        if (ci === coverLibCenter) openAction();
        else { enterCoverflowFlat(); setCoverLibCenter(ci); }
    };
}

// 🚀 v3.3.3: 曲库已「取消卡片焦点」——居中即焦点，不再由 gamepad 焦点系统反向驱动 coverflow。
// 上方 getCoverLibCenterCard() 是确认/激活的唯一入口。

// ---- 分组构建（纯数据，开销大，结果可缓存）----
function buildAlbumEntries(filter) {
    const groups = new Map();
    musicLibrary.forEach((s, i) => {
        const key = s.art || '__noart__';
        if (!groups.has(key)) groups.set(key, { art: s.art || null, album: s.album || '未知专辑', artist: s.artist, songs: [], firstIdx: i });
        groups.get(key).songs.push(i);
    });
    let entries = [...groups.entries()];
    if (filter) {
        const q = filter.toLowerCase();
        entries = entries.filter(([k, g]) => g.album.toLowerCase().includes(q) || g.artist.toLowerCase().includes(q));
    }
    entries.sort((a, b) => b[1].songs.length - a[1].songs.length);
    return entries;
}

function buildArtistEntries(filter) {
    const groups = new Map();
    musicLibrary.forEach((s, i) => {
        const key = s.artist;
        if (!groups.has(key)) groups.set(key, { artist: s.artist, art: s.art || null, songs: [], firstIdx: i });
        groups.get(key).songs.push(i);
    });
    let entries = [...groups.entries()];
    if (filter) {
        const q = filter.toLowerCase();
        entries = entries.filter(([k, g]) => k.toLowerCase().includes(q));
    }
    entries.sort((a, b) => b[1].songs.length - a[1].songs.length);
    return entries;
}

function buildRecentEntries(filter) {
    let entries = musicLibrary.map((s, i) => ({
        art: s.art, album: s.album || '未知', artist: s.artist,
        title: s.title, songs: [i], firstIdx: i, isSingle: true
    }));
    if (filter) {
        const q = filter.toLowerCase();
        entries = entries.filter(e => e.title.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q));
    }
    entries = entries.slice(-50).reverse();
    return entries;
}

// ---- 窗口化渲染核心 ----
function windowedRender(grid, entries, createFn) {
    // 清理上一次渲染的滚动监听
    if (_clScrollHandler && _clGrid) _clGrid.removeEventListener('scroll', _clScrollHandler);
    _clGrid = grid;
    _clEntries = entries;
    _clCreate = createFn;
    _clRendered = 0;
    _clScrollHandler = () => {
        const g = _clGrid;
        if (!g || !_clEntries || _clRendered >= _clEntries.length) return;
        // 🚀 v3.3.3: 横向 coverflow —— 距右侧 600px 内即预加载下一屏
        if (g.scrollLeft + g.clientWidth > g.scrollWidth - 600) renderCoverLibMore(CL_INCREMENT);
    };
    grid.addEventListener('scroll', _clScrollHandler);
    renderCoverLibMore(CL_INITIAL);
}

function renderCoverLibMore(count) {
    const g = _clGrid;
    if (!g || !_clEntries || !_clCreate) return;
    const gen = _clGen;
    let i = _clRendered;
    const end = Math.min(i + count, _clEntries.length);
    function step() {
        if (gen !== _clGen || !_clGrid) return; // 已被新渲染覆盖，中止
        const fragment = document.createDocumentFragment();
        const stop = Math.min(i + CL_CHUNK, end);
        for (; i < stop; i++) fragment.appendChild(_clCreate(_clEntries[i], i));
        g.appendChild(fragment);
        if (typeof updateCoverflow === 'function') updateCoverflow();
        if (i < end) {
            requestAnimationFrame(step);
        } else {
            _clRendered = end;
            if (_clScrollHandler && _clRendered >= _clEntries.length) {
                // 全部渲染完则卸掉滚动监听，避免空跑
                g.removeEventListener('scroll', _clScrollHandler);
            } else if (g.scrollWidth <= g.clientWidth) {
                // 🚀 安全网：初始窗口未撑出横向滚动条时（大屏），继续追加直到出现滚动或渲染完毕
                renderCoverLibMore(CL_INCREMENT);
            }
        }
    }
    requestAnimationFrame(step);
}

function renderCoverLibGrid(filter = '') {
    const modal = document.getElementById('coverLibraryModal');
    if (!modal) return;
    const grid = modal.querySelector('#coverLibGrid');
    if (!grid) return;
    _clGen++; // 🚀 v3.3.4: 竞态保护 —— 每次渲染增代，使旧的分块/窗口渲染中止（修复频繁切 Tab 残留错乱）
    grid.innerHTML = '';
    coverLibCenter = 0; // 🚀 v3.3.3: 每次重渲染重置居中索引

    // 🚀 无搜索时复用已分组 entries（省去全库分组开销，O(1) 取缓存）
    let entries;
    if (coverLibSortMode === 'artist') {
        entries = filter ? buildArtistEntries(filter) : (_entriesCache.artist || (_entriesCache.artist = buildArtistEntries('')));
    } else if (coverLibSortMode === 'recent') {
        entries = filter ? buildRecentEntries(filter) : (_entriesCache.recent || (_entriesCache.recent = buildRecentEntries('')));
    } else {
        entries = filter ? buildAlbumEntries(filter) : (_entriesCache.album || (_entriesCache.album = buildAlbumEntries('')));
    }

    if (coverLibSortMode === 'album') {
        // 🚀 按专辑：单行 coverflow（居中即焦点）
        grid.classList.add('is-coverflow');
        grid.classList.remove('is-grid');
        const createFn = ([key, group], idx) => {
            const card = createCoverCard(group, idx, 'album');
            attachCoverCardClick(card, idx, () => showAlbumDetail(group, modal));
            return card;
        };
        windowedRender(grid, entries, createFn);
    } else {
        // 🚀 v3.3.4: 按艺术家 / 最近添加 —— 回溯旧版网格布局（带手柄 2D 导航）
        grid.classList.add('is-grid');
        grid.classList.remove('is-coverflow');
        let createFn;
        if (coverLibSortMode === 'artist') {
            createFn = ([key, group], idx) => {
                const card = createCoverCard(group, idx, 'artist');
                card.onclick = () => { playAudio(group.firstIdx); modal.remove(); };
                return card;
            };
        } else { // recent
            createFn = (group, idx) => {
                const card = document.createElement('div');
                card.className = 'cover-lib-card focusable';
                card.tabIndex = 0;
                card.innerHTML = `
                    <div class="art-wrap">
                        ${group.art ? `<img src="${group.art}" loading="lazy">` : '<div style="width:100%;height:100%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:32px;"><svg class="ui-ico" style="width:40px;height:40px;opacity:0.35;margin:0;"><use href="#icon-music"/></svg></div>'}
                    </div>
                    <div class="album-name">${(group.title || '').length > 12 ? (group.title||'').slice(0,11)+'…' : (group.title||'')}</div>
                    <div class="album-meta">${group.artist}</div>
                `;
                card.onclick = () => { playAudio(group.firstIdx); modal.remove(); };
                return card;
            };
        }
        renderGridChunked(grid, entries, createFn);
        // 🚀 网格分块渲染，末尾补一次焦点扫描（renderGridChunked 完成时会再调一次）
        setTimeout(() => { if (typeof updateFocusContext === 'function') updateFocusContext(); }, 220);
    }
}

function createCoverCard(group, idx, type) {
    const card = document.createElement('div');
    // 🚀 核心修改：加上 focusable 类名与 tabIndex，支持手柄/键盘焦点导航
    card.className = 'cover-lib-card focusable';
    card.tabIndex = 0;
    if (type === 'artist') card.classList.add('artist-card');

    const albumName = type === 'artist' ? group.artist : (group.album || '未知专辑');
    const metaText = type === 'artist' ? `${group.songs.length}首` : `${group.artist} · ${group.songs.length}首`;

    card.innerHTML = `
        <div class="art-wrap">
            ${group.art ? `<img src="${group.art}" loading="lazy">` : '<div style="width:100%;height:100%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:36px;"><svg class="ui-ico" style="width:44px;height:44px;opacity:0.35;margin:0;"><use href="#icon-music"/></svg></div>'}
            <div class="vinyl-slip"></div>
            <div class="play-all-btn">${iconSvg('play')}</div>
        </div>
        ${group.songs.length > 1 ? `<span class="song-count-badge">${group.songs.length}</span>` : ''}
        <div class="album-name" title="${escapeHTML(albumName)}">${albumName.length > 14 ? albumName.slice(0,13)+'…' : albumName}</div>
        <div class="album-meta">${metaText}</div>
    `;
    return card;
}

// 专辑详情面板 (🚀 v2.3.2 完美手柄适配版)
function showAlbumDetail(group, parentModal) {
    const detailModal = document.createElement('div');
    // 🔧 v2.8.1 P2: 不立即添加 open 类，使用双重 rAF 确保 CSS 动画触发
    // 🩹 v3.2.3: 添加固定 ID 以便 handleGlobalClose 通过 document.getElementById 查找到
    detailModal.className = 'modal-overlay';
    detailModal.id = 'albumDetailOverlay';
    detailModal.style.zIndex = '1001';

    // 🚀 核心改动 1：为操作按钮加上 focusable 类名与 tabindex="0"
    detailModal.innerHTML = `
        <div class="album-detail-panel">
            <div class="album-detail-header">
                <div class="album-detail-cover">
                    ${group.art ? `<img src="${group.art}">` : '<div style="width:100%;height:100%;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:64px;"><svg class="ui-ico" style="width:64px;height:64px;opacity:0.35;margin:0;"><use href="#icon-music"/></svg></div>'}
                </div>
                <div class="album-detail-info">
                    <div class="album-detail-name">${escapeHTML(group.album || '未知专辑')}</div>
                    <div class="album-detail-artist">${escapeHTML(group.artist)}</div>
                    <div class="album-detail-meta">共 ${group.songs.length} 首歌曲</div>
                    <div class="album-detail-actions">
                        <button class="btn-glass focusable" id="btnPlayAlbum" style="background:var(--primary);color:var(--text-on-primary);border:none;" tabindex="0">${iconSvg('play')} 播放整张专辑</button>
                        <button class="btn-glass focusable" id="btnCloseAlbumDetail" tabindex="0">关闭</button>
                    </div>
                </div>
            </div>
            <div class="album-detail-tracks" id="albumDetailTracks"></div>
        </div>
    `;
    document.body.appendChild(detailModal);

    // 🚀 v3.2.2: 推入 Modal 栈，确保 B 键/ESC 优先关闭详情
    // 🩹 v3.2.3: 使用实际 DOM id 以便 handleGlobalClose 能查找到
    if (typeof _pushModal === 'function') _pushModal('albumDetailOverlay', null);

    // 🔧 v2.8.1 P2: 使用双重 requestAnimationFrame 确保浏览器渲染初始状态后再触发动画
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            detailModal.classList.add('open');
        });
    });

    // 🚀 核心改动 2：立即更新焦点上下文，让手柄焦点瞬间"吸附"进入详情弹窗中
    // 🩹 v3.2.3: 早期焦点更新在曲目渲染后会被 setTimeout 覆盖，保留此行作为快速初始定位

    // 渲染曲目列表
    const tracksEl = detailModal.querySelector('#albumDetailTracks');
    group.songs.forEach((songIdx, trackNum) => {
        const s = musicLibrary[songIdx]; // 从全库取数
        const track = document.createElement('div');
        
        // 🚀 核心改动 3：为每一行歌曲注入 focusable 与 tabIndex
        track.className = `album-detail-track focusable${songIdx === currentIndex ? ' active' : ''}`;
        track.tabIndex = 0;
        
        track.innerHTML = `
            <span class="track-num">${trackNum + 1}</span>
            <span class="track-title">${escapeHTML(s.title)}</span>
            <span class="track-dur">${s.artist}</span>
        `;
        
        // 鼠标/手柄确认点击播放
        track.onclick = () => {
            // 🔧 v2.8.4: 使用 closeAllModals 替代直接 remove
            playAudio(songIdx);
            closeAllModals();
        };
        tracksEl.appendChild(track);
    });

    // 🩹 v3.2.3: 等曲目标题和 DOM 全部渲染完成后再更新焦点上下文，确保手柄能识别到细节面板所有元素
    setTimeout(() => updateFocusContext(), 100);

    // 播放整张专辑
    detailModal.querySelector('#btnPlayAlbum').onclick = () => {
        const albumQueue = group.songs.map(idx => musicLibrary[idx]);
        playlist = albumQueue;
        currentIndex = 0;
        isShuffle = false; 
        isRepeatOne = false;
        updateModeUI(); 
        saveSettings();
        // 🔧 v2.8.4: 使用 safeTransition 优雅关闭弹窗再播放
        safeTransition(() => {
            playAudio(0);
            renderPlaylist();
        });
        showToast(`正在播放专辑: ${group.album || '未知'}`, iconSvg('music'));
    };

    // 关闭详情（🚀 核心改动 4：关闭时，必须重新扫描，让焦点优雅退回到曲库面板中）
    const closeDetail = () => {
        detailModal.classList.remove('open');
        // 🚀 v3.2.2: 从 Modal 栈中弹出
        if (typeof _popModal === 'function') _popModal();
        setTimeout(() => {
            if (detailModal.parentNode) {
                detailModal.remove();
            }
            // 🔧 v2.8.4: 确保父弹窗恢复焦点上下文
            if (parentModal && parentModal.classList.contains('open')) {
                updateFocusContext();
            }
        }, 400);
    };
    detailModal.querySelector('#btnCloseAlbumDetail').onclick = closeDetail;
    
    detailModal.onclick = (e) => { 
        if (e.target === detailModal) closeDetail();
    };
}

// === 全域焦点控制系统 ===
let focusableElements = [];
let currentFocusIndex = -1;
let lastNavTime = 0;

