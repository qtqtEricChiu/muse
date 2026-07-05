/*
 * MBolka Player - Audio Core v3.0.1
 * Lyrics engine (chain+pair), EQ (28 presets), crossfade v2.8.9,
 * playback control, AB repeat, progress bar, sleep timer, export/import
 */

function parseLyricText(text) {
    const lines = text.split(/\r?\n/);
    const TS_RE = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

    // ── Phase 0: kana 罗马音解析 ──
    let kanaData = null;
    const kanaMatch = text.match(/\[kana:(.+?)\]/);
    if (kanaMatch) {
        const raw = kanaMatch[1];
        const parts = [];
        let pos = 0;
        while (pos < raw.length) {
            let numStr = '';
            while (pos < raw.length && /\d/.test(raw[pos])) { numStr += raw[pos]; pos++; }
            if (!numStr) break;
            const count = parseInt(numStr);
            if (pos + count > raw.length) break;
            const kana = raw.slice(pos, pos + count);
            pos += count;
            parts.push(kana);
        }
        if (parts.length > 0) kanaData = { units: parts };
    }

    // ── Phase 1: 提取所有带时间戳条目（保留空行）──
    const rawEntries = [];
    for (const line of lines) {
        const m = line.match(TS_RE);
        if (!m) continue;
        const time = parseInt(m[1]) * 60 + parseInt(m[2]) + (m[3] ? parseInt(m[3].padEnd(3, '0')) / 1000 : 0);
        const txt = decodeText(line.replace(/\[.*?\]/g, '').trim());
        rawEntries.push({ time, text: txt });
    }

    if (!rawEntries.length) return { lyrics: [], credits: null, kanaData: null };

    // ── Phase 2: 构建分组（同时间戳配对）──
    const chunks = [];
    for (let i = 0; i < rawEntries.length;) {
        if (i + 1 < rawEntries.length && Math.abs(rawEntries[i].time - rawEntries[i + 1].time) < 0.005) {
            chunks.push({ type: 'pair', time: rawEntries[i].time, first: rawEntries[i].text, second: rawEntries[i + 1].text });
            i += 2;
        } else {
            chunks.push({ type: 'single', time: rawEntries[i].time, text: rawEntries[i].text, entry: rawEntries[i] });
            i++;
        }
    }

    // ── Phase 4: 创作信息模式检测（v2.8.12 基于TME清单最终版彻底扩充）──
    // 🔥 v2.8.13p2: 新增 配唱制作、母带处理、录音工作室 等
    // 🔥 v2.8.13p4: 新增 作词、作曲、演唱制作人、录音室、混音工作室、混音师、母带工作室、合音制作、编外合音制作、混音及母带后期 等
    const CREDIT_PAT = /^(词|曲|作词|作曲|编曲|制作人|演唱制作人?|制作\/版权|演唱|Rap|Rap\s*flow|音乐统筹|配唱制作人?|配唱制作|和声|和声&编写|合声演唱|合声编写|和声编写|合音制作|编外合音制作|吉他|吉他演奏|贝斯|键盘|合成器|鼓|鼓编程|弦乐|所有乐器|录音|录音棚|录音师|录音室|录音工作室|音频编辑|人声编辑|数字编辑|混音|混音师|混音工程师|混音工作室|缩混|混音及母带后期|母带|母带工程师|母带处理|母版制作|母带工作室|音乐监督|艺人及作品管理|监制|出品|发行|词曲|制作|Remixed|Keyboard|Synthesizer|Bass|Drum|Background|Vocal|Digital|Recording|Mix|All instruments|Drum Programming|Vocal Arrangement|Digital Editing|Recording Engineers|Mix Engineer|Mixing|Mastering Engineer|Mastering|Music Coordinator|Vocal Producer|Backing Vocal|Guitar Performance|Lyricist|Rap flow|Presented\s+By|Released\s+By)[：:\s]/i;
    // 🔥 v2.8.13p2: 多角色合并格式（用/分隔，如"词/曲"、"编曲/混音/制作"、"Lyrics/Composed by"）
    // 🔥 v2.8.13p4: 角色列表扩展，与 CREDIT_PAT 主要角色同步，新增多身份组合支持
    const CREDIT_MULTI_PAT = /^(词|曲|作词|作曲|编曲|混音|混音师|录音|录音师|录音室|制作|制作人|演唱制作人?|制作\/版权|吉他|吉他演奏|贝斯|键盘|鼓|和声|合声|合音制作|配唱|配唱制作|弦乐|出品|发行|母版|母带|母带工作室|OP|SP|ISRC|演唱|Remixed|Keyboard|Synthesizer|Bass|Drum|Background|Vocal|Digital|Recording|Mix|All instruments|Drum Programming|Vocal Arrangement|Digital Editing|Recording Engineers|Mix Engineer)(\/(词|曲|作词|作曲|编曲|混音|混音师|录音|录音师|录音室|制作|制作人|演唱制作人?|制作\/版权|吉他|吉他演奏|贝斯|键盘|鼓|和声|合声|合音制作|配唱|配唱制作|弦乐|出品|发行|母版|母带|母带工作室|OP|SP|ISRC|演唱|Remixed|Keyboard|Synthesizer|Bass|Drum|Background|Vocal|Digital|Recording|Mix|All instruments|Drum Programming|Vocal Arrangement|Digital Editing|Recording Engineers|Mix Engineer))+[：:\s]/i;
    const EN_CREDIT_PAT = /^(Lyrics|Composed|Arranged|Produced|Mixed|Recorded|Mastered|Performed|Written)(\s+by)?[：:\s]/i;
    const OA_OC_PAT = /^(OA|OC|OP|SP|ISRC|Arranger|Producer|Presented\s+By)(\(.+?\))?[：:\s]/i;
    const isCredit = (t) => t && (CREDIT_PAT.test(t) || CREDIT_MULTI_PAT.test(t) || EN_CREDIT_PAT.test(t) || OA_OC_PAT.test(t));
    const isCopyright = (t) => /TME|腾讯|翻译|文曲大模型|著作权|版权/.test(t);
    const isTitle = (t, time) => time < 3 && /[—\-–]\s/.test(t) && t.length < 120;
    // 🔥 增强名字列表检测：括号开头、多 & 分隔长文本、纯姓名分隔符组合
    const looksLikeNameList = (t) => {
        if (!t) return false;
        if (t.startsWith('(') || t.startsWith('（')) return true;
        if (/\/.+[\/].+\//.test(t) && t.length > 60) return true;
        if (/.+&.+&.+/.test(t) && t.length > 60) return true;
        return false;
    };
    const isMetadata = (t, time) => {
        if (!t) return false;
        return isCredit(t) || isCopyright(t) || isTitle(t, time) || looksLikeNameList(t);
    };

    // ── Phase 5: 找到歌词起始分界点（连续非元数据开始）──
    let lyricStart = 0;
    for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const texts = c.type === 'pair' ? [c.first, c.second] : [c.text];
        const allMeta = texts.every(t => isMetadata(t, c.time) || !t);
        if (!allMeta) { lyricStart = i; break; }
    }

    // ── Phase 5b: 双语模式启发式检测（无版权标记但 pair 占主导 → 自启双语）──
    let hasCopyright = false;
    for (const e of rawEntries) {
        if (/TME.{0,10}(享有|翻译|著作|版权)|腾讯.{0,10}(享有|翻译|著作|版权)|以下歌词翻译由/.test(e.text) ||
            /TME[浜横本板].{0,10}(炕|璇|戜|綔|鍝|鐨|钁|椾|綔|鏉)/.test(e.text)) {
            hasCopyright = true;
            break;
        }
    }
    if (!hasCopyright) {
        // 🔥 v2.8.12: 无版权标记时，统计歌词区域 pair/单行比例自启双语
        let pairCount = 0, singleCount = 0;
        for (let i = lyricStart; i < chunks.length; i++) {
            if (chunks[i].type === 'pair') pairCount++;
            else if (chunks[i].text && chunks[i].text.trim()) singleCount++;
        }
        // 歌词区域 pair 占比 > 50% → 认定双语模式
        if (pairCount > 0 && pairCount > singleCount) {
            hasCopyright = true;
        }
    }

    // ── Phase 6: 提取创作信息 ──
    const credits = [];
    for (let i = 0; i < lyricStart; i++) {
        const c = chunks[i];
        if (c.type === 'pair') {
            if (c.first && !isCopyright(c.first) && !isTitle(c.first, c.time))
                credits.push({ label: c.first, value: '' });
            if (c.second && !isCopyright(c.second) && !isTitle(c.second, c.time))
                credits.push({ label: '', value: c.second });
        } else {
            const t = c.text;
            if (t && !isCopyright(t) && !isTitle(t, c.time))
                credits.push({ label: t, value: '' });
        }
    }

    // ── Phase 6b (v2.8.13p2): 拆分创作信息为独立的 角色 + 值 ──
    // 问题：Phase 6 输出的 credits 把整行文本（如"制作人：Sihan"）塞进 label
    // 修复：检测角色名并分离值，多角色（制作人/作曲/编曲：Sihan）拆为多条独立行
    const processedCredits = [];
    for (const cr of credits) {
        const raw = cr.label || cr.value || '';
        if (!raw) { processedCredits.push(cr); continue; }

        // 匹配多角色合并格式（如"制作人/作曲/编曲：Sihan"）
        const multiMatch = raw.match(CREDIT_MULTI_PAT);
        if (multiMatch) {
            // 提取 / 分隔的所有角色名
            const fullPrefix = multiMatch[0].replace(/[：:\s]+$/, '');
            const roleParts = fullPrefix.split('/');
            const valueAfter = raw.slice(multiMatch[0].length).trim();
            for (const role of roleParts) {
                const roleClean = role.trim();
                if (roleClean) {
                    processedCredits.push({ label: roleClean, value: valueAfter });
                }
            }
            continue;
        }

        // 匹配单角色格式（如"制作人：Sihan"或"配唱制作：Victor"）
        const singleMatch = raw.match(CREDIT_PAT);
        if (singleMatch) {
            const prefix = singleMatch[0].replace(/[：:\s]+$/, '');
            const valueAfter = raw.slice(singleMatch[0].length).trim();
            processedCredits.push({ label: prefix, value: valueAfter });
            continue;
        }

        // 匹配英文格式（如"Produced by：Someone"）
        const enMatch = raw.match(EN_CREDIT_PAT);
        if (enMatch) {
            const prefix = enMatch[0].replace(/[：:\s]+$/, '');
            const valueAfter = raw.slice(enMatch[0].length).trim();
            processedCredits.push({ label: prefix, value: valueAfter });
            continue;
        }

        // OA/OC/OP/SP/ISRC 等
        if (OA_OC_PAT.test(raw)) {
            const oaMatch = raw.match(OA_OC_PAT);
            if (oaMatch) {
                const prefix = oaMatch[0].replace(/[：:\s]+$/, '');
                const valueAfter = raw.slice(oaMatch[0].length).trim();
                processedCredits.push({ label: prefix, value: valueAfter });
            }
            continue;
        }

        // 无法匹配 → 原样保留
        processedCredits.push(cr);
    }

    // ── Phase 7: 构建歌词列表 ──
    const lyrics = [];
    const isBilingual = hasCopyright;
    let pendingOrig = null;

    for (let i = lyricStart; i < chunks.length; i++) {
        const c = chunks[i];

        if (c.type === 'pair') {
            const first = c.first.trim();
            const second = c.second.trim();
            const ts = c.time;

            if (isBilingual) {
                // 🔥 规则: 第一行=上一句翻译，第二行=本句原文
                if (first && pendingOrig && !pendingOrig.translation) {
                    pendingOrig.translation = first;
                    pendingOrig.isBilingual = true;
                    pendingOrig.text = pendingOrig.original + '\n' + first;
                }
                // 第一行空置 → 上一句无翻译

                // 第二行 = 新原文
                if (second) {
                    const item = { time: ts, text: second, original: second, translation: null, isBilingual: false };
                    lyrics.push(item);
                    pendingOrig = item;
                } else {
                    pendingOrig = null;
                }
            } else {
                if (first) { lyrics.push({ time: ts, text: first, original: first, translation: null, isBilingual: false }); }
                if (second) { lyrics.push({ time: ts, text: second, original: second, translation: null, isBilingual: false }); }
            }
        } else {
            // 独立时间戳行
            const txt = c.text.trim();
            const ts = c.time;

            if (isBilingual) {
                if (txt) {
                    const item = { time: ts, text: txt, original: txt, translation: null, isBilingual: false };
                    lyrics.push(item);
                    pendingOrig = item;
                } else {
                    // 🔥 双语模式独立空行 → verse break（新唱段分隔）
                    lyrics.push({ time: ts, text: '', original: '', translation: null, isBilingual: false, isBreak: true });
                    pendingOrig = null;
                }
            } else {
                if (txt) {
                    lyrics.push({ time: ts, text: txt, original: txt, translation: null, isBilingual: false });
                } else {
                    // 🔥 独立时间戳空行 → 有意空置，保留空白行
                    lyrics.push({ time: ts, text: '', original: '', translation: null, isBilingual: false, isBlank: true });
                }
            }
        }
    }

    // ── Phase 8: 末尾翻译配对修复 ──
    // 如果倒数第一歌词行为独立行（无翻译），且倒数第二歌词行为独立原文（无翻译），
    // 且倒数第二与倒数第三的块是同一个时间戳（pair），则认为末尾行是倒数第二的翻译
    if (isBilingual && lyrics.length >= 2) {
        const last = lyrics[lyrics.length - 1];
        const prev = lyrics[lyrics.length - 2];
        if (last && prev &&
            !last.isBilingual && !last.isBlank && !last.isBreak &&
            !prev.isBilingual && !prev.isBlank && !prev.isBreak &&
            !last.translation && !prev.translation) {
            // 确认倒数第三行是否存在且与倒数第二行同时间戳
            if (lyrics.length >= 3) {
                const pp = lyrics[lyrics.length - 3];
                if (pp.isBilingual && pp.translation && pp.time === prev.time) {
                    // 典型模式：倒数第三=双语句(翻译+原文)中的译文，倒数第二=pair第二句(原文)
                    // 实际上不需要检查倒数第三的具体内容，只需确认末尾行应配对
                }
            }
            prev.translation = last.text;
            prev.isBilingual = true;
            prev.text = prev.original + '\n' + last.text;
            lyrics.pop(); // 移除独立末尾行（已是翻译）
        }
    }

    return { lyrics, credits: processedCredits.length > 0 ? processedCredits : null, kanaData };
}

const loadLrc = async (song) => {
    parsedLyrics = []; el.lrcView.innerHTML = ''; el.immCurrLine.textContent = ''; el.immNextLine.textContent = '';
    let lrcText = null;

    // 优先内嵌歌词
    if (song.lrcText) {
        lrcText = song.lrcText;
    } else {
        // 其次同名LRC文件
        const base = song.file.name.replace(/\.[^/.]+$/, "").toLowerCase(); let file = lrcMap.get(base);
        if(!file) for (let [k, v] of lrcMap.entries()) if (k.includes(base) || base.includes(k)) { file = v; break; }
        if (file) {
            lrcText = await new Promise(resolve => {
                const r = new FileReader();
                r.onload = e => {
                    try { resolve(new TextDecoder('utf-8', {fatal: true}).decode(e.target.result)); }
                    catch {
                        const r2 = new FileReader();
                        r2.onload = ev => resolve(ev.target.result);
                        r2.readAsText(file, 'gbk');
                    }
                };
                r.readAsArrayBuffer(file);
            });
        }
    }

    if (!lrcText) {
        el.lrcPanel.style.display = 'none'; el.btnToggleLrc.classList.remove('active');
        el.immLrcCenter.classList.add('hidden');
        return;
    }

    const parseResult = parseLyricText(lrcText);
    parsedLyrics = parseResult.lyrics || [];
    const creditsData = parseResult.credits;
    const kanaData = parseResult.kanaData;

    if(parsedLyrics.length) {
        el.lrcPanel.style.display = 'flex'; el.btnToggleLrc.classList.add('active');
        el.immLrcCenter.classList.remove('hidden');

        // 🔥 v2.8.10p2: 顶部 spacer — 保证创作信息可居中
        const topSpacer = document.createElement('div');
        topSpacer.className = 'lrc-spacer-top';
        el.lrcView.appendChild(topSpacer);

        // 🔥 v2.8.10: 渲染创作信息卡片（提取的词曲编曲等元数据）
        if (creditsData && creditsData.length > 0) {
            const credDiv = document.createElement('div');
            credDiv.className = 'lrc-credits';
            let credHTML = '';
            for (const cr of creditsData) {
                if (cr.label && cr.value) {
                    credHTML += `<span class="lrc-credits-row"><span class="lrc-credits-tag">${escapeHTML(cr.label)}</span><span class="lrc-credits-val">${escapeHTML(cr.value)}</span></span>`;
                } else if (cr.label) {
                    credHTML += `<span class="lrc-credits-row"><span class="lrc-credits-tag">${escapeHTML(cr.label)}</span></span>`;
                } else if (cr.value) {
                    credHTML += `<span class="lrc-credits-row"><span class="lrc-credits-val">${escapeHTML(cr.value)}</span></span>`;
                }
            }
            credDiv.innerHTML = `<div class="lrc-credits-title">🎵 创作信息</div>${credHTML}`;
            el.lrcView.appendChild(credDiv);
        }

        // 🔥 v2.8.10: kana 注音信息提示
        if (kanaData && kanaData.units && kanaData.units.length > 0) {
            const kanaDiv = document.createElement('div');
            kanaDiv.className = 'lrc-credits';
            kanaDiv.innerHTML = `<div class="lrc-credits-title">🔤 罗马音注音</div><div style="font-size:11px;word-break:break-all;">${escapeHTML(kanaData.units.join(' · '))}</div>`;
            el.lrcView.appendChild(kanaDiv);
        }

        parsedLyrics.forEach((l) => {
            const d = document.createElement('div');
            d.className = 'lrc-line';
            d.dataset.time = l.time;

            if (l.isBilingual) {
                d.innerHTML = `
                    <span class="lrc-original">${escapeHTML(l.original)}</span>
                    <span class="lrc-translation">${escapeHTML(l.translation)}</span>
                `;
                d.classList.add('bilingual');
            } else if (l.isBreak) {
                // 🔥 v2.8.10p2: verse break — 固定矮高度，无点击
                d.innerHTML = '';
                d.classList.add('break');
            } else if (l.isBlank) {
                d.innerHTML = '';
                d.classList.add('blank');
            } else {
                d.textContent = l.text;
            }

            // break/blank 行不设点击跳转
            if (!l.isBreak && !l.isBlank) {
                d.onclick = () => { audio.currentTime = l.time + lyricsOffset; syncLyrics(true); };
            }
            el.lrcView.appendChild(d);
        });

        // 🔥 v2.8.10p2: 底部 spacer — 保证末行歌词可居中
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'lrc-spacer-bottom';
        el.lrcView.appendChild(bottomSpacer);

        // 🔥 v2.8.10p2: 切歌时歌词滚动归零
        el.lrcView.scrollTop = 0;
        isUserScrollingLyrics = false;
    } else {
        el.lrcPanel.style.display = 'none'; el.btnToggleLrc.classList.remove('active');
        el.immLrcCenter.classList.add('hidden');
    }
};

// 歌词偏移调整
function adjustLyricsOffset(delta) {
    lyricsOffset += delta;
    lyricsOffset = Math.round(lyricsOffset * 100) / 100; // 保留2位小数
    saveSettings();
    showToast(`⏱ 歌词偏移: ${lyricsOffset > 0 ? '+' : ''}${lyricsOffset.toFixed(1)}秒`);
    syncLyrics(true);
}

const handleUserScroll = () => {
    isUserScrollingLyrics = true;
    clearTimeout(lyricsScrollTimeout);
    // 🚀 v3.0.2: 滚动时移除歌词行高斯模糊
    el.lrcView.classList.add('scrolling');
    lyricsScrollTimeout = setTimeout(() => {
        isUserScrollingLyrics = false;
        syncLyrics();
        el.lrcView.classList.remove('scrolling');
    }, 2000);
};
el.lrcView.addEventListener('wheel', handleUserScroll, {passive: true}); el.lrcView.addEventListener('touchmove', handleUserScroll, {passive: true});

const syncLyrics = (force = false) => {
    if(!parsedLyrics.length) return;
    const cur = audio.currentTime - lyricsOffset;
    let activeIdx = -1;
    // 🚀 v2.8.5: 更精确的索引计算，移除 -0.2 偏移以提高响应速度
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
        if (cur >= parsedLyrics[i].time) { activeIdx = i; break; }
    }

    // 主界面歌词面板高亮
    if (el.lrcPanel.style.display !== 'none') {
        const lines = el.lrcView.querySelectorAll('.lrc-line');
        lines.forEach((line, i) => {
            if (i === activeIdx) {
                if (!line.classList.contains('active')) {
                    line.classList.add('active');
                    if (!isUserScrollingLyrics || force) {
                        void line.offsetHeight;
                        const rect = line.getBoundingClientRect();
                        const viewRect = el.lrcView.getBoundingClientRect();
                        
                        let offset;
                        if (lyricsAlignMode === 'center') {
                            const scale = 1.05;
                            const visualHeight = rect.height * scale;
                            offset = rect.top - viewRect.top
                                + el.lrcView.scrollTop
                                - (viewRect.height / 2) + (visualHeight / 2);
                        } else {
                            offset = rect.top - viewRect.top
                                + el.lrcView.scrollTop
                                - (viewRect.height * 0.3);
                        }
                        el.lrcView.scrollTo({ top: offset, behavior: 'smooth' });
                    }
                }
            } else line.classList.remove('active');
        });
    }

    // 🚀 v2.8.12: 沉浸模式歌词 — 当前行遇空行向上查找，下一行跳过空行
    if (activeIdx !== -1 && !el.immLrcCenter.classList.contains('hidden')) {
        const currentLrc = parsedLyrics[activeIdx];

        // 🔥 v2.8.12: 当前句遇 break/blank 向上查找最后有内容的歌词行
        let curDisplayIdx = activeIdx;
        let curTxt = currentLrc.original || currentLrc.text;
        if (!curTxt || currentLrc.isBreak || currentLrc.isBlank) {
            for (let j = activeIdx - 1; j >= 0; j--) {
                const pl = parsedLyrics[j];
                if (!pl.isBreak && !pl.isBlank && (pl.original || pl.text)) {
                    curTxt = pl.original || pl.text;
                    curDisplayIdx = j;
                    break;
                }
            }
        }

        if (el.immCurrLine.textContent !== curTxt || force) {
            el.immCurrLine.style.opacity = 0;
            setTimeout(() => {
                el.immCurrLine.textContent = curTxt || '';
                el.immCurrLine.style.opacity = curTxt ? 1 : 0;
            }, 200);
        }

        // 第二行：双语显示翻译，单语显示下一句（跳过空行）
        let nextTxt = '';
        let nextOpacity = 0;
        if (currentLrc.isBilingual && currentLrc.translation) {
            nextTxt = currentLrc.translation;
            nextOpacity = 0.85;
        } else {
            // 🔥 v2.8.12: 跳过 break/blank 空行找下一句有内容歌词（从真实下一句开始）
            let nextIdx = activeIdx + 1;
            while (nextIdx < parsedLyrics.length) {
                const nl = parsedLyrics[nextIdx];
                if (nl.isBreak || nl.isBlank) { nextIdx++; continue; }
                nextTxt = nl.original || nl.text;
                nextOpacity = 0.6;
                break;
            }
        }

        if (el.immNextLine.textContent !== nextTxt || force) {
            el.immNextLine.style.opacity = 0;
            setTimeout(() => {
                el.immNextLine.textContent = nextTxt || '';
                el.immNextLine.style.opacity = nextTxt ? nextOpacity : 0;
            }, 200);
        }
    }
};

// === 进度条悬停歌词预览 ===
function getLyricAtTime(time) {
    if (!parsedLyrics.length) return null;
    const adjustedTime = time - lyricsOffset;
    let best = null;
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time <= adjustedTime) best = parsedLyrics[i];
        else break;
    }
    
    // 🚀 v2.8.3: 双语歌词显示原文+翻译
    if (best && best.isBilingual) {
        return {
            ...best,
            text: `${best.original} | ${best.translation}` // 进度条预览显示合并文本
        };
    }
    return best;
}

function setupProgressHover(progArea, progTip) {
    // 🚀 v2.5-p2: 缓存 rect，只在 mouseenter 时刷新
    let hoverRect = null;
    progArea.addEventListener('mouseenter', () => { hoverRect = progArea.getBoundingClientRect(); });
    progArea.addEventListener('mousemove', (e) => {
        const rect = hoverRect || progArea.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const time = pct * (audio.duration || 0);
        const lyric = getLyricAtTime(time);
        if (lyric) {
            progTip.textContent = `🎤 ${lyric.text} [${formatTime(time)}]`;
            progTip.classList.add('show');
        } else if (audio.duration) {
            progTip.textContent = formatTime(time);
            progTip.classList.add('show');
        }
    });
    progArea.addEventListener('mouseleave', () => {
        progTip.classList.remove('show');
        hoverRect = null;
    });
}
setupProgressHover(el.progAreaMain, el.progTipMain);
setupProgressHover(el.immProgArea, el.immProgTip);

// === 专辑封面滑动切歌 ===
let swipeStartX = 0, swipeStartY = 0;
el.artBox.addEventListener('touchstart', (e) => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
}, { passive: true });

el.artBox.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        el.artBox.classList.add(dx > 0 ? 'swipe-right' : 'swipe-left');
        setTimeout(() => el.artBox.classList.remove('swipe-right', 'swipe-left'), 400);
        if (dx > 0) goPrev();
        else goNext();
    }
});

// === 均衡器引擎 ===
function initEQ() {
    if (!audioCtx) initVis();
    if (eqFilters.length > 0) return; // 已初始化

    // 断开原有连接
    try { source.disconnect(); } catch(e) {}

    eqFilters = [];
    let prevNode = source;

    for (let i = 0; i < 10; i++) {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = eqBands[i];
        filter.Q.value = 1.0;
        filter.gain.value = eqGains[i];
        prevNode.connect(filter);
        prevNode = filter;
        eqFilters.push(filter);
    }
    prevNode.connect(analyser);
    analyser.connect(audioCtx.destination);
}

function setEQBand(bandIdx, gainDb) {
    eqGains[bandIdx] = gainDb;
    if (eqFilters[bandIdx]) {
        eqFilters[bandIdx].gain.value = gainDb;
    }
    saveSettings();
}

function setEQPreset(preset) {
    const presets = {
        'flat': [0,0,0,0,0,0,0,0,0,0],
        'pop': [3,2,1,0,-1,-1,0,1,2,3],
        'rock': [4,3,2,0,-2,-1,1,2,3,4],
        'classical': [4,3,1,0,-1,-2,0,1,2,3],
        'vocal': [-2,-1,0,2,3,2,1,0,-1,-2],
        'bass': [6,5,3,1,0,-1,-2,-1,0,1],
        'electronic': [5,3,0,-2,-3,-1,2,4,5,4],
        'jazz': [3,2,1,0,1,1,0,-1,-1,0]
    };
    const gains = presets[preset] || presets['flat'];
    eqGains = gains;
    eqFilters.forEach((f, i) => {
        if (f) f.gain.value = gains[i];
    });
    // 更新UI
    for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`eq-band-${i}`);
        const val = document.getElementById(`eq-val-${i}`);
        if (slider) slider.value = gains[i];
        if (val) val.textContent = `${gains[i] > 0 ? '+' : ''}${gains[i]}dB`;
    }
    saveSettings();
    showToast(`🎛 均衡器: ${preset}`);
}

// === 播放速度/升降调控制 ===
function setPlaybackRate(rate) {
    playbackRate = rate;
    audio.playbackRate = rate;
    audio.preservesPitch = preservesPitch;
    const el = document.getElementById('speedVal');
    if (el) el.textContent = `${rate.toFixed(2)}x`;
    saveSettings();
}

function togglePitchPreserve() {
    preservesPitch = !preservesPitch;
    audio.preservesPitch = preservesPitch;
    const btn = document.getElementById('btnTogglePitch');
    if (btn) btn.textContent = preservesPitch ? '🔒 保持音调' : '🎵 允许变调';
    saveSettings();
    showToast(preservesPitch ? '已锁定音调' : '已允许升降调');
}

// 🚀 v2.8.5: 统一下一首选择逻辑，与 goNext() 保持一致
function getNextTrackIndex() {
    if (!playlist.length) return -1;
    if (isShuffle) {
        if (playlist.length <= 1) return currentIndex;
        let next;
        do { next = Math.floor(Math.random() * playlist.length); }
        while (next === currentIndex);
        return next;
    }
    return (currentIndex + 1) % playlist.length;
}

// === 🔥 v2.8.9: Crossfade 引擎全面重写 — Web Audio API + GainNode 精确定时淡变 ===
// 架构：固定双槽位 A/B（永不交换），AudioContext.lazyInit，semaphore 防止重叠

// 🔥 v2.8.9: 交叉淡变扫描器（轻量 rAF 循环，仅在启用时运行）
function cfSetupScanner() {
    if (cfRafId) cancelAnimationFrame(cfRafId);
    cfRafId = null;
    cfState = CfState.IDLE;
    cfAirLocked = false;

    // 🚀 v2.9.0: 交叉淡变关闭时直接退出，不启动空转 rAF
    if (!crossfadeEnabled) return;

    const scan = () => {
        if (isRepeatOne || playlist.length < 2 || cfState !== CfState.IDLE) {
            cfRafId = requestAnimationFrame(scan);
            return;
        }
        const remaining = (audio.duration || 0) - audio.currentTime;
        if (remaining > 0 && remaining <= crossfadeDuration && remaining > 0.3 && !audio.paused && !cfAirLocked) {
            cfTriggerCrossfade();
        }
        cfRafId = requestAnimationFrame(scan);
    };
    cfRafId = requestAnimationFrame(scan);
}

// 🔥 v2.8.9: 提前预加载（当前歌曲播放到 50% 时预加载下一首到被动槽）
function cfPreloadNext() {
    if (cfPreloadTimer) clearTimeout(cfPreloadTimer);
    if (!crossfadeEnabled || playlist.length < 2 || !audio.duration) return;
    const preloadAt = (audio.duration - crossfadeDuration - 1) * 1000;
    if (preloadAt <= 0) return;
    cfPreloadTimer = setTimeout(() => {
        const nextIdx = getNextTrackIndex();
        if (nextIdx < 0) return;
        const passive = cfGetPassiveAudio();
        if (!passive.src || passive.src !== playlist[nextIdx].url) {
            passive.src = playlist[nextIdx].url;
            passive.load();
        }
    }, Math.max(preloadAt, 0));
}

// 🔥 v2.8.9: 触发交叉淡变（异步预加载 + GainNode 斜坡）
async function cfTriggerCrossfade() {
    if (cfState !== CfState.IDLE || cfAirLocked) return;
    cfState = CfState.PRELOADING;

    // 初始化 AudioContext（首次调用时）
    if (!cfEnsureContext()) { cfState = CfState.IDLE; goNext(); return; }
    // 恢复 AudioContext（可能被浏览器挂起）
    if (audioCtx_cf.state === 'suspended') await audioCtx_cf.resume();

    const tid = ++cfTransitionId;       // 事务 ID
    const userVol = parseFloat(el.volSlider.value);
    const nextIdx = getNextTrackIndex();
    if (nextIdx < 0) { cfState = CfState.IDLE; return; }

    const passiveEl = cfGetPassiveAudio();
    const targetUrl = playlist[nextIdx].url;

    // 仅当被动槽不是同一 URL 时才重新加载
    if (passiveEl.src !== targetUrl) {
        passiveEl.src = targetUrl;
        passiveEl.load();
    }

    // 等待预加载完成（3 秒超时回退）
    try {
        await Promise.race([
            new Promise((res, rej) => {
                passiveEl.addEventListener('loadeddata', res, { once: true });
                passiveEl.addEventListener('error', rej, { once: true });
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
    } catch (e) {
        if (tid !== cfTransitionId) return;  // 已被新事务覆盖
        console.warn('交叉淡变预加载失败，直接切歌', e);
        cfState = CfState.IDLE;
        goNext();
        return;
    }

    // 再次校验，防止重叠
    if (tid !== cfTransitionId || cfState !== CfState.PRELOADING) return;
    cfState = CfState.FADING;
    cfAirLocked = true;

    // 启动被动槽播放
    passiveEl.currentTime = 0;
    passiveEl.play().catch(e => {
        console.error('交叉淡变播放失败', e);
        cfAbortTransition(tid);
        goNext();
        return;
    });

    // 🔥 核心：Web Audio API GainNode 精确定时斜坡
    const now = audioCtx_cf.currentTime;
    const dur = crossfadeDuration;
    const activeGain = cfGetActiveGain();
    const passiveGain = cfGetPassiveGain();

    // 确保 AudioContext 输出对准当前用户音量
    activeGain.gain.cancelScheduledValues(now);
    passiveGain.gain.cancelScheduledValues(now);
    activeGain.gain.setValueAtTime(userVol, now);
    passiveGain.gain.setValueAtTime(0, now);
    // 指数斜坡：人耳感知最平滑
    activeGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    passiveGain.gain.exponentialRampToValueAtTime(userVol, now + dur);

    // 定时完成
    setTimeout(() => cfFinishTransition(nextIdx, userVol, tid), dur * 1000 + 50);
}

// 🔥 v2.8.9: 完成交叉淡变过渡
function cfFinishTransition(nextIdx, userVol, tid) {
    if (tid !== cfTransitionId) return;
    cfState = CfState.IDLE;
    cfAirLocked = false;

    // 停止旧活跃槽
    const oldActive = cfGetActiveAudio();
    oldActive.onended = null;
    oldActive.pause();
    oldActive.src = '';
    oldActive.load();

    // 清理旧增益（确保静音）
    const oldGain = cfGetActiveGain();
    oldGain.gain.cancelScheduledValues(audioCtx_cf.currentTime);
    oldGain.gain.value = 0;

    // 🔥 交换槽位：新歌曲成为活跃槽
    const newActive = cfGetPassiveAudio();
    cfActive = cfActive === 'A' ? 'B' : 'A';

    // 新活跃增益确保为目标音量
    const newGain = cfGetActiveGain();
    newGain.gain.cancelScheduledValues(audioCtx_cf.currentTime);
    newGain.gain.value = userVol;

    // 更新状态
    currentIndex = nextIdx;
    const song = playlist[currentIndex];
    el.mainTitle.textContent = el.immTitle.textContent = song.title;
    el.mainArtist.textContent = el.immArtist.textContent = song.artist;
    document.title = `♪ ${song.title} - ${song.artist} ｜ MBolka`;

    // 同步播放速度
    newActive.playbackRate = playbackRate;
    newActive.preservesPitch = preservesPitch;

    // onended 绑定在 cfActive 指向的元素上
    newActive.onended = () => {
        if (isRepeatOne) { newActive.currentTime = 0; newActive.play(); return; }
        goNext();
    };

    setPlayState(true);
    loadLrc(song);
    renderPlaylist();
    recordPlay(song);
    updateFavQuickBtn();
    updatePipQuickBtn();
    applyThemeLogic();

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title, artist: song.artist,
            artwork: song.art ? [{ src: song.art, sizes: '512x512', type: 'image/jpeg' }] : []
        });
    }

    // 预加载下一首（被动槽现在是空的）
    cfPreloadNext();
}

// 🔥 v2.8.9: 紧急中止交叉淡变
function cfAbortTransition(tid) {
    if (tid !== cfTransitionId) return;
    cfState = CfState.IDLE;
    cfAirLocked = false;
    const pGain = cfGetPassiveGain();
    if (audioCtx_cf && pGain) {
        pGain.gain.cancelScheduledValues(audioCtx_cf.currentTime);
        pGain.gain.value = 0;
    }
    const passive = cfGetPassiveAudio();
    passive.pause();
    passive.src = '';
    passive.load();
}

// === 播放控制 ===
const playAudio = async (idx) => {
    if (!playlist[idx]) return;
    
    // 🔥 v2.8.9: 手动切歌时，中止正在进行的交叉淡变
    if (cfState !== CfState.IDLE || cfAirLocked) {
        cfAbortTransition(++cfTransitionId);
        cfState = CfState.IDLE;
        cfAirLocked = false;
        // 恢复当前活跃音频增益
        const aGain = cfGetActiveGain();
        if (audioCtx_cf && aGain) {
            aGain.gain.cancelScheduledValues(audioCtx_cf.currentTime);
            aGain.gain.value = parseFloat(el.volSlider.value);
        }
        // 停止被动槽
        const passive = cfGetPassiveAudio();
        passive.onended = null;
        passive.pause();
        passive.src = '';
        passive.load();
        // 增益归零
        const pGain = cfGetPassiveGain();
        if (audioCtx_cf && pGain) {
            pGain.gain.cancelScheduledValues(audioCtx_cf.currentTime);
            pGain.gain.value = 0;
        }
    } else {
        audio.volume = parseFloat(el.volSlider.value);
    }
    
    if (currentIndex !== idx) { playHistory.push(idx); if (playHistory.length > 200) playHistory.shift(); currentIndex = idx; }
    const song = playlist[idx];

    // 🔥 v2.8.9: 确保活跃槽指向 audio（手动切歌始终使用主音频槽）
    cfActive = 'A';
    audio.src = song.url;

    // 同步信息到双界面
    el.mainTitle.textContent = el.immTitle.textContent = song.title;
    el.mainArtist.textContent = el.immArtist.textContent = song.artist;
    document.title = `♪ ${song.title} - ${song.artist} ｜ MBolka`;
    el.fileInfo.innerHTML = `📄 ${song.file.name} <span style="opacity:0.5; margin-left:10px;">(${(song.file.size/1048576).toFixed(2)} MB)</span>`;

    hasCurrentAlbumArt = !!song.art;
    // 🚀 v3.0.1: 播放成功时移除加载失败状态
    if (el.artBox) el.artBox.classList.remove('load-error');
    if (hasCurrentAlbumArt) {
        el.mainArt.src = el.immArt.src = song.art;
        currentAlbumColor = await extractColor(song.art);
        // 设置专辑环境光阴影CSS变量
        if (currentAlbumColor) {
            document.documentElement.style.setProperty('--album-color', currentAlbumColor + '80');
        }
        el.mainColAlbum.classList.remove('no-art'); el.immTrackCard.classList.remove('no-art');
    } else {
        el.mainArt.src = el.immArt.src = "";
        currentAlbumColor = null;
        document.documentElement.style.setProperty('--album-color', 'rgba(0,0,0,0.5)');
        el.mainColAlbum.classList.add('no-art'); el.immTrackCard.classList.add('no-art');
    }

    applyThemeLogic(); await loadLrc(song); renderPlaylist();
    recordPlay(song);
    // 更新首页收藏按钮状态
    updateFavQuickBtn();
    // 更新画中画按钮状态
    updatePipQuickBtn();

    // 应用播放速度
    audio.playbackRate = playbackRate;
    audio.preservesPitch = preservesPitch;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title, artist: song.artist,
            artwork: song.art ? [{ src: song.art, sizes: '512x512', type: 'image/jpeg' }] : []
        });
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', goPrev);
        navigator.mediaSession.setActionHandler('nexttrack', goNext);
        navigator.mediaSession.setActionHandler('seekto', (d) => {
            if (d.seekTime) audio.currentTime = d.seekTime;
        });
        navigator.mediaSession.setActionHandler('seekbackward', (d) => {
            audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler('seekforward', (d) => {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + (d.seekOffset || 10));
        });
        // PositionState 实时同步
        if ('setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: audio.duration || 0,
                playbackRate: playbackRate,
                position: audio.currentTime || 0
            });
        }
    }

    try {
        await audio.play();
        setPlayState(true);
        if(!audioCtx) { initVis(); initEQ(); }
        // 🔥 v2.8.9: 播放开始后预加载下一首
        cfPreloadNext();
    } catch(e) {
        setPlayState(false);
        showToast("❌ 播放受阻");
    }
};

const setPlayState = (playing) => {
    isPlaying = playing;
    el.btnPlay.textContent = el.immBtnPlay.textContent = playing ? '⏸' : '▶';
    el.btnPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    el.immBtnPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    if(playing && !audioCtx) { initVis(); initEQ(); }
};

const togglePlay = () => {
    if (!playlist.length) return el.btnLoad.click();
    if (isPlaying) { audio.pause(); }
    else {
        audio.play();
        cfPreloadNext(); // 🔥 v2.8.9: 恢复播放后预加载
    }
    setPlayState(!isPlaying);
    createRipple(window.innerWidth/2, window.innerHeight/2);
};

const goNext = () => {
    if(!playlist.length) return;
    if (isRepeatOne) {
        audio.currentTime = 0;
        audio.play();
        setPlayState(true);
        return;
    }
    // 🔥 v2.8.9: 交叉淡变进行中时阻止重复触发
    if (cfState !== CfState.IDLE || cfAirLocked) {
        console.log('交叉淡变进行中，跳过 goNext()');
        return;
    }
    playAudio(getNextTrackIndex());
    createExplosion(window.innerWidth*0.8, window.innerHeight/2, 2);
};

const goPrev = () => {
    if(!playlist.length) return;
    if (isRepeatOne) {
        audio.currentTime = 0;
        audio.play();
        setPlayState(true);
        return;
    }
    if(isShuffle) {
        playHistory.pop();
        playAudio(playHistory.length ? playHistory.pop() : Math.floor(Math.random()*playlist.length));
    } else playAudio((currentIndex - 1 + playlist.length) % playlist.length);
    createExplosion(window.innerWidth*0.2, window.innerHeight/2, 2);
};

audio.addEventListener('error', async (e) => {
    const song = playlist[currentIndex];
    if (song) {
        song.error = true;
        await logError('PLAY_ERROR', `解码失败: ${audio.error ? audio.error.code : 'unknown'}`, song.file);
        renderPlaylist();
        showToast(`❌ 解码失败: ${song.title}，自动跳过`, "⚠️");
    }
    // 🚀 v3.0.1: 音频加载失败状态
    if (el.artBox) el.artBox.classList.add('load-error');
    setTimeout(() => goNext(), 500);
});

// A-B 重复模式
let abLongPressTimer = null;
function startABMode() {
    abMode = true; abPointA = null; abPointB = null;
    el.btnPlay.classList.add('ab-active');
    el.immBtnPlay.classList.add('ab-active');
    hideABMarkers();
    showToast("🔁 A-B重复模式: 请先设置A点 (点击进度条)", "🎯");
}
function cancelABMode() {
    abMode = false; abPointA = null; abPointB = null;
    el.btnPlay.classList.remove('ab-active');
    el.immBtnPlay.classList.remove('ab-active');
    hideABMarkers();
    showToast("A-B重复模式已取消");
}

// 更新AB标记点位置
function updateABMarkers() {
    const duration = audio.duration;
    if (!duration) return;

    const markersA = [document.getElementById('main-abMarkerA'), document.getElementById('imm-abMarkerA')];
    const markersB = [document.getElementById('main-abMarkerB'), document.getElementById('imm-abMarkerB')];
    const ranges = [document.getElementById('main-abRange'), document.getElementById('imm-abRange')];

    if (abPointA !== null) {
        const aPct = (abPointA / duration) * 100;
        markersA.forEach(m => {
            if (m) { m.style.display = 'block'; m.style.left = aPct + '%'; }
        });
    }
    if (abPointB !== null) {
        const bPct = (abPointB / duration) * 100;
        markersB.forEach(m => {
            if (m) { m.style.display = 'block'; m.style.left = bPct + '%'; }
        });
        // 显示AB范围
        ranges.forEach(r => {
            if (r) {
                r.style.display = 'block';
                const aPct = (abPointA / duration) * 100;
                r.style.left = aPct + '%';
                r.style.width = (bPct - aPct) + '%';
            }
        });
    }
}

function hideABMarkers() {
    document.querySelectorAll('.ab-marker, .ab-range').forEach(el => el.style.display = 'none');
}

function setupABLongPress(btn) {
    btn.addEventListener('mousedown', () => {
        abLongPressTimer = setTimeout(() => {
            if (!abMode) startABMode();
            else cancelABMode();
        }, 800);
    });
    btn.addEventListener('mouseup', () => { clearTimeout(abLongPressTimer); });
    btn.addEventListener('mouseleave', () => { clearTimeout(abLongPressTimer); });
    btn.addEventListener('touchstart', (e) => {
        abLongPressTimer = setTimeout(() => {
            if (!abMode) startABMode();
            else cancelABMode();
        }, 800);
    });
    btn.addEventListener('touchend', () => { clearTimeout(abLongPressTimer); });
    btn.addEventListener('touchmove', () => { clearTimeout(abLongPressTimer); });
}
setupABLongPress(el.btnPlay);
setupABLongPress(el.immBtnPlay);

function handleABSeek(e, container) {
    if (!audio.duration) return;
    // 🔥 v2.8.13p4: 统一使用 getBoundingClientRect() 计算 left 和 width，消除 offsetWidth 混用偏移
    const rect = container.getBoundingClientRect();
    const clickTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    if (abMode) {
        if (abPointA === null) {
            abPointA = clickTime;
            updateABMarkers();
            showToast(`A点已设置: ${formatTime(abPointA)}`);
        } else if (abPointB === null) {
            abPointB = clickTime;
            if (abPointB < abPointA) [abPointA, abPointB] = [abPointB, abPointA];
            updateABMarkers();
            showToast(`B点已设置: ${formatTime(abPointB)} - A-B重复开始`);
            audio.currentTime = abPointA;
            audio.play();
        } else {
            abPointA = clickTime; abPointB = null;
            hideABMarkers();
            updateABMarkers();
            showToast(`A点重新设置: ${formatTime(abPointA)}`);
        }
        return;
    }
    audio.currentTime = clickTime;
    createExplosion(e.clientX, e.clientY, 1.5);
}

el.btnPlay.onclick = el.immBtnPlay.onclick = (e) => {
    if (abMode) return;
    togglePlay();
};
el.btnNext.onclick = el.immBtnNext.onclick = goNext;
el.btnPrev.onclick = el.immBtnPrev.onclick = goPrev;

// === 终极丝滑进度条点击与拖拽引擎 ===
let isProgressDragging = false;

function bindProgressBar(progArea, progFill, timeDisplayEl, isMain) {
    if (!progArea || !progFill) return;

    // 🚀 v2.5-p2: 缓存 rect 避免 mousemove 中反复触发布局重排
    let cachedRect = null;

    const updateVisuals = (clientX) => {
        if (!audio.duration) return 0;
        const rect = cachedRect || progArea.getBoundingClientRect();
        
        // 计算点击位置占进度条的比例
        let pct = (clientX - rect.left) / rect.width;
        pct = Math.max(0, Math.min(1, pct)); // 严格限制在 0 ~ 1 之间
        
        // 🚀 v2.7: 进度条改用 transform:scaleX 避免布局重排
        progFill.style.transform = `scaleX(${pct})`;
        
        // 拖拽时实时更新当前数字时间，体验更跟手
        if (timeDisplayEl) {
            timeDisplayEl.textContent = formatTime(pct * audio.duration);
        }
        return pct;
    };

    const handleStart = (e) => {
        // 如果开启了 A-B 循环，则拦截拖拽，走 A-B 选点逻辑
        if (abMode) { handleABSeek(e, progArea); return; } 
        
        isProgressDragging = true;
        progArea.classList.add('dragging'); // 🚀 v3.0.0: 拖拽高亮反馈
        cachedRect = progArea.getBoundingClientRect(); // 🚀 按下时缓存一次
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        updateVisuals(clientX);
    };

    const handleMove = (e) => {
        if (!isProgressDragging || abMode) return;
        
        // 阻止默认行为（比如防止拖拽时意外选中文字）
        if (e.cancelable) e.preventDefault(); 
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        updateVisuals(clientX);
    };

    const handleEnd = (e) => {
        if (!isProgressDragging || abMode) return;
        isProgressDragging = false;
        progArea.classList.remove('dragging'); // 🚀 v3.0.0: 移除拖拽高亮
        
        const clientX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
        const pct = updateVisuals(clientX);
        
        // 松手瞬间，真正修改音频的播放进度
        audio.currentTime = pct * audio.duration;
        
        // 如果是沉浸模式，在点击位置生成特效
        if (!isMain && typeof createExplosion === 'function') {
            const rect = cachedRect || progArea.getBoundingClientRect();
            createExplosion(clientX, rect.top + 10, 1.5);
        }
        cachedRect = null; // 🚀 释放缓存
    };

    // 绑定鼠标事件 (PC 端)
    progArea.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    // 绑定触摸事件 (移动端/平板)
    progArea.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
}

// 🚀 分别为主界面和沉浸界面的进度条挂载引擎
bindProgressBar(el.progAreaMain, el.progFillMain, el.timeCur, true);
// 注意：如果沉浸模式的时间文字ID叫 immTimeCur，需要确保它存在
bindProgressBar(el.immProgArea, el.immProgFill, document.getElementById('immTimeCur'), false);


// === 必须修改 audio.ontimeupdate 以防止系统时间覆盖拖拽进度 ===
audio.ontimeupdate = () => {
    if (audio.duration) {
        // 🚀 v2.7: 进度条改用 transform:scaleX 避免布局重排
        if (!isProgressDragging) {
            const pct = audio.currentTime / audio.duration;
            if (el.progFillMain) el.progFillMain.style.transform = `scaleX(${pct})`;
            if (el.immProgFill) el.immProgFill.style.transform = `scaleX(${pct})`;
            
            if (el.timeCur) el.timeCur.textContent = formatTime(audio.currentTime);
            const immTimeCur = document.getElementById('immTimeCur');
            if (immTimeCur) immTimeCur.textContent = formatTime(audio.currentTime);
        }
        
        // 🚀 v2.7: 节能模式下歌词走低频定时器，跳过此高频回调
        if (!isEnergySaving) syncLyrics();
        
        // A-B 重复判定
        if (abMode && abPointA !== null && abPointB !== null) {
            if (audio.currentTime >= abPointB) audio.currentTime = abPointA;
        }
        
        // 同步系统媒体中心 (Media Session)
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: audio.duration, 
                playbackRate: playbackRate, 
                position: audio.currentTime
            });
        }
    }
};

audio.onloadedmetadata = () => {
    el.timeTot.textContent = formatTime(audio.duration);
    const immTimeTot = document.getElementById('immTimeTot');
    if (immTimeTot) immTimeTot.textContent = formatTime(audio.duration);
    if (abMode) updateABMarkers();
};

// 🔥 v2.8.9: 统一音量控制 — 交叉淡变启用时路由到 GainNode，否则直设 audio.volume
const cfSetVolume = (vol) => {
    audio.volume = vol;
    if (audioCtx_cf && cfGainNodeA) {
        cfGainNodeA.gain.cancelScheduledValues(audioCtx_cf.currentTime);
        cfGainNodeA.gain.value = vol;
    }
    if (audioCtx_cf && cfGainNodeB) {
        cfGainNodeB.gain.cancelScheduledValues(audioCtx_cf.currentTime);
        cfGainNodeB.gain.value = 0; // 被动槽保持静音
    }
    el.volSlider.value = vol;
    if (el.immVolSlider) el.immVolSlider.value = vol;
    saveSettings();
};

// 🔥 v2.8.9: 音量滑块事件 — 统一路由到 cfSetVolume
el.volSlider.oninput = (e) => {
    cfSetVolume(parseFloat(e.target.value));
    const pct = document.getElementById('volPercent');
    if (pct) pct.textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
};
const adjustVolume = (delta) => { 
    const newVol = Math.max(0, Math.min(1, audio.volume + delta));
    cfSetVolume(newVol);
};

audio.onended = () => {
    if (isRepeatOne) {
        audio.currentTime = 0;
        audio.play();
        return;
    }
    // 🔥 v2.8.9: 运行中的交叉淡变不重复触发
    if (cfState !== CfState.IDLE || cfAirLocked) return;
    goNext();
};

// === 睡眠定时器 ===
function setSleepTimer(minutes) {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (minutes === 0) {
        sleepTimer = null; sleepEndTime = null;
        updateSleepTimerUI();
        showToast("🌙 睡眠定时已取消");
        return;
    }
    const ms = minutes * 60 * 1000;
    sleepEndTime = Date.now() + ms;
    sleepTimer = setTimeout(() => {
        audio.pause();
        setPlayState(false);
        sleepTimer = null;
        sleepEndTime = null;
        updateSleepTimerUI();
        showToast("🌙 睡眠定时结束，已停止播放");
    }, ms);
    updateSleepTimerUI();
    showToast(`🌙 睡眠定时: ${minutes} 分钟后停止`);
}

function updateSleepTimerUI() {
    const display = document.getElementById('sleepTimerDisplay');
    if (!display) return;
    if (sleepTimer && sleepEndTime) {
        const remaining = Math.max(0, sleepEndTime - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2,'0')}` : `${secs}s`;
        display.textContent = `🌙 ${timeStr}`;
        display.className = 'sleep-timer-display active';
        // 最后1分钟红色闪烁
        if (remaining <= 60000 && remaining > 0) {
            display.style.color = (Math.floor(Date.now() / 500) % 2 === 0) ? '#ff6b6b' : 'var(--primary)';
        }
    } else {
        display.textContent = '🌙 定时';
        display.className = 'sleep-timer-display';
        display.style.color = '';
    }
}
// 每秒更新
setInterval(updateSleepTimerUI, 1000);

// 🚀 v2.8: 睡眠定时器快速菜单 (Alt+T 快捷键)
function showSleepQuickMenu() {
    closeAllModals();
    const menu = document.createElement('div');
    menu.className = 'modal-overlay open';
    menu.style.zIndex = '2000';
    menu.innerHTML = `
        <div class="modal-content" style="width:320px;padding:20px;text-align:center;">
            <div style="font-size:18px;margin-bottom:16px;">🌙 睡眠定时器</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button class="btn-glass focusable" data-min="15" style="justify-content:center;">15分钟</button>
                <button class="btn-glass focusable" data-min="30" style="justify-content:center;">30分钟</button>
                <button class="btn-glass focusable" data-min="60" style="justify-content:center;">60分钟</button>
                <button class="btn-glass focusable" data-min="0" style="justify-content:center;color:#ff6b6b;">取消定时</button>
            </div>
            <button class="btn-glass focusable" data-min="-1" style="width:100%;justify-content:center;margin-top:8px;opacity:0.6;">关闭</button>
        </div>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll('[data-min]').forEach(b => {
        b.onclick = () => {
            const m = parseInt(b.dataset.min);
            if (m >= 0) setSleepTimer(m);
            menu.remove();
        };
    });
    menu.onclick = (e) => { if (e.target === menu) menu.remove(); };
    updateFocusContext();
}

// === 导出/导入 ===
function exportPlaylist(format = 'json') {
    if (!playlist.length) return showToast("⚠️ 播放列表为空");
    let content, filename, mime;

    if (format === 'm3u') {
        content = '#EXTM3U\n';
        playlist.forEach((s, i) => {
            content += `#EXTINF:${Math.floor(audio.duration || 0)},${s.artist} - ${s.title}\n`;
            content += `${s.file.name}\n`;
        });
        filename = 'MBolka_Playlist.m3u';
        mime = 'audio/x-mpegurl';
    } else {
        const data = playlist.map(s => ({
            title: s.title,
            artist: s.artist,
            album: s.album,
            fileName: s.file.name,
            fileSize: s.file.size,
            favorite: favorites.has(s.file.name)
        }));
        content = JSON.stringify(data, null, 2);
        filename = 'MBolka_Playlist.json';
        mime = 'application/json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`📥 已导出: ${filename}`);
}

function importPlaylist(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                // JSON导入 - 只能恢复元数据信息
                showToast(`📥 已导入 ${data.length} 条记录（需要重新加载音频文件）`);
            }
        } catch {
            showToast("⚠️ 导入失败：格式不正确");
        }
    };
    reader.readAsText(file);
}

// === 全文搜索 ===
function searchPlaylist(query) {
    if (!query.trim()) {
        renderPlaylist();
        return;
    }
    const q = query.toLowerCase().trim();
    document.getElementById('playlistModalTitle').textContent = `🔍 搜索: "${q}"`;
    el.coverWallContainer.style.display = 'none';
    el.plContainer.style.display = 'flex';
    el.plContainer.innerHTML = '';

    const results = playlist.filter((s, i) => {
        return s.title.toLowerCase().includes(q) ||
               s.artist.toLowerCase().includes(q) ||
               (s.album && s.album.toLowerCase().includes(q)) ||
               s.file.name.toLowerCase().includes(q);
    });

    if (!results.length) {
        el.plContainer.innerHTML = '<div style="color:var(--text-sub); text-align:center; padding:20px;">未找到匹配的歌曲</div>';
        return;
    }

    results.forEach((s) => {
        const i = playlist.indexOf(s);
        const div = document.createElement('div');
        const isFav = favorites.has(s.file.name);
        let classes = 'pl-item focusable';
        if (i === currentIndex) classes += ' active';
        div.className = classes;
        div.dataset.index = i;
        div.innerHTML = `<span class="pl-title">${s.title}</span><span style="font-size:12px;opacity:0.6;">${s.artist}</span><span class="favorite-btn ${isFav ? 'faved' : ''}" data-idx="${i}">${isFav ? '❤️' : '🩶'}</span>`;
        div.onclick = (e) => {
            if (e.target.classList.contains('favorite-btn')) { e.stopPropagation(); toggleFavorite(i); return; }
            playAudio(i); closeAllModals();
        };
        el.plContainer.appendChild(div);
    });
    updateFocusContext();
}

// === 画中画 (Document Picture-in-Picture) v2.2 重构 ===
let pipWindow = null;
let pipSyncInterval = null; // 🚀 v2.7-preview2 P1: 提升为模块级变量以支持彻底清理
let pipHealthCheck = null;   // 🚀 v2.7-preview2 P1: 健康检查兜底
let isEnergySaving = false; // 🚀 v2.7: 节能模式状态机（与 v2.8.4 bit-flag 并行）

// 🚀 v2.8.4: 进入指定节能模式（位运算，支持叠加）
