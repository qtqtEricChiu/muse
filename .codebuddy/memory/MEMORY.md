# MBolka Player 项目记忆

## 重要约定

### 模块化注意事项
- **TDZ（Temporal Dead Zone）**：`const` 和 `let` 声明的函数没有提升特性，必须定义在前、使用在后。如需在定义前引用，请使用 `function` 声明（有提升）。
- 事件绑定代码应放在文件末尾（所有函数定义之后），或确保被引用的函数使用 `function` 声明。

### JS 文件加载顺序（`index.html`）
1. `globals.js` — 全局变量、el 引用
2. `utils.js` — 工具函数
3. `storage.js` — 存储/IO
4. `loader.js` — 文件加载
5. `audio-core.js` — 音频核心/歌词引擎
6. `pip.js` — 画中画/节能模式
7. `visualizer.js` — 可视化
8. `ui-core.js` — UI 绑定
9. `cover-lib.js` — 曲库
10. `gamepad.js` — 手柄
11. `app.js` — 入口/初始化

### 修复记录
- 2026-07-05: 修复 `ui-core.js` 4 个 TDZ 错误，完成 20 项系统优化（详见每日日志）。

### 优化注意事项
- **will-change 动态管理**：不要长期持有 `will-change`，在动画/过渡开始前通过 JS 设置，结束后通过 `setTimeout` 清除
- **IDB 批量写入**：使用队列 + `queueMicrotask` 批量 flush，减少 transaction 开销
- **无障碍**：任何时候添加动画/粒子效果，必须同时添加 CSS `@media (prefers-reduced-motion: reduce)` 和 JS 层监听
- **骨架屏**：在异步加载开始时插入骨架占位，加载完成后移除
- **CDN 依赖**：必须添加 `integrity` 和 `crossorigin` 属性
- **Service Worker**：必须外部化到独立 `sw.js` 文件，不要内联在 HTML 中
