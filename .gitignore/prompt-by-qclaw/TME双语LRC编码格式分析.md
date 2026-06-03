# TME 双语 LRC 编码格式 - 系统性分析

## 📋 概述

TME (腾讯音乐娱乐) 的双语 LRC 格式是一种扩展的 LRC 标准，通过**时间戳配对机制**实现原文与译文的同步显示。

---

## 🔬 核心编码模式

### 模式 1：同时间戳配对（主要模式）

**结构**：
```
[MM:SS.mm]原文行
[MM:SS.mm]译文行
```

**特征**：
- 原文与译文**共享完全相同的时间戳**
- 连续两行使用相同时间戳
- 第一行通常为原文（外语），第二行为译文（中文）

**示例**（技术示意）：
```
[00:08.54]I go in
[00:08.54]我全情
[00:09.84]all the way
[00:09.84]投入其中
```

---

### 模式 2：元数据翻译配对

**结构**：
文件开头元数据区域也采用同时间戳配对：

```
[00:00.00]歌曲名 - 艺术家
[00:01.90]TME享有本翻译作品的著作权
[00:01.90]词：Author Name
[00:03.80](空行)
[00:03.80]曲：Composer Name
```

**特征**：
- 版权声明、创作信息均有对应翻译
- 空行也复制时间戳（用于留出视觉间距）

---

### 模式 3：多语言混排

**观察案例**：
- 英语 + 中文
- 日语 + 中文
- 韩语 + 中文
- 西班牙语 + 中文

**编码一致性**：所有语言对均使用**相同时间戳配对机制**

---

### 模式 4：并发显示模式（非标准格式）

**观察案例**：`Giant - 宋雨琦 (YUQI).lrc`

**结构**:
```
[MM:SS.mm]原文行（外语）
[MM:SS.mm+Δ]翻译行（中文）
[MM:SS.mm+Δ]下一句原文行
```

**特征**:
- 翻译不与原文共享时间戳，而是与下一句原文共享时间戳
- 实现"并发显示"效果：翻译与下一句原文同时显示
- 用于LRC播放器不支持标准同时间戳配对时的降级方案
- 在元数据和歌词区一致使用

**示例**:
```
[00:38.25]I won't be afraid
[00:39.87]我不会害怕
[00:39.87]紧握住黑暗中的希望
```

解释：
- `[00:38.25]I won't be afraid`（英语原文）
- `[00:39.87]我不会害怕`（中文翻译，与下一句原文共享时间戳）
- `[00:39.87]紧握住黑暗中的希望`（下一句中文歌词）

**元数据中的一致性应用**:
```
[00:03.52]TME享有本翻译作品的著作权
[00:03.52]Lyrics by：우기/BOYTOY/...
[00:07.05]（空行）
[00:07.05]Composed by：우기/BOYTOY/...
```

**解析挑战**:
- 标准TME检测（同时间戳配对）无法识别此格式
- 需要检测"单时间戳多行"模式
- 需要判断哪行是翻译，哪行是下一句原始歌词
- 需要区分"标准配对格式"（模式1）和"并发显示格式"（模式4）

**检测算法要点**:
```javascript
// 检测是否存在"单时间戳多行"
function hasConcurrentTimestamps(lines) {
    const timestampCount = {};
    lines.forEach(line => {
        const ts = line.time;
        timestampCount[ts] = (timestampCount[ts] || 0) + 1;
    });
    return Object.values(timestampCount).some(count => count >= 2);
}

// 判断是否为并发显示模式
function isConcurrentDisplayMode(lines) {
    if (!hasConcurrentTimestamps(lines)) return false;
    
    // 检查多行时间戳是否包含中文字符
    const allLines = parseFile(lines); // 预处理后的行数组
    const concurrentTimestamps = [...new Set(allLines.filter(l => 
        allLines.filter(ll => ll.time === l.time).length >= 2
    ).map(l => l.time))];
    
    for (const ts of concurrentTimestamps) {
        const linesAtTs = allLines.filter(l => l.time === ts);
        const hasChinese = linesAtTs.some(l => /[\u4e00-\u9fa5]/.test(l.text));
        const hasNonChinese = linesAtTs.some(l => !/[\u4e00-\u9fa5]/.test(l.text) && l.text.trim() !== '');
        
        if (hasChinese && hasNonChinese) return true;
    }
    
    return false;
}
```

**与标准TME格式的区别**:
| 特征 | 标准TME格式（模式1） | 并发显示模式（模式4） |
|------|---------------------|---------------------|
| 翻译时间戳 | 与原文相同 | 与下一句原文相同 |
| 显示效果 | 原文+翻译同时显示 | 翻译+下一句原文同时显示 |
| 使用场景 | TME标准双语LRC | 降级方案（播放器不支持标准配对）|
| 检测难度 | 简单（查找同时间戳配对）| 中等（需检测"单时间戳多行"）|

**实际案例分析：`Giant - 宋雨琦 (YUQI).lrc`**

1. **歌曲信息**:
   - 歌曲名："Giant (巨人)" - 宋雨琦 (YUQI)
   - 主题：从挫折中奋起（"I'll rise up like a giant"）
   - 语言对：英语 ↔ 中文（全翻译）

2. **实际编码结构**:
```
[00:38.25]I won't be afraid          ← 英语原文
[00:39.87]我不会害怕                ← 中文翻译  
[00:39.87]紧握住黑暗中的希望        ← 下一句中文歌词（与翻译共享时间戳）
```

3. **元数据区域也使用并发格式**:
```
[00:03.52]TME享有本翻译作品的著作权    ← 版权声明（中文）
[00:03.52]Lyrics by：우기/BOYTOY/...   ← 创作信息（英语/韩语）
[00:07.05]（空行）                    ← 空行
[00:07.05]Composed by：우기/BOYTOY/... ← 下一创作信息（与空行共享时间戳）
```

4. **完整翻译覆盖**: 每一句英语原文都有中文翻译，且翻译与下一句歌词同时显示。

5. **编码确认**: 该文件为 **UTF-8 编码**（此副本无乱码）。之前遇到的乱码问题很可能是将 GBK 编码文件误读为 UTF-8。

6. **结构特殊性**: 
   - 中文歌词原文（无外语转换）
   - 英语部分翻译为中文
   - 形成 **纯中文 + 英中翻译** 的混合结构

**对 MBolka Player 的影响**:
当前 v2.8.x 的检测逻辑寻找 **标准 TME 配对**（原文与翻译同时间戳）。此文件使用 **不同格式**，将无法被正确检测。

**需要更新的功能**:
1. 增加对"并发显示"格式的检测
2. 更新解析算法以处理两种格式
3. 增加格式自动检测机制

---

## 🏷️ 版权声明标记

### 标准标记语句

| 标记类型 | 中文标记 | 出现位置 |
|---------|---------|---------|
| 著作权声明 | `TME享有本翻译作品的著作权` | 第2行（伴生时间戳） |
| 翻译提供方 | `以下歌词翻译由文曲大模型提供` | 第2行 |
| 混合标记 | `TME浜湁鏈炕璇戜綔鍝佺殑钁椾綔鏉?` | 乱码版本（编码错误） |

### 标记位置规律

1. **绝对位置**：`[00:00.00]` 或 `[00:01.90]` 附近
2. **配对规则**：版权行本身也可能被翻译（中英文各一行）
3. **过滤需求**：解析时需识别并过滤这些非歌词内容

---

## 📐 文件结构模板

```
[00:00.00] 标题行（歌曲名 - 艺术家）
[00:01.90] 版权声明（中文）
[00:01.90] 版权声明（英文，可选）
[00:03.80] (空行)
[00:03.80] 词：...
[00:05.70] (空行)
[00:05.70] 曲：...
...（更多元数据）
[00:07.05] (空行)
[00:07.05] 演唱：...
...（更多元数据）
[00:14.11] (空行)
[00:14.11] 出品：...
[00:15.26] (空行)
[00:15.26] 第一句歌词原文
[00:17.23] 第一句歌词译文
[00:17.23] 第二句歌词原文
[00:22.10] 第二句歌词译文
...（重复直到结束）
```

---

## 🧠 解析算法设计要点

### 1. 识别双语配对

**启发式规则**：
```javascript
function isTranslationLine(currentLine, nextLine) {
    // 规则1: 时间戳完全相同
    if (currentLine.time !== nextLine.time) return false;
    
    // 规则2: 检测语言特征
    const currentHasChinese = /[\u4e00-\u9fa5]/.test(currentLine.text);
    const nextHasChinese = /[\u4e00-\u9fa5]/.test(nextLine.text);
    
    // 规则3: 原文通常为纯外语，译文包含中文
    if (!currentHasChinese && nextHasChinese) return true;
    
    // 规则4: 同时间戳两行，至少一行有中文
    if (currentLine.time === nextLine.time) {
        return currentHasChinese || nextHasChinese;
    }
    
    return false;
}
```

### 2. 过滤元数据行

**识别创作信息行**：
```javascript
function isMetadataLine(text) {
    const metadataPatterns = [
        /^TME享有/,
        /^以下歌词翻译/,
        /^词：/,
        /^曲：/,
        /^编曲：/,
        /^制作人：/,
        /^演唱：/,
        /^混音：/,
        /^母带：/,
        /Lyrics by/i,
        /Composed by/i,
        /Arranged by/i
    ];
    
    return metadataPatterns.some(pattern => pattern.test(text));
}
```

### 3. 处理空行

**策略**：保留时间戳但标记为空白
```javascript
function parseLine(lineText) {
    const match = lineText.match(/^\[(\d{2}:\d{2}\.\d{2})\](.*)$/);
    if (!match) return null;
    
    return {
        time: match[1],
        text: match[2].trim(),
        isEmpty: match[2].trim() === ''
    };
}
```

---

## 🎯 MBolka Player 解析策略建议

### 当前问题（v2.8.x）

1. **过度宽泛的双语检测**：仅检测TME版权声明导致日语等语言误判
2. **翻译配对错误**：按时间戳分组导致翻译与错误原文配对
3. **元数据未过滤**：创作信息显示在歌词区域

### 改进方案

#### 方案 A：严格模式检测

```javascript
function detectBilingualMode(lyricsData) {
    // 条件1: 存在TME版权声明
    const hasTMECopyright = lyricsData.some(line => 
        line.text.includes('TME享有') || 
        line.text.includes('文曲大模型')
    );
    
    // 条件2: 存在同时间戳配对
    const hasPairedTimestamps = lyricsData.some((line, i) => 
        i < lyricsData.length - 1 && 
        line.time === lyricsData[i + 1].time
    );
    
    // 条件3: 配对行中存在中文字符
    const hasChineseInPairs = lyricsData.some((line, i) => {
        if (i >= lyricsData.length - 1) return false;
        if (line.time !== lyricsData[i + 1].time) return false;
        return /[\u4e00-\u9fa5]/.test(line.text) || 
               /[\u4e00-\u9fa5]/.test(lyricsData[i + 1].text);
    });
    
    return hasTMECopyright && hasPairedTimestamps && hasChineseInPairs;
}
```

#### 方案 B：逐行解析算法（推荐）

```javascript
function parseLyricText(rawText) {
    const lines = rawText.split('\n');
    const parsedLyrics = [];
    let i = 0;
    
    while (i < lines.length) {
        const current = parseLine(lines[i]);
        if (!current) { i++; continue; }
        
        // 过滤元数据
        if (isMetadataLine(current.text)) {
            i++;
            continue;
        }
        
        // 检查是否存在配对行
        if (i + 1 < lines.length) {
            const next = parseLine(lines[i + 1]);
            
            if (next && current.time === next.time && !current.isEmpty) {
                // 找到配对：判断哪行是译文
                const hasChineseCurrent = /[\u4e00-\u9fa5]/.test(current.text);
                const hasChineseNext = /[\u4e00-\u9fa5]/.test(next.text);
                
                if (!hasChineseCurrent && hasChineseNext) {
                    // 当前行原文，下一行译文
                    parsedLyrics.push({
                        time: current.time,
                        original: current.text,
                        translation: next.text,
                        isBilingual: true
                    });
                    i += 2;
                    continue;
                } else if (hasChineseCurrent && !hasChineseNext) {
                    // 当前行译文，下一行原文（罕见）
                    parsedLyrics.push({
                        time: current.time,
                        original: next.text,
                        translation: current.text,
                        isBilingual: true
                    });
                    i += 2;
                    continue;
                }
            }
        }
        
        // 无配对：单行歌词
        parsedLyrics.push({
            time: current.time,
            original: current.text,
            translation: '',
            isBilingual: false
        });
        i++;
    }
    
    return parsedLyrics;
}
```

---

## 📊 编码格式总结表

| 特征 | 描述 | 示例 |
|-----|------|------|
| **时间戳格式** | `[MM:SS.mm]` 百分秒精度 | `[00:08.54]` |
| **配对机制** | 原文译文共享时间戳 | 连续两行同时间戳 |
| **译文位置** | 原文后立即跟随 | 第二行 |
| **空行处理** | 复制时间戳，无文本 | `[00:07.05]` |
| **元数据** | 同配对机制 | 版权声明也配对 |
| **版权标记** | 固定语句识别 | `TME享有本翻译作品的著作权` |
| **语言支持** | 任意语言+中文 | 英/日/韩/西+中 |

---

## ⚠️ 已知问题与边界情况

### 问题 1：乱码编码

**现象**：`TME浜湁鏈炕璇戜綔鍝佺殑钁椾綔鏉?`

**原因**：文件以错误编码保存（如GBK保存为UTF-8读取）

**解决**：强制使用UTF-8读取，检测乱码后提示用户

### 问题 2：日语误判为双语

**现象**：纯日语歌词被识别为双语模式

**原因**：检测逻辑仅检查TME版权声明，日语文件无此声明

**解决**：v2.8.10需求，限制仅TME版权声明时启用双语模式

### 问题 3：创作信息消失

**现象**：开头创作艺术家信息未显示

**原因**：被过滤为元数据

**解决**：v2.8.10需求，改用UI呈现而非直接清除

---

## 🚀 实施建议

### 阶段 1：格式识别优化（v2.8.10）

1. 严格限制双语模式触发条件（仅TME版权声明）
2. 排除日语文件误判
3. 保留元数据但改用非歌词区域显示

### 阶段 2：解析算法重构（v2.9.0）

1. 实施逐行配对算法
2. 增加翻译质量评分（置信度）
3. 支持手动切换双语/单语模式

### 阶段 3：用户体验（v2.9.x）

1. 译文显示样式优化（字号、透明度）
2. 支持译文显示/隐藏切换
3. 支持译文位置调整（上方/下方）

---

## 📝 附录：测试用例

### 测试文件清单

| 文件路径 | 语言对 | 特色 |
|---------|--------|------|
| `LEMONADE - aespa&Becky G.lrc` | 英→中 | 标准双语 |
| `Tiny Giant 小巨星 - ....lrc` | 英→中 | 游戏歌曲 |
| `隙 - ゆーり.lrc` | 日→中 | 日语配对 |
| `Giant - 宋雨琦.lrc` | 中→中 | 乱码版权行 |
| `Never Be Far - Carsen.lrc` | 英→中 | 文曲大模型翻译 |
| `アクト - Giga.lrc` | 日→中 | 日语原文 |

### 验证要点

- [ ] 同时间戳配对正确识别
- [ ] 元数据行正确过滤
- [ ] 空行处理不报错
- [ ] 日语文件不误判为双语
- [ ] 乱码版权行不崩溃
- [ ] 译文配对方向正确（原文→译文）

---

**文档版本**：v1.0  
**创建时间**：2026-06-03  
**适用版本**：MBolka Player v2.8.10+  
**文件位置**：`Q:\数据\Web\code\muse\prompt-by-qclaw\TME双语LRC编码格式分析.md`
