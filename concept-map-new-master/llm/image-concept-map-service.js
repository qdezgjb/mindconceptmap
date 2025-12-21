// 图像概念图生成服务模块
// 负责从用户上传的图片中提取焦点问题和三元组，以生成概念图

/**
 * 图像概念图生成服务
 * - 构建多模态提示，指导AI分析图像、提取焦点问题和三元组
 * - 调用后端API，处理从图像到概念图数据的完整流程
 */
class ImageConceptMapService {
    /**
     * 构造函数
     * @param {string} apiBaseUrl - API基础URL
     */
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        console.log("ImageConceptMapService initialized with base URL:", apiBaseUrl);
    }

    /**
     * 从图像生成概念图所需的数据（焦点问题和三元组）
     * @param {string} imageData - Base64编码的图像数据
     * @param {Function} onChunk - 处理流式响应的回调
     * @param {Function} onComplete - 完成时的回调
     * @param {Function} onError - 出错时的回调
     */
    async generate(imageData, onChunk, onComplete, onError) {
        try {
            console.log("🖼️ 开始从图像生成概念图数据...");
            const prompt = this.buildPrompt();

            // 调用新的流式API端点
            const response = await fetch(`${this.apiBaseUrl}/analyze-concept-map/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({
                    image_data: imageData.split(',')[1], // 移除 'data:image/...;base64,' 前缀
                    prompt: prompt,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
            }

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const {
                    done,
                    value
                } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, {
                    stream: true
                });
                const parts = buffer.split('\n\n');
                buffer = parts.pop();

                for (const part of parts) {
                    if (part.startsWith('data: ')) {
                        const chunk = part.substring(6);
                        if (chunk !== '[DONE]') {
                            try {
                                const parsed = JSON.parse(chunk);
                                if (parsed.done) {
                                    // 流结束标记，检查是否有错误
                                    if (parsed.error) {
                                        console.error('❌ 收到错误响应:', parsed.error);
                                        onError({
                                            message: parsed.error
                                        });
                                        return; // 提前返回，不再处理后续数据
                                    }
                                } else if (parsed.error) {
                                    // 处理错误响应
                                    console.error('❌ 收到错误响应:', parsed.error);
                                    onError({
                                        message: parsed.error
                                    });
                                    return; // 提前返回，不再处理后续数据
                                } else if (parsed.content) {
                                    fullResponse += parsed.content;
                                    onChunk(parsed.content);
                                }
                            } catch (e) {
                                console.warn('Could not parse stream chunk:', chunk, e);
                            }
                        }
                    }
                }
            }
             // Handle any remaining data in the buffer
             if (buffer.startsWith('data: ')) {
                const chunk = buffer.substring(6);
                if (chunk && chunk !== '[DONE]') {
                    try {
                        const parsed = JSON.parse(chunk);
                        if (parsed.done) {
                            // 检查结束标记中是否有错误
                            if (parsed.error) {
                                console.error('❌ 收到错误响应:', parsed.error);
                                onError({
                                    message: parsed.error
                                });
                                return; // 提前返回
                            }
                        } else if (parsed.error) {
                            // 处理错误响应
                            console.error('❌ 收到错误响应:', parsed.error);
                            onError({
                                message: parsed.error
                            });
                            return; // 提前返回
                        } else if (parsed.content) {
                            fullResponse += parsed.content;
                            onChunk(parsed.content);
                        }
                    } catch (e) {
                        console.warn('Could not parse final buffer chunk:', chunk, e);
                    }
                }
            }

            console.log("✅ 流式响应接收完成，AI原始返回:", fullResponse);
            this.parseFinalResponse(fullResponse, onComplete, onError);

        } catch (error) {
            console.error('❌ 从图像生成概念图失败:', error);
            onError({
                message: `请求失败: ${error.message}`
            });
        }
    }
    
    /**
     * 解析最终的AI响应
     * @param {string} responseText - 完整的AI响应文本
     * @param {Function} onComplete - 成功回调
     * @param {Function} onError - 失败回调
     */
    parseFinalResponse(responseText, onComplete, onError) {
        try {
            const startIdx = responseText.indexOf('{');
            const endIdx = responseText.lastIndexOf('}') + 1;

            if (startIdx === -1 || endIdx === 0) {
                throw new Error('响应中未找到有效的JSON对象。');
            }

            const jsonContent = responseText.substring(startIdx, endIdx);
            const result = JSON.parse(jsonContent);

            if (result.focusQuestion && Array.isArray(result.triples)) {
                console.log("✅ 成功解析AI响应:", result);
                onComplete({
                    success: true,
                    focusQuestion: result.focusQuestion,
                    triples: result.triples.map(t => ({
                        source: t[0],
                        relation: t[1],
                        target: t[2],
                        layer: t[3]
                    })), // 转换为对象数组
                    rawResponse: responseText
                });
            } else {
                throw new Error('解析后的JSON结构无效，缺少 "focusQuestion" 或 "triples" 字段。');
            }
        } catch (error) {
            console.error('❌ 解析最终AI响应失败:', error);
            onError({
                message: `AI返回的数据格式不正确，无法解析: ${error.message}`,
                rawResponse: responseText
            });
        }
    }


    /**
     * 构建用于图像分析和概念图数据提取的提示
     * @returns {string} - 构建好的提示字符串
     */
    buildPrompt() {
        return `# 焦点问题驱动的图像概念图任务

你是一位多模态知识工程师。请先识别图像文字，再围绕焦点问题组织概念图。

## 目标说明
- 读取并理解图像场景与文字
- 提炼唯一的焦点问题
- 基于文字内容抽取分层三元组
- 以结构化JSON输出全部结果

## 执行流程
### 1. 焦点问题
- 依据图像核心信息形成1个问题或短句
- 直接输出文本，无引号与前缀
- 不超过20个汉字，能成为概念图中心

### 2. 文字识别
- 完整列出图像中的可读文字
- 仅使用识别出的文字作为后续依据

### 3. 三元组生成
- 先阅读上一步的文字，再根据以下规则抽取：
${this.getTripleExtractionPromptSection()}

### 4. 输出格式
仅返回一个合法JSON对象：
\`\`\`json
{
  "focusQuestion": "唯一的焦点问题",
  "triples": [
    ["概念1", "关系", "概念2", "L1-L2"],
    ["概念A", "关系", "概念B", "L2-L3"]
  ]
}
\`\`\`

## 结果限制
- \`focusQuestion\` 必须存在
- \`triples\` 为长度在15-25之间的数组；若无可用文字则返回 \`[]\`
- 严禁在JSON前后输出任何额外说明

请遵循以上格式完成分析。`;
    }

    /**
     * 获取三元组提取的详细提示规则
     * (此部分规则改编自 llm-manager.js, 确保AI遵循严格的层级和数量限制)
     * @returns {string}
     */
    getTripleExtractionPromptSection() {
        return `### 任务
请首先识别图像中的所有文字，然后根据这些文字内容，提取分层的概念关系三元组。

### 核心规则 (必须严格遵守)
- **🔴🔴🔴 最重要：严格按图像文字提取，禁止自行生成新内容**
  - **所有概念和关系词必须完全来源于图像中识别出的文字**
  - **绝对禁止自行创造、补充或生成图像中不存在的概念、节点或关系**
  - **如果图像文字中没有足够的内容，只能提取图像中实际存在的部分，不能自行添加**
  - **所有三元组中的概念词必须能在图像文字中找到对应的表述或直接引用**
- **为每个概念添加层级标记** (L1, L2, L3, L4, L5等，根据内容自然确定层数)。
- **只能从高层向低层提取三元组** (L1→L2, L2→L3, L3→L4, L4→L5等)，单向流动，必须相邻层。
- **严格禁止反向、跨层、同层提取**。
- **内容必须完全来源于图像中的文字**。
- **⭐ 层数确定：根据图像内容的复杂度和层次结构自然确定层数，可以是3层、4层、5层或更多，不限制在4层**

### 层级结构说明 (可根据内容扩展)
- **L1层**: 核心主题概念（通常1个节点）
- **L2层**: 主要分类或维度
- **L3层**: 具体分类或子维度
- **L4层**: 具体细节或实例
- **L5、L6等层**: 根据内容需要，可以继续细分（如需要更详细的层次结构）
- **节点数量**: 根据图像内容自然确定，不设限制
- **总三元组数**: 15-25个（建议范围）。

### 层级连接要求 (最关键)
- **相邻层之间必须有足够的三元组**（如L1→L2至少4个，L2→L3至少6个，L3→L4至少6个，L4→L5至少6个等）。
- 这些三元组必须覆盖不同的源节点和目标节点，确保层次间的充分连接。
- **🚫🚫🚫 绝对禁止孤立节点：每个节点都必须至少有一条连接线（要么作为源节点，要么作为目标节点，或者两者都是）**
- **如果某个节点没有任何连接线，必须删除该节点或为其添加连接**

### 概念和关系词要求
- **🔴🔴🔴 最重要：严格按图像文字提取概念**
  - **所有概念词必须完全来源于图像中识别出的文字，不能自行创造、补充或生成**
  - **概念词可以是图像文字中的直接引用，也可以是图像文字中明确提到或隐含的概念**
  - **如果图像文字中没有某个概念，绝对不能自行添加或创造**
- **🔴🔴🔴 节点文字长度限制（关键要求）：**
  - **每个节点的文字长度必须不超过12个字（包括标点符号）**
  - **必须对图像文字内容进行浓缩提取，提取最核心、最简洁的概念表述**
  - **如果图像文字中的概念表述超过12个字，必须进行浓缩和精简，保留核心含义**
  - **浓缩原则：**
    - 去除冗余的修饰词、助词、连词等
    - 保留核心概念和关键信息
    - 使用最简洁、最准确的表述
    - 确保浓缩后的概念仍然准确反映原意
  - **示例：**
    - ❌ 错误（超过12字）："资产阶级民主革命的主要特点"
    - ✅ 正确（浓缩后）："资产阶级民主革命特点"（11字）
    - ❌ 错误（超过12字）："推翻清朝封建专制统治建立共和制度"
    - ✅ 正确（浓缩后）："推翻清朝建立共和"（8字）
- **概念词浓缩提取方法：**
  - **识别核心概念**：从图像文字中识别出最核心的概念词
  - **去除冗余信息**：删除不必要的修饰词、解释性文字
  - **保留关键信息**：确保浓缩后的概念仍然准确表达原意
  - **统一表述**：如果图像文字中有多种表述方式，选择最简洁、最准确的表述
- **🔴🔴🔴 关键要求：同一个概念在整个三元组列表中必须始终使用相同的层级标记！**
  - 例如：如果"革命党人"在第一个三元组中被标记为L2，那么在所有后续三元组中，它也必须始终是L2，绝对不能变成L3或其他层级
  - 如果同一个概念在不同三元组中被标记为不同层级，会导致层级冲突错误
- **🔴🔴🔴 相似内容识别与合并（关键要求）：**
  - **在提取三元组之前，必须仔细识别图像文字中相似、重复或表达同一概念的内容**
  - **将相似内容合并为一个节点，使用统一的表述方式**
  - **禁止将相似内容创建为两个不同的节点**
  - **相似内容识别规则：**
    - 如果图像中出现"历史背景"、"从历史背景看"、"历史背景方向"等相似表述，应统一为一个节点（如"历史背景"）
    - 如果图像中出现"核心内容"、"在核心内容上"、"核心内容方向"等相似表述，应统一为一个节点（如"核心内容"）
    - 如果图像中出现"革命对象"、"就革命对象而言"、"革命对象方向"等相似表述，应统一为一个节点（如"革命对象"）
    - 如果图像中出现"实践影响"、"其实践影响"、"实践影响方向"等相似表述，应统一为一个节点（如"实践影响"）
    - 如果图像中出现其他相似或重复的概念表述，也应统一为一个节点
  - **合并原则：**
    - 选择最简洁、最准确的表述作为统一节点名称
    - 如果图像中多次提到同一概念但表述略有不同，应识别为同一概念并统一表述
    - 避免因为表述的细微差异而创建重复节点
  - **检查步骤：**
    - 在输出三元组之前，检查是否有相似或重复的概念
    - 如果有相似概念，将它们合并为一个节点
    - 确保所有指向相似概念的关系都指向合并后的统一节点
- **⭐ 关系词要求（关键：必须准确反映两个节点之间的具体关系）**：
  - **关系词要简洁（2-4字）**，不含助词（如"的"、"了"等），但能让"概念1 + 关系词 + 概念2"连读成通顺且语义准确的话
  - **核心原则**：根据两个节点的具体内容，选择最能准确描述它们之间关系的关系词，避免使用过于通用的词汇
  - **关系词类型**（根据节点内容灵活选择）：
    - 包含/组成关系：包括、包含、涵盖、构成、组成、分为
    - 因果关系：导致、引发、造成、产生、引起、促使、推动、促进、促成、带来
    - 时间/顺序关系：先于、后于、始于、终于、经过、经历、进入、发展到
    - 功能/用途关系：用于、应用于、服务于、实现、支持、提供、满足、解决
    - 依赖/基础关系：需要、基于、依赖、借助、通过、依靠、建立在、来源于
    - 属性/特征关系：具有、表现为、特征是、特点是、体现在、显示为
    - 影响/作用关系：影响、作用于、改变、改善、提升、降低、增强、削弱
    - 归属/分类关系：属于、归类为、划分为、分类为、归入
    - 对比/区别关系：区别于、不同于、相对于、对比于、相比
    - 转化/演变关系：转化为、演变为、发展成为、转变为、变成
    - 条件/前提关系：需要、要求、前提是、条件是、必须、依赖于
    - 结果/后果关系：结果是、后果是、产生、形成、造成、带来
  - **选择原则**：
    1. 语义准确性优先：关系词必须准确反映两个节点之间的实际关系
    2. 上下文相关：根据两个节点的具体内容，选择最能体现它们之间关系的关系词
    3. 避免通用词汇：尽量避免使用"是"、"有"、"包括"等过于通用的词汇，除非它们确实是最准确的表达
    4. 语义丰富性：优先选择语义更丰富、更具体的关系词
  - **禁止使用**：单字关系词如"是"、"有"、"为"（除非确实是最准确的表达）；包含助词的关系词如"的背景是"、"导致了"

### 输出格式
每个三元组是一个包含四个元素的数组: \`["头实体", "关系", "尾实体", "层级关系"]\`
例如: \`["辛亥革命", "旨在", "推翻清朝", "L1-L2"]\``;
    }
}

// 导出服务类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageConceptMapService;
} else if (typeof window !== 'undefined') {
    window.ImageConceptMapService = ImageConceptMapService;
}

