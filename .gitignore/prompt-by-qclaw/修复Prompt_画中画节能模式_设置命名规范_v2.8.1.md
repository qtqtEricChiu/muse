# MBolka Player v2.8.1 - 功能修复 Prompt

> **修复日期**: 2026-06-02  
> **修复版本**: v2.8.1  
> **修复内容**:  
> 1. 画中画+节能模式状态同步修复  
> 2. 设置页面命名规范统一  

---

## 🔧 问题1：画中画+节能模式状态同步修复

### 📍 问题描述

**问题 A**：切换浏览器标签页时，节能模式会自动退出，即使画中画窗口仍在运行。

**问题 B**：退出并关闭画中画窗口时，节能模式没有跟随关闭。

### 🎯 根本原因分析

#### 问题 A 根因

`app.js` 第 4190-4197 行的 `visibilitychange` 事件监听器逻辑缺陷：

```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden && cfg.energySavingEnabled && pipWindow && !pipWindow.closed) {
        enterEnergySaving();
    } else if (!document.hidden && isEnergySaving) {
        exitEnergySaving(); // 🐛 Bug: 即使画中画仍在运行，也会退出节能模式
    }
});
```

**缺陷**：当标签页重新可见时（`!document.hidden`），只要 `isEnergySaving` 为 true，就会无条件调用 `exitEnergySaving()`，没有检查画中画窗口是否仍然打开。

#### 问题 B 根因

`app.js` 第 2163 行开始的 `togglePip()` 函数中，关闭画中画时的逻辑：

```javascript
if (!cfg.energySavingEnabled) {
    exitEnergySaving();
} else {
    // 保持节能模式，更新按钮状态
    updatePipQuickBtn();
    showToast("⚡ 节能模式保持开启", "📺");
    return;
}
```

**缺陷**：如果用户在设置中启用了"启动画中画时自动优化主界面性能"（`cfg.energySavingEnabled = true`），关闭画中画时节能模式会保持开启，而不是跟随画中画关闭。

### 🛠️ 修复方案

#### 步骤1：引入画中画临时节能状态标记

**文件**：`app.js`  
**位置**：在全局变量声明区域（约第 35-50 行附近）

**添加新变量**：

```javascript
// 🚀 v2.8.1 P2: 画中画临时节能状态标记
let pipTempEnergySaving = false; // 标记是否因画中画而进入的临时节能模式
```

#### 步骤2：修复 `togglePip()` 函数

**文件**：`app.js`  
**位置**：第 2163 行开始

**修改前**：
```javascript
async function togglePip() {
    if (pipWindow) {
        // 🚀 v2.7-preview2 P1: 关闭 PiP 时彻底清理所有定时器
        if (pipSyncInterval) { clearInterval(pipSyncInterval); pipSyncInterval = null; }
        if (pipHealthCheck) { clearInterval(pipHealthCheck); pipHealthCheck = null; }
        pipWindow.close();
        pipWindow = null;

        // 🔧 v2.8.1 P1: 关闭画中画时，根据用户设置决定是否退出节能模式
        if (!cfg.energySavingEnabled) {
            exitEnergySaving();
        } else {
            // 保持节能模式，更新按钮状态
            updatePipQuickBtn();
            showToast("⚡ 节能模式保持开启", "📺");
            return;
        }

        updatePipQuickBtn();
        return;
    }

    if (!('documentPictureInPicture' in window)) {
        showToast("⚠️ 浏览器不支持画中画功能");
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400, height: 280
        });

        // 🔧 v2.8.1 P1: 打开画中画时，无论用户设置如何都进入节能模式优化主界面性能
        enterEnergySaving();
        showToast("⚡ 主界面已进入节能模式", "📺");

        // PiP 窗口关闭监听 — 用户点 × 关闭时也要恢复主窗口
        pipWindow.addEventListener('pagehide', () => {
            pipWindow = null;
            // 🔧 v2.8.1 P1: 检查用户设置决定是否退出节能模式
            if (!cfg.energySavingEnabled) {
                exitEnergySaving();
            }
            updatePipQuickBtn();
        });

        // ... 其余代码 ...
    }
}
```

**修改后**：
```javascript
async function togglePip() {
    if (pipWindow) {
        // 🚀 v2.7-preview2 P1: 关闭 PiP 时彻底清理所有定时器
        if (pipSyncInterval) { clearInterval(pipSyncInterval); pipSyncInterval = null; }
        if (pipHealthCheck) { clearInterval(pipHealthCheck); pipHealthCheck = null; }
        pipWindow.close();
        pipWindow = null;

        // 🔧 v2.8.1 P2: 关闭画中画时，如果是临时节能模式则退出
        if (pipTempEnergySaving) {
            pipTempEnergySaving = false;
            exitEnergySaving();
            showToast("⚡ 已退出画中画节能模式", "📺");
        }
        // 如果是用户手动开启的节能模式（非临时），则保持

        updatePipQuickBtn();
        return;
    }

    if (!('documentPictureInPicture' in window)) {
        showToast("⚠️ 浏览器不支持画中画功能");
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400, height: 280
        });

        // 🔧 v2.8.1 P2: 记录当前节能状态，判断是否需要进入临时节能模式
        if (!isEnergySaving) {
            // 当前不是节能模式，进入临时节能模式
            pipTempEnergySaving = true;
            enterEnergySaving();
            showToast("⚡ 主界面已进入节能模式", "📺");
        } else {
            // 当前已经是节能模式（用户手动开启），不标记为临时
            pipTempEnergySaving = false;
        }

        // PiP 窗口关闭监听 — 用户点 × 关闭时也要恢复主窗口
        pipWindow.addEventListener('pagehide', () => {
            pipWindow = null;
            // 🔧 v2.8.1 P2: 如果是临时节能模式，则退出
            if (pipTempEnergySaving) {
                pipTempEnergySaving = false;
                exitEnergySaving();
            }
            updatePipQuickBtn();
        });

        // ... 其余代码保持不变 ...
    }
}
```

#### 步骤3：修复 `visibilitychange` 事件监听器

**文件**：`app.js`  
**位置**：第 4190-4197 行

**修改前**：
```javascript
// 🚀 v2.7: visibilitychange — 标签页隐藏时自动节能
document.addEventListener('visibilitychange', () => {
    if (document.hidden && cfg.energySavingEnabled && pipWindow && !pipWindow.closed) {
        enterEnergySaving();
    } else if (!document.hidden && isEnergySaving) {
        exitEnergySaving();
    }
});
```

**修改后**：
```javascript
// 🔧 v2.8.1 P2: visibilitychange — 标签页隐藏时自动节能
document.addEventListener('visibilitychange', () => {
    if (document.hidden && cfg.energySavingEnabled && pipWindow && !pipWindow.closed) {
        // 标签页隐藏 + 画中画打开 → 进入节能模式
        enterEnergySaving();
    } else if (!document.hidden && isEnergySaving) {
        // 标签页重新可见
        // 🔧 v2.8.1 P2: 如果画中画仍然打开，保持节能模式（不要退出）
        if (pipWindow && !pipWindow.closed) {
            // 画中画仍在运行，保持节能模式
            return;
        }
        // 画中画已关闭，退出节能模式
        exitEnergySaving();
    }
});
```

#### 步骤4：修复 `exitEnergySaving()` 函数（防御性增强）

**文件**：`app.js`  
**位置**：第 2151-2160 行

**修改前**：
```javascript
function exitEnergySaving() {
    if (!isEnergySaving) return;
    isEnergySaving = false;
    // 恢复歌词高频同步
    if (lrcTimer) { clearInterval(lrcTimer); lrcTimer = null; }
    // 恢复 CSS
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
        wrapper.classList.remove('pip-standby');
        // 🔧 v2.8.1 P1: 强制触发重绘，确保样式生效
        void wrapper.offsetHeight;
    }

    // 🔧 v2.8.1 P1: 恢复视觉特效
    if (analyser && !isImmersiveMode) {
        requestAnimationFrame(renderVisLoop);
    }
}
```

**修改后**：
```javascript
function exitEnergySaving() {
    if (!isEnergySaving) return;
    
    // 🔧 v2.8.1 P2: 防御性检查 — 如果画中画仍在运行且是临时节能模式，阻止退出
    if (pipWindow && !pipWindow.closed && pipTempEnergySaving) {
        console.warn("⚠️ 尝试在画中画运行时退出临时节能模式，已阻止");
        return;
    }
    
    isEnergySaving = false;
    // 恢复歌词高频同步
    if (lrcTimer) { clearInterval(lrcTimer); lrcTimer = null; }
    // 恢复 CSS
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
        wrapper.classList.remove('pip-standby');
        // 🔧 v2.8.1 P1: 强制触发重绘，确保样式生效
        void wrapper.offsetHeight;
    }

    // 🔧 v2.8.1 P1: 恢复视觉特效
    if (analyser && !isImmersiveMode) {
        requestAnimationFrame(renderVisLoop);
    }
    
    // 🔧 v2.8.1 P2: 清除临时节能标记
    pipTempEnergySaving = false;
}
```

#### 步骤5：修复 `enterEnergySaving()` 函数（添加 CSS 类）

**文件**：`app.js`  
**位置**：第 2114-2149 行

**确认 `enterEnergySaving()` 函数中已包含以下代码**（如果缺失请添加）：

```javascript
function enterEnergySaving() {
    if (isEnergySaving) return;
    isEnergySaving = true;

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
    // 🚀 v2.7.0: 释放流场大数组
    flowField = [];
    // 清空流沙背景 Canvas
    if (el.bgCanvas) {
        const bgCtx = el.bgCanvas.getContext('2d');
        if (bgCtx) bgCtx.clearRect(0, 0, el.bgCanvas.width, el.bgCanvas.height);
    }
    
    // 🔧 v2.8.1 P2: 添加 pip-standby CSS 类
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
        wrapper.classList.add('pip-standby');
    }
    
    // 降低歌词同步频率
    if (lrcTimer) clearInterval(lrcTimer);
    lrcTimer = setInterval(() => syncLyrics(false), 2000);
}
```

### 🧪 测试验证

1. **测试问题 A 修复**：
   - 打开画中画（进入节能模式）
   - 切换到其他浏览器标签页
   - 切换回原标签页
   - **预期结果**：节能模式保持开启，主界面仍然变暗

2. **测试问题 B 修复**：
   - 打开画中画（进入节能模式）
   - 关闭画中画窗口（点击关闭按钮或 ×）
   - **预期结果**：节能模式自动退出，主界面恢复正常亮度

3. **测试手动节能模式不受影响**：
   - 手动开启节能模式（不打开画中画）
   - 切换标签页
   - **预期结果**：手动节能模式保持开启

---

## 📝 问题2：设置页面命名规范统一

### 📍 问题描述

设置页面中存在以下命名不规范问题：
1. 出现"xx引擎"等技术术语（如"核心视觉引擎"、"UI 视觉引擎"）
2. 命名风格不统一，部分缺少 emoji
3. 部分功能名称过于冗长或技术性过强

### 🎯 命名规范

**统一格式**：`emoji + 简要功能名字 +（快捷键若有）`

**原则**：
- 使用用户能理解的日常语言，避免技术术语
- 保持简洁，不超过 10 个中文字符
- 所有主要功能项都必须有 emoji
- 快捷键用括号标注在名称后面

### 🛠️ 具体修改清单

#### 修改1：设置页面标题

**文件**：`index.html`  
**位置**：第 241 行

**修改前**：
```html
<h2 style="font-size: 20px;">系统与操作设置</h2>
```

**修改后**：
```html
<h2 style="font-size: 20px;">⚙️ 设置</h2>
```

#### 修改2：载入音乐区域

**文件**：`index.html`  
**位置**：第 245-248 行

**修改前**：
```html
<div class="drawer-title">📁 载入本地音乐 (Ctrl+O)</div>
<button class="btn-glass focusable" id="btnLoadFolder" style="width:100%;justify-content:center;background:var(--primary);color:var(--text-on-primary);border:none;padding:14px;">📁 打开文件夹</button>
```

**修改后**：
```html
<div class="drawer-title">📁 载入音乐 (Ctrl+O)</div>
<button class="btn-glass focusable" id="btnLoadFolder" style="width:100%;justify-content:center;background:var(--primary);color:var(--text-on-primary);border:none;padding:14px;">📁 打开文件夹</button>
```

#### 修改3：专辑封面取色区域

**文件**：`index.html`  
**位置**：第 251-258 行

**修改前**：
```html
<div class="drawer-title">🎨 专辑封面智能取色 (核心视觉引擎)</div>
<p style="font-size:12px;color:var(--text-sub);margin-bottom:12px;">自动提取封面颜色驱动全域视觉主题，覆盖任何预设主题色</p>
<button class="btn-glass focusable" id="btnToggleColorMode" style="width: 100%; justify-content: center; margin-bottom: 8px;">🎨 <span id="colorModeLabel">开启取色模式</span> (Y / C)</button>
```

**修改后**：
```html
<div class="drawer-title">🎨 封面取色</div>
<p style="font-size:12px;color:var(--text-sub);margin-bottom:12px;">自动提取专辑封面颜色作为主题色</p>
<button class="btn-glass focusable" id="btnToggleColorMode" style="width: 100%; justify-content: center; margin-bottom: 8px;">🎨 <span id="colorModeLabel">开启取色</span> (Y / C)</button>
```

#### 修改4：预设主题色区域

**文件**：`index.html`  
**位置**：第 260-263 行

**修改前**：
```html
<div class="drawer-title">🎨 预设主题色 · UI 视觉引擎</div>
```

**修改后**：
```html
<div class="drawer-title">🎨 主题色</div>
```

#### 修改5：自定义背景区域

**文件**：`index.html`  
**位置**：第 266-271 行

**修改前**：
```html
<div class="drawer-title">🖼️ 自定义背景</div>
<button class="btn-glass focusable" id="btnSetBg" style="width: 100%; justify-content: center; margin-bottom: 10px;">上传本地图片</button>
<button class="btn-glass focusable" id="btnClearBg" style="width: 100%; justify-content: center; color: #ff6b6b; border-color: rgba(255,107,107,0.3);">恢复默认逻辑</button>
```

**修改后**：
```html
<div class="drawer-title">🖼️ 背景图片</div>
<button class="btn-glass focusable" id="btnSetBg" style="width: 100%; justify-content: center; margin-bottom: 10px;">🖼️ 上传图片</button>
<button class="btn-glass focusable" id="btnClearBg" style="width: 100%; justify-content: center; color: #ff6b6b; border-color: rgba(255,107,107,0.3);">🔄 恢复默认</button>
```

#### 修改6：视觉调节区域

**文件**：`index.html`  
**位置**：第 274-278 行

**修改前**：
```html
<div class="drawer-title">🌗 视觉调节</div>
<button class="btn-glass focusable" id="btnToggleDarkMode" style="width: 100%; justify-content: center; margin-bottom: 15px;">🌙 深色模式</button>
```

**修改后**：
```html
<div class="drawer-title">🌗 显示调节</div>
<button class="btn-glass focusable" id="btnToggleDarkMode" style="width: 100%; justify-content: center; margin-bottom: 15px;">🌙 深色模式</button>
```

#### 修改7：均衡器区域

**文件**：`index.html`  
**位置**：第 281-283 行

**修改前**：
```html
<div class="drawer-title">🎛 十段均衡器 (EQ)</div>
```

**修改后**：
```html
<div class="drawer-title">🎛 均衡器</div>
```

#### 修改8：歌词显示调节区域

**文件**：`index.html`  
**位置**：第 286-305 行

**修改前**：
```html
<div class="drawer-title">📝 歌词显示调节</div>
```

**修改后**：
```html
<div class="drawer-title">📝 歌词显示</div>
```

#### 修改9：睡眠定时器区域

**文件**：`index.html`  
**位置**：第 308-315 行

**修改前**：
```html
<div class="drawer-title">🌙 睡眠定时器</div>
```

**修改后**：
```html
<div class="drawer-title">⏰ 睡眠定时 (Alt+T)</div>
```

#### 修改10：画中画区域

**文件**：`index.html`  
**位置**：第 318-331 行

**修改前**：
```html
<div class="drawer-title">🖼️ 画中画 & 功能</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;">
    <button class="btn-glass focusable" id="btnTogglePip" style="flex:1;justify-content:center;">📺 画中画 (Q)</button>
    <button class="btn-glass focusable" id="btnShowStats" style="flex:1;justify-content:center;">📊 统计 (T)</button>
</div>
<!-- 🚀 v2.7: 节能模式开关 -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
    <span style="font-size:13px;color:var(--text-sub);">⚡ 启动画中画时自动优化主界面性能</span>
    <label class="toggle-switch">
        <input type="checkbox" id="energySavingToggle" checked>
        <span class="toggle-slider"></span>
    </label>
</div>
```

**修改后**：
```html
<div class="drawer-title">📺 画中画 (Q)</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;">
    <button class="btn-glass focusable" id="btnTogglePip" style="flex:1;justify-content:center;">📺 打开画中画</button>
    <button class="btn-glass focusable" id="btnShowStats" style="flex:1;justify-content:center;">📊 播放统计 (T)</button>
</div>
<!-- 🚀 v2.7: 节能模式开关 -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
    <span style="font-size:13px;color:var(--text-sub);">⚡ 画中画节能模式</span>
    <label class="toggle-switch">
        <input type="checkbox" id="energySavingToggle" checked>
        <span class="toggle-slider"></span>
    </label>
</div>
```

#### 修改11：调试日志区域

**文件**：`index.html`  
**位置**：第 334-337 行

**修改前**：
```html
<div class="drawer-title">📋 调试与日志</div>
<button class="btn-glass focusable" id="btnExportLogs" style="width:100%;justify-content:center;">📋 导出调试日志</button>
```

**修改后**：
```html
<div class="drawer-title">📋 调试工具</div>
<button class="btn-glass focusable" id="btnExportLogs" style="width:100%;justify-content:center;">📋 导出日志</button>
```

#### 修改12：快捷键指南区域

**文件**：`index.html`  
**位置**：第 340-342 行

**修改前**：
```html
<div class="drawer-title">全域操作指南 (键盘 & 手柄)</div>
```

**修改后**：
```html
<div class="drawer-title">⌨️ 快捷键指南</div>
```

### 🧪 测试验证

1. 打开设置页面，检查所有功能名称是否符合规范
2. 确认没有出现"引擎"等技术术语
3. 确认所有主要功能都有 emoji
4. 确认快捷键标注格式统一

---

## 📋 修改文件清单

| 文件 | 修改内容 | 行号范围 |
|------|---------|---------|
| `app.js` | 添加 `pipTempEnergySaving` 全局变量 | ~第 35-50 行 |
| `app.js` | 修复 `togglePip()` 函数 | 第 2163-2243 行 |
| `app.js` | 修复 `enterEnergySaving()` 函数 | 第 2114-2149 行 |
| `app.js` | 修复 `exitEnergySaving()` 函数 | 第 2151-2160 行 |
| `app.js` | 修复 `visibilitychange` 事件监听器 | 第 4190-4197 行 |
| `index.html` | 统一设置页面命名规范 | 第 237-356 行 |

---

## ✅ 验收标准

### 画中画节能模式修复
- [ ] 打开画中画后切换标签页，节能模式保持开启
- [ ] 关闭画中画后，节能模式自动退出
- [ ] 手动开启的节能模式不受画中画影响
- [ ] 画中画窗口 × 按钮关闭时，节能模式正确退出

### 设置页面命名规范
- [ ] 所有功能名称使用 `emoji + 简要功能名 +（快捷键）` 格式
- [ ] 没有出现"引擎"等技术术语
- [ ] 所有主要功能项都有 emoji
- [ ] 命名简洁，不超过 10 个中文字符

---

## 🔧 问题3：节能板块整合重构（v2.8.2）

> **新增日期**: 2026-06-02  
> **目标版本**: v2.8.2  
> **任务**: 将所有节能相关功能整合到统一的"⚡ 节能模式"板块中

---

### 📍 需求描述

**整合前的问题**：
1. 性能模式（30fps）按钮隐藏在EQ面板下方，不易发现
2. 画中画节能开关与画中画按钮混在一起，逻辑不清晰
3. 缺少"一键节能"模式（去除动效但不降亮度）
4. 统计按钮与画中画按钮挤在同一行

**整合后的设计**：

```
⚡ 节能模式（新板块）
├─ 🔋 一键节能（开关）- 去除所有可视化动效，保持正常亮度
├─ 🎬 画面节能（开关）- 仅将动画帧率降至30fps
└─ 📺 临时节能（开关）- 启动画中画时自动优化主界面性能

📊 播放统计（单列）
├─ 📊 查看统计 (T)
```

**去除的内容**：
- 设置页面中的"📺 画中画 (Q)"按钮（保留主界面播放器上的画中画入口）
- 原"🖼️ 画中画 & 功能"板块

---

### 🎯 代码分析

#### 当前性能模式实现

**文件**: `app.js` 第 92-97 行

```javascript
// 性能模式
let performanceMode = false;
let targetFPS = 60;
let currentFPS = 60;
let fpsFrames = 0;
let fpsLastTime = performance.now();
```

**文件**: `app.js` 第 2675 行

```javascript
const frameInterval = performanceMode ? 1000 / 30 : 1000 / targetFPS;
if (timestamp - lastFrameTime < frameInterval) return;
```

**文件**: `app.js` 第 3344-3359 行（动态添加到EQ面板）

```javascript
// 性能模式
const perfDiv = document.createElement('div');
perfDiv.className = 'drawer-box';
perfDiv.style.marginTop = '20px';
perfDiv.innerHTML = `
    <div class="drawer-title">⚡ 性能模式</div>
    <button class="btn-glass focusable" id="btnTogglePerf" style="width:100%;justify-content:center;">${performanceMode ? '⚡ 节能模式 (30fps)' : '🚀 全性能模式 (60fps)'}</button>
`;
eqContainer.appendChild(perfDiv);
document.getElementById('btnTogglePerf').onclick = function() {
    performanceMode = !performanceMode;
    this.textContent = performanceMode ? '⚡ 节能模式 (30fps)' : '🚀 全性能模式 (60fps)';
    saveSettings();
    showToast(performanceMode ? '已切换节能模式 (30fps)' : '已切换全性能模式 (60fps)');
};
```

#### 当前节能模式实现

**文件**: `app.js` 第 2111-2175 行

```javascript
let isEnergySaving = false; // 节能模式状态机

function enterEnergySaving() {
    if (isEnergySaving) return;
    isEnergySaving = true;
    // ... 强制退出沉浸模式、清空粒子、释放流场、暂停渲染、降低歌词频率、添加CSS类 ...
}

function exitEnergySaving() {
    if (!isEnergySaving) return;
    // ... 防御性检查、恢复歌词同步、恢复CSS、恢复视觉特效 ...
}
```

#### 当前设置页面结构

**文件**: `index.html` 第 308-321 行

```html
<div class="drawer-box">
    <div class="drawer-title">🖼️ 画中画 & 功能</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-glass focusable" id="btnTogglePip" style="flex:1;justify-content:center;">📺 画中画 (Q)</button>
        <button class="btn-glass focusable" id="btnShowStats" style="flex:1;justify-content:center;">📊 统计 (T)</button>
    </div>
    <!-- 🚀 v2.7: 节能模式开关 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:13px;color:var(--text-sub);">⚡ 启动画中画时自动优化主界面性能</span>
        <label class="toggle-switch">
            <input type="checkbox" id="energySavingToggle" checked>
            <span class="toggle-slider"></span>
        </label>
    </div>
</div>
```

---

### 🛠️ 重构方案

#### 步骤1：修改 `index.html` 设置页面结构

**文件**: `index.html`  
**位置**: 第 308-321 行

**修改前**:
```html
<div class="drawer-box">
    <div class="drawer-title">🖼️ 画中画 & 功能</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-glass focusable" id="btnTogglePip" style="flex:1;justify-content:center;">📺 画中画 (Q)</button>
        <button class="btn-glass focusable" id="btnShowStats" style="flex:1;justify-content:center;">📊 统计 (T)</button>
    </div>
    <!-- 🚀 v2.7: 节能模式开关 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px 16px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:13px;color:var(--text-sub);">⚡ 启动画中画时自动优化主界面性能</span>
        <label class="toggle-switch">
            <input type="checkbox" id="energySavingToggle" checked>
            <span class="toggle-slider"></span>
        </label>
    </div>
</div>
```

**修改后**:
```html
<!-- 🚀 v2.8.2: 节能模式板块整合 -->
<div class="drawer-box" style="background:rgba(255,193,7,0.06);border-color:rgba(255,193,7,0.15);">
    <div class="drawer-title">⚡ 节能模式</div>
    
    <!-- 一键节能：去除所有可视化动效，保持正常亮度 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
        <div>
            <span style="font-size:14px;color:var(--text-main);">🔋 一键节能</span>
            <p style="font-size:11px;color:var(--text-sub);margin:2px 0 0;">去除所有动效，保持正常亮度</p>
        </div>
        <label class="toggle-switch">
            <input type="checkbox" id="oneClickEnergyToggle">
            <span class="toggle-slider"></span>
        </label>
    </div>
    
    <!-- 画面节能：仅将动画降至30帧 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
        <div>
            <span style="font-size:14px;color:var(--text-main);">🎬 画面节能</span>
            <p style="font-size:11px;color:var(--text-sub);margin:2px 0 0;">动画降至30帧，保留视觉效果</p>
        </div>
        <label class="toggle-switch">
            <input type="checkbox" id="frameEnergyToggle">
            <span class="toggle-slider"></span>
        </label>
    </div>
    
    <!-- 临时节能：启动画中画时自动优化 -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
        <div>
            <span style="font-size:14px;color:var(--text-main);">📺 临时节能</span>
            <p style="font-size:11px;color:var(--text-sub);margin:2px 0 0;">启动画中画时自动优化主界面</p>
        </div>
        <label class="toggle-switch">
            <input type="checkbox" id="pipEnergyToggle" checked>
            <span class="toggle-slider"></span>
        </label>
    </div>
</div>

<!-- 📊 播放统计（单列） -->
<div class="drawer-box">
    <div class="drawer-title">📊 播放统计 (T)</div>
    <button class="btn-glass focusable" id="btnShowStats" style="width:100%;justify-content:center;">📊 查看统计</button>
</div>
```

#### 步骤2：修改 `app.js` 全局变量与配置

**文件**: `app.js`  
**位置**: 第 92-106 行

**修改前**:
```javascript
// 性能模式
let performanceMode = false;
let targetFPS = 60;
let currentFPS = 60;
let fpsFrames = 0;
let fpsLastTime = performance.now();
let particleCount = MAX_PARTICLES; // 动态粒子数量

// 偏好配置
let cfg = {
    colorMode: false, darkMode: false,
    lrcAlign: 'center', themePreset: null,
    energySavingEnabled: true // 🚀 v2.7: 画中画启动时自动优化主界面性能
};
```

**修改后**:
```javascript
// 🚀 v2.8.2: 性能与节能模式重构
let performanceMode = false;      // 原性能模式（兼容保留，映射到画面节能）
let targetFPS = 60;
let currentFPS = 60;
let fpsFrames = 0;
let fpsLastTime = performance.now();
let particleCount = MAX_PARTICLES; // 动态粒子数量

// 🚀 v2.8.2: 新增节能模式状态机
let oneClickEnergySaving = false;  // 🔋 一键节能：去除所有动效，保持亮度
let frameEnergySaving = false;     // 🎬 画面节能：仅降至30fps
let pipTempEnergySaving = false;   // 📺 临时节能：画中画触发（原 cfg.energySavingEnabled）

// 偏好配置
let cfg = {
    colorMode: false, darkMode: false,
    lrcAlign: 'center', themePreset: null,
    // 🚀 v2.8.2: 节能配置重构
    oneClickEnergyEnabled: false,   // 一键节能开关状态
    frameEnergyEnabled: false,      // 画面节能开关状态
    pipEnergyEnabled: true          // 临时节能开关状态（原 energySavingEnabled）
};
```

#### 步骤3：修改 `saveSettings()` 函数

**文件**: `app.js`  
**位置**: 第 180-190 行

**修改前**:
```javascript
localStorage.setItem('MBolka_Settings_v3', JSON.stringify({
    colorMode: cfg.colorMode, darkMode: cfg.darkMode,
    lrcAlign: cfg.lrcAlign, themePreset: cfg.themePreset,
    preservesPitch: preservesPitch, crossfadeEnabled: crossfadeEnabled,
    crossfadeDuration: crossfadeDuration, performanceMode: performanceMode,
    eqGains: eqGains, lyricsOffset: lyricsOffset,
    energySavingEnabled: cfg.energySavingEnabled
}));
```

**修改后**:
```javascript
localStorage.setItem('MBolka_Settings_v3', JSON.stringify({
    colorMode: cfg.colorMode, darkMode: cfg.darkMode,
    lrcAlign: cfg.lrcAlign, themePreset: cfg.themePreset,
    preservesPitch: preservesPitch, crossfadeEnabled: crossfadeEnabled,
    crossfadeDuration: crossfadeDuration, 
    // 🚀 v2.8.2: 兼容旧版 performanceMode
    performanceMode: performanceMode,
    // 🚀 v2.8.2: 新增节能配置
    oneClickEnergyEnabled: cfg.oneClickEnergyEnabled,
    frameEnergyEnabled: cfg.frameEnergyEnabled,
    pipEnergyEnabled: cfg.pipEnergyEnabled,
    eqGains: eqGains, lyricsOffset: lyricsOffset,
    // 🚀 v2.8.2: 兼容旧版 energySavingEnabled
    energySavingEnabled: cfg.pipEnergyEnabled
}));
```

#### 步骤4：修改 `loadSettings()` 函数

**文件**: `app.js`  
**位置**: 第 210-225 行

**修改前**:
```javascript
if (stored) {
    cfg.colorMode = stored.colorMode ?? false;
    cfg.darkMode = stored.darkMode ?? false;
    cfg.lrcAlign = stored.lrcAlign ?? 'center';
    cfg.themePreset = stored.themePreset ?? null;
    preservesPitch = stored.preservesPitch ?? true;
    crossfadeEnabled = stored.crossfadeEnabled ?? false;
    crossfadeDuration = stored.crossfadeDuration ?? 3;
    performanceMode = stored.performanceMode ?? false;
    eqGains = stored.eqGains ?? new Array(10).fill(0);
    lyricsOffset = stored.lyricsOffset ?? 0;
    cfg.energySavingEnabled = stored.energySavingEnabled ?? true;
    const esToggle = document.getElementById('energySavingToggle');
    if (esToggle) esToggle.checked = cfg.energySavingEnabled;
}
```

**修改后**:
```javascript
if (stored) {
    cfg.colorMode = stored.colorMode ?? false;
    cfg.darkMode = stored.darkMode ?? false;
    cfg.lrcAlign = stored.lrcAlign ?? 'center';
    cfg.themePreset = stored.themePreset ?? null;
    preservesPitch = stored.preservesPitch ?? true;
    crossfadeEnabled = stored.crossfadeEnabled ?? false;
    crossfadeDuration = stored.crossfadeDuration ?? 3;
    
    // 🚀 v2.8.2: 兼容旧版 performanceMode，映射到 frameEnergyEnabled
    performanceMode = stored.performanceMode ?? false;
    cfg.frameEnergyEnabled = stored.frameEnergyEnabled ?? performanceMode;
    
    eqGains = stored.eqGains ?? new Array(10).fill(0);
    lyricsOffset = stored.lyricsOffset ?? 0;
    
    // 🚀 v2.8.2: 兼容旧版 energySavingEnabled，映射到 pipEnergyEnabled
    cfg.pipEnergyEnabled = stored.pipEnergyEnabled ?? stored.energySavingEnabled ?? true;
    cfg.oneClickEnergyEnabled = stored.oneClickEnergyEnabled ?? false;
    
    // 🚀 v2.8.2: 同步UI开关状态
    const oneClickToggle = document.getElementById('oneClickEnergyToggle');
    if (oneClickToggle) oneClickToggle.checked = cfg.oneClickEnergyEnabled;
    const frameToggle = document.getElementById('frameEnergyToggle');
    if (frameToggle) frameToggle.checked = cfg.frameEnergyEnabled;
    const pipToggle = document.getElementById('pipEnergyToggle');
    if (pipToggle) pipToggle.checked = cfg.pipEnergyEnabled;
}
```

#### 步骤5：修改 `enterEnergySaving()` 函数（支持三种模式）

**文件**: `app.js`  
**位置**: 第 2114-2149 行

**修改后**:
```javascript
// 🚀 v2.8.2: 进入节能模式 — 支持三种模式
function enterEnergySaving(mode = 'pip') {
    if (isEnergySaving) return;
    isEnergySaving = true;

    // 🔋 一键节能模式：去除所有动效，但保持正常亮度
    if (mode === 'oneclick' || oneClickEnergySaving) {
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
        // 🚀 v2.8.2: 一键节能不添加 pip-standby CSS 类（保持正常亮度）
        showToast("🔋 一键节能已开启", "⚡");
        return; // 跳过其他处理
    }

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
    // 🚀 v2.7.0: 释放流场大数组
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
    // CSS 休眠主界面（仅非一键节能模式）
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) wrapper.classList.add('pip-standby');
}
```

#### 步骤6：修改 `exitEnergySaving()` 函数

**文件**: `app.js`  
**位置**: 第 2151-2175 行

**修改后**:
```javascript
// 🚀 v2.8.2: 退出节能模式
function exitEnergySaving() {
    if (!isEnergySaving) return;

    // 🔧 v2.8.1 P1: 防御性检查，防止在画中画模式下意外退出节能模式
    if (pipWindow && !pipWindow.closed) {
        console.warn("⚠️ 尝试在画中画激活时退出节能模式，已阻止");
        return;
    }

    isEnergySaving = false;
    // 恢复歌词高频同步
    if (lrcTimer) { clearInterval(lrcTimer); lrcTimer = null; }
    // 恢复 CSS
    const wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
        wrapper.classList.remove('pip-standby');
        // 🔧 v2.8.1 P1: 强制触发重绘，确保样式生效
        void wrapper.offsetHeight;
    }

    // 🔧 v2.8.1 P1: 恢复视觉特效
    if (analyser && !isImmersiveMode) {
        requestAnimationFrame(renderVisLoop);
    }
    
    // 🚀 v2.8.2: 清除所有节能状态标记
    pipTempEnergySaving = false;
}
```

#### 步骤7：修改 `renderVisLoop()` 函数（支持画面节能30fps）

**文件**: `app.js`  
**位置**: 第 2657-2686 行

**修改后**:
```javascript
// === 🚀 核心重构：全域 60FPS 色音同步视觉主循环 ===
const renderVisLoop = (timestamp) => {
    requestAnimationFrame(renderVisLoop);

    // 1. FPS 监测与性能自适应
    fpsFrames++;
    if (timestamp - fpsLastTime >= 1000) {
        currentFPS = Math.round(fpsFrames / ((timestamp - fpsLastTime) / 1000));
        fpsFrames = 0;
        fpsLastTime = timestamp;

        if (currentFPS < 30 && particleCount > 30) {
            particleCount = Math.max(30, particleCount - 10);
        } else if (currentFPS > 55 && particleCount < MAX_PARTICLES) {
            particleCount = Math.min(MAX_PARTICLES, particleCount + 5);
        }
    }

    // 🚀 v2.8.2: 画面节能模式（30fps）或原性能模式
    const isFrameLimited = frameEnergySaving || performanceMode;
    const frameInterval = isFrameLimited ? 1000 / 30 : 1000 / targetFPS;
    if (timestamp - lastFrameTime < frameInterval) return;
    lastFrameTime = timestamp;

    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    // 🚀 v2.8: 节能模式 — 激活时跳过全部绘制（含沉浸舱），仅保持 rAF 心跳
    if (isEnergySaving) {
        requestAnimationFrame(renderVisLoop);
        return;
    }

    // ... 其余绘制逻辑保持不变 ...
};
```

#### 步骤8：修改 `togglePip()` 函数（使用新的 pipEnergyEnabled）

**文件**: `app.js`  
**位置**: 第 2180-2250 行

**修改后关键部分**:
```javascript
async function togglePip() {
    if (pipWindow) {
        // 关闭 PiP
        if (pipSyncInterval) { clearInterval(pipSyncInterval); pipSyncInterval = null; }
        if (pipHealthCheck) { clearInterval(pipHealthCheck); pipHealthCheck = null; }
        pipWindow.close();
        pipWindow = null;

        // 🚀 v2.8.2: 关闭画中画时，如果是临时节能则退出
        if (pipTempEnergySaving) {
            pipTempEnergySaving = false;
            exitEnergySaving();
            showToast("📺 已退出画中画节能模式", "⚡");
        }

        updatePipQuickBtn();
        return;
    }

    if (!('documentPictureInPicture' in window)) {
        showToast("⚠️ 浏览器不支持画中画功能");
        return;
    }

    try {
        pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 400, height: 280
        });

        // 🚀 v2.8.2: 根据临时节能开关决定是否进入节能模式
        if (cfg.pipEnergyEnabled) {
            pipTempEnergySaving = true;
            enterEnergySaving('pip');
            showToast("⚡ 主界面已进入节能模式", "📺");
        }

        // PiP 窗口关闭监听
        pipWindow.addEventListener('pagehide', () => {
            pipWindow = null;
            if (pipTempEnergySaving) {
                pipTempEnergySaving = false;
                exitEnergySaving();
            }
            updatePipQuickBtn();
        });

        // ... 其余代码保持不变 ...
    }
}
```

#### 步骤9：修改 `renderEQPanel()` 函数（移除旧性能模式UI）

**文件**: `app.js`  
**位置**: 第 3344-3359 行

**修改后**:
```javascript
// 🚀 v2.8.2: 性能模式UI已整合到节能板块，此处不再单独显示
// 如需保留兼容，可注释掉以下代码
/*
const perfDiv = document.createElement('div');
perfDiv.className = 'drawer-box';
perfDiv.style.marginTop = '20px';
perfDiv.innerHTML = `
    <div class="drawer-title">⚡ 性能模式</div>
    <button class="btn-glass focusable" id="btnTogglePerf" style="width:100%;justify-content:center;">${performanceMode ? '⚡ 节能模式 (30fps)' : '🚀 全性能模式 (60fps)'}</button>
`;
eqContainer.appendChild(perfDiv);
// ... 按钮事件绑定 ...
*/
```

#### 步骤10：添加新节能板块的事件绑定

**文件**: `app.js`  
**位置**: 在设置页面打开后的初始化区域（约第 2995 行附近）

**新增代码**:
```javascript
// 🚀 v2.8.2: 节能模式板块事件绑定
bindBtn('btnShowStats', () => safeTransition(showStatsPanel));

// 一键节能开关
const oneClickToggle = document.getElementById('oneClickEnergyToggle');
if (oneClickToggle) {
    oneClickToggle.addEventListener('change', (e) => {
        cfg.oneClickEnergyEnabled = e.target.checked;
        oneClickEnergySaving = e.target.checked;
        if (e.target.checked) {
            enterEnergySaving('oneclick');
            showToast("🔋 一键节能已开启", "⚡");
        } else {
            exitEnergySaving();
            showToast("🔋 一键节能已关闭", "⚡");
        }
        saveSettings();
    });
}

// 画面节能开关
const frameToggle = document.getElementById('frameEnergyToggle');
if (frameToggle) {
    frameToggle.addEventListener('change', (e) => {
        cfg.frameEnergyEnabled = e.target.checked;
        frameEnergySaving = e.target.checked;
        // 同步兼容旧版 performanceMode
        performanceMode = e.target.checked;
        showToast(frameEnergySaving ? "🎬 画面节能已开启 (30fps)" : "🎬 画面节能已关闭 (60fps)", "⚡");
        saveSettings();
    });
}

// 临时节能开关
const pipToggle = document.getElementById('pipEnergyToggle');
if (pipToggle) {
    pipToggle.addEventListener('change', (e) => {
        cfg.pipEnergyEnabled = e.target.checked;
        showToast(cfg.pipEnergyEnabled ? "📺 临时节能已开启" : "📺 临时节能已关闭", "⚡");
        saveSettings();
    });
}
```

#### 步骤11：移除设置页面中的画中画按钮绑定

**文件**: `app.js`  
**位置**: 查找 `btnTogglePip` 的绑定代码

**修改**: 注释掉或删除设置页面中 `btnTogglePip` 的事件绑定，保留主界面播放器上的画中画入口。

---

### 🧪 测试验证

1. **一键节能测试**：
   - 打开设置 → 开启"🔋 一键节能"
   - **预期**：所有可视化动效停止，但界面亮度正常
   - 关闭开关 → **预期**：动效恢复

2. **画面节能测试**：
   - 打开设置 → 开启"🎬 画面节能"
   - **预期**：动画帧率降至30fps，视觉效果保留
   - 关闭开关 → **预期**：恢复60fps

3. **临时节能测试**：
   - 打开设置 → 确认"📺 临时节能"开启
   - 打开画中画 → **预期**：主界面进入节能模式
   - 关闭画中画 → **预期**：节能模式自动退出

4. **兼容性测试**：
   - 确认旧版 `performanceMode` 设置正确映射到 `frameEnergyEnabled`
   - 确认旧版 `energySavingEnabled` 设置正确映射到 `pipEnergyEnabled`

---

## 🔧 问题4：性能优化深度指南（v2.8.2+）

> **目标**: 系统性优化 MBolka Player 的 CPU、GPU、内存占用  
> **范围**: 代码级优化 + 运行时优化策略

---

### 📊 当前性能瓶颈分析

#### 1. CPU 占用过高

**瓶颈位置**: `app.js` 第 2657 行 `renderVisLoop()`

**问题**:
- `requestAnimationFrame` 持续运行，即使页面不可见
- 频谱分析每次渲染都执行 `analyser.getByteFrequencyData(dataArray)`
- 沉浸模式流场计算每帧重建数组

**优化方案**:

```javascript
// 🚀 v2.8.2+: 添加 Page Visibility API 优化
let visLoopPaused = false;

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        visLoopPaused = true;
        // 暂停高频更新
        if (lrcTimer) clearInterval(lrcTimer);
    } else {
        visLoopPaused = false;
        // 恢复渲染
        if (!isEnergySaving && analyser) {
            requestAnimationFrame(renderVisLoop);
        }
    }
});

const renderVisLoop = (timestamp) => {
    if (visLoopPaused) {
        // 页面不可见时，大幅降低渲染频率
        setTimeout(() => requestAnimationFrame(renderVisLoop), 500);
        return;
    }
    requestAnimationFrame(renderVisLoop);
    // ... 原有逻辑 ...
};
```

#### 2. GPU 占用过高

**瓶颈位置**: `visualizer.js` 粒子系统 + 沉浸模式 Canvas

**问题**:
- 粒子系统使用 `shadowBlur` 和 `globalAlpha` 导致大量 GPU overdraw
- 沉浸模式 Canvas 全屏分辨率渲染
- 频谱柱状图使用渐变填充

**优化方案**:

```javascript
// 🚀 v2.8.2+: GPU 优化 — 减少 overdraw
// 在 Particle.draw() 中
Particle.prototype.draw = function(ctx) {
    if(!this.active) return;
    // 避免 save/restore 的频繁调用
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = prevAlpha;
};

// 沉浸模式使用半分辨率渲染
function setupImmersiveCanvas() {
    const cvs = el.canvasImm;
    const dpr = Math.min(window.devicePixelRatio, 1.5); // 限制 DPR
    cvs.width = window.innerWidth * dpr;
    cvs.height = window.innerHeight * dpr;
    cvs.style.width = window.innerWidth + 'px';
    cvs.style.height = window.innerHeight + 'px';
    const ctx = cvs.getContext('2d');
    ctx.scale(dpr, dpr);
}
```

#### 3. 内存占用过高

**瓶颈位置**: `app.js` 封面缓存 + `visualizer.js` 对象池

**问题**:
- IndexedDB 封面缓存无上限
- 对象池 `particlePool` 和 `ripplePool` 预分配固定大小
- 音频缓冲区累积

**优化方案**:

```javascript
// 🚀 v2.8.2+: 内存优化 — 封面缓存LRU淘汰
const MAX_COVER_CACHE = 50; // 最多缓存50张封面
let coverCacheLRU = [];

async function cacheCover(fileName, dataUrl) {
    // LRU 淘汰
    if (coverCacheLRU.length >= MAX_COVER_CACHE) {
        const oldest = coverCacheLRU.shift();
        await dbDelete('covers', oldest);
    }
    coverCacheLRU.push(fileName);
    await dbPut('covers', { fileName, dataUrl, timestamp: Date.now() });
}

// 对象池动态调整
function adjustPoolSize() {
    const isLowEnd = navigator.hardwareConcurrency <= 4;
    const maxPool = isLowEnd ? 80 : MAX_POOL;
    while (particlePool.length > maxPool) {
        particlePool.pop();
    }
}
```

---

### 🎯 一键节能模式下可开启的优化

当用户开启"🔋 一键节能"时，应自动启用以下优化：

| 优化项 | 效果 | 实现位置 |
|--------|------|----------|
| 暂停粒子生成 | 减少 CPU/GPU | `mousemove`/`touchmove` 事件监听器 |
| 禁用涟漪效果 | 减少 GPU overdraw | `click` 事件监听器 |
| 降低歌词同步频率 | 减少定时器开销 | `enterEnergySaving('oneclick')` |
| 暂停频谱分析 | 减少 AudioWorklet 开销 | `renderVisLoop()` 开头 |
| 降低 Canvas 分辨率 | 减少 GPU 填充率 | `setupImmersiveCanvas()` |
| 禁用封面取色 | 减少 Image 解析开销 | `extractAlbumColor()` |

---

### 📋 代码修改清单

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `app.js` ~第 92 行 | 添加 `visLoopPaused` 变量 | ⭐⭐⭐ |
| `app.js` ~第 4190 行 | 优化 `visibilitychange` 处理 | ⭐⭐⭐ |
| `visualizer.js` | 优化 `Particle.draw()` 减少 save/restore | ⭐⭐⭐ |
| `app.js` | 沉浸模式 Canvas 限制 DPR | ⭐⭐ |
| `app.js` | 封面缓存添加 LRU 淘汰 | ⭐⭐ |
| `app.js` | 对象池根据硬件动态调整 | ⭐⭐ |
| `app.js` | 一键节能模式禁用封面取色 | ⭐ |

---

## 🔧 问题5：双语LRC歌词显示优化（v2.8.3）

> **新增日期**: 2026-06-02  
> **目标版本**: v2.8.3  
> **任务**: 支持同时间戳双行歌词（原文+翻译）的检测与全场景显示优化

---

### 📍 需求描述

**新型LRC格式特征**：
- 同一 `time` 时间戳下可能出现 **两行歌词**
- 第一行：原文（如英文/韩文）
- 第二行：中文翻译
- 参考文件：`Q:<span class="highlight">数据\库\Music\TME\LEMONADE - aespa.lrc`

**示例**（第 7-8 行）：
```
[00:07.70]I go in all the way
[00:07.70]我全情投入其中
```

**当前问题**：
- `parseLyricText()` 按时间排序后，同时间戳的两行歌词会连续出现
- `syncLyrics()` 的 "当前行+下一行" 逻辑会将翻译行误当作"下一行"
- 沉浸模式 `immCurrLine` / `immNextLine` 仅支持单行显示
- 歌词面板 `.lrc-line.active + .lrc-line` 的相邻兄弟选择器会错误高亮翻译行

**优化目标**：
- 检测同时间戳双行歌词，将原文与翻译 **合并为一组**
- 原文行保持正常样式，翻译行 **提高不透明度 + 调大字号**
- 全场景适配：主界面歌词面板、沉浸模式、画中画、进度条悬停预览

---

### 🎯 代码分析

#### 当前歌词解析逻辑

**文件**: `app.js` 第 1260-1279 行

```javascript
function parseLyricText(text) {
    const result = [];
    text.split(/\r?\n/).forEach(line => {
        const times = line.match(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g);
        if (times) {
            const txt = decodeText(line.replace(/\[.*?\]/g, '').trim());
            if (txt) {
                times.forEach(t => {
                    const match = t.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/);
                    if (match) {
                        const ms = match[3] ? parseInt(match[3].padEnd(3,'0')) : 0;
                        result.push({ time: parseInt(match[1])*60 + parseInt(match[2]) + ms/1000, text: txt });
                    }
                });
            }
        }
    });
    result.sort((a,b) => a.time - b.time);
    return result;
}
```

**问题**：排序后同时间戳的两行歌词会相邻，但数据结构中没有标记它们是"一组"。

#### 当前歌词同步逻辑

**文件**: `app.js` 第 1342-1368 行

```javascript
const syncLyrics = (force = false) => {
    if(!parsedLyrics.length) return;
    const cur = audio.currentTime - lyricsOffset;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) { if (cur >= parsedLyrics[i].time - 0.2) activeIdx = i; else break; }

    // 主界面歌词面板高亮
    if (el.lrcPanel.style.display !== 'none') {
        const lines = el.lrcView.querySelectorAll('.lrc-line');
        lines.forEach((line, i) => {
            if (i === activeIdx) {
                if (!line.classList.contains('active')) {
                    line.classList.add('active');
                    // ... 滚动逻辑 ...
                }
            } else line.classList.remove('active');
        });
    }

    // 沉浸模式双行显示
    if (activeIdx !== -1 && !el.immLrcCenter.classList.contains('hidden')) {
        const curTxt = parsedLyrics[activeIdx].text;
        const nextTxt = activeIdx+1 < parsedLyrics.length ? parsedLyrics[activeIdx+1].text : '';
        if(el.immCurrLine.textContent !== curTxt) { el.immCurrLine.style.opacity=0; setTimeout(()=>{ el.immCurrLine.textContent=curTxt; el.immCurrLine.style.opacity=1; }, 200); }
        if(el.immNextLine.textContent !== nextTxt) { el.immNextLine.style.opacity=0; setTimeout(()=>{ el.immNextLine.textContent=nextTxt; el.immNextLine.style.opacity=1; }, 200); }
    }
};
```

**问题**：
1. `activeIdx+1` 在双语场景下可能是翻译行，不是真正的"下一行原文"
2. 沉浸模式 `immNextLine` 会显示翻译而非下一时间戳的原文

#### 当前歌词面板CSS

**文件**: `css/base-layout.css` 第 173-203 行

```css
.lrc-line { 
    font-size: var(--lrc-font-size); 
    line-height: var(--lrc-line-height); 
    color: rgba(255,255,255,0.35); 
    transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); 
    min-height: 40px; 
}
.lrc-line.active { 
    color: #fff; 
    font-size: calc(var(--lrc-font-size) * 1.44); 
    font-weight: 700; 
}
.lrc-line.active + .lrc-line {
    filter: blur(0px) !important;
    opacity: 0.75;
    transform: scale(0.98);
}
```

**问题**：`.lrc-line.active + .lrc-line` 选择器会将翻译行作为"下一行"高亮，导致视觉混乱。

#### 沉浸模式CSS

**文件**: `css/immersive.css` 第 38-54 行

```css
.imm-subtitle-line { 
    font-size: clamp(28px, 4vw, 46px); 
    font-weight: 800; 
    margin-bottom: 12px; 
    min-height: 1.4em; 
    transition: all 0.4s var(--curve-spring); 
}
.imm-subtitle-line.next { 
    font-size: clamp(20px, 2.5vw, 28px); 
    font-weight: 600; 
    color: rgba(255,255,255,0.5); 
    margin-top: 8px; 
    min-height: 1.4em;
}
```

---

### 🛠️ 优化方案

#### 步骤1：修改 `parseLyricText()` 检测并合并双语歌词

**文件**: `app.js`  
**位置**: 第 1260-1279 行

**修改后**:
```javascript
// 🚀 v2.8.3: 支持双语LRC（同时间戳原文+翻译）
function parseLyricText(text) {
    const rawLines = [];
    
    // 第一步：解析所有时间戳和文本
    text.split(/\r?\n/).forEach(line => {
        const times = line.match(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g);
        if (times) {
            const txt = decodeText(line.replace(/\[.*?\]/g, '').trim());
            if (txt) {
                times.forEach(t => {
                    const match = t.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/);
                    if (match) {
                        const ms = match[3] ? parseInt(match[3].padEnd(3,'0')) : 0;
                        rawLines.push({ 
                            time: parseInt(match[1])*60 + parseInt(match[2]) + ms/1000, 
                            text: txt 
                        });
                    }
                });
            }
        }
    });
    
    // 第二步：按时间排序
    rawLines.sort((a,b) => a.time - b.time);
    
    // 第三步：检测并合并同时间戳的双语歌词
    const result = [];
    for (let i = 0; i < rawLines.length; i++) {
        const current = rawLines[i];
        const next = rawLines[i + 1];
        
        // 检测：下一个条目时间戳相同（允许0.01秒误差）且文本不同
        if (next && Math.abs(next.time - current.time) < 0.02 && next.text !== current.text) {
            // 判断哪一行是原文，哪一行是翻译
            // 启发式规则：包含中文字符的是翻译，否则是原文
            const isCurrentChinese = /[\u4e00-\u9fff]/.test(current.text);
            const isNextChinese = /[\u4e00-\u9fff]/.test(next.text);
            
            let original, translation;
            if (isCurrentChinese && !isNextChinese) {
                // current是翻译，next是原文（罕见，但保险）
                original = next.text;
                translation = current.text;
            } else {
                // 默认：current是原文，next是翻译
                original = current.text;
                translation = next.text;
            }
            
            result.push({
                time: current.time,
                text: original,           // 主显示文本（原文）
                original: original,       // 原文
                translation: translation, // 翻译
                isBilingual: true         // 标记为双语行
            });
            i++; // 跳过已合并的下一行
        } else {
            // 单语歌词，保持原有结构
            result.push({
                time: current.time,
                text: current.text,
                original: current.text,
                translation: null,
                isBilingual: false
            });
        }
    }
    
    return result;
}
```

#### 步骤2：修改 `loadLrc()` 渲染双语歌词DOM

**文件**: `app.js`  
**位置**: 第 1316-1323 行

**修改后**:
```javascript
    parsedLyrics.forEach((l) => {
        const d = document.createElement('div');
        d.className = 'lrc-line';
        d.dataset.time = l.time; // 🚀 v2.8.3: 存储时间戳用于同步匹配
        
        if (l.isBilingual) {
            // 双语行：原文 + 翻译
            d.innerHTML = `
                <span class="lrc-original">${escapeHtml(l.original)}</span>
                <span class="lrc-translation">${escapeHtml(l.translation)}</span>
            `;
            d.classList.add('bilingual');
        } else {
            d.textContent = l.text;
        }
        
        d.onclick = () => { audio.currentTime = l.time + lyricsOffset; syncLyrics(true); };
        el.lrcView.appendChild(d);
    });
```

**新增辅助函数**（放在 `parseLyricText` 附近）：
```javascript
// 🚀 v2.8.3: HTML转义防止XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

#### 步骤3：修改 `syncLyrics()` 支持双语显示

**文件**: `app.js`  
**位置**: 第 1342-1368 行

**修改后**:
```javascript
const syncLyrics = (force = false) => {
    if(!parsedLyrics.length) return;
    const cur = audio.currentTime - lyricsOffset;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) { 
        if (cur >= parsedLyrics[i].time - 0.2) activeIdx = i; 
        else break; 
    }

    // 主界面歌词面板高亮
    if (el.lrcPanel.style.display !== 'none') {
        const lines = el.lrcView.querySelectorAll('.lrc-line');
        lines.forEach((line, i) => {
            if (i === activeIdx) {
                if (!line.classList.contains('active')) {
                    line.classList.add('active');
                    if (!isUserScrollingLyrics || force) {
                        const offset = line.offsetTop - el.lrcView.offsetTop - (el.lrcView.clientHeight / 2) + (line.clientHeight / 2);
                        el.lrcView.scrollTo({ top: offset, behavior: 'smooth' });
                    }
                }
            } else line.classList.remove('active');
        });
    }

    // 🚀 v2.8.3: 沉浸模式双语歌词显示优化
    if (activeIdx !== -1 && !el.immLrcCenter.classList.contains('hidden')) {
        const currentLrc = parsedLyrics[activeIdx];
        
        if (currentLrc.isBilingual) {
            // 双语行：原文大字高亮 + 翻译行跟随显示
            const displayText = `${currentLrc.original}\n${currentLrc.translation}`;
            if(el.immCurrLine.textContent !== displayText) {
                el.immCurrLine.style.opacity = 0;
                setTimeout(() => {
                    el.immCurrLine.innerHTML = `
                        <span class="imm-original">${escapeHtml(currentLrc.original)}</span>
                        <span class="imm-translation">${escapeHtml(currentLrc.translation)}</span>
                    `;
                    el.immCurrLine.style.opacity = 1;
                }, 200);
            }
            
            // 下一行：找到下一个不同时间戳的歌词
            let nextIdx = activeIdx + 1;
            while (nextIdx < parsedLyrics.length && 
                   Math.abs(parsedLyrics[nextIdx].time - currentLrc.time) < 0.02) {
                nextIdx++;
            }
            const nextLrc = nextIdx < parsedLyrics.length ? parsedLyrics[nextIdx] : null;
            const nextTxt = nextLrc ? nextLrc.text : '';
            
            if(el.immNextLine.textContent !== nextTxt) {
                el.immNextLine.style.opacity = 0;
                setTimeout(() => { 
                    el.immNextLine.textContent = nextTxt; 
                    el.immNextLine.style.opacity = 1; 
                }, 200);
            }
        } else {
            // 单语行：保持原有逻辑
            const curTxt = currentLrc.text;
            const nextTxt = activeIdx+1 < parsedLyrics.length ? parsedLyrics[activeIdx+1].text : '';
            if(el.immCurrLine.textContent !== curTxt) { 
                el.immCurrLine.innerHTML = escapeHtml(curTxt); 
                el.immCurrLine.style.opacity=0; 
                setTimeout(()=>{ el.immCurrLine.style.opacity=1; }, 200); 
            }
            if(el.immNextLine.textContent !== nextTxt) { 
                el.immNextLine.textContent = nextTxt; 
                el.immNextLine.style.opacity=0; 
                setTimeout(()=>{ el.immNextLine.style.opacity=1; }, 200); 
            }
        }
    }
};
```

#### 步骤4：新增歌词面板CSS样式

**文件**: `css/base-layout.css`  
**位置**: 在第 203 行之后追加

```css
/* 🚀 v2.8.3: 双语歌词显示优化 */
.lrc-line.bilingual {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
}

.lrc-line .lrc-original {
    display: block;
    font-size: inherit;
    color: inherit;
}

.lrc-line .lrc-translation {
    display: block;
    font-size: calc(var(--lrc-font-size) * 0.92);
    color: rgba(255,255,255,0.65);
    font-weight: 500;
    opacity: 0.9;
    transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 激活状态：原文高亮，翻译跟随提亮 */
.lrc-line.active .lrc-translation {
    font-size: calc(var(--lrc-font-size) * 1.15);
    color: rgba(255,255,255,0.88);
    opacity: 1;
    font-weight: 600;
}

/* 非激活状态：翻译淡化 */
.lrc-line:not(.active) .lrc-translation {
    opacity: 0.55;
    font-size: calc(var(--lrc-font-size) * 0.85);
}

/* 移除旧的相邻兄弟选择器，避免误高亮翻译行 */
.lrc-line.active + .lrc-line:not(.bilingual) {
    filter: blur(0px) !important;
    opacity: 0.75;
    transform: scale(0.98);
}
```

#### 步骤5：修改沉浸模式CSS

**文件**: `css/immersive.css`  
**位置**: 在第 54 行之后追加

```css
/* 🚀 v2.8.3: 沉浸模式双语歌词 */
.imm-subtitle-line .imm-original {
    display: block;
    font-size: inherit;
    font-weight: inherit;
    color: inherit;
}

.imm-subtitle-line .imm-translation {
    display: block;
    font-size: clamp(22px, 3vw, 36px);
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    margin-top: 8px;
    opacity: 0.95;
    text-shadow: 0 2px 10px rgba(0,0,0,0.6), 0 0 20px var(--primary-glow);
    transition: all 0.4s var(--curve-spring);
}

/* 画中画模式下的双语歌词适配 */
@media (max-width: 480px) {
    .imm-subtitle-line .imm-translation {
        font-size: clamp(16px, 2vw, 24px);
        margin-top: 4px;
    }
}
```

#### 步骤6：修改 `getLyricAtTime()` 支持双语

**文件**: `app.js`  
**位置**: 第 1373-1383 行

**修改后**:
```javascript
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
```

#### 步骤7：修改画中画歌词显示

**文件**: `js/pip.js`（或 `app.js` 中画中画相关代码）

如果画中画窗口中有独立的歌词显示逻辑，需要同步修改以支持 `.isBilingual` 标记。核心逻辑与沉浸模式类似：
- 检测到 `isBilingual` 时，原文正常显示，翻译行以更高不透明度、更大字号显示
- 未检测到则保持原有单行逻辑

---

### 🧪 测试验证

1. **双语LRC加载测试**：
   - 加载 `LEMONADE - aespa.lrc`
   - **预期**：同时间戳的两行歌词合并为一组，原文在上，翻译在下
   - 检查 `parsedLyrics` 数组，确认 `isBilingual: true` 且包含 `original` / `translation`

2. **主界面歌词面板测试**：
   - 播放至双语歌词时间点
   - **预期**：原文正常高亮，翻译行以较大字号、较高不透明度显示
   - 非激活行：翻译应淡化（opacity 0.55）

3. **沉浸模式测试**：
   - 切换至沉浸模式
   - **预期**：`immCurrLine` 显示原文（大字），翻译行紧随其后（稍小但清晰）
   - `immNextLine` 显示下一组歌词（非当前翻译行）

4. **进度条悬停预览测试**：
   - 鼠标悬停在进度条上
   - **预期**：提示框显示 `"🎤 原文 | 翻译 [时间]"`

5. **单语LRC兼容性测试**：
   - 加载普通单语LRC
   - **预期**：行为与修改前完全一致，无回归

---

### 📋 修改文件清单

| 文件 | 修改内容 | 行号范围 |
|------|---------|---------|
| `app.js` | 重写 `parseLyricText()` 支持双语检测合并 | 第 1260-1279 行 |
| `app.js` | 新增 `escapeHtml()` 辅助函数 | ~第 1255 行 |
| `app.js` | 修改 `loadLrc()` 渲染双语DOM | 第 1316-1323 行 |
| `app.js` | 修改 `syncLyrics()` 沉浸模式双语逻辑 | 第 1342-1368 行 |
| `app.js` | 修改 `getLyricAtTime()` 返回合并文本 | 第 1373-1383 行 |
| `css/base-layout.css` | 新增 `.lrc-line.bilingual` 等样式 | 第 203 行后 |
| `css/immersive.css` | 新增 `.imm-translation` 样式 | 第 54 行后 |

---

## 🔧 问题6：音轨交叉淡入淡出（Crossfade）功能修复与优化（v2.8.3）

> **新增日期**: 2026-06-02  
> **目标版本**: v2.8.3  
> **任务**: 检查当前交叉淡入淡出功能在 Chrome 最新版中的兼容性，修复已知问题并优化

---

### 📍 需求描述

**当前实现**：
- `setupCrossfade()` 监听 `timeupdate` 事件，在歌曲剩余时间 ≤ `crossfadeDuration` 时触发 `triggerFadeOut()`
- `triggerFadeOut()` 使用 `setInterval` 逐步降低音量至 0，然后调用 `goNext()` 切歌，再调用 `triggerFadeIn()`
- `triggerFadeIn()` 等待 `playing` 事件后，使用 `setInterval` 逐步恢复音量

**已知问题**：
1. **Chrome 最新版兼容性**：Chrome 从 v66 开始限制 `AudioContext` 自动播放，但 `HTMLAudioElement` 的 `volume` 属性不受此限制。然而，`timeupdate` 事件在背景标签页中的触发频率会降低，导致交叉淡入淡出时机不准确。
2. **`timeupdate` 精度问题**：`timeupdate` 事件的触发频率约为 250ms 一次，不够精确。当 `crossfadeDuration` 较短（如 1 秒）时，可能错过最佳触发时机。
3. **`goNext()` 调用时机**：当前在 `fadeOut` 完成后才调用 `goNext()`，这意味着在淡出期间用户听到的仍是当前歌曲的静音版本，而不是下一首歌的淡入。真正的交叉淡入淡出应该是**两首歌曲同时播放，一首淡出，一首淡入**。
4. **`isFading` 锁的缺陷**：如果用户在交叉淡入淡出期间手动切歌，`isFading` 锁可能无法正确释放，导致后续播放异常。
5. **`triggerFadeIn` 的 `playing` 事件监听**：使用 `{ once: false }` 是错误的，应该使用 `{ once: true }`。

---

### 🎯 代码分析

#### 当前交叉淡入淡出实现

**文件**: `app.js` 第 1506-1600 行

```javascript
function setupCrossfade() {
    audio.addEventListener('timeupdate', () => {
        if (!crossfadeEnabled || isRepeatOne || playlist.length < 2) return;
        const remaining = audio.duration - audio.currentTime;
        if (remaining <= crossfadeDuration && !isFading && remaining > 0.5) {
            isFading = true;
            triggerFadeOut();
        }
    });
}

function triggerFadeOut() {
    const userVolume = parseFloat(el.volSlider.value);
    const step = 0.05;
    const stepsCount = userVolume / step;
    const intervalTime = stepsCount > 0 ? (crossfadeDuration * 1000) / stepsCount : 100;
    
    const fadeOutInterval = setInterval(() => {
        if (audio.volume > step) {
            audio.volume = Math.max(0, audio.volume - step);
        } else {
            clearInterval(fadeOutInterval);
            audio.volume = 0;
            goNext(); // 切歌
            triggerFadeIn(userVolume); // 淡入
        }
    }, intervalTime);
}

function triggerFadeIn(targetVolume) {
    audio.volume = 0;
    const step = 0.05;
    const fadeInDuration = 1.5;
    const stepsCount = targetVolume / step;
    const intervalTime = stepsCount > 0 ? (fadeInDuration * 1000) / stepsCount : 100;
    
    let fadeInInterval = null;
    
    const onPlaying = () => {
        audio.removeEventListener('playing', onPlaying);
        fadeInInterval = setInterval(() => {
            if (audio.volume < targetVolume - step) {
                audio.volume = Math.min(targetVolume, audio.volume + step);
            } else {
                clearInterval(fadeInInterval);
                audio.volume = targetVolume;
                isFading = false;
            }
        }, intervalTime);
    };
    
    if (!audio.paused && audio.currentTime > 0 && audio.readyState >= 2) {
        onPlaying();
    } else {
        audio.addEventListener('playing', onPlaying, { once: false }); // ❌ 错误：应为 { once: true }
        setTimeout(() => {
            audio.removeEventListener('playing', onPlaying);
            if (isFading && audio.volume === 0) {
                audio.volume = targetVolume;
                isFading = false;
            }
        }, 5000);
    }
}
```

---

### 🛠️ 修复方案

#### 步骤1：使用 `requestAnimationFrame` 替代 `setInterval` 实现平滑淡入淡出

**文件**: `app.js`  
**位置**: 第 1506-1600 行

**修改后**:
```javascript
// 🚀 v2.8.3: 交叉淡入淡出重构 — 使用 rAF 替代 setInterval，支持真正的双轨交叉
let crossfadeRafId = null;
let crossfadeStartTime = null;
let crossfadeFromVolume = 1;
let crossfadeTargetVolume = 1;
let crossfadeCallback = null;

function setupCrossfade() {
    // 使用更精确的进度检测：结合 timeupdate 和 requestAnimationFrame
    audio.addEventListener('timeupdate', () => {
        if (!crossfadeEnabled || isRepeatOne || playlist.length < 2) return;
        
        const remaining = audio.duration - audio.currentTime;
        // 提前 crossfadeDuration 秒开始淡出，给淡入留出时间
        if (remaining <= crossfadeDuration && !isFading && remaining > 0.5) {
            isFading = true;
            triggerCrossfade();
        }
    });
}

// 🚀 v2.8.3: 真正的交叉淡入淡出 — 双轨同时播放
function triggerCrossfade() {
    const userVolume = parseFloat(el.volSlider.value);
    const nextIndex = isShuffle 
        ? Math.floor(Math.random() * playlist.length) 
        : (currentIndex + 1) % playlist.length;
    
    // 创建第二个音频元素用于预加载下一首
    const nextAudio = new Audio();
    nextAudio.src = playlist[nextIndex].url;
    nextAudio.volume = 0; // 初始静音
    
    // 预加载下一首
    nextAudio.addEventListener('canplaythrough', () => {
        // 开始交叉淡入淡出
        const startTime = performance.now();
        const duration = crossfadeDuration * 1000;
        
        const fadeStep = (timestamp) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 当前歌曲淡出
            audio.volume = userVolume * (1 - progress);
            // 下一首淡入
            nextAudio.volume = userVolume * progress;
            
            if (progress < 1) {
                crossfadeRafId = requestAnimationFrame(fadeStep);
            } else {
                // 交叉淡入淡出完成
                finishCrossfade(nextAudio, nextIndex, userVolume);
            }
        };
        
        // 同时播放两首歌曲
        nextAudio.play().catch(e => {
            console.warn('预加载播放失败:', e);
            // 回退到旧版逻辑
            triggerFadeOutLegacy(userVolume);
        });
        
        crossfadeRafId = requestAnimationFrame(fadeStep);
    }, { once: true });
    
    // 兜底：如果预加载失败，使用旧版逻辑
    nextAudio.addEventListener('error', () => {
        console.warn('下一首预加载失败，使用旧版淡入淡出');
        triggerFadeOutLegacy(userVolume);
    }, { once: true });
}

// 完成交叉淡入淡出
function finishCrossfade(nextAudio, nextIndex, userVolume) {
    cancelAnimationFrame(crossfadeRafId);
    crossfadeRafId = null;
    
    // 停止当前音频
    audio.pause();
    audio.src = '';
    
    // 切换到新音频
    audio.src = nextAudio.src;
    audio.volume = userVolume;
    
    // 更新播放状态
    currentIndex = nextIndex;
    const song = playlist[currentIndex];
    
    // 同步UI
    el.mainTitle.textContent = el.immTitle.textContent = song.title;
    el.mainArtist.textContent = el.immArtist.textContent = song.artist;
    document.title = `${song.title} - ${song.artist}`;
    
    // 应用播放速度
    audio.playbackRate = playbackRate;
    audio.preservesPitch = preservesPitch;
    
    // 播放新音频
    audio.play().then(() => {
        setPlayState(true);
        isFading = false;
    }).catch(e => {
        console.error('交叉淡入淡出后播放失败:', e);
        isFading = false;
    });
    
    // 清理
    nextAudio.pause();
    nextAudio.src = '';
}

// 旧版淡入淡出（降级方案）
function triggerFadeOutLegacy(userVolume) {
    const step = 0.05;
    const stepsCount = userVolume / step;
    const intervalTime = stepsCount > 0 ? (crossfadeDuration * 1000) / stepsCount : 100;
    
    const fadeOutInterval = setInterval(() => {
        if (audio.volume > step) {
            audio.volume = Math.max(0, audio.volume - step);
        } else {
            clearInterval(fadeOutInterval);
            audio.volume = 0;
            goNext();
            triggerFadeInLegacy(userVolume);
        }
    }, intervalTime);
}

function triggerFadeInLegacy(targetVolume) {
    audio.volume = 0;
    const step = 0.05;
    const fadeInDuration = 1.5;
    const stepsCount = targetVolume / step;
    const intervalTime = stepsCount > 0 ? (fadeInDuration * 1000) / stepsCount : 100;
    
    let fadeInInterval = null;
    
    const onPlaying = () => {
        audio.removeEventListener('playing', onPlaying);
        
        fadeInInterval = setInterval(() => {
            if (audio.volume < targetVolume - step) {
                audio.volume = Math.min(targetVolume, audio.volume + step);
            } else {
                clearInterval(fadeInInterval);
                audio.volume = targetVolume;
                isFading = false;
            }
        }, intervalTime);
    };
    
    if (!audio.paused && audio.currentTime > 0 && audio.readyState >= 2) {
        onPlaying();
    } else {
        // ✅ v2.8.3 修复：使用 { once: true }
        audio.addEventListener('playing', onPlaying, { once: true });
        setTimeout(() => {
            audio.removeEventListener('playing', onPlaying);
            if (isFading && audio.volume === 0) {
                audio.volume = targetVolume;
                isFading = false;
            }
        }, 5000);
    }
}
```

#### 步骤2：修复 `playAudio()` 中的 `isFading` 锁

**文件**: `app.js`  
**位置**: 在 `playAudio()` 函数开头

**修改后**:
```javascript
const playAudio = async (idx) => {
    if (!playlist[idx]) return;
    
    // 🚀 v2.8.3: 手动切歌时强制取消正在进行的交叉淡入淡出
    if (crossfadeRafId) {
        cancelAnimationFrame(crossfadeRafId);
        crossfadeRafId = null;
    }
    isFading = false;
    audio.volume = parseFloat(el.volSlider.value);
    
    // ... 原有逻辑 ...
};
```

#### 步骤3：添加交叉淡入淡出状态指示器

**文件**: `css/components.css`  
**位置**: 新增

```css
/* 🚀 v2.8.3: 交叉淡入淡出状态指示 */
.crossfade-indicator {
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    color: var(--primary);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
    z-index: 100;
}
.crossfade-indicator.active {
    opacity: 1;
}
```

#### 步骤4：优化 `timeupdate` 检测精度

**文件**: `app.js`  
**位置**: `setupCrossfade()`

**修改后**:
```javascript
function setupCrossfade() {
    // 使用 requestAnimationFrame 辅助检测，提高精度
    let lastCheckTime = 0;
    
    const checkCrossfade = () => {
        if (!crossfadeEnabled || isRepeatOne || playlist.length < 2 || isFading) {
            requestAnimationFrame(checkCrossfade);
            return;
        }
        
        const remaining = audio.duration - audio.currentTime;
        
        // 使用 performance.now() 进行更精确的时间判断
        const now = performance.now();
        if (now - lastCheckTime > 100) { // 每 100ms 检查一次
            lastCheckTime = now;
            
            if (remaining <= crossfadeDuration && remaining > 0.5) {
                isFading = true;
                triggerCrossfade();
            }
        }
        
        requestAnimationFrame(checkCrossfade);
    };
    
    // 启动检测循环
    requestAnimationFrame(checkCrossfade);
    
    // 保留 timeupdate 作为兜底
    audio.addEventListener('timeupdate', () => {
        if (!crossfadeEnabled || isRepeatOne || playlist.length < 2) return;
        const remaining = audio.duration - audio.currentTime;
        if (remaining <= crossfadeDuration && !isFading && remaining > 0.5) {
            isFading = true;
            triggerCrossfade();
        }
    });
}
```

---

### 🧪 测试验证

1. **Chrome 最新版兼容性测试**：
   - 在 Chrome 最新版中开启交叉淡入淡出
   - **预期**：歌曲在剩余 `crossfadeDuration` 秒时平滑过渡到下一首
   - 检查控制台是否有 `AudioContext` 自动播放限制警告

2. **双轨交叉淡入淡出测试**：
   - 播放一首歌曲，等待接近结尾
   - **预期**：当前歌曲音量逐渐降低，下一首歌曲音量逐渐升高，两首歌曲有短暂的重叠
   - 检查是否有爆音或静音

3. **手动切歌测试**：
   - 在交叉淡入淡出期间手动点击下一首
   - **预期**：交叉淡入淡出立即中断，正常播放下一首

4. **`isFading` 锁测试**：
   - 快速连续点击下一首
   - **预期**：每次都能正常播放，不会出现永久静音

5. **降级方案测试**：
   - 模拟网络错误，使预加载失败
   - **预期**：自动回退到旧版淡入淡出逻辑

---

### 📋 修改文件清单

| 文件 | 修改内容 | 行号范围 |
|------|---------|---------|
| `app.js` | 新增 `crossfadeRafId` 等变量 | ~第 78 行 |
| `app.js` | 重写 `setupCrossfade()` | 第 1506-1518 行 |
| `app.js` | 新增 `triggerCrossfade()` | ~第 1519 行 |
| `app.js` | 新增 `finishCrossfade()` | ~第 1560 行 |
| `app.js` | 保留 `triggerFadeOutLegacy()` | 第 1521-1543 行 |
| `app.js` | 保留 `triggerFadeInLegacy()` | 第 1545-1600 行 |
| `app.js` | 修改 `playAudio()` 取消交叉淡入淡出 | ~第 1601 行 |
| `css/components.css` | 新增 `.crossfade-indicator` 样式 | 新增 |

---

**Prompt 结束**

*按照上述步骤逐一修改代码，并进行充分测试。*
