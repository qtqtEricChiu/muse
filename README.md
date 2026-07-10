# MBolka Player - Ultimate Nexus v3.6.6p1

> 纯前端本地音乐播放器 | 沉浸式视听体验 | 无需后端、无需数据库、打开即用

![Version](https://img.shields.io/badge/version-3.6.6p1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Web%20Browser-orange)

---

## 📖 目录

- [产品亮点](#产品亮点)
- [核心功能](#核心功能)
- [更新日志](#更新日志)
- [快速开始](#快速开始)
- [操作指南](#操作指南)
- [技术架构](#技术架构)
- [浏览器兼容性](#浏览器兼容性)
- [许可证](#许可证)
- [致谢](#致谢)

---

## ✨ 产品亮点

### 🎨 全域 60FPS 色音同步视觉引擎
- **主界面流沙背景**：极低分辨率 Canvas (64×64) + CSS `blur(80px)` GPU 硬件加速，三层正弦波叠加产生流体色块，Bass 频段实时影响沙浪速度与高度
- **沉浸式音乐舱**：6 层视觉系统 — 极光光晕 → 中心发光核心 → 底部频谱弧线 → 两侧对称频谱柱 → 顶部细线频谱 → 散布光点
- **中央色相时钟 `currentHue`**：主界面与沉浸模式共享同一色相变量，60 帧毫秒级平滑过渡，取色模式下全域实时响应专辑封面主色调
- 多层级毛玻璃效果（backdrop-filter + 饱和度增强）
- 粒子特效系统：切歌爆炸、播放波纹、鼠标跟随拖尾

### 🎛️ 全域弹窗栈控制器 — LIFO 完美退出
- **`handleGlobalClose()` 统一关闭管理器**：始终关闭当前实际最上层（z-index 最高）的打开浮窗，层层递进返回主界面；键盘 Esc / 手柄 B 键全适配，100% 向前兼容
- **播放列表等浮窗补推栈**：键盘 `p` 与手柄 ← 打开播放列表时显式入栈，B 键逐级返回逻辑一致，不再"卡在浮窗回不去主界面"（v3.4.0）
- **曲库 coverflow（按专辑）**：单行 3D coverflow 视图，鼠标滚轮 / 手柄左摇杆切换居中唱片，空闲景深模糊、停止自动恢复（v3.4.0）

### 🎵 完整音频能力
- 支持 MP3 / FLAC / WAV / M4A / OGG / AAC / WMA / OPUS 格式
- LRC 歌词解析（UTF-8 / GBK 双编码自动识别）+ 内嵌歌词（ID3/USLT）
- **VTT 字幕支持**：自动发现同名 `.vtt` 文件，复用 LRC 渲染管线（v3.1.0）
- **长音频进度持久化**：时长 > 15 分钟每 10 秒存 `localStorage`，切歌自动续播（v3.1.0）
- CUE 分轨文件解析
- A-B 段落重复模式（长按播放按钮激活）
- 十段均衡器 (EQ) + 8 种预设（下拉菜单选择，与触觉-映射模式一致）
- 0.5x~2.0x 变速播放 + 升降调控制
- 淡入淡出无缝切歌 (Crossfade) — 可配置时长/曲线/响度归一化，淡变视觉指示条+封面溶解+歌名分阶滑入
- 睡眠定时器 (15/30/60分钟)
- **自动播放策略优雅降级**：`NotAllowedError` 捕获后监听用户手势自动恢复，引导 Toast 15 秒安全过期（v3.2.3）
- **PWA Window Controls Overlay**：Windows Chrome 标题栏随切歌实时刷新曲目名、完全窗口水平居中；OS 沉浸顶 bar 颜色 = `<meta name="theme-color">`，始终跟随专辑封面色 / 主题默认色 / 深色模式实时沉浸（v3.4.2 修复取色模式锁死紫色问题）
- **WCO 假沉浸标题栏（顶部取色）**：隐藏标题栏时，右侧系统金刚键背景自动取页面顶部附近颜色（`js/theme-color.js` `updateTopColor()` + `js/utils.js` `extractTopColor()`），让系统窗口控制区与页面背景视觉融合，达成"假沉浸"效果（v3.4.4）；切歌、自定义背景上传/清除均同步计算顶部取色
- **后台交叉淡变保活**：rAF 后台冻结时由 `onended` + `visibilitychange` 双路兜底强制收尾，确保后台播放不卡死
- **AI 翻译合规标识**：LRC 头部含"文曲大模型"行自动检测并标注紫色「AI 翻译」Badge，模型名称彻底清除
- **均衡器自动补偿增益**：10 段级联滤波器末端串接增益节点，按合成幅频响应自动拉回余量，避免提升后削波失真；首/末频段改 shelf 减少染色，低频降 Q 降低相位互调
- **创作信息智能解析**：80+ 角色标识（含中英文），多角色合并（如"制作人/作曲/编曲"）自动拆为独立行；超长名字列表按分隔符分块换行保持完整；出版信息括号保护避免误拆；EN_ROLES 长词条优先匹配避免复合角色被截断

### 🎮 全方位操控
- 完整键盘快捷键（Space、方向键、J/K、WASD 等）
- Xbox/PlayStation 手柄完全映射（摇杆导航、ABXY、LB/RB、十字键）
- **全新手柄震动反馈引擎**：基于 Web Gamepad API `dual-rumble` 的音频→震动映射，双模式频谱映射 + 自动地板算法 + 马达独立增益控制，设置面板含测试震动按钮
- **手柄功能全面补全**：P0 焦点可达性补全（导出按钮、右键菜单项等全覆盖）、P1 快捷组合键状态机接入（长按/双击/组合键共 11 项）、P2 交互范式（Seek 模式、右键菜单手柄化、搜索快速跳转）、P3 画中画手柄支持
- 2D 空间焦点导航：摇杆/WASD 在曲库网格中智能寻路
- `?` 键弹出快捷键大全帮助面板
- 右键上下文菜单（播放列表管理）
- 拖拽排序播放列表（HTML5 Drag & Drop）
- 专辑封面左右滑动切歌（触屏）

### 🎨 预设主题色 + WCAG 无障碍
- 10 套预设配色方案：赛博朋克、暖阳、极光、星夜、樱花、深海、日落、薄荷、玫瑰金
- 聚焦卡片式选择器，手柄/键盘完美导航
- **封面取色 → PWA 标题栏联动**：专辑封面主色调经 `ThemeColor.update()` 实时驱动 `<meta name="theme-color">`（即 Windows Chrome OS 沉浸顶 bar 颜色），切歌即刷新标题曲目与顶 bar 颜色；无封面 / 取色失败时回落主题默认色，修复残留上一张封面色（v3.4.2 起 OS 顶 bar 完全跟随取色沉浸）
- **跟随强调色（设置-外观）**：独立开关「跟随强调色」与「取色模式」同源驱动全域强调色（`--primary` 及其衍生色）；`followAccentColor` 配置统一迁移原 `colorMode`，`loadSettings` 兼容旧键（v3.5.0）
- **背景沉浸（设置-外观）**：开启后播放器面板透明度降低（`rgba 0.28` + backdrop-blur 60%）→ 专辑封面/自定义背景全屏展现；夜间模式自动叠加半透明黑遮罩，采用 **alpha-over 分层合成公式** `1-(1-a)*(1-b)` 正确加深而不丢失层次（v3.5.0）
- **WCAG 2.2 对比度合规**：`getLuminance` 改用标准 sRGB 相对亮度公式 + 对比度择优前景色；`player-wrapper` 由 `role="application"` 改为 `role="group"` + `aria-label`
- **视口缩放放开**：移除 `maximum-scale`/`user-scalable=no`，低视力用户可自由缩放（WCAG 1.4.4 / 1.4.10）
- **焦点可见性**：`:focus-visible` 轮廓与手柄 `.gamepad-focus` 视觉对齐，键盘/鼠标用户清晰定位
- 深色/护眼模式，可手动切换或跟随系统

### 💾 智能缓存与容错
- IndexedDB 缓存解析后的元数据，二次打开秒加载
- 目录句柄持久化 (File System Access API)，重新打开自动恢复音乐库
- 播放解码失败自动跳过并标红，错误日志本地存储
- 进度条悬停预览对应时间点歌词
- 分页懒加载：大文件夹分批解析，首 20 首即刻开播

### 🔧 高度可定制
- 自定义背景图片（上传本地图片覆盖专辑封面背景）
- 背景模糊强度滑块调节
- 歌词字号、行距、对齐方式（居中/左对齐）独立调节
- 歌词时间轴微调 (+0.5s / -0.5s)
- 收藏/喜爱标记，持久化存储
- 曲库独立功能模块（按专辑/艺术家/最近添加三维聚合 + 增量切片加载）

### 📊 数据管理
- 全文搜索（标题/艺术家/专辑/文件名）
- 播放列表导出 (M3U / JSON)
- 音乐统计看板（总时长、Top10、播放次数）

### 📺 画中画与PWA
- Document PiP 画中画迷你播放器（动态模糊背景 + 双行歌词 + 悬停控制栏）
- PWA 支持，可安装到桌面
- **离线运行时缓存**：Service Worker 对 Google Fonts / jsmediatags 运行时缓存（stale-while-revalidate），离线可达（v3.3.0）
- **SW 更新提示**：监听 `updatefound`/`controllerchange`，新版本提示用户刷新（v3.3.0）
- **iOS 兼容性回退**：不支持画中画时隐藏对应按钮，核心播放/手势保持可用（v3.3.0）
- 移动端全局手势控制

### ⚡ 极致性能优化
- 粒子对象池化：消除 GC 抖动，预分配 150 Particle + 20 Ripple
- 位标志节能状态机：四模式叠加（一键/画中画/帧率/可见性），精准控制能耗
- 三角函数查表法 (LUT)：128 点 SIN/COS 预计算
- GPU 图层升格 (will-change)：关键动画元素独立合成层
- DOM 布局抖动消除：缓存 `getBoundingClientRect()` + scrollable 惰性缓存
- 播放列表 DocumentFragment 批量插入 + 事件委托，100 首 reflow 从 100 次变 1 次
- 曲库 Tab 缓存 + Fragment 化渲染 + generation ID 竞态保护 + 防抖，切换 <1ms 无崩溃
- CSS `transition: all` → 精确属性名，`.playlist-items` 加 `contain: strict`
- FPS 实时监测 + 粒子密度自适应
- Page Visibility API：标签页隐藏时自动暂停渲染
- 曲库增量切片渲染：每次 12 张卡片，保持 60fps
- **歌词增量同步**：`syncLyrics` 仅激活行变化时更新 + 节点缓存（`getLrcLines` 懒初始化），消除每 tick 全量 `querySelectorAll` 与强制重排（v3.3.0）
- **画布尺寸 ResizeObserver 化**：主画布尺寸仅在容器变化时更新，rAF 内不再每帧读 `offsetWidth` 重排（v3.3.0）
- **暂停不重绘**：暂停且非沉浸时跳过逐帧重绘，仅保留末帧，空闲功耗下降（v3.3.0）
- **Media Session 节流**：`setPositionState` 由每 tick 降频至 ~4Hz（v3.3.0）
- **睡眠定时器按需**：无定时任务时不常驻 `setInterval` 空跑（v3.3.0）
- **死代码清除**：删除 `globals.js` 内联 Worker + 无用 Blob URL 泄漏；jsmediatags 改 `defer`（v3.3.0）

---

## 🎯 核心功能

| 功能 | 说明 |
|------|------|
| 本地音乐加载 | 点击按钮选择文件夹，或直接拖拽文件夹到窗口，自动恢复上次音乐库 |
| 多格式支持 | MP3, FLAC, WAV, M4A, OGG, AAC, WMA, OPUS + LRC/CUE |
| 专辑封面显示 | 自动读取嵌入封面，未嵌入时优雅降级 |
| 动态取色 | 从封面提取主色调，全域 60fps 色相同步 |
| 可视化频谱 | 主界面彩色渐变频谱 + 沉浸模式 6 层视觉系统 |
| 流沙动态背景 | 64×64 Canvas + CSS blur(80px) 三层正弦波流沙 |
| 沉浸模式 | 全屏粒子特效、大字歌词、环状频谱动画 |
| 播放模式 | 三态循环切换：顺序 → 随机 → 单曲循环 |
| A-B 重复 | 长按播放键进入，点击进度条设置 A/B 点 |
| 播放列表管理 | 右键菜单、拖拽排序、全文搜索 |
| 曲库 | 独立模块：按专辑（coverflow 单行 3D 视图 + 滚轮/左摇杆切换居中 + 空闲景深 + 窗口化渲染）/ 艺术家 / 最近添加 三维聚合 + 专辑详情面板 |
| 十段均衡器 | 8种预设（下拉菜单选择，与触觉-映射模式一致）+ 手动调节 (32Hz~16kHz) |
| 变速/变调 | 0.5x~2.0x 播放速度 + 保持音调/允许变调 |
| 淡入淡出 | 1~8秒可配置 Crossfade |
| 睡眠定时器 | 15/30/60 分钟倒计时自动停止 |
| 歌词显示 | 主界面滚动歌词 + 沉浸模式大字歌词 + 内嵌歌词解析 + 时间偏移调整 |
| 音量控制 | 滑块 + 键盘上下键 + 手柄 LT/RT + 移动端手势 |
| 进度控制 | 点击跳转 + 悬停预览歌词 + J/K 快进快退 + 锁屏进度同步 |
| 画中画 | Document PiP 悬浮窗，动态模糊背景 + 双行歌词 |
| 统计看板 | 总时长、Top10最爱、播放次数 |
| 导出导入 | M3U / JSON 格式播放列表备份 |
| 手柄支持 | Xbox/PS 手柄完整映射：摇杆/WASD 2D 焦点导航、ABXY/LB-RB/十字键全映射、B 键逐级返回（播放列表/曲库/专辑详情）、coverflow 滚轮/左摇杆切换居中；设置页滑块聚焦时左摇杆提示进入微调、锁定左右导航防误触。详见[操作指南](#手柄映射)。v3.4.3 修复：普通 `D`/`→` 用于 coverflow 右导航、`Shift+D` 切深色模式，`U`/`F` 收藏即时生效，手柄连接瞬间防误触发 |
| 键盘快捷键 | 全键盘操作，按 `?` 查看完整快捷键列表 |
| 全屏模式 | F 键或手柄 View 键切换 |
| 自定义背景 | 上传本地图片作为背景 |
| 预设主题色 | 10 套配色方案 + 聚焦卡片选择器 + WCAG 自适应对比度 |
| 深色模式 | 护眼深色主题，快捷键 `Shift+D`（普通 `D` 为 coverflow 右导航） |
| 网络状态指示 | Footer 实时显示在线/离线/慢速网络状态，支持 Network Information API |
| PWA 支持 | 可作为桌面应用运行，原生体验 |
| 移动端手势 | 双击快进退、上下滑音量、左右长滑切歌 |
| 节能模式 | 位标志状态机：一键节能 + 画面节能(30fps) + 画中画临时节能 + 标签页隐藏节能，四模式可叠加 |
| 双语LRC歌词 | Map分组精确合并原文+翻译，主面板+沉浸模式双端显示 |
| 歌词垂直对齐 | 居中/偏上 两种模式可选，持久化存储 |
| IndexedDB 缓存 | 元数据缓存 + 目录句柄持久化 |
| 错误日志 | 播放异常、解析失败自动记录到本地 |
| VTT 字幕 | 自动发现同名 `.vtt` 文件，复用 LRC 渲染管线显示时间轴字幕 |
| 长音频续播 | 时长 > 15 分钟每 10 秒存进度，切歌自动续播（最后 5 秒重置） |
| 自动播放降级 | `NotAllowedError` 捕获后监听用户手势自动恢复，引导 Toast 15 秒过期 |
| WCO 标题栏 | PWA Window Controls Overlay：标题随切歌实时更新、完全窗口水平居中；OS 沉浸顶 bar（`meta theme-color`）始终跟随封面色 / 主题默认色 / 深色模式实时沉浸（v3.4.2 修复取色锁死紫色） |
| 标题栏取色 | 专辑封面主色调实时驱动 `<meta name="theme-color">`（= Windows Chrome OS 沉浸顶 bar 颜色）；`loadSong()` 切歌刷新、无封面回落主题默认色，修复残留上一张封面色（v3.4.2 起 OS 顶 bar 完全跟随取色沉浸） |
| 离线运行时缓存 | Service Worker 对字体/jsmediatags 运行时缓存，离线可达 |
| SW 更新提示 | 监听 `updatefound`/`controllerchange`，新版本提示刷新 |
| iOS 兼容回退 | 不支持画中画时隐藏对应按钮，核心播放/手势保持可用 |
| 无障碍进度 | 进度条 `aria-valuenow/valuemax/valuetext` 实时同步（WCAG 4.1.2） |
| 视口缩放 | 放开缩放限制，低视力用户可自由缩放（WCAG 1.4.4/1.4.10） |
| XSS 防护 | 文件名/标题经 `escapeHTML` 转义，杜绝基于文件的脚本注入 |

---

## 🆕 更新日志

> 详细更新日志请参阅 [CHANGELOG.md](./changelog.md)

### v3.6.6p1 (2026-07-10) — WCO 整窗居中+竖屏靠左 / WCO 沉浸舱按钮挂载槽 / 竖屏模式全面优化 / Spotify 风格歌词 / 创作信息卡片对齐修正（最新）

- **WCO 标题整窗居中 + 竖屏靠左**：`.wco-titlebar .wco-track-title` 改为 `left:0; width:100vw; text-align:center`（不减去金刚键宽度，文本始终对整窗 100vw 中线居中；`padding: 0 140px` 留出金刚键/左侧 header 空间）；新增 `@media (max-aspect-ratio: 1/1) { text-align: left; padding: 0 0 0 110px }` —— 竖屏模式允许靠左对齐，让位主界面 header 居中标题
- **WCO 沉浸舱按钮挂载槽**：`index.html` 新增 `<div id="wcoActionsSlot">`；`js/wco.js` 新增 `WCO.mountActions(node)` / `unmountActions()` —— **移动 DOM**（非 clone，避免 onclick 监听丢失）把 `.imm-topbar .imm-header-actions` 移入 WCO 标题栏右侧；`toggleImmersiveMode()` 进入时 mount，退出时 unmount；WCO 关闭时自动兜底 unmount
- **竖屏模式全面优化**：`@media (orientation: portrait)` 大块（与 UA 无关，任何 PWA / 浏览器竖窗生效）—— 主界面 3 列紧凑垂直（88×88 圆角封面 + 横排曲目信息、紧凑 44/60/38px 按钮、歌词占主要区域 38–52vh）、沉浸模式 track-card 紧凑（50×50 封面 + 16px 标题 + 42px 退出键 + 56px 播放键）、沉浸模式顶部 WCO 兼容 (`body.wco-active.immersive-mode .imm-wrapper { padding-top: env(titlebar-area-height) }`)
- **Spotify 风格竖屏播放页歌词**：`loadLrc` 末尾新增 `syncLyrics(true)` —— 切歌/打开歌词时立即把当前行居中（此前 `scrollTop=0` 让第一行在顶部，违反「不下滑可见当前行」）；竖屏 spacer 缩短为 `clamp(120px, 30vh, 220px)` / `clamp(80px, 22vh, 160px)` 留出更大滚动空间
- **创作信息卡片对齐修正**：`.lrc-credits` 改 `align-self: center; margin: 0 auto 18px; text-align: left` —— 卡片始终在歌词栏水平居中、内容始终左对齐；`.lrc-credits .lrc-credits-row` `justify-content: flex-start`；`.lrc-credits .lrc-credits-title`/`.lrc-credits .lrc-credits-val` `text-align: left`；`.lrc-line.lrc-credits` 嵌入态用 `text-align: center !important` 覆盖歌词行对齐
- **移除 UA 限制的自动竖屏进入沉浸**：`app.js` 删除 `/Android|webOS|.../` UA 检测，**任何 PWA / 浏览器**在 `matchMedia('(orientation: portrait)')` 匹配时自动进入沉浸模式、横屏自动退出
- **金刚键取色**仍由 `theme-color.js` 最新逻辑（`toDarkColor` + 封面取色开关）驱动，不受 WCO 状态门控

### v3.6.6 (2026-07-10) — 深色主题取色算法（PWA WCO 标题栏）+ 移除标题栏状态判断 + 沉浸式外观位置调整

- **合并「深色主题取色算法」为 WCO 标题栏取色**：`js/theme-color.js` 引入 `rgbToHsl`/`hslToRgb`/`toDarkColor`（基于 18 组实测拟合，平均通道偏差 4.1/255），将专辑封面亮色 RGB 映射为暗色沉浸底色 `hsl(H,79%,5%)`，粉色区间（H∈[335,360]∪[0,5] 且 S>28%、L>61%）做 −56° 偏移；删除旧的去饱和灰度 `_toGrayscale`
- **取色逻辑简化**：无论 Chrome 是否隐藏标题栏，只要开启「封面取色」标题栏即运用该算法；关闭则回落主题色（深色 `#0e0c16` / 默认色 / 兜底色）
- **移除「标题栏伪沉浸」判断**：删除 `cfg.wcoPseudoImmersive` 配置项、设置存取字段、设置开关卡片与相关事件/同步逻辑；深色/护眼切换新增 `ThemeColor.onDarkModeChange()` 刷新
- **沉浸式外观位置调整**：设置-外观「沉浸式外观（封面取色）」区块移至「主题色」下方、「背景图片」上方

### v3.6.5 (2026-07-09) — WCO 配色修正 + 创作卡片对齐/沉浸-PiP 适配 + 移除预览条/背景沉浸 + 曲库自动定位

- **WCO 标题栏配色修正**：左侧自绘标题栏改为透明直接透出背景（不渲染色块）；暗色去饱和结果改写入 `<meta theme-color>` 驱动右侧系统金刚键背景（伪沉浸融合主背景）；恢复原 header 与四大按键在 WCO 下正常显示
- **创作信息卡片对齐跟随设置**：`.lrc-credits` 系列 `text-align`/`justify-content` 改用 `var(--lrc-align)`，跟随歌词对齐（居中/左对齐）
- **沉浸/PiP 跳过创作信息首行卡片**：`audio-core.js`/`pip.js` 遇 `isCredits` 向前定位首行实际歌词，下一行计算跳过卡片行，不再 time 0 显示空白
- **移除封面取色渐变预览条**：删除 `#colorModePreview` DOM 与 `ui-core.js` 相关更新逻辑（依赖 `currentAlbumColor` 不即时刷新、显示滞后易误导）
- **移除「背景沉浸」功能**：与「深色/护眼模式」压暗护眼能力重合，删除 `#bg-immersive-scrim` 遮罩、开关卡片、`cfg.bgImmersive`、存取字段及 `applyBgImmersive()`
- **曲库打开自动定位当前专辑**：`cover-lib.js` 新增 `focusCurrentAlbumInCoverLib()`，按专辑视图打开即把正在播放专辑滚到封面流正中并高亮（窗口化未挂载时强制追加渲染后再居中）

### v3.6.4 (2026-07-09) — 创作信息注入歌词行 + 歌曲/歌手名不可拖拽

- **创作信息卡片注入为 `[00:00.00]` 歌词行**：整卡作为首行歌词嵌入歌词流，保留完整排版，AI 标记行内（注：本版 WCO 沉浸/去饱和灰度描述已在 v3.6.5 修正回退）
- **歌曲/歌手名不可拖拽选中**：`user-select:none` + `-webkit-user-drag:none` + `draggable=false` + `dragstart`/`selectstart` `preventDefault`

### v3.6.3 (2026-07-09) — 审计采纳 + 创作信息补全 + 点击复制 + 进度条偏移 + coverflow 调整

- **审计 v2 采纳**：无障碍（`prefers-reduced-motion` / 滚动条 / focus-visible）、动画节能（CSS 属性精确化/发光半径/透明度）、JS 健壮性（多文件 `isFinite` / `isConnected` 守卫 / 常量提取）
- **歌词创作信息补全**：文案/古筝/古筝编写/小提琴/小提琴编写 角色入正则
- **歌曲名/歌手名：点击复制**：`navigator.clipboard` + fallback 复制，Toast 提示
- **沉浸舱进度条偏移根治**：`isProgressDragging` 共享污染 — 本地标志隔离 + `cachedRect` 守卫
- **曲库 coverflow 上移 + 艺术家标签下移**：CSS flex 垂直居中 + `order: 2` 标签后置

### v3.6.2 (2026-07-09) — 沉浸舱进度条 + 审计采纳 + coverflow 上移

- **沉浸舱进度条点按偏移修复**：`isProgressDragging` 共享污染根治（本地标志隔离 + `cachedRect` 守卫 + 双槽 seek）
- **代码健壮性（审计采纳）**：`vibration.js` 手柄断线 `InvalidStateError`、`cover-lib.js` `musicLibrary` 守卫、`onProgressTick` `isFinite` 守卫、常量提取
- **UI/动画节能**：CSS `transition: all` 精确化、发光半径减半、btn-glass `text-shadow`、Firefox range 适配、`clamp` 尺寸自适应
- **节能系列**：曲库首屏预暖（60→12张）、一键节能自动暂停交叉淡变、节能态取色重取跳过、下一首封面预读跳过
- **曲库 coverflow 上移 + 艺术家标签下移**：CSS flex 垂直居中 + `order: 2` 标签后置

### v3.6.0 (2026-07-09) — 交叉淡变(Crossfade)功能与全部修复

- **设置-外观新增「标题栏伪沉浸」开关**（`cfg.wcoPseudoImmersive`，默认开启）：控制 PWA 标题栏 `theme-color` 是否跟随专辑封面/背景顶部取色；关闭后标题栏使用常规主题色，不再取顶部颜色
- **紧急修复线上构建导致播放器被压成标题条的 bug**：`css/base-layout.css` 中 `.player-wrapper` 规则缺少闭合大括号，导致构建后 `.player-wrapper` 被错误合并了按钮的 `height:50px` 等属性；已补全 `}` 并修正 `build.js` CSS 顺序、清理 `style.css` 重复进度条规则

### v3.5.2 (2026-07-07) — 标题栏伪沉浸开关 + 线上构建崩溃修复

- **设置-外观新增「标题栏伪沉浸」开关**：`cfg.wcoPseudoImmersive`（默认开启），控制 PWA 标题栏 `theme-color` 是否跟随专辑封面/背景顶部取色；关闭后标题栏使用常规主题色
- **紧急修复线上构建导致播放器被压成标题条的 bug**：`css/base-layout.css` 中 `.player-wrapper` 规则缺少闭合大括号，导致构建后 `.player-wrapper` 被错误合并了按钮的 `height:50px` 等属性；已补全 `}`，并修正 `build.js` CSS 顺序、清理 `style.css` 重复进度条规则

### v3.5.1 (2026-07-07) — 标题栏顶部取色回归修复 + build CSS 顺序/重复规则修复

- **标题栏顶部取色回归修复**：`applyThemeLogic()` `showColor` 分支原无条件调用 `ThemeColor.updateTopColor(null)`，覆盖了 `audio-core.js` 从专辑封面提取的顶部取色；已删除该行，并新增 `extractTopColorFromElement()` 从 DOM `<img>` 兜底采样。末尾追加 `ThemeColor.refresh()` 确保最终落盘
- **build CSS 顺序与重复规则修复**：`build.js` `CSS_FILES` 顺序与 HTML 不一致，且 `style.css`/`base-layout.css` 进度条规则重复；`clean-css` 合并后 `.prog-fill` 关键属性被拆散/覆盖，导致主页面/沉浸舱进度条不显示。已修正顺序并清理 `style.css` 中重复的进度条区块，由 `base-layout.css` 保留唯一权威规则

### v3.5.0 (2026-07-07) — 设置-外观新选项 + 歌词栏结构修复 + 性能优化 + WCO 假沉浸

- **歌词栏 CSS 结构性 Bug 修复**：修复 `base-layout.css` 中 `.lrc-line` 大括号过早闭合导致 7 条关键属性（`word-break`/`user-select:text`/`transform:scale(0.95)`/`padding` 等）成为孤儿代码完全失效的问题；缩小激活行字号跳变（*1.44→*1.2）消除布局抖动、恢复下一句不模糊的视觉梯队、新增歌词栏专属薄型滚动条、激活行颜色改用主题色辉光
- **设置-外观新选项**：「跟随强调色」与「背景沉浸」两个独立开关。跟随强调色与取色模式同源驱动全域强调色；背景沉浸让专辑封面/自定义背景全屏沉浸，夜间模式自动叠加半透明黑遮罩（alpha-over 分层合成 `1-(1-a)*(1-b)`）
- **音量百分比显示同步修复**：修复刷新后音量滑块已正确恢复到记忆值，但右侧 `#volPercent` 仍显示默认 70% 的 bug；`loadSettings()` 现在同步主界面与沉浸界面的百分比文字
- **曲库搜索防抖 (P0-1)**：`#coverLibSearch` 输入改为 180ms 防抖，连续击键只触发一次全量重渲染
- **`saveSettings` 节流落盘 (P1-1)**：首次调用立即落盘、400ms 节流窗口内合并写入，页面隐藏/卸载强制 `flushSettings()`；37 处调用方自动受益
- **统一图标切换 helper `setBtnIcon` (P1-4)**：优先切换 `<use href>`，无 `<use>` 时整段替换 SVG，消除内联 SVG 字符串重复
- **WCO 假沉浸标题栏**：隐藏标题栏时右侧系统金刚键背景自动取页面顶部附近颜色（`extractTopColor()`），系统窗口控制区与页面背景视觉融合；切歌、自定义背景上传/清除均同步计算顶部取色
- 沉浸舱取色背景实时跟随（修复退出沉浸舱才更新、返回主界面流沙卡顿一秒的 bug）
- 主界面右上角「列表 / 歌词 / 曲库」按键：手柄接入时正确注入手柄键位徽标，手柄断连后键盘提示不丢失

### v3.4.0 (2026-07-07) — 曲库 coverflow 交互与手柄返回修复

- **手柄 B 键逐级返回修复**：`handleGlobalClose()` 改为始终关闭实际最上层（z-index 最高）打开浮窗；播放列表（键盘 `p` / 手柄 ←）打开时补推 Modal 栈，B 键 / Esc 逐级返回一致，不再"卡在浮窗回不去主界面"
- **曲库-按专辑（coverflow）滚轮失效修复**：coverflow 网格带 `scroll-snap` + `smooth`，连续滚轮被吸附 / 平滑动画互相抵消导致封面不切；`enterCoverflowFlat()` 进入时关闭 snap/smooth、`setCoverLibCenter` 平坦分支改用 `behavior:'auto'`，滚轮连续切换跟手，停止 350ms 后自动恢复 3D 景深与吸附

### v3.4.1 (2026-07-07) — PWA / WCO 标题栏调整（Windows Chrome）

- **WCO 标题随切歌实时更新**：`audio-core.js` `loadSong()` 每次切歌调用 `WCO.setTrack(title, artist)`，标题栏当前曲目即时刷新；`wco.js` `_enable()` 新增 `_syncCurrentTrack()` 从 `playlist[currentIndex]` 兜底同步，切到 WCO 模式不再空白
- **标题居中**：`wco.css` 的 `.wco-titlebar` / `.wco-drag-region` 改为 `justify-content: center`，标题置于顶部正中，并自动避开右侧系统金刚键安全区
- **标题栏变色按 WCO 状态分流**：`theme-color.js` 新增 WCO 状态感知与 `refresh()`——隐藏标题栏（WCO active）时全局固定 `#180219`（忽略封面色与深色模式）；显示时跟随专辑封面色，无封面 / 取色失败回落主题默认色 `cfg.defaultColor`；`wco.js` `geometrychange` 切换显示 / 隐藏时触发 `ThemeColor.refresh()` 重新套色
- **修复无封面残留上一张封面色**：`loadSong()` 原「无封面」分支漏调 `ThemeColor.update()`，改为 if/else 两分支统一调用，彻底修复残留

### v3.4.2 (2026-07-07) — PWA / WCO 标题栏修复（Windows Chrome）

- **WCO 标题栏完全窗口水平居中**：`css/wco.css` 的 `.wco-titlebar` 由 `env(titlebar-area-x/width)` 安全区约束（自动避开右侧系统金刚键，导致标题贴左）改为 `left:0; width:100vw` 撑满整窗，`.wco-drag-region` 绝对定位铺满父级，`justify-content: center` 对整窗中线居中；整窗可拖（`app-region: drag`）
- **修复取色模式 OS 顶 bar 锁死紫色**：`js/theme-color.js` 移除 v3.4.1 将 WCO active 时 `meta theme-color` 写死 `#180219` 的逻辑，`meta theme-color` 改为始终跟随专辑封面色 / 主题默认色 / 深色模式——Windows Chrome OS 沉浸顶 bar 现在随封面取色实时变色（MBolka 自绘标题栏永远 `display:none`，OS 接管整条标题区域，故 meta theme-color 即顶 bar 颜色）
- **清理失效死规则**：移除 `css/wco.css` 中 `body.wco-active .wco-titlebar` 背景规则（自绘标题栏不参与渲染）
- **设置-音频均衡器预设改为下拉式菜单**：`js/ui-core.js` `renderEQPanel()` 将原「8 个预设按钮」阵列改为 `custom-select-wrap` 自定义下拉，与设置-触觉的「映射模式 / 节流间隔」下拉完全同构、同样式、同键盘/手柄交互；手动调节任一频段滑块后预设自动回落「自定义 (手动调节)」
- **手柄滑块微调引导**：设置页任意滑块获得焦点时，左右拨动左摇杆弹出 toast「点击 Ⓐ 进入滑块微调（←→ 调整）」（节流 1.5s），按 A 进入微调、方向键/左摇杆调整值、B 退出
- **手柄右摇杆调音量联动百分比**：`js/audio-core.js` `cfSetVolume()` 把百分比同步逻辑移入，修复手柄调音量时主界面 `#volPercent` 数字不更新（此前仅在滑块 `oninput` 更新，手柄路径不经过）
- **手柄右摇杆音量改为无级（类无级）调节**：`js/gamepad.js` 右摇杆左右由「150ms 门槛 + 固定 ±0.02 步进」改为「按偏转量与帧时间连续累加」（`rate=0.6·mag·(0.5+mag)`，`dt` 帧率无关，死区 0.3→0.12），偏角越大越快、轻推微调、松手即停；`js/audio-core.js` 新增 `adjustVolumeContinuous()` + 400ms 防抖保存，避免每帧 `localStorage` 落盘
- **修复手柄右摇杆上下滚歌词「几乎失效」**：根因为右摇杆滚歌词分支只清模糊、未置 `isUserScrollingLyrics`，导致 `syncLyrics()` 每次 `timeupdate` 都平滑滚回当前行与手柄输入互相打架（滚轮路径走 `handleUserScroll` 会置该标志故正常）；另 `.lrc-viewport` 的 `scroll-behavior: smooth` 使逐帧 `scrollTop +=` 被拖慢。`js/gamepad.js` 新增 `_rsLrcMarkScrolling()`：滚歌词时置 `isUserScrollingLyrics=true` 抑制自动跟随、临时关 `scroll-behavior`，停 1.5s 后复位并重新对齐
- **UI 图标去 emoji 化**：play/pause、pitch、crossfade、dark mode、网络状态、统计、收藏、睡眠定时、无封面占位等原 `textContent` 覆盖的 emoji 改为切换内置 SVG `<use>` 或 `iconSvg()` + 文字；PiP 窗口克隆主文档 SVG `<defs>` 使图标可渲染

### v3.4.3 (2026-07-07) — 手柄全流程静态修复

- **键盘 `D` 深色模式失效修复**：原 `switch` 中 `d` 被重复声明（先命中 coverflow 右导航并 `break`，深色切换成死代码）；改为 `Shift+D` 切深色模式，普通 `D` / `→` 保留 coverflow 右导航
- **键盘 `U`/`F` 收藏空操作修复**：`toggleFavorite()` 无参导致 `playlist[undefined]` 直接 `return`；改为 `toggleFavorite(currentIndex)`，收藏快捷键在任意曲目即时生效
- **设置滑块焦点泄漏修复**：滑块聚焦时中等幅度左右拨杆（0.2–0.5）仍触发 2D 导航离开滑块；引入 `_sliderFocused` 完全阻止左右导航，仅大角度拨杆做节流提示
- **手柄连接瞬间误触发修复**：`gamepadconnected` 时 `prevPadBtns=[]` 导致首帧误触发所有"刚按下"动作；改为连接时用当前手柄状态初始化 `prevPadBtns`/`prevPadAxes`
- **PiP 转发空引用修复**：转发 `pad.axes` 在 `getGamepads()[0]` 为 `null` 时抛错；加 `pad &&` 守卫避免崩溃
- **Menu 键未推栈修复**：`btns[9]` 开设置未 `_pushModal`；补 `_pushModal('settingsModal', null)`，与体系内其它模态一致
- **2D 焦点导航普遍修复（离轴元素抢焦点）**：主界面左摇杆向右本应到同排「歌词」却先跳下方「PiP」。根因 `moveFocus2D()` 第二阶段带筛选用错轴——横向按前进轴最近距（`minAbsDx`）、纵向按 `minAbsDy`，使「离轴但前进轴更近」的元素把同排目标排除。改为**按对齐轴筛带**：横向锁同排（`|dy|`）、纵向锁同列（`|dx|`），带内取前进轴最近者；键盘方向键与左摇杆均经 `moveFocus2D` 一并修复
- **设置滑块焦点卡死 + 关闭键跨段跳滑块修复**：① 滑块上左摇杆「任何方向都挪不开」——v3.4.2 的 `_sliderFocused` 分支只拦左右、对上下不处理；现改为上下仍可 `moveFocus2D` 离开滑块（自然退出），仅左右保留拦截+提示按 A 进微调；② v3.4.3 纵向带筛误用 `|dx|` 对齐，致「关闭键(右上)→同列深处 crossfadeSlider」跨段跳，统一回横纵都按 `|dy|` 筛带（纵向=`|dy|`=下行距离带，不再跨到同列深处滑块）
- **手柄浮动指示统一补全（PiPⓋ / 帮助⑪）**：`injectGamepadHints()` 补齐 PiP 按钮（ViewⓋ）与快捷键帮助按钮（R3⑪）的键位徽标——此前 PiP 按钮缺徽标导致「看不到 PIP 的手柄键位指示」。PiP 小窗在后台不响应手柄，故不在其内部注入
- **手柄省电与降开销**：轮询未连接手柄时自动停转（连接时重启）；转发 PiP 的 `gamepad-state` 节流到 ~30fps
- **导航健壮性微调**：右摇杆滚动自动吸附焦点仅在焦点离屏时触发（不再抢左摇杆导航）；设置 Tab 切换焦点刷新改 `requestAnimationFrame`；清理死分支与冗余状态拷贝

### v3.3.0 (2026-07-06) — 性能 / 可维护性 / 无障碍 / PWA 全面优化

- **歌词增量同步**：`syncLyrics` 仅激活行变化时更新 + 节点缓存（`getLrcLines`），消除每 tick 全量 `querySelectorAll` 与强制重排（修复由此引入的 TDZ 崩溃，首页恢复）
- **画布尺寸 ResizeObserver 化**：主画布尺寸仅变化时更新，rAF 内不再每帧读 `offsetWidth` 重排
- **暂停不重绘**：暂停且非沉浸时跳过逐帧重绘，空闲功耗下降
- **`setPositionState` 节流**：Media Session 位置状态降频至 ~4Hz
- **睡眠定时器按需**：无定时任务时不常驻 `setInterval`；删除 `globals.js` 内联 Worker 死代码；jsmediatags 改 `defer`
- **构建补全**：`build.js` 补列 `theme-color.js`/`wco.js`/`wco.css`，`dist/` 不再缺文件
- **节能统一**：删除冗余 `isEnergySaving`，统一 `EnergyMode` 位标志
- **XSS 防护**：搜索/收藏/统计 `title·artist` 与 Toast 经 `escapeHTML`；内联 `onclick` 迁 `ui-core.js`
- **PWA 离线**：运行时缓存 CDN 资源、`cache.addAll` 可观测、SW 更新提示、iOS 画中画回退
- **无障碍 (WCAG 2.2)**：视口缩放放开、进度条 aria 同步、`:focus-visible` 对齐、`getLuminance` 标准亮度公式、`player-wrapper` 改 `role="group"`

### v3.2.4 (2026-07-06) — 曲库缓存崩溃修复 + 唱片库 UI 重设计

- **4 个缓存 Bug 全量修复**：空缓存陷阱（cloneNode 时序）、竞态保护（generation ID）、缓存有效性检查（childNodes.length）、Tab 点击防抖（80ms）
- **唱片库 UI 重设计**：Analog Vinyl Archive 风格 — 硬角封套卡片、多层阶梯阴影、方形封面自适应、hover 浮现唱针播放按钮、响应式断点（6/5/4/3 列）

### v3.2.3 (2026-07-06) — 性能优化全量实施 + 自动播放策略修复

- **P0-P8 性能优化全量实施**：scrollable 惰性缓存（帧耗时 -50%）、焦点候选限制、DocumentFragment 批量插入（100 首 reflow 100→1）、事件委托（200 闭包→2 监听器）、曲库 Tab 缓存（切换 <1ms）、CSS transition 精确化 + contain:strict、拖拽辅助线复用
- **自动播放策略优雅降级**：`playAudio()` 捕获 `NotAllowedError` 后监听手势自动恢复，显示引导 Toast，15 秒自动过期
- **设置页嵌套清理**：Crossfade 从 `renderEQPanel` 动态嵌套移出为 HTML 独立 `drawer-box`

### v2.8.10 (2026-06-03) — 🌍 全球发行版：LRC 同时间戳配对重写 + UI 精修

- LRC 解析引擎基于 TME 真实编码格式完全重写（同时间戳=第一行翻译+第二行原文）
- 创作信息（词曲编曲）保留并 UI 焕新为 `.lrc-credits` 轻盈卡片
- 移除 (QQ音乐) 标签，下一句歌词还原 Apple Music 统一 `blur(2px)` 样式
- 前 5 句歌词 `margin-top` 逐句递减（64/48/36/24/14px），防止贴顶
- 日语 [kana:] 罗马音注音解析与呈现
- Crossfade 添加 ⚠ 实验性功能警告，开启时立即初始化 AudioContext
- PWA 版隐藏安装按钮，检测运行时弹 toast 欢迎

### v2.8.9 (2026-06-03) — Crossfade Web Audio 重写 + LRC 迭代

- Crossfade 引擎重写为 Web Audio GainNode 精确定时斜坡（替代 rAF 动画）
- 固定双槽位架构（永不交换），semaphore 防重叠
- LRC 解析引擎迭代（中文计数预扫描，isSingleLang 守卫）

### v2.8.8 (2026-06-03) — 歌词居中+B键退出+手柄全重写+双语启发式解析

- 修复歌词垂直居中（4个根因：padding:50%、CSS过渡干扰、scale未纳入、强制重排）
- 双语LRC启发式翻译检测（4条规则：时间差、中文检测、纯语言检测、长度比）
- 下一句歌词中间模糊厚度（blur:1px）
- B键高优先级退出所有浮窗（设置/列表/曲库/帮助/文件信息 专用关闭函数）
- 手柄适配重写（全浮窗元素收集、2D导航可见性惩罚、滑块微调模式）
- 手柄按钮重映射（LT/RT快进快退、X=播放暂停、Y=沉浸模式、LB/RB智能上下文）
- 沉浸模式修复（backdrop-filter模糊、非双语显示当前+下一句原文）

### v2.8.7 (2026-06-03) — 空翻译检测+Crossfade引擎重写

- 双语LRC空翻译检测（hasTranslation检查，不再误用下句原文）
- 翻译行字号缩小（0.75em，视觉层次分明）
- PiP歌词回退通用格式（当前原文+下一句原文）
- Crossfade引擎系统性重写（状态机+音频池+rAF指数曲线）

### v2.8.6 (2026-06-03) — 链式LRC专项修复 + 双行回退

#### 🔧 链式LRC解析修复
- **根因修复**：Map分组→链式算法，同时间戳首行=上句翻译、次行=本句原文
- **元数据过滤**：自动跳过制作信息行（曲/编曲/词/TME版权），不参与翻译链
- **翻译opacity调高**：沉浸模式0.7→0.85，PiP同样0.85，翻译行更清晰可见

#### 🎬 双行回退通用格式
- 沉浸模式+Pip统一为**原文在上 + 翻译在下**，不再预告下一句

---

### v2.8.5 (2026-06-03) — 双语LRC重写 + 歌词对齐 + Crossfade修复

#### 🐛 双语LRC解析重写
- **Map精确分组**：`parseLyricText()` 重构为 Map 分组算法，同时间戳第一行=原文、第二行=翻译，彻底解决双语歌词配对错误
- **沉浸模式回退**：不再显示下一句预告，`immNextLine` 显示翻译文本

#### 🎬 沉浸动画回退 + 延迟修复
- **回归简洁动画**：opacity+setTimeout 替代 CSS transition，消除频闪
- **修复1秒延迟**：`syncLyrics` 索引计算从顺序+偏移改为逆序精确匹配

#### 📐 新增歌词垂直对齐
- **两种模式**：垂直居中 / 偏上显示(QQ音乐风格)，设置面板一键切换，持久化存储

#### 🎵 Crossfade 跨曲修复
- **统一索引**：`getNextTrackIndex()` 确保 crossfade 歌曲 = 实际下一首
- **防重入**：`goNext()` + `finishCrossfade()` 双重保护，根除混音问题

#### ™️ 其他
- 代码功能指导文档同步更新，`audio-core.js` 标注为独立备用副本

---

### v2.8.4 (2026-06-03) — 节能重构 + 弹窗栈修复

#### ⚡ 位标志节能状态机
- 四位标志叠加：`ONE_CLICK` / `PIP_TEMP` / `FRAME_LIMIT` / `VISIBILITY`
- 开启一键节能后打开画中画，关画中画后一键节能保持

#### 🎮 手柄B键LIFO增强
- `handleGlobalClose()` z-index 排序 + 动态弹窗动画移除
- `updateFocusContext()` z-index 优先级检测

#### 🐛 修复
- 双语LRC两遍扫描合并、沉浸歌词CSS过渡防频闪、曲库浮窗关闭逻辑、版权添加QClaw

---

### v2.8.3 (2026-06-02) — 双语LRC + Crossfade双轨引擎

#### 🌏 双语LRC歌词
- 智能检测同时间戳双语行，原文高亮+翻译跟随，沉浸模式大字双语显示

#### 🎵 交叉淡入淡出双轨引擎
- `requestAnimationFrame` 实现真正双轨交叉播放（当前曲淡出+下首淡入）
- 预加载机制 + 降级兼容，高精度 `performance.now()` 检测

#### 📋 其他
- `escapeHtml()` 防XSS、新增双语CSS样式、crossfade 状态指示器

---

### v2.8.2 (2026-06-02) — 节能整合 + 画中画同步

#### ⚡ 节能板块重构
- 整合为"⚡ 节能模式"板块：一键节能（去除动效）、画面节能（30fps）、临时节能（画中画联动）
- 移除旧EQ面板下的性能模式按钮

#### 🔧 修复
- `pipTempEnergySaving` 标记区分临时/手动节能
- `visibilitychange` 标签页返回时正确判断节能状态
- Page Visibility API 暂停高频渲染

---

### v2.8.1 (2026-06-02) — 画中画修复 + 设置重构

#### 🔧 修复
- 画中画节能防御性检查、专辑详情弹入动画修复
- 设置菜单重构（7大板块）、X/Y手柄键映射优化

#### 🎮 手柄
- EQ预设按钮 `.focusable` 适配、手柄提示徽章扩展

---

### v2.8.0 (2026-06-01) — Release

#### ⚡ 节能模式精确控制
- 渲染守卫重构：ON时全局跳过所有绘制（含沉浸舱），OFF时PiP不影响主界面
- 沉浸舱强制退出 + 内存释放

#### ⌨️ 快捷键全面升级
- `Ctrl+O` 载入、`U/F` 收藏、`/` 搜索、`Alt+T` 定时、`Shift+Esc` 全部关闭

#### 🎮 手柄按键指示器
- 接入时自动注入 ⓐⓑⓧⓨ 按键徽章，断开自动清除

#### 🎨 设置UI重构
- 载入音乐置顶、取色模式视觉核心、主题色归入引擎

---

### v2.5.0 (2026-06-01)

#### 🚀 全域弹窗栈控制器
- `handleGlobalClose()` LIFO 统一关闭管理器，Esc / 手柄 B 键自动关闭最上层弹窗
- 完美层级退回：曲库 → 专辑详情 → 逐层关闭

#### 🌊 全域 60FPS 色调同步
- `renderVisLoop` 核心重构：色相过渡统一到函数顶部，主界面与沉浸模式共享同一 `currentHue`
- 主页面流沙背景 60 帧实时取色，毫秒级响应主题切换

#### 🔧 关键 Bug 修复
- `.btn-mode.active` 深色反白 (`var(--text-on-primary)`)
- 弹窗切换视觉残留消除（transition 临时禁用 + 强制重绘）
- 专辑详情手柄全适配（tabindex + focusContext）
- 曲库增量切片渲染恢复（每次 12 张卡片）

#### ⚡ 性能优化四剑客
- 粒子对象池化、三角函数 LUT 查表、GPU will-change 升格、DOM 布局抖动消除

---

### v2.2.0 (2026-05-31)

#### 🔧 Bug 修复与体验
- 移除专辑封面滑动切歌提示文字
- 修复大文件夹加载卡顿（并发批处理 + 主线程让出）
- 明确拖拽场景限制（禁用模态框/按钮区/封面区拖入）
- 播放列表拖拽插入线视觉反馈
- 睡眠定时器实时倒计时（分:秒）+ 最后1分钟红色闪烁
- A-B 段落重复视觉标记（红色标记点 + 区间色块）
- 空状态脉冲呼吸引导动画

#### 🖼️ 封面库增强
- 按专辑 / 按艺术家 / 最近添加 三维度聚合
- 专辑详情面板（大封面 + 完整曲目 + "播放整张专辑"）
- Hover 黑胶唱片滑出动效
- 艺术家圆形头像视图

#### 📺 画中画重构
- 动态模糊背景 + 呼吸动画
- 两行歌词（大字当前行 + 小字下一行）+ 淡入淡出过渡
- 悬停浮现控制栏（上一首/播放/下一首/收藏）
- 3px 极简进度条
- 无歌词降级（旋转黑胶唱片）
- 响应式形态（宽扁/竖排自适应）
- CSS 自动同步到 PiP 窗口

#### ⚡ 性能
- FPS 实时监测 + 粒子密度自适应
- Blob URL 内存泄漏修复
- 并发元数据解析（Promise.all）

#### 🛠 工程质量
- `window.MBolka` 命名空间封装
- 全局错误捕获 + 日志持久化 + 一键导出
- 歌词偏移 ±0.1s 精细调

---

### v2.1.0 (2026-05-31)

#### 🔧 Bug 修复
- 修复退出沉浸模式后Canvas频谱残留
- 频谱改为现代灰阶设计
- 修复右上角按钮被遮挡
- 修复空态页拖拽冲突
- 优化滑动切歌提示

#### 🚀 新增功能
- **目录句柄持久化**：File System Access API + IndexedDB，下次自动恢复
- **全文搜索**：播放列表实时搜索
- **导出导入**：M3U / JSON 格式
- **统计看板**：总时长、Top10、播放次数
- **十段均衡器**：8种预设 + 手动调节
- **变速/变调**：0.5x~2.0x + 保持音调开关
- **淡入淡出**：1~8秒可配置 Crossfade
- **睡眠定时器**：15/30/60分钟
- **内嵌歌词**：读取 ID3/USLT 标签
- **歌词偏移**：+0.5s/-0.5s 微调
- **画中画**：Document PiP 悬浮窗
- **PWA**：可安装到桌面
- **移动端手势**：双击快进退、滑动调音量
- **节能模式**：30fps渲染
- **Media Session**：锁屏进度同步

#### 📁 架构优化
- CSS/JS 拆分为独立文件（`css/style.css` + `js/app.js`）
- 封面库独立为专属功能模块

---

### v2.0.1 (2026-05-31)

#### 🎛️ 交互优化
- **播放模式合并**：顺序 → 随机 → 单曲循环 三段式循环，统一为一个按钮。快捷键 `M` / `R` / `S` 或手柄 `X` 键循环切换
- **修复右上角按钮遮挡**：调整标题栏 z-index 层级，确保所有操作按钮始终可点击

#### 🎨 沉浸模式可视化重做
- 全新 6 层视觉系统：极光光晕 → 中心发光核心 → 底部频谱弧线 → 两侧对称频谱柱 → 顶部细线频谱 → 散布光点
- 粒子系统增强：上限 120 个，鼠标跟随更密集，点击空白区生成涟漪
- 色相过渡更平滑

#### 🖼️ 封面库独立
- 从播放列表中独立，按封面/专辑自动聚合
- 相同封面的歌曲归为一个专辑卡片
- 显示封面缩略图、专辑名、歌曲数量
- 播放列表新增「全部」「收藏」「封面库」三个视图切换按钮

#### ✨ UI/UX 优化
- 主界面频谱条改为彩色渐变
- 专辑封面滑动增加动画效果
- 解析并显示歌曲专辑名称
- 文件信息面板新增专辑和时长显示

---

### v2.0.0 (2026-05-30)

#### 一、核心体验增强

##### 🚀 加载性能优化 (Web Worker + IndexedDB)
- 引入 Web Worker 架构解析元数据，避免阻塞主线程 UI
- IndexedDB 缓存已解析的歌曲元数据（文件名+大小+修改时间为 key），下次打开同一文件夹无需重新解析
- 分页懒加载优化：首批 20 首即刻就绪，后续 10 首/批在后台渐进式加载
- 支持拖拽文件夹直接载入（递归读取子目录）

##### ⚠️ 播放错误容错
- 歌曲解码失败时自动跳过到下一首，不会中断播放流程
- 失败歌曲在播放列表中标红显示（红色边框+背景）
- 错误信息自动记录到 IndexedDB 和 localStorage 双存储

##### 📋 播放列表管理（右键菜单）
- 右键列表项弹出上下文菜单：播放、查看文件信息、收藏/取消、从列表移除、清空列表
- 文件信息面板展示：标题、艺术家、文件名、大小、格式、时长、是否有封面、收藏状态
- 支持 HTML5 Drag & Drop 拖拽排序，实时调整播放顺序

##### 🔂 单曲循环模式
- 新增单曲循环按钮，与顺序/随机播放互斥
- 快捷键 `R` 快速切换

##### 🎯 A-B 段落重复
- 长按播放按钮（800ms）进入/退出 A-B 模式
- 在进度条上点击设置 A 点和 B 点
- 播放自动在 A-B 区间循环，适合学歌/练乐器

#### 二、交互细节升级

##### 🖱️ 进度条悬停歌词预览
- 鼠标悬停进度条时，浮动提示框显示该时间点对应的歌词片段
- 沉浸模式和主界面双端均支持

##### 👆 滑动切歌
- 专辑封面区域支持触摸左右滑动切换上一首/下一首
- 触屏设备友好，滑动距离超过 50px 触发

##### 🎨 预设主题色系统
- 10 套预设配色方案：默认蓝、赛博朋克、暖阳、极光、星夜、樱花、深海、日落、薄荷、玫瑰金
- 设置面板中可视化选择，一键切换

##### 🖼️ 专辑封面瀑布流（封面墙）
- 播放列表新增"封面墙"视图模式
- 以网格方式展示所有歌曲的专辑封面
- 当前播放歌曲高亮标记

#### 三、视觉增强

##### ✨ 沉浸模式粒子互动
- 鼠标移动时粒子跟随产生拖尾效果
- 触摸移动时同样触发粒子效果
- 音乐高潮（低频能量超过阈值）时自动触发粒子爆炸

##### 🌈 动态壁纸联动
- 沉浸模式背景光晕根据频谱实时变化（低频→色相偏移，中高频→亮度）
- 环状频谱颜色随音乐频谱数据动态调整

##### 🌙 深色/护眼模式
- 手动切换（快捷键 `D`）
- 纯 CSS 变量驱动，切换无闪烁

#### 四、技术优化

##### 💾 IndexedDB 缓存系统
- 解析后的歌曲元数据存入 IndexedDB
- 二次打开相同文件时直接读取缓存，速度提升显著
- 支持 metadata 和 errors 两个 object store

##### 📝 错误日志本地存储
- 播放异常、CUE 解析失败等信息自动记录
- 双存储保障：IndexedDB + localStorage 备份
- 最多保留 100 条日志

##### 🎛️ 媒体会话增强 (Media Session API)
- 完善系统通知栏媒体控制：显示封面图、歌名、艺术家
- 支持硬件按键：播放/暂停、上一首/下一首
- 新增 seekto、seekbackward、seekforward 动作处理

##### 📑 CUE 分轨支持
- 解析 .cue 文件中的曲目信息（FILE、TITLE、PERFORMER、INDEX）
- 自动提取分轨时间点和元数据
- 支持 UTF-8 编码的 CUE 文件

##### ⌨️ 快捷键大全面板
- 按 `?` 键弹出帮助面板
- 分类展示所有键盘、手柄、鼠标/触屏操作
- 分三大类：播放控制、界面导航、鼠标/触屏操作

##### 🎵 歌词自定义调节
- 设置面板新增歌词显示调节
- 字号：12px ~ 32px 滑块调节
- 行距：1.2 ~ 3.5 滑块调节
- 对齐方式：居中 / 左对齐切换

#### 五、沉浸模式退出优化
- 双击空白区域退出沉浸模式
- 触屏下滑手势退出（下滑距离 > 100px）
- 底部始终显示小箭头按钮，点击退出

#### 六、收藏/喜爱系统
- 每首歌旁 ❤️ 按钮，一键收藏/取消
- 播放列表支持筛选"仅显示收藏"
- localStorage 持久化存储收藏列表

---

## 🚀 快速开始

1. 用浏览器打开 `index.html`
2. 按 **Ctrl+O** 或前往设置页点击 **"打开文件夹"** 按钮，选择你的音乐文件夹
3. 或者直接将音乐文件夹**拖拽**到页面任意位置
4. 享受音乐！

> **提示**：将 `.lrc` 歌词文件与同名音频放在同一文件夹，即可自动加载歌词。  
> 将 `.cue` 分轨文件放入文件夹，播放器会自动解析曲目信息。

---

## ⌨️ 操作指南

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `Space` / `Enter` | 播放 / 暂停 |
| `←` / `→` | 上一曲 / 下一曲 |
| `↑` / `↓` | 音量加减 |
| `J` / `K` | 快退 / 快进 10 秒 |
| **`Ctrl+O`** | **打开文件夹载入音乐** |
| `I` | 切换沉浸模式 |
| `S` / `M` / `R` | 播放模式: 顺序→随机→单曲循环 |
| `C` / `Y` | 取色模式开关 |
| **`U` / `F`** | **收藏/取消收藏当前歌曲** |
| **`/`** | **聚焦搜索播放列表** |
| `Shift+D` | 深色/护眼模式切换 |
| `D` / `→` | coverflow 右导航 |
| `L` | 歌词面板开关 |
| `P` | 打开播放列表 |
| `Shift+F` | 全屏开关 |
| `T` | 统计面板 |
| `G` | 曲库 |
| `Q` | 画中画 |
| **`Alt+T`** | **睡眠定时器快速菜单** |
| `Esc` | 关闭弹窗 / 退出沉浸 |
| **`Shift+Esc`** | **一键关闭所有弹窗** |
| `?` | 快捷键帮助面板 |
| `WASD` | UI 焦点导航 |

### 手柄映射

| 手柄按键 | 功能 |
|----------|------|
| `A` | 播放 / 暂停 / 确认 (ⓐ 徽章标识) |
| `A` (长按) | A-B 重复模式 / 弹出右键菜单 |
| `B` | 返回 / 关闭弹窗 / 退出沉浸 (ⓑ 徽章) |
| `X` | 播放 / 暂停 (ⓧ 徽章) |
| `X` (双击) | 播放模式切换 |
| `X` (长按) | 收藏 / 取消收藏当前歌曲 |
| `Y` | 切换沉浸模式 (ⓨ 徽章) |
| `Y` (长按) | 深色/护眼模式切换 |
| `LB` / `RB` | 上一曲 / 下一曲 |
| `LB` / `RB` (搜索框) | 首字母/预设词快速跳转轮换 |
| `LT` / `RT` | 快退 / 快进 5 秒 |
| `LT` (长按) | 睡眠定时器快速菜单 |
| `RT` (长按) | 统计面板 |
| `LT` + `RT` (同时) | 进度条 Seek 模式 |
| `左摇杆` | 2D 空间焦点导航；设置滑块焦点下左右拨动 → toast 提示按 A 进入滑块微调 |
| `右摇杆` (左右) | 音量无级调节（按偏转量连续累加：偏角越大越快、轻推微调、松手即停） |
| `右摇杆` (上下) | 滚动歌词 / 浮窗内容（带加速度） |
| `十字键 上` | 打开播放列表 |
| `十字键 下` | 切换沉浸模式 |
| `十字键 左/右` | 快退 / 快进 |
| `View` | 全屏开关 |
| `View` (长按) | 打开曲库 |
| `View` + `Start` | 画中画开关 |
| `View` + `RB` | 帮助面板 |
| `Start` | 打开设置 |
| `Start` (长按) | 打开播放列表 |

> 🎮 手柄接入后，按钮上会自动出现 ⓐⓑⓧⓨ 按键徽章，像游戏一样直观！

### 鼠标/触屏操作

| 操作 | 功能 |
|------|------|
| 点击进度条 | 跳转到指定位置 |
| 悬停进度条 | 预览该时间点歌词 |
| 右键播放列表 | 上下文菜单 |
| 拖拽列表项 | 调整播放顺序 |
| 长按播放键 | A-B 段落重复 |
| 滑动专辑封面 | 切换上下曲 |
| 双击沉浸空白区 | 退出沉浸模式 |
| 沉浸模式鼠标移动 | 粒子跟随特效 |

---

## 🏗️ 技术架构

```
MBolka Player v3.6.6p1
├── index.html          - HTML 结构（含 WCO 标题栏 + #wcoActionsSlot 沉浸模式按钮挂载槽 + 竖屏/横屏响应式布局）
├── css/
│   ├── variables.css   - CSS 自定义属性
│   ├── base-layout.css - 主界面布局 + 双语歌词 + 创作信息卡片（v3.6.6p1 卡片居中+内文左对齐）
│   ├── components.css  - 通用组件
│   ├── modals.css      - 弹窗样式
│   ├── cover-lib.css   - 曲库面板
│   ├── immersive.css   - 沉浸模式 + 歌词动画
│   └── wco.css         - PWA Window Controls Overlay 标题栏（v3.6.6p1 整窗居中+竖屏靠左+按钮挂载槽）
├── js/
│   ├── app.js          - 主应用（链式双语LRC + 位标志节能机 + LIFO弹窗栈 + Crossfade双轨 + 60fps色相同步 + 任意 PWA 竖屏自动进入沉浸）
│   ├── wco.js          - WCO 标题栏 + 沉浸模式按钮挂载槽 mountActions/unmountActions（v3.6.6p1）
│   ├── theme-color.js  - PWA 主题色管理（v3.6.6 合并 toDarkColor 深色取色算法）
│   ├── vibration.js    - 手柄震动反馈引擎（频谱映射 + 自动地板EMA + 双马达独立增益）
│   └── ...             - 其他辅助模块
├── 核心 API
│   ├── HTML5 Audio API 音频播放
│   ├── Web Audio API 频谱可视化 + EQ/Crossfade 双轨引擎
│   ├── File System Access API 目录持久化
│   ├── Document PiP API 画中画
│   ├── Window Controls Overlay API PWA 标题栏融合（v3.6.6p1 整窗居中+按钮挂载槽）
│   ├── Canvas 2D 粒子特效系统 + 流沙背景渲染
│   ├── IndexedDB 元数据缓存 + 目录句柄存储
│   ├── Web Worker 异步解析
│   ├── Media Session API 系统集成
│   ├── Service Worker PWA 支持
│   ├── Gamepad API 手柄支持 + 2D 空间焦点导航 + 按键指示器 + **震动反馈 (dual-rumble)**
│   ├── Fullscreen API 全屏控制
│   ├── Drag & Drop API 文件拖拽
│   ├── FileReader API 本地文件读取
│   ├── Page Visibility API 节能联动
│   └── jsmediatags 元数据解析
├── 依赖
│   └── jsmediatags (CDN) - ID3/FLAC 标签读取
└── 零后端依赖，零数据库，纯浏览器运行
```

---

## 🌐 浏览器兼容性

| 浏览器 | 支持情况 |
|--------|----------|
| Chrome 90+ | ✅ 完全支持 |
| Edge 90+ | ✅ 完全支持 |
| Firefox 88+ | ✅ 完全支持 |
| Safari 15+ | ⚠️ 部分特性受限 |
| Opera 76+ | ✅ 完全支持 |

> 需要浏览器支持：Web Audio API, IndexedDB, Gamepad API (手柄可选), Fullscreen API (全屏可选)

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- 基于 [jsmediatags](https://github.com/aadsm/jsmediatags) 进行音频元数据解析
- 字体使用 [Newsreader](https://fonts.google.com/specimen/Newsreader) (标题衬线) + [Geist](https://vercel.com/font) (正文无衬线)
- co-created with DeepSeek@Tencent Yuanbao, Gemini 3.1 Pro Preview, CodeBuddy, Marvis, QClaw

---

**© MocaBolka 2026 | v3.6.6p1**
