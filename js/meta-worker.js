/**
 * MBolka Player — 元数据解析 Worker (P1-3, v3.5.0)
 * 在后台线程中用 jsmediatags 解析音乐文件标签，主线程只收结果。
 * 通信协议：
 *   → postMessage({ key: String, file: File })
 *   ← postMessage({ key, title?, artist?, album?, art?, lrcText?, error: Boolean })
 */
importScripts('https://cdn.jsdelivr.net/npm/jsmediatags@3.9.8/build/jsmediatags.min.js');

self.onmessage = (e) => {
  const { key, file } = e.data;
  if (!file) { self.postMessage({ key, error: true }); return; }

  try {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        const result = { key, error: false };
        const t = tag.tags;
        if (t.title) result.title = _decodeText(t.title);
        if (t.artist) result.artist = _decodeText(t.artist);
        if (t.album) result.album = _decodeText(t.album);
        if (t.lyrics) {
          result.lrcText = _decodeText(t.lyrics.lyrics || t.lyrics);
        }
        if (t.picture) {
          let b64 = '';
          const d = t.picture.data;
          for (let i = 0; i < d.length; i++) b64 += String.fromCharCode(d[i]);
          result.art = `data:${t.picture.format};base64,${self.btoa(b64)}`;
        }
        self.postMessage(result);
      },
      onError: () => {
        self.postMessage({ key, error: true });
      }
    });
  } catch (_e) {
    self.postMessage({ key, error: true });
  }
};

// 与主线程 decodeText 一致的 Unicode 转义 + HTML 实体解码
function _decodeText(str) {
  if (!str) return '';
  let s = str.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16)));
  // 无需 HTML 实体解码（Worker 无 DOM 故用简单替换）
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return s;
}
