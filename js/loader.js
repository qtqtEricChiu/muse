/*
 * MBolka Player - File Loader v3.6.3
 * Metadata parsing, playlist rendering, cover wall, file processing, drag-drop, CUE parsing
 */

// v3.0.3: 从 File 中单独提取封面，不存 IDB，按需调用（🚀 v3.5.x: 提取后立即降采样压内存）
const extractArtOnly = (file) => {
    if (!window.jsmediatags) return Promise.resolve(null);
    return new Promise(resolve => {
        jsmediatags.read(file, {
            onSuccess: tag => {
                if (tag.tags.picture) {
                    let b64 = '';
                    const d = tag.tags.picture.data;
                    for (let i = 0; i < d.length; i++) b64 += String.fromCharCode(d[i]);
                    const raw = `data:${tag.tags.picture.format};base64,${window.btoa(b64)}`;
                    downscaleArt(raw).then(resolve).catch(() => resolve(raw));
                } else { resolve(null); }
            },
            onError: () => resolve(null)
        });
    });
};

// 🚀 v3.5.0 (P1-3): 元数据解析 Worker 实例（惰性创建）
let _metaWorker = null;
const _pendingMeta = new Map();
const WORKER_PARSE_TIMEOUT = 8000; // 8s 超时 → 回退到内联解析

function _initMetaWorker() {
    if (_metaWorker) return true;
    try {
        // Worker 不支持 file:// 协议，仅在线 / localhost 下工作
        if (location.protocol === 'file:') return false;
        _metaWorker = new Worker('js/meta-worker.js');
        _metaWorker.onmessage = (e) => {
            const { key, error, title, artist, album, art, lrcText } = e.data;
            const pending = _pendingMeta.get(key);
            if (pending) {
                clearTimeout(pending.timeout);
                _pendingMeta.delete(key);
                pending.resolve({ title, artist, album, art, lrcText, error });
            }
        };
        _metaWorker.onerror = () => { _metaWorker = null; };
        return true;
    } catch (_e) { return false; }
}

// 🚀 v3.5.x: Blob URL 复用池 —— 同一文件只持有 1 个 URL，避免每次解析都重新 mint 并累积泄漏
const _blobUrlMap = new Map();
function getBlobUrl(file) {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    const existing = _blobUrlMap.get(key);
    if (existing) return existing;                 // 复用既有 URL
    const url = URL.createObjectURL(file);
    _blobUrlMap.set(key, url);
    if (!loadedUrls.includes(url)) loadedUrls.push(url);
    return url;
}

// 🚀 v3.5.x: 封面降采样（统一入口）——把任意分辨率的封面 data URL 压到 ≤320px JPEG，
// 内存占用下降 10-20×，UI 观感无损（封面展示 ≤200px）。
const downscaleArt = (src) => {
    if (!src) return Promise.resolve(null);
    if (src.startsWith('data:image/svg')) return Promise.resolve(src);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 320;
            const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
            if (!w || !h) return resolve(src);
            if (Math.max(w, h) <= MAX && src.startsWith('data:image/jpeg')) return resolve(src); // 已足够小且为 jpeg，跳过
            const scale = Math.min(1, MAX / Math.max(w, h));
            const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
            const cvs = document.createElement('canvas');
            cvs.width = tw; cvs.height = th;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0, tw, th);
            let out;
            try { out = cvs.toDataURL('image/jpeg', 0.82); } catch (e) { out = src; }
            resolve(out);
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
};

// 🚀 v3.5.x: 封面 art LRU 缓存层
//   目标：不再让「整个歌单每首」都常驻一份 data URL（几百~上千首 → 数十 MB），
//   而是只常驻最近使用上限内的封面；超出则把 song.art 置空（数据 URL 由 GC 回收），
//   需要时经 ensureArt() 从文件懒重新提取。内存被钉死在 ~150×~50KB ≈ 7.5MB。
const ART_LRU_CAP = 150;                 // 常驻封面上限
const _artStore = new Map();            // key(文件指纹) -> { art, seq, song }
const _artExtracting = new Map();        // key → Promise<art>（正在提取中的指纹；后来者 await 同一 Promise 而非返回 null，防重渲染竞态导致永久占位）
let _artSeq = 0;
function artKeyOf(song) {
    if (!song || !song.file) return null;
    return `${song.file.name}_${song.file.size}_${song.file.lastModified}`;
}
// 写入缓存并同步到 song.art（所有解析路径统一走这里，取代直接 meta.art = art）
function cacheArt(song, art) {
    const k = artKeyOf(song);
    if (!k || !art) return;
    _artStore.set(k, { art, seq: ++_artSeq, song });
    song.art = art;
    if (_artStore.size > ART_LRU_CAP * 1.4) evictArt();
}
// 淘汰最久未使用的，直到回到上限。被淘汰的 song.art 置空（数据 URL 由 GC 回收），store 项删除。
function evictArt() {
    if (_artStore.size <= ART_LRU_CAP) return;
    // 🚀 v3.5.x: 硬保护当前播放歌曲封面——即便 seq 最旧也不驱逐，
    //   避免播放中封面被挤出后需重新提取（playAudio 虽有 ensureArt 兜底，但硬保护更稳、零延迟）。
    const protect = new Set();
    if (typeof playlist !== 'undefined' && typeof currentIndex !== 'undefined' && playlist[currentIndex]) {
        const pk = artKeyOf(playlist[currentIndex]);
        if (pk) protect.add(pk);
    }
    const arr = [];
    for (const [k, e] of _artStore) arr.push([k, e.seq]);
    arr.sort((a, b) => a[1] - b[1]);       // 最旧在前
    const remove = _artStore.size - ART_LRU_CAP;
    let i = 0, removed = 0;
    while (i < arr.length && removed < remove) {
        const k = arr[i][0];
        if (protect.has(k)) { i++; continue; }  // 受保护，跳过
        const e = _artStore.get(k);
        if (e && e.song) e.song.art = null; // 仅清引用，不持数据 URL
        _artStore.delete(k);
        removed++; i++;
    }
}
// 标记热（最近使用），防止被淘汰
function touchArt(song) {
    const k = artKeyOf(song);
    if (!k) return;
    const e = _artStore.get(k);
    if (e) e.seq = ++_artSeq;
}
// 确保 song.art 可用：命中缓存/已在 song 上直接返回；否则从文件懒提取并回填。
// 可安全高频调用：song.art 命中即同步返回；提取中用 _artExtracting 共享 Promise，
//   并发调用同文件的 ensureArt 会 await 同一提取而非返回 null，避免重渲染竞态导致永久占位。
async function ensureArt(song) {
    if (!song) return null;
    if (song.art) { touchArt(song); return song.art; }
    const k = artKeyOf(song);
    if (!k) return null;
    const e = _artStore.get(k);
    if (e) { e.seq = ++_artSeq; song.art = e.art; return e.art; }
    // 🚀 v3.5.x fix: 改用 Promise 共享而非 _artLoading 布尔去重——
    //   重渲染时旧卡片被移除、新卡片调 ensureArt 可 await 同一提取，不会返回 null 后永远占位。
    if (_artExtracting.has(k)) {
        const art = await _artExtracting.get(k);
        if (art) { song.art = art; touchArt(song); }
        return art;
    }
    if (!window.jsmediatags || !song.file) return null;
    const p = (async () => {
        const raw = await extractArtOnly(song.file);
        const art = raw ? await downscaleArt(raw) : null;
        if (art) cacheArt(song, art);
        return art;
    })();
    _artExtracting.set(k, p);
    try {
        return await p;
    } finally {
        _artExtracting.delete(k);
    }
}

const parseMetadata = async (file) => {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    const cached = await getCachedMetadata(key);
    if (cached) {
        const url = getBlobUrl(file);
        const result = { ...cached, url, file, error: false };
        if (result.art) {
            // 🚀 v3.5.x: 旧缓存可能存的是全分辨率封面 → 统一降采样后再用，立即压低内存
            return downscaleArt(result.art).then(art => { if (art) cacheArt(result, art); return result; });
        }
        if (window.jsmediatags) {
            return extractArtOnly(file).then(art => { if (art) cacheArt(result, art); return result; }).catch(() => result);
        }
        return result;
    }

    // 尝试 Worker 解析（惰性创建，仅在线协议）
    if (_initMetaWorker()) {
        return new Promise(resolve => {
            const url = getBlobUrl(file);
            const meta = { title: file.name.replace(/\.[^/.]+$/, ""), artist: "未知", album: "", url, file, error: false, lrcText: null };
            const timeout = setTimeout(() => {
                // Worker 超时 → 回退到内联解析
                _pendingMeta.delete(key);
                _parseInline(file, key, meta, resolve);
            }, WORKER_PARSE_TIMEOUT);
            _pendingMeta.set(key, { resolve: async (parsed) => {
                if (parsed.title) meta.title = parsed.title;
                if (parsed.artist) meta.artist = parsed.artist;
                if (parsed.album) meta.album = parsed.album;
                if (parsed.lrcText) meta.lrcText = parsed.lrcText;
                if (parsed.art) {
                    const a = await downscaleArt(parsed.art);
                    if (a) cacheArt(meta, a);
                }
                if (!parsed.art && window.jsmediatags) {
                    extractArtOnly(file).then(art => {
                        if (art) cacheArt(meta, art);
                        _finalizeMeta(meta, key, resolve);
                    }).catch(() => _finalizeMeta(meta, key, resolve));
                } else {
                    _finalizeMeta(meta, key, resolve);
                }
            }, timeout });
            try {
                _metaWorker.postMessage({ key, file });
            } catch (_e) {
                clearTimeout(timeout);
                _pendingMeta.delete(key);
                _parseInline(file, key, meta, resolve);
            }
        });
    }

    // Worker 不可达 → 内联解析
    return _parseInlineFallback(file, key);
};

// 内联解析（回退路径）
function _parseInline(file, key, meta, resolve) {
    if (window.jsmediatags) {
        jsmediatags.read(file, {
            onSuccess: async (tag) => {
                if(tag.tags.title) meta.title = decodeText(tag.tags.title);
                if(tag.tags.artist) meta.artist = decodeText(tag.tags.artist);
                if(tag.tags.album) meta.album = decodeText(tag.tags.album);
                if(tag.tags.lyrics) meta.lrcText = decodeText(tag.tags.lyrics.lyrics || tag.tags.lyrics);
                if(tag.tags.picture) {
                    const d = tag.tags.picture.data;
                    let b64 = '';
                    for(let i=0; i<d.length; i++) b64 += String.fromCharCode(d[i]);
                    const raw = `data:${tag.tags.picture.format};base64,${window.btoa(b64)}`;
                    const a = await downscaleArt(raw);
                    cacheArt(meta, a || raw);
                }
                _finalizeMeta(meta, key, resolve);
            },
            onError: () => _finalizeMeta(meta, key, resolve)
        });
    } else {
        _finalizeMeta(meta, key, resolve);
    }
}

function _parseInlineFallback(file, key) {
    return new Promise(resolve => {
        const url = getBlobUrl(file);
        const meta = { title: file.name.replace(/\.[^/.]+$/, ""), artist: "未知", album: "", url, file, error: false, lrcText: null };
        _parseInline(file, key, meta, resolve);
    });
}

function _finalizeMeta(meta, key, resolve) {
    const { art: _a, file: _f, url: _u, ...metaForCache } = meta;
    cacheMetadata(key, metaForCache);
    resolve(meta);
}

// 🩹 v3.2.3 P8: 复用单个拖拽插入线元素，避免每帧 create/remove
let _dragInsertLine = null;
function _getInsertLine() {
    if (!_dragInsertLine) {
        _dragInsertLine = document.createElement('div');
        _dragInsertLine.className = 'drag-insert-line';
        el.plContainer.appendChild(_dragInsertLine);
    }
    return _dragInsertLine;
}

// 🚀 v3.5.0 (P1-2): 分块构建单个 pl-item DOM（供 renderPlaylist 同步 + rAF 分块复用）
function _createPlItem(s, i) {
    const div = document.createElement('div');
    const isFav = favorites.has(s.file.name);
    let classes = 'pl-item focusable';
    if (i === currentIndex) classes += ' active';
    if (s.error) classes += ' error';
    div.className = classes;
    div.draggable = true;
    div.dataset.index = i;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'pl-title';
    titleSpan.textContent = s.title;
    div.appendChild(titleSpan);

    const artistSpan = document.createElement('span');
    artistSpan.style.cssText = 'font-size:12px;opacity:0.6;';
    artistSpan.textContent = s.artist;
    div.appendChild(artistSpan);

    const favBtn = document.createElement('span');
    favBtn.className = `favorite-btn ${isFav ? 'faved' : ''}`;
    favBtn.dataset.idx = i;
    favBtn.title = '收藏';
    favBtn.innerHTML = iconSvg(isFav ? 'heart-filled' : 'heart');
    div.appendChild(favBtn);

    // 拖拽事件
    div.ondragstart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i.toString());
        div.classList.add('dragging');
        const line = _getInsertLine();
        line.classList.remove('show');
    };
    div.ondragend = () => {
        div.classList.remove('dragging');
        document.querySelectorAll('.pl-item').forEach(d => d.classList.remove('drag-over'));
        const line = _getInsertLine();
        line.classList.remove('show');
    };
    div.ondragover = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const line = _getInsertLine();
        const containerRect = el.plContainer.getBoundingClientRect();
        if (e.clientY < midY) {
            line.style.top = (rect.top - containerRect.top + el.plContainer.scrollTop - 2) + 'px';
        } else {
            line.style.top = (rect.bottom - containerRect.top + el.plContainer.scrollTop - 1) + 'px';
        }
        line.style.left = '10px';
        line.style.right = '10px';
        el.plContainer.style.position = 'relative';
        line.classList.add('show');
    };
    div.ondragleave = (e) => {
        if (!div.contains(e.relatedTarget)) {
            const line = _getInsertLine();
            line.classList.remove('show');
        }
    };
    div.ondrop = (e) => {
        e.preventDefault();
        const line = _getInsertLine();
        line.classList.remove('show');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        let toIdx = i;
        if (e.clientY >= midY && fromIdx < i) toIdx++;
        if (e.clientY < midY && fromIdx > i) toIdx--;

        if (fromIdx !== toIdx && toIdx >= 0 && toIdx <= playlist.length) {
            const [moved] = playlist.splice(fromIdx, 1);
            playlist.splice(toIdx, 0, moved);
            if (currentIndex === fromIdx) currentIndex = toIdx;
            else if (currentIndex > fromIdx && currentIndex <= toIdx) currentIndex--;
            else if (currentIndex < fromIdx && currentIndex >= toIdx) currentIndex++;
            renderPlaylist();
            showToast("播放列表已重排", iconSvg('clipboard'));
        }
        div.classList.remove('drag-over');
    };
    return div;
}

const renderPlaylist = () => {
    if (currentViewMode === 'coverwall') {
        renderCoverWall();
        return;
    }
    document.getElementById('playlistModalTitle').textContent = '播放列表';
    el.coverWallContainer.style.display = 'none';
    el.plContainer.style.display = 'flex';

    el.plContainer.innerHTML = '';
    const total = playlist.length;

    // 🚀 v3.5.0 (P1-2): 分块渲染——前 200 首同步挂载，后续通过 rAF 分 100/批追加
    const INITIAL_BATCH = 200;
    const RM_BATCH = 100;
    const fragment = document.createDocumentFragment();
    const done = Math.min(INITIAL_BATCH, total);
    for (let i = 0; i < done; i++) fragment.appendChild(_createPlItem(playlist[i], i));
    el.plContainer.appendChild(fragment);

    if (total > INITIAL_BATCH) {
        let ci = INITIAL_BATCH;
        function batchStep() {
            if (ci >= total) { finishRender(); return; }
            const frag = document.createDocumentFragment();
            const end = Math.min(ci + RM_BATCH, total);
            for (; ci < end; ci++) frag.appendChild(_createPlItem(playlist[ci], ci));
            el.plContainer.appendChild(frag);
            requestAnimationFrame(batchStep);
        }
        requestAnimationFrame(batchStep);
    } else {
        finishRender();
    }

    function finishRender() {
        updateFocusContext();
        const activeItem = el.plContainer.querySelector('.active');
        if (activeItem && el.playlistModal && el.playlistModal.classList.contains('open')) {
            activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
};

// 曲库渲染 - 按专辑/封面聚合
function renderCoverWall() {
    el.plContainer.style.display = 'none';
    el.coverWallContainer.style.display = 'flex';
    el.coverWallContainer.innerHTML = '';
    document.getElementById('playlistModalTitle').textContent = '曲库';

    const groups = new Map();
    playlist.forEach((s, i) => {
        const key = s.art || '__noart__';
        if (!groups.has(key)) {
            groups.set(key, { art: s.art || null, songs: [], firstIdx: i });
        }
        groups.get(key).songs.push(i);
    });

    const sorted = [...groups.entries()].sort((a, b) => b[1].songs.length - a[1].songs.length);

    sorted.forEach(([key, group]) => {
        const container = document.createElement('div');
        const firstSong = playlist[group.firstIdx];
        const hasActive = group.songs.includes(currentIndex);
        container.className = `cover-album-group focusable ${hasActive ? 'active' : ''}`;
        container.tabIndex = 0;

        const artDiv = document.createElement('div');
        artDiv.className = 'cover-album-art';

        if (group.art) {
            const img = document.createElement('img');
            img.src = group.art;
            artDiv.appendChild(img);
        } else {
            const noArt = document.createElement('div');
            noArt.className = 'cw-no-art';
            // 🚀 v3.4.x: SVG 音乐图标替换 emoji
            noArt.innerHTML = '<svg class="ui-ico" style="width:40px;height:40px;opacity:0.35;margin:0;"><use href="#icon-music"/></svg>';
            artDiv.appendChild(noArt);
        }

        if (group.songs.length > 1) {
            const count = document.createElement('div');
            count.className = 'cover-album-count';
            count.textContent = group.songs.length;
            artDiv.appendChild(count);
        }

        const info = document.createElement('div');
        info.className = 'cover-album-info';
        const albumName = group.art ? (firstSong.album || firstSong.title) : '无封面';
        const nameEl = document.createElement('div');
        nameEl.className = 'cover-album-name';
        nameEl.textContent = albumName.length > 15 ? albumName.slice(0,14)+'…' : albumName;
        const artistEl = document.createElement('div');
        artistEl.className = 'cover-album-artist';
        artistEl.textContent = `${group.songs.length} 首 · ${firstSong.artist}`;

        info.appendChild(nameEl);
        info.appendChild(artistEl);

        container.appendChild(artDiv);
        container.appendChild(info);

        container.onclick = () => {
            playAudio(group.firstIdx);
            closeAllModals();
        };
        container.oncontextmenu = (e) => {
            e.preventDefault();
            if (group.songs.length === 1) {
                ctxMenuTarget = group.firstIdx;
                showContextMenu(e.clientX, e.clientY);
            }
        };

        el.coverWallContainer.appendChild(container);
    });

    updateFocusContext();
}

// === 右键菜单 ===
function showContextMenu(x, y) {
    el.contextMenu.style.left = `${x}px`;
    el.contextMenu.style.top = `${y}px`;
    el.contextMenu.classList.add('show');
}
function hideContextMenu() {
    el.contextMenu.classList.remove('show');
}

el.contextMenu.addEventListener('click', (e) => {
    const action = (e.target && e.target.closest ? e.target.closest('.ctx-item')?.dataset.action : null);
    if (!action) return;
    hideContextMenu();
    switch(action) {
        case 'play':
            if (ctxMenuTarget >= 0) playAudio(ctxMenuTarget);
            break;
        case 'info':
            if (ctxMenuTarget >= 0) showFileInfo(ctxMenuTarget);
            break;
        case 'favorite':
            if (ctxMenuTarget >= 0) toggleFavorite(ctxMenuTarget);
            break;
        case 'remove':
            if (ctxMenuTarget >= 0) removeFromPlaylist(ctxMenuTarget);
            break;
        case 'clear':
            clearPlaylist();
            break;
    }
});

document.addEventListener('click', (e) => {
    if (!el.contextMenu.contains(e.target)) hideContextMenu();
});

function showFileInfo(idx) {
    const song = playlist[idx];
    if (!song) return;
    const file = song.file;
    const info = `
        <div><b>标题:</b> ${song.title}</div>
        <div><b>艺术家:</b> ${song.artist}</div>
        ${song.album ? `<div><b>专辑:</b> ${song.album}</div>` : ''}
        <div><b>文件名:</b> ${file.name}</div>
        <div><b>文件大小:</b> ${(file.size / 1048576).toFixed(2)} MB</div>
        <div><b>格式:</b> ${file.name.split('.').pop().toUpperCase()}</div>
        <div><b>时长:</b> ${audio.duration ? formatTime(audio.duration) : '未知'}</div>
        <div><b>有封面:</b> ${song.art ? '是' : '否'}</div>
        <div><b>收藏:</b> ${favorites.has(file.name) ? iconSvg('heart-filled') + ' 已收藏' : '否'}</div>
    `;
    el.fileInfoContent.innerHTML = info;
    el.fileInfoModal.classList.add('open');
    if (typeof _pushModal === 'function') _pushModal('fileInfoModal', null);
    updateFocusContext();
}

function removeFromPlaylist(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    const song = playlist[idx];
    playlist.splice(idx, 1);
    if (idx === currentIndex) {
        currentIndex = -1;
        if (playlist.length > 0) playAudio(0);
    } else if (idx < currentIndex) {
        currentIndex--;
    }
    renderPlaylist();
    showToast(`已移除: ${song.title}`, iconSvg('trash'));
}

function clearPlaylist() {
    playlist = [];
    currentIndex = -1;
    audio.pause();
    setPlayState(false);
    // 🔥 v3.6.2: 不再执行 audio.src='' —— 该操作会令 slot A 的 MediaElementSourceNode
    // 在 Chrome 中失联，且 cfEnsureContext 因 audioCtx_cf 已存在而不会重建，
    // 导致后续交叉淡变 slot A 被动槽无声（硬切）。保留 src，仅重置交叉淡变状态。
    if (typeof cfActive !== 'undefined') {
        cfActive = 'A';
        cfAirLocked = false;
        cfState = CfState.IDLE;
        ++cfTransitionId;
        if (cfRafId) { cancelAnimationFrame(cfRafId); cfRafId = null; }
        if (cfPreloadTimer) { clearTimeout(cfPreloadTimer); cfPreloadTimer = null; }
    }
    el.mainTitle.textContent = 'MBolka Player Ultimate';
    el.mainArtist.textContent = '等待载入音乐...';
    document.title = 'MBolka Player - Ultimate Nexus v3.6.3';
    renderPlaylist();
    updateEmptyState();
    showToast("播放列表已清空", iconSvg('ban'));
}

function toggleFavorite(idx) {
    const song = playlist[idx];
    if (!song) return;
    const key = song.file.name;
    if (favorites.has(key)) {
        favorites.delete(key);
    } else {
        favorites.add(key);
    }
    saveSettings();
    renderPlaylist();
    updateFavQuickBtn();
}

// 更新首页收藏快捷按钮
function updateFavQuickBtn() {
    if (!el.btnFavQuick) return;
    const song = playlist[currentIndex];
    // 🚀 v3.4.x: 按钮内置 heart SVG，仅切换 .faved 类控制颜色，不再覆盖 textContent
    if (song && favorites.has(song.file.name)) {
        el.btnFavQuick.classList.add('faved');
    } else {
        el.btnFavQuick.classList.remove('faved');
    }
    setHeartFilled(el.btnFavQuick, !!(song && favorites.has(song.file.name)));
}

// 更新首页画中画快捷按钮
function updatePipQuickBtn() {
    if (!el.btnPipQuick) return;
    // 🚀 iOS/不支持的浏览器：隐藏画中画按钮（已在 togglePip 内兜底提示）
    if (!('documentPictureInPicture' in window)) {
        el.btnPipQuick.style.display = 'none';
        return;
    }
    if (pipWindow && !pipWindow.closed) {
        el.btnPipQuick.classList.add('pip-active');
    } else {
        el.btnPipQuick.classList.remove('pip-active');
    }
}

// === 🚀 核心修改：用状态机完美驱动"空态"与"播放态"的物理隔离 ===
function updateEmptyState() {
    const grid = document.querySelector('.content-grid');
    if (!grid) return;
    
    const isEmpty = playlist.length === 0;
    
    if (isEmpty) {
        grid.classList.add('is-empty');
        
        // 🚀 体验金加项：点击空状态区域，直接等同于点击"载入音乐"按钮，极其符合直觉！
        el.emptyState.onclick = () => {
            if (el.btnLoad) el.btnLoad.click();
        };
    } else {
        grid.classList.remove('is-empty');
        el.emptyState.onclick = null;
    }
}

// === 拖拽文件夹支持 (仅在以下场景生效: 主界面空白区、空状态区域、播放列表区域) ===
let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter++;
    // 显示拖拽视觉反馈
    if (dragCounter === 1 && playlist.length === 0) {
        el.emptyState.style.opacity = '0.5';
    }
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
        el.emptyState.style.opacity = '';
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault(); e.stopPropagation();
    // 安全检测：target 可能不是 Element（如拖到文档边缘或文本节点）
    const target = e.target && e.target.closest ? e.target : null;
    // 防止在模态框、按钮、专辑封面上拖放
    if (target && (target.closest('.modal-overlay') || target.closest('.art-box') ||
        target.closest('.btn-group-main') || target.closest('.vis-canvas-container'))) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', async (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter = 0;
    el.emptyState.style.opacity = '';

    // 禁止在模态框、按钮区、专辑封面上拖放（安全检测 target 类型）
    const dropTarget = e.target && e.target.closest ? e.target : null;
    if (dropTarget && (dropTarget.closest('.modal-overlay') || dropTarget.closest('.btn-group-main') ||
        dropTarget.closest('.vis-canvas-container') || dropTarget.closest('.art-box'))) {
        return;
    }

    // 如果正在加载中，拒绝新的拖入
    if (isLoadingFiles) {
        showToast("正在加载中，请稍候再拖入", iconSvg('alert'));
        return;
    }

    const items = e.dataTransfer.items;
    if (!items) return;
    const files = [];
    for (let item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry && entry.isDirectory) {
                await readDirEntries(entry, files);
            } else {
                files.push(item.getAsFile());
            }
        }
    }
    if (files.length) processFiles(files);
});

async function readDirEntries(dirEntry, files) {
    const entries = await new Promise(resolve => dirEntry.createReader().readEntries(resolve));
    for (let entry of entries) {
        if (entry.isFile) {
            files.push(await new Promise(resolve => entry.file(resolve)));
        } else if (entry.isDirectory) {
            await readDirEntries(entry, files);
        }
    }
}

// 全局拖拽锁，防止重复加载
let isLoadingFiles = false;

async function processFiles(files) {
    if (isLoadingFiles) {
        showToast("正在处理中，请稍候...", iconSvg('alert'));
        return;
    }
    isLoadingFiles = true;

    // 释放旧的Blob URL防止内存泄漏
    releaseAllBlobUrls();

    playlist = []; lrcMap.clear();
    const audios = [];
    files.forEach(f => {
        // 排除系统隐藏文件 (Mac ._xxx, Win Thumbs.db 等)
        if (f.name.startsWith('.') || f.name.startsWith('._')) return;

        const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
        if (['.mp3','.flac','.wav','.m4a','.ogg','.aac','.wma','.opus'].includes(ext)) audios.push(f);
        else if (ext === '.lrc') lrcMap.set(f.name.replace('.lrc','').toLowerCase(), f);
        else if (ext === '.vtt') lrcMap.set(f.name.replace('.vtt','').toLowerCase(), f);
        else if (ext === '.cue') parseCueFile(f);
    });
    if (!audios.length) {
        isLoadingFiles = false;
        return showToast("未发现音频", iconSvg('alert'));
    }

    el.loadWrap.classList.add('show');
    el.loadBar.style.width = '0%';
    const totalCount = audios.length;

    // 🚀 v2.9.0: 加载开始前插入骨架屏占位
    const skeletonCount = Math.min(10, totalCount);
    el.plContainer.innerHTML = '';
    for (let i = 0; i < skeletonCount; i++) {
        const sk = document.createElement('div');
        sk.className = 'pl-item skeleton';
        sk.innerHTML = '<div class="sk-bar"></div><div class="sk-bar"></div>';
        el.plContainer.appendChild(sk);
    }

    // 使用并发批处理加速首批加载 (同时解析最多6首)
    const initLen = Math.min(20, totalCount);
    const initBatchSize = 6;
    for (let batchStart = 0; batchStart < initLen; batchStart += initBatchSize) {
        const batchEnd = Math.min(batchStart + initBatchSize, initLen);
        const batchPromises = [];
        for (let i = batchStart; i < batchEnd; i++) {
            batchPromises.push(parseMetadataWrapped(audios[i]));
        }
        try {
            const results = await Promise.all(batchPromises);
            playlist.push(...results);
        } catch(batchErr) {
            // 单个批次失败不应阻塞整体加载
            logError('BATCH_INIT', `首批批次解析失败: ${batchErr.message}`, null);
        }
        el.loadBar.style.width = `${((batchEnd) / totalCount) * 100}%`;
    }

    updateEmptyState();
    showToast(`首批 ${initLen} 首就绪，随机开播`, iconSvg('rocket'));
    isShuffle = true; updateModeUI(); renderPlaylist(); await playAudio(Math.floor(Math.random() * playlist.length));

    if (totalCount > initLen) {
        // 后续批次用更小的并发避免卡顿
        let curr = initLen;
        
        // 🚀 曲库增量刷新防抖：每解析完一批后，最多每秒刷新一次曲库面板
        let coverLibRefreshTimer = null;
        const debouncedCoverLibRefresh = () => {
            if (coverLibRefreshTimer) clearTimeout(coverLibRefreshTimer);
            coverLibRefreshTimer = setTimeout(() => {
                // 检查用户是否打开了曲库面板
                const coverLibModal = document.getElementById('coverLibraryModal');
                const coverLibPanel = document.querySelector('.cover-library-panel');
                if (coverLibPanel) {
                    const grid = document.getElementById('coverLibGrid');
                    const searchEl = document.getElementById('coverLibSearch');
                    if (grid) {
                        const filter = searchEl ? searchEl.value : '';
                        // 🚀 v3.3.1: 统一走窗口化渲染入口（内部按 coverLibSortMode 分发）
                        if (typeof renderCoverLibGrid === 'function') renderCoverLibGrid(filter);
                    }
                }
                // 同时刷新封面墙（播放列表内的封面视图）
                if (currentViewMode === 'coverwall') {
                    renderCoverWall();
                }
            }, 1000);
        };
        
        const parseRemaining = async () => {
            if (curr >= totalCount) {
                el.loadBar.style.width = '100%';
                setTimeout(() => {
                    el.loadWrap.classList.remove('show');
                    
                    // 🚀 核心改动：全库与队列双向初始化
                    musicLibrary = [...playlist];
                    // 🩹 v3.2.3 P5: 库变动时失效化 TB 缓存
                    if (typeof invalidateGridCache === 'function') invalidateGridCache();
                    
                    renderPlaylist();
                    debouncedCoverLibRefresh(); // 最后一次完整刷新
                    showToast(`全库 ${totalCount} 首加载完毕`, iconSvg('check'));
                    isLoadingFiles = false;
                }, 800);
                return;
            }
            const batchEnd = Math.min(curr + 5, totalCount);
            const batchPromises = [];
            for (let i = curr; i < batchEnd; i++) {
                batchPromises.push(parseMetadataWrapped(audios[i]));
            }
            try {
                const results = await Promise.all(batchPromises);
                playlist.push(...results);
                // 🚀 增量同步到 musicLibrary，让曲库在加载过程中就能显示
                musicLibrary = [...playlist];
                if (typeof invalidateGridCache === 'function') invalidateGridCache();
            } catch(batchErr) {
                // 单批次失败不阻塞后续加载
                logError('BATCH_REMAINING', `剩余批次解析失败: ${batchErr.message}`, null);
            }
            curr = batchEnd;
            el.loadBar.style.width = `${(curr / totalCount) * 100}%`;

            if (curr % 50 === 0) renderPlaylist();
            
            // 🚀 防抖刷新曲库面板（如果用户正开着看）
            debouncedCoverLibRefresh();

            // 使用setTimeout让出主线程，避免卡顿
            setTimeout(() => parseRemaining(), 50);
        };
        setTimeout(() => parseRemaining(), 100);
    } else {
        setTimeout(() => el.loadWrap.classList.remove('show'), 500);
        musicLibrary = [...playlist];
        if (typeof invalidateGridCache === 'function') invalidateGridCache();
        isLoadingFiles = false;
    }
}

// 释放所有Blob URL，防止内存泄漏
let loadedUrls = [];
function releaseAllBlobUrls() {
    // 释放 loadedUrls 中记录的 URL
    loadedUrls.forEach(url => {
        try { URL.revokeObjectURL(url); } catch(e) {}
    });
    loadedUrls = [];
    // 🚀 v3.5.x: 同步清空复用池，避免遗留悬空引用
    _blobUrlMap.forEach(url => { try { URL.revokeObjectURL(url); } catch(e) {} });
    _blobUrlMap.clear();

    // 🚀 v2.7-preview2 P0: 额外释放 playlist 和 musicLibrary 中可能残留的 URL（防止漏网）
    [...playlist, ...musicLibrary].forEach(song => {
        if (song.url && song.url.startsWith('blob:')) {
            try { URL.revokeObjectURL(song.url); } catch(e) {}
        }
    });
}

// 包装parseMetadata以追踪URL + 超时熔断
const _originalParseMetadata = parseMetadata;
const parseMetadataWrapped = async function(file) {
    try {
        // 1.5秒超时熔断：防止损坏文件导致jsmediatags永久pending
        const result = await Promise.race([
            _originalParseMetadata(file),
            new Promise((resolve) => setTimeout(() => {
                console.warn(`文件解析超时，降级处理: ${file.name}`);
                const fallbackMeta = {
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: "未知",
                    album: "",
                    url: getBlobUrl(file),
                    file: file,
                    error: false,
                    lrcText: null
                };
                resolve(fallbackMeta);
            }, 1500))
        ]);
        if (result && result.url && !loadedUrls.includes(result.url)) {
            loadedUrls.push(result.url);
        }
        return result;
    } catch(e) {
        logError('PARSE_META', `解析失败: ${e.message}`, file);
        return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "未知",
            album: "",
            url: getBlobUrl(file),
            file: file,
            error: true,
            lrcText: null
        };
    }
};
// 替换全局引用 - processFiles中直接使用parseMetadataWrapped
// 因为parseMetadata是const无法重新赋值，我们在processFiles调用处改为parseMetadataWrapped

el.folderIn.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    await processFiles(files);
});

// === CUE 分轨支持 ===
async function parseCueFile(cueFile) {
    try {
        const text = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsText(cueFile, 'utf-8');
        });
        const lines = text.split(/\r?\n/);
        let currentFile = null;
        let currentTitle = null;
        let currentArtist = null;
        const tracks = [];

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('FILE ')) {
                const match = line.match(/FILE\s+"(.+)"\s+(\w+)/i);
                if (match) currentFile = match[1];
            }
            if (line.startsWith('TITLE ') && currentFile) {
                const match = line.match(/TITLE\s+"(.+)"/i);
                if (match) currentTitle = match[1];
            }
            if (line.startsWith('PERFORMER ') && currentFile) {
                const match = line.match(/PERFORMER\s+"(.+)"/i);
                if (match) currentArtist = match[1];
            }
            if (line.startsWith('INDEX 01 ')) {
                if (currentFile && currentTitle) {
                    const timeMatch = line.match(/INDEX 01 (\d+):(\d+):(\d+)/);
                    if (timeMatch) {
                        tracks.push({
                            file: currentFile,
                            title: currentTitle,
                            artist: currentArtist || '未知',
                            startTime: parseInt(timeMatch[1])*60 + parseInt(timeMatch[2]) + parseInt(timeMatch[3])/75
                        });
                    }
                }
                currentTitle = null;
            }
        }
        if (tracks.length > 0) {
            if (!window._cueTracks) window._cueTracks = {};
            window._cueTracks[cueFile.name] = tracks;
            showToast(`CUE 分轨: ${tracks.length} 个曲目已解析`, iconSvg('target'));
        }
    } catch(e) {
        logError('CUE_PARSE', e.message, cueFile);
    }
}

// 🩹 v3.2.3 P3: 播放列表事件委托 — 替代逐项 onclick 闭包（600 闭包 → 2 个监听器）
el.plContainer.addEventListener('click', (e) => {
    const plItem = e.target.closest('.pl-item');
    if (!plItem) return;
    const idx = parseInt(plItem.dataset.index);
    if (isNaN(idx)) return;

    if (e.target.classList.contains('favorite-btn')) {
        toggleFavorite(idx);
        return;
    }
    playAudio(idx);
    closeAllModals();
});

el.plContainer.addEventListener('contextmenu', (e) => {
    const plItem = e.target.closest('.pl-item');
    if (!plItem) return;
    e.preventDefault();
    ctxMenuTarget = parseInt(plItem.dataset.index);
    showContextMenu(e.clientX, e.clientY);
});

// 🔥 v2.8.10-v2.8.12: LRC 解析引擎持续迭代
// 基于 TME 双语 LRC 真实编码格式：
//   - 同时间戳双行 → 第一行=上一句翻译，第二行=本句原文
//   - 独立时间戳行(双语模式) → 单行原文，无翻译
//   - 空第一行+非空第二行(同时间戳) → 上一句无翻译
//   - 版权标记(TME享有/文曲大模型/腾讯享有) → 确认双语模式
//   - v2.8.12: 无版权标记但 pair 占比 >50% → 自启双语（覆盖 DAMIDAMI 等）
//   - [kana:] → 日语罗马音注音
//   - 独立时间戳空行(单语) → 有意空置保留
//   - 独立时间戳空行(双语) → verse break（固定矮高度，不显于沉浸/PiP）
//   - 末行翻译配对：末尾独立行可能为倒数第二行的翻译
//   - v2.8.12: 创作信息模式基于TME清单最终版彻底扩充（40+ 标识）
