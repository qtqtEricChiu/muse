# MBolka Player 更新日志

---

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

## v2.8.12p2 (2026-06-04)

### 🩹 创作信息卡片 CSS 紧急修复

**问题**：v2.8.12 为控制超长名单宽度，将 `.lrc-credits-row` 从 `display: flex; flex-wrap: wrap` 错误改为 `display: inline`，导致所有创作信息行坍塌为内联文本流，**逐行换行完全丢失**——所有词/曲/编/录信息挤作一团。

**修复**：
- `.lrc-credits-row` 还原 `display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 8px`，恢复每行独立 flex 布局
- `.lrc-credits-row` 新增 `max-width: 100%`，配合 `.lrc-credits-val { min-width: 0; word-break: break-word }` 实现真正的"不撑爆、自然换行"
- `.lrc-credits` 最大宽度改为 `max-width: 100%`（其在 `.col-lyrics` padding 内已天然受约束）

**涉及文件**：`css/base-layout.css`、`index.html`（版本号标题）

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
