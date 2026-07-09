/*
 * MBolka Player - Picture-in-Picture v3.6.3
 * Energy saving system (EnergyMode bitfield), PiP window management
 */

function enterEnergySaving(mode = EnergyMode.PIP_TEMP) {
    const wasSaving = shouldBeEnergySaving();
    energyModeFlags |= mode;

    if (!wasSaving && shouldBeEnergySaving()) {
        // 首次进入节能状态，执行实际节能操作
        applyEnergySaving(true, mode);
    }

    // 更新 CSS pip-standby 类：只有 PIP_TEMP 或 VISIBILITY 才添加暗黑类
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
        wrapper.classList.toggle('pip-standby',
            (energyModeFlags & (EnergyMode.PIP_TEMP | EnergyMode.VISIBILITY)) !== 0);
    }
}

// 🚀 v2.8.4: 退出指定节能模式
function exitEnergySaving(mode = EnergyMode.PIP_TEMP) {
    const wasSaving = shouldBeEnergySaving();
    energyModeFlags &= ~mode;

    if (wasSaving && !shouldBeEnergySaving()) {
        // 完全退出节能状态
        applyEnergySaving(false);
    }

    // 更新 pip-standby
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
        const hasPipStandby = (energyModeFlags & (EnergyMode.PIP_TEMP | EnergyMode.VISIBILITY)) !== 0;
        wrapper.classList.toggle('pip-standby', hasPipStandby);
    }

    // 同步旧标记
    pipTempEnergySaving = (energyModeFlags & EnergyMode.PIP_TEMP) !== 0;
    oneClickEnergySaving = (energyModeFlags & EnergyMode.ONE_CLICK) !== 0;
}

// 🚀 v2.8.4: 实际应用/取消节能效果
function applyEnergySaving(enable, triggerMode = EnergyMode.NONE) {
    if (enable) {
        // 🚀 v2.7.0: 强制退出沉浸模式 — 停止所有动画特效并释放内存
        if (isImmersiveMode) {
            isImmersiveMode = false;
            el.viewImm.classList.add('hidden'); el.viewMain.classList.remove('hidden');
            document.body.style.background = 'var(--bg-dark)';
            immCanvasCleared = true;
            const immCtx = el.canvasImm.getContext('2d');
            if (immCtx) immCtx.clearRect(0, 0, el.canvasImm.width, el.canvasImm.height);
            updateFocusContext();
        }

        // 清空粒子池
        particles.length = 0;
        ripples.length = 0;
        flowField = [];

        // 清空流沙背景 Canvas
        const bgCtx = el.bgColor.getContext('2d');
        if (bgCtx) bgCtx.clearRect(0, 0, el.bgColor.width, el.bgColor.height);

        // 暂停主频谱Canvas渲染
        if (spectrumCtxMain) {
            const cvs = el.canvasMain;
            if (cvs) spectrumCtxMain.clearRect(0, 0, cvs.width || cvs.offsetWidth, cvs.height || cvs.offsetHeight);
        }

        // 降低歌词同步频率
        if (lrcTimer) clearInterval(lrcTimer);
        lrcTimer = setInterval(() => syncLyrics(true), 500);

        // 🔋 一键节能时显示特定提示
        if (triggerMode === EnergyMode.ONE_CLICK || (triggerMode & EnergyMode.ONE_CLICK)) {
            showToast("一键节能已开启", iconSvg('zap'));
        }
    } else {
        // 恢复歌词高频同步
        if (lrcTimer) { clearInterval(lrcTimer); lrcTimer = null; }

        // 恢复视觉特效
        if (analyser && !isImmersiveMode) {
            startVisLoop();
        }

        // 🚀 v3.0.0: 恢复震动
        cfg.rumbleEnabled = true;

        pipTempEnergySaving = false;
        showToast("节能模式已退出", iconSvg('zap'));
    }
}

let lrcTimer = null; // 🚀 v2.7: 歌词降频定时器句柄

async function togglePip() {
    if (pipWindow) {
        // 🚀 v2.7-preview2 P1: 关闭 PiP 时彻底清理所有定时器
        if (pipSyncInterval) { clearInterval(pipSyncInterval); pipSyncInterval = null; }
        if (pipHealthCheck) { clearInterval(pipHealthCheck); pipHealthCheck = null; }
        pipWindow.close();
        pipWindow = null;

        // 🔧 v2.8.4: 关闭画中画时退出 PiP 临时节能（保留一键节能等其他模式）
        exitEnergySaving(EnergyMode.PIP_TEMP);
        pipTempEnergySaving = false;
        // 如果是用户手动开启的节能模式（非临时），则保持
        updatePipQuickBtn();
        return;
    }

    if (!('documentPictureInPicture' in window)) {
        showToast("浏览器不支持画中画功能", iconSvg('alert'));
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400, height: 280
        });

        // 🔧 v2.8.4: 根据临时节能开关决定是否进入 PiP 节能（与一键节能叠加）
        if (cfg.pipEnergyEnabled) {
            enterEnergySaving(EnergyMode.PIP_TEMP);
            pipTempEnergySaving = true;
        }

        // PiP 窗口关闭监听 — 用户点 × 关闭时也要恢复主窗口
        pipWindow.addEventListener('pagehide', () => {
            pipWindow = null;
            // 🔧 v2.8.4: 退出 PiP 临时节能
            exitEnergySaving(EnergyMode.PIP_TEMP);
            pipTempEnergySaving = false;
            updatePipQuickBtn();
        });

        const song = playlist[currentIndex];
        const title = song ? song.title : 'MBolka Player';
        const artist = song ? song.artist : '';
        const artSrc = (song && song.art) ? song.art : '';
        const hasLrc = parsedLyrics.length > 0;
        const isFaved = song ? favorites.has(song.file.name) : false;

        // 1. 复制主窗口所有样式表到 PiP 窗口
        const pipHead = pipWindow.document.head;
        const pipBody = pipWindow.document.body;
        pipBody.innerHTML = ''; // 清空

        [...document.styleSheets].forEach(sheet => {
            try {
                const newStyle = pipWindow.document.createElement('style');
                const rules = [...sheet.cssRules].map(r => r.cssText).join('\n');
                newStyle.textContent = rules;
                pipHead.appendChild(newStyle);
            } catch(e) {
                // 跨域样式表忽略
                try {
                    if (sheet.href) {
                        const link = pipWindow.document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = sheet.href;
                        pipHead.appendChild(link);
                    }
                } catch(e2) {}
            }
        });

        // 额外注入PiP专用样式
        const pipExtraStyle = pipWindow.document.createElement('style');
        pipExtraStyle.textContent = `
            :root { --primary: ${cfg.defaultColor || '#e8b4b8'}; }
            body { margin: 0; padding: 0; overflow: hidden; background: #0a0a1a; }
            @media (min-aspect-ratio: 2/1) {
                .pip-container { flex-direction: row !important; }
                .pip-lyrics-wrap { flex-direction: row !important; gap: 12px !important; text-align: left !important; padding: 16px 24px !important; }
                .pip-line-current { font-size: clamp(15px, 2.5vw, 22px) !important; }
                .pip-line-next { font-size: clamp(11px, 1.5vw, 15px) !important; }
                .pip-fallback { flex-direction: row !important; }
            }
            .pip-btn .ui-ico { width: 18px; height: 18px; margin: 0; }
            .pip-fav-btn.faved { color: #ff6b6b; }
        `;
        pipHead.appendChild(pipExtraStyle);

        // 🚀 v3.4.x: 复制主文档的 SVG 图标定义到 PiP 窗口，使 <use href="#icon-..."> 可正常渲染
        const mainIconSvg = document.querySelector('svg > defs');
        if (mainIconSvg && mainIconSvg.parentElement) pipHead.appendChild(mainIconSvg.parentElement.cloneNode(true));

        // 2. 构建PiP HTML结构（将歌词容器和降级容器都写死在DOM里）
        pipBody.innerHTML = `
            <div class="pip-container">
                <div class="pip-bg" id="pipBg"></div>

                <!-- 歌词容器 (默认隐藏) -->
                <div class="pip-lyrics-wrap" id="pipLyricsWrap" style="display: none;">
                    <div class="pip-line-current" id="pipCurrLine"></div>
                    <div class="pip-line-next" id="pipNextLine"></div>
                </div>
                
                <!-- 无歌词降级容器 (默认隐藏) -->
                <div class="pip-fallback" id="pipFallback" style="display: none;">
                    <div class="pip-vinyl" id="pipVinylWrap">
                        <!-- 封面图片将在JS中动态插入/替换 -->
                    </div>
                    <div class="pip-fallback-info">
                        <div class="pip-fallback-title" id="pipFallbackTitle"></div>
                        <div class="pip-fallback-artist" id="pipFallbackArtist"></div>
                    </div>
                </div>

                <div class="pip-controls-overlay">
                    <div class="pip-track-info" id="pipTrackInfo"></div>
                    <div class="pip-btn-group">
                        <button class="pip-btn" id="pipPrev" title="上一首">${iconSvg('prev')}</button>
                        <button class="pip-btn pip-play-btn" id="pipPlay" title="播放/暂停">${iconSvg('play')}</button>
                        <button class="pip-btn" id="pipNext" title="下一首">${iconSvg('next')}</button>
                        <button class="pip-btn pip-fav-btn" id="pipFav" title="收藏">${iconSvg('heart')}</button>
                    </div>
                </div>

                <div class="pip-progress-bar">
                    <div class="pip-progress-fill" id="pipProgFill" style="width:0%"></div>
                </div>
            </div>
        `;

        // 3. 直接绑定PiP内部按钮事件到主窗口函数
        pipWindow.document.getElementById('pipPrev').onclick = () => goPrev();
        pipWindow.document.getElementById('pipPlay').onclick = () => {
            togglePlay();
            // 同步更新按钮图标
            const btn = pipWindow.document.getElementById('pipPlay');
            // 🚀 v3.5.0: 复用 setBtnIcon helper
            if (btn && !pipWindow.closed) setBtnIcon(btn, isPlaying ? 'pause' : 'play');
        };
        pipWindow.document.getElementById('pipNext').onclick = () => goNext();
        pipWindow.document.getElementById('pipFav').onclick = () => {
            if (currentIndex >= 0) {
                toggleFavorite(currentIndex);
                const s = playlist[currentIndex];
                const favBtn = pipWindow.document.getElementById('pipFav');
                if (favBtn && s && !pipWindow.closed) {
                    // 🚀 v3.4.x: 收藏态用实心红心（heart-filled），未收藏保持描边
                    setHeartFilled(favBtn, favorites.has(s.file.name));
                }
            }
        };

        // 🚀 v3.4.x: PiP 打开时按当前曲目初始化收藏红心（实心/描边）
        {
            const s = playlist[currentIndex];
            const favBtn = pipWindow.document.getElementById('pipFav');
            if (favBtn && s && !pipWindow.closed) {
                setHeartFilled(favBtn, favorites.has(s.file.name));
            }
        }

        // 4. 更新PiP界面的核心函数
        let pipLastCurr = '', pipLastNext = '', pipLastArt = '';
        const updatePipUI = () => {
            if (!pipWindow || pipWindow.closed) {
                pipWindow = null;
                updatePipQuickBtn();
                return;
            }
            try {
                const s = playlist[currentIndex];
                if (!s) return;

                const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
                
                // 1. 进度条与播放按钮
                const progFill = pipWindow.document.getElementById('pipProgFill');
                if (progFill) progFill.style.width = progress + '%';
                const playBtn = pipWindow.document.getElementById('pipPlay');
                if (playBtn) playBtn.innerHTML = iconSvg(isPlaying ? 'pause' : 'play');

                // 2. 动态更新背景和封面 (解决封面不刷新的问题)
                const bg = pipWindow.document.getElementById('pipBg');
                const vinylWrap = pipWindow.document.getElementById('pipVinylWrap');
                const isCrossfade = typeof cfState !== 'undefined' && cfState === CfState.FADING;
                if (s.art) {
                    // 🔥 v3.6.2: PiP 封面淡变 — 旧封面溶解到新封面
                    if (isCrossfade && pipLastArt && pipLastArt !== s.art) {
                        // 背景层溶解
                        if (bg && !bg.querySelector('.pip-bg-overlay')) {
                            const oldOverlay = document.createElement('div');
                            oldOverlay.className = 'pip-bg-overlay';
                            oldOverlay.style.cssText = 'position:absolute;inset:0;background-size:cover;background-position:center;z-index:0;opacity:1;transition:opacity 3s cubic-bezier(0.22,0.61,0.36,1);pointer-events:none;';
                            oldOverlay.style.backgroundImage = `url('${pipLastArt}')`;
                            bg.appendChild(oldOverlay);
                            void oldOverlay.offsetWidth;
                            oldOverlay.style.opacity = '0';
                            setTimeout(() => { if (oldOverlay.parentNode) oldOverlay.remove(); }, 3200);
                        }
                        // 黑胶封面层溶解
                        if (vinylWrap) {
                            const oldImg = vinylWrap.querySelector('img');
                            if (oldImg && !vinylWrap.querySelector('.pip-vinyl-overlay')) {
                                const oldClone = oldImg.cloneNode(true);
                                oldClone.className = 'pip-vinyl-overlay';
                                Object.assign(oldClone.style, { position:'absolute', inset:'0', width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit', zIndex:'2', opacity:'1', transition:'opacity 3s cubic-bezier(0.22,0.61,0.36,1)', pointerEvents:'none' });
                                vinylWrap.appendChild(oldClone);
                                void oldClone.offsetWidth;
                                oldClone.style.opacity = '0';
                                setTimeout(() => { if (oldClone.parentNode) oldClone.remove(); }, 3200);
                            }
                        }
                    }
                    if (bg) bg.style.backgroundImage = `url('${s.art}')`;
                    if (vinylWrap && vinylWrap.innerHTML.indexOf(s.art) === -1) {
                        vinylWrap.innerHTML = `<img src="${escapeHTML(s.art)}">`;
                    }
                } else {
                    if (bg) bg.style.backgroundImage = 'none';
                    if (vinylWrap && !vinylWrap.querySelector('.pip-vinyl-icon')) {
                        vinylWrap.innerHTML = `<div class="pip-vinyl-icon" style="width:100%;height:100%;background:linear-gradient(135deg,#1a1a1a,#333);display:flex;align-items:center;justify-content:center;font-size:24px;"><svg class="ui-ico" style="width:36px;height:36px;opacity:0.5;margin:0;"><use href="#icon-music"/></svg></div>`;
                    }
                    // 🚀 v3.5.x: LRU 已淘汰的封面 → 触发懒恢复（下帧即生效），ensureArt 自带并发去重
                    ensureArt(s);
                }
                // 🔥 v3.6.2: 记录当前封面 sr c，用于下次淡变检测
                pipLastArt = s.art || '';

                // 3. 判断当前是否有歌词，动态切换两套UI的显示状态 (解决有无歌词切换失效的问题)
                const hasLrc = parsedLyrics.length > 0;
                const lyricsWrap = pipWindow.document.getElementById('pipLyricsWrap');
                const fallbackWrap = pipWindow.document.getElementById('pipFallback');
                
                if (lyricsWrap) lyricsWrap.style.display = hasLrc ? 'flex' : 'none';
                if (fallbackWrap) fallbackWrap.style.display = hasLrc ? 'none' : 'flex';

                // 4. 更新文本信息
                if (hasLrc) {
                    const currEl = pipWindow.document.getElementById('pipCurrLine');
                    const nextEl = pipWindow.document.getElementById('pipNextLine');
                    const curLrcIdx = parsedLyrics.findIndex(l => l.time > audio.currentTime - lyricsOffset);
                    let curIdx = curLrcIdx > 0 ? curLrcIdx - 1 : (parsedLyrics.length ? parsedLyrics.length - 1 : -1);

                    // 🔥 v2.8.12: PiP 当前行遇 break/blank 向上查找最后有内容行
                    let currLrc = '';
                    if (curIdx >= 0) {
                        const cl = parsedLyrics[curIdx];
                        if (cl.isBreak || cl.isBlank || !cl.text) {
                            for (let j = curIdx - 1; j >= 0; j--) {
                                const pl = parsedLyrics[j];
                                if (!pl.isBreak && !pl.isBlank && pl.text) {
                                    currLrc = pl.text;
                                    break;
                                }
                            }
                        } else {
                            currLrc = cl.text;
                        }
                    }

                    // 🔥 v2.8.12: PiP 下一行跳过 break/blank
                    let nextLrc = '';
                    let nextIdx = curLrcIdx > 0 ? curLrcIdx : 0;
                    while (nextIdx < parsedLyrics.length) {
                        const nl = parsedLyrics[nextIdx];
                        if (nl.isBreak || nl.isBlank || !nl.text) { nextIdx++; continue; }
                        nextLrc = nl.text;
                        break;
                    }

                    // 添加防闪烁机制
                    if (currEl && currLrc !== pipLastCurr) {
                        currEl.classList.add('fade-out');
                        setTimeout(() => {
                            if (!pipWindow || pipWindow.closed) return;
                            currEl.textContent = currLrc || '';
                            currEl.classList.remove('fade-out');
                        }, 200);
                        pipLastCurr = currLrc;
                    }
                    if (nextEl && nextLrc !== pipLastNext) {
                        nextEl.classList.add('fade-out');
                        setTimeout(() => {
                            if (!pipWindow || pipWindow.closed) return;
                            nextEl.textContent = nextLrc || '';
                            nextEl.classList.remove('fade-out');
                        }, 200);
                        pipLastNext = nextLrc;
                    }
                } else {
                    const ftEl = pipWindow.document.getElementById('pipFallbackTitle');
                    if (ftEl && ftEl.textContent !== s.title) ftEl.textContent = s.title;
                    const faEl = pipWindow.document.getElementById('pipFallbackArtist');
                    if (faEl && faEl.textContent !== s.artist) faEl.textContent = s.artist;
                }

                // 控制栏信息
                const trackInfo = pipWindow.document.getElementById('pipTrackInfo');
                if (trackInfo) trackInfo.textContent = s.title + ' - ' + s.artist;
                
            } catch(e) {
                // 如果出现 DOM 异常，清理引用
                pipWindow = null;
                updatePipQuickBtn();
            }
        };

        // 5. 启动定时同步 (每500ms)
        pipSyncInterval = setInterval(() => {
            if (!pipWindow || pipWindow.closed) {
                clearInterval(pipSyncInterval);
                clearInterval(pipHealthCheck);
                pipSyncInterval = null;
                pipHealthCheck = null;
                pipWindow = null;
                updatePipQuickBtn();
                return;
            }
            updatePipUI();
        }, 500);

        // 🚀 v2.7-preview2 P1: 健康检查兜底 — 每10秒检查 PiP 窗口是否被外部关闭
        pipHealthCheck = setInterval(() => {
            if (!pipWindow || pipWindow.closed) {
                clearInterval(pipSyncInterval);
                clearInterval(pipHealthCheck);
                pipSyncInterval = null;
                pipHealthCheck = null;
                pipWindow = null;
                // 🔧 v2.8.4: 退出 PiP 临时节能
                exitEnergySaving(EnergyMode.PIP_TEMP);
                pipTempEnergySaving = false;
                updatePipQuickBtn();
            }
        }, 10000);

        // 初始化一次
        updatePipUI();

        pipWindow.addEventListener('pagehide', () => {
            clearInterval(pipSyncInterval);
            clearInterval(pipHealthCheck);
            pipSyncInterval = null;
            pipHealthCheck = null;
            pipWindow = null;
            updatePipQuickBtn();
        });

        updatePipQuickBtn();
        showToast("画中画已开启", iconSvg('tv'));

    } catch(e) {
        showToast("画中画启动失败", iconSvg('x'));
        pipWindow = null;
    }
}
