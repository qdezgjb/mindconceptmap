// Dify 对话服务模块
// 负责与 Dify AI 平台进行对话交互，支持流式输出

/**
 * Dify 对话服务
 * - 与 Dify 平台进行对话交互
 * - 支持流式输出，实时显示AI响应
 */
class DifyService {
    /**
     * 构造函数
     * @param {string} apiBaseUrl - Dify API基础URL（例如：http://101.42.231.179/v1）
     * @param {string} apiKey - Dify API密钥
     */
    constructor(apiBaseUrl, apiKey) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey;
        console.log("DifyService initialized with base URL:", apiBaseUrl);
    }

    /**
     * 与 Dify 进行对话（流式输出）
     * @param {string} query - 用户输入的问题或消息
     * @param {Object} options - 可选参数
     * @param {string} options.conversationId - 对话ID（用于多轮对话）
     * @param {Object} options.inputs - 输入变量（用于工作流）
     * @param {Function} onChunk - 处理流式响应的回调函数，参数为 {content, event, conversationId}
     * @param {Function} onComplete - 完成时的回调函数，参数为 {conversationId, messageId}
     * @param {Function} onError - 出错时的回调函数，参数为 {error, message}
     * @returns {Promise<void>}
     */
    async chat(query, options = {}, onChunk, onComplete, onError) {
        try {
            console.log("💬 开始与 Dify 对话...");
            console.log("   查询内容:", query.substring(0, 100) + (query.length > 100 ? '...' : ''));
            
            const {
                conversationId = null,
                inputs = {}
            } = options;

            // 构建请求体
            const requestBody = {
                inputs: inputs,
                query: query,
                response_mode: 'streaming', // 流式输出
                conversation_id: conversationId,
                user: 'concept-map-user' // 用户标识
            };

            // 调用 Dify API
            const response = await fetch(`${this.apiBaseUrl}/chat-messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify(requestBody)
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
            let currentConversationId = conversationId;
            let messageId = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保留最后一个不完整的行

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    // 处理 SSE 格式：data: {...}
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        
                        // 跳过结束标记
                        if (dataStr === '[DONE]') {
                            continue;
                        }

                        try {
                            const data = JSON.parse(dataStr);
                            
                            // 处理不同类型的事件
                            if (data.event === 'message') {
                                // 消息事件
                                if (data.answer) {
                                    fullResponse += data.answer;
                                    if (onChunk) {
                                        onChunk({
                                            content: data.answer,
                                            event: 'message',
                                            conversationId: data.conversation_id,
                                            messageId: data.id
                                        });
                                    }
                                }
                                
                                // 保存对话ID和消息ID
                                if (data.conversation_id) {
                                    currentConversationId = data.conversation_id;
                                }
                                if (data.id) {
                                    messageId = data.id;
                                }
                            } else if (data.event === 'message_end') {
                                // 消息结束事件
                                if (data.conversation_id) {
                                    currentConversationId = data.conversation_id;
                                }
                                if (data.id) {
                                    messageId = data.id;
                                }
                            } else if (data.event === 'error') {
                                // 错误事件
                                const errorMsg = data.message || data.status || '未知错误';
                                throw new Error(errorMsg);
                            }
                            // 其他事件类型可以在这里处理
                            
                        } catch (e) {
                            console.warn('解析 SSE 数据失败:', dataStr, e);
                        }
                    }
                }
            }

            // 处理缓冲区中剩余的数据
            if (buffer.trim() && buffer.startsWith('data: ')) {
                const dataStr = buffer.substring(6);
                if (dataStr && dataStr !== '[DONE]') {
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.event === 'message' && data.answer) {
                            fullResponse += data.answer;
                            if (onChunk) {
                                onChunk({
                                    content: data.answer,
                                    event: 'message',
                                    conversationId: data.conversation_id,
                                    messageId: data.id
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('解析最终缓冲区数据失败:', dataStr, e);
                    }
                }
            }

            console.log("✅ Dify 对话完成，总响应长度:", fullResponse.length);
            
            // 调用完成回调
            if (onComplete) {
                onComplete({
                    conversationId: currentConversationId,
                    messageId: messageId,
                    fullResponse: fullResponse
                });
            }

        } catch (error) {
            console.error('❌ Dify 对话失败:', error);
            if (onError) {
                onError({
                    error: error,
                    message: `请求失败: ${error.message}`
                });
            }
        }
    }

    /**
     * 与 Dify 进行对话（非流式输出）
     * @param {string} query - 用户输入的问题或消息
     * @param {Object} options - 可选参数
     * @param {string} options.conversationId - 对话ID
     * @param {Object} options.inputs - 输入变量
     * @returns {Promise<Object>} 对话结果 {success, response, conversationId, messageId, error}
     */
    async chatSync(query, options = {}) {
        return new Promise((resolve) => {
            let fullResponse = '';
            let conversationId = null;
            let messageId = null;

            this.chat(
                query,
                options,
                // onChunk
                (chunk) => {
                    fullResponse += chunk.content;
                    if (chunk.conversationId) {
                        conversationId = chunk.conversationId;
                    }
                    if (chunk.messageId) {
                        messageId = chunk.messageId;
                    }
                },
                // onComplete
                (result) => {
                    resolve({
                        success: true,
                        response: fullResponse,
                        conversationId: result.conversationId || conversationId,
                        messageId: result.messageId || messageId
                    });
                },
                // onError
                (error) => {
                    resolve({
                        success: false,
                        error: error.message,
                        response: fullResponse
                    });
                }
            );
        });
    }
}

// 导出服务类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DifyService;
} else if (typeof window !== 'undefined') {
    window.DifyService = DifyService;
}

