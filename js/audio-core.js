/*
 * MBolka Player - Audio Core v3.6.3
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

    if (!rawEntries.length) return { lyrics: [], credits: null, kanaData: null, isAiTranslated: false };

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
    // 🚀 v3.6.2: EN_ROLES 按词条长度从长到短排序，避免短词条优先截断长词条（如 Drum 截断 Drum Programming）
    // 🚀 v3.6.2: EN_ROLES 按词条长度从长到短排序，避免短词条优先截断长词条（如 Drum 截断 Drum Programming）
    // 🚀 v3.6.2: 补充缺失英文角色（Vocals/Published/Programmed/Guitar/Drums/Executive Producer/Recorded at/Repertoire Owner/Vocals Produced），避免被误判为歌词导致 lyricStart 过早截止、其后 credits 全部丢失
    const EN_ROLES = 'Recording Engineers|Executive Producer|Repertoire Owner|Vocal Arrangement|Background Vocals|Drum Programming|Digital Editing|Vocals Produced|All instruments|Mix Engineer|Synthesizer|Recorded at|Background|Programmed|Published|Recording|Keyboard|Remixed|Digital|Vocals|Guitar|Drums|Vocal|Bass|Drum|Mix';
    // 🔥 v3.6.2: 新增 文案、古筝、古筝编写、小提琴、小提琴编写 角色（长词条在前：古筝编写>古筝、小提琴编写>小提琴，避免被截断）
    const CREDIT_PAT = new RegExp('^(文案|词|曲|作词|作曲|编曲|定位制作人|制作人|演唱制作人?|制作\\/版权|演唱|Rap|Rap\\s*flow|音乐统筹|制作统筹|配唱制作人?|配唱制作|和声|和声&编写|合声演唱|合声编写|和声编写|合音制作|编外合音制作|吉他|吉他演奏|贝斯|键盘|合成器|鼓|鼓编程|古筝编写|古筝|小提琴编写|小提琴|弦乐|弦乐编写|弦乐监制|所有乐器|录音|录音棚|录音师|录音室|录音工作室|主唱录音|弦乐录音|音频编辑|音乐编辑|人声编辑|数字编辑|混音|混音师|混音工程师|混音工作室|混音室|混音母带|缩混|混音及母带后期|母带|母带工程师|母带处理|母版制作|母带工作室|音乐监督|音乐设计|艺人及作品管理|监制|出品|发行|词曲|制作|' + EN_ROLES + '|Mixing|Mastering Engineer|Mastering|Music Coordinator|Vocal Producer|Backing Vocal|Guitar Performance|Lyricist|Rap flow|Presented\\s+By|Released\\s+By)[：:\\s]', 'i');
    // 🔥 v2.8.13p5: 新增 混音室、母带处理、音乐设计 词条（CREDIT_PAT 与 CREDIT_MULTI_PAT 同步）
    // 🔥 v3.5.0: 新增 弦乐编写/弦乐监制/主唱录音/弦乐录音/音乐编辑/制作统筹/混音母带
    // 🔥 v2.8.13p2: 多角色合并格式（用/分隔，如"词/曲"、"编曲/混音/制作"、"Lyrics/Composed by"）
    // 🔥 v2.8.13p4: 角色列表扩展，与 CREDIT_PAT 主要角色同步，新增多身份组合支持
    // 🔥 v3.6.2: 新增 文案、古筝、古筝编写、小提琴、小提琴编写（按长度从长到短排列，避免 古筝 截断 古筝编写 / 小提琴 截断 小提琴编写）
    const CREDIT_MULTI_PAT = new RegExp('^(文案|词|曲|作词|作曲|编曲|定位制作人|混音|混音师|混音室|录音|录音师|录音室|制作|制作人|演唱制作人?|制作\\/版权|吉他|吉他演奏|贝斯|键盘|鼓|古筝编写|古筝|小提琴编写|小提琴|和声|合声|合音制作|配唱|配唱制作|弦乐|弦乐编写|弦乐监制|出品|发行|母版|母带|母带处理|母带工作室|音乐设计|音乐编辑|音乐统筹|制作统筹|混音母带|OP|SP|ISRC|演唱|' + EN_ROLES + ')(\\/(文案|词|曲|作词|作曲|编曲|定位制作人|混音|混音师|混音室|录音|录音师|录音室|制作|制作人|演唱制作人?|制作\\/版权|吉他|吉他演奏|贝斯|键盘|鼓|古筝编写|古筝|小提琴编写|小提琴|和声|合声|合音制作|配唱|配唱制作|弦乐|弦乐编写|弦乐监制|出品|发行|母版|母带|母带处理|母带工作室|音乐设计|音乐编辑|音乐统筹|制作统筹|混音母带|OP|SP|ISRC|演唱|' + EN_ROLES + '))+[：:\\s]', 'i');
    const EN_CREDIT_PAT = /^(Lyrics|Composed|Arranged|Produced|Mixed|Recorded|Mastered|Performed|Written)(\s+by)?[：:\s]/i;
    const OA_OC_PAT = /^(OA|OC|OP|SP|ISRC|Arranger|Producer|Presented\s+By)(\(.+?\))?[：:\s]/i;
    const isCredit = (t) => t && (CREDIT_PAT.test(t) || CREDIT_MULTI_PAT.test(t) || EN_CREDIT_PAT.test(t) || OA_OC_PAT.test(t));
    const isCopyright = (t) => /TME|腾讯|翻译|文曲大模型|著作权|版权/.test(t);
    const isTitle = (t, time) => time < 3 && /[—\-–]\s/.test(t) && t.length < 120;
    // 🔥 增强名字列表检测：括号开头、多 & 分隔长文本、纯姓名分隔符组合
    const looksLikeNameList = (t) => {
        if (!t) return false;
        if ((t.startsWith('(') || t.startsWith('（')) && t.length > 60 && /\/.+\/.+/.test(t)) return true;
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

    // -- AI 翻译检测：LRC 头部含「文曲大模型」字样 → 标注 AI 翻译 --
    let isAiTranslated = false;
    for (const e of rawEntries) {
        if (/文曲大模型/.test(e.text)) { isAiTranslated = true; break; }
    }

    // ── Phase 6: 提取创作信息 ──
    // 🚀 v3.6.2: 既是创作信息（isCredit）又「像名单」（looksLikeNameList，如 Published by：A/B/C…）时，保留为 credits，不被名单过滤误删
    const inCredits = (t, time) => t && !isCopyright(t) && !isTitle(t, time) && (!looksLikeNameList(t) || isCredit(t));
    const credits = [];
    for (let i = 0; i < lyricStart; i++) {
        const c = chunks[i];
        if (c.type === 'pair') {
            if (inCredits(c.first, c.time))
                credits.push({ label: c.first, value: '' });
            if (inCredits(c.second, c.time))
                credits.push({ label: '', value: c.second });
        } else {
            const t = c.text;
            if (inCredits(t, c.time))
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

        // 🚀 v3.6.2: 所有 valueAfter 统一 trim 开头冒号，避免原始文本含双冒号（如"作词：: Fadil…"）导致 value 残留开头的 :
        const trimLeadingColon = (s) => s.replace(/^[:：]+/, '');

        // 匹配多角色合并格式（如"制作人/作曲/编曲：Sihan"）
        const multiMatch = raw.match(CREDIT_MULTI_PAT);
        if (multiMatch) {
            // 提取 / 分隔的所有角色名
            const fullPrefix = multiMatch[0].replace(/[：:\s]+$/, '');
            const roleParts = fullPrefix.split('/');
            const valueAfter = trimLeadingColon(raw.slice(multiMatch[0].length).trim());
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
            const valueAfter = trimLeadingColon(raw.slice(singleMatch[0].length).trim());
            processedCredits.push({ label: prefix, value: valueAfter });
            continue;
        }

        // 匹配英文格式（如"Produced by：Someone"）
        const enMatch = raw.match(EN_CREDIT_PAT);
        if (enMatch) {
            const prefix = enMatch[0].replace(/[：:\s]+$/, '');
            const valueAfter = trimLeadingColon(raw.slice(enMatch[0].length).trim());
            processedCredits.push({ label: prefix, value: valueAfter });
            continue;
        }

        // OA/OC/OP/SP/ISRC 等
        if (OA_OC_PAT.test(raw)) {
            const oaMatch = raw.match(OA_OC_PAT);
            if (oaMatch) {
                const prefix = oaMatch[0].replace(/[：:\s]+$/, '');
                const valueAfter = trimLeadingColon(raw.slice(oaMatch[0].length).trim());
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

    return { lyrics, credits: processedCredits.length > 0 ? processedCredits : null, kanaData, isAiTranslated };
}

// 🚀 v3.1.0: VTT 字幕解析（与 LRC 同一输出格式）
function parseVttText(text) {
    const lyrics = [];
    const lines = text.split(/\r?\n/);
    const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
    let i = 0;
    // 跳过 WEBVTT 头部
    while (i < lines.length && !lines[i].includes('-->')) i++;
    for (; i < lines.length; i++) {
        const match = lines[i].match(TIME_RE);
        if (match) {
            const start = parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]) + parseInt(match[4])/1000;
            const textLines = [];
            i++;
            while (i < lines.length && !lines[i].includes('-->') && lines[i].trim() !== '') {
                textLines.push(lines[i].trim());
                i++;
            }
            if (textLines.length > 0) {
                lyrics.push({ time: start, text: textLines.join('\n') });
            }
            if (i < lines.length && lines[i].includes('-->')) i--; // 回退一行让外层循环处理
        }
    }
    return { lyrics, credits: null, kanaData: null };
}

const loadLrc = async (song) => {
    // 🔥 v3.6.2: 切歌（歌词栏可见且有旧歌词）时，先做高斯模糊+淡出过渡，再换内容
    const wasVisible = el.lrcPanel.style.display !== 'none' && parsedLyrics.length > 0;
    if (wasVisible) {
        el.lrcView.classList.add('lrc-switching');
        await new Promise(r => setTimeout(r, 220));
    }
    parsedLyrics = []; el.lrcView.innerHTML = ''; el.immCurrLine.textContent = ''; el.immNextLine.textContent = '';
    syncLyrics._lines = null; syncLyrics._lastIdx = -1;
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
        // 🔥 v3.6.2-fix: 无歌词分支必须清理 lrc-switching，否则后续有歌词的歌进来时
        // wasVisible 因 parsedLyrics=[] 而为 false，跳过移除逻辑 → blur(10px)+opacity:0 永久残留
        el.lrcView.classList.remove('lrc-switching');
        el.lrcPanel.classList.remove('lrc-panel-in', 'lrc-panel-out');
        return;
    }

    // 🚀 v3.1.0: 自动检测 VTT 字幕格式
    const isVtt = lrcText.trim().startsWith('WEBVTT');
    const parseResult = isVtt ? parseVttText(lrcText) : parseLyricText(lrcText);
    parsedLyrics = parseResult.lyrics || [];
    const creditsData = parseResult.credits;
    const kanaData = parseResult.kanaData;
    const isAiTranslated = !!parseResult.isAiTranslated;

    if(parsedLyrics.length) {
        el.lrcPanel.style.display = 'flex'; el.btnToggleLrc.classList.add('active');
        el.immLrcCenter.classList.remove('hidden');
        // 🔥 v3.6.2: 歌词栏出入场动画——切歌用内容高斯模糊过渡，面板此前隐藏则用整体淡入
        el.lrcPanel.classList.remove('lrc-panel-out');
        // 🔥 v3.6.2-fix: 无论 wasVisible 如何，都先清理残留的 lrc-switching（防止无歌词歌遗留）
        el.lrcView.classList.remove('lrc-switching');
        if (wasVisible) {
            void el.lrcView.offsetWidth;  // 触发 reflow，确保移除后重绘
        } else {
            void el.lrcPanel.offsetWidth;
            el.lrcPanel.classList.add('lrc-panel-in');
        }

        // 🔥 v2.8.10p2: 顶部 spacer — 保证创作信息可居中
        const topSpacer = document.createElement('div');
        topSpacer.className = 'lrc-spacer-top';
        el.lrcView.appendChild(topSpacer);

        // 🔥 v2.8.10: 渲染创作信息卡片（提取的词曲编曲等元数据）
        if (creditsData && creditsData.length > 0) {
            const credDiv = document.createElement('div');
            credDiv.className = 'lrc-credits';
            // 🚀 v3.6.2: 标准名单按 /,，、 分隔，保持名字完整；含括号时先保护括号内内容再拆分，避免出版信息（如 Universal/MCA）被误拆
            const NON_STANDARD_CREDIT = /[()\[\]{}&\-–—:;"']/;
            const formatCreditValue = (val) => {
                if (!val || val.length <= 30) return escapeHTML(val);
                // 非标准创作信息且无有效分隔符：直接返回不拆分
                if (NON_STANDARD_CREDIT.test(val) && !/\s*[\/,，、]\s*/.test(val)) return escapeHTML(val);
                // 保护括号内的内容，避免括号内的 / 被当作分隔符
                const protected = [];
                let valProtected = val.replace(/\([^)]*\)/g, (m) => {
                    protected.push(m);
                    return `\x00${protected.length - 1}\x00`;
                });
                // 标准名单：分隔符紧跟前一项，保持每个名字完整
                const seps = valProtected.match(/\s*[\/,，、]\s*/g) || [];
                const names = valProtected.split(/\s*[\/,，、]\s*/).map(s => s.trim()).filter(Boolean);
                if (names.length <= 1) return escapeHTML(val);
                let html = '';
                for (let i = 0; i < names.length; i++) {
                    const sep = (i < names.length - 1 && i < seps.length) ? seps[i] : '';
                    // 恢复括号内的内容
                    const name = names[i].replace(/\x00(\d+)\x00/g, (_, idx) => protected[idx]);
                    html += `<span class="lrc-credits-name">${escapeHTML(name)}${sep ? '<span class="lrc-credits-sep">' + escapeHTML(sep) + '</span>' : ''}</span>`;
                }
                return html;
            };
            let credHTML = '';
            for (const cr of creditsData) {
                if (cr.label && cr.value) {
                    credHTML += `<span class="lrc-credits-row"><span class="lrc-credits-tag">${escapeHTML(cr.label)}</span><span class="lrc-credits-val">${formatCreditValue(cr.value)}</span></span>`;
                } else if (cr.label) {
                    credHTML += `<span class="lrc-credits-row"><span class="lrc-credits-tag">${escapeHTML(cr.label)}</span></span>`;
                } else if (cr.value) {
                    credHTML += `<span class="lrc-credits-row"><span class="lrc-credits-val">${formatCreditValue(cr.value)}</span></span>`;
                }
            }
            credDiv.innerHTML = `<div class="lrc-credits-title">${iconSvg('music')} 创作信息${isAiTranslated ? ' <span class="lrc-credits-ai-badge">AI 翻译<span class="lrc-credits-ai-tip">以下歌词翻译由文曲大模型提供</span></span>' : ''}</div>${credHTML}`;
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
                d.onclick = () => { getActivePlayAudio().currentTime = l.time + lyricsOffset; syncLyrics(true); };
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
        el.lrcPanel.classList.remove('lrc-panel-in', 'lrc-panel-out');
    }
};

// 歌词偏移调整
function adjustLyricsOffset(delta) {
    lyricsOffset += delta;
    lyricsOffset = Math.round(lyricsOffset * 100) / 100; // 保留2位小数
    saveSettings();
    showToast(`歌词偏移: ${lyricsOffset > 0 ? '+' : ''}${lyricsOffset.toFixed(1)}秒`, iconSvg('clock'));
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

// 缓存歌词行节点，避免 timeupdate 高频 querySelectorAll（歌词重渲染时置空）
function getLrcLines() {
    if (!syncLyrics._lines) {
        syncLyrics._lines = Array.from(el.lrcView.querySelectorAll('.lrc-line'));
    }
    return syncLyrics._lines;
}

const syncLyrics = (force = false) => {
    if(!parsedLyrics.length) return;
    const cur = getActivePlayAudio().currentTime - lyricsOffset;
    let activeIdx = -1;
    // 🚀 v2.8.5: 更精确的索引计算，移除 -0.2 偏移以提高响应速度
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
        if (cur >= parsedLyrics[i].time) { activeIdx = i; break; }
    }

    // 主界面歌词面板高亮（仅激活行变化或强制时更新，避免每 tick 全量重排）
    if (el.lrcPanel.style.display !== 'none') {
        const lines = getLrcLines();
        if (force || activeIdx !== syncLyrics._lastIdx) {
            const prev = syncLyrics._lastIdx;
            if (prev >= 0 && lines[prev]) lines[prev].classList.remove('active');
            const line = lines[activeIdx];
            if (line) {
                line.classList.add('active');
                if (!isUserScrollingLyrics || force) {
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
            syncLyrics._lastIdx = activeIdx;
        }
    } else {
        syncLyrics._lastIdx = -1;
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
        const pa = getActivePlayAudio();
        const dur = pa.duration;
        if (!dur || dur <= 0) return;
        const pct = (e.clientX - rect.left) / rect.width;
        if (pct < 0 || pct > 1) return;
        const time = pct * dur;
        const lyric = getLyricAtTime(time);
        if (lyric) {
            progTip.textContent = `🎤 ${lyric.text} [${formatTime(time)}]`;
            progTip.classList.add('show');
        } else {
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

// 🚀 v3.6.2: 窗口缩放时强制回流双进度条，后续 getBoundingClientRect 自动返回新坐标
window.addEventListener('resize', () => {
    [el.progAreaMain, el.immProgArea].forEach(a => {
        if (a) void a.offsetHeight;
    });
});

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

    // 🔥 v3.6.2: 断开汇流节点到 analyser 的直连（EQ 关闭时的默认路径），
    // 改走 EQ 滤波器链路。双槽元素 source 仍稳定汇入 visInputNode，不受 EQ 重建影响。
    try { visInputNode.disconnect(); } catch(e) {}

    eqFilters = [];
    let prevNode = visInputNode;

    // 🚀 v3.6.2: 末端补偿增益节点，依据合成幅频响应自动拉回余量，避免提升后削波
    eqMakeup = audioCtx.createGain();
    eqMakeup.gain.value = 1;

    for (let i = 0; i < 10; i++) {
        const filter = audioCtx.createBiquadFilter();
        // 首/末频段改用 shelf，避免 peaking 在极低/极高处的宽共振堆叠染色
        if (i === 0) filter.type = 'lowshelf';
        else if (i === 9) filter.type = 'highshelf';
        else filter.type = 'peaking';
        filter.frequency.value = eqBands[i];
        // 低频段降低 Q 减少相邻频段重叠波纹与相位互调失真
        filter.Q.value = (i <= 1) ? 0.7 : 1.0;
        filter.gain.value = eqGains[i];
        prevNode.connect(filter);
        prevNode = filter;
        eqFilters.push(filter);
    }
    prevNode.connect(eqMakeup);
    eqMakeup.connect(analyser);
    analyser.connect(audioCtx.destination);
    updateEQMakeup();
}

// 🚀 v3.6.2: 依据全部频段级联后的真实合成幅频响应计算补偿增益。
// 级联滤波器幅值相乘，故总 dB = 各滤波器 dB 之和；取最大值，仅做衰减（留 0.3dB 余量），不提升。
function updateEQMakeup() {
    if (!eqMakeup || !eqFilters.length) return;
    const N = 600;
    const freqs = new Float32Array(N);
    for (let i = 0; i < N; i++) {
        freqs[i] = 20 * Math.pow(1000, i / (N - 1)); // 20Hz → 20kHz 对数分布
    }
    const mag = new Float32Array(N).fill(1);
    const curMag = new Float32Array(N);
    const phase = new Float32Array(N);
    for (const f of eqFilters) {
        f.getFrequencyResponse(freqs, curMag, phase);
        for (let i = 0; i < N; i++) mag[i] *= curMag[i];
    }
    let maxDb = 0;
    for (let i = 0; i < N; i++) {
        const db = 20 * Math.log10(mag[i]);
        if (db > maxDb) maxDb = db;
    }
    const makeupDb = maxDb > 0 ? -(maxDb + 0.3) : 0; // 仅衰减，不主动提升
    eqMakeup.gain.value = Math.pow(10, makeupDb / 20);
}

function setEQBand(bandIdx, gainDb) {
    eqGains[bandIdx] = gainDb;
    if (eqFilters[bandIdx]) {
        eqFilters[bandIdx].gain.value = gainDb;
        updateEQMakeup(); // 🚀 v3.6.2: 增益变化后重算补偿余量
    }
    saveSettings();
}

// 🚀 v3.4.x: 根据当前各频段增益反推匹配的预设名，无匹配则返回 'custom'
function matchEQPreset(gains) {
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
    for (const k in presets) {
        if (presets[k].every((v, i) => v === gains[i])) return k;
    }
    return 'custom';
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
    updateEQMakeup(); // 🚀 v3.6.2: 预设切换后重算补偿余量
    // 更新UI
    for (let i = 0; i < 10; i++) {
        const slider = document.getElementById(`eq-band-${i}`);
        const val = document.getElementById(`eq-val-${i}`);
        if (slider) slider.value = gains[i];
        if (val) val.textContent = `${gains[i] > 0 ? '+' : ''}${gains[i]}dB`;
    }
    saveSettings();
    showToast(`均衡器: ${preset}`, iconSvg('sliders'));
}

// === 播放速度/升降调控制 ===
function setPlaybackRate(rate) {
    playbackRate = rate;
    const ap = getActivePlayAudio();
    ap.playbackRate = rate;
    ap.preservesPitch = preservesPitch;
    const el = document.getElementById('speedVal');
    if (el) el.textContent = `${rate.toFixed(2)}x`;
    saveSettings();
}

function togglePitchPreserve(force) {
    preservesPitch = force != null ? force : !preservesPitch;
    audio.preservesPitch = preservesPitch;
    const toggle = document.getElementById('pitchToggleSwitch');
    if (toggle) toggle.checked = preservesPitch;
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
        // 🔥 v2.8.9 修复：监听「当前活跃槽」而非固定 audio，否则交叉淡变后活跃槽切到 cfAudioB 时扫描器永久失效
        const activeAudio = cfGetActiveAudio();
        const remaining = (activeAudio.duration || 0) - activeAudio.currentTime;
        if (remaining > 0 && remaining <= crossfadeDuration && remaining > 0.3 && !activeAudio.paused && !cfAirLocked) {
            cfTriggerCrossfade();
        }
        cfRafId = requestAnimationFrame(scan);
    };
    cfRafId = requestAnimationFrame(scan);
}

// 🚀 根治「即时专辑封面」：提前预读下一首封面（双轨交叉淡变已知 nextIdx）
//   顺序模式：当前歌一开始播放就预读 currentIndex+1，过渡时封面早已常驻；
//   shuffle 模式：getNextTrackIndex() 每次返回新随机数，无法提前预读，转由
//   cfTriggerCrossfade 在过渡触发点与音频预加载「并行」提取（见 coverP）。
//   此处不受交叉淡变开关限制——即便关闭交叉淡变，也预读下一首，保证切歌即现封面。
function prereadNextCover(idx) {
    const ns = playlist[idx];
    if (!ns) return;
    ensureArt(ns).then(art => { if (art) touchArt(ns); }).catch(() => {});
}

// 🔥 v2.8.9: 提前预加载（当前歌曲播放到 50% 时预加载下一首到被动槽）
function cfPreloadNext() {
    if (cfPreloadTimer) clearTimeout(cfPreloadTimer);
    const nextIdx = getNextTrackIndex();
    if (nextIdx < 0) return;
    // 🚀 封面预读：不受交叉淡变开关限制，当前歌一开始播放就预读下一首封面
    //   🚀 v3.6.x: 一键节能时跳过——省去每首歌一次文件解析+jsmediatags+降采样（当前歌封面仍由 playAudio 兜底，不受影响）
    if (!oneClickEnergySaving) prereadNextCover(nextIdx);
    if (!crossfadeEnabled || playlist.length < 2) return;
    // 🔥 v2.8.9 修复：以「当前活跃槽」时长为准，交叉淡变后活跃槽为 cfAudioB 时也能正确预加载
    const activeAudio = cfGetActiveAudio();
    if (!activeAudio.duration) return;
    const preloadAt = Math.max((activeAudio.duration - crossfadeDuration - 1) * 1000, 0);
    if (preloadAt <= 0) return;
    cfPreloadTimer = setTimeout(() => {
        const n = getNextTrackIndex();
        if (n < 0) return;
        const passive = cfGetPassiveAudio();
        // 🔥 v3.6.3: 防御——若 cfActive 错位导致「被动槽」恰好正在发声，
        //   绝不允许用下一首覆盖正在播放的音频（曾导致「界面显示 X 实际播放 Y」错位）。
        //   此时改为预加载到另一个（真正空闲的）槽。
        const target = (!passive.paused && !passive.ended) ? cfGetActiveAudio() : passive;
        if (cfActive === 'A') { if (target === audio) cfSlotIdxA = n; else cfSlotIdxB = n; }
        else { if (target === cfAudioB) cfSlotIdxB = n; else cfSlotIdxA = n; }
        if (!target.src || target.src !== playlist[n].url) {
            target.src = playlist[n].url;
            target.load();
        }
    }, preloadAt);
}

// 🔥 v2.8.9 增强：应用增益斜坡（支持多种淡变曲线）
function cfApplyRamp(activeGain, passiveGain, userVol, dur, now, curve, aAdj, pAdj) {
    const aTarget = userVol * (aAdj || 1);
    const pTarget = userVol * (pAdj || 1);
    activeGain.gain.cancelScheduledValues(now);
    passiveGain.gain.cancelScheduledValues(now);
    activeGain.gain.setValueAtTime(aTarget, now);
    passiveGain.gain.setValueAtTime(0, now);
    switch (curve) {
        case 'linear':
            activeGain.gain.linearRampToValueAtTime(0.001, now + dur);
            passiveGain.gain.linearRampToValueAtTime(pTarget, now + dur);
            break;
        case 'equal-power': {
            const pts = 32;
            const aC = new Float32Array(pts);
            const pC = new Float32Array(pts);
            for (let i = 0; i < pts; i++) {
                const theta = (i / (pts - 1)) * Math.PI / 2;
                aC[i] = Math.cos(theta) * aTarget;
                pC[i] = Math.sin(theta) * pTarget;
            }
            activeGain.gain.setValueCurveAtTime(aC, now, dur);
            passiveGain.gain.setValueCurveAtTime(pC, now, dur);
            break;
        }
        default: // exponential
            activeGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            passiveGain.gain.exponentialRampToValueAtTime(pTarget, now + dur);
            break;
    }
}

// 🔥 v3.6.2: 采样 AnalyserNode 的频域 RMS（响度归一化辅助）
function cfSampleRMS(analyser, samples) {
    if (!analyser) return 0.5;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let sum = 0, cnt = analyser.frequencyBinCount;
    for (let s = 0; s < samples; s++) {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < cnt; i++) {
            const v = data[i] / 255;
            sum += v * v;
        }
    }
    return Math.sqrt(sum / (samples * cnt));
}

// 🔥 v3.6.2: 更新进度条 airlock 视觉 + 交叉淡变可视指示条
function cfUpdateAirLockUI(locked) {
    [el.progAreaMain, el.immProgArea].forEach(a => {
        if (!a) return;
        if (locked) a.classList.add('cf-airlock');
        else a.classList.remove('cf-airlock');
    });
}

// 🔥 v3.6.2: 交叉淡变可视指示条 — 在进度条上方显示淡变进度
let _cfVisTimer = null;
function cfCrossfadeVisStart() {
    cfCrossfadeVisStop();
    const pct = { v: 0 };
    const tick = () => {
        pct.v = Math.min(pct.v + 0.02, 1);
        [el.progAreaMain, el.immProgArea].forEach(a => {
            if (!a) return;
            let bar = a.querySelector('.cf-vis-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'cf-vis-bar';
                a.appendChild(bar);
            }
            bar.style.transform = `scaleX(${pct.v})`;
        });
        if (pct.v < 1) _cfVisTimer = requestAnimationFrame(tick);
    };
    _cfVisTimer = requestAnimationFrame(tick);
    // 🔥 v3.6.2: 增强发光效果
    setTimeout(() => {
        document.querySelectorAll('.cf-vis-bar').forEach(b => b.classList.add('enhanced'));
    }, 50);
}
function cfCrossfadeVisStop() {
    if (_cfVisTimer) { cancelAnimationFrame(_cfVisTimer); _cfVisTimer = null; }
    [el.progAreaMain, el.immProgArea].forEach(a => {
        if (!a) return;
        const bar = a.querySelector('.cf-vis-bar');
        if (!bar) return;
        // 🚀 v3.6.2: 退场动画 → 不再立即 remove
        if (bar.classList.contains('exiting')) return;
        bar.classList.remove('enhanced', 'flowing');
        bar.classList.add('exiting');
        bar.style.setProperty('--cf-exit-scale', bar.style.transform || 'scaleX(1)');
        setTimeout(() => { if (bar.parentNode) bar.remove(); }, 380);
    });
}

// 🔥 v3.6.2: 交叉淡变 / 手动切歌 共用的「歌曲 UI 同步」
// 集中处理：标题/歌手/文档标题、文件信息、专辑封面+取色、--album-color、no-art、
// ThemeColor 标题栏配色、WCO 标题栏曲目、主题逻辑、Media Session 元数据+控制回调+位置状态。
// 两端（playAudio 手动切歌 / cfFinishTransition 交叉淡变切歌）统一调用，杜绝 UI 不一致。
async function cfSyncSongUI(song) {
    if (!song) return;

    // 🔥 v3.6.2: 交叉淡变时存一份旧封面 src，用于后续溶解动画
    const oldArtSrc = el.mainArt && el.mainArt.src ? el.mainArt.src : null;
    const isCrossfade = cfState === CfState.FADING;

    // 🚀 v3.6.x: 切歌时取消上一首歌词可能仍在进行的平滑滚动，避免平滑滚动队列累积导致滚到错误位置
    if (el.lrcView) el.lrcView.scrollTop = el.lrcView.scrollTop;

    // 标题 / 歌手 / 文档标题（双界面同步）—— 加空值守卫，防止 init 未完成时 DOM 未就绪抛 TypeError
    if (el.mainTitle) el.mainTitle.textContent = song.title;
    if (el.immTitle) el.immTitle.textContent = song.title;
    if (el.mainArtist) el.mainArtist.textContent = song.artist;
    if (el.immArtist) el.immArtist.textContent = song.artist;
    document.title = `♪ ${song.title} - ${song.artist} ｜ MBolka`;

    // 🔥 v3.6.2: 分阶滑入动画——交叉淡变时触发，手动切歌瞬间到位
    if (isCrossfade) {
        el.mainTitle.classList.remove('cf-text-enter', 'stagger');
        el.mainArtist.classList.remove('cf-text-enter', 'stagger');
        el.immTitle.classList.remove('cf-text-enter', 'stagger');
        el.immArtist.classList.remove('cf-text-enter', 'stagger');
        void el.mainTitle.offsetWidth; // 🚀 v3.6.x: FLIP 重排——强制同步布局后再加过渡类，确保歌名滑入动画触发
        el.mainTitle.classList.add('cf-text-enter');
        el.mainArtist.classList.add('cf-text-enter', 'stagger');
        el.immTitle.classList.add('cf-text-enter');
        el.immArtist.classList.add('cf-text-enter', 'stagger');
    }

    // 文件信息
    el.fileInfo.innerHTML = `📄 ${song.file.name} <span style="opacity:0.5; margin-left:10px;">(${(song.file.size/1048576).toFixed(2)} MB)</span>`;

    // 专辑封面 + 取色
    hasCurrentAlbumArt = !!song.art;
    // 🚀 v3.0.1: 播放成功时移除加载失败状态
    if (el.artBox) el.artBox.classList.remove('load-error');
    if (hasCurrentAlbumArt) {
        el.mainArt.src = el.immArt.src = song.art;

        // 🔥 v3.6.2: 封面溶解 — 旧封面覆盖层淡出（仅交叉淡变时）
        if (isCrossfade && oldArtSrc && oldArtSrc !== song.art && el.artBox) {
            const overlay = document.createElement('div');
            overlay.className = 'art-crossfade-overlay';
            overlay.innerHTML = `<img src="${escapeHTML(oldArtSrc)}">`;
            el.artBox.appendChild(overlay);
            void overlay.offsetWidth; // 强制重排后触发 transition
            overlay.style.opacity = '0';
            // 淡变完成后自动移除（兜底 3.2s，实际 CF duration 约 3s）
            setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 3200);
        }

        // 🚀 v3.6.x: 节能态（含一键/临时/不可见）跳过 canvas 像素采样取色，复用上一首主题色以省 CPU。
        //   首曲（currentAlbumColor 尚未建立）仍取一次建立基线；之后每曲沿用缓存色——外观静态降级但省电。
        if (shouldBeEnergySaving() && currentAlbumColor) {
            // 复用上一首 currentAlbumColor / currentAlbumTopColor，跳过 extractColor / extractTopColor 采样
        } else {
            currentAlbumColor = await extractColor(song.art);
            // 🚀 v3.4.2: 同步采样专辑封面顶部附近颜色，用于 WCO 假沉浸标题栏
            currentAlbumTopColor = await extractTopColor(song.art, 0.2);
        }
        // 设置专辑环境光阴影 CSS 变量
        if (currentAlbumColor) {
            document.documentElement.style.setProperty('--album-color', currentAlbumColor + '80');
        }
        el.mainColAlbum.classList.remove('no-art'); el.immTrackCard.classList.remove('no-art');
    } else {
        el.mainArt.src = el.immArt.src = "";
        currentAlbumColor = null;
        currentAlbumTopColor = null;
        document.documentElement.style.setProperty('--album-color', 'rgba(0,0,0,0.5)');
        el.mainColAlbum.classList.add('no-art'); el.immTrackCard.classList.add('no-art');
    }

    // 🚀 v3.2.2: 标题栏配色统一处理——有封面取色，无封面/取色失败回调默认色
    // 🚀 v3.4.2: 同时把顶部取色传给 ThemeColor，让 WCO 右上金刚键背景跟随页面顶部
    // 🩹 v3.5.1: 兜底从已加载的 DOM <img> 直接采样（避免 new Image() 对 blob URL 加载失败）
    if (typeof ThemeColor !== 'undefined') {
        ThemeColor.update(currentAlbumColor);
        // 先用 async 提取的结果（可能为 null）
        let safeTopColor = currentAlbumTopColor;
        // 如果 async 提取失败但有 DOM img，直接采样兜底
        if (!safeTopColor && hasCurrentAlbumArt && el.mainArt && el.mainArt.complete) {
            safeTopColor = extractTopColorFromElement(el.mainArt, 0.2);
            if (safeTopColor) currentAlbumTopColor = safeTopColor; // 缓存更新
        }
        ThemeColor.updateTopColor(safeTopColor);
    }

    // 🚀 v3.2.2: 实时同步 WCO 标题栏曲目标题（随切歌即时更新）
    if (typeof WCO !== 'undefined' && WCO.setTrack) WCO.setTrack(song.title, song.artist);

    // 主题逻辑（依赖 currentAlbumColor）
    applyThemeLogic();

    // Media Session 元数据 + 控制回调 + 位置状态
    // 🔥 v3.6.2: seek/position 控制目标跟随「当前正在发声的槽」(getActivePlayAudio)，
    // 交叉淡变进行中指向正在淡入的新歌、完成后指向新活跃槽，避免系统媒体中心定位冻结在旧槽。
    if ('mediaSession' in navigator) {
        const ap = getActivePlayAudio();
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title, artist: song.artist,
            artwork: song.art ? [{ src: song.art, sizes: '512x512', type: 'image/jpeg' }] : []
        });
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', goPrev);
        navigator.mediaSession.setActionHandler('nexttrack', goNext);
        navigator.mediaSession.setActionHandler('seekto', (d) => {
            if (d.seekTime) ap.currentTime = d.seekTime;
        });
        navigator.mediaSession.setActionHandler('seekbackward', (d) => {
            ap.currentTime = Math.max(0, ap.currentTime - (d.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler('seekforward', (d) => {
            ap.currentTime = Math.min(ap.duration, ap.currentTime + (d.seekOffset || 10));
        });
        // PositionState 实时同步
        if ('setPositionState' in navigator.mediaSession) {
            navigator.mediaSession.setPositionState({
                duration: ap.duration || 0,
                playbackRate: playbackRate,
                position: ap.currentTime || 0
            });
        }
    }
}

// 🔥 v3.6.2: 交叉淡变引擎重构 — rAF 驱动 volume 淡变（移除 Web Audio GainNode）
async function cfTriggerCrossfade() {
    if (cfState !== CfState.IDLE || cfAirLocked) return;
    cfState = CfState.PRELOADING;
    cfAirLocked = true;

    const tid = ++cfTransitionId;
    const userVol = parseFloat(el.volSlider.value);
    const nextIdx = getNextTrackIndex();
    if (nextIdx < 0) { cfState = CfState.IDLE; cfAirLocked = false; return; }
    // 🔥 v3.6.2: 缓存淡变参数，供 onAudioEnded 在后台 rAF 冻结时强制收尾使用
    _cfPendingNextIdx = nextIdx;
    _cfPendingNextVol = userVol;

    const passiveEl = cfGetPassiveAudio();
    const activeEl = cfGetActiveAudio();
    const targetUrl = playlist[nextIdx].url;

    // 🚀 并发预提取下一首封面（与下方音频预加载「并行」，根治即时封面）。
    //   顺序模式：cfPreloadNext 已提前预读→此处缓存命中即时；
    //   shuffle 模式：next 在过渡触发点才确定，故在此与音频加载重叠提取，不额外增加过渡延迟。
    const coverP = ensureArt(playlist[nextIdx]).then(a => { if (a) touchArt(playlist[nextIdx]); }).catch(() => null);

    // 仅当被动槽不是同一 URL 时才重新加载
    if (passiveEl.src !== targetUrl || passiveEl.readyState < 2) {
        passiveEl.src = targetUrl;
        passiveEl.load();
    }
    // 🔥 v3.6.3: 记录被动槽即将装载的索引（供错位检测/自愈）
    if (cfActive === 'A') cfSlotIdxB = nextIdx; else cfSlotIdxA = nextIdx;

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
        if (tid !== cfTransitionId) return;
        console.warn('交叉淡变预加载失败，直接切歌', e);
        cfState = CfState.IDLE; cfAirLocked = false;
        goNext();
        return;
    }

    // 🚀 封面已在上方与音频并行提取，此处落定——保证 cfSyncSongUI 时 song.art 必现（主界面/PiP/沉浸舱即时）
    await coverP;

    // 🔥 v3.6.2: 日志 — 交叉淡变开始
    logError('CF_START', `交叉淡变开始: ${playlist[nextIdx]?.title} → ${playlist[currentIndex]?.title}`, playlist[nextIdx]?.file);
    cfState = CfState.FADING;
    cfUpdateAirLockUI(true);
    cfCrossfadeVisStart();

    // 🔥 v3.6.2: 下一首一开始播放即视为切歌——立即同步全部歌曲信息（标题/封面/取色/环境光/
    // 文件信息/WCO/系统媒体中心/进度基准），杜绝交叉淡变残留旧歌信息。
    // cfState 已置 FADING，故 getActivePlayAudio() 此刻起指向正在淡入的新歌（被动槽），
    // 进度条与 Media Session 也同步切到下一首。内部取色为 async，标题/封面前置同步即时生效。
    cfSyncSongUI(playlist[nextIdx]);

    // 🔥 v3.6.2: 新歌音频开始介入即切换歌词（而非等到下一首第一句歌词唱出）。
    // 早于 cfFinishTransition 调用，使歌词栏在交叉淡变起点就更新为下一首歌词（置顶、待第一句点亮）。
    loadLrc(playlist[nextIdx]);

    // 启动被动槽（volume=0，听不见）
    passiveEl.volume = 0;
    passiveEl.currentTime = 0;
    passiveEl.playbackRate = activeEl.playbackRate;
    passiveEl.preservesPitch = activeEl.preservesPitch;
    passiveEl.play().catch(e => {
        console.error('交叉淡变播放失败', e);
        // 🔥 v3.6.2: 过渡可能已被 onAudioEnded / visibilitychange 强制完成
        // （后台 rAF 冻结期 active 槽自然结束 → onAudioEnded 已 cfFinishTransition，
        //  此时 cfState 已为 IDLE，若再 cfAbortTransition 会重置音量/状态 + goNext 再跳一首）
        if (cfState !== CfState.FADING && cfState !== CfState.PRELOADING) return;
        // 🔥 v3.6.2: 后台标签页中被动槽 play() 常被自动播放策略拦截（无新手势）。
        //   此时若 abort+goNext 会跳到「下一首的下一首」且仍可能被拦截 → 静默停止。
        //   改为：保留 cfState=FADING，旧活跃槽继续播；待旧槽自然结束 → onAudioEnded 触发
        //   CF_FORCE_FINISH → cfFinishTransition（已补齐 newActive.play()）→ 切到正确的下一首，不跳歌。
        if (document.hidden) return;
        cfAbortTransition(tid);
        goNext();
        return;
    });

    // rAF 驱动 volume 渐弱渐强（easeInOutQuad）
    const startTime = performance.now();
    const durMs = crossfadeDuration * 1000;
    const startVol = activeEl.volume;

    const fade = () => {
        // 🔥 v3.6.2: 过渡已被其他路径（onAudioEnded/visibilitychange）强制完成，
        // cfState 已为 IDLE → fade 直接退出，不操作 passiveEl（现已翻转为新活跃槽）。
        if (cfState !== CfState.FADING) return;
        if (tid !== cfTransitionId) {
            passiveEl.volume = 0; passiveEl.pause();
            return;
        }
        const t = Math.min((performance.now() - startTime) / durMs, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        activeEl.volume = startVol * (1 - ease);
        passiveEl.volume = userVol * ease;

        if (t < 1) {
            requestAnimationFrame(fade);
        } else {
            cfFinishTransition(nextIdx, userVol, tid);
        }
    };
    requestAnimationFrame(fade);

    // 🔥 v3.6.2: 后台标签页中 requestAnimationFrame 会被浏览器暂停，导致淡变 rAF 永远跑不到 t>=1，
    // cfState 卡在 FADING、进度条/控制面冻结（表现为「放几首后卡住不动」）。
    // 用 setTimeout 兜底强制收尾——cfFinishTransition 顶部一次性守卫保证与 rAF 路径不会重复执行。
    setTimeout(() => {
        if (tid === cfTransitionId && cfState === CfState.FADING) cfFinishTransition(nextIdx, userVol, tid);
    }, durMs + 120);
}

// 🔥 v3.6.2: 完成交叉淡变过渡（volume 方案 — 移除所有 GainNode 操作）
async function cfFinishTransition(nextIdx, userVol, tid) {
    if (tid !== cfTransitionId) {
        // 🔥 v3.6.2: 日志 — 过渡被更新的 transitionId 废弃（后续有新的淡变启动）
        logError('CF_SKIP_TID', `cfFinishTransition 跳过(tid=${tid} !== ${cfTransitionId})`, null);
        return;
    }
    // 🔥 v3.6.2: 一次性守卫——rAF 收尾与 setTimeout 兜底二选一，防止重复执行
    if (cfState !== CfState.FADING) {
        // 🔥 v3.6.2: 日志 — 过渡已被其他路径（onAudioEnded/visibilitychange）强制完成
        logError('CF_SKIP_STATE', `cfFinishTransition 跳过(cfState=${cfState}, expected FADING)`, null);
        return;
    }
    logError('CF_FINISH', `交叉淡变完成: curIdx=${currentIndex}→${nextIdx}, vol=${userVol}, tid=${tid}`, null);
    cfState = CfState.IDLE;
    cfAirLocked = false;
    cfUpdateAirLockUI(false);
    cfCrossfadeVisStop();
    // 🔥 v3.6.2: 清理可能残留的封面溶解覆盖层
    document.querySelectorAll('.art-crossfade-overlay').forEach(el => el.remove());

    // 停止旧活跃槽（不再置空 onended——双槽 onended 已统一永久绑定，置空会破坏关闭淡入淡出后的续播）
    const oldActive = cfGetActiveAudio();
    oldActive.pause();
    oldActive.volume = 0;

    // 🔥 交换槽位：新歌曲成为活跃槽
    cfActive = cfActive === 'A' ? 'B' : 'A';
    const newActive = cfGetActiveAudio();
    newActive.volume = userVol;
    // 🔥 v3.6.2: 确保新活跃槽真正在播放（淡变结束时被动槽可能因后台自动播放策略被拦截而从未 play，
    //   仅设音量会导致「淡变完成即静默停止」；此处补齐 play，前台为 no-op、后台为重试）。
    newActive.play().catch(() => {});
    // 🔥 v3.6.3: 记录新活跃槽实际装载的索引
    if (cfActive === 'A') cfSlotIdxA = nextIdx; else cfSlotIdxB = nextIdx;
    // 🔥 v3.6.3: 错位防御——若新活跃槽 src 与下一首不符（极少数 cfActive 错位场景），
    //   直接重载其为正确歌曲，确保「界面 currentIndex」与「实际发声音频」一致。
    if (playlist[nextIdx] && newActive.src && newActive.src !== playlist[nextIdx].url) {
        newActive.src = playlist[nextIdx].url;
        newActive.load();
        newActive.play().catch(() => {});
    }

    // 更新状态
    currentIndex = nextIdx;
    const song = playlist[currentIndex];

    // 🔥 v3.6.2: UI 同步已在 cfTriggerCrossfade 启动被动槽时提前完成（下一首开始播放即视为切歌），
    // 此处无需重复 cfSyncSongUI，避免重复取色造成的封面闪烁。

    // 同步播放速度
    newActive.playbackRate = playbackRate;
    newActive.preservesPitch = preservesPitch;

    // 🔥 v3.6.2: 无需在此重新绑定 onended——主槽 audio 与备用槽 cfAudioB 已在初始化时
    // 永久绑定统一的 onAudioEnded 处理器（见 audio.onended / initCrossfadeEngine）。

    setPlayState(true);
    // 🔥 v3.6.2: 歌词已在 cfTriggerCrossfade 新歌介入时提前切换（loadLrc(playlist[nextIdx])），此处不再重复。
    renderPlaylist();
    recordPlay(song);
    updateFavQuickBtn();
    updatePipQuickBtn();

    // 🔥 v3.6.3: 交叉淡变完成后显式同步总时长，防止 loadedmetadata 未正确更新导致「界面仍显示旧歌时长」
    const _dur = newActive.duration || 0;
    if (_dur > 0 && isFinite(_dur)) {
        el.timeTot.textContent = formatTime(_dur);
        const _immTimeTot = document.getElementById('immTimeTot');
        if (_immTimeTot) _immTimeTot.textContent = formatTime(_dur);
    }

    // 预加载下一首（被动槽现在是空的）
    cfPreloadNext();
}

// 🔥 v3.6.2: 紧急中止交叉淡变（volume 方案）
function cfAbortTransition(tid) {
    if (tid !== cfTransitionId) return;
    // 🔥 v3.6.2: 日志 — 交叉淡变被中止
    logError('CF_ABORT', `交叉淡变中止(tid=${tid})`, null);
    cfState = CfState.IDLE;
    cfAirLocked = false;
    cfUpdateAirLockUI(false);
    cfCrossfadeVisStop();
    // 🔥 v3.6.2: 清理可能残留的封面溶解覆盖层
    document.querySelectorAll('.art-crossfade-overlay').forEach(el => el.remove());
    const passive = cfGetPassiveAudio();
    passive.volume = 0;
    passive.pause();
    // 🔥 v3.6.2: 中止时回滚歌曲信息到「当前仍在播放的旧曲」，避免提前切到下一首的 UI 残留
    if (playlist[currentIndex]) cfSyncSongUI(playlist[currentIndex]);
}

// 🚀 v3.6.x: 一键节能时自动暂停/恢复交叉淡变（不丢失用户设置）
//   仅由 ONE_CLICK 节能触发；PIP_TEMP / VISIBILITY 不触碰，保持「仅优化主界面性能」初衷。
//   收益：省去淡变重叠期（默认 3s）双路 <audio> 同时解码的 CPU 翻倍；停掉扫描器 rAF + 预加载定时器。
let cfSuspendedByEnergy = false;
let cfUserEnabledBeforeSuspend = false;

function cfSuspendForEnergy() {
    if (cfSuspendedByEnergy) return;
    cfUserEnabledBeforeSuspend = crossfadeEnabled;   // 记住用户原设置，恢复时回填
    cfSuspendedByEnergy = true;
    crossfadeEnabled = false;
    // 停扫描器 + 预加载定时器
    if (cfRafId) { cancelAnimationFrame(cfRafId); cfRafId = null; }
    if (cfPreloadTimer) { clearTimeout(cfPreloadTimer); cfPreloadTimer = null; }
    // 若淡变进行中，立即中止转为单轨（回退到当前歌 UI）
    if (cfState !== CfState.IDLE || cfAirLocked) cfAbortTransition(cfTransitionId);
}

function cfResumeFromEnergy() {
    if (!cfSuspendedByEnergy) return;
    cfSuspendedByEnergy = false;
    crossfadeEnabled = cfUserEnabledBeforeSuspend;
    if (crossfadeEnabled) { cfSetupScanner(); cfPreloadNext(); }
}

// 🔥 v3.6.2: 后台播放看门狗（setTimeout，后台不会被完全冻结，兜底 rAF 冻结缺陷）
// 🔥 v3.6.3: 强化——杜绝「界面显示 X、实际播放 Y」的活跃槽/UI 错位（见下方槽内重载 + 自愈）。
let _watchdogTimer = null;
const startPlaybackWatchdog = () => {
    if (_watchdogTimer) return;
    const tick = () => {
        _watchdogTimer = setTimeout(tick, document.hidden ? 1000 : 750);
        if (!isPlaying || cfSuspendedByEnergy || isRepeatOne || !playlist.length) return;

        // 后台淡变卡死：旧活跃槽被暂停→静默，强制完成让新曲接力
        if (document.hidden && cfState === CfState.FADING && cfGetActiveAudio().paused && _cfPendingNextIdx >= 0) {
            if (typeof logError === 'function') logError('WD_CF_FINISH', '看门狗: 后台淡变卡死，强制完成', null);
            cfFinishTransition(_cfPendingNextIdx, _cfPendingNextVol, cfTransitionId);
            return;
        }

        const active = getActivePlayAudio();
        if (!active) return;

        // 媒体已播到末尾但 `ended` 未触发（后台极端情况）→ 槽内续播下一首。
        // 🔥 v3.6.3: 必须用「槽内重载」而非 goNext()——goNext→playAudio 会强制翻转 cfActive='A'，
        //   而实际发声槽可能是 cfAudioB，导致 cfActive 错位→后续 cfPreloadNext 把下一首覆盖到正在发声的槽，
        //   造成「界面显示 X、实际播放 Y」（本例：界面 Rise、实际 张杰）。槽内重载保持 cfActive 不变。
        if (active.ended) {
            const ni = getNextTrackIndex();
            if (ni >= 0 && playlist[ni]) {
                if (typeof logError === 'function') logError('WD_ENDED', `看门狗: 活跃槽已结束, 槽内续播下一首 ${playlist[ni]?.title}`, null);
                currentIndex = ni;
                if (cfActive === 'A') cfSlotIdxA = ni; else cfSlotIdxB = ni;
                active.src = playlist[ni].url;
                active.load();
                active.playbackRate = playbackRate;
                active.preservesPitch = preservesPitch;
                active.volume = parseFloat(el.volSlider.value);
                active.play().catch(() => {});
                cfSyncSongUI(playlist[ni]);
                loadLrc(playlist[ni]);
                recordPlay(playlist[ni]);
                renderPlaylist();
                updateFavQuickBtn();
                updatePipQuickBtn();
                cfPreloadNext();
            }
            return;
        }

        // 媒体被外部暂停（后台节流/卡顿）但应播放→自动续播
        if (active.paused && active.currentTime > 0) {
            if (typeof logError === 'function') logError('WD_RESUME', `看门狗恢复暂停媒体: ${playlist[currentIndex]?.title}`, null);
            active.play().catch(() => {});
        }

        // 🔥 v3.6.3: 错位自愈——正在发声（或当前活跃）的槽其装载歌曲与 UI 的 currentIndex 不符
        // （界面显示 X、实际播放 Y），以 currentIndex 为准重载该槽，使音频与界面一致。
        // 仅当 cfState=IDLE（淡变进行中允许新槽≠currentIndex）且歌曲尚未结束。
        if (cfState === CfState.IDLE && crossfadeEnabled) {
            const slots = [
                { el: audio, idx: cfSlotIdxA, set: v => cfSlotIdxA = v, name: 'A' },
                { el: cfAudioB, idx: cfSlotIdxB, set: v => cfSlotIdxB = v, name: 'B' }
            ];
            for (const s of slots) {
                const isActiveSlot = (cfActive === 'A') ? (s.el === audio) : (s.el === cfAudioB);
                if (s.el && !s.el.ended && s.idx >= 0 && s.idx !== currentIndex && playlist[currentIndex]
                    && (!s.el.paused || isActiveSlot)) {
                    if (typeof logError === 'function') logError('WD_RESNC', `看门狗自愈: 槽${s.name}装${playlist[s.idx]?.title} 但UI=${playlist[currentIndex]?.title}, 重载为UI曲目`, null);
                    s.set(currentIndex);
                    s.el.src = playlist[currentIndex].url;
                    s.el.load();
                    s.el.volume = parseFloat(el.volSlider.value);
                    s.el.play().catch(() => {});
                }
            }
        }
    };
    tick();
};

// === 播放控制 ===
const playAudio = async (idx) => {
    if (!playlist[idx]) return;
    
    // 🔥 v3.6.2: 手动切歌时彻底重置交叉淡变引擎到干净状态（主音频槽 A）
    if (cfState !== CfState.IDLE || cfAirLocked || cfActive !== 'A') {
        ++cfTransitionId;
        cfState = CfState.IDLE;
        cfAirLocked = false;
        if (cfPreloadTimer) { clearTimeout(cfPreloadTimer); cfPreloadTimer = null; }
        const oldActive = cfGetActiveAudio();
        oldActive.pause();
        oldActive.volume = 0;
        const passive = cfGetPassiveAudio();
        passive.pause();
        passive.volume = 0;
    }
    audio.volume = parseFloat(el.volSlider.value);
    
    if (currentIndex !== idx) { playHistory.push(idx); if (playHistory.length > 200) playHistory.shift(); currentIndex = idx; }
    const song = playlist[idx];

    // 🔥 v2.8.9: 确保活跃槽指向 audio（手动切歌始终使用主音频槽）
    cfActive = 'A';
    audio.src = song.url;
    cfSlotIdxA = idx; cfSlotIdxB = -1; // 🔥 v3.6.3: 记录主槽装载索引

    // 🚀 v3.4.3: 长音频(>15min)断点续播已移至 onloadedmetadata 处理
    // （原逻辑在 src 刚设置后立刻读取 song.duration，而播放列表项从未携带 duration，
    //   且此时媒体元数据尚未就绪、currentTime 会被浏览器重置，导致续播从未真正生效）



    // 🚀 根治即时封面：手动/自动切歌前确保当前歌封面已提取（被 LRU 淘汰也在此兜底重新提取），
    //   保证主界面/PiP/沉浸舱在 cfSyncSongUI 时即现封面；已常驻则缓存命中即时。
    await ensureArt(song);
    touchArt(song);

    // 🔥 v3.6.2: 公共 UI 同步（手动切歌 + 交叉淡变共用，确保两端 UI 完全一致）
    await cfSyncSongUI(song);

    await loadLrc(song); renderPlaylist();
    recordPlay(song);
    // 更新首页收藏按钮状态
    updateFavQuickBtn();
    // 更新画中画按钮状态
    updatePipQuickBtn();

    // 应用播放速度
    audio.playbackRate = playbackRate;
    audio.preservesPitch = preservesPitch;

    try {
        await audio.play();
        setPlayState(true);
        if(!audioCtx) { initVis(); initEQ(); }
        // 🔥 v2.8.9: 播放开始后预加载下一首
        cfPreloadNext();
    } catch(e) {
        setPlayState(false);
        if (e.name === 'NotAllowedError') {
            // 🩹 v3.2.3: 浏览器自动播放策略拦截 — 监听下一次用户手势自动恢复
            // 🔥 v3.6.2: 后台标签页切歌时 audio.play() 会被浏览器拦截（NotAllowedError），
            //   此时监听 click 无意义（用户不在页面），且点击播放时手势监听和 togglePlay 同时触发造成竞态。
            //   改为在 visibilitychange→visible 时自动恢复播放。
            if (document.hidden) {
                // 注册一次性可见性恢复 → 自动重播
                const resumeOnVisible = () => {
                    document.removeEventListener('visibilitychange', resumeOnVisible);
                    audio.play().then(() => {
                        setPlayState(true);
                        if(!audioCtx) { initVis(); initEQ(); }
                        cfPreloadNext();
                    }).catch(() => {});
                };
                document.addEventListener('visibilitychange', resumeOnVisible);
            } else {
                showToast("点击页面任意位置开始播放", iconSvg('mouse'));
                // 🚀 v3.6.x: 手势恢复监听兜底移除时限；实际 resumeOnGesture 开头已立即移除监听，
                //   15s 仅防"从未交互"时残留（不会永久卡住，因首手势即移除）
                const RESUME_GESTURE_TIMEOUT = 15000;
                const resumeOnGesture = async () => {
                    document.removeEventListener('click', resumeOnGesture);
                    document.removeEventListener('keydown', resumeOnGesture);
                    try {
                        await audio.play();
                        setPlayState(true);
                        showToast("播放已恢复", iconSvg('play'));
                        if(!audioCtx) { initVis(); initEQ(); }
                        cfPreloadNext();
                    } catch(e2) {
                        showToast("播放受阻，请检查音频文件", iconSvg('x'));
                    }
                };
                document.addEventListener('click', resumeOnGesture);
                document.addEventListener('keydown', resumeOnGesture);
                // 15 秒后自动移除监听，防止内存泄漏（兜底，正常首手势即移除）
                setTimeout(() => {
                    document.removeEventListener('click', resumeOnGesture);
                    document.removeEventListener('keydown', resumeOnGesture);
                }, RESUME_GESTURE_TIMEOUT);
            }
        } else {
            showToast("播放受阻", iconSvg('x'));
        }
    }
};

// 🚀 v3.4.x: 只切换按钮内置 <use> 的图标，避免 textContent 覆盖掉 SVG 图标
// 🚀 v3.5.0: 复用统一 setBtnIcon helper
function _syncPlayIcon(btn, playing) {
    setBtnIcon(btn, playing ? 'pause' : 'play');
}

const setPlayState = (playing) => {
    isPlaying = playing;
    _syncPlayIcon(el.btnPlay, playing);
    _syncPlayIcon(el.immBtnPlay, playing);
    el.btnPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    el.immBtnPlay.setAttribute('aria-label', playing ? '暂停' : '播放');
    if(playing && !audioCtx) { initVis(); initEQ(); }
};

const togglePlay = () => {
    if (!playlist.length) return el.btnLoad.click();
    // 🔥 v3.6.2: 用「当前正在发声的槽」且以媒体真实状态为准，避免 isPlaying 与媒体脱节时
    // （后台媒体被暂停但 isPlaying 仍 true）点了反而暂停 / 播放的不是当前歌。
    const active = getActivePlayAudio();
    const actuallyPlaying = isPlaying && !active.paused && !active.ended;
    if (actuallyPlaying) {
        active.pause();
        saveLongAudioProgress(); // 🚀 v3.4.3: 暂停时立即记录长音频进度
        setPlayState(false);
    }
    else {
        // 恢复时确保活跃槽音量跟随用户设定（防止异常态下被置 0 导致无声）
        active.volume = parseFloat(el.volSlider.value);
        active.play().catch(() => {});
        cfPreloadNext(); // 🔥 v2.8.9: 恢复播放后预加载
        setPlayState(true);
    }
    createRipple(window.innerWidth/2, window.innerHeight/2);
};

const goNext = () => {
    if(!playlist.length) return;
    if (isRepeatOne) {
        const ap = getActivePlayAudio();
        ap.currentTime = 0;
        ap.play();
        setPlayState(true);
        return;
    }
    // 🚀 v3.4.3: 切歌前记录当前长音频进度（避免 <10s 窗口丢失）
    saveLongAudioProgress();
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
    // 🚀 v3.4.3: 切歌前记录当前长音频进度
    saveLongAudioProgress();
    if (isRepeatOne) {
        const ap = getActivePlayAudio();
        ap.currentTime = 0;
        ap.play();
        setPlayState(true);
        return;
    }
    if(isShuffle) {
        playHistory.pop();
        playAudio(playHistory.length ? playHistory.pop() : Math.floor(Math.random()*playlist.length));
    } else playAudio((currentIndex - 1 + playlist.length) % playlist.length);
    createExplosion(window.innerWidth*0.2, window.innerHeight/2, 2);
};

// 🔥 v3.6.2: 解码错误处理器（主槽 + 备用槽共用），用 e.target 区分出错的槽
function onAudioError(e) {
    const song = playlist[currentIndex];
    if (song) {
        song.error = true;
        logError('PLAY_ERROR', `解码失败: ${e.target.error ? e.target.error.code : 'unknown'}`, song.file);
        renderPlaylist();
        showToast(`解码失败: ${song.title}，自动跳过`, iconSvg('alert'));
    }
    // 🚀 v3.0.1: 音频加载失败状态
    if (el.artBox) el.artBox.classList.add('load-error');
    setTimeout(() => goNext(), 500);
}
forEachAudioEl(el => el.addEventListener('error', onAudioError));

// A-B 重复模式
let abLongPressTimer = null;
function startABMode() {
    abMode = true; abPointA = null; abPointB = null;
    el.btnPlay.classList.add('ab-active');
    el.immBtnPlay.classList.add('ab-active');
    hideABMarkers();
    showToast("A-B重复模式: 请先设置A点 (点击进度条)", iconSvg('target'));
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
    const duration = getActivePlayAudio().duration;
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
    const ap = getActivePlayAudio();
    if (!ap.duration) return;
    // 🔥 v2.8.13p4: 统一使用 getBoundingClientRect() 计算 left 和 width，消除 offsetWidth 混用偏移
    const rect = container.getBoundingClientRect();
    const clickTime = ((e.clientX - rect.left) / rect.width) * ap.duration;
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
            ap.currentTime = abPointA;
            ap.play();
        } else {
            abPointA = clickTime; abPointB = null;
            hideABMarkers();
            updateABMarkers();
            showToast(`A点重新设置: ${formatTime(abPointA)}`);
        }
        return;
    }
    ap.currentTime = clickTime;
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
        const ap = getActivePlayAudio();
        if (!ap.duration) return 0;
        const rect = cachedRect || progArea.getBoundingClientRect();
        
        // 计算点击位置占进度条的比例
        let pct = (clientX - rect.left) / rect.width;
        pct = Math.max(0, Math.min(1, pct)); // 严格限制在 0 ~ 1 之间
        
        // 🚀 v2.7: 进度条改用 transform:scaleX 避免布局重排
        progFill.style.transform = `scaleX(${pct})`;
        
        // 拖拽时实时更新当前数字时间，体验更跟手
        if (timeDisplayEl) {
            timeDisplayEl.textContent = formatTime(pct * ap.duration);
        }
        return pct;
    };

    const handleStart = (e) => {
        // 🔥 v3.6.2: 交叉淡变进行中禁止 seek
        if (cfAirLocked) { return; }
        // 如果开启了 A-B 循环，则拦截拖拽，走 A-B 选点逻辑
        if (abMode) { handleABSeek(e, progArea); return; } 
        
        isProgressDragging = true;
        progArea.classList.add('dragging'); // 🚀 v3.0.0: 拖拽高亮反馈
        cachedRect = progArea.getBoundingClientRect(); // 🚀 按下时缓存一次
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        updateVisuals(clientX);
        // 🚀 v3.3.3: 拖动进度条 = 快速操作，让 coverflow（若打开）暂时取消 3D 偏移，松手后恢复
        if (typeof enterCoverflowFlat === 'function') enterCoverflowFlat();
    };

    const handleMove = (e) => {
        if (!isProgressDragging || abMode || cachedRect === null) return;
        
        // 阻止默认行为（比如防止拖拽时意外选中文字）
        if (e.cancelable) e.preventDefault(); 
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        updateVisuals(clientX);
        // 🚀 v3.3.3: 拖动进度条全程保持 coverflow 平坦（防抖续期）
        if (typeof enterCoverflowFlat === 'function') enterCoverflowFlat();
    };

    const handleEnd = (e) => {
        if (!isProgressDragging || abMode || cachedRect === null) return;
        isProgressDragging = false;
        progArea.classList.remove('dragging'); // 🚀 v3.0.0: 移除拖拽高亮
        
        // 🔥 全部重新取，不依赖任何缓存的 rect 或 updateVisuals
        cachedRect = null; // 清空缓存，确保后续 mousedown 取新 rect
        
        const ap = getActivePlayAudio();
        if (!ap || !ap.duration) return;
        
        const clientX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
        const rect = progArea.getBoundingClientRect();
        let pct = (clientX - rect.left) / rect.width;
        pct = Math.max(0, Math.min(1, pct));
        
        // 直接更新视觉效果
        progFill.style.transform = `scaleX(${pct})`;
        if (timeDisplayEl) {
            timeDisplayEl.textContent = formatTime(pct * ap.duration);
        }
        
        // 松手瞬间，真正修改音频的播放进度（跟随当前活跃槽）
        ap.currentTime = pct * ap.duration;
        
        // 如果是沉浸模式，在点击位置生成特效
        if (!isMain && typeof createExplosion === 'function') {
            createExplosion(clientX, rect.top + 10, 1.5);
        }
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
// 🚀 v3.6.2: 沉浸舱进度条不再复用 bindProgressBar，改用独立纯 handlemndown/mouseup/touch 绑定
// 完全照搬主界面逻辑但独立闭包，避免任何 cachedRect / isProgressDragging 交叉干扰
if (el.immProgArea && el.immProgFill) {
    (function() {
        const pA = el.immProgArea, pF = el.immProgFill, tD = document.getElementById('immTimeCur');
        let cRect = null;
        let _immDragging = false; // 本地拖拽标志，与主条 isProgressDragging 完全隔离

        const onStart = (e) => {
            if (cfAirLocked) return;
            if (abMode) { handleABSeek(e, pA); return; }
            _immDragging = true;
            pA.classList.add('dragging');
            cRect = pA.getBoundingClientRect();
            const cx = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const ap = getActivePlayAudio();
            const pct = ap.duration ? ((cx - cRect.left) / cRect.width) : 0;
            pF.style.transform = `scaleX(${Math.max(0, Math.min(1, pct))})`;
            if (tD) tD.textContent = formatTime(pct * (ap.duration || 1));
            if (typeof enterCoverflowFlat === 'function') enterCoverflowFlat();
        };

        const onMove = (e) => {
            if (!_immDragging || abMode) return;
            if (e.cancelable) e.preventDefault();
            const cx = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const ap = getActivePlayAudio();
            if (!ap.duration) return;
            const pct = (cx - cRect.left) / cRect.width;
            const clamped = Math.max(0, Math.min(1, pct));
            pF.style.transform = `scaleX(${clamped})`;
            if (tD) tD.textContent = formatTime(clamped * ap.duration);
            if (typeof enterCoverflowFlat === 'function') enterCoverflowFlat();
        };

        const onEnd = (e) => {
            if (!_immDragging || abMode) return;
            _immDragging = false;
            pA.classList.remove('dragging');
            const ap = getActivePlayAudio();
            if (!ap || !ap.duration) { cRect = null; return; }
            const cx = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
            const rect = pA.getBoundingClientRect();
            let pct = (cx - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));
            pF.style.transform = `scaleX(${pct})`;
            const seekTime = pct * ap.duration;
            if (tD) tD.textContent = formatTime(seekTime);
            // 🔥 双槽同时 seek：以 `getActivePlayAudio` 为准，但确保 `audio`（显示主槽）也被 seek，
            // 防止 cfActive 错位（如交叉淡变后 cfActive='B' 但界面显示的是 audio）
            ap.currentTime = seekTime;
            if (ap !== audio && audio.duration) audio.currentTime = seekTime;
            cRect = null;
        };

        pA.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        pA.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    })();
}


// 媒体中心位置状态节流标记
let _lastPosState = 0;

// === 进度/元数据/错误事件统一跟随「当前正在发声的槽」(getActivePlayAudio) ===
// 🔥 v3.6.2: 主槽 audio 与备用槽 cfAudioB 都绑定同一组处理器；
// 交叉淡变后活跃槽切到 B 时，进度条/时长/错误/媒体中心定位均不冻结。

// 高频进度刷新：任何槽的 timeupdate 都按「当前活跃槽」刷新进度与歌词
function onProgressTick() {
    const pa = getActivePlayAudio();
    if (pa.duration) {
        // 🚀 v2.7: 进度条改用 transform:scaleX 避免布局重排
        if (!isProgressDragging) {
            const pct = pa.currentTime / pa.duration;
            if (el.progFillMain) el.progFillMain.style.transform = `scaleX(${pct})`;
            if (el.immProgFill) el.immProgFill.style.transform = `scaleX(${pct})`;

            if (el.timeCur) el.timeCur.textContent = formatTime(pa.currentTime);
            const immTimeCur = document.getElementById('immTimeCur');
            if (immTimeCur) immTimeCur.textContent = formatTime(pa.currentTime);

            // 🚀 无障碍：同步进度条 slider 的 aria 值（屏幕阅读器可感知进度）
            const progMax = Math.floor(pa.duration);
            [el.progAreaMain, el.immProgArea].forEach(a => {
                if (!a) return;
                if (a.getAttribute('aria-valuemax') !== String(progMax)) {
                    a.setAttribute('aria-valuemax', progMax);
                }
                a.setAttribute('aria-valuenow', Math.floor(pa.currentTime));
                a.setAttribute('aria-valuetext', `${formatTime(pa.currentTime)} / ${formatTime(pa.duration)}`);
            });
        }

        // 🚀 v3.4.3: 长音频(>15min)每10秒记忆播放进度（最后5秒记为0，下次从头播放）
        if (pa.duration > 900 && _pbThrottle < Date.now() - 10000) {
            _pbThrottle = Date.now();
            saveLongAudioProgress();
        }

        // 🚀 v2.7: 节能模式下歌词走低频定时器，跳过此高频回调
        if (!shouldBeEnergySaving()) syncLyrics();

        // A-B 重复判定
        if (abMode && abPointA !== null && abPointB !== null) {
            if (pa.currentTime >= abPointB) pa.currentTime = abPointA;
        }

        // 同步系统媒体中心 (Media Session) — 节流到 ~4Hz 降低系统开销
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
            const now = Date.now();
            if (now - _lastPosState > 250) {
                _lastPosState = now;
                // 🚀 v3.6.x: 防御 duration 为 NaN/Infinity 时 setPositionState 抛 TypeError
                if (!isFinite(pa.duration) || pa.duration <= 0) return;
                navigator.mediaSession.setPositionState({
                    duration: pa.duration,
                    playbackRate: playbackRate,
                    position: pa.currentTime
                });
            }
        }
    }
}

function onAudioLoadedMetadata(e) {
    const pa = getActivePlayAudio();
    // 🔥 v3.6.2: 总时长用「触发事件的元素」自身 duration，而非 getActivePlayAudio()。
    // 交叉淡变预加载阶段(PRELOADING)被动槽 loadedmetadata 触发时，getActivePlayAudio() 仍指向旧歌，
    // 会把总时长错写成上一首、且新歌淡入后 metadata 不再触发 → 总时长永远显示旧歌。
    // 被动槽即新歌，取其真实 duration 即正确；手动切歌时触发元素即新活跃槽，同样正确。
    const srcEl = (e && e.currentTarget && e.currentTarget.duration && isFinite(e.currentTarget.duration)) ? e.currentTarget : pa;
    const dur = srcEl.duration || 0;
    el.timeTot.textContent = formatTime(dur);
    const immTimeTot = document.getElementById('immTimeTot');
    if (immTimeTot) immTimeTot.textContent = formatTime(dur);
    if (abMode) updateABMarkers();
    // 🚀 v3.4.3: 媒体元数据就绪后再设置续播点（此时 currentTime 才能可靠生效）
    applyLongAudioResume(pa);
}

// 🔥 v3.6.3: duration 变化时兜底刷新总时长（VBR/流式音频 duration 可能分多次更新）
function onDurationChange() {
    const pa = getActivePlayAudio();
    if (pa && pa.duration && isFinite(pa.duration) && pa.duration > 0) {
        el.timeTot.textContent = formatTime(pa.duration);
        const immTimeTot = document.getElementById('immTimeTot');
        if (immTimeTot) immTimeTot.textContent = formatTime(pa.duration);
    }
}

// 🔥 v3.6.2: 绑定到所有音频槽（主槽 + 备用槽）
forEachAudioEl(el => el.addEventListener('timeupdate', onProgressTick));
forEachAudioEl(el => el.addEventListener('loadedmetadata', onAudioLoadedMetadata));
forEachAudioEl(el => el.addEventListener('durationchange', onDurationChange));

// 🚀 v3.4.2: 连续(无级)音量调节时的防抖保存，避免每帧写 localStorage（游戏手柄右摇杆连续路径）
let _volSaveTimer = null;
const _scheduleVolSave = () => {
    if (_volSaveTimer) return;
    _volSaveTimer = setTimeout(() => {
        _volSaveTimer = null;
        saveSettings();
    }, 400);
};

// 🔥 v3.6.2: 统一音量控制 — 直接操作 audio 元素 volume（移除 GainNode 路由）
// `skipSave` 为 true 时不做即时保存，改为防抖保存（高频连续调节用，避免每帧落盘）
const cfSetVolume = (vol, skipSave = false) => {
    const activeEl = cfGetActiveAudio();
    if (activeEl && activeEl !== audio) activeEl.volume = vol;
    audio.volume = vol;
    el.volSlider.value = vol;
    if (el.immVolSlider) el.immVolSlider.value = vol;
    const pct = Math.round(vol * 100) + '%';
    const volPctEl = document.getElementById('volPercent');
    if (volPctEl) volPctEl.textContent = pct;
    const immVolPctEl = document.getElementById('immVolPercent');
    if (immVolPctEl) immVolPctEl.textContent = pct;
    if (skipSave) _scheduleVolSave();
    else saveSettings();
};

// 🔥 v2.8.9: 音量滑块事件 — 统一路由到 cfSetVolume
el.volSlider.oninput = (e) => {
    cfSetVolume(parseFloat(e.target.value));
};
const adjustVolume = (delta) => { 
    const newVol = Math.max(0, Math.min(1, audio.volume + delta));
    cfSetVolume(newVol);
};
// 🚀 v3.4.2: 无级音量调节入口（游戏手柄右摇杆连续路径）—— 每次累加极小增量，保存走防抖
const adjustVolumeContinuous = (delta) => {
    const newVol = Math.max(0, Math.min(1, audio.volume + delta));
    cfSetVolume(newVol, true);
};

// 🔥 v3.6.2: 统一「播放结束」处理——主槽 audio 与备用槽 cfAudioB 永久绑定同一处理器，
// 不再于切歌/交叉淡变重置时置空 onended，避免「关闭淡入淡变后放完一首歌自动暂停（不续播）」。
// 仅当前活跃槽播放到末尾会触发 onended；暂停/空的槽不会触发，故双槽同绑安全。
// 🔥 v3.6.2: 后台 rAF 冻结时交叉淡变 fade 卡住、cfState 卡在 FADING，
// 活跃槽播完后 onAudioEnded 因 cfState!==IDLE 返回 → 播放器静默停止（旧歌播完、新歌音量仍为 0）。
// 修复：检测「当前活跃槽自然播完且淡变进行中」→ 立即强制收尾，不等到 setTimeout 兜底（被节流到 10s+ 后）。
function onAudioEnded() {
    if (isRepeatOne) {
        const ap = getActivePlayAudio();
        ap.currentTime = 0;
        ap.play();
        return;
    }
    // 🚀 v3.4.3: 自然结束的长音频记入进度（最后5秒→0，下次从头）
    saveLongAudioProgress();

    // 🔥 v3.6.2: 日志 — 歌曲自然结束
    logError('ON_ENDED', `歌曲结束: ${playlist[currentIndex]?.title}, cfState=${cfState===CfState.FADING?'FADING':cfState===CfState.PRELOADING?'PRELOADING':'IDLE'}, cfAirLocked=${cfAirLocked}`, null);

    // 🔥 v3.6.2: 交叉淡变进行中，当前活跃槽播放完毕 → 强制完成过渡
    // this 指向触发了 ended 事件的 <audio> 元素（双槽永久绑定同一函数，通过 this 区分）
    // ⚠️ 不递增 cfTransitionId：在途 fade rAF 通过 cfState!==FADING 守卫自行退出（见 fade 函数顶部检查），
    //    避免 stale fade 将翻转后的新活跃槽误判为「被动槽」而 pause（导致 100% 淡变后立即停止）。
    // ⚠️ v2-fix: return 必须在内部 if 内（不能是外层），否则 FADING 时非活跃槽结束会跳过 goNext。
    // ⚠️ v2-fix: cfAirLocked 在 PRELOADING 阶段就为 true，但该阶段活跃槽不应走 cfFinishTransition
    //   （cfState 为 PRELOADING，cfFinishTransition 顶部守卫会立即返回）。此时应 abort + goNext。
    if (cfState === CfState.FADING) {
        const endedEl = this;
        const active = cfGetActiveAudio();
        if (endedEl === active && _cfPendingNextIdx >= 0) {
            logError('CF_FORCE_FINISH', `onAudioEnded 强制完成过渡: ${playlist[_cfPendingNextIdx]?.title}`, null);
            cfFinishTransition(_cfPendingNextIdx, _cfPendingNextVol, cfTransitionId);
            return; // 已强制完成过渡 → 跳过 goNext
        }
        logError('CF_ENDED_PASSIVE', `onAudioEnded: FADING 但结束的不是活跃槽(endedEl=${endedEl===audio?'A':'B'}, active=${active===audio?'A':'B'}): 不拦截`, null);
        // FADING 但结束的不是活跃槽（如被动槽）→ 不拦截，走正常结束流
    } else if (cfAirLocked && cfState === CfState.PRELOADING) {
        // 预加载阶段活跃槽就已播放完毕 → 中止在途淡变，立即切歌
        const endedEl = this;
        const active = cfGetActiveAudio();
        if (endedEl === active) {
            logError('CF_ABORT_ON_END', `PRELOADING 活跃槽结束: 中止淡变直接切歌`, null);
            ++cfTransitionId; // 使在途预加载/fade rAF 跳过
            cfState = CfState.IDLE;
            cfAirLocked = false;
            cfUpdateAirLockUI(false);
            cfCrossfadeVisStop();
            document.querySelectorAll('.art-crossfade-overlay').forEach(el => el.remove());
            goNext();
            return;
        }
    }

    if (cfState !== CfState.IDLE || cfAirLocked) return;
    goNext();
}
audio.onended = onAudioEnded;

// === 睡眠定时器 ===
let sleepTimerInterval = null; // 🚀 仅在设定了睡眠定时器时才启动的每秒刷新句柄
function startSleepTimerInterval() {
    if (sleepTimerInterval) return;
    sleepTimerInterval = setInterval(updateSleepTimerUI, 1000);
}
function stopSleepTimerInterval() {
    if (sleepTimerInterval) { clearInterval(sleepTimerInterval); sleepTimerInterval = null; }
}

function setSleepTimer(minutes) {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (minutes === 0) {
        sleepTimer = null; sleepEndTime = null;
        stopSleepTimerInterval();
        updateSleepTimerUI();
        showToast("睡眠定时已取消", iconSvg('moon'));
        return;
    }
    const ms = minutes * 60 * 1000;
    sleepEndTime = Date.now() + ms;
    sleepTimer = setTimeout(() => {
        // 🔥 v3.6.2: 睡眠到点暂停当前活跃槽（可能已切到 cfAudioB）
        getActivePlayAudio().pause();
        setPlayState(false);
        sleepTimer = null;
        sleepEndTime = null;
        stopSleepTimerInterval();
        updateSleepTimerUI();
        showToast("睡眠定时结束，已停止播放", iconSvg('moon'));
    }, ms);
    startSleepTimerInterval();
    updateSleepTimerUI();
    showToast(`睡眠定时: ${minutes} 分钟后停止`, iconSvg('moon'));
}

function updateSleepTimerUI() {
    const display = document.getElementById('sleepTimerDisplay');
    if (!display) return;
    if (sleepTimer && sleepEndTime) {
        const remaining = Math.max(0, sleepEndTime - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2,'0')}` : `${secs}s`;
        display.innerHTML = `${iconSvg('moon')} ${timeStr}`;
        display.className = 'sleep-timer-display active';
        // 最后1分钟红色闪烁
        if (remaining <= 60000 && remaining > 0) {
            display.style.color = (Math.floor(Date.now() / 500) % 2 === 0) ? '#ff6b6b' : 'var(--primary)';
        }
    } else {
        display.innerHTML = `${iconSvg('moon')} 定时`;
        display.className = 'sleep-timer-display';
        display.style.color = '';
    }
}
// 🚀 不再常驻定时器：由 setSleepTimer 按需启动/停止（见 startSleepTimerInterval）

// 🚀 v2.8: 睡眠定时器快速菜单 (Alt+T 快捷键)
function showSleepQuickMenu() {
    closeAllModals();
    const menu = document.createElement('div');
    menu.className = 'modal-overlay open';
    menu.style.zIndex = '2000';
    menu.innerHTML = `
        <div class="modal-content" style="width:320px;padding:20px;text-align:center;">
            <div style="font-size:18px;margin-bottom:16px;">${iconSvg('moon')} 睡眠定时器</div>
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
    if (!playlist.length) return showToast("播放列表为空", iconSvg('alert'));
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
    showToast(`已导出: ${filename}`, iconSvg('download'));
}

function importPlaylist(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                // JSON导入 - 只能恢复元数据信息
                showToast(`已导入 ${data.length} 条记录（需要重新加载音频文件）`, iconSvg('download'));
            }
        } catch {
            showToast("导入失败：格式不正确", iconSvg('alert'));
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
        div.innerHTML = `<span class="pl-title">${escapeHTML(s.title)}</span><span style="font-size:12px;opacity:0.6;">${escapeHTML(s.artist)}</span><span class="favorite-btn ${isFav ? 'faved' : ''}" data-idx="${i}">${iconSvg(isFav ? 'heart-filled' : 'heart')}</span>`;
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
let _pbThrottle = 0;        // 🚀 v3.1.0: 播放进度持久化节流

// 🚀 v3.4.3: 长音频(>15min)断点续播 — 统一保存/恢复逻辑
// 键：'MBolka_PlayPos_' + 文件名（同一文件跨会话稳定）；值：{ t: 位置(秒), d: 时长 }
function saveLongAudioProgress() {
    const pa = getActivePlayAudio();
    const dur = pa.duration || 0;
    if (dur <= 900) return; // 仅长音频(>15min)记忆
    try {
        const fname = playlist[currentIndex]?.file?.name || '';
        if (!fname) return;
        const key = 'MBolka_PlayPos_' + fname;
        // 进度落在最后5秒内 → 记为0（下次从头播放）
        const t = pa.currentTime >= dur - 5 ? 0 : pa.currentTime;
        localStorage.setItem(key, JSON.stringify({ t, d: dur }));
    } catch (_) {}
}

// 在媒体元数据就绪后调用：恢复长音频续播点（此时设置 currentTime 才可靠，不会被重置）
function applyLongAudioResume(audioEl) {
    const dur = audioEl.duration || 0;
    if (dur <= 900) return;
    try {
        const fname = playlist[currentIndex]?.file?.name || '';
        if (!fname) return;
        const key = 'MBolka_PlayPos_' + fname;
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && saved.d === dur && saved.t > 1) {
            const resume = saved.t > dur - 5 ? 0 : saved.t; // 最后5秒→从头
            audioEl.currentTime = resume;
            if (resume > 0) showToast(`从 ${formatTime(resume)} 续播`, iconSvg('play'));
        }
    } catch (_) {}
}


// 🚀 v2.8.4: 进入指定节能模式（位运算，支持叠加）
