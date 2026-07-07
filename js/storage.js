/*
 * MBolka Player - Storage v3.0.1
 * IndexedDB, directory handles, metadata cache, play stats, error logging,
 * theme logic, dark mode, immersive/fullscreen toggle
 */

async function initIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('errors')) {
                db.createObjectStore('errors', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('dirHandle')) {
                db.createObjectStore('dirHandle', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('stats')) {
                db.createObjectStore('stats', { keyPath: 'key' });
            }
        };
        req.onsuccess = (e) => { idb = e.target.result; resolve(); };
        req.onerror = () => {
            idb = null; resolve();
            // 🚀 v3.0.1: 存储空间溢出提示
            if (typeof showToast === 'function') {
                showToast('本地存储空间不足，元数据缓存已禁用', iconSvg('save'));
            }
        };
    });
}

// === v3.0.2: 存储空间管理 ===

// 估算当前 IDB 存储使用量（MB）
async function estimateIDBUsage() {
    if (!idb) return 0;
    try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const est = await navigator.storage.estimate();
            return Math.round((est.usage || 0) / 1024 / 1024);
        }
    } catch(e) {}
    return 0;
}

// 清理超过 ttlDays 天的 metadata 缓存条目
async function cleanOldMetadata(ttlDays = 30) {
    if (!idb) return 0;
    const cutoff = Date.now() - ttlDays * 86400000;
    let deleted = 0;
    try {
        const tx = idb.transaction('metadata', 'readwrite');
        const store = tx.objectStore('metadata');
        const cursorReq = store.openCursor();
        await new Promise(resolve => {
            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (!cursor) return resolve();
                if (cursor.value.timestamp && cursor.value.timestamp < cutoff) {
                    cursor.delete();
                    deleted++;
                }
                cursor.continue();
            };
            cursorReq.onerror = () => resolve();
        });
    } catch(e) {}
    return deleted;
}

// 清理错误日志，只保留最近 maxEntries 条
async function cleanOldErrors(maxEntries = 200) {
    if (!idb) return 0;
    let deleted = 0;
    try {
        const tx = idb.transaction('errors', 'readwrite');
        const store = tx.objectStore('errors');
        const countReq = store.count();
        const total = await new Promise(resolve => {
            countReq.onsuccess = () => resolve(countReq.result);
            countReq.onerror = () => resolve(0);
        });
        if (total <= maxEntries) return 0;
        const toDelete = total - maxEntries;
        const cursorReq = store.openCursor();
        await new Promise(resolve => {
            cursorReq.onsuccess = (e) => {
                if (deleted >= toDelete) return resolve();
                const cursor = e.target.result;
                if (!cursor) return resolve();
                cursor.delete();
                deleted++;
                cursor.continue();
            };
            cursorReq.onerror = () => resolve();
        });
    } catch(e) {}
    return deleted;
}

// 手动清理全部缓存
async function clearAllCache() {
    if (!idb) return;
    try {
        const tx = idb.transaction(['metadata', 'errors'], 'readwrite');
        await Promise.all([
            new Promise(r => { const req = tx.objectStore('metadata').clear(); req.onsuccess = r; req.onerror = r; }),
            new Promise(r => { const req = tx.objectStore('errors').clear(); req.onsuccess = r; req.onerror = r; })
        ]);
    } catch(e) {}
}

// 写入前检查：超过 50MB 阈值自动触发清理
async function checkAndCleanIfNeeded() {
    const usage = await estimateIDBUsage();
    if (usage > 50) {
        const deleted = await cleanOldMetadata(14); // 超过 50MB 时只保留 14 天
        if (deleted > 0 && typeof showToast === 'function') {
            showToast(`已自动清理 ${deleted} 条过期缓存`, iconSvg('eraser'));
        }
        await cleanOldErrors(100);
    }
}

// 初始化时自动清理 30 天前的 metadata + 超过 200 条的错误
async function autoCleanOnStart() {
    try {
        const metaDel = await cleanOldMetadata(30);
        const errDel = await cleanOldErrors(200);
        if (metaDel > 0 || errDel > 0) {
            console.log(`[Storage] Auto cleaned: ${metaDel} metadata + ${errDel} error entries`);
        }
    } catch(e) {}
}

// 🚀 v2.9.0: 批量 IDB 写入 — 收集 20 条后一次性 transaction
let _metaBatchQueue = [];
let _metaBatchScheduled = false;
function _flushMetaBatch() {
    _metaBatchScheduled = false;
    if (!idb || !_metaBatchQueue.length) return;
    const batch = _metaBatchQueue.splice(0);
    try {
        const tx = idb.transaction('metadata', 'readwrite');
        const store = tx.objectStore('metadata');
        for (const { key, data } of batch) store.put({ key, data, timestamp: Date.now() });
    } catch(e) {}
}
async function cacheMetadata(key, data) {
    if (!idb) return;
    checkAndCleanIfNeeded(); // v3.0.2: 写入前检查容量
    _metaBatchQueue.push({ key, data });
    if (_metaBatchQueue.length >= 20) _flushMetaBatch();
    else if (!_metaBatchScheduled) {
        _metaBatchScheduled = true;
        queueMicrotask(_flushMetaBatch);
    }
}

async function getCachedMetadata(key) {
    if (!idb) return null;
    try {
        const tx = idb.transaction('metadata', 'readonly');
        const req = tx.objectStore('metadata').get(key);
        return new Promise(resolve => {
            req.onsuccess = () => {
                // v3.0.3: 缓存仅存纯文本字段(title/artist/album/lrcText)，
                // file/url/art 由调用方从 File 对象重建，不再从 IDB 读取。
                resolve(req.result ? req.result.data : null);
            };
            req.onerror = () => resolve(null);
        });
    } catch(e) { return null; }
}

// 内存错误日志缓存（用于导出，避免重复解析 localStorage）
const _errorLogsCache = [];

async function logError(type, message, file) {
    try {
        // 写入 IndexedDB
        if (idb) {
            const tx = idb.transaction('errors', 'readwrite');
            tx.objectStore('errors').put({ type, message, file: file ? file.name : '', time: Date.now() });
        }
        // 写入内存缓存
        const entry = { type, message, file: file ? file.name : '', time: new Date().toISOString() };
        _errorLogsCache.push(entry);
        if (_errorLogsCache.length > 500) _errorLogsCache.shift();
        // 写入 localStorage
        try {
            localStorage.setItem('MBolka_ErrorLogs', JSON.stringify(_errorLogsCache));
        } catch(e) {}
    } catch(e) {}
}

// === 目录句柄持久化 (File System Access API) ===
async function saveDirectoryHandle(handle) {
    directoryHandle = handle;
    if (idb) {
        try {
            const tx = idb.transaction('dirHandle', 'readwrite');
            tx.objectStore('dirHandle').put({ id: 'main', handle: handle });
        } catch(e) {}
    }
}

async function loadDirectoryHandle() {
    if (!idb) return null;
    try {
        const tx = idb.transaction('dirHandle', 'readonly');
        const result = await new Promise(resolve => {
            const req = tx.objectStore('dirHandle').get('main');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        if (result && result.handle) {
            // 验证权限
            const opts = { mode: 'read' };
            if (await result.handle.queryPermission(opts) === 'granted' ||
                await result.handle.requestPermission(opts) === 'granted') {
                directoryHandle = result.handle;
                return result.handle;
            }
        }
    } catch(e) {}
    return null;
}

async function loadFromStoredDirectory() {
    const handle = await loadDirectoryHandle();
    if (!handle) return false;
    try {
        const files = [];
        await readDirHandleEntries(handle, files);
        if (files.length) {
            await processFiles(files);
            return true;
        }
    } catch(e) {
        logError('DIR_LOAD', e.message);
    }
    return false;
}

async function readDirHandleEntries(dirHandle, files) {
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
            files.push(await entry.getFile());
        } else if (entry.kind === 'directory') {
            await readDirHandleEntries(entry, files);
        }
    }
}

async function pickAndLoadFolder() {
    try {
        const handle = await window.showDirectoryPicker();
        await saveDirectoryHandle(handle);
        const files = [];
        await readDirHandleEntries(handle, files);
        if (files.length) {
            await processFiles(files);
        }
    } catch(e) {
        if (e.name !== 'AbortError') {
            showToast("无法访问文件夹，请重试", iconSvg('x'));
        }
    }
}

// === 播放统计 ===
function recordPlay(song) {
    if (!song || !song.file) return;
    const key = song.file.name;
    if (!playStats[key]) {
        playStats[key] = { title: song.title, artist: song.artist, count: 0, lastPlay: 0, totalTime: 0 };
    }
    playStats[key].count++;
    playStats[key].lastPlay = Date.now();
    saveSettings();
}

function getTopSongs(limit = 10) {
    return Object.entries(playStats)
        .map(([key, val]) => ({ key, ...val }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function getTotalListenTime() {
    return Object.values(playStats).reduce((sum, s) => sum + (s.totalTime || 0), 0);
}

// === 播放统计追踪 ===
let playStartTime = 0;
audio.addEventListener('play', () => { playStartTime = Date.now(); });
audio.addEventListener('pause', () => {
    if (playStartTime && currentIndex >= 0 && playlist[currentIndex]) {
        const elapsed = (Date.now() - playStartTime) / 1000;
        if (elapsed > 1) {
            const key = playlist[currentIndex].file.name;
            if (!playStats[key]) playStats[key] = { title: playlist[currentIndex].title, artist: playlist[currentIndex].artist, count: 0, lastPlay: 0, totalTime: 0 };
            playStats[key].totalTime += elapsed;
        }
    }
    playStartTime = 0;
});


