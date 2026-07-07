/*
 * MBolka Player - Vibration Engine v3.5.1
 * Audio-to-rumble mapping via Gamepad API dual-rumble
 */

// 震动引擎状态
let _vibLastRumbleTime = 0;
let _vibLongTermAvg = 0;
let _vibInitialized = false;

// 初始化震动引擎（从 cfg 读取配置）
function initVibration() {
    _vibInitialized = true;
    _vibLongTermAvg = 0;
    _vibLastRumbleTime = 0;
}

// 每帧调用（由 visualizer.js renderVisLoop 尾部挂载）
function updateVibrationRumble(dataArray) {
    if (!cfg.rumbleEnabled) return;
    if (cfg.rumbleAutoFloor && _vibInitialized) _updateAutoFloor(dataArray);
    const { strong, weak } = _getRumbleMagnitudes(dataArray);
    if (_vibInitialized) _sendRumble(strong, weak);
    _updateRumbleIndicator(weak, strong);  // 指示器不受游戏手柄连接状态影响
}

// 🚀 v3.0.2: 更新震动指示器（主界面 + 设置页）
function _updateRumbleIndicator(weak, strong) {
    // 主界面指示器（已移除，保留空检查兼容）
    const el = document.getElementById('rumbleIndicator');
    if (el) {
        const strongBar = document.getElementById('rumbleStrongInd');
        const weakBar = document.getElementById('rumbleWeakInd');
        const afEl = document.getElementById('rumbleAutoFloorInd');
        if (strongBar) strongBar.style.width = (strong * 100).toFixed(1) + '%';
        if (weakBar) weakBar.style.width = (weak * 100).toFixed(1) + '%';
        if (afEl) {
            if (cfg.rumbleAutoFloor && _vibLongTermAvg > 0.01) {
                afEl.style.display = 'inline';
                const floor = cfg.rumbleFloor * Math.max(0.3, Math.min(3.0, _vibLongTermAvg > 0 ? _vibLongTermAvg * 2 : 1));
                afEl.textContent = `floor→${floor.toFixed(2)}`;
            } else {
                afEl.style.display = 'none';
            }
        }
        if (strong < 0.01 && weak < 0.01) {
            el.style.opacity = '0.35';
        } else {
            el.style.opacity = '1';
        }
    }

    // 🚀 v3.0.2: 同步设置页震动指示器（独立逻辑，不受主界面元素影响）
    const sri = document.getElementById('settingsRumbleIndicator');
    if (!sri) return;
    const settingsOpen = document.getElementById('settingsModal')?.classList.contains('open');
    if (settingsOpen) {
        sri.style.display = 'block';
        const sStrong = document.getElementById('settingsRumbleStrongBar');
        const sWeak = document.getElementById('settingsRumbleWeakBar');
        const sStrongV = document.getElementById('settingsRumbleStrongVal');
        const sWeakV = document.getElementById('settingsRumbleWeakVal');
        if (sStrong) sStrong.style.width = (strong * 100).toFixed(1) + '%';
        if (sWeak) sWeak.style.width = (weak * 100).toFixed(1) + '%';
        if (sStrongV) sStrongV.textContent = (strong * 100).toFixed(0) + '%';
        if (sWeakV) sWeakV.textContent = (weak * 100).toFixed(0) + '%';
        const sFloor = document.getElementById('settingsRumbleFloorVal');
        if (sFloor) {
            const floor = cfg.rumbleAutoFloor && _vibLongTermAvg > 0.01
                ? (cfg.rumbleFloor * Math.max(0.3, Math.min(3.0, _vibLongTermAvg * 2))).toFixed(3)
                : cfg.rumbleFloor.toFixed(3);
            sFloor.textContent = floor;
        }
        const sFloorAuto = document.getElementById('settingsRumbleFloorAuto');
        if (sFloorAuto) sFloorAuto.textContent = cfg.rumbleAutoFloor ? '开启' : '关闭';
    } else {
        sri.style.display = 'none';
    }
}

// 自动地板 EMA 更新
function _updateAutoFloor(dataArray) {
    const bins = dataArray.length;
    let total = 0;
    for (let i = 0; i < bins; i++) total += dataArray[i];
    const energy = total / (bins * 255);
    if (_vibLongTermAvg === 0) _vibLongTermAvg = energy;
    _vibLongTermAvg = _vibLongTermAvg * 0.997 + energy * 0.003;
}

// 获取震动幅度
function _getRumbleMagnitudes(dataArray) {
    const bins = dataArray.length;
    const isBassCut = cfg.rumbleMode === 'basscut';
    
    // 根据模式选择频段
    let weakStart, weakEnd, strongStart, strongEnd;
    if (isBassCut) {
        // 去低频映射：跳过最低 25%
        weakStart = Math.floor(bins * 0.25);
        weakEnd = Math.floor(bins * 0.50);
        strongStart = Math.floor(bins * 0.50);
        strongEnd = Math.floor(bins * 0.95);
    } else {
        // 频谱映射：Weak 低频 / Strong 中高频
        weakStart = 0;
        weakEnd = Math.floor(bins * 0.25);
        strongStart = Math.floor(bins * 0.40);
        strongEnd = Math.floor(bins * 0.85);
    }

    // 计算各频段平均能量
    let weakSum = 0, weakCount = 0;
    for (let i = weakStart; i < weakEnd && i < bins; i++) { weakSum += dataArray[i]; weakCount++; }
    let strongSum = 0, strongCount = 0;
    for (let i = strongStart; i < strongEnd && i < bins; i++) { strongSum += dataArray[i]; strongCount++; }

    const weakRaw = weakCount > 0 ? (weakSum / weakCount) / 255 : 0;
    const strongRaw = strongCount > 0 ? (strongSum / strongCount) / 255 : 0;

    // 地板压缩
    const floorCompress = (v, floor, ceiling) => {
        if (v <= floor) return 0;
        return Math.min((v - floor) / (ceiling - floor), 1);
    };

    // 自动地板自适应
    let effectiveFloor = cfg.rumbleFloor;
    if (cfg.rumbleAutoFloor && _vibLongTermAvg > 0.01) {
        const ratio = ((weakSum + strongSum) / Math.max(weakCount + strongCount, 1)) / 255 / (_vibLongTermAvg + 0.001);
        effectiveFloor = cfg.rumbleFloor * Math.max(0.3, Math.min(3.0, ratio));
    }

    const weakCompressed = floorCompress(weakRaw, effectiveFloor, 0.80);
    const strongCompressed = floorCompress(strongRaw, effectiveFloor, 0.90);

    // 增益链路
    let weakOutput = weakCompressed * cfg.rumbleGain * cfg.rumbleWeakGain;
    let strongOutput = strongCompressed * cfg.rumbleGain * cfg.rumbleStrongGain;

    // 反转马达
    if (cfg.rumbleSwapMotors) {
        [weakOutput, strongOutput] = [strongOutput, weakOutput];
    }

    return {
        weak: Math.min(weakOutput, 1),
        strong: Math.min(strongOutput, 1)
    };
}

// 发送震动
function _sendRumble(strong, weak) {
    const now = performance.now();
    if (now - _vibLastRumbleTime < cfg.rumbleThrottle) return;
    _vibLastRumbleTime = now;

    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp || !gp.vibrationActuator) continue;
        try {
            gp.vibrationActuator.playEffect('dual-rumble', {
                startDelay: 0,
                duration: cfg.rumbleThrottle + 20,
                weakMagnitude: weak,
                strongMagnitude: strong
            });
        } catch(e) { /* 静默忽略 */ }
    }
}

// 检测震动支持
function isRumbleSupported() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].vibrationActuator) return true;
    }
    return 'vibrationActuator' in (Gamepad ? Gamepad.prototype : {});
}
