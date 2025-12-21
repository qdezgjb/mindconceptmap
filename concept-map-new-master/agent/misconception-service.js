// 迷思概念探查服务模块
// 使用 Dify 服务来探查知识点的迷思概念

/**
 * 迷思概念探查服务
 * - 基于用户输入的知识点，使用 Dify AI 探查相关的迷思概念
 * - 支持流式输出，实时显示探查结果
 */
class MisconceptionService {
    /**
     * 构造函数
     * @param {DifyService} difyService - Dify 服务实例
     */
    constructor(difyService) {
        this.difyService = difyService;
        console.log("MisconceptionService initialized");
    }

    /**
     * 探查知识点的迷思概念（流式输出）
     * @param {string} topic - 用户输入的知识点
     * @param {Function} onChunk - 处理流式响应的回调函数
     * @param {Function} onComplete - 完成时的回调函数
     * @param {Function} onError - 出错时的回调函数
     * @returns {Promise<void>}
     */
    async exploreMisconception(topic, onChunk, onComplete, onError) {
        try {
            console.log("🔬 开始探查迷思概念，知识点:", topic);
            
            // 构建查询提示词
            const query = this.buildQuery(topic);
            
            // 调用 Dify 服务进行对话
            await this.difyService.chat(
                query,
                {
                    inputs: {
                        topic: topic
                    }
                },
                // onChunk - 处理流式响应
                (chunk) => {
                    if (chunk.content && onChunk) {
                        onChunk(chunk.content);
                    }
                },
                // onComplete - 完成回调
                (result) => {
                    console.log("✅ 迷思概念探查完成");
                    if (onComplete) {
                        onComplete({
                            success: true,
                            topic: topic,
                            conversationId: result.conversationId,
                            messageId: result.messageId,
                            fullResponse: result.fullResponse
                        });
                    }
                },
                // onError - 错误回调
                (error) => {
                    console.error("❌ 迷思概念探查失败:", error);
                    if (onError) {
                        onError({
                            message: error.message || '探查失败'
                        });
                    }
                }
            );
            
        } catch (error) {
            console.error('❌ 探查迷思概念时发生错误:', error);
            if (onError) {
                onError({
                    message: `请求失败: ${error.message}`
                });
            }
        }
    }

    /**
     * 构建查询提示词
     * @param {string} topic - 知识点
     * @returns {string} 构建好的查询提示词
     */
    buildQuery(topic) {
        return `请针对以下知识点，分析并列出相关的迷思概念（misconception）：

知识点：${topic}

请从以下维度进行分析：
1. 常见的错误理解或误解
2. 容易混淆的概念
3. 学习过程中可能产生的认知偏差
4. 与正确概念相对立的错误观点

请以结构化的方式输出，每个迷思概念包含：
- 迷思概念名称
- 错误理解的内容
- 正确的理解应该是
- 产生这种迷思的可能原因

请用中文回答，内容要详细且具有教育意义。`;
    }
}

// 导出服务类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MisconceptionService;
} else if (typeof window !== 'undefined') {
    window.MisconceptionService = MisconceptionService;
}

