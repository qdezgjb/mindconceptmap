// 介绍文本生成服务模块
// 处理AI流式生成焦点问题的介绍文本

/**
 * 介绍文本生成服务
 * 负责调用DeepSeek API生成简洁的知识介绍文本
 */
class IntroductionTextService {
    /**
     * 构造函数
     * @param {string} apiBaseUrl - API基础URL
     */
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
    }
    
    /**
     * 流式生成介绍文本
     * @param {string} keyword - 关键词（焦点问题）
     * @param {Function} onChunk - 接收文本片段的回调函数
     * @returns {Promise<Object>} 生成结果 {success, text, message}
     */
    async generateIntroduction(keyword, onChunk) {
        console.log('📝 开始生成介绍文本，关键词:', keyword);
        
        try {
            // 构建提示词
            const prompt = this.buildIntroPrompt(keyword);
            console.log('   提示词长度:', prompt.length, '字符');
            
            // System Prompt：定义AI角色和输出要求
            const systemPrompt = "你是一个知识分析专家，擅长从多角度分析和介绍各种概念和知识。请用中文回答，内容分2-3段，字数控制在300字左右。【最重要】第一句话必须严格按照格式：'对于[主题]，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。'其中角度要具体明确，如政治角度、经济角度、历史背景、现实意义等。";
            
            // 使用fetch接收流式响应（Server-Sent Events）
            const response = await fetch(`${this.apiBaseUrl}/chat/stream`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ 
                    message: prompt,
                    system_prompt: systemPrompt
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // 处理流式响应
            const result = await this.processStreamResponse(response, onChunk);
            
            console.log('介绍文本生成完成，总字数:', result.text.length);
            console.log('生成的完整文本:', result.text.substring(0, 100) + '...');
            
            return {
                success: true,
                text: result.text,
                message: '介绍文本生成完成'
            };
            
        } catch (error) {
            console.error('介绍文本生成失败:', error);
            return {
                success: false,
                error: error.message,
                message: '介绍文本生成失败'
            };
        }
    }
    
    /**
     * 处理流式响应（SSE格式）
     * @param {Response} response - fetch响应对象
     * @param {Function} onChunk - 文本片段回调函数
     * @returns {Promise<Object>} {text: string}
     */
    async processStreamResponse(response, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        let streamDone = false;
        
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    console.log('流读取完成（done=true）');
                    break;
                }
                
                // 解码并处理数据
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保留不完整的行
                
                // 处理每一行
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data.trim()) {
                            try {
                                const chunk = JSON.parse(data);
                                
                                // 检查流是否结束
                                if (chunk.done) {
                                    console.log('收到done标记，流式输出结束');
                                    streamDone = true;
                                    break;
                                }
                                
                                // 处理文本内容
                                if (chunk.content) {
                                    fullText += chunk.content;
                                    onChunk(chunk.content); // 实时回调显示
                                } else if (chunk.error) {
                                    throw new Error(chunk.error);
                                }
                            } catch (e) {
                                console.error('解析chunk失败:', e, '原始数据:', data);
                            }
                        }
                    }
                }
                
                // 如果收到done标记，跳出循环
                if (streamDone) {
                    console.log('跳出while循环');
                    break;
                }
            }
            
            // 处理剩余的buffer
            if (buffer && buffer.trim()) {
                console.log('处理剩余buffer:', buffer);
                if (buffer.startsWith('data: ')) {
                    const data = buffer.slice(6);
                    if (data.trim()) {
                        try {
                            const chunk = JSON.parse(data);
                            if (chunk.content) {
                                fullText += chunk.content;
                                onChunk(chunk.content);
                            }
                        } catch (e) {
                            console.error('解析最后一个chunk失败:', e);
                        }
                    }
                }
            }
            
            return { text: fullText };
            
        } finally {
            // 显式释放reader和关闭连接
            try {
                reader.cancel();
                console.log('✅ 流式连接已关闭');
            } catch (e) {
                console.warn('关闭reader时出错:', e);
            }
        }
    }
    
    /**
     * 构建介绍文本生成提示词
     * @param {string} keyword - 关键词
     * @returns {string} 提示词
     */
    buildIntroPrompt(keyword) {
        return `请用2-3段话介绍"${keyword}"，要求：

## 🔴🔴🔴 最重要：第一句话格式（必须严格遵守）
**第一句话必须严格按照以下格式输出：**
"对于${keyword}，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。"

**角度选择要求：**
- 根据"${keyword}"的内容特点，选择最合适的四个分析维度/方面/角度
- 角度名称要简洁明确（2-6个字），例如：政治角度、经济角度、文化角度、社会角度、历史背景、现实意义等
- 四个角度应该能够全面、系统地覆盖该主题的主要方面
- 角度之间应该相互独立，不要重复

## 内容结构要求：
1. **第一段（开头）**：
   - 第一句必须是"对于${keyword}，可以从【角度1】、【角度2】、【角度3】、【角度4】四个方面进行分析。"
   - 然后简要概述该主题的定义或核心概念

2. **第二段（展开）**：
   - 分别从四个角度展开说明
   - 每个角度1-2句话，解释该角度下的主要内容

3. **第三段（总结）**：
   - 综合分析，说明该主题的意义或影响

## 示例格式：
"对于辛亥革命的背景，可以从【政治角度】、【经济角度】、【思想角度】、【社会角度】四个方面进行分析。辛亥革命是中国近代史上具有重大意义的资产阶级民主革命..."

## 注意事项：
- 字数控制在300字左右
- 客观、准确、易懂
- 直接输出内容，不要有标题或其他格式标记

请直接输出介绍文本：`;
    }
}

// 导出服务类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntroductionTextService;
} else if (typeof window !== 'undefined') {
    window.IntroductionTextService = IntroductionTextService;
}

