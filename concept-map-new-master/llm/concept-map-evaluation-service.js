// 概念图自动评价服务模块
// 使用阿里云百炼 qwen3-vl-plus 模型分析上传的概念图

/**
 * 概念图评价服务
 * 负责将上传的概念图图片发送给阿里云百炼AI进行专业评价分析
 */
class ConceptMapEvaluationService {
    /**
     * 构造函数
     * @param {string} apiBaseUrl - API基础URL
     */
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
    }
    
    /**
     * 分析概念图
     * @param {string} imageData - 图片数据（base64编码或URL）
     * @param {string} customPrompt - 自定义分析提示词（可选）
     * @returns {Promise<Object>} 分析结果 {success, analysis, error}
     */
    async analyzeConceptMap(imageData, customPrompt = null) {
        console.log('🔍 开始分析概念图...');
        console.log('   图片数据长度:', imageData.length, '字符');
        
        try {
            // 调用后端API
            const response = await fetch(`${this.apiBaseUrl}/analyze-concept-map`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    image_data: imageData,
                    prompt: customPrompt
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 概念图分析成功');
                console.log('   分析结果长度:', result.analysis.length, '字符');
                return {
                    success: true,
                    analysis: result.analysis,
                    message: '概念图分析完成'
                };
            } else {
                console.error('❌ 概念图分析失败:', result.error);
                return {
                    success: false,
                    error: result.error,
                    message: '概念图分析失败'
                };
            }
            
        } catch (error) {
            console.error('❌ 分析概念图时发生错误:', error);
            return {
                success: false,
                error: error.message,
                message: '网络错误或服务不可用'
            };
        }
    }
    
    /**
     * 快速分析概念图（使用默认提示词）
     * @param {string} imageData - 图片数据
     * @returns {Promise<Object>} 分析结果
     */
    async quickAnalyze(imageData) {
        return this.analyzeConceptMap(imageData, null);
    }
    
    /**
     * 自定义问题分析概念图
     * @param {string} imageData - 图片数据
     * @param {string} question - 用户自定义问题
     * @returns {Promise<Object>} 分析结果
     */
    async analyzeWithQuestion(imageData, question) {
        const customPrompt = `请回答以下问题：${question}`;
        return this.analyzeConceptMap(imageData, customPrompt);
    }
    
    /**
     * 流式分析概念图（实时输出）
     * @param {string} imageData - 图片数据
     * @param {Function} onChunk - 接收数据块的回调函数 (chunk) => void
     * @param {Function} onComplete - 完成时的回调函数 () => void
     * @param {Function} onError - 错误时的回调函数 (error) => void
     * @param {string} customPrompt - 自定义提示词（可选）
     */
    async analyzeConceptMapStream(imageData, onChunk, onComplete, onError, customPrompt = null) {
        console.log('🔍 开始流式分析概念图...');
        console.log('   图片数据长度:', imageData.length, '字符');
        
        try {
            // 调用后端流式API
            const response = await fetch(`${this.apiBaseUrl}/analyze-concept-map/stream`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    image_data: imageData,
                    prompt: customPrompt
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // 读取流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('✅ 流式分析完成');
                    break;
                }
                
                // 解码数据
                buffer += decoder.decode(value, { stream: true });
                
                // 处理完整的数据行
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留不完整的行
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6); // 移除 "data: " 前缀
                        
                        if (data.trim()) {
                            try {
                                const chunk = JSON.parse(data);
                                
                                if (chunk.error) {
                                    console.error('❌ 流式分析错误:', chunk.error);
                                    if (onError) onError(chunk.error);
                                    return;
                                }
                                
                                if (chunk.done) {
                                    console.log('✅ 流式分析完成');
                                    if (onComplete) onComplete();
                                    return;
                                }
                                
                                if (chunk.content) {
                                    // 调用回调函数，传递内容
                                    if (onChunk) onChunk(chunk.content);
                                }
                            } catch (e) {
                                console.error('❌ 解析chunk失败:', e, data);
                            }
                        }
                    }
                }
            }
            
            // 最后调用完成回调
            if (onComplete) onComplete();
            
        } catch (error) {
            console.error('❌ 流式分析概念图时发生错误:', error);
            if (onError) onError(error.message);
        }
    }
    
    /**
     * 流式快速分析（使用默认提示词）
     * @param {string} imageData - 图片数据
     * @param {Function} onChunk - 接收数据块的回调函数
     * @param {Function} onComplete - 完成时的回调函数
     * @param {Function} onError - 错误时的回调函数
     */
    async streamAnalyze(imageData, onChunk, onComplete, onError) {
        return this.analyzeConceptMapStream(imageData, onChunk, onComplete, onError, null);
    }
}

// 将服务类暴露到全局
window.ConceptMapEvaluationService = ConceptMapEvaluationService;

console.log('✅ 概念图评价服务模块已加载');

