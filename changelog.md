# MBolka Player 更新日志

---

## v3.6.6p2 (2026-07-11) — 创作信息卡片居中修复 + 竖屏模式 Spotify 风格布局优化

### 一、创作信息卡片居中修复
**`css/base-layout.css` / `css/style.css`**：
- 卡片原 `width:100% + margin:0 auto` 因 `width:100%` 撑满导致视觉左对齐失效。改为 `width: max-content; max-width:100%` —— 卡片按内容自然宽度（最长一行决定卡宽）居中，且窄屏不溢出。
- 移除旧 `margin: 0 -10px 16px`（抵消 `lrc-line` 的 `padding` 撑满全宽）规则，改回 `margin: 0 auto 16px`，配合 `max-content` 实现真正居中。

### 二、竖屏模式全面优化（Spotify 风格）
**`css/base-layout.css` / `css/wco.css`**：
- `.player-wrapper` 竖屏下 `width:100vw; height:100vh; border-radius:0`；`.content-grid` 更紧凑（`padding:8px 14px 0; gap:6px; overflow:hidden`）。
- 顶部曲目信息紧凑横排：封面缩至 `56px`、标题 `15px`/歌手 `12px`，隐藏浮动动画与频谱画布以节省纵向空间。

---

## v3.6.6p1 (2026-07-10) — WCO 整窗居中+竖屏靠左 / WCO 沉浸舱按钮挂载槽 / 竖屏模式全面优化 / Spotify 风格歌词 / 创作信息卡片对齐修正

> 本次合并原 v3.6.7（WCO 绝对水平居中曲目标题）并补充 6 项图示优化，统一为 v3.6.6p1。

### 背景
1. WCO 标题栏的曲目标题当前 `left:50% + translateX(-50%)` 配合 `max-width: calc(100vw - 220px)`，在 100vw 减去金刚键宽度后居中——视觉上偏左。改为**对整窗宽度（100vw）的中线绝对居中**，金刚键区仅以 padding 形式避让，标题文本始终位于整窗中点。竖屏模式（高度 > 宽度）允许靠左对齐以避免与主界面 header 居中标题重复。
2. WCO 启用时（Chrome 隐藏原生标题栏），沉浸模式部分按钮可挂到 WCO 标题栏右侧，腾出底部空间。
3. 竖屏模式（PWA 窄窗 / 手机）下主界面、歌词页、沉浸模式均需更紧凑的布局。
4. 竖屏播放页（主界面+歌词）采用 Spotify 风格：当前行默认在视口居中、不下滑即可见，下滑可显示完整歌词。
5. 创作信息卡片在歌词栏中整体偏左、内容居中——按用户要求改为：卡片在歌词栏内始终**水平居中**；卡片内文（标题/标签/值）始终**左对齐**，不再受 `--lrc-align` 影响。

### 一、WCO 标题整窗居中 + 竖屏靠左
**`css/wco.css`**：
- `.wco-titlebar .wco-track-title`：`left: 0; width: 100vw; text-align: center; transform: translateY(-50%)`（**整窗铺满 + 文本中线居中**，不再 `left:50% + translateX(-50%)` 配合 `max-width` 偏左）；`padding: 0 140px` 留出金刚键与左侧 header 空间；`overflow:hidden + text-overflow:ellipsis` 保证超长标题裁切。
- 新增 `@media (max-aspect-ratio: 1/1) { .wco-titlebar .wco-track-title { text-align: left; padding: 0 0 0 110px; } }` —— 竖屏模式允许靠左对齐。
- 移除原 v3.6.7 的 `left:50% + translateX(-50%) + max-width: calc(100vw - 220px)` 实现。

### 二、WCO 沉浸舱按钮挂载槽（`WCO.mountActions` / `unmountActions`）
**`index.html`**：在 `#wco-titlebar` 内新增 `<div class="wco-actions-slot" id="wcoActionsSlot" style="display:none;">`。
**`js/wco.js`**：
- 新增 `WCO.mountActions(node)`：把节点从源容器**移动**（非 clone 避免监听丢失）到 `#wcoActionsSlot`；保存 `_moveSource` / `_moveNextSibling` 供卸载时还原位置；WCO 未启用时直接 `return false`。
- 新增 `WCO.unmountActions()`：把节点**移回**源容器原位置（或兜底移回 `document.body`），隐藏 slot。
- 关闭 WCO 时（`_disable`）自动 `unmountActions()` 兜底。

**`js/ui-core.js` `toggleImmersiveMode()`**：
- 进入沉浸模式时，若 `WCO.isActive()` 则 `WCO.mountActions(document.querySelector('.imm-topbar .imm-header-actions'))` —— 把退出按钮等挂到 WCO 标题栏右侧。
- 退出沉浸模式时 `WCO.unmountActions()` 还原。
- 进入沉浸模式时 `document.body.classList.add('immersive-mode')`（用于 CSS hook 调整沉浸模式顶部 padding），退出时移除。

**`css/wco.css`**：新增 `.wco-actions-slot` 样式：定位于标题栏右侧（`right: 140px` 让出金刚键）、`pointer-events: auto`、内部按钮 28–30px 紧凑尺寸；竖屏 `@media (max-aspect-ratio: 1/1)` 下 `display: none`（让位给主界面 header）。

### 三、竖屏模式全面优化
**`css/style.css` 新增 `@media (orientation: portrait)` 大块**（与 UA 无关 —— 任何 PWA / 浏览器竖屏窗口都生效）：
- **主界面**：3 列垂直堆叠；专辑/曲目信息横排紧凑（88×88 圆角封面 + 左侧 18px 标题）；控制列单列（频谱 44px、按钮 44/60/38px、底栏 8px 间距）；歌词列占主要纵向区域（`flex: 1 1 auto; min-height: 38vh; max-height: 52vh`），**无 mask-image** —— 完整可视。
- **沉浸模式**：track-card 紧凑（50×50 封面 + 14px padding + 16px 标题）；`imm-icon-btn` 42px；`imm-subtitle-line` 字号 `clamp(22px, 5vw, 30px)`；底栏 56px 播放键、38px 模式键、紧凑 padding。
- **沉浸模式顶部 WCO 兼容**：`body.wco-active.immersive-mode .imm-wrapper { padding-top: env(titlebar-area-height, 0); }` —— WCO 启用时为沉浸模式让出顶部 WCO 标题栏高度。

**`js/app.js`**：移除「仅移动端 UA 才自动竖屏进入沉浸模式」的限制（`/Android|webOS|.../` 检测），改为**任何 PWA / 浏览器**在 `matchMedia("(orientation: portrait)")` 匹配时自动进入沉浸模式，横屏自动退出。

### 四、Spotify 风格竖屏播放页歌词
**`js/audio-core.js` `loadLrc`**：在 `el.lrcView.scrollTop = 0` 后新增 `if (el.lrcPanel.style.display !== 'none') syncLyrics(true);` —— 切歌/打开歌词时立即把当前行居中（此前是 `scrollTop=0` 即第一行在顶部，违反 Spotify 风格「不下滑可见当前行」）。

**`css/style.css` 竖屏块内**：
- `.lrc-viewport { padding: 14px 10px; }`
- `.lrc-spacer-top { height: clamp(120px, 30vh, 220px); }` 与 `.lrc-spacer-bottom { height: clamp(80px, 22vh, 160px); }` —— 缩短首尾 spacer 高度，让当前行有更大滚动空间但仍能保持居中。

### 五、创作信息卡片对齐修正
**`css/base-layout.css`**：
- `.lrc-credits`：`align-self: center; margin: 0 auto 18px; text-align: left` —— 卡片在歌词栏中**始终水平居中**，文字始终左对齐（不再用 `var(--lrc-align)` 跟随歌词对齐方式）。
- `.lrc-credits .lrc-credits-row`：`justify-content: flex-start` —— 标签+值整体左对齐。
- `.lrc-credits .lrc-credits-title` / `.lrc-credits .lrc-credits-val`：`text-align: left` —— 标题/值文本左对齐。
- `.lrc-line.lrc-credits`（嵌入歌词流的卡片形式）：`text-align: center !important` 覆盖歌词行默认对齐，确保卡片在歌词流中也居中（卡片内 `.lrc-credits` 仍左对齐）。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 201.5 KB / style.min.css 78.2 KB）。
- ✅ `read_lints` 多文件 0 错误。
- ✅ WCO 启用时：横屏标题对整窗 100vw 中线居中；竖屏标题靠左（让位主界面 header）。
- ✅ WCO 沉浸模式：退出按钮自动挂到 WCO 标题栏右侧；退出沉浸模式时自动还原到 `.imm-topbar`。
- ✅ 竖屏模式：自动进入沉浸；主界面 3 列紧凑垂直；歌词列居中当前行、占主要区域。
- ✅ Spotify 风格：切歌后当前行立即居中（`loadLrc` 末尾 `syncLyrics(true)`），不下滑可见。
- ✅ 创作信息卡片：歌词栏内水平居中、卡片内文左对齐；不受 `--lrc-align`（歌词对齐方式）影响。
- ✅ 金刚键取色仍由 `theme-color.js` 最新逻辑（`toDarkColor` + 封面取色开关）驱动，不受 WCO 状态门控。

## v3.6.6 (2026-07-10) — 合并深色主题取色算法（PWA WCO 标题栏）+ 移除 Chrome 标题栏状态判断 + 沉浸式外观位置调整

### 背景
v3.6.5 用「去饱和灰度」算法派生 WCO 右侧金刚键背景，并由 `wcoPseudoImmersive`（标题栏伪沉浸）开关来「判断 Chrome 是否隐藏标题栏」才应用顶部取色。用户给出更优方案：
1. 用一份实测拟合的「深色主题取色算法」（`toDarkColor`：输入封面亮色 RGB → 输出 `hsl(H,79%,5%)` 暗色，粉色区间做 −56° 偏移）作为 PWA WCO 标题栏取色算法。
2. **无论 Chrome 是否隐藏标题栏**，只要开启「封面取色」，标题栏即运用该算法；关闭「封面取色」则继续应用主题色。
3. 移除所有「判断 Chrome 标题栏状态」的相关逻辑（`wcoPseudoImmersive` 及其门控）。
4. 设置-外观中「沉浸式外观」区块移至「主题色」下方、「背景图片」上方。

### 一、合并深色主题取色算法（PWA WCO 标题栏）
**改动（`js/theme-color.js`）**：
- 引入 `rgbToHsl` / `hslToRgb` / `toDarkColor`（来自 `dark-theme-color.js`，基于 18 组实测拟合，平均通道偏差 4.1/255）；新增包装函数 `_toDarkColorStr(colorStr)` 解析任意 CSS 颜色并输出暗色结果字符串。
- 删除旧的 `_toGrayscale`（去饱和灰度）算法。
- 重写 `_applyColor()`：
  - 计算「主题色基准」（`themeColor`）：深色模式 → `#0e0c16`；否则 `cfg.defaultColor`；再否则兜底 `FALLBACK_COLOR`。
  - **封面取色开启（`cfg.followAccentColor` 且存在专辑色）** → 标题栏 `wcoColor = toDarkColor(专辑封面亮色)`（同时写入 `<meta name="theme-color">` 与 `--wco-theme-color`）。
  - **封面取色关闭** → 标题栏继续应用 `themeColor`（主题色）。
  - 不再判断 `wcoPseudoImmersive` / WCO 是否可见。
- `update / updateTopColor / refresh / onDarkModeChange` 接口保留；`updateTopColor` 仅兼容存储 `_topColor`，不再参与标题栏取色。

### 二、移除 Chrome 标题栏状态判断
- **JS（`js/globals.js`）**：删除配置项 `wcoPseudoImmersive`。
- **JS（`js/utils.js`）**：删除 `saveSettings` / `loadSettings` 中的 `wcoPseudoImmersive` 字段。
- **JS（`js/ui-core.js`）**：删除 `updateSettingsUI()` 中「标题栏伪沉浸」开关同步、`设置-外观-标题栏伪沉浸` 事件监听；`toggleDarkMode()` 新增 `ThemeColor.onDarkModeChange(cfg.darkMode)` 调用，确保深色/护眼切换时标题栏配色正确刷新。
- **HTML（`index.html`）**：删除设置-外观「标题栏伪沉浸」开关卡片（`id="wcoPseudoImmersiveToggle"`）。

### 三、沉浸式外观位置调整
- **HTML（`index.html`）**：将「沉浸式外观」区块（含「封面取色」开关）从原「背景图片 / 显示调节」之后，移至「主题色」区块**下方**、「背景图片」区块**上方**（保留 `accent-appearance` / `data-tab-group="1"` 归属）。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 200.7 KB / style.min.css 74.8 KB）。
- ✅ `read_lints` 多文件 0 错误。
- ✅ 全仓已无 `wcoPseudoImmersive` / `wcoPseudoImmersiveToggle` / `_toGrayscale` / `bg-immersive` / `applyBgImmersive` 代码引用（仅 `theme-color.js` 注释中保留说明性提及）。
- ✅ 封面取色开启时标题栏运用 `toDarkColor` 暗色算法；关闭时回退主题色；深色模式切换正确刷新。

## v3.6.5 (2026-07-09) — WCO 标题栏配色修正 / 创作信息卡片对齐与沉浸-PiP 适配 / 移除封面取色预览条 / 移除背景沉浸功能 / 曲库打开自动定位当前专辑

### 背景
上一版（v3.6.4）在 WCO、创作信息卡片、封面取色预览等位置均存在不符合用户当前设计意图的问题。本次统一修正为 v3.6.5，包含：WCO 标题栏配色映射回正、创作信息卡片对齐与沉浸/PiP 适配、移除封面取色下方不会即时刷新的渐变色预览条、移除与护眼模式能力重合的「背景沉浸」功能，并新增「曲库打开自动定位当前正在播放专辑」。

### 一、WCO 标题栏配色修正（左侧透明 / 右侧系统按钮暗色去饱和）
v3.6.4 把「去饱和灰度」算法错误地套在了 **左侧自绘标题栏**（色块），而 `<meta name="theme-color">`（控制**右侧**系统按钮）仍用亮色——正好相反。用户明确需求：**左侧标题栏正常透明化、直接透出背景、无任何色块；右侧系统窗口控制按钮背景做成暗色、伪沉浸适配真实主界面背景色**。

去饱和灰度算法本身不变：`L = 0.299R + 0.587G + 0.114B`，三通道统一 `R=G=B=L`。
- **映射纠正**：该暗色结果现在写入 `<meta name="theme-color">` → 驱动 **右侧系统窗口控制按钮（金刚键）背景**（暗色去饱和，伪沉浸融合主背景）。
- **左侧自绘标题栏**：背景改为 `transparent`，直接透出主界面背景，不渲染任何色块 / 渐变。

#### 改动
1. **JS（`js/theme-color.js`）**：`_applyColor()` 末尾改为 `getMeta().setAttribute('content', _toGrayscale(color))`（右侧按钮 = 暗色去饱和）；`--wco-theme-color` 仅作备用变量保留，自绘标题栏不再以其作背景块。文件头注释同步更新为 v3.6.5。
2. **CSS（`css/wco.css`）**：`.wco-titlebar` 背景由色块 / 渐变改为 `transparent`；删除 `::before` 微光层、`border-bottom`、`box-shadow`；隐藏 `.wco-brand / .wco-track-title / .wco-nav`（保持透明、不破坏原设计）。**删除 `body.wco-active .header { display: none }`**，使原 header（含四大按键）在 WCO 下正常显示。
3. **JS（`js/wco.js`）**：移除「将 `.nav-actions` 迁入 `.wco-nav` / 隐藏原 header / 添加 `wco-moved`」整套逻辑，仅保留透明标题栏作为拖拽区 + 同步曲目标题（元素仍保留在 DOM，仅视觉隐藏）。文件头注释更新为 v3.6.5。

### 二、创作信息卡片对齐跟随设置 + 沉浸/PiP 跳过首行歌词卡片
v3.6.4 把创作信息注入为歌词流首行（`[00:00.00]` 卡片行，`isCredits: true`）后暴露两个问题：
1. 创作信息卡片始终左对齐，不跟随「设置 → 外观 → 歌词显示 → 对齐方式」（居中 / 左对齐）。
2. 沉浸模式与画中画（PiP）也把该卡片行当作普通歌词行识别，time 0 时因卡片无 `.text` 而显示为空白，未能从首行实际歌词开始。

#### 改动
1. **CSS（`css/base-layout.css`）**：`.lrc-credits` 的 `text-align` 由硬编码 `left` 改为 `var(--lrc-align)`；内部 `.lrc-credits-row` 增加 `justify-content: var(--lrc-align)`（标签+值整体居中/居左）；`.lrc-credits-val` 的 `text-align` 由 `left` 改为 `var(--lrc-align)`（换行后跟随对齐）。主界面创作信息卡片现随对齐设置变化。
2. **JS（`js/audio-core.js` 沉浸 `syncLyrics`）**：当前行若为创作信息卡片行（`isCredits`）或 break/blank，向上查找最后有内容的歌词行；若当前即首行卡片（向上无果），则向前定位首行实际歌词；下一行计算改用 `curDisplayIdx + 1` 并跳过 `isCredits`。
3. **JS（`js/pip.js` `updatePipUI`）**：PiP 当前行遇 `isCredits` 同样向前取首行实际歌词；下一行跳过 `isCredits`。

### 三、移除封面取色下方的渐变色预览条
设置-外观-沉浸式外观中，「封面取色」开关下方有一条 `#colorModePreview` 渐变色预览条（展示当前专辑取色到主题色的渐变）。该预览条依赖 `currentAlbumColor`，但取色结果并非即时刷新，用户反馈其显示滞后、容易误导，要求移除。

#### 改动
1. **HTML（`index.html`）**：删除 `<div id="colorModePreview" style="display:none;height:8px;border-radius:4px;margin-top:4px;margin-bottom:8px;transition:background 0.5s;"></div>`。
2. **JS（`js/ui-core.js`）**：删除 `updateSettingsUI()` 中对该 preview 的 `display` 与 `background` 更新逻辑，保留取色模式状态标签的更新。

### 四、移除「背景沉浸」功能（与护眼模式能力重合）
设置-外观-「沉浸式外观」中原有的「背景沉浸」开关（`bgImmersive`）其作用为：开启后让主界面播放器更透明以露出全屏背景，并在开启「深色/护眼模式」时自动叠加一层半透明黑色遮罩（`#bg-immersive-scrim`，opacity 0.38 基础 + 0.45 夜间，分层 alpha 合成）。该遮罩本质即「压暗屏幕、护眼」的效果，与「深色/护眼模式」（`darkMode`）的核心能力高度重合，属于冗余功能。用户判定二者为相同或相似能力，要求移除「背景沉浸」。

#### 改动
1. **CSS（`css/base-layout.css` / `css/style.css`）**：删除 `#bg-immersive-scrim` 遮罩层规则，以及 `body.bg-immersive .player-wrapper` 的播放器透明化规则。
2. **HTML（`index.html`）**：删除动态背景层中的 `<div id="bg-immersive-scrim">`；删除设置-外观「沉浸式外观」内的「背景沉浸」开关卡片（`id="bgImmersiveToggle"`）；同步更新沉浸式外观提示文案（不再提及「全屏沉浸背板」）。
3. **JS（`js/globals.js`）**：删除配置项 `bgImmersive: false`。
4. **JS（`js/utils.js`）**：删除设置存取（`saveSettings` / `loadSettings`）中的 `bgImmersive` 字段。
5. **JS（`js/ui-core.js`）**：删除 `updateSettingsUI()` 中 `bgImmersiveToggle` 的同步、`设置-外观-背景沉浸开关` 的事件监听、`applyThemeLogic()` 与 `toggleDarkMode()` 中对 `applyBgImmersive()` 的调用，以及 `applyBgImmersive()` 函数定义本身。

### 五、曲库打开自动定位当前正在播放专辑（按专辑默认视图）
打开曲库进入「按专辑」coverflow 默认视图时，此前总是停在列表首个专辑，用户需手动滚动才能找到正在播放的专辑。本次新增：打开曲库后自动把「当前正在播放专辑」平滑滚动至封面流正中并高亮。

#### 改动
1. **JS（`js/cover-lib.js`）**：新增 `focusCurrentAlbumInCoverLib()`——仅在 `coverLibSortMode === 'album'` 生效；取 `playlist[currentIndex].album`，在已分组的 `_clEntries` 中按专辑名定位目标索引；若目标索引超出窗口化已渲染量（`_clRendered`），先 `renderCoverLibMore()` 强制追加渲染（含 `CL_CHUNK` 余量）；再以轮询（最多 50 次 × 30ms）等待目标卡片入 DOM 后调用 `setCoverLibCenter(targetIdx)` 居中。在 `showCoverLibrary()` 的 200ms 渲染后定时器中、`refreshCoverLibAfterRender()` 之后调用。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 200.7 KB / style.min.css 74.8 KB）。
- ✅ `read_lints` 多文件 0 错误。
- ✅ 全仓已无 `bgImmersive` / `bg-immersive` / `applyBgImmersive` / `bg-scrim-alpha` 残留引用（已二次全仓检索确认）。
- ✅ WCO 左侧标题栏透明、右侧系统按钮暗色去饱和；原 header 与四大按键在 WCO 下正常显示。
- ✅ 创作信息卡片仅作用于主界面，沉浸 / PiP 直接从首行实际歌词开始。
- ✅ 封面取色开关下方无滞后渐变色预览条。
- ✅ 「深色/护眼模式」独立保留，可正常切换并驱动整体暗色主题（不再叠加冗余的黑遮罩）。
- ✅ 曲库「按专辑」视图打开即定位当前播放专辑并居中高亮（窗口化未挂载时强制追加渲染后再居中）。

## v3.6.4 (2026-07-09) — 创作信息注入[00:00.00]歌词行 + WCO 标题栏沉浸/去饱和灰度配色 + 歌曲/歌手名不可拖拽

> ⚠️ 本节「一 / 二」的 WCO 描述已在 **v3.6.5** 中修正并回退：左侧标题栏改为透明、右侧系统按钮改为暗色去饱和（算法映射纠正），且取消「四大按键迁入标题栏 / 隐藏原 header / 曲目标题左移」。歌词注入与「歌曲 / 歌手名不可拖拽」两项保留。

### 一、WCO 标题栏配色：去饱和灰度算法（取代直接复用亮色）

**背景**：PWA WCO 标题栏（自绘左侧色块）此前要么使用固定暗色 `rgba(10,10,26,0.55)`，要么直接复用 `--wco-theme-color`（等于右侧亮色块：强调色/主题色/专辑封面取色）。直接复用亮色会导致标题栏过亮、与暗色 App 主体割裂；而简单 RGB 同值相减又会让不同色相的「变暗终点」不一致（偏色）。用户给出算法规律：**左侧色块 = 右侧亮色块的去饱和灰度版本**，由加权平均明度推导。

#### 核心算法（灰度明度去饱和）
$$L = 0.299 \times R_{右} + 0.587 \times G_{右} + 0.114 \times B_{右}$$
$$R_{左} = G_{左} = B_{左} = L$$
权重为人眼视觉敏感度（红/绿/蓝），提取真实物理亮度后平均分配给三通道，得到一致暗沉去饱和底色，自适应任意右侧色相。

#### 改动
1. **JS（`js/theme-color.js`）**：
   - 新增 `_parseRgb(str)`：兼容解析 `#rgb` / `#rrggbb` / `rgb()` / `rgba()` 为 `{r,g,b}`。
   - 新增 `_toGrayscale(colorStr)`：实现上述公式，返回 `"rgb(L, L, L)"`（取整 + 0–255 边界限制），解析失败返回 `null`。
   - `_applyColor()` 末尾：`<meta name="theme-color">` 仍写入原始亮色（右侧块 → 系统窗口控制按钮背景）；`--wco-theme-color` 改为写入 `_toGrayscale(color)`（左侧块 → 自绘标题栏），解析失败兜底回原始色。
2. **CSS（`css/wco.css` `.wco-titlebar`）**：背景由固定 `rgba(10,10,26,0.55)` 改为 `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%), var(--wco-theme-color, rgba(10,10,26,0.55))`，真正引用算法计算的去饱和灰度色，叠加顶部微光渐变保层次。

#### 验证
- ✅ `node build.js` 通过（bundle.min.js 200.8 KB / style.min.css 76.2 KB），`read_lints` 0 错误。
- ✅ 顶部取色/专辑均色/深色模式/默认色/兜底色 五条路径均经过 `_toGrayscale` 派生标题栏底色。

### 二、WCO 标题栏沉浸重做

**背景**：PWA WCO 标题栏沉浸（设置-外观-「标题栏伪沉浸」）此前仅在 standalone 模式下显示，且标题栏只是透明浮层，与页面顶部没有真正融合。用户希望 WCO 标题栏看起来像应用头部的一部分（如截图所示）。

#### 改动
1. **HTML（`index.html`）**：
   - 移除 `#wcoPseudoImmersiveBox` 的 `style="display:none;"`，让「标题栏伪沉浸」开关常驻在「沉浸式外观」分组中。
   - 在 `#wco-titlebar` 内新增 `.wco-nav` 容器，用于收纳原 `.header` 的导航按钮。
2. **JS（`ui-core.js`）**：
   - 删除仅 PWA standalone 模式下才显示该开关的 IIFE，设置项在所有模式下均可见。
3. **JS（`js/wco.js`）**：
   - 启用 WCO 时，将 `.header` 内的 `.nav-actions` 移入 `#wcoNav`。
   - 禁用 WCO 时，将 `.nav-actions` 移回原 `.header`。
   - 添加 `body.wco-active` 类，同时隐藏原 `.header`。
4. **CSS（`css/wco.css`）**：
   - WCO 标题栏改为 `rgba(10, 10, 26, 0.55)` 实色背景 + 底部细线，与页面原 header 视觉一致。
   - 标题栏使用 `env(titlebar-area-x/y/width/height)` 精确定位到系统标题栏区域。
   - 左侧拖拽区显示品牌图标 + 当前曲目标题；右侧 `.wco-nav` 显示「列表 / 歌词 / 曲库 / 设置」按钮。
   - `.wco-nav` 保留 `margin-right: 120px` 为系统窗口控制按钮（最小化/最大化/关闭）留出空间。
   - 按钮缩小为 `height: 28px / font-size: 12px` 适配标题栏高度。
   - `body.wco-active .player-wrapper { padding-top: env(titlebar-area-height, 0); }` 确保内容不被标题栏覆盖。
   - `body.wco-active .header { display: none; }` 隐藏原 header，避免重复。

### 三、歌曲/歌手名不可拖拽选中

**背景**：点击复制已替换原生选中，但部分桌面浏览器仍可通过拖拽触发文本选中或拖拽幽灵图。

#### 改动
1. **CSS（`style.css` `.click-copy`）**：
   - `user-select: none` + `-webkit-user-select: none` + `-moz-user-select: none` + `-ms-user-select: none`
   - 新增 `-webkit-user-drag: none` 防止拖拽出幽灵图
2. **JS（`app.js`）**：初始化时给每个 `.click-copy` 元素：
   - `setAttribute('draggable', 'false')`
   - `dragstart` 事件 `preventDefault()`
   - `selectstart` 事件 `preventDefault()`

### 四、创作信息卡片注入为 [00:00.00] 歌词行（保留完整排版 HTML）

**背景**：歌曲创作信息（作词/作曲/编曲等）原本以独立卡片形式渲染在歌词顶部。由于卡片不参与歌词滚动/居中机制，当歌词以用户偏好（居中/偏上）定位时，卡片常常被遮挡在视窗顶部不可见。用户提出：**整个卡片（保留所有排版样式）作为 `[00:00.00]` 的一行歌词嵌入歌词流**。

#### 改动
1. **JS（`js/audio-core.js` `parseLyricText` Phase 9 新增）**：
   - 保留 `processedCredits` 原始数组数据，`lyrics.unshift({ time: 0, isCredits: true, creditsData: processedCredits, isAiTranslated })`。
   - 返回对象 `credits: null`，移除了 `isAiTranslated` 顶层返回值（数据随歌词行传递）。
2. **JS（`js/audio-core.js` `loadLrc`）**：
   - 删除原 `if (creditsData && creditsData.length > 0)` 独立渲染分支（第 396–437 行），卡片不再单独 append。
   - 在 `formatCreditValue` 公共函数上方提取至循环外部，供 `isCredits` 分支复用。
   - 在歌词 `forEach` 渲染循环中新增 `else if (l.isCredits)` 分支，直接 `d.innerHTML = <lrc-credits-title> + AI badge + credHTML`，保留所有原有的卡片排版（分隔符高亮、名单分色、括号保护、标题图标等）。
   - `isCredits` 行跳过 `onclick`（不 seek 到 time 0）。
3. **CSS（`css/base-layout.css`）**：
   - 新增 `.lrc-line.lrc-credits` 覆盖：`filter: none !important; opacity: 1 !important; transform: none !important; min-height: auto; cursor: default; margin: 0 -10px 16px`。
   - 新增 `.lrc-line.lrc-credits.active`：阻止激活态字号放大/发光/缩放。
   - 新增 `.lrc-line.active + .lrc-line.lrc-credits`：阻止相邻行模糊规则作用于卡片。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 200.0 KB / style.min.css 75.7 KB），`read_lints` 0 错误。
- ✅ 设置面板中「标题栏伪沉浸」可见；PWA/WCO 模式下原 header 导航按钮迁入系统标题栏，标题栏即应用头部。
- ✅ 主界面/沉浸舱共 4 处歌曲名/歌手名无法拖拽或文本选中。
- ✅ 创作信息不再渲染独立卡片，作为 `[00:00.00]` 歌词行注入；AI 翻译标记嵌入行内。

## v3.6.3 (2026-07-09) — 审计采纳 + 歌词创作信息补全 + 点击复制 + 进度条偏移 + coverflow 调整

### 🎨 审计 v2 采纳：无障碍 + 动画节能 + 健壮性

> 依据 `audit-report-v2-20260709.md`（标注"基于当前实际代码"）。逐条核对真实代码后采纳低风险高价值项；多处"严重项"经核为**误报/已自带修复**（见下）。

### 一、无障碍（A11y）
1. **css/style.css** — 新增 `@media (prefers-reduced-motion: reduce)`：禁用 `.art-box` / `.pip-standby` / `.btn-play` 持续性装饰动画与 `.lrc-line` 过渡，前庭障碍用户友好。
2. **css/style.css** — `input[type=range]:focus-visible` 焦点光环（webkit + Firefox 双前缀），键盘 Tab 到滑块有可见反馈。
3. **css/style.css** — Firefox 滚动条回退：`html { scrollbar-width: thin; scrollbar-color: … }`。
4. **css/style.css `.track-title`** — 增 `max-height: 2.4em` 回退，Firefox 不支持 `-webkit-line-clamp` 时仍能截断。
5. **css/style.css `.footer`** — `font-size: 13px` → `clamp(11px, 1.6vh, 14px)`，高 DPI 屏可读。

### 二、UI / 动画优化
6. **css/style.css `.lrc-line`** — 移除已废弃 `word-break: break-word`，改用标准 `overflow-wrap: anywhere`（保留 `word-wrap` 旧浏览器回退）。
7. **css/style.css `.lrc-viewport`** — `padding: 50% 20px` → `30vh 20px`，基于视口高度留白，超宽屏不再浪费歌词空间。
8. **css/style.css `.lrc-line.active + .lrc-line`** — 移除 `filter: blur(0px) !important`（相邻选择器特异性 0,3,0 已高于 `:hover` 0,2,0）。
9. **css/style.css `.view-container.hidden`** — 退出模糊 `blur(10px)` → `blur(4px)`，降低离屏合成开销。
10. **css/style.css `.btn-ctrl:active`** — `scale(0.92)` → `scale(0.96)`，减轻子像素文字发虚（承接 v3.6.2 去除 !important 的后续微调）。
11. **css/style.css `.art-box.swipe-*`** — 滑动手势缓动 `ease-out` → `var(--curve-smooth)`，与全站一致。
12. **css/style.css `.load-strip`** — 隐藏时（`:not(.show)`）暂停 `cfBarFlow` 流动动画省合成。

### 三、性能 / 健壮性（JS）
13. **js/utils.js `escapeHTML`** — 复用模块级 `div`，避免歌词逐行渲染高频创建临时 DOM。
14. **js/utils.js `extractColor`** — `getImageData` 的 `catch` 增 `console.warn`，CORS 受限取色失败时便于调试。
15. **js/audio-core.js `cfSyncSongUI`** — 切歌时 `el.lrcView.scrollTop = el.lrcView.scrollTop` 取消上首可能仍在进行的平滑滚动（防滚到错误位置）；标题/歌手赋值加空值守卫；`void el.mainTitle.offsetWidth` 补 FLIP 重排注释。
16. **js/visualizer.js** — `ResizeObserver` 存引用，页面 `visibilitychange→hidden` 时 `unobserve`、回到前台再 `observe`，避免后台空转回调。
17. **js/visualizer.js** — 交叉淡变进行中（`cfState === FADING`，双槽解码 CPU 翻倍）通过 `_visFadeThrottle()` 将鼠标/触摸粒子、点击涟漪生成速率减半。
18. **js/storage.js `logError`** — `localStorage.setItem` 由同步改为 `requestIdleCallback`（降级 `setTimeout`）异步落盘，避免高频错误日志（交叉淡变 `CF_*`）阻塞主线程；IDB 写入加 `tx.onerror` 降级回调。
19. **js/storage.js `_flushMetaBatch`** — `catch` 增 `console.warn`（标记复位 `_metaBatchScheduled=false` 此前已存在）；`cacheMetadata` 队列超 200 条 `shift()` 上限保护，防事务失败堆积。
20. **js/gamepad.js `switchCoverLibTab`** — `setTimeout(180, …)` 补注释：等待 Tab 切换后 DOM 重渲染完成再居中 coverflow 的经验值。

### 验证
- ✅ 改动 JS 文件 `node --check` 全部通过；`read_lints` 0 错误。
- ✅ CSS 均为属性级微调，无结构性破坏。

### 审计审查说明（误报 / 已自带修复 — 经核对真实代码）
- **CSS `:root` 重复定义冲突（#1/#63）误报**：`index.html` 中 `style.css` 在 line 18 加载、`variables.css` 在 line 32 加载——**variables.css 后加载生效**，故 `style.css` 的 `:root` 是被覆盖的死代码；`--primary-glow` 实际取 `rgba(var(--primary-rgb),0.45)` 动态值，主题取色联动正常。报告基于"style.css 后加载"的错误假设，删除重复块反而有加载顺序回归风险，故**不改**。
- **`onAudioEnded` 双槽绑定重复（#2）误报**：全代码仅 `audio.onended`（2109）与 `cfAudioB.onended`（globals.js 176）两处 `.onended` 属性赋值，**零** `addEventListener('ended')`；双槽永久绑定为有意设计且安全（注释 1271/1304/2054 说明"仅活跃槽播完触发"）。
- **`_artExtracting` Map 提取失败未清理（#4）误报**：`loader.js` 165-169 用 `try/finally { _artExtracting.delete(k) }`，reject 时亦清理，无泄漏。
- **`_pushModal` 弹窗背景滚动未锁定（#66）误报/已处理**：`variables.css` 已全局 `body { overflow: hidden }`，弹窗后方本就不滚动。
- **`art-crossfade-overlay img` 无尺寸限制（#98）误报**：`base-layout.css` 238 已有 `width/height/object-fit: cover` 限制。

### 暂缓 / 不采纳（记录理由，未盲目改动）
- `globals.js` 全局命名空间污染（#3）、`ui-core` 设置批量 rAF 合并（#40）、`cfCrossfadeVisStart/Stop` rAF 步进与实际淡变弧度匹配（#107）—— 架构/核心引擎改动风险高，需专项计划。
- `.load-strip transition width→transform: scaleX`（#106）—— 需同步改 JS 驱动方式，本轮仅加隐藏暂停动画降开销，暂不改结构。
- `floatArt` 节能模式暂停（#99）—— 需 body 挂节能 class 钩子（当前无），`reduced-motion` 已覆盖无障碍场景，暂缓。
- `cfTriggerCrossfade` `passiveEl.src` 字符串比较（#41）—— blob URL 边界、无实证 bug，暂缓。
- 低优先级/设计权衡：`exportPlaylist` 流式导出（#52）、`queryPermission` prompt（#53）、`_cachedScrollable` TTL（#51）、`MAX_POOL` 动态帧率（#122）、`appFadeIn` will-change（#119）、`ambientBreathe` 合并（#118）、`index.html` 内联结构提取（#77）—— 暂缓。

---

### 🎵 歌词创作信息正则补全：文案/古筝/小提琴/MV制作/粤语/Lyricist/双语中文+英文连写 等角色

### 背景
用户提供了四批创作信息样例，其中 文案、古筝、古筝编写、小提琴、小提琴编写、音乐制作、MV制作、粤语歌词协力、粤语指导、特别感谢、Lyricist(中文词)、以及第四批的 钢琴/吉他编写/吉他录音师/小提琴独奏/弦乐录音室/人声配唱/录音工程师/人声录音棚/混音录音室/母带后期处理工程师/母带后期录音室 等角色此前不在角色清单中，会被误判为歌词，导致 `lyricStart` 过早截止、其后的创作信息全部丢失。第四批另含大量「中文角色 + 英文角色」连写格式（如 `词Lyricist：`、`钢琴Piano：`），此前因中文角色后紧跟英文而非冒号而无法命中。

### 改动
**`js/audio-core.js`（Phase 4 创作信息模式检测）**：
1. **`CREDIT_PAT`（单行正则）** 新增角色：`文案、古筝编写、古筝、小提琴编写、小提琴、音乐制作、MV制作、粤语歌词协力、粤语指导、特别感谢、钢琴、吉他编写、吉他录音师、小提琴独奏、弦乐录音室、人声配唱、录音工程师、人声录音棚、混音录音室、母带后期处理工程师、母带后期录音室、合声`。长词条排在前避免截断。
2. **「中文角色 + 英文角色」连写支持**：`CREDIT_PAT` 末尾由 `[：:\s]` 改为 `(?:[A-Za-z][A-Za-z .&]*[：:]|[：:\s])`，即在角色后允许一个可选的英文角色名（字母/空格/./&）再接冒号。由此 `词Lyricist：`、`曲Composer：`、`编曲Arranger：`、`钢琴Piano：`、`吉他演奏Guitar Player：`、`弦乐编写String Writing：`、`小提琴独奏Violin Solo：`、`人声配唱Vocal Producer：`、`合声Chorus：`、`录音工程师Recording Engineer：`、`混音录音室Mixing Studio：`、`母带后期处理工程师Mastering Engineer：` 等连写行均可命中，标签保留「中文+英文」双语角色名。
3. **`CREDIT_MULTI_PAT`（多角色合并正则）** 同步新增上述角色，支持如 `古筝/古筝编写：紫格`、`作曲/音乐制作：苏逸Suyi`、`贝斯/混音：苏逸Suyi` 这类合并行。
4. **`OA_OC_PAT`** 新增 `Lyricist`，支持 `Lyricist(中文词)：` 这类「英文角色 + 括号中文注解」格式（与已有 `Arranger(编曲)` / `Producer(制作人)` / `Presented By` 同走 `(\(.+?\))?` 分支，标签保留括号内的中文注解）。
5. 角色清单仅在 `audio-core.js` 一处维护，已与正则同步。

### 验证
- ✅ Node 单测（第一批 10 行）：文案/古筝/古筝编写/小提琴/小提琴编写/制作人/录音室/混音室/监制/出品 全部 `OK` 命中，无漏判。
- ✅ Node 单测（第二批 8 行）：作曲/音乐制作、MV制作、键盘、吉他、贝斯/混音、粤语歌词协力、粤语指导、特别感谢 全部 `OK` 命中（含多角色合并 作曲/音乐制作、贝斯/混音）。
- ✅ Node 单测（第三批 4 行）：`Lyricist(中文词)`、`Arranger(编曲)`、`Producer(制作人)`、`Presented By` 全部 `OK` 命中 `OA_OC_PAT`。
- ✅ Node 单测（第四批 24 行）：词Lyricist、曲Composer、编曲Arranger、制作人Producer、监制、钢琴Piano、吉他编写、吉他演奏Guitar Player、吉他录音师、弦乐编写String Writing、小提琴独奏Violin Solo、弦乐录音室String Recording Studio、人声配唱Vocal Producer、合声编写Chorus Arranger、合声Chorus、音频编辑Audio Editing、录音工程师Recording Engineer、人声录音棚、混音工程师Mixing Engineer、混音录音室Mixing Studio、母带后期处理工程师Mastering Engineer、母带后期录音室Mastering Studio、OP、SP 全部 `OK` 命中（0 失败），含中文+英文连写与值内 `/`、`@`、`()` 特殊字符。
- ✅ `紫格/Morri3on(喬凡三)` 的括号由 `formatCreditValue` 括号保护逻辑整体保留，渲染为 `紫格` + `Morri3on(喬凡三)` 两个完整名字，不被误拆。
- ⚠️ 提醒：这些创作信息须写入 LRC 文件头部（如 `[文案：偏生梓归]`）才会被解析器读取；纯文本备注不会被解析。

### 📋 歌曲名/歌手名：点击复制（替代原生选中复制）

### 背景
主界面与沉浸舱的歌曲名/歌手名此前依赖原生文本选中（`user-select: auto`），需要双击/长按才能选中复制，且会干扰点触区域。改为点击复制 + Toast 提示。

### 改动
1. **JS（`js/app.js` `initApp`）** — 遍历 `{ el: mainTitle, mainArtist, immTitle, immArtist }` 四个元素：
   - 添加 `.click-copy` class
   - 绑定 `click` 事件：读取 `textContent.trim()`，跳过占位文字（「沉浸式音乐舱」「就绪」「MBolka Player Ultimate」「等待载入音乐...」），调用 `navigator.clipboard.writeText()` 写入剪贴板，成功后 `showToast(\`${text} — 已复制\`, iconSvg('clipboard'))`
   - `clipboard API` 不可用时 fallback `document.execCommand('copy')`

2. **CSS（`css/style.css`）** — 新增 `.click-copy` 类：
   - `cursor: pointer; user-select: none;` — 不可选中、显示手型
   - `:hover` → `filter: brightness(1.2)` 高亮反馈
   - `:active` → `opacity: 0.7` 按下反馈

### 验证
- ✅ `node build.js` 通过（bundle.min.js 198.5 KB / style.min.css 74.2 KB），`read_lints` 0 错误。
- ✅ 占位文字不触发复制；所有 4 个元素统一点击复制并弹出 Toast。

### 🐛 沉浸舱进度条偏移根治：isProgressDragging 共享污染

### 背景
用户提供精确诊断日志（含双槽 `audio`/`cfAudioB` 状态）及 7 首歌曲的实测偏移数据（分布从 -96s 到 +66s，方向/幅度均不一致），交叉验证了偏移根因：**主条与沉浸舱的 `mouseup` 监听器均绑定 `document`，共享 `isProgressDragging` 标志，导致主条先触发、误用自身 rect seek 后清空标志，沉浸舱后被跳过**。

### 根因链
1. 交叉淡变开启 → 双槽机制（`audio`/`cfAudioB`）→ `cfActive` 可能为 'B'
2. 沉浸舱 IIFE 的 `onStart` 设置 `isProgressDragging = true`（共享 module 变量）
3. `mouseup` 触发 → **先注册的主条 `handleEnd`** 检查 `isProgressDragging === true` → 执行 seek → 但 `cachedRect === null`（主条未触发 `mousedown`）→ `getBoundingClientRect()` 返回主条 rect → seek 位置完全错误
4. 主条 `handleEnd` 设置 `isProgressDragging = false`
5. **沉浸舱 `onEnd`** 检查 `isProgressDragging === false` → 直接 return → 沉浸舱进度条完全不响应

### 修复
1. **`bindProgressBar.handleEnd`**（主条）加 `cachedRect === null` 守卫——未初始化（非此条触发的）`mouseup` 直接 return。
2. **`bindProgressBar.handleMove`**（主条）同样加 `cachedRect === null` 守卫。
3. **沉浸舱 IIFE** 改用本地 `_immDragging` 标志，与 module 级 `isProgressDragging` 彻底隔离——`onStart/onMove/onEnd` 全部检查本地标志。
4. 最终 seek 保持双槽写入（`getActivePlayAudio` + `audio`），防止 `cfActive` 错位。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 197.8 KB / style.min.css 74.1 KB），`read_lints` 0 错误。
- ✅ 主条 ↔ 沉浸舱 `mouseup` 不再交叉干扰；本地标志完全隔离。

## v3.6.2 (2026-07-09) — 沉浸舱进度条 + 审计采纳 + coverflow 上移

### 🎨 曲库按专辑封面：coverflow 上移 + 艺术家标签下移

### 背景
曲库「按专辑」模式顶部已包含标题栏、Tab 切换、搜索框、排序条，垂直空间占用较多，导致 coverflow 专辑封面整体偏下沉；同时「按艺术家」排序时，当前居中卡所属艺术家的浮动标签位于 coverflow 上方，与封面信息层级冲突。

### 改动
1. **上移 coverflow（`css/cover-lib.css` `.cover-lib-grid.is-coverflow`）**：
   - 将 `.cover-lib-stage` 改为 `flex-direction: column; align-items: center; justify-content: center;`，让 coverflow 在剩余空间中真正垂直居中。
   - `.cover-lib-grid` 基础态新增 `align-self: stretch;`，保证网格模式（按艺术家 / 最近添加）仍填充 stage 高度；coverflow 模式覆盖为 `flex: 0 0 auto; align-self: center;`，不再拉伸，而是作为 flex item 居中。
   - 新增 `transform: translateY(-50px)`，在几何中心基础上再向上微调到视觉中心区域，抵消顶部栏密集带来的下沉感。
   - 仅使用 `transform`（GPU 合成），不改动布局尺寸，不破坏 `scroll-snap` 与 3D 透视计算。

2. **移动艺术家浮动标签到 coverflow 下方（`css/cover-lib.css` `.coverflow-artist-indicator`）**：
   - 原 `position: absolute; top: 14px;`（coverflow 上方）改为 `position: relative; order: 2; align-self: center; margin-top: 18px;`，作为 stage 的 flex item 自然排在 coverflow 轨道下方，无需魔法数值。
   - 保持水平居中、毛玻璃背景、圆角胶囊样式不变。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 197.9 KB / style.min.css 74.0 KB），`read_lints` 0 错误。
- ✅ 仅影响 `.is-coverflow` 模式；网格模式（按艺术家 / 最近添加）不受影响。

### 🔧 沉浸舱进度条 + 审计采纳：健壮性修复 + UI/动画节能优化

### Bug：沉浸舱进度条点按后约 40 秒偏移
- **根因（rAF reflow 漂移）**：v3.6.7 `toggleImmersiveMode` 进入时 rAF 回调执行 `void el.immProgArea.offsetHeight` 强制回流。此时浏览器从 `.view-container.hidden`（`scale(0.95)`）切换到无 hidden 态尚未完成 layout 计算，rAF reflow 触发 layout 完成 → 进度条容器 flex 宽/位置变化 → `cachedRect` 过时。
- **根因（handleEnd 刷新策略）**：v3.6.7 又在 `handleEnd` 开头刷新 `cachedRect = progArea.getBoundingClientRect()`，但 seek 视觉以 handleStart 的旧 rect 为准，两 rect 若不一致则 seek 偏离 ~40 秒。
- **修复**：
  1. 删除 `toggleImmersiveMode` 中的 rAF force reflow，让 DOM 自然稳定后再响应用户操作。
  2. `handleEnd` 不再刷新 `cachedRect`，`updateVisuals` 始终使用 handleStart 缓存的 rect（与拖拽视觉完全同步），seek 位置与用户所见吻合。
  3. 爆炸特效改用实时 `progArea.getBoundingClientRect()` 避免使用 stale cachedRect。

### 验证
- ✅ `node build.js` 通过，`read_lints` 0 错误。

### 一、代码健壮性（采纳审计建议）
1. **js/vibration.js `_sendRumble`** — 手柄断开重连时 `playEffect` 抛 `InvalidStateError`，原 `catch` 静默但继续遍历失效手柄；现遇之 `break` 跳出循环，避免无谓重试。
2. **js/cover-lib.js `buildRecentEntries`** — 增加 `musicLibrary` 守卫：IDB 初始化完成前 `musicLibrary` 可能为空/undefined，直接 `return []` 避免 `.map` 崩溃。
3. **js/audio-core.js `onProgressTick`** — `setPositionState` 调用前增加 `!isFinite(pa.duration) || pa.duration <= 0` 守卫，避免 duration 为 NaN/Infinity 时抛 TypeError。
4. **js/audio-core.js `onAudioLoadedMetadata`** — `e.currentTarget.duration` 守卫由 `!isNaN` 升级为 `isFinite`（排除流媒体 Infinity 触发的异常续播行为）。
5. **js/ui-core.js `toggleImmersiveMode`** — 提取 `IMM_WILLCHANGE_MS = 800` 常量并注释关联 CSS transition 时长，消除硬编码。
6. **js/audio-core.js `resumeOnGesture`** — 提取 `RESUME_GESTURE_TIMEOUT = 15000` 常量；注释说明"首手势即移除监听，15s 仅兜底"。
7. **js/cover-lib.js `renderCoverLibMore.step`** — 增加 `!g.isConnected` 检查，快速切 Tab 时旧闭包持有的已卸载 DOM 引用不再被操作。

### 二、UI / 动画优化（采纳审计建议）
8. **css/style.css `.lrc-line`** — `transition: all` 改为具体属性（`color/opacity/filter/transform`），避免 `all` 误伤无关属性。
9. **css/style.css `.lrc-line.active`** — 双层发光 `60px` 大半径降至 `30px`，集成显卡合成开销减半、视觉差异极小。
10. **css/style.css `.btn-glass`** — 增加 `text-shadow`，亮背景图片叠加时保证文字可读。
11. **css/style.css `.imm-bottom`** — `width: 100%` 改为 `clamp(600px, 80%, 850px)`，小窗不再"漂浮"。
12. **css/style.css + base-layout.css `input[type=range]`** — 补全 Firefox `::-moz-range-thumb` / `::-moz-range-track` 适配（原仅 webkit vendor）。
13. **css/style.css `.btn-ctrl:active`** — 去除 `!important`，改为 `:not(:disabled)` 提高特异性。
14. **css/style.css `.vis-canvas-container`** — `height: 70px` 改为 `clamp(50px, 8vh, 90px)` 自适应视口。
15. **css/style.css `.theme-preset-grid`** — `repeat(5,1fr)` 改为 `repeat(auto-fill, minmax(80px,1fr))`，大屏色块不再拉伸过宽。
16. **css/style.css 统计面板** — `@media (max-width:480px)` 补充 `.stat-value { font-size:22px }` 防溢出。
17. **css/components.css `.pip-line-current`** — `transition: all` 改为具体属性。
18. **css/components.css `.pip-progress-fill`** — `box-shadow` 硬编码色改为 `var(--primary-glow)` 主题变量。
19. **css/components.css `.pip-vinyl`** — 增加 `@media (max-width:300px) { animation-play-state: paused }`，PiP 极小窗封面不可见时暂停旋转动画省 GPU 合成。

### 三、此前已完成的节能系列改动（同轮汇总）
20. **曲库首屏预暖 `prewarmCoverLib`** — 打开即并行提取前 60 张专辑封面并回填，零占位闪烁；节能态降至 12 张。
21. **一键节能自动暂停交叉淡变** — `cfSuspendForEnergy` / `cfResumeFromEnergy`：暂停时记住用户原设置、停扫描器/预加载定时器、淡变中则回退单轨；设置面板锁定交叉淡变控件并提示"请关闭一键节能后重试"。仅 ONE_CLICK 触发，PIP_TEMP/VISIBILITY 不触碰（保持主界面优化初衷）。
22. **节能态取色重取跳过** — 切歌 `extractColor`/`extractTopColor` canvas 采样在任一节能态下复用上一首主题色（首曲仍取一次建立基线）。
23. **下一首封面预读跳过 + 启动一致性** — 一键节能下跳过 `prereadNextCover`；启动时若 `cfg.oneClickEnergyEnabled` 则自动恢复节能并挂起交叉淡变。

### 审计审查说明（未采纳 / 已自带修复项）
- **已自带修复（无需改）**：`onAudioError` 已有 `e.target.error ? … : 'unknown'` 守卫；`bindProgressBar` 的 `isProgressDragging=true` 已在 `abMode` 检查之后；`handleEnd` 已 `cachedRect=null` 并重取 rect；`resumeOnGesture` 函数开头即移除监听（15s 仅兜底）；`onAudioLoadedMetadata` 已有 duration 守卫。
- **暂缓 / 需专项（本轮未改）**：
  - `globals.js` 50+ 全局变量迁移 ESM/IIFE —— 架构级重构，风险高、会破坏加载顺序，需独立迁移计划。
  - `storage.js` 批量写入重试队列 + localStorage 回退 —— 中等复杂度，当前 `logError` 已记录，数据丢失概率极低，避免过度工程。
  - `audio-core.js` 交叉淡变看门狗对 5s 淡变的中断 —— 核心引擎逻辑，改动需专项验证。
  - CSS 变量体系统一（`style.css` vs `variables.css`）、响应式断点合并 —— 高风险全局重构，改错会全站变色/布局回归，需专项核对。
  - 动画 `infinite` 节能暂停（`.btn-play` glowPulse / `.pip-standby`）、`backdrop-filter` 改 Class 切换、`.lrc-viewport` scroll-snap 重构、绘制算法优化（流沙分辨率/弧线预计算/粒子数动态）、`reducedMotion` 监听、`updateCoverflow` artHash —— 涉及视觉行为与节能类体系确认，建议后续专项视觉验证后实施。
  - `pip.js` pipSyncTimer 清理 / `loader.js` `_metaWorker.terminate` 竞态 / `gamepad.js` 死区常量 / `visualizer.js` animFrameId 双重保险 —— 报告中对应行号已随版本迭代偏移，当前代码路径需重新定位确认，本轮未盲目改动。

## v3.6.1 (2026-07-09) — 交叉淡变后续修复与功能增强

### 🐛 沉浸舱进度条悬停「-6:-3」异常标签与点击跳转修复

### Bug 1：刚进入沉浸舱就显示「-6:-3」异常悬停标签
- **根因**：v3.6.7 在 `toggleImmersiveMode` 中为刷新悬停预览 `hoverRect` 手动 dispatch 了 `new MouseEvent('mousemove', { clientX: 0, clientY: 0 })`。`setupProgressHover` 接收到 `clientX=0` 后算出负值 pct → 负 time → `formatTime` 输出 `-6:-3`。
- **修复**：移除 `dispatchEvent`，仅保留 `void el.immProgArea.offsetHeight` 强制回流。同时给 `setupProgressHover` 的 mousemove 计算添加守卫：duration 不存在/<=0 时直接 return；pct 不在 [0,1] 范围也 return，彻底杜绝异常值。
- **修复**：`updateVisuals` 已有 `Math.max(0, Math.min(1, pct))` 兜底。

### Bug 2：点击进度条跳转位置不准
- **根因**：`bindProgressBar.handleEnd` 使用 `cachedRect`（mousedown 时缓存），若从进入沉浸模式到点击之间有布局变化（如 v3.6.7 的 rAF 回流改变了 flex 尺寸），缓存坐标过时。
- **修复**：`handleEnd` 中在 `updateVisuals` 前先执行 `cachedRect = progArea.getBoundingClientRect()` 刷新坐标，保证松手时 rect 与 `clientX` 同时代。同时加 `if (ap.duration && pct >= 0 && pct <= 1)` 守卫，防止 seek 到不存在的位置。
- **修复**：窗口缩放 resize 监听从 dispatch mouseenter 改为 `void a.offsetHeight` 仅回流，消除副作用。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 190.3 KB / style.min.css 72.1 KB），`read_lints` 0 错误。
- ✅ dist 不再含 `mousevent(clientX:0)` dispatch、悬停预览有负值和空 duration 守卫、点击 seek 使用实时 rect。

### 🎨 渐变色流转首尾衔接 + 文件夹加载条流转 + AI 标签 hover 提示

### Fix 1：渐变色流转首位相接无缝循环
- **根因**：`.cf-vis-bar.enhanced` 此前 `background-size: 300%`，动画 `0%→-100%` 偏移量为 1.5 个周期宽度，首尾色块不匹配导致跳变感。
- **修复**：改为 `background-size: 200% 100%`（2 个完整周期），`background-position: 0%→-100%` 正好偏移一个周期宽度，首尾显示同一色段，循环无缝。同步添加 `background-repeat: repeat` 兜底。

### Fix 2：文件夹加载进度条渐变色流转
- **改动**（`css/base-layout.css` + `css/style.css` `.load-strip`）：原有 `primary→cyan` 渐变扩展为 `primary→cyan→emerald→primary→cyan→emerald`（200% 宽 2 周期），添加 `background-size: 200% 100%` + `cfBarFlow 2s linear infinite`，与淡变指示条同款渐变色流转动画但速度稍缓。原有白色流光（`::after` + `shimmerBar`）保持不动，两者叠加不冲突。

### Fix 3：AI 翻译标签 hover 提示（后期升级为 CSS 自定义动画 tooltip）
- **初版**（`js/audio-core.js` `loadLrc` 创作信息渲染）：AI 翻译 `<span>` 添加 `title="以下歌词翻译由文曲大模型提供"`。
- **升级**（`js/audio-core.js` + `css/base-layout.css`）：去掉原生 `title`，改为在 `<span class="lrc-credits-ai-badge">` 内嵌套 `<span class="lrc-credits-ai-tip">以下歌词翻译由文曲大模型提供</span>`，CSS 绝对定位在 Badge 上方，hover 时弹性缓动曲线 spring 弹出 + 三角箭头，移出即淡出。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 190.1 KB / style.min.css 72.1 KB），`read_lints` 0 错误。
- ✅ dist 含 `background-size: 200%` 匹配、加载条可流转、AI badge title。

### 🌈 交叉淡变指示条：渐变色内部流转 + 退场动画

### 改动
1. **CSS（`css/base-layout.css`）**：
   - `.cf-vis-bar` 基态渐变加宽至 `200%`（`primary→accent→primary→accent`），`background-size: 200% 100%`，为后续流动动画提供冗余色块。
   - `.cf-vis-bar.enhanced` 新增强发光后的渐变色内部循环流动动画：`@keyframes cfBarFlow` 以 `1.5s linear infinite` 驱动 `background-position` 从 `0%` 左移至 `-100%`，色块三组（含 `#f0f0ff` 亮色尾迹）`background-size 300%` 让流动更绵密。
   - 新增 `.cf-vis-bar.exiting` + `@keyframes cfBarExit`：`0.35s ease-out forwards`，同步收缩（`scaleX(0.3)`）+ 淡出（`opacity 0`），结束时 `animation-fill-mode: forwards` 保持最终态。
2. **JS（`audio-core.js` `cfCrossfadeVisStop`）**：
   - 不再立即 `bar.remove()` → 改为添加 `.exiting` 类触发退场 CSS 动画，同时将当前 transform 存为 `--cf-exit-scale` 自定义属性供动画参考位置。
   - `380ms` 后 `setTimeout` 清理 DOM 元素；已处于 `exiting` 状态的 bar 跳过重复操作。

### 效果
- 淡变进度条在横向填充的同时，内部渐变色持续自右向左流动（类似音谱均衡器动态感）。
- 淡变结束时指示条不会「啪」消失，而是平滑收缩淡出，与封面溶解、歌名分阶滑入等淡变视觉升级形成完整退场闭环。
- 流动动画仅 `background-position` 属性变化，GPU 合成层无重排，性能开销可忽略。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 190.1 KB / style.min.css 71.9 KB），`read_lints` 0 错误。
- ✅ dist 含 `cfBarFlow` / `cfBarExit` 动画与 `exiting` 退出逻辑。

### 📐 沉浸舱进度条对标主界面（ARIA + touch-action + 布局稳定）

### 背景
沉浸舱底部进度条的点击/拖拽定位存在偏差，但主界面进度条精准无误。双方 JS 渲染/拖拽逻辑完全一致（共用 `bindProgressBar`），问题源于：
- 沉浸舱进度条缺乏 `touch-action: none` → 浏览器默认触控行为干扰坐标计算
- 进入沉浸模式时 `.imm-wrapper`/`.imm-bottom` 的 flex 布局未强制回流 → 悬停/拖拽 rect 缓存可能过时
- 缺少滚动无障碍 ARIA 属性同步

### 改动
1. **HTML（`index.html`）** — `#imm-progArea` 补齐 `role="slider"` + `aria-label/valuemin/valuemax/valuenow`（与 `#main-progArea` 完全对等）。
2. **CSS（`css/base-layout.css`）** — `.progress-area` 增加 `touch-action: none`，阻止移动端浏览器在进度条区域 intercept 触控事件，确保 `clientX` 坐标直接传给 `bindProgressBar`。
3. **JS — 进入沉浸模式强制回流（`ui-core.js` `toggleImmersiveMode`）** — 在 `viewImm.classList.remove('hidden')` 后追加 `requestAnimationFrame` 回调，执行 `void el.immProgArea.offsetHeight` 强制布局计算 + 触发 `mousemove` 刷新悬停预览的 `hoverRect`，避免 `hidden→visible` 过渡后坐标缓存过时。
4. **JS — 双进度条 ARIA 同步（`audio-core.js` `onProgressTick`）** — 原仅 `el.progAreaMain` 更新无障碍属性，改为 `[el.progAreaMain, el.immProgArea].forEach` 同步更新（`aria-valuemax/valuenow/valuetext`）。
5. **JS — 窗口缩放 rect 刷新（`audio-core.js` `setupProgressHover` 之后）** — 新增 `window.addEventListener('resize')`，当窗口缩放（例如 PWA 窗口拖拽、移动端旋转）时自动 dispatch `mouseenter` 事件刷新双进度条的 `hoverRect`。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 189.6 KB / style.min.css 71.4 KB），`read_lints` 0 错误。
- ✅ dist 含 ARIA 补全、`touch-action: none`、回流/scroll 稳定逻辑。

### 🤖 AI 翻译合规标识 + 文曲大模型字样彻底清除

### 背景
LRC 歌词文件头部可能包含「文曲大模型」等 AI 模型版权声明。根据《人工智能生成合成内容标识办法》，需满足：
- 显式标识 AI 参与生成内容
- 彻底清除非展示的 AI 模型名称

此前 `isCopyright()` 已过滤带「文曲大模型」的行不在创作信息中显示，但未做标记。本轮增加合规显式标识与彻底抹除。

### 改动
1. **检测（`js/audio-core.js` `parseLyricText` Phase 5b 后）** — 扫描 `rawEntries` 全文：若有任意条目含「文曲大模型」字样，置 `isAiTranslated = true`，并随解析结果返回。
2. **返回（`parseLyricText` 末尾）** — `{ lyric, credits, kanaData, isAiTranslated }`；空歌词早期返回同步补充 `isAiTranslated: false`。
3. **显示（`loadLrc` 渲染创作信息卡片）** — `isAiTranslated` 为 true 时，在创作信息标题右侧添加紫色渐变「AI 翻译」Badge：`<span class="lrc-credits-ai-badge">AI 翻译</span>`。
4. **CSS（`css/base-layout.css`）** — `.lrc-credits-ai-badge`：紫色渐变 (`#8b5cf6 → #6d28d9`)、10px 字重 600、圆角 4px、inline-block、title 内垂直居中。
5. **彻底抹除** — `isCopyright()` 正则中的 `文曲大模型` 已确保任何含此字段的行不被计入创作信息；`loader.js` 注释同步清理。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 188.8 KB / style.min.css 71.4 KB），`read_lints` 0 错误。
- ✅ dist 内 `isAiTranslated` 逻辑与 `.lrc-credits-ai-badge` 样式均存在。

### 🎨 设置面板 UI 标准化（统一设计语言）

### 背景
设置-所有设置项的 UI 此前较为随意：有的开关用原生 checkbox、有的按钮是「点击切换」语义、间距与卡片样式各标签页不统一，
违背 v3.5.x 已建立的面板设计语言。本轮对设置面板所有控件做**标准化 / 设计语言化**重写，并把「设置 UI 设计语言标准」定稿写入本条目，作为后续新增设置项的规范。

### 新增设计语言组件类（css/modals.css）
- `.settings-toggle-card`：开关型设置的统一卡片（标题 + 副说明 + 右侧 `toggle-switch`），圆角 12px、半透明底、下间距 8px。
- `.settings-toggle-card-body / -title / -desc`：卡片左侧文字区（标题 14px 主色，说明 11px 次色）。
- `.settings-slider-row`：滑块行（滑块 `flex:1` + 右侧值显示），下间距 12px。
- `.settings-slider-label`：滑块上方标签（13px 次色）。
- `.settings-slider-value`：滑块右侧实时值（12px 主色，最小宽 40px 右对齐）。
- `.settings-segmented`：分段按钮组（一组等宽 `btn-glass`，gap 8px），用于「多选一」选择。
- `.settings-btn-full`：全宽主操作按钮（居中）；`.settings-btn-danger`：危险操作描边红字。
- `.settings-hint / -after-card / -after-row / -center`：说明文字（11px 次色，多种对齐）。
- `.settings-warning`：警告行（11px 琥珀色，带图标）。
- `.drawer-box.accent-energy`（节能模式淡琥珀底）/ `.drawer-box.accent-appearance`（外观淡粉底）：分组强调底。

### 控件类型决策标准（新增设置项请遵守）
| 场景 | 组件 | 示例 |
|---|---|---|
| 二元开关（开/关） | `settings-toggle-card` + `toggle-switch` | 深色模式、保持音调、交叉淡变、各节能开关 |
| 多选一（≤4 项） | `settings-segmented` + `btn-glass` | 字体字重、均衡器曲线、歌词对齐 |
| 连续数值 | `settings-slider-row` + `range` + `settings-slider-value` | 模糊强度、字号、行距、交叉淡变时长、EQ 频段 |
| 动作按钮（打开/清除/导出） | `settings-btn-full` / `settings-btn-danger` | 载入音乐、清除缓存、导出日志 |

### 间距标准
- 卡片内边距：12px 16px；卡片间纵向间距 8px。
- 滑块组：标签→滑块 4px，组间 12px。
- 分段按钮组：组内 gap 8px，组下间距 10px。
- 说明文字与所解释控件：贴其下方（`-after-card` 6px / `-after-row` -4px 10px）。

**后期间距细化（本会话补充）**：
- `.drawer-box` padding 从 `16px` 缩至 `12px`，`.drawer-title` margin-bottom 从 `14px` 缩至 `8px`，使标题→说明→首控件间隙从 ~26px 降至 ~14px。
- 新增 `.settings-hint-after-title`：标题下方说明 6px 下间距，替代多处 inline `style="margin-bottom:12px"`。
- 新增 `.settings-sub-group`：依赖性子控件组（如 OPPO Sans→字重+保留英文），无独立背景边框。
- 新增 `.settings-btn-full + .settings-btn-full`：连续全宽按钮自动 8px 上间距。
- 新增 `.settings-slider-label-mt`：带 12px 上间距的标签类，替代 inline `margin-top:12px`。
- 新增 `.settings-offset-row / -label / -val`：歌词偏移控制行标准化，替换 inline flex 样式。
- 新增 `.settings-info-box`：设置内强调信息盒（震动高级控制）。
- 各组件 `:last-child` 规则：抽屉内最后一张卡片/滑块/分段组等自动清除底部多余间隙。
- `.settings-body` padding 从 `20px 24px` 改为 `16px 20px 28px`，底部加厚防止最后一项贴边。
- 移除全部 inline 间距样式（`margin-bottom:12px`、`margin-bottom:10px`、`margin-top:8px`、`margin-top:12px`等）。

### 本次改造范围（index.html）
- **载入音乐 / 主题色 / 背景图片 / 显示调节**：动作按钮加 `settings-btn-full`；「深色模式」原 `btnToggleDarkMode` 改为 `settings-toggle-card`（含 `darkModeToggleSwitch`）；模糊滑块套用 `settings-slider-label` + `settings-slider-row` + 新增 `blurSliderVal` 值显示。
- **沉浸式外观 / 字体**：`drawer-box.accent-appearance` 强调底；内部全部转为 `settings-toggle-card`；字体字重改为 `settings-segmented`。
- **音频输出 / 均衡器 / 播放速度与音调**：`btnTogglePitch` → `pitchToggleSwitch` 开关卡片；`btnToggleCrossfade` → `crossfadeToggleSwitch` 卡片；曲线改为 `settings-segmented`；`crossfadeNormalizeToggle` 沿用 v3.5.x 既有 `toggle-switch` 卡片。
- **歌词显示**：`lrcFontSizeSlider` / `lrcLineHeightSlider` 套用 `settings-slider-label` + `settings-slider-row` + 新增 `lrcFontSizeSliderVal` / `lrcLineHeightSliderVal`；对齐方式改为 `settings-segmented`。
- **节能模式**：`drawer-box.accent-energy` 强调底，三开关转 `settings-toggle-card`。
- **其他 / 震动反馈**：`settingsRumbleIndicator` 改卡片圆角；说明用 `settings-hint`；`btnTestRumble` / `btnShowStats` / `btnExportLogs` / `btnClearCache` / `btnOpenHelpShortcuts` 加 `settings-btn-full` / `settings-btn-danger`。

### JS 适配（js/ui-core.js / js/audio-core.js）
- ID 重映射：`btnToggleDarkMode`→`darkModeToggleSwitch`、`btnTogglePitch`→`pitchToggleSwitch`、`btnToggleCrossfade`→`crossfadeToggleSwitch`。
- `toggleDarkMode(force)` / `togglePitchPreserve(force)` 改接受 force 参数；`updateDarkModeUI()` 改用 `darkModeToggleSwitch.checked`。
- 速度/音调/Crossfade 绑定段改用 `addEventListener('change', …)` 读 `.checked`，去掉旧按钮 `onclick` 引用。
- 滑块 `oninput` 统一同步「标签内 -Val」与「滑块行 -SliderVal」两处显示：补 `blurSliderVal`、新增 `lrcFontSizeSliderVal` / `lrcLineHeightSliderVal` 的实时同步（此前拖拽时歌词数值不刷新）。

### 验证
- ✅ `node build.js` 通过（bundle.min.js 184.8 KB / style.min.css 68.6 KB），`read_lints` 0 错误。
- ✅ dist 内含新开关结构与滑块双值同步逻辑。

### 🎨 交叉淡变切歌 UI 刷新补全（cfSyncSongUI）

### 背景
v3.6.0 将交叉淡变从 Web Audio GainNode 斜坡改写为 rAF 驱动 `audio.volume` 淡变。
但 `cfFinishTransition`（交叉淡变切歌）仅更新了标题/歌手/文档标题，**遗漏了手动切歌 `playAudio` 中的 8 项 UI 刷新**，
导致交叉淡变后残留旧歌信息（封面、取色、环境光、文件信息、WCO 标题栏、Media Session 控制回调等）。

### 改动
- 新增 `js/audio-core.js` 公共异步函数 `cfSyncSongUI(song)`，集中以下 UI 同步逻辑：
  1. 标题/歌手/文档标题（双界面） 2. 文件信息 `el.fileInfo` 3. 专辑封面 `el.mainArt/el.immArt`
  4. 封面取色 `currentAlbumColor/currentAlbumTopColor` + `--album-color` CSS 变量 5. `.no-art` class 切换
  6. `ThemeColor.update()` + `updateTopColor()` 7. `WCO.setTrack()`
  8. `Media Session` 元数据 + `setActionHandler`(play/pause/prev/next/seek) + `setPositionState` 9. `applyThemeLogic()`
- `playAudio`（手动切歌）与 `cfFinishTransition`（交叉淡变切歌）**统一调用** `cfSyncSongUI`，消除重复代码并保证两端 UI 完全一致。
- `cfFinishTransition` 改为 `async`（内部 `await cfSyncSongUI`）。
- 扫描修复：`js/ui-core.js` 交叉淡变开启分支中遗留的 `cfEnsureContext()` 调用已移除——
  该调用会额外创建 AudioContext 并为双槽建立 `MediaElementSource` 路由，与 v3.6.0 的 `element.volume` 直驱方案冗余/冲突。

### 完整扫描结论（v3.6.0 音频大型调整后）
- ✅ `cfApplyRamp` / `cfSampleRMS` 已无调用方，按原计划保留为死代码（后续清理）。
- ✅ `cfGainNode* / cfGetActiveGain / cfGetPassiveGain / cfGetActiveSource / cfGetPassiveSource / cfGetActiveAnalyser / cfGetPassiveAnalyser / audioCtx_cf` 仅残留在 `globals.js` 的 `cfEnsureContext` 定义内，随本次去除调用后不再被激活路径触及。
- ⚠️ **残留架构缺口（已闭环，见 v3.6.2）**：首版扫描发现 `visualizer.js` 与 `initEQ` 的 `MediaElementSource` 均绑定全局 `audio`（槽 A），进度条/拖拽 seek/Media Session 定位也引用全局 `audio`。该缺口在 v3.6.2「跟随活跃槽」重构中已彻底关闭。

### 🔧 跟随活跃槽重构（频谱/EQ/进度条/媒体中心冻结根治）

### 背景
v3.6.0 将交叉淡变改为 rAF 驱动 `audio.volume` 直淡（无 Web Audio GainNode），v3.6.1 补全了交叉淡变切歌的 UI 刷新。
但可视化/均衡器/进度/seek 控制面仍**硬绑定全局 `audio`（槽 A）**：首次交叉淡变后活跃槽切到 `cfAudioB`、全局 `audio` 被暂停，导致**频谱、均衡器、进度条、系统媒体中心定位全部冻结**。本轮彻底重构为「控制面跟随当前正在发声的槽」。

### 改动
1. **公共汇流节点 `visInputNode`（`globals.js`）**：`initVis` 中新建 `visInputNode = audioCtx.createGain()`，主槽 `audio` 与备用槽 `cfAudioB` 各 `createMediaElementSource` 并联入该汇流节点 → 经 EQ 链 → `analyser` → `destination`。交叉淡变双槽同时发声时，频谱/均衡器均实时响应、不再冻结。
2. **`getActivePlayAudio()`（`globals.js`）**：返回当前正发声的槽——`CfState.FADING` 期间返回正在淡入的新歌（被动槽，界面已把「下一首」视为当前曲）；过渡完成后返回新活跃槽（`cfAudioB` 或换回槽 A）；手动切歌/未开启交叉淡变时退化为全局 `audio`。
3. **`forEachAudioEl(cb)`（`globals.js`）**：遍历主槽 + 备用槽，统一绑定 `timeupdate` / `loadedmetadata` / `error` 事件。
4. **进度/元数据/错误事件（`audio-core.js`）**：`onProgressTick` / `onAudioLoadedMetadata` / `onAudioError` 全部改用 `getActivePlayAudio()`；`initCrossfadeEngine` 为 `cfAudioB` 绑定与「当前活跃槽」同组的事件处理器（此前仅主槽绑定）。
5. **控制面跟随**：歌词点击跳转、进度悬停预览、拖拽 `updateVisuals`、松手 seek、`handleABSeek` / `updateABMarkers`、`saveLongAudioProgress`、`setPlaybackRate`、Media Session 的 seek/position 均改为 `getActivePlayAudio()`。
6. **`initEQ`（`audio-core.js`）**：起始 `visInputNode.disconnect()` 改走 EQ 滤波器链路；双槽 source 仍稳定汇入 `visInputNode`，EQ 开关不影响双槽接入。
7. **下一首「开始播放即视为切歌」（`cfTriggerCrossfade`）**：设置 `cfState = CfState.FADING` 后紧接 `cfSyncSongUI(playlist[nextIdx])` 提前同步全部歌曲信息（标题/封面/取色/环境光/文件信息/WCO 标题栏/系统媒体中心/进度基准），杜绝交叉淡变残留旧歌信息。
8. **中止回滚（`cfAbortTransition`）**：末尾 `if (playlist[currentIndex]) cfSyncSongUI(playlist[currentIndex])` 回滚到「当前仍在播放的旧曲」，避免提前切到下一首的 UI 残留。
9. **`goNext` / `goPrev` 的 `isRepeatOne` 分支**：复位 `currentTime` 并 `play()` 的目标改为 `getActivePlayAudio()`。
10. **`gamepad.js`**：`j`/`k`、双击、LT/RT（btns[6]/[7]）、左摇杆 seek 全部改为 `getActivePlayAudio().currentTime`。
11. **`storage.js`**：播放统计的 `play` / `pause` 事件经 `forEachAudioEl` 绑定双槽。

### 验证
- ✅ `js/globals.js` / `js/visualizer.js` / `js/audio-core.js` / `js/gamepad.js` 四个改文件 `read_lints` **0 错误**。
- ✅ v3.6.1 标注的「残留架构缺口（频谱/EQ/进度条/媒体中心冻结）」本轮已彻底闭环。

### 🐛 自动续播/交叉淡变卡顿修复（onended 生命周期 + 后台 rAF 兜底）

### 🐛 Bug 1：关闭淡入淡出后放完一首歌自动暂停（不续播）
- **根因**：`playAudio` 手动切歌重置块执行 `passive.onended = null`；当 `cfActive==='B'` 时 `passive` 即 `audio`，导致 `audio.onended` 被清空且后续不重绑。一旦曾开启过交叉淡变（`cfActive` 停在 'B'），关闭后 `goNext→playAudio` 会清空 `audio.onended`，歌曲自然结束时不再触发 `goNext` → 自动暂停。
- **修复**：抽取统一处理器 `onAudioEnded()`（单曲循环→重播当前活跃槽 `getActivePlayAudio()`；否则存进度 + `cfState`/`cfAirLocked` 守卫后 `goNext`），在主槽 `audio` 与备用槽 `cfAudioB` 上**永久绑定、永不置空**（`audio.onended = onAudioEnded` 于模块加载；`cfAudioB.onended = onAudioEnded` 于 `initCrossfadeEngine`）。移除 `playAudio` 重置块与 `cfFinishTransition` 中对双槽的 `onended = null` 置空，以及 `cfFinishTransition` 内冗余的 `newActive.onended` 内联绑定。双槽同绑安全——仅当前活跃槽播放到末尾触发 onended，暂停/空槽不会触发。

### 🐛 Bug 2：自动播放第三首起在交叉淡变点卡住不动
- **根因**：交叉淡变收尾完全依赖 `requestAnimationFrame` 的淡变回调（`fade()` 在 `t≥1` 时调用 `cfFinishTransition`）。播放器在**后台标签页**运行时浏览器会暂停 rAF，淡变永远跑不到 `t≥1`，`cfState` 永久卡在 `FADING`，`getActivePlayAudio()` 持续返回被动槽 → 进度条/控制面冻结，表现为「放几首后卡住」（用户描述的「8 秒」对应其交叉淡变时长，即淡变触发点）。
- **修复**：
  1. `cfTriggerCrossfade` 启动 rAF 淡变后追加 `setTimeout` 兜底（延迟 `durMs+120ms`）强制收尾；
  2. `cfFinishTransition` 顶部加一次性守卫 `if (cfState !== CfState.FADING) return;`，确保 rAF 路径与 setTimeout 兜底**二选一**、不重复执行。

### 验证
- ✅ `js/audio-core.js` / `js/globals.js` `read_lints` 0 错误。
- ✅ 全仓仅剩 2 处 `onended` 赋值（`audio.onended = onAudioEnded`、`cfAudioB.onended = onAudioEnded`），无 `onended = null` 残留。

### 🐛 交叉淡变歌词/总时长修复 + 歌词栏高斯模糊动画

### 🐛 Bug 1：进度条目标时间永远显示上一首歌曲的总时长
- **根因**：`onAudioLoadedMetadata` 用 `getActivePlayAudio().duration` 写总时长。交叉淡变预加载阶段（`CfState.PRELOADING`）被动槽 `cfAudioB`（新歌）的 `loadedmetadata` 触发时，`getActivePlayAudio()` 仍指向旧歌（FADING 尚未置位），于是总时长被错写成上一首；新歌淡入后 `metadata` 不再触发 → 总时长永远停在旧歌（进度填充因 `onProgressTick` 在 FADING 已用新歌 duration 故显示正常，唯独总时长文本错）。
- **修复**：`onAudioLoadedMetadata` 改为用「触发该事件的元素」自身 `duration`（`e.currentTarget.duration`）：预加载阶段被动槽触发→取其真实新歌时长；手动切歌时触发元素即新活跃槽→同样正确；取不到时回退 `getActivePlayAudio().duration`。

### 🐛 Bug 2：歌词要等下一首第一句唱出才更新 + 歌词栏无出入场/高斯模糊
- **修复 A（歌词随音频介入即更新）**：原 `loadLrc(nextSong)` 只在 `cfFinishTransition`（淡变完成）调用，故歌词要等到下一首唱出第一句才切。`v3.6.4` 将其前移到 `cfTriggerCrossfade` 置 `FADING` 之后、启动被动槽之前调用——新歌音频一开始介入，歌词栏立即切到下一首（置顶、待第一句点亮），不再滞后。并：
  - 移除 `cfFinishTransition` 中重复的 `loadLrc`（避免二次重载/闪烁）；
  - `cfAbortTransition` 回滚 UI 时同步 `loadLrc(当前旧曲)`，避免中止后歌词残留下一首；
  - 手动切歌（`playAudio`）仍保留 `loadLrc`。
- **修复 B（歌词栏出入场 + 切歌高斯模糊）**：
  - `loadLrc` 在「歌词栏可见且有旧歌词」时，先给 `#lrcViewport` 加 `.lrc-switching`（高斯模糊 `blur(10px)`+淡出 `opacity:0`，`transition 0.22s`），等待 220ms 再换内容，随后移除类实现「去模糊淡入」——完成切歌的高斯模糊过程；
  - 面板此前隐藏（首次/被关后新歌）→ 整体 `@keyframes lrcPanelIn`（模糊+上移淡入），避免每次切歌整面板跳动；
  - `btnToggleLrc` 开/关分别加 `.lrc-panel-in` / `.lrc-panel-out`（淡入/淡出后再隐藏），歌词栏具备渐入渐出出入场动画；
  - CSS 关键帧与 `.lrc-viewport.lrc-switching` 加至 `css/base-layout.css`；`prefers-reduced-motion` 下自动降级为瞬时。

### 🐛 Bug 3 (hotfix)：歌词完全不显示 — `lrc-switching` 残留导致永久不可见
- **场景**：有歌词的歌 A → 无歌词的歌 B → 有歌词的歌 C。
  - 切到 B 时：`wasVisible=true`（A 的歌词还在），加了 `.lrc-switching`；B 无歌词 → 进入 `!lrcText` 分支直接 return → **未清理 `lrc-switching`**。
  - 再切到 C 时：`parsedLyrics=[]`（已被清空）→ `wasVisible=false` → 跳过切换逻辑 → `lrc-switching` 永远卡在 `#lrcViewport` 上 → `filter:blur(10px);opacity:0` → 歌词永久不可见。
- **修复**：
  1. `!lrcText` 早期返回分支增加 `el.lrcView.classList.remove('lrc-switching')` 及面板动画类清理；
  2. 有歌词分支改为**无条件先移除 `lrc-switching`**（不再依赖 `wasVisible` 判断来决定是否清理），防止任何残留路径。

### 验证
- ✅ `js/audio-core.js` / `js/ui-core.js` `read_lints` 0 错误。
- ✅ `loadedmetadata` 绑定为 `addEventListener`（事件对象可用，`e.currentTarget` 取触发元素）。
- ✅ `loadLrc` 现调用点：交叉淡变起点（`cfTriggerCrossfade`）、中止回滚（`cfAbortTransition`）、手动切歌（`playAudio`）；`cfFinishTransition` 不再重复调用。

### 🐛 后台切回前台「点击播放播放的不是当前歌曲」修复

### 🐛 根因：`togglePlay` 用硬编码 `audio`（槽A）而非「当前活跃槽」
- 交叉淡变为双槽机制：淡变完成后 `cfActive` 翻转，活跃槽会变成 `cfAudioB`，而 `audio` 始终是固定主槽（槽A）。`getActivePlayAudio()` 已正确跟随活跃槽，但 `togglePlay`（`v3.6.4` 及之前）直接用 `audio.pause()/audio.play()`。
- **触发路径**：连播若干首、某次交叉淡变完成 → 活跃槽=B、歌曲在 `cfAudioB` 上发声 → 切到后台标签页（音频继续播，但 `requestAnimationFrame` 被浏览器暂停，无新淡变/扫描）→ 回到前台时活跃槽仍是 B。此时点击播放/暂停：
  - 原代码控制的是 `audio`(槽A，已静音/停止) → 表现：点了不响、或 `audio.play()` 放出了槽A里残留的旧歌「不是当前歌曲」；
  - 点「下一首」→ `goNext→playAudio` 会重置 `cfActive='A'` → 活跃槽回到 `audio` → 恢复正常。完全吻合用户报告。
- **修复**：
  1. `togglePlay` 改用 `const active = getActivePlayAudio()`，暂停/播放都作用于真正发声的活跃槽；恢复播放时先把 `active.volume` 同步为用户音量，防止异常态下被置 0 无声；`play()` 加 `.catch(()=>{})` 防 unhandled rejection。
  2. 睡眠定时器到点暂停同样改用 `getActivePlayAudio().pause()`（否则活跃槽=B 时到点不暂停）。
- **未改**：`playAudio`/`onAudioEnded`/`saveLongAudioProgress`/`cfPreloadNext` 等本就使用 `getActivePlayAudio()` 或显式重置为槽A，逻辑正确。

### 验证
- ✅ `js/audio-core.js` `read_lints` 0 错误。
- ✅ 全仓直接控制播放/暂停的路径：`togglePlay`、`setSleepTimer`、`音频错误跳过`(onAudioError→goNext) 均指向活跃槽；手动切歌 `playAudio` 仍显式重置 `cfActive='A'`。

### 🎨 交叉淡变视觉升级（封面溶解 + 歌名分阶 + PiP 淡变 + 进度条发光）

### 设计目标
利用现有预载架构（下一首封面、取色在淡变起点已就绪），为交叉淡变增加**视觉与动画厚度**，提升整体设计水平。

### ✅ 改动清单

#### 1. 专辑封面溶解（主界面）
- **效果**：淡变起点 `cfSyncSongUI` 时，新封面在 `<img>` 内即时显示，旧封面以覆盖层 `.art-crossfade-overlay` 浮于其上，`opacity 3s cubic-bezier` 淡出。淡变完成时（`cfFinishTransition`）自动移除覆盖层；中止（`cfAbortTransition`）时同步清理。
- **根因场景**：此前封面在淡变起点 `src = song.art` 瞬间硬切，浪费了提前预载的封面数据。

#### 2. 歌名/歌手分阶滑入（主界面 + 沉浸舱）
- **效果**：`@keyframes cfTextEnter`：`translateY(14px) + blur(4px) → 正常` + `opacity 0→1`，`0.45s`。歌手延迟 `0.15s`（`.stagger`）。仅 `cfState === FADING` 时触发，手动切歌/中止回滚跳过（瞬间到位）。
- **代码**：`cfSyncSongUI` 顶部检测 `isCrossfade`，给 `mainTitle/mainArtist/immTitle/immArtist` 加 `.cf-text-enter` / `.cf-text-enter.stagger`。

#### 3. PiP 封面淡变
- **效果**：PiP 背景层 `pipBg` 和黑胶封面 `pipVinyl` 在封面变化时各自生成旧封面覆盖层（`.pip-bg-overlay` / `.pip-vinyl-overlay`），`opacity 3s cubic-bezier` 淡出后自动移除。
- **代码**：`updatePipUI` 新增 `pipLastArt` 追踪 + 检测 `cfState === CfState.FADING` 时创建覆盖层。`.pip-vinyl` 加 `position: relative` 作为定位基准。

#### 4. 进度条淡变视觉升级
- **cf-vis-bar 发光拖尾**：`.cf-vis-bar.enhanced` 增加 `box-shadow` 发光 + 高度 3→4px + 渐变终点加白色，在淡变起点 50ms 后追加。
- **进度填充环境光晕**：`.cf-airlock .prog-fill` 新增 `box-shadow` 跟随 `--album-color` 变量（淡变期间实时颜色过渡——`CSS transition 0.8s`）。

### 验证
- ✅ `js/audio-core.js` / `js/pip.js` / `css/base-layout.css` / `css/components.css` `read_lints` **0 错误**。
- ✅ `prefers-reduced-motion` 下所有淡变动画降级（`.art-crossfade-overlay`、`.pip-bg-overlay`、`.pip-vinyl-overlay` 隐藏，`cf-text-enter` 无动画）。
- ✅ 手动切歌 / 中止回滚不触发封面溶解与文字动画（`isCrossfade` 仅在 `cfState === FADING` 时为 true）。

### 🐛 后台交叉淡变保活修复（「放到第三首就停」彻底解决）

### 🐛 根因：后台 rAF 冻结 → cfState 永久卡在 FADING → 活跃槽播完不切歌 → 静默停止

**完整触发路径：**
1. 循环播放中，某次交叉淡变触发 → `cfState = FADING` → rAF 驱动 fade 开始
2. 用户切到后台标签页 → `requestAnimationFrame` 被浏览器**完全暂停**
3. fade 动画不再推进（`performance.now()` 在后台继续推进，但 `fade()` 函数不再被 rAF 调用，`t` 永远停留在首帧）
4. `setTimeout(() ⇒ cfFinishTransition(), durMs + 120)` 兜底被浏览器后台节流至数秒甚至 10+ 秒后才触发
5. 在此期间，**当前活跃槽自然播放到末尾** → `onended` 触发 → `onAudioEnded`
6. `onAudioEnded` 检查 `cfState !== CfState.IDLE || cfAirLocked` → **FADING → return，不切歌**
7. 旧歌已播完（→ 静音），新歌音量仍为 0（fade 卡在第一帧），两者中间没有声音输出 → **播放器静默停止**
8. 用户观察到的现象：「放到第三首就停了」「已经播放了十秒淡变了，但是十秒结束后仍然停止」
9. 10+ 秒后 `setTimeout` 终于触发 → `cfFinishTransition` 恢复播放，但此时新歌已播放了十数秒 → 从\错位\位置继续

### ✅ 修复

#### Fix 1：`onAudioEnded` — FADING 时活跃槽播完立即强制完成过渡
- 新增模块级变量 `_cfPendingNextIdx` / `_cfPendingNextVol`，在 `cfTriggerCrossfade` 中缓存当前淡变参数。
- `onAudioEnded` 中，当 `cfState === FADING` 且 **`this`（触发了 `ended` 的 `<audio>` 元素）等于当前活跃槽**时：
  - 直接调用 `cfFinishTransition(pendingIdx, pendingVol, cfTransitionId)` → **不递增 `cfTransitionId`**
  - `onAudioEnded` 是普通函数声明（不是箭头函数），`this` 指向触发了 `ended` 的 `<audio>` 元素，双槽同绑安全区分。
- **⚠️ v1→v2 回归修复（fade rAF 误停新活跃槽）**：初版在 `onAudioEnded` 中 `++cfTransitionId` 后调用 `cfFinishTransition`，意图让在途 fade rAF 因 tid 不匹配而跳过。但 stale tid 分支执行 `passiveEl.volume = 0; passiveEl.pause()` —— `cfFinishTransition` 已翻转槽位，`passiveEl` 此时已翻转为**新活跃槽**，该操作将其暂停 → **淡变结束立即停止，100% 复现**。
  - v2 修复：fade 函数顶部增加 `if (cfState !== CfState.FADING) return;` 守卫；`onAudioEnded` 和 `visibilitychange` 均不再递增 `cfTransitionId`。
- **⚠️ v2→v3 修复（return 缩进错误 + PRELOADING 阶段活跃槽结束不切歌）**：初版 `return` 在 `if (cfState === FADING || cfAirLocked)` 的外层而非内部 `if` 内，导致：
  1. FADING 时被动槽（不是活跃槽）结束 → 外层 `return` 跳过 `goNext()` → 播放器停止。
  2. `cfAirLocked` 在 PRELOADING 阶段就为 `true`。若扫描器在剩余 0.3s 触发预加载、歌曲在 preloading 完成前就到尽头 → 活跃槽结束 → `cfFinishTransition` 被调用但 `cfState!==FADING` 立即返回 → 外层 `return` 跳过 `goNext` → 播放器静默停止。
  - v3 修复：FADING 分支只检查 `cfState === CfState.FADING`（不含 `cfAirLocked`），`return` 移入内部 `if`；新增 `else if (cfAirLocked && cfState === PRELOADING)` 分支，活跃槽结束时直接 abort + `goNext`。

#### Fix 2：`visibilitychange` 可见时恢复卡住的 FADING 状态
- 标签页从隐藏→可见时，若 `cfState === FADING` 且 `_cfPendingNextIdx >= 0`（有在途淡变），强制 `cfFinishTransition` 收尾。
- 兜底路径：即使用户返回前台时 `onAudioEnded` 未被触发（活跃槽仍在播放但 fade 卡住），也能在可见时立即推进到下一个状态。
- 守**护机制**：fade 函数顶部 `if (cfState !== CfState.FADING) return;` 确保无论哪种路径强制收尾后，在途 fade rAF 安全退出（不误操作翻转后的新活跃槽）。

### 🐛 交叉淡变「偶发硬切」彻底根治（src 永不空串）

### 🐛 根因：MediaElementSourceNode 在 Chrome 下因 src=''→重载而失联

- **背景**：v3.5.4 修复了「仅偶数首生效」后，连续播放中仍**偶发硬切**（上一首突然被掐断、下一首直接顶上，无交叉斜坡）。上轮修复把问题定位到扫描器/预加载，但硬切真因在过渡收尾阶段。
- **真因**：`cfFinishTransition` 旧逻辑在收尾时对「旧活跃槽」执行 `oldActive.src = ''; oldActive.load();`。Chrome 中 `MediaElementSourceNode` 在宿主 `<audio>` 经历 `src='' → 重载` 周期后，**节点会失联**（Web Audio 已知行为），被动槽 GainNode 再也收不到信号 → 即便下一轮淡变调度正常，被动槽也是静音，表现为硬切。
- **修复原则**：**双槽 AB 乒乓模型，src 永远不空串**。过渡完成后旧活跃槽仅 `pause()` 保留其 `src`，增益归零静音即可；下一轮该槽作为被动槽被复用时直接覆盖 `src`（仍是有效非空 URL，SourceNode 持续有效）。

### ✅ 改动清单

| 位置 | 改动 |
|------|------|
| `js/audio-core.js` `cfFinishTransition` | 删除 `oldActive.src=''; oldActive.load();`，仅 `pause()` + 增益归零 |
| `js/audio-core.js` `cfAbortTransition` | 删除 `passive.src=''; passive.load();`，仅 `pause()` 静音 |
| `js/audio-core.js` `playAudio` 重置块 | 删除活跃槽/被动槽两处 `src=''+load()`，仅 `pause()` + 静音增益（遵循 src 永不空串） |
| `js/audio-core.js` `cfTriggerCrossfade` | 新增兜底：被动槽 URL 已一致但 `readyState < 2`（预加载被丢弃/出错）时强制 `load()` 并重等 `loadeddata` |
| `js/loader.js` `clearPlaylist` | 删除 `audio.src=''`——该操作会永久令 slot A 的 SourceNode 失联且 `cfEnsureContext` 不会重建，导致清空后重载交叉淡变硬切；改为仅重置交叉淡变状态（cfActive='A'、cfAirLocked=false、cfState=IDLE、失效在途事务/定时器） |

### 🧪 验证要点
- 连续循环播放（含 shuffle）→ 每首之间应听到平滑斜坡，不再出现掐断式硬切。
- 清空播放列表→重新载入文件→开启交叉淡变播放 → slot A 仍可正常淡变（旧 `audio.src=''` 路径下此处会无声）。

## v3.6.0 (2026-07-09) — 交叉淡变(Crossfade)功能与全部修复

### 🚀 交叉淡变核心引擎重写（四项增强 + 每首连续生效）

### 🐛 交叉淡变「隔一首才生效」致命 Bug 修复

- **背景**：原扫描器 `cfSetupScanner` 始终读取固定 `audio` 槽的 `duration / currentTime`。交叉淡变完成后活跃槽切到 `cfAudioB`，`audio.src` 被清空（`duration = NaN`），扫描器再也匹配不到「剩余时间 ≤ 淡变时长」条件 → 仅偶数首能交叉淡变，奇数首硬切。
- **`js/audio-core.js` `cfSetupScanner`**：循环内改用 `cfGetActiveAudio()` 读取**当前活跃槽**时长与进度，扫描器持续跟踪 A/B 任一活跃槽。
- **`js/audio-core.js` `cfPreloadNext`**：预加载时机以 `cfGetActiveAudio().duration` 为准（原误用 `audio.duration`），交叉淡变后活跃槽为 `cfAudioB` 时仍能正确提前预加载；`preloadAt` 统一 `Math.max(_, 0)` 兜底。
- **`js/ui-core.js` 开关**：开启交叉淡变时新增 `cfSetupScanner()` 重启扫描器（原仅首开需手动切歌一次才生效）；关闭时 `cancelAnimationFrame` 停掉空转的 rAF。
- **`js/audio-core.js` `playAudio`**：手动切歌时彻底重置双槽位——此前仅在 `cfState !== IDLE` 清理，但交叉淡变完成后活跃槽可能停在 `B`，手动切歌会残留旧歌 + 主槽 `A` 增益被置 0 导致新歌静音。现统一停止并清理 A/B 两槽、复位主槽增益到用户音量、使在途过渡/预加载定时器失效。

### ✅ 修复覆盖的缺陷清单

| 原缺陷 | 现状 |
|--------|------|
| 扫描器只监听 `audio` | 改为监听当前活跃槽，每首连续交叉淡变 |
| 开启开关未重启扫描器 | 开启即 `cfSetupScanner()` |
| 预加载用 `audio.duration` | 改用 `cfGetActiveAudio().duration` |
| 手动切歌双重清理/活跃槽 B 残留静音 | 统一 reset 双槽位 + 复位主槽增益 |

### 🚀 四项可选增强

| # | 增强项 | 文件 | 说明 |
|---|--------|------|------|
| 1 | **淡变曲线可选** | `index.html` / `js/ui-core.js` / `js/audio-core.js` | 新增 `cfApplyRamp()` 支持三种曲线：`exponential`（指数，默认，人耳最平滑）、`linear`（线性）、`equal-power`（等功率，`setValueCurveAtTime` 32 点 cos/sin 离散调度，感知响度恒定）。设置面板新增三按钮曲线选择器，结果持久化至 `crossfadeCurve`。 |
| 2 | **淡变期间禁止 seek** | `js/audio-core.js` / `css/base-layout.css` | `bindProgressBar` 的 `handleStart` 顶部新增 `if (cfAirLocked) return` 守卫，阻止拖拽/点击进度条；`cfTriggerCrossfade`/`cfFinishTransition`/`cfAbortTransition` 调 `cfUpdateAirLockUI(locked)` 切换 `.progress-area.cf-airlock` CSS 类（`pointer-events: none` + 半透明化）。`goNext`/`goPrev` 已有 `cfAirLocked` 守卫未改。 |
| 3 | **响度归一化** | `js/globals.js` / `js/audio-core.js` / `index.html` | 新增 `crossfadeNormalize` 开关（默认开启）。`cfEnsureContext` 中插入 `cfAnalyserA`/`cfAnalyserB` 作为信号采样点（位于 SourceNode 之后、GainNode 之前）。`cfTriggerCrossfade` 在 PRELOADING 完成后使用 `cfSampleRMS()` 分别采样双槽频域 RMS（主动 8 帧 + 被动 8 帧），计算归一化因子并 `clamp(0.25, 4.0)`，调用 `cfApplyRamp` 时传入 `aAdj`/`pAdj` 调整增益目标。设置面板新增复选框。 |
| 4 | **淡变可视指示条** | `js/audio-core.js` / `css/base-layout.css` | 新增 `cfCrossfadeVisStart`/`cfCrossfadeVisStop`：淡变时在主/沉浸进度条 `progress-area` 内动态插入 `.cf-vis-bar`（3px 高、`primary→accent` 渐变、`transform:scaleX` 从 0→1 动画），完/止后自动移除。CSS 中使用 `position:absolute; inset:auto 0 100% 0` 固定在进度条上方。 |

## v3.5.4 (2026-07-09) — 淡变功能前全部更新：封面内存钉死(LRU) + OPPO Sans 字体 + 设置整理 + 首歌封面重载 + 均衡器失真 + 创作信息修复

### 🧠 封面 art 内存钉死：LRU 限额层

- **背景**：原本整个歌单「每首」都常驻一份封面 `data:` URL（几百~上千首 → 数十 MB），拖动/切歌造成内存随库增长无限膨胀。
- **目标**：不再每首常驻，只常驻最近使用上限内的封面；超出则把 `song.art` 置空（数据 URL 由 GC 回收），需要时经 `ensureArt()` 从文件懒重新提取。内存被钉死在 `~150 × ~50KB ≈ 7.5MB`。
- **`js/loader.js` 新增 LRU 层**：
  - `ART_LRU_CAP = 150`；`_artStore: Map(key 指纹 → { art, seq, song })`；`_artExtracting: Map(key → Promise<art>)`（并发提取共享 Promise，见下方竞态修复）；`_artSeq` 递增计数器。
  - `cacheArt(song, art)`：写入 store + 回填 `song.art`，超 `1.4 × CAP` 触发 `evictArt()`。
  - `evictArt()`：按 `seq` 升序淘汰最旧项至 CAP，被淘汰项 `song.art = null`（store 项删除 = 真淘汰，内存释放）。
  - `touchArt(song)`：标记热（最近使用），防止被淘汰。
  - `ensureArt(song)`：`song.art` 命中 → `touchArt` 返回；store 命中 → 回填 `song.art`；否则 `extractArtOnly` + `downscaleArt` 懒提取并 `cacheArt`。可安全高频调用。
  - 全部解析路径（缓存命中 / 缓存无 art 内联 / Worker 回传 / 内联 fallback）改为经 `cacheArt()`，取代直接 `meta.art = art`。
- **`js/audio-core.js`**：`playAudio` 与 `reloadFirstSongCover` 在取色/设封面前 `await ensureArt(song); touchArt(song)`，保证当前歌封面与取色始终可用（即便被淘汰）。
- **`js/pip.js`**：每帧更新封面时若 `s.art` 为空，调用 `ensureArt(s)`（下帧即生效）。
- **`js/cover-lib.js`**：
  - `buildAlbumEntries` 分组键由 `s.art` 改为「专辑 + 艺术家」身份——**修复回归**：LRU 淘汰后多张不同专辑 `s.art` 变 null 会被错误合并到一个「无封面」组。
  - `createCoverCard` / recent 网格卡 / `showAlbumDetail`：若 `group.art` 为 null，渲染占位图后 `ensureArt(musicLibrary[group.firstIdx])` 就地补图（`card.isConnected` 守卫避免已移除卡片）。
- **影响边界**：歌单 ≤ 210 首时不触发淘汰，曲库打开即满封面；窗口化渲染（coverflow 首屏 `CL_INITIAL=60`、滚到底前 600px 追加 30、各网格分块）把同时补图的并发钉在几十次量级，不会卡死。淘汰仅清 `song.art` 引用，已渲染卡片的 `<img>` 仍持快照字符串（独立、随 DOM 移除 GC），无破图。

### 🚀 二次优化（用户授权主动优化）

- **优化 1｜当前播放歌曲硬保护**：`evictArt()` 改为跳过 `playlist[currentIndex]` 对应指纹（`protect` Set），即使其 `seq` 最旧也不驱逐 `song.art`。避免播放中封面被挤出后反复 `ensureArt` 提取；`playAudio` 虽已有 `await ensureArt` 兜底，但硬保护更稳、零延迟。用 `typeof playlist/currentIndex` 防御（运行时调用，非 TDZ）。
- **优化 2｜曲库可见窗口预热**：`createCoverCard` 与 recent 网格卡渲染时，若 `group.art` 非空则对 `musicLibrary[group.firstIdx]` 调 `touchArt(song)` 标记热；非空分支的懒恢复 `ensureArt` 逻辑保留。使曲库浏览期间当前可见窗口的封面保持高优先级，减少重渲染（切 Tab / 搜索）时的重复提取。`showAlbumDetail` 单图已由 `ensureArt` 变热，未改。

### 🐛 重渲染竞态修复（非首批歌曲封面始终不加载）

- **症状**：开启封面限额后，除第一批加载封面的歌曲外，其余歌曲的专辑封面始终停在占位图、不再加载。
- **根因**：`_artLoading` 布尔 `Set` 去重在封面提取中引发重渲染竞态——后台加载 batch 完成 → `musicLibrary` 更新 → 曲库重渲染（`grid.innerHTML = ''` 移除旧卡片）→ 新卡片（同专辑）调 `ensureArt` 时 `_artLoading.has(k)` 为 true → **直接 `return null`**；而旧卡片的提取完成后 `.then()` 发现 `card.isConnected` 已 false 跳过更新。结果：旧卡片的 `.then` 从未为新卡片触发，新卡片从此永久留在占位图。
- **修复**：`_artLoading` 改为 `_artExtracting` 共享 `Promise` `Map`（key → `Promise<art>`）。后续并发 `ensureArt` 调用 `await _artExtracting.get(k)` 等待同一提取完成，拿到结果后回填 `song.art`，不再直接 `return null`。彻底消除重渲染竞态导致的「封面始终不加载」。
- **涉及文件**：`js/loader.js`、`js/cover-lib.js`、`js/audio-core.js`、`js/pip.js`
- **验证**：`node --check` 全部 OK，`read_lints` 0 错误；`_artLoading` 无残留代码引用（仅注释提及）。

### 🎨 设置-外观新增：OPPO Sans 字体（跨域）

- **跨域验证**：`https://www.oppo.com/.../OPPOSans3.0cn-Regular.woff2` 与 `-Medium.woff2` 均返回 `200` + `Access-Control-Allow-Origin: *` + `content-type: font/woff2`（约 745KB/个），确认可跨域加载。
- **实现**：
  1. `index.html` `<head>` 注入 `@font-face`：字体族 `OPPO Sans 3.0 R`（Regular）/ `OPPO Sans 3.0 M`（Medium），`font-display: swap`。
  2. 新增配置项 `cfg.useOppoSans: false`（默认关闭）、`cfg.oppoSansWeight: 'R'`（默认 Regular）。
  3. `js/utils.js` 持久化/恢复两项配置。
  4. `index.html` 设置-外观「字体」抽屉：启用开关 + R/M 字重二选一（`.btn-glass` 高亮当前选择）；开关关闭时字重框自动隐藏。
  5. `js/ui-core.js`：新增 `applyOppoSans()`，启用时把 `--font-body` 覆盖为对应字重字体族并回退系统字体；`updateSettingsUI()` 同步开关/显隐/高亮，并在启动时（`utils.js` 初始化调用）随存档应用。新增 `useOppoSansToggle` change 与 `.oppoSansWeightBtn` click 事件，切换即 `saveSettings()`。
  6. 新增 SVG 图标 `icon-type`（Lucide type）用于字体相关入口。
- **涉及文件**：`js/globals.js`、`js/utils.js`、`js/ui-core.js`、`index.html`、`css/*`（复用 `.btn-glass.active`）
- **注意**：启用后需联网从 OPPO CDN 拉取字体文件；离线时 `font-display: swap` 自动回退系统字体。

### ⚙️ 设置-外观整理：沉浸式外观移入「外观」选项卡 + 封面取色合并

- **背景**：`跟随强调色`（沉浸式外观内的复选框 `followAccentToggle`）与「封面取色」（`btnToggleColorMode` 按钮）二者实际控制的是同一个 `cfg.followAccentColor`，属重复开关。
- **改动**：
  1. 将「沉浸式外观」抽屉从设置-高级（无关键词匹配 → 默认组 4）移入**设置-外观**（加 `data-tab-group="1"`）。
  2. 删除独立的「封面取色」抽屉，将其开关并入「沉浸式外观」：原「跟随强调色」行改名为 **封面取色**（保留 `followAccentToggle` id 与取色预览条 `colorModePreview`，名字统一为「封面取色」）。
  3. 顺手修正 3.5.3 引入的「字体」抽屉（标题无关键词匹配被误归高级）→ 加 `data-tab-group="1"` 归入外观。
  4. `js/ui-core.js`：`btnToggleColorMode` 的 `.onclick` 绑定做空安全守卫（元素已移除）；`toggleColorMode()`（Y/C 快捷键）保留并同步新复选框；相关 toast/注释由「跟随强调色」改为「封面取色」。
- **涉及文件**：`index.html`、`js/ui-core.js`、`js/globals.js`（注释）
- **说明**：现在「封面取色」在设置-外观的「沉浸式外观」内以复选框呈现，开启后预览条显示提取色；Y/C 快捷键仍可用。

### 🎵 歌词-创作信息强制换行恢复（保持名字完整）

- **问题**：创作信息超长名单（如 `Lyricist: A/B/C/D/E`）显示在一行，容易溢出或难以阅读；之前 `word-break: break-all` 虽能断字换行，但会破坏单个名字完整性，且在 flex 布局中有时未生效。
- **修复**：
  1. `js/audio-core.js`：渲染创作信息值时，对长度 > 30 且包含 `/` `,` `、` 分隔符的值进行拆分，把每个名字/片段包成 `<span class="lrc-credits-name">`；分隔符包成 `<span class="lrc-credits-sep">` 并跟随前一项。
  2. `css/base-layout.css`：新增 `.lrc-credits-name`（`display:inline-block; word-break:keep-all; overflow-wrap:anywhere; max-width:100%`）与 `.lrc-credits-sep` 规则，使每个名字作为独立换行单元，强制在分隔符处换行，同时保持单个名字完整。
- **涉及文件**：`js/audio-core.js`、`css/base-layout.css`
- **说明**：短值（≤30 字符）或无分隔符值保持原样；极长单名仍由父级 `.lrc-credits-val` 的 `word-break:break-all` 兜底。

### 🐛 歌词-创作信息分隔符错位修复（紧贴前一项）

- **症状**（首次实现后用户截图反馈）：名单渲染出现预期之外的分隔符——前两个人名之间没有 `/`（如 `Edwin PerezTeddy Mendez…`），而最后一个名字后面却多出 `/`（…`Lumidee Cedeno/`）；并出现孤立的 `/` 元素。
- **根因**：首版 `formatCreditValue` 把分隔符错误地挂在了**后一个名字**的末尾（循环中先判断 `p` 是否为分隔符、再拼当前名字时把 `pendingSep` 附加到当前名字之后），导致：
  1. 第一个名字前没有来自「上一个」的分隔符 → 前两个名字粘连；
  2. 最后的名字仍携带 `pendingSep` → 末尾多余 `/`；
  3. 分隔符被当作独立 `.lrc-credits-name` 处理 → 出现游离 `/`。
- **修复**：重写 `formatCreditValue`——先用 `val.split(/\s*[/,，、]\s*/)` 取出名字数组、用 `val.match(/\s*[/,，、]\s*/g)` 单独取出分隔符数组，再循环：分隔符仅紧跟**前一项**名字，且只有 `i < names.length - 1` 时才附加（末项不再加）。彻底消除粘连与末尾多余分隔符。
- **涉及文件**：`js/audio-core.js`（仅 `formatCreditValue` 函数）
- **说明**：属「创作信息强制换行」的回归修复，功能逻辑未变；刷新即生效，未升版本。

### 🎵 歌词-创作信息：非标准值强制换行（优先宽度稳定）

- **问题**：用户截图反馈某些创作信息值并非干净名单，而是包含括号、连接符、`&`、混合格式等长文本（如 `It Won't Stop (Manila Killa & Hunt For the Breeze Remix) - Manila Killa/Sevyn Streeter...`），仍被当作标准名单包成 `.lrc-credits-name`，导致长片段无法断字、撑破歌词栏。
- **修复**：在 `js/audio-core.js` 的 `formatCreditValue` 中新增非标准判定：若值长度 > 30 且包含 `()`、`[]`、`{}`、`&`、`-`/`–`/`—`、`:`、`;`、`"`、`'` 等任一字符，视为非标准创作信息，**直接返回转义原文**，由父级 `.lrc-credits-val` 的 `word-break: break-all` 在任意字符处强制换行，**不再保持姓名完整性**。
- **涉及文件**：`js/audio-core.js`
- **说明**：标准名单（仅 `/` `,` `、` 分隔的名字列表）仍保持之前的按名字完整换行；非标准文本一切以宽度稳定优先。刷新即生效，未升版本。

### ✒️ 字体设置新增「保留英文字体」开关

- **新增** `cfg.oppoKeepEnglish`（默认关闭）：启用 OPPO Sans 后，额外控制英文字体是否保留 CDN 字体（Geist）。
- **实现**：
  1. `js/globals.js` 新增 `cfg.oppoKeepEnglish: false`。
  2. `js/utils.js` 持久化/加载。
  3. `index.html` 在 OPPO Sans 抽屉内新增「保留英文字体」开关（`oppoKeepEnglishToggle`），仅在启用 OPPO Sans 时可见。
  4. `js/ui-core.js`：`applyOppoSans()` 在开启保留英文时使用 `font-family: 'Geist', 'OPPO Sans 3.X', ...`，让 Geist 优先渲染拉丁字符、OPPO Sans 作为 CJK 回退；`updateSettingsUI()` 同步开关显隐与状态；新增 `oppoKeepEnglishToggle` change 事件。
- **涉及文件**：`index.html`、`js/globals.js`、`js/utils.js`、`js/ui-core.js`
- **说明**：关闭（默认）：OPPO Sans 替换全部字体（英文字体也变 OPPO Sans）。开启：英文字保留 Geist 等 CDN 字体渲染，仅中文字体替换为 OPPO Sans。

### 🔧 首歌封面自动重载无效 — 根因修复 + 加固

- **症状**：「v3.5.1 首版实现」自动重载无任何效果，首歌封面依然不显现。
- **根因**：
  1. **索引错误（主要）**：`processFiles` 以 shuffle 模式自动播放随机歌曲（`Math.floor(Math.random() * playlist.length)`），但 `reloadFirstSongCover` 硬编码固定使用 `playlist[0]`，且守卫 `if (currentIndex > 0) return` 在随机索引非 0 时直接退出，造成**每次调度均无操作**。
  2. **reflow 缺失**：对 data: URL 直接 `src = ''; src = song.art` 两次赋值在同一微任务内执行，浏览器会合并为最后一次赋值，无法触发重新解码。
- **修复**（`js/audio-core.js` + `js/app.js`）：
  - 函数签名改为 `reloadFirstSongCover(firstIdx)`，在 `initApp` 调用处先用闭包捕获 `currentIndex`（`const firstIdx = currentIndex`），传递给函数。
  - 中间守卫 `const sameSongStillPlaying = () => currentIndex === firstIdx` — 每次异步操作（await）后重新检查用户是否已切歌，切了则提前 return，避免覆盖。
  - 强制重载：先清空 → `void el.mainArt.offsetWidth`（强制 reflow）→ 再赋旧值，确保浏览器重新解码展示。
  - 封面数据 `song.art` 为空时（jsmediatags 超时）的 fallback：尝试从 DOM `<img>` 的 `src` 逆采样取色（若有有效 data URL）。
  - `initApp` 处增加 `currentIndex >= 0` 守卫。
- **涉及文件**：`js/audio-core.js`、`js/app.js`

### 🔧 封面重载生效但「取色」未重载 — 函数完全缺失 + 缓存绕过（v3.5.3 追加修复）

- **症状**：重载后专辑封面已正常显示，但主题色 / 沉浸背景取色仍为旧值（空白或错误），未同步刷新。
- **根因**：
  1. **函数完全丢失**：前几轮编辑对 `js/audio-core.js` 的 `replace_in_file` 虽返回成功，但 `reloadFirstSongCover` 函数并未实际写入到磁盘文件中。`app.js` 中 `typeof reloadFirstSongCover === 'function'` 为 `false`，导致 3 秒延迟重载**从未被调度**。这是「取色未重载」的根本原因。
  2. 即使函数存在，`getAlbumColors(song)` 按文件指纹缓存取色结果（`_albumColorCache`），需 `force=true` 绕过。
- **修复**：
  1. 重新将 `reloadFirstSongCover` 插入 `playAudio` 结束 `};` 与 `_syncPlayIcon` 之间（`js/audio-core.js`）。
  2. `getAlbumColors` 增加 `force` 参数（`js/globals.js`），`force=true` 时跳过缓存重新解码取色并刷新缓存。
  3. `reloadFirstSongCover` 主路径与 fallback 路径均使用 `getAlbumColors(song, true)`，保证重载时取色与封面同步刷新。
- **状态**：代码修复已落地（`force=true` 绕过缓存 + 主/fallback 双路径取色）。用户反馈「现在这样也没啥大问题，封面重载已经实现了即可」，故取色是否在重载时实际同步生效暂未进一步验证，搁置。
- **涉及文件**：`js/audio-core.js`、`js/globals.js`

### 🔊 均衡器提升后失真 — 缺补偿增益 + 末端削波（v3.5.3）

- **症状**：音质很好的 FLAC 加上 EQ（尤其用 rock/bass 等提升预设）后，部分音频刺耳/发破，像是失真。
- **根因**：
  1. **无任何余量/补偿增益**：10 个 `peaking` 滤波器级联，增益相乘叠加；提升预设使某些频段合成幅度超过 0 dBFS，Web Audio 在 `destination` 处把信号硬性钳制到 `[-1,1]` → **硬削波**，在高码率母带上尤为刺耳。
  2. **首/末频段也用 `peaking`**：32Hz 处 `peaking`+`Q=1.0` 产生极宽共振瓣，与 64Hz 重叠堆叠，低频额外染色。
  3. **Q 全频段统一 1.0**：低频段过窄重叠，造成波纹与相位互调失真。
- **修复**：
  1. `js/globals.js` 新增末端节点 `eqMakeup`。
  2. `initEQ`（`js/audio-core.js`）：新增 `eqMakeup` GainNode 串在级联末端；频段 0 改 `lowshelf`、频段 9 改 `highshelf`；低频段（`i<=1`）`Q` 降至 0.7。
  3. 新增 `updateEQMakeup()`：用各滤波器 `getFrequencyResponse` 在 20Hz–20kHz 对数取 600 点，级联幅值相乘取最大 dB，仅做衰减（留 0.3dB 余量，绝不主动提升），精确补偿余量防止削波。`initEQ`/`setEQBand`/`setEQPreset` 均调用。
- **效果**：提升 EQ 后不再硬性削波，整体听感更干净；补偿仅按需衰减，不损失原始动态。
- **涉及文件**：`js/audio-core.js`、`js/globals.js`





### 🗂️ 曲库·按专辑新增「按艺术家」排序（coverflow 分组）

- **需求**：在「按专辑」下新增一个排序选项，排序内容仍是专辑卡，但同艺术家的专辑相邻成段，艺术家之间、以及同艺术家内的专辑都按首字母（locale）排序，沿用 coverflow 布局。
- **实现**：
  1. `js/ui-core.js` 新增子排序状态 `coverLibAlbumSort`（`default` / `artist`，仅 album 模式生效）。
  2. `js/cover-lib.js` 新增 `buildAlbumEntriesByArtist()`：与 `buildAlbumEntries` 同构（按「专辑+艺术家」身份分组，防止无封面专辑被误并），再用 `Intl.Collator('zh',{numeric:true})` 先按 artist、再按 album 首字母（中文按拼音、英文按 A–Z）排序。
  3. `renderCoverLibGrid` 的 album 分支按 `coverLibAlbumSort` 选择构建函数与独立缓存键 `albumByArtist`；新增排序条 `#clAlbumSortbar`，仅在 album 模式显示并同步 active 态。
  4. 视觉：`#clArtistIndicator` 浮动标签随 coverflow 居中卡切换显示当前艺术家（同艺术家专辑相邻 → 标签自然成段）；卡片仍由 `createCoverCard` 的 `artist · N首` meta 体现归属。
- **涉及文件**：`index.html`、`css/cover-lib.css`、`js/cover-lib.js`、`js/ui-core.js`
- **说明**：默认排序维持原「歌曲数降序」不变；仅新增的「按艺术家」选项走首字母分组。刷新即生效，未升版本。

### 🐛 曲库 coverflow 偶现前缀重复渲染（前 12 张重复）

- **症状**：曲库 → 按专辑 → 默认排序，偶发前若干张专辑被重复挂载一次（典型为前 12 张重复，第 25 张才是真正的第 13 张），偶现非必现。
- **根因**：`renderCoverLibMore()` 的分块循环在**整个循环跑完**前 `_clRendered` 一直为 `0`；而初始渲染期间 `updateCoverflow()` 每次 chunk 后都会 `grid.scrollTo(...)` 触发滚动事件，滚动监听 `_clScrollHandler` 又直接调用 `renderCoverLibMore(CL_INCREMENT)`。两个并行循环都从 `i = _clRendered = 0` 起挂 → 前缀重复。重复数量随时机波动（偶现），数量恰好等于 `CL_CHUNK = 12`（每帧子块）。
- **修复**：
  1. 新增 `_clRendering`（飞行中标志）与 `_clPendingTarget`（累积渲染目标量）。飞行中收到追加请求只扩大目标量、不再起并行循环。
  2. `_clRendered` 改为**每 chunk 增量提交**（`_clRendered = i`），任何重入调用读到的起点都是已挂载位置，绝不会从 0 重挂。
  3. 循环结束后再按 `_clPendingTarget` 续挂（滚动预加载不丢失）；`windowedRender` 入口重置两标志，避免被中止的旧循环残留。
- **涉及文件**：`js/cover-lib.js`
- **验证**：`node --check` 通过、`read_lints` 0 错误、`node build.js` 通过；dist 校验 `_clRendering` / `_clPendingTarget` 已注入。

### 📝 创作信息英文复合角色被拆成两行（EN_ROLES 排序问题）

- **症状**：`Background Vocals` / `Drum Programming` / `Vocal Arrangement` / `Digital Editing` / `Recording Engineers` / `Mix Engineer` 等复合英文标签被拆成两个独立条目（如 `Background` + `Vocals:`）。
- **根因**：`EN_ROLES` 中短词条（如 `Drum`）在长词条（如 `Drum Programming`）前面，正则引擎按 `|` 从左到右尝试匹配，`Drum` 先命中，`[：:\\s]` 把空格消费掉，导致 `Programming：` 被当作值。
- **修复**：`EN_ROLES` 按词条长度从长到短排序（`Recording Engineers` → `Drum Programming` → `Background Vocals` → ... → `Mix`），确保长词条优先匹配。
- **涉及文件**：`js/audio-core.js`

### 📝 括号列表被误当作独立 credits 条目（looksLikeNameList + Phase 6 过滤）

- **症状**：`("hitman" bang/...)` 等括号包裹的作者总列表被当作无标签的独立创作信息条目显示。
- **根因**：`looksLikeNameList` 对 `(` 开头的检查过于宽松（任何 `(` 开头都返回 true），导致 `isMetadata` 将其误判为 metadata；Phase 6 未过滤，直接 push 到 credits 显示为孤儿条目。
- **修复**：
  1. `looksLikeNameList`：括号开头需同时满足长度>60 且含多个 `/` 分隔符才判定为名字列表。
  2. Phase 6：添加 `!looksLikeNameList` 过滤条件，名字列表行不进入 credits。
- **涉及文件**：`js/audio-core.js`

### 📝 Written by 出版信息被误拆（formatCreditValue 括号保护）

- **症状**：`Written by` 的值（如 `Martin Kierszenbaum (Universal/MCA Music Limited (BMI))`）被按 `/` 拆分，导致出版信息括号内的 `/` 被当作分隔符，名字与出版信息断裂。
- **根因**：`formatCreditValue` 的 `NON_STANDARD_CREDIT` 检查含括号即直接返回不拆分，但 CSS `word-break: break-all` 仍会导致长文本在 `/` 后自动换行；且若值含 `/` 分隔符但不含括号，出版信息会被按 `/` 拆分。
- **修复**：
  1. `NON_STANDARD_CREDIT` 检查：含括号但仍有 `/` 分隔符时仍拆分（不再直接返回）。
  2. 拆分前保护括号内内容：` {index} ` 替换括号块，拆分后恢复，确保 `Universal/MCA` 等出版信息不被误拆。
- **涉及文件**：`js/audio-core.js`

### 📝 创作信息「Vocals by 之后全部丢失」— EN_ROLES 缺词 + Phase 6 名单误删（v3.5.3）

- **症状**：部分 LRC（如 `I Don't Wanna Go`）从 `Vocals by：Julie Bergan` 及之后（Drums / Guitar / Executive Producer / Mastered by / Mixed by / Programmed by / Recorded at / Repertoire Owner 等）整段不出现在创作信息里。
- **根因**：
  1. **EN_ROLES 缺词**：`Vocals` / `Published by` / `Programmed by` / `Guitar` / `Drums` / `Executive Producer` / `Recorded at` / `Repertoire Owner` / `Vocals Produced by` 等英文角色未纳入 `EN_ROLES`，`isCredit` 无法识别。Phase 5 的 `lyricStart` 在第一个未识别行（`Vocals by`，00:02.61）处截止，其后所有 credits 被划入「歌词区」丢弃。
  2. **Phase 6 名单误删**：`Published by：A/B/C…` 这类既是创作信息又「像名单」的行，被 `!looksLikeNameList` 过滤条件误删。
- **修复**：
  1. `EN_ROLES` 补齐缺失角色（按长度从长到短排序，避免 `Drum` 截断 `Drum Programming`）：新增 `Vocals` / `Published` / `Programmed` / `Guitar` / `Drums` / `Executive Producer` / `Recorded at` / `Repertoire Owner` / `Vocals Produced`。
  2. Phase 6 优先级修正：用 `inCredits(t) = !isCopyright && !isTitle && (!looksLikeNameList(t) || isCredit(t))` —— 既是创作信息又像名单时保留为 credits，不被名单过滤误删。
- **验证**：`_test_credits.js` 模拟解析，`lyricStart` 正确落在真实歌词行（00:15.97 的 `So here we are…`），16 条 credits（含 `Vocals by` 及之后全部）均正确纳入；`read_lints` 0 错误。
- **涉及文件**：`js/audio-core.js`

### 📝 创作信息值开头多出冒号 — Phase 6b valueAfter 未处理双冒号（v3.5.3）

- **症状**：创作信息（如「作词」）的值以冒号开头显示（`: Fadil El Ghoul/…`），标签和值之间多出意料之外的冒号。
- **根因**：`Phase 6b` 的 `CREDIT_PAT`（单角色匹配）取值时，`raw.slice(singleMatch[0].length)` 在原始文本为 `作词：: Fadil…`（双冒号，中文 `：` + 英文 `:`）的情况下，`valueAfter` 保留开头的 `:`。同样的漏洞存在于 `multiMatch` / `enMatch` / `OA_OC_PAT` 三条路径。
- **修复**：`Phase 6b` 中定义 `trimLeadingColon = (s) => s.replace(/^[:：]+/, '')`，在四条 `valueAfter` 计算后统一调用，去掉值开头的冒号。
- **涉及文件**：`js/audio-core.js`

### 🆕 版本号更新
- 本版为行为补丁，版本号定为 `v3.5.4`（淡变功能前全部更新）；源码改动刷新即生效，部署 PWA 需 `node build.js` 重建 `dist/`。

---

## v3.5.2 (2026-07-07) — v3.5.1 patch 3

### 🩹 线上构建「整个播放器界面被压成标题条」紧急修复

- **问题**：构建部署后 `dist/style.min.css` 中 `.player-wrapper` 被错误赋予了 `height:50px;font-size:18px;border-color:rgba(255,107,107,.3)` 等按钮属性，导致主界面播放器被压成一条窄带，内容区完全不可见；同时进度条 `.prog-fill` 也消失。
- **根因**：`css/base-layout.css` 中 `.player-wrapper` 规则缺少闭合大括号 `}`。该规则从 `.player-wrapper {` 一直延续到 `.btn-fav-ctrl` / `.btn-pip-ctrl` 及媒体查询之后，导致这些按钮规则被嵌套在 `.player-wrapper` 块内部。`clean-css` 压缩后，`.player-wrapper` 合并了本应属于按钮的 `height:50px` 等属性。
- **修复**：
  1. 在 `css/base-layout.css` `.player-wrapper` 属性声明后补全闭合 `}`，使 `.btn-fav-ctrl` / `.btn-pip-ctrl` / 媒体查询回到顶层。
  2. `build.js` 修正 `CSS_FILES` 顺序为 `style.css → variables.css → base-layout.css → immersive.css → modals.css → components.css → cover-lib.css → wco.css`，与原始 HTML 一致。
  3. 清理 `css/style.css` 中与 `base-layout.css` 完全重复的进度条区块，消除 `clean-css` 合并时 `.prog-fill` 属性被拆散的隐患。
- **涉及文件**：`css/base-layout.css`、`build.js`、`css/style.css`。需 `node build.js` 重建 `dist/`。

### 🎛️ 设置-外观新增：标题栏伪沉浸开关

- **需求**：把 PWA 标题栏顶部取色（假沉浸）做成用户可选项，关闭后标题栏颜色不再跟随封面/背景顶部，改用常规主题色。
- **实现**：
  1. 新增配置项 `cfg.wcoPseudoImmersive: true`（默认开启，保持原行为），在 `js/utils.js` 中持久化/恢复。
  2. `js/theme-color.js` `_applyColor()` 中仅当 `cfg.wcoPseudoImmersive !== false` 且非深色模式时才使用 `_topColor`（顶部取色）。
  3. `index.html` 设置-外观「沉浸式外观」抽屉新增「标题栏伪沉浸」toggle-switch（图标 `#icon-layers`）。
  4. `js/ui-core.js`：`updateSettingsUI()` 同步开关状态；新增 `wcoPseudoImmersiveToggle` change 事件，切换后立即调用 `ThemeColor.refresh()` 刷新标题栏颜色并 `saveSettings()`。
  5. PWA 专属检测：该开关容器在非 PWA（普通浏览器标签页）下默认隐藏，仅在 `window.matchMedia('(display-mode: standalone)')` 或 `navigator.standalone` 为真时通过 `display:flex` 显示。
- **涉及文件**：`js/globals.js`、`js/utils.js`、`js/theme-color.js`、`index.html`、`js/ui-core.js`

### 🆕 版本号更新
- `v3.5.1` → `v3.5.2`
- 更新位置：`index.html`（标题 + 页脚版权）、`package.json`、`sw.js`、`build.js`（SW 缓存键 `mbolka-v3.5.1`→`mbolka-v3.5.2`）

---

## v3.5.1 (2026-07-07)

### 🩹 标题栏顶部取色回归修复 + build.js CSS 顺序修复（进度条消失）

### 🔧 build.js CSS 顺序 + 重复规则清理导致「线上构建主页面/沉浸舱进度条不显示进度」
- **问题**：构建部署后 `dist/style.min.css` 中进度条 `.prog-fill` 不显示进度填充，本地开发正常。
- **根因**：`build.js` 的 `CSS_FILES` 顺序与原始 HTML 不一致，且 `style.css` 与 `base-layout.css` 存在大量重复的进度条/布局规则。`clean-css` 合并时两个 `.prog-fill` 基类互相干扰，导致构建产物中关键属性（`width:100%`、`transform:scaleX(0)`、`transform-origin:left`）被拆散或覆盖，最终进度条宽度为 0 且缩放出错。
- **修复**：
  1. `build.js` `CSS_FILES` 顺序修正为 `style.css → variables.css → base-layout.css → immersive.css → modals.css → components.css → cover-lib.css → wco.css`，与 HTML 加载顺序完全一致。
  2. `css/style.css` 删除与 `base-layout.css` 完全重复的进度条区块（`.progress-area` / `.prog-bg` / `.prog-fill` 基类 / `.prog-fill::after` / `.progress-area:hover .prog-fill::after` / `.time-labels`），消除重复定义隐患。`base-layout.css` 保留唯一权威的进度条规则。
- **涉及文件**：`build.js`、`css/style.css`。需 `node build.js` 重建 `dist/`。

### 🩹 标题栏顶部取色回归修复

- **问题**：开启「跟随强调色」后，标题栏 <code>meta theme-color</code> 未按预期显示专辑封面顶部颜色，而是始终显示玫瑰金默认粉色。
- **根因**（`js/ui-core.js` `applyThemeLogic()` ~L1169）：当 `cfg.followAccentColor` 开启时，背景走流沙 Canvas（`showColor`）分支而非背景图片（`showImg`）分支。该分支原无条件调用 `ThemeColor.updateTopColor(null)`，**覆盖**了 `js/audio-core.js` `loadSong()` 中从专辑封面提取并设置的顶部取色（流程：`extractTopColor()`→`ThemeColor.updateTopColor(topColor)`→`applyThemeLogic()`→`updateTopColor(null)` 清空）。
- **修复**：删除 `showColor` 分支中的 `ThemeColor.updateTopColor(null)` 调用。顶部取色由 `audio-core.js` 统一管理，无需在 `applyThemeLogic()` 中干预。
- **涉及文件**：`js/ui-core.js`

### 🎨 歌词栏动画精修 + 创作信息正则补全

- **动画更灵动（`css/base-layout.css` + `css/style.css`）**：
  - 激活行 `transform: scale(1.05) translateY(-3px)` 微抬升，营造「弹出」感。
  - 新增 `@keyframes lrcGlowPulse` 呼吸辉光动画：text-shadow 在 3s 内循环明暗脉动，跟随主题色 `rgba(var(--primary-rgb), …)`，解决「辉光静态呆板」问题。
  - `transform` 过渡曲线改为 `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹簧曲线（过冲后回弹），非线性灵动感。
  - hover 状态加 `transform: scale(0.97)` 微放大反馈，悬停不再只是去模糊。
- **hover 颜色回滚**：水母蓝 `rgba(154,200,226,0.8)` 被用户反馈「太丑」，改回 `rgba(255,255,255,0.8)` 白色。
- **创作信息正则补全（`js/audio-core.js`）**：从用户截图补充 7 个缺失角色标识到 `CREDIT_PAT` 与 `CREDIT_MULTI_PAT`：
  - `弦乐编写` / `弦乐监制` — 弦乐编排相关
  - `主唱录音` / `弦乐录音` — 录音细分角色
  - `音乐编辑` — 与已有 `音频编辑` 区分
  - `制作统筹` — 与已有 `音乐统筹` 区分
  - `混音母带` — 与已有 `混音及母带后期` 区分

### 🆕 版本号更新
- `v3.5.0` → `v3.5.1`
- 更新位置：`index.html`（标题 + 页脚版权）、`package.json`、`sw.js`、`build.js`（SW 缓存键 `mbolka-v3.5.0`→`mbolka-v3.5.1`）

---

## v3.5.0 (2026-07-07)

### ⚡ 性能与可维护性优化（P0 + P1 全量落地）

> 第一轮落地 P0-1 / P1-1 / P1-4（S–M、零风险）；第二轮（本次）补齐 P0 全部 + P1 全部：coverflow 增量渲染、播放列表搜索防抖、cachedCenters 消除 layout、大列表分块加载、元数据 Web Worker 解析、图标 refactor 收尾。

#### 🔴 P0-1a｜曲库搜索输入防抖
- **`js/cover-lib.js`**：`#coverLibSearch` 的 `input` 改为 180ms 防抖，连续击键只触发一次全量重渲染，大库下输入卡顿显著下降。

#### 🔴 P0-1b｜播放列表搜索输入防抖
- **`js/app.js`**：`#searchInput` 的 `input` 同样改为 180ms 防抖（原每键入一次即 `searchPlaylist()` 全量过滤+重渲染），与曲库搜索保持一致的响应体验。

#### 🔴 P0-2｜coverflow 居中切换增量更新
- **`js/cover-lib.js`** `updateCoverflow()`：每张卡片缓存 `dataset.flowOff`（距中心偏移），仅在偏移变化时写入 `style.transform`/`opacity`/`filter`/`zIndex`/`classList`，避免全量样式写入。滚动目标用 `_cachedCardCenters[coverLibCenter] - grid.clientWidth/2` 代替 `center.offsetLeft` 读取，消除同步布局。
- 中心卡片 `blur()` 仅在中心偏移时才写入（非中心卡 blur 固定值）。

#### 🔴 P0-3｜松手重算 `cachedCenters` 避免 layout 读取
- **`js/cover-lib.js`**：新增 `_cachedCardCenters[]` 数组，在 `updateCoverflow()` 和 `onCoverflowScroll()` 中惰性计算/重建。`onCoverflowScroll()` 松手定位最近居中卡片时从缓存数组比对，不再每张卡片读 `offsetLeft + offsetWidth/2`（消除全量同步布局读取）。

#### 🟡 P1-1｜`saveSettings` 节流落盘
- **`js/utils.js`**：原 `saveSettings()` 每次调用都同步写 `localStorage`（滑块 `oninput`、连续切换等高频场景会每帧落盘）。现拆分为 `saveSettingsNow()`（实际写入）+ 节流包装 `saveSettings()`：首次调用立即落盘（关键变更不丢），节流窗口（400ms）内的后续调用合并为一次末尾写入。
- 新增 `flushSettings()`，在 `visibilitychange`（页面隐藏）/ `pagehide`（卸载）时强制刷盘，避免节流窗口内的末次变更丢失。
- 全部 37 处 `saveSettings()` 调用方无需改动即自动受益。

#### 🟡 P1-2｜大播放列表分块渲染
- **`js/loader.js`** `renderPlaylist()`：重构为分块渲染模式。抽取 `_createPlItem(s, i)` 工厂函数（消除与 `searchPlaylist()` 的 DOM 构建重复）。
- 前 200 首同步挂载（立即可见），后续条目通过 `requestAnimationFrame` 分 100 首/批追加，避免大库（1000+）一次性全量 DOM 构建阻塞主线程。拖拽排序事件委托不受分块影响。

#### 🟡 P1-3｜元数据 Web Worker 解析
- **新增 `js/meta-worker.js`**：`importScripts` 加载 jsmediatags CDN，在后台线程中解析音乐文件标签（title/artist/album/lyrics/cover art base64）。
- **`js/loader.js`** `parseMetadata()`：惰性创建 Worker 实例（`_initMetaWorker()`，仅在线/localhost 生效，`file://` 协议安全跳过），发送 `{key, file}` 到 Worker，8 秒超时→回退到内联 `_parseInline()` 解析。
- Worker 不可达（协议限制/创建失败）时自动降级到原有内联路径，零破坏。
- `cacheMetadata()` 仍由主线程执行（IDB 访问主线程更高效）。

#### 🟢 P1-4a｜统一图标切换 helper `setBtnIcon`
- **`js/utils.js`**：新增 `setBtnIcon(btn, name, label)`——优先切换按钮内 `<use href>`（不覆盖文字/内置图标），无 `<use>` 时整段替换为 SVG（可带文字 label）。
- **`js/audio-core.js`**：`#btnPlay` / `#imm-btnPlay` 的播放/暂停图标切换（`_syncPlayIcon`）改用 `setBtnIcon`，高频图标热切换统一走此 helper。

#### 🟢 P1-4b｜统一图标 + 文案 helper `setBtnText`
- **`js/utils.js`**：新增 `setBtnText(btn, iconName, text)`，集中 `iconSvg + 文案` 的 innerHTML 模板。
- **`js/ui-core.js`**：音调按钮（`btnTogglePitch`）与淡入淡出按钮（`btnToggleCrossfade`）的 icon+文案 切换改用 `setBtnText`。
- **`js/audio-core.js`**：`togglePitchPreserve()` 内音调按钮改用 `setBtnText`。
- **`js/pip.js`**：画中画播放/暂停图标改用 `setBtnIcon`。
- 后续改文案只动一处（`setBtnText`），重复模板归零。

### 🆕 版本号更新
- `v3.4.4` → `v3.5.0`
- 更新位置：`index.html`（标题 + 页脚版权），`README.md`（标题 + 徽章 + 页脚），`.dev-docs/prompt-by-qclaw/代码功能指导文档.md`（版本头 + 尾 + §8 迭代表）

### 🎨 设置-外观新增：跟随强调色 + 背景沉浸

- **需求**：在设置弹窗「外观」标签页中提供两个可选项，让用户精细控制界面的颜色跟随行为与背景沉浸程度。
- **实现**：
  1. **跟随强调色**（`cfg.followAccentColor`）：开关位于外观→「沉浸式外观」区块。开启时，主题强调色（`--primary` 及所有衍生色）跟随当前专辑封面提取的主色调，与「封面取色」同源驱动全域色彩体系；关闭时回落预设主题色。配置文件 `cfg.colorMode` 统一迁移为 `cfg.followAccentColor`，`loadSettings` 保留旧键兼容。
     - `js/globals.js`：`cfg.followAccentColor` 替换原 `colorMode`。
     - `js/utils.js`：`saveSettingsNow` 写入 `followAccentColor`，`loadSettings` 回读 `stored.followAccentColor ?? stored.colorMode`。
     - `js/ui-core.js`：`updateSettingsUI` 同步开关状态；`toggleColorMode()` 与 `followAccentToggle` 均操控 `cfg.followAccentColor`；`toggleDarkMode` 调用 `applyBgImmersive` 重算遮罩。
     - `js/visualizer.js`：4 处 `cfg.colorMode` 统一替换为 `cfg.followAccentColor`。
  2. **背景沉浸**（`cfg.bgImmersive`）：开关位于外观→「沉浸式外观」区块。开启时，专辑封面或自定义背景以全屏形式呈现于玻璃播放器背后，播放器面板透明度降低（`background: rgba(20,17,30,0.28)`，backdrop-filter 强度降至 60%），让背景更通透、沉浸感更强。
  3. **夜间模式遮罩叠加计算**（关键）：背景沉浸开启时，页面添加 `#bg-immersive-scrim` 固定遮罩层（`z-index: -9`，位于背景层之上、视图容器之下），其透明度由 `--bg-scrim-alpha` CSS 变量驱动。`applyBgImmersive()` 采用**分层 alpha-over 合成公式**：
     ```
     finalAlpha = 1 - (1 - baseScrim) * (1 - darkScrim)
     ```
     - `baseScrim = 0.38`：沉浸基础遮罩，确保专辑封面/自定义背景高亮部分不影响 UI 可读性。
     - `darkScrim = 0.45`：夜间模式（`cfg.darkMode`）开启时额外叠加的半透明黑遮罩。
     - 两者同时存在时不会简单相加溢出，而是正确加深却不丢失背景层次。
  4. **相关文件**：`index.html`（新增 `#bg-immersive-scrim` 元素 + 两个 toggle-switch 放入外观标签页「沉浸式外观」区块）、`css/style.css` / `css/base-layout.css`（scrim 样式 + `.bg-immersive .player-wrapper` 半透明化 + 遮罩过渡动画）。

### 🪟 PWA WCO 假沉浸标题栏（Windows Chrome）

- **需求**：Windows Chrome 隐藏标题栏（PWA WCO 模式）时，右上金刚键（最小化/最大化/关闭）背景自动取页面顶部附近颜色，让系统窗口控制区与页面背景融合，达成「假沉浸」效果。
- **实现**：
  1. `js/utils.js` 新增 `extractTopColor(imgSrc, sampleHeight)`：从当前背景图片（专辑封面或自定义背景）顶部区域采样平均颜色，作为 WCO 标题栏沉浸色。
  2. `js/theme-color.js` 扩展 `ThemeColor`：新增 `updateTopColor()`，优先级为 **顶部取色 > 深色模式 > 专辑平均色 > 默认色**。最终颜色写入 `<meta name="theme-color">`，Windows Chrome 用其渲染右侧系统金刚键背景；同时暴露 `--wco-theme-color` CSS 变量供自绘标题栏使用。
  3. `js/audio-core.js` 切歌时同步提取 `currentAlbumTopColor` 并传给 `ThemeColor`。
  4. `js/ui-core.js` 自定义背景上传/清除时同步计算 `cfg.customBgTopColor`，并在 `applyThemeLogic()` 中根据当前显示的背景（自定义图 / 专辑图 / 流沙背景）更新 `ThemeColor`。
  5. `js/utils.js` 持久化/恢复 `cfg.customBgTopColor`。
  6. `css/wco.css` 左侧自绘标题栏默认保持透明，让页面顶部背景自然延伸；增加文字阴影保证曲目标题在复杂背景上可读。右侧系统金刚键背景由 `theme-color` 自动跟随顶部取色。
- **限制**：右侧金刚键区域只能由操作系统渲染为单一纯色，因此「取顶部附近颜色」本质是让系统色与页面顶部主色调一致，形成视觉上的假沉浸。若页面顶部为渐变或复杂纹理，仍只能取平均色近似。

### 🎨 歌词栏美学与结构修复（CSS 结构性 Bug + 视觉升级）

- **症状**：主界面歌词栏存在多项 CSS 问题：超长歌词行溢出无断词保护（`word-break`/`overflow-wrap` 失效）、歌词不可选中复制（`user-select: text` 丢失）、hover 文字颜色太冷（纯白 0.8）、激活行字号跳变过大（44%+）且与 `transform: scale(1.05)` 叠加造成布局抖动、下一句不模糊的视觉梯队丢失、`transition: all` 过度过渡影响性能。
- **根因（`css/base-layout.css`）**：`.lrc-line` 规则在第 207 行大括号**过早闭合** → `transform: scale(0.95)` / `word-wrap` / `overflow-wrap` / `word-break` / `white-space` / `padding: 0 10px` / `user-select: text` 等 7 条关键属性变成孤儿代码（第 215-222 行）被浏览器完全忽略。由于 `base-layout.css` 加载顺序在 `style.css` 之后并覆盖之，这些属性在**所有场景下均未生效**。同时 `base-layout.css` 缺少 `.lrc-line.active + .lrc-line` 规则（style.css 中存在但被覆盖丢失），下一句不模糊的视觉层级消失。
- **修复（`css/base-layout.css` + `css/style.css`）**：
  1. 将 7 条孤儿属性合并回 `.lrc-line` 规则内（关闭过早大括号），恢复断词/换行/缩放/选中等全部行为。
  2. 将 `.lrc-line` 的 `transition: all 0.6s …` 改为仅过渡 `color opacity transform filter` 四个具体属性（避免 `font-size` 等布局属性触发过渡）。
  3. 激活行字号从 `calc(var(--lrc-font-size) * 1.44)` 降为 `* 1.2`，消除 44% 跳变造成的布局抖动；`transform: scale(1.05)` + `font-weight: 700` + 辉光已足够区分。
  4. 激活行颜色从 `#fff` 改为 `rgba(255,248,240,0.95)` + 辉光换为 `rgba(var(--primary-rgb), …)` 跟随主题色。
  5. 恢复缺失的 `.lrc-line.active + .lrc-line` 规则（下一句不模糊 + opacity 0.75 + scale 0.98）。
  6. ~~hover 文字色从白冷光改为 `rgba(154,200,226,0.8)`（水母蓝）更温暖。~~（v3.5.1 已回滚为白色）
  7. 添加 `.lrc-viewport::-webkit-scrollbar` 薄型滚动条（4px 宽，12% 白 thumb），与玻璃态美学一致。
  8. 同步更新 `style.css` 中对应规则（保持两份 CSS 一致）。
  9. 同步更新 `.lyrics-align-top .lrc-line.active` 的激活色与辉光。
  10. 激活行 `transform` 使用弹簧曲线 `cubic-bezier(0.34, 1.56, 0.64, 1)` + `translateY(-3px)` 微抬升 + `lrcGlowPulse` 呼吸辉光动画（v3.5.1 补全）。

### 🩹 音量百分比显示同步修复

- **问题**：刷新页面后，音量滑块已正确恢复到上次记忆的音量（如 100%），但滑块右侧的百分比数字仍显示 HTML 默认的 `70%`。
- **根因**：`js/utils.js` `loadSettings()` 在恢复 `audio.volume` 后仅同步了 `volSlider` 的 `value`，未同步 `#volPercent` / `#immVolPercent` 的文本。
- **修复**：在 `loadSettings()` 初始化双端音量滑块后，同时设置 `volPercent.textContent = ${Math.round(audio.volume * 100)}%`（沉浸界面 `immVolPercent` 同补）。
- **涉及文件**：`js/utils.js`

### 🆕 版本号更新
- `v3.4.3` → `v3.5.0`
- 更新位置：`index.html`（标题 + 页脚版权 + 2 处注释）、13 个 JS 文件的版本头 + `globals.js` 副标题 + `loader.js` 文档标题、`package.json`、`sw.js`、`build.js`（SW 缓存键 `mbolka-v3.4.3`→`mbolka-v3.5.0`）

---

## v3.4.3 (2026-07-07)

### 🎮 手柄全流程静态修复

- **`js/gamepad.js` 键盘 `d` 深色模式切换失效**：`switch` 中 `d` 被声明两次（先命中 `coverLibNav('right')` 并 `break`，`toggleDarkMode()` 成死代码）。改为 `e.shiftKey ? toggleDarkMode() : coverLibNav('right')`——`Shift+D` 切深色模式，`d`/`→` 保留 coverflow 右导航。
- **`js/gamepad.js` 键盘 `u`/`f`(非 Shift) 收藏空操作**：`toggleFavorite()` 无参导致 `playlist[undefined]` 直接 `return`。改为 `toggleFavorite(currentIndex)`，收藏快捷键在任意曲目上即时生效。
- **`js/gamepad.js` 设置滑块焦点下中等幅度拨杆泄漏**：滑块聚焦时左右拨杆（0.2–0.5）仍触发 2D 导航离开滑块。引入 `_sliderFocused` 完全阻止左右导航，仅大角度拨杆做节流提示。
- **`js/gamepad.js` 手柄连接瞬间误触发**：`gamepadconnected` 时 `prevPadBtns=[]` 致首帧误触发所有"刚按下"动作。改为连接时用当前手柄状态初始化 `prevPadBtns`/`prevPadAxes`。
- **`js/gamepad.js` PiP 转发空引用**：转发 `pad.axes` 在 `getGamepads()[0]` 为 `null` 时抛错。加 `pad &&` 守卫避免崩溃。
- **`js/gamepad.js` Menu 键未推栈**：`btns[9]` 开设置未 `_pushModal`。补 `_pushModal('settingsModal', null)`，与体系内其它模态保持一致。
- **`js/gamepad.js` 设置滑块焦点「卡死」+ 关闭键向下跨段跳滑块（v3.4.3 焦点修复补遗）**：
  - **卡死根因**：v3.4.2 引入的 `_sliderFocused` 分支只拦截左右并提示按 A，**对上下完全不处理** → 手柄左摇杆在滑块上任何方向都挪不开（键盘方向键走 `moveFocus2D` 直连故正常，故仅手柄复现）。改为：上下仍可 `moveFocus2D` 离开滑块（自然退出），仅左右保留拦截+提示（避免误触离开滑块，调整值仍需先按 A 进微调模式）。
  - **关闭键→淡入淡出滑块跨段跳**：v3.4.3 把 2D 导航第二阶段带筛选改「横向锁同排 `|dy|`、纵向锁同列 `|dx|`」，但纵向用 `|dx|` 对齐带使「关闭键(右上)与深处 crossfadeSlider 同列」→ 向下直接跨到该滑块。统一回「横纵都按 `|dy|` 筛带」：横向=`|dy|` 仍为交叉轴对齐（保留 v3.4.3 主界面右移修复），纵向=`|dy|`=下行距离带 → 只在本段最近下行元素间选择，不再跨到同列深处滑块。`moveFocus2D` 键盘与左摇杆共用，一并修复。
- **`js/gamepad.js` 2D 焦点导航普遍修复（离轴元素抢焦点）**：主界面左摇杆向右，本应到同排「歌词」却先跳到下方「PiP」再右才到歌词。根因在 `moveFocus2D()` 第二阶段**带筛选用错了轴**——横向导航按 `minAbsDx`（前进轴最近距离）做带、纵向按 `minAbsDy`，导致「离轴但前进轴更近」的元素（如下方 PiP 比同排歌词水平更近）把真正同排目标排除掉。改为**按对齐轴筛带**：横向锁同排（`|dy|<=tol`）、纵向锁同列（`|dx|<=tol`），`tol=max(40, 对齐轴最近距*1.5)`；带内再由评分（交叉轴权重 2.5×）取前进轴最近者。键盘方向键与左摇杆均经 `moveFocus2D`，一并修复。
- **`js/gamepad.js` 手柄浮动指示统一补全（PiPⓋ / 帮助⑪）**：`injectGamepadHints()` 原缺失 PiP 按钮（`btnPipQuick`）与帮助按钮（`btnOpenHelpShortcuts`）的键位徽标，导致「看不到 PiP 的手柄键位指示」。新增 `Ⓥ View` / `⑪ R3` 徽标并补 `.pad-view`/`.pad-r3` 配色；PiP 小窗为后台窗口不响应手柄，故不在其内部注入徽标。
- **`js/gamepad.js` 手柄轮询与转发优化（省电/降开销）**：① 轮询 `pollGamepad` 未连接手柄时自动停转（`_pollRunning`），连接时由 `gamepadconnected` 重启，不再每帧空跑；② 转发 PiP 的 `gamepad-state` 由每帧全量（~60/s）节流到 ~30fps。
- **`js/gamepad.js` 导航健壮性微调**：① 右摇杆滚动列表时的自动吸附焦点，改为仅当当前焦点已滚出视口才触发，不再与左摇杆导航抢夺焦点；② 设置 Tab 切换后的焦点刷新由固定 `setTimeout(100)` 改为 `requestAnimationFrame` 等待面板重排；③ 清理 `getActiveScrollable` 不可达死分支、B 键冗余 `updateFocusContext`、`moveFocus2D` 死区提为常量 `FOCUS_DEAD_ZONE`、三处早退冗余 `prevPadBtns` 拷贝（统一由 `finally` 同步）。

### 🩹 主界面右上角「列表/歌词/曲库」按键指示不清修复（被键盘快捷键覆盖）

- **症状**：主界面右上角「列表 / 歌词 / 曲库」三个玻璃按钮接入手柄后显示的是键盘字母 `P`/`L`/`G` 而非手柄键位（被键盘快捷键覆盖），且手柄断连一次后字母永久消失。
- **根因**：`index.html` 内联了静态 `gamepad-badge pad-p/l/g`（键盘字母），`js/gamepad.js` 的 `injectGamepadHints()` 因 `querySelector('.gamepad-badge')` 已存在而守卫跳过，无法注入真正手柄映射 `←`/`RS↕`/`→`；`removeGamepadHints()` 又会一并删掉这些静态徽章。
- **修复**：移除三个按钮的静态键盘字母徽章；`css/components.css` 新增 `.gamepad-badge.pad-wide`（多字符圆角胶囊容纳 `RS↕`），并为 `.btn-glass` 补 `position: relative` 作为徽章定位上下文。`js/gamepad.js` 歌词按钮徽章加 `pad-wide` 类。连接手柄时三个按钮正确注入 `←`/`RS↕`/`→` 手柄映射徽章，仅在 `.gamepad-connected` 时出现，断连即移除。键盘快捷键 P/L/G 仍可在帮助面板查看，不再常驻显示。

### 🎨 沉浸舱取色背景实时跟随（视觉修复）

- **症状**：沉浸舱内切换歌曲/取色变化时，跟随专辑封面的取色背景不立即更新，**退出沉浸舱才立即更新**；返回主界面后流沙背景「卡顿一秒才显示」。
- **根因一（`js/visualizer.js`）**：跟随封面色相的流沙背景 `drawFlowingSand()`（由 `currentHue`←`currentAlbumColor` 驱动）**只在主界面分支（`!isImmersiveMode`）调用**；进入沉浸舱走 `isImmersiveMode` 分支后流沙画布不再重绘 → 封面色更新后画面冻结，`currentHue` 每帧都在过渡只是画布没重绘；退出走主界面分支才用已过渡好的新色相重绘，于是「退出才更新」。此外沉浸舱自身光晕背景（`#immersive-bg-canvas`）原本硬编码灰色 `rgba(30,30,40)`，根本不跟随封面色（与 changelog「沉浸模式背景跟随专辑取色」既定设计不符，疑似回归）。
- **根因二（PWA Service Worker 缓存）**：`sw.js` 用 `CacheFirst` 且 `CACHE_NAME` 写死 `'mbolka-v3.3.3'`，`install` 不重跑 → 已缓存旧 `js/visualizer.js` 被永久优先返回，源码改动在浏览器里不生效（导致「改了也没用/还有卡顿」）。`build.js` 生成的 `dist/sw.js` 同为 `CacheFirst` 写死 `v3.4.1`。
- **修复**：
  1. `js/visualizer.js`：① 沉浸舱分支内同步重绘流沙背景（关取色时清空画布，与主界面一致）；② 沉浸光晕背景改用 `hsla(currentHue,…)` 跟随封面色相，每帧平滑过渡、实时刷新；**仅取色模式开启时**跟随封面色相，关闭时回落原中性灰（与主页关取色一致，避免关取色出现彩虹自转）。
  2. `sw.js` + `build.js`：缓存策略改为 **Network-First（带缓存回退）**、缓存名升 `v3.4.3`，在线始终回源（源码改动刷新即生效），离线/失败回退缓存；仅缓存同源成功响应。
  3. `js/visualizer.js` + `js/ui-core.js`：退出沉浸舱时调用新增 `forceMainRedraw()` 强制主界面流沙下一帧重绘，消除「返回主界面流沙卡顿一秒才显示」。
- **SW 接管提示**：SW 改动后需让新 SW 接管（DevTools→Application→Service Workers 勾选 Update on reload 后刷新，或 Unregister 后刷新；普通刷新可能需两次）。之后 Network-First 下单次刷新即见最新源码。

### 🩹 主界面「进入沉浸舱」按钮 hover 频闪修复

- **症状**：主界面将光标悬停在「进入沉浸舱」频谱容器（`#btnEnterImmersive`）上时，按钮高亮/光标出现**频繁闪烁**，无法正常稳定显示 hover 态。
- **根因（`css/base-layout.css` / `css/style.css` + `js/visualizer.js`）**：`.vis-canvas-container` 基础态**无边框**，仅 `:hover` 时新增 `border: 1px solid`。由于 `#spectrumCanvasMain` 为 `width:100%;height:100%`（相对容器**内容盒**），而全局 `box-sizing: border-box` 下出现 1px 边框会使内容盒收缩 1px；叠加容器 `transition: 0.3s` 让边框宽度在 0→1px 间**逐帧动画过渡**，内容盒尺寸在 hover 期间持续变化 → 绑定在 canvas 上的 `ResizeObserver` 每帧触发 → `resizeMainCanvas()` 每帧重设 `canvas.width/height`（重置即清空画布）并强制重绘 → 频谱/高亮**逐帧重绘闪烁**。若边框收缩引发的布局位移使光标瞬间移出元素，还会丢失 `:hover` 反向触发，形成持续抖动循环。
- **修复**：基础态预留 `border: 1px solid transparent`，`:hover` 仅改 `border-color`（尺寸恒定不变）→ 内容盒不再因 hover 收缩 → `ResizeObserver` 不再每帧误触发 → 频闪消除。视觉 hover 效果（背景提亮 + 白色描边）完全保留。`css/base-layout.css` 与 `css/style.css` 两份相同规则同步修正。

### 📼 长音频(>15min)断点续播修复

- **需求**：音频时长 >15min 认定为长音频（播客/有声书），自动记录播放进度；下次播放（切歌/随机到）自动从进度点续播；进度落在最后 5 秒则记为 0，下次从头播放。
- **原逻辑失效（dead code）根因（`js/audio-core.js`）**：
  1. 恢复侧读取 `song.duration || song.file._duration`，但**播放列表项从未被赋值 `duration`/`_duration`** → `dur` 恒为 `0` → `dur > 900` 永远 false，**续播从未触发**。
  2. 即便 `dur` 有值，恢复时 `audio.currentTime` 在 `audio.src` 刚设置、元数据未就绪时赋值，会被浏览器重置为 0。
  3. 保存只在 `timeupdate` 每 10 秒一次，**暂停/切歌/自然结束不立即保存**；最后 5 秒未显式记 0（仅靠恢复时映射，未落到 10 秒窗口则丢失）。
- **修复（`js/audio-core.js`）**：
  1. 新增统一 helper `saveLongAudioProgress()` 与 `applyLongAudioResume(audioEl)`：键 `'MBolka_PlayPos_' + 文件名`（同文件跨会话稳定）。
  2. 续播改在 `audio.onloadedmetadata`（元数据就绪后）触发，此时 `currentTime` 才能可靠设置；使用 `audio.duration`（真实时长）判断 `>900`，不再依赖未赋值的 `song.duration`。
  3. 最后 5 秒统一判定：保存时 `t = currentTime >= dur-5 ? 0 : currentTime`；恢复时 `resume = saved.t > dur-5 ? 0 : saved.t`，两端一致，确保「最后 5 秒→下次从头」。
  4. 保存时机补全：① `timeupdate` 每 10 秒（节流）；② **暂停**（`togglePlay`）立即保存；③ **切歌/上一首**（`goNext`/`goPrev`）切换前保存；④ **自然结束**（`onended`）保存。覆盖「<10s 窗口即切走/暂停」边界，进度不再丢失。
- **覆盖范围**：手动切歌 / 随机到 / 上一首 / 暂停恢复 / 自然结束均生效（均走主 `audio` 槽的 `onloadedmetadata`）。注：交叉淡变进行中由 `cfAudioB` 槽自动续播的下一首不触发续播（属窄边界，未绑定 `cfAudioB` 以避免误写进度键）。

### 🪟 设置选项卡"变回单页下滑"实为 SW 缓存旧构建（非代码回归）

- **现象**：设置弹窗的选项卡区隔失效，所有分组（音频/外观/触觉/性能/高级）在同一页下滑显示。
- **核查结论**：源码（`index.html` 的 `settings-tab-bar`/`data-tab-group`/`settings-body`、`js/ui-core.js` 的 `initSettingsTabs()`、`css/modals.css` 的 `.settings-panel{display:none}`）与 `dist/bundle.min.js` **均完整包含且正确实现**标签页分离逻辑——不是代码回归。
- **真正根因**：Service Worker 把**旧的构建产物**一直喂给浏览器。部署用的 `dist/sw.js` 此前停留在 `v3.4.1` 的 `CacheFirst`，会**永久锁定**安装该 SW 时缓存的 `bundle.min.js`/`index.html`；若缓存版本与当前不一致（或缓存于 tabs 尚未就绪/不同步的时期），就表现为"单页下滑"。根 `sw.js` 虽已在前面改为 `v3.4.3` Network-First，但 `dist/` 目录本身从未重建，故部署态仍被旧 SW 钉死。
- **修复**：重新运行 `node build.js` 重建 `dist/`——`bundle.min.js`(162KB)、`style.min.css`、`index.html` 均从当前正确源码生成；生成的 `dist/sw.js` 现为 `v3.4.3` **Network-First** 且 `activate` 会清理旧缓存、`skipWaiting`+`clients.claim()` 立即接管。源码（根 `sw.js`）与部署（`dist/sw.js`）现已一致为 Network-First v3.4.3。
- **交付提示（关键）**：SW 仅在自身脚本内容变化时更新。部署新 `dist/` 后需让浏览器装上新版 SW：DevTools→Application→Service Workers 勾选 **Update on reload** 后刷新，或 **Unregister** 后刷新；普通刷新可能需两次（首次更新 SW、第二次拉新 bundle）。之后 Network-First 下单次刷新即见最新构建（含本版全部修复与设置选项卡）。

### 🆕 版本号更新
- v3.4.2 → v3.4.3

---

## v3.4.2 (2026-07-07)

### 🪟 PWA / WCO 标题栏修复（Windows Chrome）

#### 1｜WCO 标题栏完全窗口水平居中
- **`css/wco.css`**：`.wco-titlebar` 原用 `env(titlebar-area-x, 0)` + `env(titlebar-area-width)`，被 OS 安全区约束（自动避开右侧系统金刚键），`justify-content: center` 只居中受限盒子 → 标题贴左。
- 改为 `left: 0; width: 100vw` 撑满整窗，`.wco-drag-region` 用 `position: absolute` 铺满父级，`justify-content: center` 对整窗中线居中 → 标题完全水平居中；整窗可拖（`app-region: drag` 在 `.wco-drag-region` 上）。

#### 2｜修复取色模式下 OS 顶 bar 锁死紫色
- **`js/theme-color.js`**：v3.4.1 曾把 WCO active 时的 `<meta name="theme-color">` 写死为 `#180219`，导致 Windows Chrome 的 OS 沉浸顶 bar（其颜色 = `meta theme-color`）跟随定成紫色，封面取色模式失效。
- 修正：移除 WCO 写死分支，`meta theme-color` **始终跟随**封面色 / 主题默认色 / 深色模式（`_applyColor()` 优先级：封面色 > 深色模式 `#0e0c16` > `cfg.defaultColor` > 兜底紫 `#180219`）。
- **机制澄清**：MBolka 自绘 `.wco-titlebar` 永远 `display:none`，OS 接管整条标题区域，故 `meta theme-color` 即 OS 顶 bar 颜色，应随封面色实时沉浸（v3.4.1 的「隐藏固定 #180219」逻辑已废弃）。

#### 3｜清理失效死规则
- **`css/wco.css`**：移除 `body.wco-active .wco-titlebar { background: #180219 }`——`.wco-titlebar` 永远不参与渲染，该背景规则无意义。

#### 4｜设置-音频均衡器预设改为下拉式菜单（与触觉-映射模式一致）
- **`js/ui-core.js` `renderEQPanel()`**：原「8 个预设按钮」阵列改为 `custom-select-wrap` 自定义下拉（`.custom-select-trigger` + `.custom-select-dropdown` + `.custom-select-option`），与设置-触觉的「映射模式 / 节流间隔」下拉完全同构、同样式、同键盘/手柄交互（共用 `initCustomDropdownFor`）。
- 下拉值由 `EQ_PRESET_LABELS` 驱动（平直/流行/摇滚/古典/人声/重低音/电子/爵士），手动调节任一 EQ 频段滑块后预设下拉自动回落「自定义 (手动调节)」并取消 `selected` 态。
- 设置页按钮阵列密度下降，箭头 SVG 与主按钮一致，视觉统一。

#### 5｜手柄：设置滑块焦点下左右拨左摇杆 → toast 提示进入微调
- **`js/gamepad.js` `pollGamepad()` 左摇杆分支（设置浮窗 `else` 路径）**：当焦点停在设置页任意 `input[type=range]` 滑块、且未处于滑块微调模式时，检测到左摇杆左右拨动（`axes[0] < -0.5 || > 0.5`）即弹 toast「点击 Ⓐ 进入滑块微调（←→ 调整）」（节流 1.5s）。
- 同时阻止左右导航离开滑块，避免误触焦点漂移；按 A 进入 `sliderFineMode` 后方向键/左摇杆调整值、B 退出（既有微调逻辑复用）。

#### 6｜手柄右摇杆调音量联动主界面百分比数字
- **根因**：手柄右摇杆调音量走 `adjustVolume()` → `cfSetVolume()`，原只更新滑块 `value`，百分比 `#volPercent` 仅在 `volSlider.oninput` 里更新，手柄路径不经过 `oninput` → 数字不动。
- **`js/audio-core.js` `cfSetVolume()`**：把百分比同步逻辑移入 `cfSetVolume`，主界面 `#volPercent` + 沉浸界面 `immVolPercent`（当前无对应元素，安全 no-op）均覆盖；清理 `oninput` 冗余更新。

#### 7｜UI 图标去 emoji 化（SVG sprite 替换按钮 emoji）
- **`js/audio-core.js` / `ui-core.js` / `loader.js` / `cover-lib.js` / `pip.js` + `css/components.css`**：play/pause、pitch、crossfade、dark mode、网络状态、统计、收藏、睡眠定时、无封面占位、播放整张专辑等原本用 `textContent='⏸'/'❤'/'🌙'` 覆盖的内置图标，改为切换内置 `<use href="#icon-...">` 或 `iconSvg()` + 文字，不再覆盖按钮图标。
- **`js/pip.js`**：创建 PiP 窗口时把主文档 SVG `<defs>` 克隆进 PiP 独立 document，使 `<use href="#icon-...">` 可正常渲染；控制栏 + 黑胶占位全部换 SVG。
- 注释里的版本标记 emoji（🔋/📺/🎬/⚡）刻意保留。

#### 8｜手柄右摇杆左右调音量改为无级（类无级）调节
- **原问题**：`js/gamepad.js` 右摇杆水平调音量走「150ms 门槛 + 固定 ±0.02 步进」，与偏转量无关 → 顿挫、不连贯，且偏一点也是 2% 跳变。
- **`js/gamepad.js` `pollGamepad()` 右摇杆分支**：改为**按偏转量与帧时间连续累加**——`rate = 0.6 * mag * (0.5 + mag)`（`mag = |axes[2]|`），每帧增量 `= sign(x) * rate * dt`（`dt` 为相邻帧秒数，帧率无关）；死区由 0.3 降到 0.12，偏角越小变化越细腻，松手即停。
  - 满偏（mag=1）约 0.9/s 走完全程，轻推（mag≈0.12）近乎微调；表现类无级、可停在任何音量。
- **`js/audio-core.js`**：新增 `adjustVolumeContinuous(delta)` 与防抖保存 `_scheduleVolSave()`；`cfSetVolume(vol, skipSave=false)` 增加 `skipSave` 参数——连续路径传 `true` 走 400ms 防抖保存，避免每帧 `localStorage` 落盘（原 `volSlider.oninput` 与离散 `adjustVolume` 仍即时保存）。

#### 9｜修复手柄右摇杆上下滚歌词「几乎失效」
- **现象**：右摇杆上下滚主界面歌词栏几乎不动；滚轮/触摸正常。
- **根因①（主因）**：`js/gamepad.js` 右摇杆垂直分支滚歌词时只调了 `_lrcScrollBlurClear()`（清模糊），**未置 `isUserScrollingLyrics = true`**；而 `js/audio-core.js` 的 `syncLyrics()` 在每次 `timeupdate` 都会「若 `!isUserScrollingLyrics` 就 `scrollTo(..., smooth)` 跟到当前行」→ 手柄每帧的滚动被自动跟随平滑地拉回，互相打架。滚轮路径走 `handleUserScroll()` 会置该标志，故正常。
- **根因②**：`.lrc-viewport` (`css/style.css` L236) 带 `scroll-behavior: smooth`，逐帧 `scrollTop +=` 被平滑动画拖慢、叠加抵消，进一步显得无效。
- **修复**：`js/gamepad.js` 新增 `_rsLrcMarkScrolling()`——滚歌词时置 `isUserScrollingLyrics = true` 抑制自动跟随、临时把 `el.lrcView.style.scrollBehavior='auto'` 关掉 smooth，停止 1.5s 后复位并 `syncLyrics()` 重新对齐；`_lrcScrollBlurClear()` 保留。浮窗（非歌词）滚动路径不受影响。

### 🏷️ 歌词创作信息正则扩充

- **`js/audio-core.js` `CREDIT_PAT`**：新增 `混音室`（混音工作室后）、`音乐设计`（音乐监督后）词条；`母带处理` 此前已存在。
- **`js/audio-core.js` `CREDIT_MULTI_PAT`**：两处角色清单同步补入 `混音室`、`母带处理`、`音乐设计`，支持多角色合并格式（如 `混音室/母带处理：`、`编曲/音乐设计：`）。
- 注释补充 v2.8.13p5 变更记录。

### 🆕 版本号更新
- `v3.4.1` → `v3.4.2`

## v3.4.1 (2026-07-07)

### 🪟 PWA / WCO 标题栏调整（Windows Chrome）

#### 1｜WCO 标题随切歌实时更新
- **`js/audio-core.js` `loadSong()`**：每次切歌调用 `WCO.setTrack(song.title, song.artist)`，标题栏当前曲目随播放进度即时更新（此前 `setTrack` 为死代码，仅在 WCO 激活时同步一次）。
- **`js/wco.js` `_enable()`**：新增 `_syncCurrentTrack()`，从 `playlist[currentIndex]` 兜底同步当前正在播放的曲目，切到 WCO 模式不再空白。

#### 2｜标题居中
- **`css/wco.css`**：`.wco-titlebar` 与 `.wco-drag-region` 均改为 `justify-content: center`，标题置于顶部正中（受 `env(titlebar-area-width)` 约束，自动避开右侧系统金刚键安全区）。

#### 3｜标题栏变色逻辑按 WCO 状态分流
- **`js/theme-color.js`** 新增 WCO 状态感知与 `refresh()`：
  - **隐藏标题栏（WCO active）** → 全局固定 `#180219`（忽略封面色与深色模式）。
  - **显示标题栏** → 专辑封面色；无封面 / 取色失败 → 主题默认色 `cfg.defaultColor`。
- **`js/wco.js` `geometrychange`**：用户在菜单切换「显示 / 隐藏标题栏」时触发 `ThemeColor.refresh()` 重新套色；`body.wco-active .wco-titlebar` 背景同步为 `#180219`，整条顶部视觉统一。

#### 4｜修复无封面残留上一张封面色
- **`js/audio-core.js` `loadSong()`**：原「无专辑封面」分支漏调 `ThemeColor.update()`，导致残留上一张封面颜色。改为 if/else 之后统一调用 `ThemeColor.update(currentAlbumColor)`，两种分支均正确刷新。

#### 5｜线上部署模式切换为 GitHub Actions 自动构建
- **GitHub Pages Source** 由「Deploy from a branch（直接服务 main 根目录源码）」改为 **GitHub Actions**：push `main` 触发工作流，从源码自动构建 `dist/` 并部署，源码改动需等 Actions 跑完才上线。
- **新增 `.github/workflows/deploy.yml`**：`setup-node 20 → npm install → npm run build → upload-pages-artifact(dist) → deploy-pages` 全流程。
- **`build.js` 补全打包链**：复制 `favicon.ico` / `icons/*` / `manifest.json`，并生成 dist 专用相对路径 `sw.js`（预缓存 `bundle.min.js` / `style.min.css` / `index.html` / `icons/*` / `favicon.ico`，子路径 `/muse/` 安全；原 root `sw.js` 绝对路径在 dist 下会全部预缓存失败）。
- **`package.json`** 新增 `build` 脚本与 `terser` / `clean-css` 依赖。
- **`.gitignore` 目录改名 `.dev-docs/`** 并新建真正的 `.gitignore` 文件（忽略 `dist/` / `node_modules/` / `package-lock.json` / `_serve_cf.js` / `.dev-docs/`），构建产物不再误入版本库。

### 🆕 版本号更新
- `v3.4.0` → `v3.4.1`

## v3.4.0 (2026-07-07)

### 🎮 曲库 coverflow 交互与手柄返回修复

#### 修复1｜手柄 B 键逐级返回（播放列表等浮窗）
- **`js/ui-core.js` `handleGlobalClose()` 重写**：改为**始终关闭当前实际最上层（z-index 最高）的打开浮窗**，不再仅依赖 `_modalVisitStack` 栈顶。
- **根因**：播放列表等浮窗若叠在曲库上层打开却未推栈，旧逻辑按栈顶（下层浮窗）关闭，导致最上层浮窗仍开着 → 手柄 B 看似"无法返回主界面"。
- **播放列表打开补推栈**：键盘 `p` 与手柄 `btns[14]`（← 播放列表）打开播放列表时显式 `_pushModal('playlistModal', null)`，确保 B 键逐级返回逻辑一致。
- 同 z-index 时以 DOM 顺序兜底（后绘制者为上层），并清理与最上层不匹配的陈旧栈条目。

#### 修复2｜曲库-按专辑（coverflow）鼠标滚轮滚动失效
- **现象**：coverflow 模式下快速连续滚轮时封面不切；手柄左摇杆不失效（摇杆路径已临时关闭 snap/smooth，滚轮路径漏改）。
- **根因**：`.cover-lib-grid.is-coverflow` 同时带 `scroll-snap-type: x proximity` + `scroll-behavior: smooth`；连续 `coverLibMoveCenter → setCoverLibCenter → grid.scrollTo({behavior:'smooth'})` 被 snap 吸附 + 平滑动画互相抵消。
- **`js/cover-lib.js` 修复**：
  - 新增 `restoreCoverflowScrollMode()`。
  - 重写 `enterCoverflowFlat()`：进入平坦模式即关闭 grid 的 `scrollSnapType='none'` / `scrollBehavior='auto'`；350ms 恢复回调统一恢复 snap/smooth 再 `updateCoverflow()`。
  - `setCoverLibCenter()` 平坦分支 `scrollTo` 由 `behavior:'smooth'` 改为 `'auto'`（因 `scrollTo` 的 behavior 选项优先级高于内联样式，写 smooth 会抵消修复）。

### 🆕 版本号更新
- `v3.3.0` → `v3.4.0`

## v3.3.0 (2026-07-06)

### ⚡ 性能 / 可维护性 / 无障碍 / PWA 全面优化（基于 OPTIMIZATION_REPORT）

> 本轮以 `OPTIMIZATION_REPORT.md` 为基准，对性能、代码结构、UI/UX、PWA 离线、无障碍五大方向共 20+ 项进行系统整改（用户明确"暂缓"的 3 项除外：A-B 长按耦合 / manifest 字段补全 / 浅粉对比度审计）。

#### 🔴 性能 (P0-P1)
- **`syncLyrics` 增量更新 + 节点缓存**：原每 tick（~4Hz）对 `.lrc-line` 全量 `querySelectorAll` + `void line.offsetHeight` 强制重排 + `getBoundingClientRect`。改为仅当 `activeIdx` 变化时更新高亮，缓存 `.lrc-line` 列表（`getLrcLines()` 懒初始化）。**修复由此引入的 TDZ 崩溃**（`const syncLyrics` 声明前访问自身 → 首页不渲染、加载文件夹失效），首页恢复。
- **可视化画布尺寸 ResizeObserver 化**：主画布 `cvs.width/height` 从每帧读 `offsetWidth` 改由 `ResizeObserver` 在容器尺寸变化时更新，rAF 内只读缓存值，消除每帧强制重排。
- **暂停不重绘**：暂停且非沉浸模式时跳过逐帧重绘，仅保留末帧，空闲/暂停功耗显著下降。
- **`setPositionState` 节流**：Media Session 位置状态从每 `timeupdate` 降频至 ~4Hz（250ms）。
- **睡眠定时器 interval 按需**：`startSleepTimerInterval` / `stopSleepTimerInterval` 替代进程级常驻 `setInterval`，无定时任务时不空跑。
- **metaWorker 死代码删除**：移除 `globals.js` 内联 `workerCode`/`workerBlob`/`workerUrl` + 永不 `revokeObjectURL` 的无用 Blob URL 泄漏。
- **jsmediatags `defer`**：CDN 解析脚本改为 `defer`，首屏不再被渲染阻塞。

#### 🟡 代码结构与可维护性 (P2)
- **生产构建补全**：`build.js` 的 `JS_FILES`/`CSS_FILES` 补列 `theme-color.js`/`wco.js`/`wco.css`，`node build.js` 产出完整 `dist/`（不再缺主题色/WCO 文件）。
- **节能双体系合并**：删除冗余 `isEnergySaving` 布尔与兼容字段，统一 `EnergyMode` 位标志，`shouldBeEnergySaving()` 单入口。
- **rumble 重复赋值移除**：`loadSettings` 中重复 rumble 块合并，默认回落 `'basscut'`。
- **CREDIT_PAT 角色名单抽常量**：抽出共享 `EN_ROLES` 数组，消除两处重复超长正则、避免不同步。

#### 🟡 UI/UX / 安全
- **XSS 防护**：搜索结果 / 收藏列表 / 统计面板的 `title·artist` 全部经 `escapeHTML` 转义；`showToast` 的 `msg` 经 `escapeHTML`。
- **内联 `onclick` 迁移**：`index.html` 内联 `onclick` 迁移为 `ui-core.js` 事件绑定（利于后续 CSP）。
- **沉浸画布 ctx 缓存**：`immCtx`/`bgColorCtx` 一次性 `getContext` 常量化，不再每帧重复取上下文。

#### 🟡 PWA / 离线 / 跨平台
- **CDN 运行时缓存**：`sw.js` 增加 stale-while-revalidate 运行时缓存，覆盖 Google Fonts 与 jsmediatags（离线可达）。
- **`cache.addAll` 可观测**：逐条缓存 + `console.warn` 记录失败项，不再静默吞错。
- **SW 更新提示**：注册处监听 `updatefound`/`controllerchange`，新版本提示用户刷新。
- **iOS 兼容性回退**：不支持画中画时隐藏对应快捷按钮，核心播放/手势保持可用。

#### 🟢 无障碍 (WCAG 2.2)
- **视口缩放放开**：移除 `maximum-scale=1.0, user-scalable=no`，允许缩放（WCAG 1.4.4 / 1.4.10）。
- **进度条 aria 同步**：`timeupdate` 同步 `aria-valuenow`/`aria-valuemax`/`aria-valuetext`。
- **焦点可见性**：两处 `:focus-visible` 轮廓与 `.gamepad-focus` 视觉对齐。
- **WCAG 亮度公式**：`getLuminance` 改用标准 sRGB 相对亮度公式 + 对比度择优前景色。
- **`player-wrapper` role**：`role="application"` → `role="group"` + `aria-label`。

### 🆕 版本号更新
- `v3.2.4` → `v3.3.0`

## v3.2.4 (2026-07-06)

### 🐛 曲库缓存崩溃修复（4 个 Bug 全量修复）

#### Bug 1: 空缓存陷阱（致命）
- **`cover-lib.js`**：`renderGridChunked` 中 `grid.appendChild(fragment)` 先于 `allFragments.push(fragment)`，导致缓存收集器存入的是空 fragment。修复为在 `appendChild` **之前** `cloneNode` 克隆卡片节点到缓存收集器，确保缓存内容完整

#### Bug 2: 竞态条件
- **`cover-lib.js`**：新增 `_gridGeneration` 递增 ID，`renderNextChunk` 每轮检查 gen 是否匹配，快速切换 Tab 时旧 chunk 自动中止

#### Bug 3: 缓存有效性检查
- **`cover-lib.js`**：`renderCoverLibGrid` 中缓存命中条件增加 `childNodes.length > 0` 校验，空 fragment 不命中，改用 `cloneNode(true)` 深拷贝避免污染

#### Bug 4: Tab 点击防抖
- **`cover-lib.js`**：Tab onclick 增加 80ms `_tabSwitchTimer` 防抖，避免快速点击触发多次全量渲染

### 🎨 唱片库尺寸与视觉全面升级
- **弹窗放大**：`width: min(92vw, 1400px)` 替代 `750px`，1920屏下 ~1766px 占 92%，不再是数据表格
- **高度增加**：`max-height: 92vh` 替代 `88vh`，多 4% 可用垂直空间
- **卡片最小宽**：`minmax(200px, 1fr)` 替代 `180px`，5 列时每卡 ~340px
- **网格间距**：`gap: 24px` 替代 `20px`
- **卡片背景**：`#1e1c2a` 替代 `#1a1a1e`，与面板背景 `#1e1b2e` 分层明显
- **专辑名**：`15px` 替代 `13px`，元信息 `12.5px` 替代 `11px`，对比度提升
- **自定义滚动条**：6px 细条，hover 亮显
- **搜索框**：focus 发光环交互反馈
- **响应式断点**：1600/1200/860/859px，移动端 padding 收窄
- **`index.html`**：移除了 cover lib modal-content 的内联 `width: 750px` 避免覆盖 CSS

### 🆕 版本号更新
- `v3.2.3` → `v3.2.4`

## v3.2.3 (2026-07-06)

### ⚡ 性能优化（P0-P8 全量实施）

#### P0 🔴 右摇杆滚动帧内 reflow 消除
- **`gamepad.js`**：新增 `getActiveScrollable()` / `invalidateScrollableCache()`，惰性缓存 modal scrollable 引用（500ms TTL），右摇杆帧耗时降低 ~50%
- `updateFocusContext` 入口自动失效化缓存，确保 modal 开关后立即重建

#### P1 🟡 焦点吸附候选数限制
- **`gamepad.js`**：`_rsFocusTimer` 回调限制扫描前 50 个候选 / 找到 5 个即停，`getBoundingClientRect` 调用量降 90%

#### P2 🔴 renderPlaylist DocumentFragment
- **`loader.js`**：逐项 `appendChild` 改为 `DocumentFragment` 批量插入 + `textContent` 替代 `innerHTML`，100 首从 100 次 reflow 变 1 次

#### P3 🟡 播放列表事件委托
- **`loader.js`**：移除逐项 `onclick`/`oncontextmenu` 闭包（100 首 ≈ 200 闭包），改用 `el.plContainer` 事件委托（click + contextmenu）

#### P4 🟡 renderGridChunked DocumentFragment
- **`cover-lib.js`**：每 chunk 内逐项 `appendChild` → Fragment 累积后一次插入，reflow 减 90%

#### P5 🟡 曲库 Tab 缓存
- **`cover-lib.js`**：`_gridCache` 缓存三个 Tab（album/artist/recent）已渲染的 Fragment，无搜索时切换直接复用，<1ms
- 库变更时自动失效（`invalidateGridCache()` 在 3 处 `musicLibrary = ...` 后调用）

#### P6 🟢 CSS transition 精确化
- **`cover-lib.css`**：`.cover-lib-card` / `.cover-lib-tab` / `.album-detail-track` / `.vinyl-slip` 从 `transition: all` 改为精确属性名
- **`modals.css`**：`.pl-item` / `.playlist-tab` / `.pl-item .favorite-btn` 同样精确化

#### P7 🟢 contain: strict
- **`modals.css`**：`.playlist-items` 追加 `contain: strict`，完全隔离布局/绘制计算

#### P8 🟢 拖拽辅助线复用
- **`loader.js`**：`_dragInsertLine` 单元素替换 `createElement`/`querySelectorAll().remove()` 模式，`ondragover` 帧耗时 -50%

### 🧹 设置页嵌套清理
- **`index.html`**：淡入淡出切歌从 `renderEQPanel` 动态嵌套移出为独立 `drawer-box`（HTML 平坦化）
- **`ui-core.js`**：`renderEQPanel()` 删除 Crossfade drawer-box 动态创建，改为纯事件绑定

### 🩹 自动播放策略优雅降级
- **`audio-core.js`**：`playAudio()` 捕获 `NotAllowedError` 后监听用户手势自动恢复播放，显示"🖱 点击页面任意位置开始播放"引导 Toast，15 秒自动过期清理监听器

### 🔧 Toast 退出动画修复
- **`modals.css`**：移除 `@keyframes toastSlideIn` + `animation` 覆盖规则，改用 `transition` 自然驱动进出双向动画
- **`utils.js`**：移除无用的 `void el.toast.offsetHeight` 强制重排

### 🆕 版本号更新
- `v3.2.2` → `v3.2.3`

### 🧹 设置页优化
- **快捷键指南改为按钮**：内联 20 行快捷键网格替换为"查看快捷键大全"按钮，点击弹出帮助面板
- **触觉 → 门槛统一**："底板/地板阈值" → "门槛阈值"，"自动地板" → "自动门槛"，新增描述文本
- **格式支持补充**：载入音乐底部文案添加 +VTT
- **Tab 栏滚动条隐藏**：`scrollbar-width: none` + `::-webkit-scrollbar { display:none }`，LB/RB 切换

### 🎮 手柄焦点与导航重写
- **`moveFocus2D` 同容器奖励**：垂直导航时优先留在列表/网格容器内，上翻到顶后才跳出到 header
- **焦点顺序重排**：`updateFocusContext` 中播放列表/曲库改为列表项在前、header 在后
- **右摇杆滚动重写**：450ms 防抖焦点吸附，智能滚动容器识别（settings-body / playlist / coverLibGrid / albumDetailTracks），动态速度
- **专辑详情手柄兼容**：`updateFocusContext` 增加专辑详情检测，`showAlbumDetail` 推入 Modal 栈，`closeDetail` 弹出
- **LB/RB 全局切换**：设置/播放列表/曲库内循环切换 Tab，覆盖全部子浮窗
- **`switchPlaylistTab` / `switchCoverLibTab`**：新增辅助函数，支持 Tab 循环

### 📋 播放列表重构
- **曲库按钮移除**：播放列表标题栏改为"全部"+"收藏"胶囊 Tab 栏（与设置页统一风格）
- **`coverLibModal` 变量修正**：确保 `el.coverLibModal` 在 gamepad 中可访问

### 🎨 UI 统一
- **曲库 Tab 栏**：`.cover-lib-tab` 改为胶囊风格（与设置 .settings-tab 一致）
- **按钮文本清理**：移除 `(Esc)` / `(B)` 等冗余快捷键文本，手柄已通过浮动 `.gamepad-badge` 提示

### 🆕 版本号更新
- `v3.2.1` → `v3.2.2`

## v3.2.1 (2026-07-06)

### 🧹 设置页重构与优化
- **方框嵌套精简**：节能模式/震动面板的冗余外层 div 移除，布局扁平化
- **快捷键指南改为按钮**：内联 20 行快捷键网格替换为"查看快捷键大全"按钮，点击弹出帮助面板
- **触觉 → 门槛统一**："底板/地板阈值" → "门槛阈值"，"自动地板" → "自动门槛"，新增描述文本
- **格式支持补充**：载入音乐底部文案添加 +VTT
- **播放速度/音调去重**：确认无重复，保持唯一

### 🔧 Gamepad 焦点导航增强
- **`moveFocus2D` 最近行优先**：垂直导航时先按行过滤（1.5x 容差），避免跳过中间按钮直接跳到远处滑块
- **`updateFocusContext` 污染清理**：过滤 toggle-switch 内部隐藏 checkbox、未展开的自定义下拉选项
- **EQ 预设按钮 nowrap**：强制单行 + 横向滚动，消除 flex-wrap 换行导致的导航断裂

### 🎨 默认蓝 → 水母蓝 + 全系玫瑰金统一
- **`globals.js`**：`defaultColor` 初始值从 `#9ac8e2`（默认蓝）改为 `#e8b4b8`（玫瑰金）
- **主题预设**：「默认蓝」更名为「水母蓝」，保留原色值
- **`css/style.css` / `css/components.css`**：3 处 `#9ac8e2` 回退值更新为 `#e8b4b8`
- **`gamepad-badge.pad-rs`**：从硬编码 `#9ac8e2` 改为 `var(--primary)` + `rgba(var(--primary-rgb),0.2)`，跟随主题色
- **`pip.js`**：PiP 窗口内联样式备选色更新为 `#e8b4b8`

### 🪟 WCO 封面取色适配
- **`audio-core.js`**：`extractColor()` 成功后调用 `ThemeColor.update(currentAlbumColor)`，使 PWA 标题栏颜色跟随专辑封面主色调

### 🆕 版本号更新
- `v3.2.0` → `v3.2.1`

## v3.2.0 (2026-07-06)

### 🎨 全系主题色：玫瑰金
- 所有 `#e8b84b`（琥珀金）引用替换为 `#e8b4b8`（玫瑰金）：CSS 变量、SVG 箭头、manifest theme_color
- 注释中"琥珀金"统一改为"主题色自适应"或"玫瑰金"

### 🪟 PWA Window Controls Overlay
- **`manifest.json`**：追加 `display_override: ["window-controls-overlay"]`
- **`css/wco.css`**（新建）：WCO 标题栏样式 + 拖拽区域 + 响应式
- **`js/theme-color.js`**（新建）：动态管理 `<meta name="theme-color">`，跟随取色/深色模式
- **`js/wco.js`**（新建）：WCO 几何监听 + 标题栏曲目更新 + 拖拽区域管理
- **`index.html`**：添加 `meta theme-color`、WCO 标题栏 DOM、新文件引用
- **`manifest.json`**：追加 display_override 声明
- **`sw.js`**：缓存列表追加 `wco.css`、`theme-color.js`、`wco.js`

### 🔙 Modal 访问栈 — B 键/Esc 逐级返回
- **新数据结构** `_modalVisitStack`：记录弹窗打开顺序
- **`handleGlobalClose()` 重写**：栈驱动版本，优先检查栈顶弹窗，关闭后 `_popModal` 恢复父层焦点
- **7 处 `_pushModal` 入栈**：设置、播放列表、曲库、专辑详情、文件信息、统计、帮助
- **`closeAllModals()` 追加 `_clearModalStack()`**：用户主动全关时清空栈
- **`showAlbumDetail` 修复**：closeDetail 主动从栈中 pop 专辑详情条目，避免残留

### 🆕 版本号更新
- 全局版本统一：`v3.1.0` → `v3.2.0`（8 个 JS 文件 + index.html + sw.js + 新文件）

## v3.1.0 (2026-07-06)

### 🏗️ 设置页全面重构
- **Tab 重新组织**：音频-外观-触觉-性能-高级，内容按功能域重新分布（音频=载入+EQ+速度+Crossfade+睡眠；外观=主题+背景+歌词；触觉=震动；性能=节能；高级=统计+调试+快捷键）
- **快捷键指南改为按钮**：快捷键列表从内联表格改为"查看快捷键"按钮，点击调出帮助窗口
- **Tab 栏手柄适配**：留足水平滚动空间，`scrollbar-width: thin` + 尾部留白 16px

### 🎨 默认主题色：玫瑰金
- CSS 变量 `--primary` 从 `#e8b84b`（琥珀金）改为 `#e8b4b8`（玫瑰金）
- 主题预设列表中"玫瑰金"移至首位

### ⏯ 长音频播放进度持久化
- **记忆条件**：音频时长 > 15 分钟（900 秒）
- **保存频率**：每 10 秒存一次 `localStorage`（键名 `MBolka_PlayPos_` + 文件名）
- **恢复逻辑**：切歌时自动检测已保存进度，如进度在歌曲最后 5 秒内则从头播放
- **自动清理**：无手动清理机制，由浏览器自然回收

### 📜 VTT 字幕支持
- **VTT 解析器** `parseVttText()`：提取时间轴 + 文本，输出与 LRC 一致的 `{time, text}` 结构
- **自动发现**：`loader.js` 中 `.vtt` 文件与 `.lrc` 一同归入 `lrcMap`
- **自动检测**：`loadLrc` 中检测 `WEBVTT` 头部，自动切换解析器
- **渲染复用**：VTT 字幕使用与 LRC 完全相同的歌词渲染管线（`syncLyrics` / `lrc-line` 样式）

### 🆕 版本号更新
- 全局版本统一：`v3.0.2` → `v3.1.0`（11 个 JS 文件 + index.html + sw.js）

## v3.0.2 (2026-07-06)

### 🎮 手柄重映射 — 严格单功能
- **删除长按/双击机制** 🔴：移除 `LONG_PRESS_MS`、`DBL_CLICK_MS`、`_btnTimers`、`_doubleClickPending` 全套长按/双击状态机。每个按键严格单功能，无二义性
- **D-Pad 重映射**：↑=全屏 / ↓=沉浸舱 / ←=播放列表 / →=曲库
- **X/Y 重映射**：X=播放暂停 / Y=收藏（单功能）
- **View/Menu**：View=画中画(PiP) / Menu=设置弹窗
- **L3/R3**：LS=焦点模式切换 / RS=帮助页面
- **右摇杆新增**：水平=音量调节(死区0.3/节流150ms) / 垂直=滚动(歌词/浮窗子页面，节流100ms)
- **LT+RT**：短按快退/快进5秒，同时按保留 Seek 模式

### 🎨 设置页震动实时指示器
- **设置弹窗嵌入**：控制Tab 的震动面板内新增 `#settingsRumbleIndicator`，显示强震/弱震进度条 + 数值 + 底板值 + 自动地板状态
- **`_updateRumbleIndicator` 同步**：每帧更新强震/弱震/地板/自动地板显示，仅在设置弹窗打开时渲染
- **震动开关联动**：`rumbleToggle` 关闭时自动隐藏指示器

### 📜 歌词滚动模糊优化
- **CSS 类控制**：新增 `.lrc-viewport.scrolling .lrc-line { filter: blur(0px) }`，鼠标滚轮/右摇杆滚动时移除高斯模糊，停止后恢复
- **`handleUserScroll` 升级**：滚动时添加 `scrolling` 类，2 秒无操作后移除恢复模糊

### 🔧 设置页滚动加固
- **B1 sticky 加固**：`.settings-tab-bar` 追加 `position: sticky; top: 0; align-self: flex-start; max-height: 100%`
- **B2 滚轮修复**：`.settings-body` 追加 `overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scroll-behavior: smooth`

### 💬 Toast 即时更新
- **队列机制移除**：`_toastQueue` + `_dequeueToast` 替换为 `_toastTimer` 即时更新模式。新 Toast 立即替换当前气泡文字，重置 2 秒消失计时，不再排队等待

### 🆕 版本号更新
- 全局版本统一：`v3.0.1` → `v3.0.2`（11 个 JS 文件 + index.html + sw.js）

## v3.0.1 (2026-07-05)

### 🔧 P0 修复
- **帮助面板文档纠错**：4 处按键说明修正（X键=播放模式循环、Y键=封面取色、十字键=纯导航、快捷键面板LT/RT=快进快退）
- **focusable 补全**：8 处按钮补全 `focusable` + `tabindex`（4 个歌词偏移按钮 + 4 个睡眠定时按钮）

### 🎨 P1 视觉改进
- **SVG 图标系统**：14 处 emoji 替换为 SVG sprite（Lucide 风格），全平台图标一致
- **4pt 间距对齐**：`.header`/`.footer`/`.content-grid` 使用 `var(--space-*)` 间距令牌
- **玻璃态进一步减少**：`.drawer-box`/`.modal-content` 改用渐变背景，沉浸模式去除嵌套 blur
- **文字选择开放**：`.track-title`/`.track-artist` 允许选中复制

### 🛠️ P2 细节优化
- **滚动条对比度提升**：thumb 从 15% → 25%，hover 45%，active 主题色
- **音频加载失败状态**：封面显示红色虚线边框 + "无法播放此文件" 提示
- **删除撤销 Toast**：移除操作后 5 秒内可撤销
- **设置标签分组增强**：增加 `.settings-panel` 包裹逻辑

### 🔴 P0 紧急修复
- **style.css 加载缺失**：`index.html` 缺少 `style.css` 引用导致 Toast 无法消失，已修复
- **CDN integrity hash 错误**：`jsmediatags` 哈希值不匹配导致浏览器拒绝加载脚本、所有元数据解析失败，已替换为正确值 `sha384-JpTt7qxVx1X/pHeYiCfqFdKRu2HF1MBGr1kEXtbNIGwwryGWMbbW78onU3bdkAHZ`
- **设置标签语义分类**：改用基于标题内容的关键词匹配算法替代顺序自动分配，确保每个 drawer-box 归入正确标签组
- **sw.js 缓存 URL 修正**：移除未加载的 `/css/style.css`（components.css 已存在无需额外添加）

### 📋 P1 版本号统一
- 6 处版本号统一更新：`index.html`（title + footer）、`globals.js`、`audio-core.js`、`storage.js`、`loader.js` → `v3.0.1`

### 🗑️ 其他修复
- **IndexedDB 存储溢出提示**：`initIDB` 初始化失败时显示 Toast 引导用户清理数据

### 🎯 P3 体验优化
- **Favicon / PWA 图标**：添加内联 SVG favicon + apple-touch-icon
- **动态页面标题**：播放时显示 `♪ 曲名 - 艺术家 ｜ MBolka`，暂停/清空时恢复
- **深色模式自动跟随**：首次启动时检测 `prefers-color-scheme` 系统偏好自动设置
- **音量百分比显示**：vol-control 区域追加实时百分比显示
- **播放列表双击播放**：列表项支持双击直接切歌
- **大列表懒加载**：`playlist-items` 和 `.pl-item` 添加 `content-visibility: auto`，500+ 曲目首次打开不再卡顿

### 🧹 外部审计修复
- **7 个 JS 版本号统一**：ui-core/app/cover-lib/gamepad/pip/utils/vibration → `v3.0.1`
- **设置标签 SVG 图标**：新增 icon-folder/palette/headphones/gamepad，替换 emoji
- **设置标签 CSS 重设计**：激活态金色半透明底 + 边框，悬停微弱提亮，`tab-icon` 统一居中
- **sw.js 缓存 style.css**：补充离线缓存
- **HTML 注释清理**：删除 6 处过时版本注释
- **存储管理增强**：启动自动清理 30 天前数据，50MB 阀值自动缩容，手动清理按钮

### 🏗️ v3.0.1b — 设置面板重构与深度优化 (2026-07-06)

#### 🖼️ 设置弹窗 UI 重构
- **垂直图标导航栏**：左侧 110px 固定 sidebar，5 个卡片式 Tab（26px SVG 图标 + 11px 文字），active 状态琥珀金半透明背景 + 外发光
- **固定高度 + 可滚动**：各 Tab 内容不再让弹窗高度抖动，且超出时独立滚动
- **底部版权移入独立行**：`.settings-footer` 置于 sidebar+body 下方
- **自定义下拉菜单**：`.settings-select` 类，琥珀金箭头 SVG（14px），圆角 10px，玻璃背景。hover 上移 1px + 淡金边框，focus 3px 外发光 + 金色底，active 微缩 0.98，选项暗色毛玻璃

#### 🐛 关键 Bug 修复
- **CSS 语法错误**：`.drawer-box` 缺少闭合大括号导致 `.settings-tab` 全套样式失效 — 已修复
- **SW 缓存失效**：`sw.js` 缓存版本号 `mbolka-v3 → mbolka-v3.0.1`，清除旧版缓存
- **Tab 0 首屏白屏** 🔴：HTML 预置 `active` 类导致 `tabs[0].click()` 被守卫 `if (tab.classList.contains('active')) return;` 拦截，所有面板保持 `display: none`。修复：模拟点击前先移除所有 Tab 的 `active` 类
- **设置页无法滚动** 🔴：根因同上（面板未激活 → minHeight 测量为 0 → body 无高度 → 无滚动容器）。Tab 0 激活后 `overflow-y: auto` 正常生效
- **initSettingsTabs 重复调用泄漏** 🔴：每次打开设置都重新创建 `settings-layout-row`，旧的空行不断泄漏。`body.innerHTML = ''` 清空面板后缓存的 `boxes` 引用变为游离态。修复：`_tabsInited` 幂等守卫 + 首次构建/后续仅激活的分离逻辑

#### 🔧 Gamepad 焦点深度修复
- **隐藏面板焦点泄漏** 🔴：`updateFocusContext` 仅收集当前活跃面板 + 全局控件（tab-bar/header/footer），避免焦点导航到不可见元素
- **Tab 切换后焦点悬空** 🔴：`switchSettingsTab` 切换后 100ms 自动聚焦新面板第一个控件
- **Toggle-switch 不可见焦点** 🟡：所有 8 个 `.toggle-switch` 标签添加 `.focusable` + `tabindex="0"`，A 键激活时直接 toggle 内部 checkbox
- **滑块缺 `.focusable`** 🟡：5 个震动滑块 + `crossfadeSlider` 补全 `.focusable` 类
- **`audioOutputSelect` 缺类** 🟢：添加 `.settings-select focusable`

#### 🎨 主题色动态兼容
- **`--primary-rgb` 变量系统**：新增 CSS 变量 `--primary-rgb`（`232, 184, 75`），供 `rgba(var(--primary-rgb), X)` 在任何主题色下自动派生半透明色
- **全 CSS 硬编码琥珀金清除**：`variables.css` / `base-layout.css` / `modals.css` 中 10 处 `rgba(232,184,75, X)` 全部替换为 `rgba(var(--primary-rgb), X)`，跟随用户选择的预设主题色或封面取色
- **3 处 JS 同步**：`applyThemeColorAction`、`applyThemeLogic`、`utils.js` 初始化时同步设置 `--primary-rgb`

#### 📊 震动实时指示器
- **主界面 footer 新增**：手柄连接后显示 Strong/Weak 双进度条（暖橙/冷蓝渐变）实时反映马达输出强度，autoFloor 开启时浮动显示动态阈值
- **`vibration.js` 新增 `_updateRumbleIndicator()`**：每帧更新进度条宽度 + autoFloor 数值 + 弱信号时自动半透明降显
- **`gamepad.js` 联动**：手柄连接/断开时自动 show/hide 指示器

#### 💾 震动配置持久化（严重遗漏修复）
- **`saveSettings()` 补全**：9 个 rumble 字段写入 localStorage（rumbleEnabled/Mode/Floor/AutoFloor/Throttle/StrongGain/WeakGain/SwapMotors/Gain）
- **`loadSettings()` 补全**：对应读取恢复，默认值与 `globals.js` 对齐
- **`globals.js` 默认值修正**：`rumbleMode` 从 `'spectrum'` → `'basscut'`，与 HTML 默认选择一致，消除冲突

#### 🔄 默认值调整

## v3.0.0 (2026-07-05)

### 🎮 全新手柄震动反馈引擎
- **新增 `js/vibration.js`**：独立震动映射模块，基于 Web Gamepad API `dual-rumble` 实现音频→震动反馈
- **双模式频谱映射**：频谱映射模式（Weak←低频/Strong←中高频）与去低频映射模式（跳过最低 25% 频段）
- **自动地板算法（EMA）**：~5 秒指数移动平均，高潮段落自动抬升阈值过滤基底噪音，安静段落保留细节
- **马达独立增益控制**：Strong (200%) / Weak (40%) 独立增益 + 全局振幅 + 反转马达开关
- **设置面板震动配置区**：震动开关、映射模式选择、地板阈值滑块、自动地板开关、节流间隔选择、马达独立控制
- **节能模式联动**：帧率限制/标签页隐藏时自动禁用震动
- **手柄连接检测**：连接时检测 `vibrationActuator` 支持，不支持的浏览器灰色提示

### 🎮 手柄功能全面补全
- **P0 焦点可达性修复**：为 8 处缺失 `.focusable` 的元素补全（导出按钮、睡眠定时、歌词偏移、统计关闭、右键菜单项、封面墙卡片、曲库搜索框）
- **P1 快捷组合键映射**：新增 11 项映射（长按 X 收藏、长按 Y 深色模式、View+Start 画中画、长按 View 曲库、长按 Start 播放列表、长按 LT 睡眠定时、长按 RT 统计面板、View+RB 帮助、双击 X 播放模式、长按 A A-B重复/右键菜单、右摇杆音量）
- **P2 交互范式**：进度条 Seek 模式（LT+RT 双扳机进入）、右键菜单手柄化（长按 A 弹出）、搜索框首字母/预设词快速跳转（LB/RB 轮换）
- **P3 画中画手柄支持**：主窗口 postMessage 转发 gamepad 状态到 PiP 窗口，映射 5 个操作按钮
- **Badge 视觉提示补充**：为 8 个按钮补充手柄按键徽章（P 列表、L 歌词、G 曲库、♥ 收藏、PiP 画中画、M 模式、↕ 音量、Ⓨ 沉浸）
- **help 面板文档纠错**：修正 X 键（切换播放模式→播放/暂停）、Y 键（取色模式开关→切换沉浸模式）、LT/RT（音量加减→快退/快进 5 秒）

### ⚡ v2.9.0 性能优化（合并入 v3.0.0）
- **TDZ 崩溃修复**：`ui-core.js` 中 `const toggleImmersiveMode/toggleDarkMode/toggleColorMode` 改为 `function` 声明，消除 Temporal Dead Zone
- **cfSetupScanner rAF 空转修复**：交叉淡变关闭时取消 rAF 循环
- **mousemove 节流**：粒子生成加 rAF 防抖，降低 CPU 占用
- **对象池 FIFO 淘汰**：粒子/涟漪池耗尽时用 FIFO 替代无限扩展
- **IndexedDB 批量写入**：`cacheMetadata` 改为 20 条一批一次性 transaction
- **backdrop-filter 动态降级**：`prefers-reduced-motion` 时降为 `blur(10px)`
- **will-change 动态管理**：动画前后 JS 动态添加/移除，释放 GPU 层
- **CSS 架构优化**：尺寸令牌（clamp 限制）、`!important` 精简、mask-type Firefox 兼容
- **无障碍增强**：歌词 `user-select: text`、`focus-visible` 键盘焦点、`prefers-reduced-motion` CSS+JS 双层
- **ARIA 语义标注**：`aria-label`、`role="dialog"`、`role="listbox"`、动态播放/暂停标签
- **骨架屏加载占位**：processFiles 开始前渲染骨架屏占位
- **Service Worker 外部化**：创建独立 `sw.js` 文件
- **CDN 加固**：`jsmediatags` 添加 `integrity` + `crossorigin`

### 🔧 其他优化
- **Toast 消息队列**：连续快速调用时不会覆盖，顺序显示
- **字体栈优化**：移除 `OPPO Sans 4.0`，中文字体回退到系统雅黑/苹方
- **PWA 缓存策略**：`sw.js` 实现 CacheFirst 静态资源缓存
- **模态弹窗焦点陷阱**：Tab 键在弹窗内焦点循环锁定
- **backdrop-filter 动态降级**：FPS 持续低于 45 时自动降为 `blur(10px)`
- **构建脚本**：`build.js` 合并压缩 JS/CSS 的生产构建脚本

### 🎮 手柄功能补全（第二阶段）
- **P0 焦点可达性补全**：`coverLibSearch`、`btnExportM3U`/`btnExportJSON`、5 个右键菜单项、`.ctx-item` 补全 `.focusable` + `tabindex="0"`
- **P1 快捷组合键状态机接入**：`_btnTimers` 长按检测逻辑连接、`_doubleClickPending` 双击检测（X 键双击=播放模式循环）、`_comboState` 组合键检测（View+Start=PiP、View+RB=帮助）
- **P2 Seek 模式**：LT+RT 双扳机进入 Seek 模式，左摇杆控制进度，松开退出

### 🎨 CSS 工程化
- **间距令牌系统**：在 `css/variables.css` 中新增 `--space-*` 系列变量（xs/sm/md/lg/xl/2xl/3xl）
- **字体栈统一**：移除 `OPPO Sans 4.0`（绝大多数设备不存在），`Inter` 优先，补充中文系统字体回退
- **ARIA 语义标注补全**：`player-wrapper` 添加 `role="application"`、进度条 `role="slider"`、歌词容器 `role="contentinfo"`、Toast `role="status" aria-live="polite"`
- **help 面板纠错**：修正设置快捷键面板中 LT/RT、Y 键、X 键的描述与实际代码不一致

### 🔧 其他修复
- **震动测试按钮**：设置面板震动区块新增"测试震动"按钮，发送 500ms dual-rumble
- **版本号更新**：index.html 中 `v2.8.13p4` 更新为 `v3.0.0`

### 🎨 美学系统彻底重构
- **调色板重构**：从青蓝（`#9ac8e2`）全面更换为琥珀金（`#e8b84b`）+ 深海蓝（`#0e0c16`），建立暖调奢华视觉辨识度
- **字体系统升级**：Inter → Newsreader（标题衬线字体）+ Geist（正文无衬线字体），CDN 链接更新
- **玻璃态降级**：`backdrop-filter` 从 `blur(35px)` 降为 `blur(12px)`，减少毛玻璃泛滥
- **弹窗背景加深**：modal-overlay 背景色改为 `rgba(8, 6, 16, 0.65)`，提升焦点感
- **进度条拖拽反馈**：拖拽/Seek 模式下进度条高度增加 + 琥珀金光晕

### 🏗 设置面板架构重做
- **标签页导航**：5 个标签（音乐/外观/音频/控制/其他），替代无限滚动
- **标签切换 JS**：`initSettingsTabs()` 按标签显示/隐藏抽屉区块

### 🌐 网络状态指示器
- Footer 新增实时网络状态指示器（在线/离线/慢速网络）
- `updateNetworkStatus()` 监听 `online`/`offline` 事件 + Network Information API

### 🎞 动画微调
- **Toast 滑入动画**：从顶部滑入 + 缩放，`toastSlideIn` 关键帧
- **缓动曲线优化**：`--curve-spring` 改为 `ease-out-expo`，`--curve-smooth` 改为 `ease-out-quint`

---

## v2.8.13p4 (2026-06-05)

### 🔥 创作信息 CSS 彻底重写 — 允许换行、不再溢出

**问题**（截图确认）：创作信息值文本超长时（如 `Luis Fonsi/Erika Ender/Ramon Ayala/Justin Bieber/...`）仍然溢出歌词栏边界，因为 `white-space: nowrap` + `text-overflow: ellipsis` 在某些布局下无法正确约束宽度。

**修复方案 (v2.8.13p4 CSS 重写)**：
- `.lrc-credits`: 移除硬编码 `max-width: 600px`，改为 `max-width: 100%` 由父容器约束
- `.lrc-credits-row`: `flex-wrap: nowrap` → **`flex-wrap: wrap`**（允许长文本自动折行）
- `.lrc-credits-val`: `white-space: nowrap` → **移除**，新增 `word-break: break-all; overflow-wrap: break-word`
- `.lrc-credits-row` 垂直对齐从 `center` 改为 **`flex-start`**（换行后视觉更自然）
- 标签(tag)保持 `flex-shrink: 0; white-space: nowrap` 不参与换行

### 🔥 创作信息正则大幅扩充

**遗漏要素补充到 CREDIT_PAT 和 CREDIT_MULTI_PAT**：

| 新增模式 | 匹配示例 | 来源 |
|---------|---------|------|
| `作词` | `作词：Lyla P.` | DAMIDAMI LRC |
| `作曲` | `曲：` 的完整形式 | 同上 |
| `演唱制作人` | `演唱制作人：火星电台` | 张杰 - 逆战 |
| `录音室` | `录音室：香蕉文化录音室 上海` | 同上 |
| `混音工作室` | `混音工作室：Sick Glue Studios` | 同上 |
| `混音师` | `混音师：Rusty Santos` | 同上 |
| `母带工作室` | `母带工作室：Sterling Sound Studio` | 同上 |
| `合音制作` | `合音制作：拳头游戏音乐团队/Colin Brittain` | Against The Current |
| `编外合音制作` | `编外合音制作：Alex Goot` | 同上 |
| `混音及母带后期` | `混音及母带后期：拳头游戏音乐团队` | 同上 |

CREDIT_MULTI_PAT 角色列表同步扩充，支持多身份组合格式。

### 🔧 沉浸模式进度条修复

**根因**：`app.js` 中 `handleABSeek()` 函数使用 `container.offsetWidth` 计算宽度，但用 `getBoundingClientRect().left` 计算位置——两者在不同缩放/滚动场景下不一致导致点击偏移。正确的修复版本存在于未加载的 `audio-core.js` 备份中。

**修复**：
- `handleABSeek()` 统一使用 `getBoundingClientRect()` 同时获取 left 和 width
- 沉浸模式 HTML 补充缺失的 `immTimeCur` / `immTimeTot` 时间显示元素

### 🎨 沉浸模式进度条 UI 对齐主界面

**变更**：
- 沉浸模式底部控制栏新增 `<div class="time-labels">` 时间标签（与主界面对齐）
- `immTimeCur` 元素存在性验证通过，拖拽/播放时间实时更新正常工作

---

## v2.8.13p3 (2026-06-05)

### 🔍 v2.8.13 补丁完整性检查

**检查范围**：对 v2.8.13 及 v2.8.13p2 所有补丁项进行逐项验证。

**检查结果 — 全部通过**：

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 歌词创作信息 Phase 6b 角色+值分离 | ✅ | `CREDIT_MULTI_PAT` 多角色拆分、`CREDIT_PAT`/`EN_CREDIT_PAT`/`OA_OC_PAT` 单角色分离全部正确 |
| 创作信息 CSS 独立成行+截断 | ✅ | `.lrc-credits` flex-column + `.lrc-credits-row` nowrap + `.lrc-credits-val` text-overflow:ellipsis |
| 沉浸模式背景跟随专辑取色 | ✅ | `immHue` 优先使用 `currentAlbumColor`，光晕用 `hsla(immHue,...)` |
| 音频设备枚举隐私优化 | ✅ | 已移除 `getUserMedia({audio:true})`，直接 `enumerateDevices()` |
| IndexedDB/LocalStorage 优化 | ✅ | 200条上限、MAX_ERROR_LOGS=200、flowField 退出释放 |
| 进度条偏移修复 | ✅ | `bindProgressBar()` 统一 `getBoundingClientRect()`，`updateVisuals()` 每次获取 rect |

**版本号**：`index.html` 标题及页脚更新为 `v2.8.13p3`，`changelog.md` 和 `代码功能指导文档.md` 同步更新。

---

## v2.8.13p2 (2026-06-05)

### 🔥 沉浸模式背景跟随专辑封面取色

**问题**：沉浸模式下背景固定使用深灰色调，未像主界面一样跟随专辑封面提取的主题色动态变化。

**修复方案**：
- 沉浸模式渲染循环中新增 `immHue` 变量，优先使用 `currentAlbumColor` 解析后的色相
- 沉浸光晕背景渐变从硬编码 `rgba(30,30,40,...)` 改为 `hsla(immHue, ...)`
- 中心发光核心、频谱弧线颜色同步跟随专辑封面取色

### 🔒 音频输出设备枚举隐私优化

**问题**：`enumerateAudioOutputDevices()` 函数调用了 `getUserMedia({ audio: true })` 请求麦克风权限，造成隐私侵害担忧。

**修复方案**：
- 移除 `getUserMedia()` 调用，直接使用 `navigator.mediaDevices.enumerateDevices()` 枚举设备
- 无权限时设备标签显示为 `音频输出设备 (xxxxxx...)`，deviceId 仍可用于 setSinkId 切换
- 添加无标签检测提示

### 🔥 创作信息「角色 + 值」分离重写

**根本问题**：Phase 6 提取创作信息时，将整行文本（如 `制作人：Sihan`）直接存入 `{label: '制作人：Sihan', value: ''}`，导致：
- 角色名和实际值混在一起，无法独立显示
- 多角色合并格式（如 `制作人/作曲/编曲：Sihan`）无法拆分为独立行

**修复方案 (Phase 6b)**：
- 新增 Phase 6b 后处理步骤，对所有 credits 条目执行角色+值分离
- 多角色格式自动拆分为独立条目：`制作人/作曲/编曲：Sihan` → 3条独立行
- 每条创作信息输出为 `<span class="lrc-credits-tag">角色名</span><span class="lrc-credits-val">值</span>` 结构
- 支持中文单角色、中文多角色、英文格式、OA/OC/OP/SP/ISRC 等全部格式

**示例效果**：
```
制作人：Sihan
作曲：Sihan
编曲：Sihan
作词：Lyla P./Sihan/Nellie Fors/SmileL/Nanyan P/Zilan Li
配唱制作：Victor 刘伟德
混音：周天澈@Tweak Tone Labs
母带：周天澈@Tweak Tone Labs
录音：徐晓宇@狂喜文化录音棚
```

### 🔥 创作信息正则扩充

**新增要素**：
- `配唱制作` — 匹配 `配唱制作：Victor 刘伟德`
- `母带处理` — 匹配 `母带处理：周天澈@Tweak Tone Labs`
- `录音工作室` — 匹配 `录音工作室：...`
- CREDIT_MULTI_PAT 角色列表与 CREDIT_PAT 同步扩展

### 🔧 彻底优化 IndexedDB/LocalStorage

**优化方案**：
- `cleanupOldMetadata()` 增强：新增 200 条目上限，超过时自动清理最旧记录
- 错误日志缓存限制从 500 条降至 200 条（`MAX_ERROR_LOGS = 200`）
- `toggleImmersiveMode()` 退出时释放 `flowField` 大数组

### 🩹 进度条偏移二次确认

**验证结果**：
- v2.8.13 的 `getBoundingClientRect()` 统一计算方案确认生效
- `bindProgressBar()` 中的 `cachedRect` 仅用于悬停提示，不影响拖拽/点击
- `updateVisuals()` 每次都重新获取 rect，无缓存干扰

---

## v2.8.13 (2026-06-05)

### 🔥 沉浸模式进度条点击修复

**问题**：点击进度条（约0分03秒前后）自动跳转到0分48秒前后，疑似无论点到哪里，进度都会调整到后约45秒出的问题。

**修复方案**：
- 修改 `handleABSeek()` 函数中使用 `getBoundingClientRect().width` 替代 `container.offsetWidth`，统一计算方式避免偏差
- 修改 `bindProgressBar()` 函数，添加 `resize` 和视图切换时清除 `cachedRect` 的机制，避免缓存过时导致的点击位置计算错误

### 🔥 歌词创作信息显示优化

**修复方案**：
- 修复 `.lrc-credits` 容器为左对齐，确保每种创作人独立一行
- 固定宽度，超出时截断文本（不换行，溢出显示省略号）
- `.lrc-credits-row` 设置为不换行，确保独立一行

### 🔥 创作信息正则扩充

**修复方案**：
- 更新 `CREDIT_PAT` 添加 `录音棚` 等新条目
- 更新 `CREDIT_MULTI_PAT` 支持多角色格式（如 `制作人/作曲/编曲：`）

### 📱 移动端优化

**新增功能**：
- 添加 CSS 去除按钮点击时的蓝色高亮
- 添加竖屏自动进入沉浸模式逻辑（仅限移动设备）

### 🔧 IndexedDB/LocalStorage 优化

**优化方案**：
- 添加 `cleanupOldMetadata()` 函数，清理30天以前的旧元数据缓存

### 🔥 flowField 大数组存储问题检查

**检查结果**：
- `flowField` 大数组未被存储到 IndexedDB 或 LocalStorage
- 修复 `flowField` 的重复声明问题

### 🔊 音频输出设备选择（Windows）

**新增功能**：
- 在设置面板中添加音频输出设备选择下拉菜单（仅 Windows Chrome/Edge 支持）
- 使用 `navigator.mediaDevices.enumerateDevices()` 枚举音频输出设备
- 使用 `audio.setSinkId(deviceId)` 切换音频输出设备
- 支持保存用户选择到 localStorage，下次启动时自动恢复
- 添加"刷新设备列表"按钮，方便用户更新设备列表

---


## v2.8.12p3 (2026-06-04)

### 🏷️ 多角色合并格式创作信息检测（CREDIT_MULTI_PAT）

**问题**：如 `词/曲：某人`、`编曲/混音/制作：某人` 等用 `/` 分隔的多角色合并格式，因 `CREDIT_PAT` 不匹配 `词/曲` 或 `编曲/混音/制作` 组合键，被漏识别为歌词行。

**修复**（`js/app.js` ~L1436）：
- 新增 `CREDIT_MULTI_PAT`：匹配 `角色名(/角色名)+[：:\s]` 模式（如 `词/曲：`、`编曲/混音/制作：`、`Lyrics/Composed by`）
- `isCredit()` 更新为 `CREDIT_PAT || CREDIT_MULTI_PAT || EN_CREDIT_PAT || OA_OC_PAT`
- `CREDIT_MULTI_PAT` 先于 `EN_CREDIT_PAT` 检测，避免中文多角色被英文误匹配

### 🎨 创作信息容器纵向堆叠布局（真正独立成行）

**根因**：p2 中 `.lrc-credits` 容器未声明 `display: flex; flex-direction: column`，仅靠 `.lrc-credits-row` 自身的 `display: flex` 不足以阻止兄弟行横向并排——浏览器可能将多个 `inline` 级兄弟挤到同一行。

**修复**：
- `.lrc-credits` 添加 `display: flex; flex-direction: column; align-items: center; gap: 6px; box-sizing: border-box`
- `.lrc-credits-row` 增加 `width: 100%` 占满容器宽度
- `.lrc-credits-tag` 添加 `flex-shrink: 0` 防止标签被压缩
- `.lrc-credits-val` 添加 `flex: 1; text-align: left` 优化超长名单的占位与换行

**涉及文件**：`css/base-layout.css`、`js/app.js`、`index.html`（版本号标题）

---

## v2.8.12p2 (2026-06-04)

### 🩹 创作信息卡片 CSS 紧急修复

**问题**：v2.8.12 为控制超长名单宽度，将 `.lrc-credits-row` 从 `display: flex; flex-wrap: wrap` 错误改为 `display: inline`，导致所有创作信息行坍塌为内联文本流，**逐行换行完全丢失**——所有词/曲/编/录信息挤作一团。

**修复**：
- `.lrc-credits-row` 还原 `display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 8px`，恢复每行独立 flex 布局
- `.lrc-credits-row` 新增 `max-width: 100%`，配合 `.lrc-credits-val { min-width: 0; word-break: break-word }` 实现真正的"不撑爆、自然换行"
- `.lrc-credits` 最大宽度改为 `max-width: 100%`（其在 `.col-lyrics` padding 内已天然受约束）

**涉及文件**：`css/base-layout.css`、`index.html`（版本号标题）

---

## v2.8.12 (2026-06-04)

### 🔥 双语模式自启检测（免版权标记）

**问题根因**：部分 TME 双语 LRC（如 DAMIDAMI）不含"TME享有翻译著作权"等版权标记，导致 `hasCopyright = false` → `isBilingual = false`，整片歌词以降级单语模式显示，翻译-原文链式配对完全失效。

**修复方案**：
- **Phase 5b 启发式检测**：当无版权标记时，统计 `lyricStart` 之后歌词区域的 `pair`（同时间戳双行）和 `single`（独立时间戳行）数量
- **判定阈值**：若 `pairCount > 0 && pairCount > singleCount`（歌词区域 pair 占比 > 50%），自动启用双语链式解析
- 此逻辑精确区分 DAMIDAMI（大量 pair）与真正单语 LRC（极少 pair），不会误判

**验证文件**：`DAMIDAMI-《绝区零》卢西娅EP - Sihan&三Z-STUDIO&HOYO-MiX.lrc`

### 🩹 沉浸舱/PiP 当前歌词行空白跳转

**问题**：v2.8.10p2 中沉浸模式和画中画的「下一行歌词」已跳过 `isBreak`/`isBlank` 空行，但「当前行歌词」在时间戳落于空行时直接清空显示，造成行间闪烁空白。

**修复**：
- **沉浸模式 `syncLyrics()`**：当前 `activeIdx` 命中 `isBreak`/`isBlank`/空文本行时，**向上遍历**查找最近的有内容歌词行作为显示值；下一行查找保持不变（向下跳过空行）
- **PiP `updatePipUI()`**：完全对称处理 —— 当前行向上跳过空行，下一行向下跳过空行

### 🏷️ 创作信息检测彻底扩充（基于 TME 清单最终版）

基于 `TME_LRC创作信息要素捕捉清单_最终版.md`，将创作信息正则从 ~30 个标识扩充至 **40+ 标识**：

**新增中文标识**：`母带工程师`、`母版制作`、`录音师`、`音频编辑`、`人声编辑`、`数字编辑`、`混音工程师`、`缩混`、`Rap`、`Rap flow`、`音乐统筹`、`配唱制作人`、`合声演唱`、`合声编写`、`和声编写`、`吉他演奏`、`鼓编程`、`所有乐器`、`音乐监督`、`艺人及作品管理`、`监制`、`词曲`

**新增英文标识**：`Rap`、`Rap flow`、`Music Coordinator`、`Vocal Producer`、`Backing Vocal`、`Guitar Performance`、`Audio Editing`、`Vocal Editing`、`Digital Editing`、`Mix Engineer`、`Mixing`、`Mastering Engineer`、`Mastering`、`Music Supervisor`、`Artist & Works Management`、`Executive Producer`、`Presented By`、`Released By`、`Lyricist`

**OA_OC_PAT 扩展**：`OP`、`SP`、`ISRC`、`Arranger`、`Producer`、`Presented By`

**`looksLikeNameList` 强化**：新增多 `&` 分隔长文本检测（`.+&.+&.+`），覆盖 ILLIT 等外文艺人名单

### 🎨 创作信息卡片宽度约束

**问题**：超长创作信息行（如 `Written by：Brian Lee/William Grigahcine/Justin Bieber/Ali Tamposi/Andrew Wotman/Louis Bell`）会撑破歌词列宽度。

**修复**：
- `.lrc-credits` 添加 `max-width: 100%`、`overflow-wrap: break-word`
- `.lrc-credits-row` 保持 `display: flex; flex-wrap: wrap`（每行独立换行）+ 添加 `max-width: 100%`
- `.lrc-credits-val` 添加 `word-break: break-word; overflow-wrap: break-word; min-width: 0`，通过 `min-width: 0` 允许 flex 子元素在必要时收缩换行
- `.lrc-credits-tag` 保留 `white-space: nowrap`（标签不折断）

---

## v2.8.10 (2026-06-03) 🌍 全球发行版

### 🔥 LRC 解析引擎 — 基于 TME 真实编码格式完全重写

**核心规则**（基于用户提供的 12 个真实 LRC 文件逆向分析）：
- **同时间戳配对**：两行时间戳完全一致 → 第一行 = 上一句的翻译，第二行 = 本句原文
- **独立时间戳行（双语模式）**：有且只有不与其它行重复的时间戳 → 单行原文，无翻译
- **空第一行配对**：第一行空置/空格 + 第二行非空 → 上一句无翻译
- **版权标记确认**：`TME享有本翻译作品的著作权` / `腾讯享有` / `文曲大模型` / 乱码版 → 确认双语模式
- **独立空行保留**：单语模式中独立时间戳空行 → 有意空置，保留可见空白
- **kana 罗马音**：`[kana:数字+假名]` → 解析为注音序列并呈现

**旧版问题根因**：
- v2.8.9 的 `isTranslationLine()` 启发式规则依赖中文检测，但「隙」等日→中双语文件存在中文原文行，导致误判
- `isSingleLang` 守卫语句在日→中双语场景下将其误判为双语（全曲中文 > 3 字符）
- 元数据行与歌词行的分界点判断不准确，导致创作信息进入歌词

**新版架构**：分 7 个阶段处理：kana 解析 → 条目提取 → 版权检测 → 配对分组 → 元数据模式匹配 → 歌词分界 → 歌词构建

### 🎨 创作信息 UI 焕新

- 词/曲/编曲/制作等元数据不再被清除，而是提取为 `.lrc-credits` 轻盈卡片
- 显示在歌词区顶部，带半透明背景 + 圆角边框
- 标签（词/曲/编曲）使用主色高亮，值使用副色

### 🎯 UI 精修

- **移除 (QQ音乐) 品牌标签**：设置界面"偏上 (QQ音乐)" → "偏上"
- **下一句歌词还原一致模糊**：`blur(0px/1px)` → `blur(2px)`，与其他非活跃行完全一致的 Apple Music 风格
- **前 5 句 margin-top 渐缩**：64px → 48px → 36px → 24px → 14px，防止歌词一开始就贴顶
- 有创作信息卡片时，渐缩 margin 自动取消（因卡片已占据顶部空间）

### 🔄 Crossfade 实验性优化

- 开启时立即初始化 AudioContext（而非等到触发交叉淡变时），避免 `createMediaElementSource` 延迟调用问题
- 设置面板添加 **⚠ 实验性功能，可能无法正常生效，不推荐开启** 警告提示

### 📱 PWA 版本检测

- 不再在任何场景展示「安装」按钮（移除 `beforeinstallprompt` 监听）
- 检测到 `display-mode: standalone` 或 `navigator.standalone` → 弹 toast：「🎉 尊敬的PWA版本用户，欢迎使用 MBolka Player」

---

### 🩹 v2.8.10p2 追加修复 (2026-06-03)

**LRC 解析器增强**：
- **末尾翻译配对**：双语歌词末尾三行中，若倒数第三与倒数第二同时间戳（pair 模式），则将倒数第一歌词行自动判定为倒数第二行的翻译
- **双语空独立行 → verse break**：双语模式中「有且只有不与其它行重复的独立时间戳」空行标记为 `isBreak`，表示新唱段分隔，视觉保留固定矮高度（18px），沉浸舱/PiP 中不显示
- **单语空独立行保留**：独立时间戳有意空置行使用 `.blank` 类，固定 24px 高度，略小于正常歌词行
- **创作信息检测扩展**：新增 `Written by`、`制作人`、`制作/版权`、`OA`、`OC`、`Arranger`、`Producer`、`Presented By`、`母版` 等模式识别；新增名字列表启发式检测（`(` 开头 / 长串 `/` 分隔名单）以正确覆盖 ILLIT 等复杂创作信息块

**歌词视觉优化**：
- **首尾 spacer**：歌词列表头部和尾部各添加 `40vh` 空白 spacer（偏上模式 20vh），确保创作信息和末行歌词均可居中显示
- **下一句 hover 修复**：完全移除 `.lrc-line.active + .lrc-line` 特殊规则（含偏上模式），下一句使用与其他非活跃行完全一致的样式，`:hover` 时高斯模糊自动解除
- **沉浸舱下一句跳过空行**：`syncLyrics` 在查找下一句时跳过 `isBreak` / `isBlank` 行，直接跳至下一个有内容的歌词行
- **空行固定高度**：`.lrc-line.break` (18px) / `.lrc-line.blank` (24px)，不可点击、无 hover 效果、无模糊

**切歌歌词归零**：
- `loadLrc` 加载新歌词后自动 `.scrollTop = 0`，确保切歌/选曲时歌词回到 `[00:00.00]`

**收藏按钮视觉**：
- 未收藏状态从 `🤍` (白心) → `🩶` (灰心)
- 主界面按钮、播放列表、画中画三处同步更新，已收藏显示 `❤️`

---

## v2.8.9 (2026-06-03)

### 🔥 LRC 歌词解析引擎全面重写

**根因**：单语 LRC 被误识别为双语（isTranslationLine 长度规则假阳性、元数据行漏跳过），双语 LRC 存在漏识别（pendingOriginal 已翻译后后续行被静默丢弃）。

**修复方案**：
- **预扫描中文计数**：全文件 < 3 个中文字 → 纯单语守卫，跳过所有翻译检测
- **元数据行检测扩展**：新增英文制作信息（Lyrics by / Composed by / Arranged by / Produced by）、版权行（TME享有 / 著作权 / Copyright）、创作信息行（0~10s 内含 ` - ` 模式）
- **移除粗糙的长度规则**（Rule 4：txt.length < original.length * 0.5）— 主要假阳性来源
- **pendingOrig 生命周期修正**：原文被赋翻译后立即 `pendingOrig = null`，后续行作为新原文
- **双重保护**：翻译行检测时若 `pendingOrig.translation` 已存在 → 强制 `pendingOrig = null`

### 🔥 Crossfade 引擎 — Web Audio API 全面重写

**旧架构**：rAF + `audio.volume` 指数动画 → 帧精度 ±16ms，可能掉帧

**新架构**（Chrome 148）：
- **固定双槽位 A/B**（`audio` + `cfAudioB`）— 永不交换元素
- **AudioContext lazy-init**（首次需要时创建，符合自动播放策略）
- **GainNode 精确定时斜坡**：`gain.exponentialRampToValueAtTime()` — 亚毫秒精度，零掉帧
- **提前 50% 预加载**：`setTimeout` 在当前歌曲 50% 时预加载被动槽
- **Semaphore 防重叠**：`cfTransitionId` 事务版本号 + `cfAirLocked` 门禁锁
- **3 秒超时回退**：预加载超时自动降级为 `goNext()` 直接切歌

---

## v2.8.8 (2026-06-03)

### 🎯 歌词垂直居中修复

**根因分析**：4个独立根因导致歌词定位偏移——(1) CSS `padding:50%` 基于宽度而非高度；(2) `offsetTop`/`clientHeight` 在CSS过渡期间值不稳定；(3) `transform:scale(1.05)` 未纳入视觉高度计算；(4) 未强制重排就读取布局属性。

**修复方案**：
- 强制重排 (`void line.offsetHeight`) 确保读取最新布局
- 使用 `getBoundingClientRect()` 替代 `offsetTop`/`clientHeight`
- 纳入 `scale(1.05)` 因子修正视觉高度
- CSS `.lrc-viewport` padding 从 `50%` 改为 `20px`（固定值）
- 添加 `window resize` 监听器（150ms防抖），窗口变化时重新居中

### 🔗 双语歌词解析增强

**问题**：链式LRC格式中，翻译行与下一句原文同时间戳，原有分组算法将翻译和原文放入同一 group，导致配对错误。

**修复**：移除按时间戳分组逻辑，改为逐行处理。新增 `isTranslationLine()` 启发式检测函数（4条规则）：
1. 时间戳差 < 0.1s → 翻译
2. 本行含中文，上行不含 → 翻译
3. 纯中文 vs 纯ASCII 组合 → 强信号
4. 长度 < 上行50% → 翻译

### 🎨 下一句歌词中间模糊厚度

- `.lrc-line.active + .lrc-line` 模糊值：`blur(0px) !important` → `blur(1px)`
- 视觉层次：当前行(0px) > 下一句(1px) > 其他行(2px)

### 🎮 B键高优先级退出所有浮窗

- 新增 `closeSettings()` / `closePlaylist()` / `closeCoverLibrary()` / `closeHelp()` / `closeFileInfo()` 专用关闭函数
- `handleGlobalClose()` 按浮窗ID路由到对应关闭函数（带动画+焦点恢复+设置保存）
- `pollGamepad` 中 B键最高优先级拦截，先于所有其他逻辑

### 🕹️ 手柄适配逻辑全面重写

**焦点系统**：
- `updateFocusContext()` 按浮窗类型收集所有可交互元素（含 `input[range]`/`checkbox`/`select`）
- `moveFocus2D()` 增强：跳过不可见元素、视口外惩罚(+10000)、元素面积奖励

**按钮映射重写**：
| 按钮 | v2.8.7 | v2.8.8 |
|------|--------|--------|
| A | 确认/播放 | 元素感知确认（滑块→微调、复选框→切换、下拉→聚焦） |
| B | 退出 | 退出（含滑块微调退出） |
| X | 收藏 | 播放/暂停（全局） |
| Y | 循环模式 | 沉浸模式切换 |
| LB | 上一首 | 设置中切换选项卡 / 上一首 |
| RB | 下一首 | 设置中切换选项卡 / 下一首 |
| LT | 降低音量 | 快退 5秒 |
| RT | 增加音量 | 快进 5秒 |
| L3 | — | 焦点模式切换 |

- 新增滑块微调模式：焦点在 `range` 输入框上按A进微调，方向键调整值，B退出

### 🎨 沉浸模式修复

- `.imm-wrapper` 添加 `background:transparent` + `isolation:auto` 修复 backdrop-filter 模糊被阻断
- 非双语歌词沉浸模式显示：当前句原文 + 下一句原文

---

## v2.8.7 (2026-06-03)

### 🔧 空翻译检测 — 避免误用下句原文

**根因**：v2.8.6 链式解析中 `group.entries.filter()` 会过滤空字符串，如果同名时间戳首行为空（翻译空置），过滤后的 `texts[0]` 变成了本句原文而非上一句翻译，导致将"下一句原文"错误赋值给上句的 `translation`。

**修复**：在过滤前增加 `hasTranslation` 检查（`group.entries.length > 1 && group.entries[0] && group.entries[0].trim()`），只有翻译非空时才赋值。翻译空置时 `isBilingual` 保持 `false`，歌词以单行显示。

### 📝 翻译行字号缩小

- 激活翻译行：`font-size: 0.95em` → `0.75em`，视觉层次明显（原文/翻译分层清晰）

### 📺 PiP 歌词回退

- `pipCurrLine` = 当前句原文，`pipNextLine` = 下一句原文（不显示翻译）
- 与沉浸舱行为保持一致

### 🎵 Crossfade 引擎系统性重写

**问题诊断**：
1. `audio.src = nextAudio.src` 导致音频重新加载，丢失淡入效果
2. `isFading` 布尔锁在多个异步路径中容易遗漏重置
3. `setInterval` + 固定步长导致音质步进感
4. `playing` 事件触发时机不稳定

**v2.8.7 新架构**：

| 组件 | 变更 |
|------|------|
| **状态机** | `CrossfadeState { IDLE, PRELOADING, FADING, COMPLETED }` 替代 `isFading` 布尔锁 |
| **音频池** | `audioPool = [audio, nextAudio]`，Crossfade 完成后 swap 活跃元素 |
| **rAF 动画** | `performCrossfade()` 使用 `requestAnimationFrame` + `performance.now()` 驱动 |
| **指数曲线** | 淡入淡出使用 `Math.pow(progress, 2)` 替代线性，人耳感知更自然 |
| **async/await** | `triggerCrossfadeV2()` 显式 `await nextAudio.load()` 预加载 |
| **旧版删除** | 移除 `triggerFadeOutLegacy()` 和 `triggerFadeInLegacy()`，降级走 `goNext()` |

**关键修复点**：
- `finishCrossfadeV2()`: 直接 swap audio 元素而非复制 src
- `playAudio()`: 手动切歌时取消 rAF + 停止池中音频 + 重置 `crossfadeState`
- `goNext()`: 用 `crossfadeState !== IDLE` 替代 `isFading` 检查

### ™️ 其他

- **版本号更新**：`index.html`、`app.js`、版权区域统一为 v2.8.7

---

## v2.8.6 (2026-06-03)

### 🔧 双语LRC链式解析 — 专项修复

**根因**：v2.8.5 的 Map 分组算法将同时间戳的两行视为"同一句的原文+翻译"，但实际 LRC 格式是**链式结构**——同时间戳第一行 = **上一句原文的翻译**，第二行 = **本句原文**。导致"上一句翻译被合并到下一句原文"的配对错误。

**修复**：`parseLyricText()` 完全重写为三阶段链式解析：

1. **顺序分组**：按时间戳分组，保持同时间戳内行序
2. **元数据过滤**：`isMetaLine()` 识别制作信息行（曲、编曲、词、TME版权 等），重置翻译链
3. **链式赋值**：`pendingOriginal` 追踪上一句原文，本组第一行→赋值给上一句的 `translation`，本组最后一行→新的 `original`
4. **最终兜底**：链尾未配对的原文保持单语

**链式算法示意**：
```
[00:02.69] Cross my heart          ← 原文1, pendingOriginal="Cross my heart"
[00:03.84] 胸前画十字 郑重起誓     → 赋值给原文1.translation ✓
[00:03.84] we'll always            ← 原文2, pendingOriginal="we'll always"
[00:04.70] 我们会永远              → 赋值给原文2.translation ✓
```

### 🎬 沉浸模式 + PiP 双行回退

- **沉浸模式**：`immCurrLine`=原文，`immNextLine`=翻译（不再预告下一句），翻译行 `opacity` 从 0.7 提升到 **0.85**
- **PiP 画中画**：`pipCurrLine`=原文，`pipNextLine`=翻译（不再显示下一句歌词），翻译行 `opacity` 设为 **0.85**，无翻译时隐藏

### 📋 CSS 清理

- **`immersive.css`**：移除重复 `.imm-subtitle-line` 过渡规则，翻译行颜色从 `rgba(255,255,255,0.5)` 调整为 `0.6`

### ™️ 其他

- **版本号更新**：`index.html`、`app.js`、版权区域统一为 v2.8.6

---

## v2.8.5 (2026-06-03)

### 🐛 双语LRC解析重写

- **Map分组算法**：`parseLyricText()` 从"两遍扫描+容差合并"重构为 Map 精确分组（按 `time.toFixed(3)` 做键），同时间戳第一行=原文、第二行=翻译，彻底解决"上一句翻译被错误合并到下一句原文"的问题
- **`text` 字段兼容**：有翻译时 `text = original + \n + translation`，进度条预览自然显示双语

### 🎬 沉浸模式歌词动画回退 + 延迟修复

- **回退简单动画**：从 CSS `switching`/`active` 类+`transitionend` 回归简洁的 `el.style.opacity=0` + `setTimeout` 动画（旧版 final1.0 验证有效的方案）
- **修复更新延迟**：`syncLyrics` 的 `activeIdx` 计算从顺序扫描 `-0.2` 偏移改为**逆序精确匹配**（从后往前找到第一个 `cur >= time`），消除约 1 秒的更新延迟
- **不再显示下一句**：沉浸模式 `immNextLine` 改为显示翻译文本（有双语时）或无文本（单语时），不再提前展示下一句歌词
- **移除 `lrcTransitionLock`**：清理 v2.8.4 引入的过渡锁变量及相关兜底计时器

### 📐 新增歌词垂直对齐模式

- **两种模式可选**：垂直居中（默认）和偏上显示（QQ音乐风格，距顶部30%）
- **设置面板新增切换按钮**：`btnLrcAlignCenter` / `btnLrcAlignTop`，带视觉激活状态
- **`updateLrcAlignUI()` 函数**：同步按钮状态 + 切换 `.lyrics-align-top` CSS 类
- **持久化存储**：`lyricsAlignMode` 写入 `localStorage`（`saveSettings` / `loadSettings`）

### 🎵 Crossfade 跨曲修复

- **`getNextTrackIndex()` 统一选择**：提取独立函数，Shuffle 模式排除当前歌曲随机选（与 `goNext` 一致），顺序模式取下一首
- **`triggerCrossfade()` 改用统一逻辑**：从 `Math.floor(Math.random()*length)` 改为 `getNextTrackIndex()`，交叉淡入淡出的歌曲 = 下一首实际播放的歌曲
- **`goNext()` 防重入**：`isFading` 时直接 return，阻止 crossfade 末尾再次触发切歌导致混音
- **`finishCrossfade()` 状态管理**：切换前清除 `audio.onended = null`，播放后延迟 1 秒重新绑定
- **防御性检查**：`checkCrossfade` 新增 `isNaN(remaining)` / `audio.paused` / `audio.ended` 三项检查

### 📋 CSS 调整

- **`base-layout.css`**：双语翻译样式简化（`opacity:0.5→0.9` 过渡），新增 `.lyrics-align-top` 偏上模式样式
- **`immersive.css`**：移除 v2.8.4 的 `.switching`/`.active` CSS 过渡类，移除 `.imm-original`/`.imm-translation` 双 span 样式

### ™️ 其他

- **版本号更新**：`index.html` 标题、`app.js` 文件头、版权区域版本号统一为 v2.8.5

---

## v2.8.4 (2026-06-03)

### 🐛 双语LRC解析重构

- **两遍扫描算法**：`parseLyricText()` 从"向前看一行"改为"两遍扫描"——先提取所有时间戳条目，再按时间戳分组合并（容差0.02秒），彻底消除同时间戳双语歌词被拆分为独立条目导致的重复行问题
- **字段一致性**：合并后 `text` 保留原文（兼容单语场景），`original`/`translation` 分别存储原文和翻译
- **歌词面板**、**沉浸模式**、**进度条预览**三者数据完全对齐，不再出现显示错乱

### 🎬 沉浸模式歌词动画防频闪

- **CSS transition 替代硬编码 setTimeout**：`el.style.opacity = 0` + `setTimeout` 改为 CSS `switching`/`active` 类切换，利用 `transitionend` 事件精确完成动画
- **过渡锁 `lrcTransitionLock`**：防止快速切歌时多个 setTimeout 堆叠导致的透明度抖动
- **300ms 兜底保护**：若 transition 未触发（元素隐藏等极端情况），自动强制完成动画
- **新增CSS样式**：`immersive.css` 中 `.imm-subtitle-line.switching`（opacity:0 + translateY）、`.imm-subtitle-line.active`（opacity:1）过渡类

### ⚡ 节能模式状态机重构

- **位标志状态机**：从布尔状态 `isEnergySaving` + 多个标记变量重构为 `EnergyMode` 位标志（`NONE/ONE_CLICK/PIP_TEMP/FRAME_LIMIT/VISIBILITY`），支持多模式叠加共存
- **`enterEnergySaving(mode)` / `exitEnergySaving(mode)`**：按位 OR 进入、按位 AND NOT 退出，精准控制每种模式的启停
- **`applyEnergySaving(enable, triggerMode)`**：实际执行节能操作（清空粒子、释放流场、降频歌词），仅在首次进入/完全退出时触发
- **一键节能 + 画中画叠加**：开启一键节能后打开画中画，关闭画中画后一键节能保持；`visibilitychange` 只退出 `VISIBILITY` 模式不误退其他
- **向后兼容**：旧变量 `isEnergySaving`、`pipTempEnergySaving`、`oneClickEnergySaving` 保留并同步更新

### 🎵 曲库浮窗关闭逻辑修复

- **播放整张专辑**：从 `detailModal.remove(); parentModal.remove()` 改为 `safeTransition()` 统一关闭，消除 DOM 状态残留导致的浮窗无法二次打开问题
- **曲目点击播放**：从 `detailModal.remove(); parentModal.remove()` 改为 `closeAllModals()` 标准关闭流程
- **关闭详情动画**：点击遮罩关闭统一走 `closeDetail()` 函数，确保 `parentModal` 焦点恢复

### 🎮 手柄B键退出增强

- **handleGlobalClose z-index 排序**：从简单数组最后一项（DOM顺序）改为按 CSS `z-index` 排序，正确识别视觉最上层浮窗
- **动态弹窗动画移除**：动态创建的弹窗（统计、专辑详情）关闭时先移除 `.open` 类触发过渡动画，400ms 后再移除 DOM
- **焦点智能恢复**：关闭后延迟 50ms 调用 `updateFocusContext()`，确保焦点正确退回下层

### 📋 updateFocusContext 增强

- **z-index 优先级检测**：按 `z-index` 排序活跃浮窗，优先聚焦最上层浮窗内的 `.focusable` 元素
- **无适配元素兜底**：若浮窗内无 `.focusable`，自动聚焦 `.modal-content`

### ™️ 其他

- **版权署名**：设置页面底部 `co-created with` 添加 QClaw
- **版本号更新**：`index.html` 标题、`app.js` 文件头、版权区域版本号统一为 v2.8.4

---

## v2.8.3 (2026-06-02)

### 🌏 双语LRC歌词支持

- **智能双语检测**：`parseLyricText()` 自动识别同时间戳的双语歌词行（原文+翻译），合并为单条记录
- **主界面显示优化**：原文正常高亮，翻译行以较小字号、较低透明度显示；激活时翻译跟随提升
- **沉浸模式双语适配**：原文大字高亮，翻译行紧随其后（稍小但清晰），支持画中画模式响应式适配
- **进度条预览合并**：`getLyricAtTime()` 返回 `"原文 | 翻译"` 格式，进度条悬停时显示双语预览
- **新增 `escapeHtml()` 辅助函数**：防止歌词内容中的HTML标签被解析为DOM元素

### 🎵 交叉淡入淡出引擎重构

- **真正的双轨交叉播放**：使用 `requestAnimationFrame` 实现当前歌曲淡出、下一首淡入的平滑过渡
- **预加载机制**：提前创建第二个 `Audio` 元素加载下一首，确保无缝切换
- **高精度进度检测**：每100ms通过 `performance.now()` 检查播放进度，避免 `timeupdate` 精度不足问题
- **降级兼容方案**：预加载失败时自动回退到旧版 `triggerFadeOutLegacy()` 逻辑
- **手动切歌保护**：`playAudio()` 中强制取消正在进行的交叉淡入淡出，立即恢复标准音量
- **修复 `once` 参数**：`triggerFadeInLegacy()` 中 `{ once: false }` 修正为 `{ once: true }`
- **新增 `crossfadeRafId` 全局变量**：管理交叉淡入淡出的 `requestAnimationFrame` ID

### 📋 其他

- **版本号更新**：`index.html` 标题和 `app.js` 文件头更新至 v2.8.3
- **新增CSS样式**：
  - `base-layout.css`：`.lrc-line.bilingual`、`.lrc-original`、`.lrc-translation` 样式
  - `immersive.css`：`.imm-original`、`.imm-translation` 沉浸模式双语歌词样式
  - `components.css`：`.crossfade-indicator` 交叉淡入淡出状态指示器

---

## v2.8.2 (2026-06-02)

### ⚡ 节能板块整合重构

- **统一节能板块**：将散落的节能功能整合到"⚡ 节能模式"黄色高亮板块
- **🔋 一键节能**：去除所有可视化动效，保持正常亮度（不添加 `pip-standby` CSS 暗黑类）
- **🎬 画面节能**：仅将动画帧率降至 30fps，保留视觉效果（替代旧性能模式）
- **📺 临时节能**：启动画中画时自动优化主界面性能（画中画关闭后自动退出）
- **移除旧 UI**：EQ 面板下的性能模式按钮已整合，不再单独显示

### 🔧 画中画节能状态同步修复

- **`pipTempEnergySaving` 标记**：区分"画中画临时节能"和"手动节能"，关闭画中画时自动退出临时节能
- **`visibilitychange` 修复**：标签页返回时检查画中画状态，防止意外退出节能模式
- **`exitEnergySaving` 防御**：画中画运行时阻止退出临时节能模式

### 📝 设置页面命名规范统一

- **去除技术术语**：移除"核心视觉引擎"、"UI 视觉引擎"等描述
- **统一格式**：`emoji + 简要功能名 +（快捷键）`
- **12 处命名优化**："封面取色"、"主题色"、"背景图片"、"均衡器"、"快捷键指南"等
- **移除设置中画中画按钮**：仅保留主界面播放器上的画中画入口

### 🚀 性能优化深度改进

- **Page Visibility API**：页面不可见时暂停高频渲染循环，降至 500ms 间隔心跳
- **GPU 优化**：`Particle.draw()` / `Ripple.draw()` 用 `globalAlpha` 缓存替代 `save()/restore()`，减少 overdraw
- **内存优化**：粒子对象池根据 `navigator.hardwareConcurrency` 动态调整（低端设备 80 vs 高端 150）

### 📋 配置兼容性

- 旧版 `performanceMode` → 自动映射到 `cfg.frameEnergyEnabled`
- 旧版 `energySavingEnabled` → 自动映射到 `cfg.pipEnergyEnabled`
- 设置数据自动迁移，无需手动重新配置

---

## v2.8.1 (2026-06-02)

### 🔧 画中画节能模式加强

- **exitEnergySaving 防御性检查**：防止在画中画激活时意外退出节能模式
- **togglePip 状态管理优化**：关闭画中画时根据用户设置决定是否保持节能模式，画中画启动时强制进入节能模式
- **健康检查兜底同步**：定时器关闭时也遵循节能设置

### 🎬 专辑详情动画修复

- **双重 requestAnimationFrame**：确保模态框 `.open` 类分帧添加，触发 CSS 弹入动画
- **关闭动画优化**：先移除 `.open` 类触发退出动画，400ms 后再移除 DOM 节点

### 🎮 手柄适配完善

- **EQ 预设按钮**：添加 `.focusable` 类和 `tabIndex`，支持手柄/键盘导航
- **activateFocus 增强**：区分专辑曲目、EQ 预设按钮等元素类型做精准处理
- **按钮映射优化**：X 键→收藏，Y 键→循环播放模式（更符合直觉）
- **手柄提示徽章扩展**：新增画中画按钮和设置按钮的手柄提示

### 📋 设置浮窗菜单重构

- **新排序**：文件 → 显示 → 音频 → 音效 → 歌词 → 其它 → 系统
- **自定义背景整合**：从"其它"区域移至"显示"区域紧跟主题色
- **快捷键指南更新**：同步 X/Y 键映射变更

---

## v2.8.0 (2026-06-01)

### ⚡ 节能模式精确控制 + 沉浸舱完整停止

- **渲染守卫重构**：节能ON时全局跳过所有绘制（含沉浸舱），不再有沉浸模式渲染泄漏
- **沉浸舱强制退出**：`enterEnergySaving()` 自动退出沉浸模式，停止所有动画特效并释放 `flowField`、`particles`、`ripples` 内存
- **主频谱Canvas清空**：节能激活时同时清空主界面频谱显示
- **节能关 = 完整主界面**：关闭节能开关时，PiP激活也不影响主界面频谱、取色背景、流沙渲染

### ⌨️ 键盘快捷键全面升级

| 快捷键 | 功能 | 说明 |
|---|---|---|
| **Ctrl+O** | 打开文件夹载入音乐 | 最高效的载入方式 |
| **U / F** | 收藏/取消收藏当前歌曲 | 快速标记喜爱的歌 |
| **/** | 聚焦搜索播放列表 | 类似 YouTube 体验 |
| **Shift+F** | 全屏开关 | F键改用于收藏 |
| **Alt+T** | 睡眠定时器快速菜单 | 弹窗式秒设定时 |
| **Shift+Esc** | 一键关闭所有弹窗 | 强制回到主界面 |

### 🎮 手柄体验升级 — 按键指示器

- **手柄接入时自动注入 ⓐⓑⓧⓨ 徽章**：播放按钮标注 ⓐ，关闭按钮标注 ⓑ，模式切换标注 ⓧ 等
- **断开手柄自动清除**：所有徽章随手柄断开而移除
- **曲库-专辑详情 B键**：`handleGlobalClose` LIFO栈式关闭，B键先关详情再关曲库
- **手柄专属帮助面板**：帮助面板新增完整的游戏手柄操作指引表

### 🎨 设置页面 UI 重构

- **载入音乐移至设置页最顶端**：主页面更简洁，设置页首行醒目的 `📁 打开文件夹` 按钮
- **专辑封面取色模式提升为视觉核心**：独立取色引擎板块，状态标签实时显示激活状态，配色预览条
- **预设主题色归入 UI 视觉引擎**：取色模式开启时覆盖所有预设主题，关闭时预设主题复活
- **深色模式 + 背景模糊独立为视觉调节板块**

### 🩹 修复

- **专辑详情弹入动画**：`.album-detail-panel` 新增 `scale(0.9)→scale(1)` 弹簧动画，与所有弹窗一致
- **专辑详情手柄导航**：`updateFocusContext` 正确检测 `.album-detail-panel` 内 `focusable` 元素
- **空状态提示更新**：移除已不存在的"载入音乐"按钮引用，改为 Ctrl+O 提示

---

## v2.7.0-preview2 (2026-06-01)

### 🧹 内存优化 — 杜绝泄漏

- **P0: Blob URL 彻底回收**：`releaseAllBlobUrls()` 新增强制遍历 `playlist` 和 `musicLibrary`，释放所有残留的 `blob:` URL，每次载入新文件夹时旧音乐资源完全回收，内存不再随切换堆积
- **P1: 沉浸模式流场释放**：退出沉浸模式时将 `flowField` 置为空数组，大数组立即进入 GC 可回收状态
- **P1: PiP 定时器兜底清理**：`pipSyncInterval` 提升为模块级变量，关闭 PiP 时显式 `clearInterval`；新增 10 秒健康检查 `pipHealthCheck`，即使 PiP 窗口被操作系统外部关闭也能彻底清除定时器
- **P2: 播放历史限制**：`playHistory` 数组最大长度限制为 200，防止长时间播放后历史无限增长
- **P3: 统计面板闭包清理**：`showStatsPanel` 关闭时将 `modal` 引用置为 `null`，防止闭包循环引用

### 🩹 修复

- **曲库专辑详情页面**：修复 `renderAlbumGrid`/`renderArtistGrid`/`renderRecentGrid` 中 `modal` 变量作用域丢失问题，`modal` 现在作为参数显式传递，专辑详情面板恢复正常，点击专辑卡片可正确打开详情

---

## v2.6.0 (2026-06-01)

### 🎬 弹窗关闭动画回归 — 渐进式消失

- **`_closeModalsSync(isSwitching)` 双模式关闭**：新增 `isSwitching` 参数区分"切换弹窗"与"普通关闭"
  - `isSwitching=true`（切换弹窗）：禁用 `transition` + 强制重绘，0ms 瞬间消失
  - `isSwitching=false`（普通关闭）：保留 CSS transition，弹窗优雅淡出，恢复关闭动画体验
- **`closeAllModals()` 动画关闭**：传 `false` 让所有弹窗保留过渡动画
- **`safeTransition(fn)` 瞬切**：传 `true` 在弹窗切换时无动画快速过渡

### 👻 封面卡片消除残影

- **移除 `view-transition-name`**：从 `.cover-lib-card .art-wrap` 中移除 CSS `view-transition-name`，彻底消除曲库切换时封面图片的幽灵残影问题

### 🔈 音量系统修复

- **音量保存值修正**：`saveSettings` 中 `vol` 字段从 `audio.volume` 改为 `parseFloat(el.volSlider.value)`，避免保存淡入淡出过程中临时降低的音量值
- **沉浸模式音量滑块同步**：`loadSettings` 和 `adjustVolume` 中新增 `el.immVolSlider` 同步，确保沉浸舱音量滑块与主界面保持一致

### 🪶 画中画微待机模式 (Tiny Standby Mode)

- **主窗口低功耗休眠**：PiP 画中画激活时，主窗口自动添加 `.pip-standby` class
  - 整体透明度降至 0.35，禁止所有鼠标交互（`pointer-events: none`）
  - 专辑封面动画冻结（`animation: none`）
  - 背景层透明度锐减至 0.15
  - Canvas 完全隐藏（`opacity: 0`）
  - 仅 PiP 控制按钮保持可交互并附带呼吸发光脉冲动画
- **渲染层断电**：`renderVisLoop` 中 PiP 激活时，非沉浸模式直接跳过所有主窗口渲染（`return`），大幅节省 CPU/GPU 算力
- **pagehide 清理**：监听 `pagehide` 事件，PiP 窗口关闭时自动移除 `.pip-standby` 状态并更新按钮

---

## v2.5.0-release (2026-06-01)

### 🚀 全域弹窗栈控制器 — LIFO 后进先出完美退出

- **`handleGlobalClose()` 统一关闭管理器**：扫描页面上所有 `.modal-overlay.open` 弹窗（包括静态 HTML 和动态创建的），永远只关闭最上层（LIFO 栈顶）的那一个
- **键盘 Esc 全适配**：优先尝试关闭最上层弹窗，无弹窗打开时才退出沉浸模式；全屏状态优先退出全屏
- **手柄 B 键全适配**：与 Esc 共享同一逻辑，不再需要手动枚举每个弹窗类型
- **完美层级退回**：曲库 → 专辑详情 → 按 B/Esc 先关详情 → 再按 B/Esc 关曲库，层层递进
- **100% 向前兼容**：未来新增的任何弹窗自动获得手柄 B 键和键盘 Esc 退出支持

### 🌊 全域 60FPS 色调同步 — 主页面流沙背景实时取色

- **`renderVisLoop` 核心重构**：色相（Hue）过渡计算提升到函数顶部，不分支、不分界面，不论在主界面还是沉浸模式都统一以 60 帧平滑推进 `currentHue`
- **主页面流沙激活**：`cfg.colorMode` 开启时，主界面每帧调用 `drawFlowingSand()` 实时渲染低分辨率 Canvas 流沙背景，与沉浸舱毫秒级同步变色
- **关闭取色优雅降级**：关闭取色模式时自动清除背景 Canvas，让 CSS 静态预设主题渐变平滑显现
- **帧率控制优化**：`lastFrameTime` 独立作用域，性能模式和 30fps 节能模式正确生效

### 🔧 Bug 修复

- **`.btn-mode.active` 深色反白**：模式切换按钮激活态 `color` 从硬编码 `#000` 改为 `var(--text-on-primary)`，深色主题（深海/星夜）下自动反白
- **弹窗切换视觉残留**：`_closeModalsSync` 临时禁用 `transition` + 强制重绘 `offsetHeight`，实现弹窗 0ms 瞬间消失，消除"曲库→列表"约 1 秒重叠残留
- **专辑详情手柄全适配**：按钮注入 `tabindex="0"`，打开/关闭时主动 `updateFocusContext()` 拉焦点入/退弹窗
- **曲库增量加载恢复**：`renderGridChunked` 每次渲染 12 张卡片，`requestAnimationFrame` 分批递进，彻底解决曲库展开卡顿
- **函数名对齐**：`renderAlbumGridStatic` → `renderAlbumGrid` 等三函数与调用方统一命名

### 🎮 手柄体验增强

- **曲库 B 键退出**：手柄 B 键通过 `handleGlobalClose()` 统一处理，曲库打开时一键退回主页

---

## v2.5.0-preview2 (2026-05-31)

### ⚡ 性能优化四剑客 — CPU 算力节约 + 消除微卡顿

#### 1. 粒子对象池化 (Object Pooling) — 消除 GC 抖动
- **Particle / Ripple 类重构**：从每次 `new` 创建改为对象池模式，程序启动时预分配 150 个 Particle + 20 个 Ripple 实例
- **`acquireParticle()` / `acquireRipple()`**：取代 `new Particle()` 和 `new Ripple()`，从池中激活空闲实例，池耗尽时动态扩展
- **原地迭代替代 `filter`**：`particles.filter(...)` 和 `ripples.filter(...)` 改为 for 循环原地 compact，不再每帧创建新数组
- **`kill()` 方法**：粒子死亡时仅设置 `active = false` 归还池中，零对象创建、零 GC 垃圾

#### 2. 布局抖动消除 — 缓存 DOM 几何属性
- **`bindProgressBar` 重构**：`mousedown/touchstart` 时调用一次 `getBoundingClientRect()` 存入 `cachedRect`，拖拽过程中 `handleMove` 直接使用缓存值，`handleEnd` 时释放缓存
- **`setupProgressHover` 重构**：`mouseenter` 时缓存 rect，`mousemove` 期间使用缓存值，`mouseleave` 时释放

#### 3. 查表法 (LUT) 替代三角函数
- **128 点全圆查表**：`SIN_TABLE[]` / `COS_TABLE[]` 预计算 128 个等分角的三角函数值
- **`lutSin(angle)` / `lutCos(angle)`**：通过角度映射索引直接取值，替代 `Math.sin/cos`
- **沉浸模式频谱弧线**：49 次/帧的 `Math.cos/sin` 调用全部替换为查表

#### 4. GPU 图层升格 — `will-change` 减少重绘
- **`.view-container`**：添加 `will-change: transform, opacity`
- **`.modal-content`**：添加 `will-change: transform`
- **`.player-wrapper`**：添加 `will-change: transform`（独立合成层，避免 backdrop-filter 像素着色器重复计算）

### 🎨 WCAG 无障碍对比度 — `--text-on-primary` 动态反色

- **`getLuminance(colorStr)` 函数**：基于心理学相对亮度公式 `L = 0.299R + 0.587G + 0.114B`，支持 `#hex` 和 `rgb()` 两种格式
- **`applyThemeLogic()` 增强**：每次设置 `--primary` 后自动计算亮度，`luminance < 140` 时 `--text-on-primary` 设为 `#ffffff`（反白），否则为 `#0a0a1a`（深色）
- **CSS 统一替换**：`.btn-glass.active`、`.btn-play`、`.btn-play:hover`、`.cover-lib-tab.active` 的 `color` 从硬编码 `#000` 改为 `var(--text-on-primary)`
- **HTML/JS 内联样式替换**：`btnLoadFolder` 和 `btnPlayAlbum` 的 `color:#000` 改为 `color:var(--text-on-primary)`
- **`:root` 默认值**：`--text-on-primary: #0a0a1a`（匹配默认蓝色主题的浅色背景）

---

## v2.5.0-preview (2026-05-31)

### 🌊 彩色动态流沙背景 — 极低分辨率 Canvas + CSS 强力模糊
- **"高性能秘诀"实现**：`#bg-layer-color` 从 `<div>` 重构为 `<canvas>`，保持 64×64 物理分辨率，每帧使用三层正弦波叠加绘制同色系流体色块
- **CSS 流体质感**：`filter: blur(80px) contrast(1.2)` + `transform: scale(1.1)` 由浏览器 GPU 硬件加速完成放大和模糊，实现如丝顺滑的"彩色流沙/极光"质感
- **音频节奏联动**：Bass 频段（`dataArray[0] + dataArray[1]`）实时影响沙浪速度（最大 2.5 倍）和浪尖高度（`peakAmp`），鼓点强时沙浪翻涌
- **`drawFlowingSand()` 函数**：三层沙浪（暗调底层 + 正弦波中层 A + 余弦波中层 B + 顶层亮沙 C），颜色自动跟随 `currentHue`，配合 `sandPhaseA/B/C` 独立相位
- **性能零负担**：64×64 Canvas 每帧计算量几乎为 0，Windows 11 / Android 17 上接近 0% CPU 占用

### 🎨 预设主题色重构 — 聚焦卡片 + 多场景全域联动
- **卡片化重构**：旧 `.theme-preset` 色块 + `.theme-label` 分离结构 → 新 `.theme-preset-card` 一体化卡片，包含 `.theme-color-circle` 圆块 + `.theme-preset-label` 标签
- **2D 空间聚焦适配**：卡片声明为 `focusable` + `tabIndex=0`，手柄摇杆/十字键可精准导航，`.gamepad-focus` 时边框发光 + `scale(1.08)` + `--primary-glow` 阴影
- **`applyThemeColorAction()`**：统一主题应用入口，同步设置 `--primary` / `--primary-glow` / `--album-color`
- **画中画实时同步**：切换主题时 `pipWindow` 内的 `--primary` 和进度条发光色无缝实时变色
- **`hexToRgb()`**：16 进制颜色转 RGB 辅助函数，支撑 RGBA 发光计算
- **旧样式清理**：移除 `.theme-preset`、`.theme-preset .check`、`.theme-label` 等碎片化样式

### 🌈 主界面频谱彩色渐变
- **灰阶→极光**：主界面频谱柱从死板 `rgba(gray, gray, gray)` 改为 `hsla(currentHue, 75%, ...)` 动态色相渐变，幅值越高越亮越不透明
- 频谱颜色完全跟随当前专辑封面提取色或预设主题色，视觉一致性达到顶峰

### 🔧 `applyThemeLogic` 适配 Canvas
- Canvas 背景不再设置 `style.background`，只需 `classList.add('active')` 激活，颜色由 `drawFlowingSand` 实时渲染



### 🎮 2D 空间导航系统 — 手柄/键盘完美适配曲库网格
- **智能空间寻路算法 `moveFocus2D`**：取代旧版一维循环 `moveFocus`。通过 `getBoundingClientRect()` 计算每个可聚焦元素在屏幕上的物理坐标，按下方向键/摇杆时以加权欧式几何距离算法（主方向距离 + 垂直偏离惩罚系数 2.5）自动计算最近目标，实现网格化 2D 空间导航
- **焦点滚动跟随 `setFocus`**：焦点切换时自动调用 `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`，确保焦点框永远可见
- **键盘 WASD + 方向键**：升级为独立方向映射——`W/↑` 向上、`S/↓` 向下、`A/←` 向左、`D/→` 向右
- **手柄摇杆 4 方向**：左摇杆 X/Y 轴独立判断方向（±0.5 死区），200ms 防抖，取代旧的 `moveFocus(-1/1)` 模糊映射
- **手柄十字键 (D-Pad)**：`btn[12]` 上、`btn[13]` 下、`btn[14]` 左、`btn[15]` 右，全部映射到 `moveFocus2D`

### 🏗️ 曲库弹窗静态化重构 — 动画 100% 统一
- **静态 HTML 化**：曲库弹窗从 `document.createElement` 动态生成改为写入 `index.html` 的 `#coverLibraryModal`，共享 `modal-overlay.open` 类名触发的 CSS 过渡动画
- **动画一致性**：打开时遮罩 `opacity: 0→1` + 面板 `scale(0.9)→scale(1.0)` 弹性弹簧动效，关闭时平滑缩小退场，与列表弹窗/设置弹窗像素级一致
- **焦点扫描升级**：`updateFocusContext` 新增 `album-detail-panel` 和 `#coverLibraryModal.open` 检测，打开曲库或专辑详情时自动切换焦点上下文
- **事件绑定防泄漏**：`modal.dataset.init` 标记确保事件只绑定一次
- **`_closeModalsSync`**：新增静态曲库的 `classList.remove('open')` 关闭逻辑

### 🎯 焦点元素全面标注
- **曲库 Tab 标签**：`cover-lib-tab` 添加 `focusable` + `tabindex="0"`
- **专辑卡片 `createCoverCard`**：`cover-lib-card` 添加 `focusable` + `tabIndex = 0`
- **专辑详情曲目行**：`album-detail-track` 添加 `focusable` + `tabIndex = 0`
- **专辑详情按钮**：`btnPlayAlbum` / `btnCloseAlbumDetail` 添加 `focusable`

### 🎤 歌词面板视觉梯队
- **下一行去模糊**：`.lrc-line.active + .lrc-line` 使用 CSS 相邻兄弟选择器，让紧跟在激活行后的那一行歌词 `filter: blur(0px) !important` + `opacity: 0.75` + `scale(0.98)`，形成清晰的视觉阶梯（当前行完全清晰 → 下一行清晰 → 其余行模糊）

### 🔧 淡入淡出引擎增强
- **`playing` 事件保护**：`triggerFadeIn` 不再盲目启动淡入定时器，改为监听 `audio.playing` 事件，确保音频真正开始播放后才逐步提升音量，防止歌曲因缓冲延迟导致爆音
- **5 秒兜底保护**：如果 `playing` 事件在 5 秒内仍未触发，强制恢复音量 + 解锁 `isFading`，防止永久静音

---

## v2.3.1 (2026-05-31)

### 🔤 全局字体优化
- **新增 OPPO Sans 4.0 优先级字体**：`body` 和 `.pip-container` 的 `font-family` 首位添加 `'OPPO Sans 4.0'`，系统已安装该字体时优先渲染，呈现更精致的文字质感

### 🏷️ 文案统一
- **「封面库」统一改名为「曲库」**：`index.html` 快捷键帮助面板、`app.js` 注释/弹窗标题/渲染函数注释等全部替换

### 🔧 细节修正
- **版权信息补充**：设置页面底部版权添加 CodeBuddy 协作署名
- **版本号同步**：`index.html` 标题、`app.js` 顶部版本号、版权区域版本号统一为 v2.3.1

---

## v2.3.0 (2026-05-31)

### 🚨 关键 Bug 修复（视图层级穿透 + 进度条冲突 + 数据丢失）

- **修复沉浸视图遮罩导致顶部按钮无法点击（终极破案）**：`#view-immersive.hidden` 仅设 `opacity: 0` + `pointer-events: none`，在部分 Chromium 核心浏览器中依然产生隐形事件拦截。现补充 `visibility: hidden`（彻底剔除渲染树）+ `z-index: -1`（强行沉底），同时 `#view-main` 和 `#view-immersive` 分别设置 `z-index: 10/20`，确保视图堆叠上下文绝对正确
- **修复进度条点击/拖拽冲突**：旧版 `setupDraggableProgress` 和 `onclick` 点击事件同时存在，鼠标松手瞬间触发 `mouseup` + `click` 两次修改进度，互相打架。现已统一为 `bindProgressBar` 引擎，整合 mousedown→mousemove→mouseup 流水线，点击即极短拖拽，完美兼容
- **修复播放整张专辑后全库数据丢失**：原 `playlist = albumQueue` 直接覆盖内存，其余歌曲永远消失，封面库随之崩溃。现引入 `musicLibrary`（全库只读容器）+ `playlist`（临时播放队列）双轨制，专辑播放仅修改 `playlist`，封面库始终从 `musicLibrary` 读取

### ✨ 新增功能

- **全库/队列双轨制**：`musicLibrary` 永久保存全部导入歌曲，封面库、搜索、统计永远访问全库；`playlist` 仅负责当前播放队列
- **一键恢复全库播放**：点击播放列表「📋 全部」时，若检测到队列被缩减（如处于专辑播放中），自动从 `musicLibrary` 恢复全部歌曲，提示「已恢复播放全部歌曲」
- **进度条沉浸模式时间同步**：`ontimeupdate` 新增 `immTimeCur`/`immTimeTot` 时间文本同步，沉浸模式进度条数字随拖拽实时更新
- **进度条拖拽防文字选中**：`handleMove` 中增加 `e.cancelable && e.preventDefault()`，防止拖拽时意外选中页面文字

### 🔧 架构优化

- `processFiles` 加载完毕时同步执行 `musicLibrary = [...playlist]`
- `showCoverLibrary` 中 `renderAlbumGrid`/`renderArtistGrid`/`renderRecentGrid` 遍历源从 `playlist` 改为 `musicLibrary`
- `showAlbumDetail` 播放专辑从 `musicLibrary[idx]` 取数据而非 `playlist[idx]`
- `audio.ontimeupdate` 增加安全检测（`if (el.progFillMain)`），防止 null 引用

---

## v2.2.3 (2026-05-31)

### 🚨 关键 Bug 修复（View Transitions 嵌套崩溃 + PiP 状态切换失效）

- **修复 View Transitions 嵌套崩溃（终极破案）**：当点击"列表"或"设置"时，`document.startViewTransition()` 回调内调用了 `closeAllModals()`，而后者再次调用 `startViewTransition()`。浏览器绝对不允许嵌套视图过渡，导致 `::view-transition` 全屏透明伪元素卡在屏幕最顶层永远不消失（"死玻璃"效应），阻挡所有鼠标点击。现已重构为 `_closeModalsSync` 纯同步关闭 + `safeTransition` 安全封装，每次最多只触发一次视图过渡
- **修复 PiP 状态切换失效**：原代码在打开画中画时用模板字符串 `${hasLrc ? ... : ...}` 写死 DOM 结构，导致切歌后状态改变（有歌词→无歌词）时找不到对应节点。现改为两套 UI 都写死在 DOM 里（`pipLyricsWrap` + `pipFallback`），`updatePipUI` 每 500ms 根据 `parsedLyrics.length` 动态切换 `display`，并强制刷新封面 `src`
- **修复 PiP 封面不刷新**：`pipBg` 和 `pipVinylWrap` 现在使用 `id` 选择器精准定位，每次定时器触发都会检查并更新 `backgroundImage` 和 `innerHTML`

### ✨ 新增功能

- **丝滑进度条拖拽**：主页和沉浸模式进度条支持鼠标拖拽和触摸滑动。拖拽时实时更新进度和时间数字，松手瞬间切入目标位置。`isProgressDragging` 防冲突标志位防止 `ontimeupdate` 和拖拽同时写入导致滑块抽搐
- **粒子爆炸反馈**：拖拽进度条松手时触发 `createExplosion`，提供视觉回馈

### 🔧 架构优化

- **CSS 层级提升**：`.header` z-index 从 100 提升至 9999，确保导航栏永远可点击
- **模态框关闭统一**：所有关闭按钮（`btnCloseFileInfo`/`btnCloseHelp` 等）统一使用 `closeAllModals`，同步清理动态生成的 cover-library/stats/detail 面板
- **事件绑定收口**：删除 load 初始化中与模态段重复的 `btnCoverLibrary`/`btnShowStats`/`btnFavQuick`/`btnPipQuick` 绑定

---

## v2.2.2 (2026-05-31)

### 🚨 关键 Bug 修复（应用假死崩溃）
- **修复 `logError` 二次赋值导致 JS 编译崩溃**：`logError` 在文件顶部已声明为 `async function`，末尾再次 `logError = ...` 触发 `TypeError: Assignment to constant variable`，导致整个 app.js 编译中断，页面完全假死。现已合并为单一函数，移除重复赋值
- **修复 `e.target.closest` TypeError**：拖拽文件到浏览器边缘或悬停文本节点时，`e.target` 不是 Element，调用 `.closest()` 抛出异常。所有 `closest` 调用增加可选链和安全类型检测
- **强化分批加载 try-catch 屏障**：首批/剩余批次的 `Promise.all` 增加 try-catch，单个批次解析失败不再阻塞后续加载，所有歌曲都能被加载

### 🔧 架构优化
- **统一事件绑定**：原 `index.html` 底部内联 `<script>` 中的 `typeof xxx === 'function'` 脆弱绑定全部迁移到 `app.js` 的 `load` 初始化中，确保加载时序一致，消除函数未定义的竞态风险
- `toggleFavorite` 暴露到 `window.MBolka` 命名空间

---

## v2.2.1 (2026-05-31)

### 🎛 UI/UX 改进
- **收藏❤️和画中画📺按钮移至中心控制区**：从顶部 header 移到 `btn-group-main`，分别放在上一曲左侧和下一曲右侧，按钮风格改为圆形控件（`.btn-ctrl`）
- **CSS 层级修复**：`.header` z-index 提升至 100，添加 `pointer-events: auto`；`.load-strip-container` 添加 `z-index: 5`
- **画中画重构**：PiP 内部按钮直接绑定主窗口函数引用（`goPrev()` / `togglePlay()` / `goNext()`），不再依赖 BroadcastChannel；样式表复制改用 `document.styleSheets` 逐一拷贝 CSS rules
- **文件加载增强**：排除系统隐藏文件（`.` 和 `._` 开头）；解析超时熔断 1.5 秒自动降级

### ✨ 动效进阶
- **歌词动态模糊**：非激活行 `filter: blur(2px)` + `scale(0.95)`，激活行完全清晰 + 放大，过渡曲线 `cubic-bezier(0.2, 0.8, 0.2, 1)`
- **专辑环境光阴影**：通过 `--album-color` CSS 变量动态设置封面阴影颜色，配合 `ambientBreathe` 呼吸动画
- **按钮微距回馈**：`.btn-glass` 和 `.btn-ctrl` 添加 `:active { transform: scale(0.92) }` 物理按压感
- **View Transitions API**：弹窗打开/关闭均用 `document.startViewTransition()` 包裹，获得原生 App 级展开/收起动画

---

## v2.2.0 (2026-05-31)

### 🔧 Bug 修复与体验优化
- **移除专辑封面滑动切歌提示**：`← 滑动切歌 →` 文字已移除，不再干扰封面观感
- **修复加载文件夹卡顿**：改为并发批处理（6首/批）+ `setTimeout` 让出主线程，避免UI冻结
- **拖拽场景限制**：明确仅在主界面空白区/空状态区允许拖入文件夹，专辑封面/按钮/模态框区域禁用
- **拖拽排序视觉反馈**：播放列表拖拽时显示蓝色插入线，精确定位插入位置
- **加载条优化**：渐变主色 + 圆角末端，从左到右更直观
- **睡眠定时器倒计时**：底部状态栏实时显示剩余分钟:秒数，最后1分钟红色闪烁
- **A-B 段落重复视觉标记**：进度条上显示红色 A/B 标记点和半透明区间范围
- **空状态引导增强**：脉冲呼吸动画引导用户，非Chrome浏览器提示使用按钮

### 🖼️ 封面库全面增强
- **多维度聚合切换**：支持按专辑 / 按艺术家 / 最近添加三种视图
- **专辑详情面板**：点击专辑卡片展开，显示大封面 + 完整曲目列表 + "播放整张专辑"按钮
- **黑胶唱片动效**：Hover时从封面侧边滑出旋转的黑胶唱片
- **艺术家视图**：圆形头像展示，点击直接播放

### 📺 画中画全面重构
- **动态模糊背景**：专辑封面提取 + `blur(50px)` + 呼吸动画，色调随歌曲变化
- **两行歌词排版**：当前行大字高亮带文字发光，下一行小字半透明，切换时 `translateY` 淡入淡出过渡
- **悬停控制栏**：默认纯净歌词，鼠标悬停浮现控制按钮（上一首/播放暂停/下一首/快速收藏）
- **极简进度条**：底部 3px 主题色进度条，随播放实时推进
- **无歌词降级UI**：纯音乐/无歌词时显示旋转黑胶唱片 + 歌名/艺术家
- **响应式形态适配**：宽扁形态切换为单行横排布局，竖排形态恢复居中两行
- **CSS样式同步**：自动克隆主界面 `<style>` 和 `<link>` 到 PiP 窗口

### ⚡ 性能与健壮性
- **粒子性能自适应**：FPS 实时监测，低于 30 时自动减少粒子数
- **内存泄漏修复**：加载新文件夹前释放旧 Blob URL，防止内存爆炸
- **命名空间封装**：`window.MBolka` 暴露核心 API
- **错误日志持久化**：全局 `window.onerror` 捕获 + localStorage 持久化 + 设置中一键导出
- **并发加载优化**：`Promise.all` 批量解析元数据，加载速度提升约 3 倍

### 🎛 细节打磨
- **歌词偏移精细调**：新增 ±0.1s 按钮，实现精确校准
- **首页金刚键**：收藏 ❤️ 和画中画 📺 快捷按钮添加在导航栏两侧
- **收藏状态联动**：首页收藏按钮与播放列表收藏状态实时同步

---

## v2.1.0 (2026-05-31)

### 🔧 Bug 修复
- **修复沉浸Canvas残留**：退出沉浸模式后，Canvas粒子频谱不再卡在背景中
- **频谱改为灰阶**：彩色频谱改为现代简约的灰阶设计，更符合设计调性
- **修复右上角按钮遮挡**：调整z-index层级，确保四个操作按钮始终可点击
- **空态页拖拽修复**：空状态不再干扰拖拽文件夹功能
- **滑动切歌提示优化**：减少对专辑封面观感的影响

### 📁 项目结构优化
- **CSS/JS拆分**：将原单文件拆分为 `index.html` + `css/style.css` + `js/app.js`
- 代码组织更清晰，便于维护和扩展

### 🔒 本地库强化 (Library & Storage)
- **目录句柄持久化**：使用 File System Access API 的 `showDirectoryPicker()` + IndexedDB 持久化目录句柄，下次打开网页自动恢复音乐库
- **全文搜索**：播放列表顶部增加搜索框，支持对标题/艺术家/专辑/文件名的毫秒级实时搜索
- **播放列表导出导入**：支持导出为 `.m3u` 和 `.json` 格式，方便备份
- **音乐统计看板**：记录每首歌的播放次数和总听歌时长，展示Top10最爱歌曲

### 🎛 音频与硬核播放控制
- **十段均衡器 (EQ)**：基于 Web Audio API 的 `BiquadFilter` 实现，提供 8 种预设（Flat/Pop/Rock/Classical/Vocal/Bass/Electronic/Jazz），支持手动调节
- **播放速度与升降调**：0.5x~2.0x 变速播放，支持保持音调/允许变调切换
- **淡入淡出切歌**：可配置的 Crossfade（1-8秒），曲末自动渐弱渐强
- **睡眠定时器**：15/30/60 分钟倒计时，自动停止播放

### 📝 歌词增强
- **内嵌歌词解析**：自动读取 FLAC/MP3 文件内嵌的 USLT/SYLT 歌词标签
- **歌词时间轴微调**：+0.5s / -0.5s 按钮，动态修正 LRC 偏移

### 🖼️ 封面库独立
- 从播放列表中完全独立为专属功能模块（按 G 键或点击右上角🖼️按钮）
- 网格化展示，支持搜索专辑/艺术家，点击直接播放

### 📺 画中画迷你播放器
- 使用 Document Picture-in-Picture API，将播放器变为系统级悬浮窗
- 窗口置顶，包含专辑封面、歌名、控制按钮、单行歌词

### 📱 移动端与PWA
- **PWA 支持**：动态注入 manifest.json + Service Worker，可安装到桌面
- **移动端手势**：双击左侧快退10秒、双击右侧快进10秒、上下滑动调音量
- **沉浸模式左右长滑切歌**
- **移动端竖版视图全面优化**：按钮尺寸、间距、字号自适应

### ⚡ 性能优化
- **节能模式**：限制Canvas渲染帧率为30fps，降低设备发热
- 性能/全性能模式一键切换

### 🎵 Media Session 增强
- 实时同步 `PositionState`（进度条），锁屏/控制中心可拖动进度

### ⌨️ 新增快捷键
- `T` - 统计面板
- `G` - 封面库
- `Q` - 画中画

---

## v2.0.1 (2026-05-31)

### 🎛️ 交互优化
- **合并播放模式按钮**：将独立的「单曲循环」按钮合并到模式切换按钮中，现在是一个三段式按钮：`顺序 → 随机 → 单曲循环 → 顺序`，按 `M` / `R` / `S` 或手柄 `X` 键即可循环切换
- **修复右上角按钮被遮挡**：调整了标题栏的 z-index 层级，确保右上角「列表」「歌词」「设置」「载入音乐」按钮始终可点击

### 🎨 沉浸模式可视化重做
- **全新多层次视觉系统**：
  - **层次1 - 极光光晕**：动态色相变化的径向渐变背景
  - **层次2 - 中心发光核心**：随贝斯强度呼吸的发光体
  - **层次3 - 底部频谱弧线**：优雅的波形弧线（双线叠加+发光）
  - **层次4 - 两侧对称频谱柱**：渐变色的圆角频谱柱，顶部有光点
  - **层次5 - 顶部细线频谱**：微妙的高频指示线
  - **层次6 - 散布光点**：漂浮的"音符感"光点，跟随频谱闪烁
- **粒子系统增强**：粒子数量上限提升至 120，鼠标跟随生成更密集，点击空白区生成涟漪
- **颜色过渡更平滑**：取色模式和自由循环模式的色相过渡都更流畅

### 🖼️ 封面库独立
- **全新封面库视图**：从播放列表中独立出来，按封面/专辑自动聚合
  - 相同封面的歌曲归为一个专辑卡片
  - 显示封面缩略图、专辑名、歌曲数量
  - 无封面的歌曲统一归入「无封面」分组
  - 点击直接播放该分组第一首
  - 播放列表新增「全部」「收藏」「封面库」三个切换按钮

### ✨ UI/UX 细节优化
- **主界面频谱条**：改为彩色渐变，视觉更丰富
- **专辑封面滑动**：增加左右滑动动画效果
- **专辑信息增强**：解析并显示歌曲的专辑名称
- **文件信息面板**：新增专辑和时长显示
- **按钮交互反馈**：悬停和激活状态的视觉过渡更流畅
- **版本号更新**：v2.0.0 → v2.0.1

### 🐛 Bug 修复
- 修复右上角操作按钮被空白状态遮罩层遮挡的问题
- 修复播放模式按钮逻辑混乱（两个按钮控制同一状态）的问题

---

## v2.0.0 (2026-05-30)

### 🚀 技术优化
- **Web Worker 解析元数据**：在后台线程解析音乐标签，不阻塞 UI
- **IndexedDB 元数据缓存**：解析结果持久化，二次加载秒开
- **媒体会话增强**：完善 Media Session API，支持 seekto/seekbackward/seekforward
- **CUE 分轨支持**：解析 .cue 文件提取曲目信息和时间点
- **虚拟滚动支持**：大量音乐时使用虚拟滚动渲染
- **错误日志双存储**：IndexedDB + localStorage 记录播放异常

### 🎵 核心体验
- **播放错误容错**：解码失败自动跳下一首，列表中标红显示
- **播放列表管理**：右键菜单支持删除单曲、清空列表、查看文件信息
- **A-B 段落重复**：长按播放按钮进入，进度条点击设置 A/B 点
- **沉浸模式增强退出**：双击空白区、手势下滑、底部箭头三种方式

### 🖱️ 交互细节
- **进度条悬停预览**：显示该时间点的歌词片段
- **滑动切歌**：专辑封面左右滑动切换上下曲
- **播放队列拖拽排序**：HTML5 Drag & Drop 实时重排
- **歌词字体/对齐调节**：字号、行距、对齐方式滑块

### 🎨 视觉增强
- **10 套预设主题色**：赛博朋克、暖阳、极光、星夜、樱花等
- **专辑封面瀑布流**：封面墙视图
- **沉浸模式粒子互动**：鼠标/触摸粒子跟随散开，高潮爆炸
- **动态壁纸联动**：频谱实时影响背景光晕和粒子颜色

### ⌨️ 其他
- **快捷键大全面板**：按 `?` 键弹出，分类展示所有操作
- **手柄完全支持**：Xbox/PS 手柄全功能映射

---

### 🐛 交叉淡变歌词/总时长修复 + 后台保活 + 视觉升级 + 回归修复

### Bug 1：进度条目标时间永远显示上一首歌曲的总时长
- **根因**：`onAudioLoadedMetadata` 用 `getActivePlayAudio().duration` 写总时长。交叉淡变预加载阶段（PRELOADING）被动槽（新歌）loadedmetadata 触发时 `getActivePlayAudio()` 仍指向旧歌，总时长被错写成上一首。
- **修复**：`onAudioLoadedMetadata(e)` 改用触发元素自身 `e.currentTarget.duration`。

### Bug 2：歌词要等下一首第一句唱出才更新 + 歌词栏无出入场/高斯模糊
- **修复A（歌词随音频介入即更新）**：原 loadLrc 只在 cfFinishTransition 调用。前移到 cfTriggerCrossfade 置 FADING 后、启动被动槽前。移除 cfFinishTransition 重复 loadLrc；cfAbortTransition 回滚时同步 loadLrc。
- **修复B（歌词栏出入场+切歌高斯模糊）**：loadLrc 加 .lrc-switching（blur+淡出→换内容→去模糊淡入）；btnToggleLrc 开/关加 .lrc-panel-in/.lrc-panel-out；CSS 关键帧与过渡。

### Bug 3（hotfix）：歌词完全不显示 — lrc-switching 残留
- **根因**：有歌词→无歌词→有歌词。wasVisible=true 加了 .lrc-switching，无歌词分支 return 不清理，后续 wasVisible=false 跳过移除 → blur(10px) 永久残留。
- **修复**：!lrcText 返回分支增加清理；有歌词分支无条件先移除 lrc-switching。

### Bug 4：后台切回前台「点击播放的不是当前歌曲」
- **根因**：togglePlay 用硬编码 audio（槽A）而非 getActivePlayAudio()。交叉淡变后活跃槽变 cfAudioB 时控制错槽。
- **修复**：togglePlay 改用 `getActivePlayAudio()`。睡眠定时器同步修复。

### Bug 5：后台交叉淡变卡住 → 放到第三首就停
- **根因**：后台 rAF 冻结 → fade 卡住 → cfState 永久 FADING → 活跃槽播完 → onAudioEnded 因 cfState!==IDLE 直接 return 不切歌 → 静默停止。setTimeout 兜底被节流到 10s+ 后。
- **Fix 1**：新增 `_cfPendingNextIdx`/`_cfPendingNextVol` 缓存淡变参数。onAudioEnded 中 cfState===FADING && this===活跃槽 → 立即 cfFinishTransition。
- **Fix 2**：visibilitychange 可见时 cfState===FADING 强制收尾。
- **守护**：fade 顶部 `if(cfState!==FADING) return` 确保强制收尾后 stale rAF 安全退出。
- **v1→v2 回归**：++cfTransitionId 导致 stale rAF passiveEl.pause() 误停翻转后的新活跃槽 → 淡变结束立即停止 100%。
- **v2→v3 修复**：return 在外层 if（非内部）→ FADING 时非活跃槽结束跳过 goNext。cfAirLocked 在 PRELOADING 阶段活跃槽结束时误走 cfFinishTransition（失败）→ 跳过 goNext。

### 交叉淡变视觉升级
- **封面溶解**：cfSyncSongUI 设新封面后创建 .art-crossfade-overlay（旧封面 img），opacity 3s 淡出后移除。
- **歌名/歌手分阶滑入**：@keyframes cfTextEnter（translateY+blur→正常 0.45s），歌手延迟 0.15s。仅 FADING 触发。
- **PiP 封面淡变**：updatePipUI 用 pipLastArt 追踪封面，FADING 时创建覆盖层淡出。
- **进度条发光**：.cf-vis-bar.enhanced（box-shadow 发光+4px）。.cf-airlock .prog-fill（box-shadow 跟随 --album-color）。
- **降级**：prefers-reduced-motion 下隐藏。

### 涉及文件
- `js/audio-core.js`：onAudioLoadedMetadata / cfSyncSongUI / cfTriggerCrossfade / onAudioEnded / fade / cfCrossfadeVisStart / cfFinishTransition / cfAbortTransition / togglePlay / setSleepTimer
- `js/globals.js`：新增 _cfPendingNextIdx / _cfPendingNextVol
- `js/app.js`：visibilitychange 可见分支 FADING 恢复
- `js/pip.js`：updatePipUI 增加 pipLastArt + 封面淡变
- `css/base-layout.css`：.art-crossfade-overlay / .cf-text-enter / .cf-vis-bar.enhanced / .cf-airlock glow + prefers-reduced-motion
- `css/components.css`：.pip-vinyl position:relative + 覆盖层样式

### 验证
- 全部修改文件 read_lints 0 错误
- prefers-reduced-motion 下降级
- 手动切歌/中止回滚不触发溶解与文字动画
- FADING 状态覆盖：onAudioEnded / visibilitychange / fade rAF / setTimeout 四路互斥

### v3.6.5: 后台保活根治（看门狗 + 状态脱节修复）
- 诊断快照铁证：导出日志显示 isPlaying=true 但两个音频槽都 paused=true / currentTime=0 —— 播放状态与媒体严重脱节。
- 根因（4 层）：① 交叉淡变扫描器是 rAF 驱动，后台标签页 rAF 完全冻结 → 后台永不触发下一首淡变；② 后台媒体被浏览器节流/系统卡顿暂停后 ended 不触发 → 播放永久停止；③ cfTriggerCrossfade 的 passiveEl.play() 在后台被自动播放策略 NotAllowedError 拦截 → catch 执行 cfAbortTransition+goNext 跳歌；④ cfFinishTransition 只设音量未调用 newActive.play() → 淡变完成即静默停止。
- 修复：
  1. 新增后台播放看门狗 startPlaybackWatchdog（setTimeout 驱动，后台以 ~1s 节流触发，不像 rAF 冻结）：媒体被外部暂停→自动续播；已结束未续播→goNext；后台 FADING 旧槽被暂停→强制 cfFinishTransition 接力。
  2. cfFinishTransition 完成后 newActive.play().catch() —— 确保新活跃槽真正在播放（根治淡变完成即静默）。
  3. cfTriggerCrossfade 被动槽后台被拦截时不再 abort+goNext 跳歌，保留 FADING 让旧槽继续播，待旧槽结束由 onAudioEnded→CF_FORCE_FINISH 切到正确下一首。
  4. togglePlay 以媒体真实状态为准（actuallyPlaying = isPlaying && !active.paused && !active.ended）—— 避免 isPlaying 脱节时点了反而暂停 / 播放的不是当前歌。
  5. visibilitychange→visible 时若应播却暂停立即续播当前歌。
- 新增日志：WD_RESUME / WD_ENDED / WD_CF_FINISH / VIS_RESUME。
- 涉及文件：js/audio-core.js（看门狗+cfFinishTransition+cfTriggerCrossfade+togglePlay）、js/app.js（initApp 启动看门狗+可见性续播）。

### 🔥 v3.6.5b: 活跃槽/UI 错位根治（界面 X 实际 Y）
- **诊断快照铁证**（06-31-57）：currentIndex=487 界面显示 Rise，但 activeSlot=B 实际在放 duration=242s 的张杰歌曲，而 currentIndex 对应的 Rise 在槽 A 已 ended。即「界面显示 Rise、实际播放 张杰」。
- **根因（上一轮看门狗引入的二次错位）**：看门狗 `if (active.ended) goNext()` → `goNext`→`playAudio` 在 `cfActive!=='A'` 时强制把 `cfActive='A'` 并加载 `audio`(槽A)；但后台交叉淡变链中真实发声槽常是 `cfAudioB`(槽B)，致使 `cfActive` 与真实播放槽**错位**。错位后 `cfPreloadNext` 经 `cfGetPassiveAudio()` 取到的是正在发声的槽，把下一首(张杰)覆盖到正在播放的音频上，而 `currentIndex` 仍指向 Rise → 错位。
- **修复**：
  1. **看门狗 `active.ended` 改为「槽内重载」**（直接 reload 当前活跃槽并续播下一首、保持 `cfActive` 不变），不再调用会翻转 `cfActive` 的 `goNext()`/`playAudio`。
  2. **`cfPreloadNext` 防御**：若 `cfActive` 错位导致「被动槽」恰好正在发声，则改预加载到另一个真正空闲的槽，绝不覆盖正在播放的音频。
  3. **`cfFinishTransition` 校验**：交换后若新活跃槽 src 与 `playlist[nextIdx]` 不符则重载为正确歌曲，并记录新活跃槽索引。
  4. **新增双槽索引追踪** `cfSlotIdxA/cfSlotIdxB`（playAudio/cfTriggerCrossfade/cfFinishTransition/cfPreloadNext 处同步），用于检测错位。
  5. **看门狗错位自愈（WD_RESNC）**：cfState=IDLE 时检测任一槽装载歌曲与 `currentIndex` 不符 → 以 `currentIndex` 为准重载该槽，使音频与界面一致（可自愈本次已发生的张杰/Rise 错位）。
- **新增日志**：WD_RESNC（自愈）。

### 🔥 v3.6.5c: 单曲时长未及时更新（显示旧歌时长）
- **问题**：交叉淡变切换后，进度条总时长仍显示上一首歌的时长（如 4:41），未随新曲更新。
- **根因**：`onAudioLoadedMetadata` v3.6.1 修复虽然用 `e.currentTarget` 取被动槽 duration，但在极少数场景（如预加载阶段 `duration` 尚未就绪为 `0`/`NaN`、或浏览器 `loadedmetadata` 未触发）下仍可能漏更新。
- **修复**：
  1. **`cfFinishTransition` 显式同步**：交叉淡变完成后，直接用 `newActive.duration` 刷新总时长，不再完全依赖事件。
  2. **新增 `durationchange` 兜底监听**：双槽均绑定 `durationchange` 事件，在 duration 属性分多次更新（VBR/流式）或 `loadedmetadata` 未触发时，自动以当前活跃槽 duration 刷新总时长。
  3. **防御条件**：仅当 `duration > 0 && isFinite` 时才写入，避免旧槽清理后的 `NaN` 覆盖。

### 🔥 v3.6.4: 曲库按专辑合并 feat. 合作曲卡片
- **问题**：同一专辑（如 LEMONADE - The 2nd Album）中，大部分歌曲 artist 为 "aespa"，但含 feat. 的歌曲 artist 为 "aespa&G-DRAGON"，导致曲库显示为两个独立专辑卡片（8 首 vs 1 首）。
- **根因**：`buildAlbumEntries` / `buildAlbumEntriesByArtist` 按 `album::artist` 分组，artist 稍有差异即分裂。
- **修复**：
  1. **分组 key 改为只用专辑名**：不再拼接 artist，同专辑名即同组。
  2. **新增 `mergeAlbumArtists`**：收集组内所有 artist 去重，若有某个 artist 是其他所有 artist 的子串（如 "aespa" 是 "aespa&G-DRAGON" 的子串），取最短代表；否则取出现次数最多的 artist。
  3. **封面取第一个非空**：合并后封面取自组内第一个有 art 的歌曲，不影响 LRU 淘汰后的懒恢复。
- **涉及文件**：`js/cover-lib.js`（`buildAlbumEntries`、`buildAlbumEntriesByArtist`、新增 `mergeAlbumArtists`）。

### 🔥 v3.6.5d: 曲库打开自动定位当前播放专辑（按专辑默认视图）
- **需求**：点击曲库进入「按专辑」默认视图时，自动把当前正在播放的专辑滚到屏幕正中（3D 封面流居中高亮），无需手动翻找。
- **实现**：
  1. 新增 `focusCurrentAlbumInCoverLib()`：仅 `coverLibSortMode === 'album'` 时生效（其他 Tab 不打扰）。
  2. 取当前曲目 `playlist[currentIndex].album`，遍历已分组的 `_clEntries` 按专辑名定位目标索引。
  3. 窗口化渲染兜底：若目标专辑超出已挂载窗口（`_clRendered < 目标`），调用 `renderCoverLibMore(need - 已渲染 + CL_CHUNK)` 强制追加渲染到该位置（渲染在飞则累积到 `_clPendingTarget` 续挂）。
  4. 异步轮询等待卡片入 DOM 后调用 `setCoverLibCenter(targetIdx)` 居中（分帧渲染，立即调用卡片尚未挂载，故轮询最多 50 次 × 30ms）。
  5. 在 `showCoverLibrary` 现有 200ms 渲染完成定时器中，`refreshCoverLibAfterRender()` 之后调用，确保覆盖默认居中（index 0）。
- **涉及文件**：`js/cover-lib.js`（新增 `focusCurrentAlbumInCoverLib`、`showCoverLibrary` 调用点）。