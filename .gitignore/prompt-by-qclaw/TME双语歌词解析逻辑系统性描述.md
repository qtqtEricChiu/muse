# TME 双语歌词解析逻辑 - 系统性描述

## 📋 文档概述

本文档详尽、书面化地描述TME双语歌词的解析逻辑，基于提出的每一条细节规则进行系统性阐述。适用于MBolka Player v2.8.10+版本的双语歌词解析算法设计。

**文档版本**：v1.0  
**创建时间**：2026-06-03 20:55 GMT+8  
**适用版本**：MBolka Player v2.8.10+  
**文件位置**：`Q:\数据\Web\code\muse\prompt-by-qclaw\TME双语歌词解析逻辑系统性描述.md`

---

## 🎯 核心解析原则

### 原则1：时间戳配对判定法

TME双语歌词的核心判定依据是**时间戳配对机制**。当两行歌词拥有**完全相同的时间戳**时，可判定该歌词文件为双语歌词格式。

**判定公式**：
```
IF (timestamp_line_N == timestamp_line_N+1) THEN
    判定为双语歌词格式
ELSE
    判定为单语歌词格式
END IF
```

### 原则2：双语歌词行顺序规则

对于两行时间戳完全一致的歌词对：

1. **第一行**：是**上一行歌词的翻译**
2. **第二行**：是**本行歌词的原文**

**示例**：
```
[00:08.54]I go in                    ← 上一行歌词的翻译（中文）
[00:08.54]我全情                      ← 本行歌词的原文（中文）
[00:09.84]all the way                ← 上一行歌词的翻译（中文）
[00:09.84]投入其中                    ← 本行歌词的原文（中文）
```

**注意**：此规则适用于标准TME双语LRC格式（模式1）。对于并发显示模式（模式4），需使用不同的解析逻辑。

---

## 📐 详细解析规则系统性描述

### 规则1：双语歌词基础判定规则

**规则描述**：  
如果有两行时间戳完全一致的歌词，可以判断该歌词为双语歌词。

**书面化描述**：  
在LRC歌词文件解析过程中，算法应首先检测文件中是否存在**连续两行具有相同时间戳**的情况。若存在此类时间戳配对，则触发双语歌词解析模式。

**检测算法**：
```javascript
function detectBilingualLyrics(lines) {
    for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].timestamp === lines[i + 1].timestamp) {
            return true; // 检测到双语歌词特征
        }
    }
    return false; // 未检测到双语歌词特征
}
```

**边界条件**：
- 仅检测**连续两行**的时间戳一致性
- 不要求文件中所有行都是双语配对
- 只要存在至少一对时间戳一致的行即可判定

---

### 规则2：双语配对行的语序逻辑规则

**规则描述**：  
对于两行时间戳完全一致的歌词，第一行是上一行歌词的翻译，第二行是本行歌词的原文。

**书面化描述**：  
在标准TME双语LRC格式中，当检测到时间戳配对的歌词行时，配对行的语序遵循以下逻辑：

1. **配对第一行**（较早出现的行）：包含**上一句歌词的翻译文本**
2. **配对第二行**（较晚出现的行）：包含**当前句子的原文文本**

**示例分析**：
```
上一句原文: "I go in" (位于文件前处)
当前句原文: "我全情" (当前处理位置)

配对行:
[00:08.54]I go in          ← 上一句原文 (英语)
[00:08.54]我全情            ← 当前句原文 (中文) + 上一句翻译
```

**注意**：此描述基于用户提供的规则。实际TME格式中，通常是原文在前、翻译在后。需根据实际文件验证此规则。

**解析算法**：
```javascript
function parseBilingualPair(line1, line2, previousLine) {
    return {
        original: line2.text,           // 第二行：本行原文
        translation: line1.text,        // 第一行：上一行翻译
        time: line1.timestamp,         // 共享时间戳
        isBilingual: true
    };
}
```

---

### 规则3：独立时间戳歌词行处理规则

**规则描述**：  
如果在双语歌词里遇到了有且只有不与其它行重复的独立时间戳歌词行，则判断该歌词行属于原文歌词，按无翻译歌词&单行单语歌曲逻辑进行单行处理。

**书面化描述**：  
在已判定为双语格式的歌词文件中，若某行歌词具有**唯一的时间戳**（该时间戳在文件中只出现一次），则将该行判定为**原文歌词行**，并按照单语歌曲的逻辑进行单行处理。

**检测条件**：
```
IF (isBilingualFile == true) AND (timestamp_count(timestamp) == 1) THEN
    判定为原文歌词行
    按单语歌曲逻辑处理
END IF
```

**示例**：
```
[00:15.26]这是一句独立的歌词   ← 时间戳00:15.26只出现一次
```

**处理策略**：
- 不寻找翻译配对
- 作为独立的歌词行显示
- 不应用双语样式（如翻译行缩进、颜色区分等）

**解析算法**：
```javascript
function handleIndependentTimestampLine(line, allLines) {
    const timestampCount = allLines.filter(l => l.timestamp === line.timestamp).length;
    
    if (timestampCount === 1) {
        return {
            original: line.text,
            translation: '',
            isBilingual: false,    // 按单语处理
            isIndependent: true     // 标记独立时间戳
        };
    }
    
    // 否则按正常双语逻辑处理
    return parseBilingualPair(...);
}
```

---

### 规则4：空翻译行处理规则

**规则描述**：  
如果在双语歌词（包括词曲信息）遇到了两行时间戳完全一致，但第一行（即上一句翻译行）空置无内容或者空格，则判断上一行歌词为无翻译歌词行，按单语歌曲逻辑进行单行处理，对于词曲信息翻译行空置同样按此规则处理。

**书面化描述**：  
在双语歌词解析过程中，若检测到时间戳配对的两行中，**第一行（翻译行）为空或仅包含空格**，则判定**上一行歌词无翻译**，并按照单语歌曲逻辑进行单行处理。此规则同样适用于元数据区域（如词曲信息）的翻译行空置情况。

**检测条件**：
```
IF (isBilingualFile == true) AND 
   (timestamp_line_N == timestamp_line_N+1) AND
   (line_N.text.trim() === '') THEN
    判定为无翻译歌词行
    按单语歌曲逻辑处理
END IF
```

**示例**：
```
[00:03.80]                    ← 翻译行空置（词信息翻译）
[00:03.80]词：Author Name     ← 原文行有内容
```

**处理策略**：
- 将配对行视为单行歌词
- 显示原文行内容
- 不显示翻译（因为翻译行为空）

**解析算法**：
```javascript
function handleEmptyTranslationPair(line1, line2) {
    if (line1.timestamp === line2.timestamp) {
        if (line1.text.trim() === '') {
            // 翻译行为空，按单语处理
            return {
                original: line2.text,
                translation: '',
                isBilingual: false,
                hasEmptyTranslation: true
            };
        }
    }
    
    // 否则按正常双语配对处理
    return parseBilingualPair(line1, line2, ...);
}
```

---

### 规则5：版权声明优先判定规则

**规则描述**：  
如果歌词内明确标注【TME享有本翻译作品的著作权】、【腾讯享有本翻译作品的著作权】、【以下歌词翻译由文曲大模型提供】、【TME浜湁鏈炕璇戜綔鍝佺殑钁椾綔鏉?（编码问题需要转换）】，则该歌词优先按照双语歌词处理，至于其中的无翻译歌词行另行按单行歌词处理。

**书面化描述**：  
若歌词文件头部包含特定的**版权声明标记**，则无论文件中是否存在时间戳配对，均**优先判定为双语歌词格式**。对于文件中存在的无翻译歌词行，另行按照单行歌词逻辑处理。

**版权声明标记集**：
1. `TME享有本翻译作品的著作权`
2. `腾讯享有本翻译作品的著作权`
3. `以下歌词翻译由文曲大模型提供`
4. `TME浜湁鏈炕璇戜綔鍝佺殑钁椾綔鏉?`（GBK编码乱码版本）

**检测优先级**：
```
IF (containsCopyrightMark(line.text) == true) THEN
    强制判定为双语歌词格式
    按双语逻辑解析整个文件
END IF
```

**编码问题处理**：  
对于乱码版本的版权声明（如标记4），需要进行编码转换（GBK→UTF-8）后再进行匹配。

**解析算法**：
```javascript
const COPYRIGHT_MARKS = [
    'TME享有本翻译作品的著作权',
    '腾讯享有本翻译作品的著作权',
    '以下歌词翻译由文曲大模型提供',
    // 乱码版本需进行编码转换后匹配
];

function containsCopyrightMark(text) {
    // 正常匹配
    for (const mark of COPYRIGHT_MARKS) {
        if (text.includes(mark)) return true;
    }
    
    // 乱码版本匹配（需编码转换）
    const gbkBuffer = Buffer.from(text, 'utf8');
    const gbkText = gbkBuffer.toString('gbk');
    const expectedGbk = 'TME享有本翻译作品的著作权';
    if (gbkText.includes(expectedGbk)) return true;
    
    return false;
}

function detectBilingualFormatWithPriority(lines) {
    // 优先检查版权声明
    for (const line of lines) {
        if (containsCopyrightMark(line.text)) {
            return true; // 强制判定为双语
        }
    }
    
    // 其次检查时间戳配对
    return detectBilingualLyrics(lines);
}
```

---

### 规则6：有意空置行处理规则

**规则描述**：  
如果歌词行空置无实际内容，查看其时间戳，如果时间戳独立、有且只有且不与其它行重复，那么判断为为了美化有意空置，正常以单语歌词采用空置一行外显。

**书面化描述**：  
在歌词解析过程中，若遇到**空行**（无实际文本内容），首先检查其时间戳属性。若该空行具有**独立且唯一的时间戳**（即该时间戳在文件中只出现一次），则判定该空行为**有意空置**（为了视觉美化效果），并按照单语歌词的空行逻辑进行显示。

**检测条件**：
```
IF (line.text.trim() === '') AND 
   (timestamp_count(timestamp) == 1) THEN
    判定为有意空置行
    按单语歌词空行处理（显示空行）
END IF
```

**示例**：
```
[00:07.05]                   ← 空行，时间戳00:07.05只出现一次
                              ← 显示为空行（美化效果）
```

**与规则4的区别**：
- **规则4**：时间戳配对中的翻译行为空 → 判定为无翻译
- **规则6**：独立时间戳的空行 → 判定为有意空置，显示空行

**解析算法**：
```javascript
function handleEmptyLine(line, allLines) {
    if (line.text.trim() === '') {
        const timestampCount = allLines.filter(l => l.timestamp === line.timestamp).length;
        
        if (timestampCount === 1) {
            // 独立时间戳空行 → 有意空置
            return {
                original: '',
                translation: '',
                isEmpty: true,
                isIntentional: true,    // 标记有意空置
                displayAsEmptyLine: true // 显示空行
            };
        } else {
            // 时间戳配对中的空行 → 可能是无翻译（规则4）
            // 需结合下一行判断
        }
    }
    
    // 非空中，正常处理
    return parseLine(line, ...);
}
```

---

### 规则7：日语歌词罗马音标注规则

**规则描述**：  
对于日语歌曲歌词文件中标记有[kana:]信息戳，允许将日语歌词罗马音标注代码解析并呈现给用户。

**书面化描述**：  
若日语歌曲的LRC歌词文件中包含`[kana:]`标记（罗马音标注信息），解析算法应识别并提取该信息，将其呈现给用户作为歌词显示的辅助信息。

**标记格式**：
```
[kana:1行目のローマ字表記1行目のローマ字表記1行目のローマ字表記...]
```

**示例**：
```
[00:25.61][kana:sa ki su u tsu ku shi i]
[00:25.61]幸せうつくしい
```

**解析策略**：
1. 识别`[kana:...]`标记
2. 提取罗马音标注文本
3. 将罗马音与对应歌词行关联
4. 在UI中提供显示/隐藏罗马音的选项

**解析算法**：
```javascript
function parseKanaAnnotation(lineText) {
    const kanaMatch = lineText.match(/\[kana:(.*?)\]/);
    if (kanaMatch) {
        return {
            hasKana: true,
            kanaText: kanaMatch[1],
            lyricText: lineText.replace(/\[kana:.*?\]/, '').trim()
        };
    }
    return null;
}
```

---

### 规则8：艺术家信息呈现规则

**规则描述**：  
对于本次更新出现了开头创作艺术家词曲信息消失的问题，其实如果识别出艺术家可以更换一下呈现方式（UI焕新）而不是直接清除。

**书面化描述**：  
在歌词文件开头部分，通常包含**创作艺术家信息**（如词、曲、编曲、制作人、演唱等信息）。解析算法应识别这些信息，并通过**UI焕新**的方式呈现给用户，而非直接清除或忽略。

**信息类型**：
1. 词（作词）
2. 曲（作曲）
3. 编曲
4. 制作人
5. 演唱（歌手）
6. 混音
7. 母带

**识别模式**：
```javascript
const METADATA_PATTERNS = [
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
```

**UI呈现策略**：
1. **非歌词区域显示**：在歌词视口上方或下方单独区域显示
2. **折叠/展开**：默认折叠，点击展开显示详细信息
3. **样式区分**：使用较小字号、较低对比度，与歌词正文区分
4. **滚动跟随**：在歌曲播放过程中，保持固定位置不随歌词滚动

**解析算法**：
```javascript
function parseMetadataLines(lines) {
    const metadataLines = [];
    
    for (const line of lines) {
        if (isMetadataLine(line.text)) {
            metadataLines.push({
                type: identifyMetadataType(line.text),
                content: line.text,
                timestamp: line.timestamp
            });
        }
    }
    
    return metadataLines;
}

function isMetadataLine(text) {
    return METADATA_PATTERNS.some(pattern => pattern.test(text));
}
```

---

### 规则9：文件末尾歌词行特殊配对规则

**规则描述**：  
如果一个判断含双语歌词的双语歌曲歌词文件倒数第二歌词行（应为原文行）和倒数第三歌词行（应为上一句歌词的翻译行）为同一个完全一致的时间戳，那么认定【倒数第一歌词行】应为【倒数第二歌词行（原文行）】的歌词翻译行。

**书面化描述**：  
在已判定为双语格式的歌词文件末尾，若存在特殊的**时间戳配对模式**，则需按照特定逻辑进行解析。具体为：若倒数第二行（应为原文行）与倒数第三行（应为上一句翻译行）具有相同时间戳，则判定**倒数第一行**是**倒数第二行（原文行）**的翻译。

**检测条件**：
```
IF (isBilingualFile == true) AND
   (timestamp_line_N-2 == timestamp_line_N-1) THEN
    判定倒数第一行是倒数第二行的翻译
    进行特殊配对解析
END IF
```

其中 N 为文件总行数，行索引从1开始。

**示例**：
```
...（文件末尾）
[03:20.44]Stand up like a giant    ← 倒数第三行（上一句翻译行）
[03:20.44]如巨人般站起来           ← 倒数第二行（原文行）
[03:25.04]当我孤军奋战时 请你不要怀疑我  ← 倒数第一行（翻译行）
```

**注意**：根据此示例，倒数第一行的时间戳（03:25.04）与倒数第二行（03:20.44）**不相同**。这可能意味着规则9的描述与实际示例不符，或需要更多上下文理解。

**特殊配对解析算法**：
```javascript
function handleEndOfFileSpecialPairing(lines) {
    const lineCount = lines.length;
    
    if (lineCount >= 3) {
        const lineN2 = lines[lineCount - 2]; // 倒数第二行
        const lineN1 = lines[lineCount - 1]; // 倒数第一行
        const lineN3 = lines[lineCount - 3]; // 倒数第三行
        
        if (lineN2.timestamp === lineN3.timestamp) {
            // 特殊配对：倒数第一行是倒数第二行的翻译
            return {
                original: lineN2.text,
                translation: lineN1.text,
                time: lineN2.timestamp,
                isSpecialEnding: true
            };
        }
    }
    
    // 否则按正常逻辑处理
    return parseNormalPairing(...);
}
```

---

## 🏷️ 解析算法整体流程

基于上述9条规则，TME双语歌词解析的整体算法流程如下：

```
开始解析LRC文件
    ↓
步骤1：读取文件头部，检查版权声明标记（规则5）
    ↓
IF (包含版权标记) THEN
    强制设定为双语模式
ELSE
    检测时间戳配对（规则1）
    ↓
    IF (存在时间戳配对) THEN
        设定为双语模式
    ELSE
        设定为单语模式
    END IF
END IF
    ↓
步骤2：按行解析歌词
    ↓
FOR EACH line IN lines DO
    ↓
    IF (当前为双语模式) THEN
        ↓
        检查是否为独立时间戳行（规则3）
        ↓
        IF (是独立时间戳) THEN
            按单语逻辑处理（规则3）
        ELSE
            检查是否为时间戳配对行
            ↓
            IF (是时间戳配对) THEN
                检查翻译行是否为空（规则4）
                ↓
                IF (翻译行为空) THEN
                    按单语逻辑处理（规则4）
                ELSE
                    按双语配对解析（规则2）
                END IF
            ELSE
                按单语逻辑处理
            END IF
        END IF
     ELSE
        按单语模式解析
     END IF
    ↓
    检查是否为空行（规则6）
    ↓
    IF (是空行 AND 时间戳独立) THEN
        标记为有意为美化的空行（规则6）
    END IF
    ↓
    检查是否包含[kana:]标记（规则7）
    ↓
    IF (包含[kana:]标记) THEN
        解析罗马音标注（规则7）
    END IF
    ↓
    检查是否为艺术家信息（规则8）
    ↓
    IF (是艺术家信息) THEN
        提取并按UI焕新呈现（规则8）
    END IF
END FOR
    ↓
步骤3：处理文件末尾特殊配对（规则9）
    ↓
IF (双语模式 AND 文件末尾有特定时间戳模式) THEN
    应用特殊配对逻辑（规则9）
END IF
    ↓
步骤4：输出解析结果
    ↓
返回结构化歌词数据（包含原文、翻译、元数据、罗马音等）
    ↓
结束
```

---

## 📊 解析结果数据结构

基于上述规则解析后，输出的歌词数据结构应包含以下字段：

```javascript
const parsedLyrics = [
    {
        // 基础字段
        time: '00:08.54',           // 时间戳
        original: '我全情',          // 原文
        translation: 'I go in',      // 翻译
        isBilingual: true,          // 是否为双语行
        
        // 规则3：独立时间戳
        isIndependent: false,        // 是否为独立时间戳行
        
        // 规则4：空翻译
        hasEmptyTranslation: false,   // 翻译行为空
        
        // 规则6：有意空置
        isEmpty: false,              // 是否为空行
        isIntentionalEmpty: false,   // 是否为有意空置
        
        // 规则7：罗马音
        hasKana: false,              // 是否有罗马音标注
        kanaText: '',               // 罗马音文本
        
        // 规则8：艺术家信息
        isMetadata: false,           // 是否为元数据
        metadataType: '',            // 元数据类型（词/曲/编曲等）
        
        // 规则9：末尾特殊配对
        isSpecialEnding: false      // 是否为末尾特殊配对
    },
    // ... 更多歌词行
];
```

---

## 🔬 边界情况与异常处理

### 边界情况1：混合格式文件

**现象**：文件中同时存在标准TME格式（模式1）和并发显示模式（模式4）。

**处理策略**：
1. 优先按标准TME格式解析
2. 若解析失败，尝试并发显示模式解析
3. 若两种都失败，按单语模式解析

### 边界情况2：乱码版权声明

**现象**：版权声明因编码问题显示为乱码。

**处理策略**：
1. 尝试UTF-8解码
2. 若失败，尝试GBK解码
3. 对解码后的文本进行版权标记匹配

### 边界情况3：不完整的配对

**现象**：时间戳配对中缺少翻译行或原文行。

**处理策略**：
1. 若缺少翻译行 → 按单语处理
2. 若缺少原文行 → 忽略该配对
3. 记录警告日志供调试

### 边界情况4：多个版权声明

**现象**：文件包含多个版权声明标记。

**处理策略**：
1. 只要检测到任意一个版权声明即判定为双语
2. 记录所有检测到的版权声明类型

---

## 📝 实施建议

### 阶段1：基础解析实现（v2.8.10）

1. 实施规则1（基础判定）和规则2（语序逻辑）
2. 实施规则5（版权声明优先判定）
3. 基础双语歌词显示功能

### 阶段2：高级解析功能（v2.9.0）

1. 实施规则3（独立时间戳行）
2. 实施规则4（空翻译行）
3. 实施规则6（有意空置行）
4. 实施规则7（罗马音标注）

### 阶段3：UI呈现优化（v2.9.x）

1. 实施规则8（艺术家信息呈现）
2. 实施规则9（末尾特殊配对）
3. UI焕新：元数据区域、罗马音显示、空行美化

---

## 📚 附录：示例文件分析

### 示例1：`Never Be Far - Carsen.lrc`

**文件特征**：
- 包含版权声明：`[00:07.67]以下歌词翻译由文曲大模型提供`
- 标准TME双语格式（模式1）
- 时间戳配对正确

**解析结果**：
```
[00:07.67]Lost you for a minute        ← 原文
[00:09.14]曾短暂失去你                  ← 翻译
[00:09.14]But you're back now          ← 原文
[00:11.52]但此刻你已归来              ← 翻译
```

### 示例2：`隙 - ゆーり.lrc`

**文件特征**：
- 日语歌曲
- 包含罗马音标注（`[kana:]`标记）
- 标准TME双语格式

**解析重点**：
- 需解析`[kana:]`标记
- 日语→中文翻译配对

### 示例3：`Giant - 宋雨琦 (YUQI).lrc`

**文件特征**：
- 并发显示模式（模式4）
- 翻译与下一句歌词共享时间戳
- 需使用特殊解析逻辑

---

## ✅ 验证清单

实施本解析逻辑后，需进行以下验证：

- [ ] 规则1：时间戳配对正确检测
- [ ] 规则2：双语配对行语序正确解析
- [ ] 规则3：独立时间戳行按单语处理
- [ ] 规则4：空翻译行正确处理
- [ ] 规则5：版权声明优先判定
- [ ] 规则6：有意空置行正确显示
- [ ] 规则7：罗马音标注正确解析
- [ ] 规则8：艺术家信息UI焕新呈现
- [ ] 规则9：末尾特殊配对正确解析
- [ ] 边界情况处理正确
- [ ] 编码问题正确处理
- [ ] 混合格式文件正确解析

---

**文档结束**  

**作者**：QClaw AI Agent  
**创建时间**：2026-06-03 20:55 GMT+8  
**文档版本**：v1.0  
**文件大小**：约15KB（预计）  
**适用项目**：MBolka Player v2.8.10+  
**文件位置**：`Q:\数据\Web\code\muse\prompt-by-qclaw\TME双语歌词解析逻辑系统性描述.md`