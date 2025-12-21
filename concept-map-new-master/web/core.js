// 概念图自动生成系统 - 核心模块
// 包含: DOM初始化、事件绑定、应用初始化、概念图生成

//=============================================================================
// 全局变量定义
//=============================================================================

// 当前概念图数据
window.currentGraphData = null;
window.isGenerating = false;

// 🔴 支架模式撤销功能相关变量
window.scaffoldUndoStack = []; // 撤销栈
window.scaffoldMaxUndoSteps = 20; // 最大撤销步数

// 节点选中和拖动相关变量
window.selectedNodeId = null;
window.selectedLinkId = null;
window.isAllNodesSelected = false; // 标记是否全选所有节点
window.isDragging = false;
window.dragStartX = 0;
window.dragStartY = 0;
window.dragOriginalNodeX = 0;
window.dragOriginalNodeY = 0;

// 操作历史记录
window.operationHistory = [];
window.currentHistoryIndex = -1;
window.maxHistorySize = 20;

//=============================================================================
// 应用初始化函数
//=============================================================================

function cleanup() {
    // 移除全局拖动事件监听器
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
    
    // 恢复页面样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
}

function initializePage() {
    console.log('开始初始化页面...');
    
    // 🔴 导出按钮已删除，不再需要禁用
    
    // 编辑工具栏现在在control-bar中，不需要单独设置
    
    // 添加示例数据提示
    if (window.keywordInput) {
        window.keywordInput.placeholder = '人工智能的背景';
        console.log('关键词输入框占位符已设置');
    } else {
        console.error('keywordInput 元素未找到');
    }
    
    if (window.descriptionTextarea) {
        window.descriptionTextarea.placeholder = '例如：人工智能是计算机科学的一个分支，致力于开发能够执行通常需要人类智能的任务的系统...';
        console.log('描述文本框占位符已设置');
    } else {
        console.error('descriptionTextarea 元素未找到');
    }
    
    // 初始化状态栏
    if (typeof window.updateStatusBar === 'function') {
        window.updateStatusBar({ nodes: [], links: [] });
    }
    console.log('状态栏已初始化');
    
    // 初始化历史记录按钮
    updateHistoryButtons();
    console.log('历史记录按钮已初始化');
    
    // 初始化节点操作按钮状态
    updateNodeOperationButtons();
    console.log('节点操作按钮状态已初始化');
    
    showMessage('欢迎使用概念图自动生成系统！您可以直接使用右侧工具栏创建概念图，或使用AI生成', 'info');
    console.log('页面初始化完成');
}

function displayUploadedImage(imageData, fileName) {
    console.log('开始显示上传的图片:', fileName);
    
    // 隐藏占位符
    if (window.graphPlaceholder) {
        window.graphPlaceholder.style.display = 'none';
    }
    
    // 显示概念图展示区域
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (conceptMapDisplay) {
        conceptMapDisplay.style.display = 'block';
    }
    
    // 更新当前流程文本
    if (window.processText) {
        window.processText.innerHTML = `
            <div style="padding: 15px;">
                <h4 style="color: #667eea; margin-bottom: 10px;">📤 概念图评价流程</h4>
                <p style="margin: 5px 0;"><strong>当前操作：</strong>上传概念图图片</p>
                <p style="margin: 5px 0;"><strong>文件名：</strong>${fileName}</p>
                <p style="margin: 5px 0; color: #667eea;">✨ 正在调用AI进行专业评价分析...</p>
            </div>
        `;
    }
    
    // 清空并更新SVG画布，显示上传的图片
    const graphCanvas = document.querySelector('.graph-canvas-fullwidth') || document.querySelector('.graph-canvas');
    if (graphCanvas) {
        // 清空原有内容
        graphCanvas.innerHTML = '';
        
        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            width: 100%;
            height: 1200px;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f5f5f5;
            overflow: auto;
            padding: 20px;
            box-sizing: border-box;
        `;
        
        // 创建图片元素
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = fileName;
        img.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        imageContainer.appendChild(img);
        graphCanvas.appendChild(imageContainer);
    }
    
    // 显示加载中的评价信息
    if (window.aiIntroText) {
        window.aiIntroText.innerHTML = `
            <div style="padding: 15px;">
                <h4 style="color: #667eea; margin-bottom: 10px;">🤖 AI评价分析</h4>
                <div style="text-align: center; padding: 30px 0;">
                    <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 15px; color: #666;">正在分析概念图，请稍候...</p>
                    <p style="margin-top: 5px; font-size: 12px; color: #999;">使用阿里云百炼 qwen3-vl-plus 模型</p>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }
    
    console.log('图片显示完成，开始调用AI评价服务...');
    
    // 自动调用AI评价服务
    analyzeUploadedConceptMap(imageData, fileName);
}

/**
 * 探查迷思概念
 * @param {string} topic - 知识点
 */
async function exploreMisconception(topic) {
    console.log('开始探查迷思概念...');
    
    try {
        // 检查服务是否可用
        if (!window.DifyService || !window.MisconceptionService) {
            throw new Error('Dify 服务或迷思概念服务未加载');
        }
        
        // 从环境变量或配置中获取 Dify API 配置
        // 注意：在实际应用中，这些配置应该从后端获取或通过环境变量设置
        const difyApiBaseUrl = 'http://101.42.231.179/v1'; // 可以从后端API获取
        const difyApiKey = 'app-4DGFRXExxcP0xZ5Og3AXfT2N'; // 应该从后端安全获取
        
        // 创建 Dify 服务实例
        const difyService = new window.DifyService(difyApiBaseUrl, difyApiKey);
        
        // 创建迷思概念服务实例
        const misconceptionService = new window.MisconceptionService(difyService);
        
        // 清除之前的内容
        clearPreviousConceptMap();
        
        // 显示概念图展示区域
        const conceptMapDisplay = document.querySelector('.concept-map-display');
        if (conceptMapDisplay) {
            conceptMapDisplay.style.display = 'flex';
        }
        
        // 隐藏占位符
        if (window.graphPlaceholder) {
            window.graphPlaceholder.style.display = 'none';
        }
        
        // 更新流程状态
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🔬 迷思概念探查</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>正在分析知识点并探查迷思概念...</p>
                    <p style="margin: 5px 0;"><strong>知识点：</strong>${topic}</p>
                    <p style="margin: 5px 0; color: #667eea;">✨ AI正在分析相关的迷思概念...</p>
                </div>
            `;
        }
        
        // 显示文本内容区域
        if (window.aiIntroText) {
            window.aiIntroText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🤖 AI分析过程</h4>
                    <div style="text-align: center; padding: 30px 0;">
                        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="margin-top: 15px; color: #666;">正在探查迷思概念，请稍候...</p>
                        <p style="margin-top: 5px; font-size: 12px; color: #999;">使用 Dify AI 平台</p>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
        }
        
        // 初始化响应文本
        let fullResponseText = '';
        
        // 定义回调函数
        const onChunk = (content) => {
            // 累积内容
            fullResponseText += content;
            
            // 实时更新显示
            if (window.aiIntroText) {
                const displayText = fullResponseText.length > 2000 
                    ? fullResponseText.substring(0, 2000) + '...' 
                    : fullResponseText;
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 15px;">🔬 迷思概念探查结果 <span style="color: #28a745; font-size: 14px;">⚡ 生成中...</span></h4>
                        <div style="line-height: 1.8; color: #333; font-size: 14px;">
                            <div style="white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 8px; max-height: 500px; overflow-y: auto;">${displayText}</div>
                        </div>
                    </div>
                `;
            }
        };
        
        const onComplete = (result) => {
            console.log('✅ 迷思概念探查完成:', result);
            
            // 更新流程状态，添加一键生成思维导图按钮
            if (window.processText) {
                window.processText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">🔬 迷思概念探查</h4>
                        <p style="margin: 5px 0;"><strong>当前操作：</strong>探查完成</p>
                        <p style="margin: 5px 0;"><strong>知识点：</strong>${topic}</p>
                        <p style="margin: 5px 0; color: #28a745;">✅ 迷思概念探查已完成</p>
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                            <button id="generateConceptMapFromMisconceptionBtn" class="btn btn-primary" style="width: 100%;">
                                🗺️ 一键生成思维导图
                            </button>
                            <p style="margin-top: 8px; font-size: 12px; color: #999; text-align: center;">
                                基于探查结果生成概念图
                            </p>
                        </div>
                    </div>
                `;
                
                // 绑定按钮点击事件
                const generateBtn = document.getElementById('generateConceptMapFromMisconceptionBtn');
                if (generateBtn) {
                    generateBtn.addEventListener('click', function() {
                        console.log('点击一键生成思维导图按钮');
                        
                        // 检查是否正在生成
                        if (isGenerating) {
                            showMessage('正在生成中，请稍候...', 'warning');
                            return;
                        }
                        
                        // 禁用按钮
                        generateBtn.disabled = true;
                        generateBtn.textContent = '生成中...';
                        generateBtn.classList.add('loading');
                        
                        // 调用文本生成概念图功能
                        console.log('开始基于迷思概念内容生成概念图，内容长度:', fullResponseText.length);
                        
                        // 保存按钮引用到全局，以便在生成完成后恢复
                        window.misconceptionGenerateBtn = generateBtn;
                        
                        // 调用生成函数
                        generateConceptMapWithLLM('description', { description: fullResponseText })
                            .then(() => {
                                // 生成完成后恢复按钮状态
                                if (window.misconceptionGenerateBtn) {
                                    window.misconceptionGenerateBtn.disabled = false;
                                    window.misconceptionGenerateBtn.textContent = '🗺️ 一键生成思维导图';
                                    window.misconceptionGenerateBtn.classList.remove('loading');
                                    window.misconceptionGenerateBtn = null;
                                }
                            })
                            .catch((error) => {
                                console.error('生成概念图失败:', error);
                                // 即使失败也要恢复按钮状态
                                if (window.misconceptionGenerateBtn) {
                                    window.misconceptionGenerateBtn.disabled = false;
                                    window.misconceptionGenerateBtn.textContent = '🗺️ 一键生成思维导图';
                                    window.misconceptionGenerateBtn.classList.remove('loading');
                                    window.misconceptionGenerateBtn = null;
                                }
                            });
                    });
                }
            }
            
            // 显示最终结果
            if (window.aiIntroText) {
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 15px;">🔬 迷思概念探查结果</h4>
                        <div style="line-height: 1.8; color: #333; font-size: 14px;">
                            <div style="white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 8px; max-height: 500px; overflow-y: auto;">${fullResponseText}</div>
                        </div>
                    </div>
                `;
            }
            
            // 恢复按钮状态
            if (window.exploreMisconceptionBtn) {
                window.exploreMisconceptionBtn.classList.remove('loading');
                window.exploreMisconceptionBtn.textContent = '探查迷思概念';
                window.exploreMisconceptionBtn.disabled = false;
            }
            
            showMessage('迷思概念探查完成！', 'success');
        };
        
        const onError = (error) => {
            console.error('❌ 迷思概念探查失败:', error);
            
            // 显示错误信息
            if (window.aiIntroText) {
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #e74c3c; margin-bottom: 10px;">❌ 探查失败</h4>
                        <p style="color: #666; margin: 10px 0;">${error.message || '未知错误'}</p>
                        <p style="color: #999; font-size: 14px; margin-top: 15px;">请检查：</p>
                        <ul style="color: #999; font-size: 14px; margin: 5px 0; padding-left: 20px;">
                            <li>网络连接是否正常</li>
                            <li>Dify API 服务是否可用</li>
                            <li>API 密钥是否正确配置</li>
                        </ul>
                    </div>
                `;
            }
            
            // 更新流程状态
            if (window.processText) {
                window.processText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #e74c3c; margin-bottom: 10px;">🔬 迷思概念探查</h4>
                        <p style="margin: 5px 0;"><strong>当前操作：</strong>探查失败</p>
                        <p style="margin: 5px 0;"><strong>知识点：</strong>${topic}</p>
                        <p style="margin: 5px 0; color: #e74c3c;">❌ ${error.message || '探查失败'}</p>
                    </div>
                `;
            }
            
            // 恢复按钮状态
            if (window.exploreMisconceptionBtn) {
                window.exploreMisconceptionBtn.classList.remove('loading');
                window.exploreMisconceptionBtn.textContent = '探查迷思概念';
                window.exploreMisconceptionBtn.disabled = false;
            }
            
            showMessage('迷思概念探查失败: ' + (error.message || '未知错误'), 'error');
        };
        
        // 调用服务探查迷思概念
        await misconceptionService.exploreMisconception(topic, onChunk, onComplete, onError);
        
    } catch (error) {
        console.error('❌ 调用迷思概念探查服务时发生错误:', error);
        
        // 显示错误信息
        if (window.aiIntroText) {
            window.aiIntroText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #e74c3c; margin-bottom: 10px;">❌ 系统错误</h4>
                    <p style="color: #666; margin: 10px 0;">${error.message}</p>
                    <p style="color: #999; font-size: 14px; margin-top: 15px;">请确保服务已正确加载。</p>
                </div>
            `;
        }
        
        // 恢复按钮状态
        if (window.exploreMisconceptionBtn) {
            window.exploreMisconceptionBtn.classList.remove('loading');
            window.exploreMisconceptionBtn.textContent = '探查迷思概念';
            window.exploreMisconceptionBtn.disabled = false;
        }
        
        showMessage('系统错误: ' + error.message, 'error');
    }
}

/**
 * 生成高支架概念图
 * @param {string} focusQuestion - 焦点问题
 */
async function generateHighScaffoldConceptMap(focusQuestion) {
    console.log('开始生成高支架概念图...', { focusQuestion });
    
    if (isGenerating) {
        console.log('正在生成中，忽略重复请求');
        return;
    }
    
    isGenerating = true;
    
    try {
        // 清除之前的概念图内容（必须在设置焦点问题之前）
        clearPreviousConceptMap();
        
        // 设置焦点问题（用于显示）- 必须在 clearPreviousConceptMap 之后
        window.focusQuestion = `焦点问题：${focusQuestion}`;
        
        // 显示概念图展示区域
        const conceptMapDisplay = document.querySelector('.concept-map-display');
        if (conceptMapDisplay) {
            conceptMapDisplay.style.display = 'flex';
            // 设置为高支架模式布局（左右分栏）
            conceptMapDisplay.classList.add('scaffold-mode');
        }
        
        // 隐藏占位符
        if (window.graphPlaceholder) {
            window.graphPlaceholder.style.display = 'none';
        }
        
        // 显示加载状态
        showLoadingAnimation();
        
        // 更新流程状态
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🗺️ 高支架概念图生成</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>正在生成完整概念图...</p>
                    <p style="margin: 5px 0;"><strong>焦点问题：</strong>${focusQuestion}</p>
                    <p style="margin: 5px 0; color: #667eea;">✨ AI正在生成概念图...</p>
                </div>
            `;
        }
        
        // 步骤1：生成介绍文本（用于提取三元组）
        console.log('=== 步骤1：生成介绍文本 ===');
        
        // 清空并准备文本内容展示区域
        const textDisplayArea = window.aiIntroText;
        if (textDisplayArea) {
            textDisplayArea.innerHTML = '<div class="streaming-text" style="padding: 10px; line-height: 1.8; color: #333; font-size: 14px;"></div>';
        }
        
        const streamingDiv = textDisplayArea ? textDisplayArea.querySelector('.streaming-text') : null;
        let introText = '';
        
        console.log('准备开始流式生成介绍文本，显示区域:', textDisplayArea);
        
        // 调用流式生成介绍文本
        const introResult = await window.llmManager.generateIntroduction(
            focusQuestion,
            (chunk) => {
                // 实时显示生成的文本
                introText += chunk;
                if (streamingDiv) {
                    streamingDiv.textContent = introText;
                }
            }
        );
        
        if (!introResult || !introResult.success) {
            throw new Error(introResult?.message || '介绍文本生成失败');
        }
        
        introText = introResult.text || introText;
        console.log('介绍文本生成完成，长度:', introText.length);
        
        // 最终更新显示（确保显示完整文本）
        if (streamingDiv) {
            streamingDiv.textContent = introText;
        }
        
        // 步骤2：提取三元组
        console.log('=== 步骤2：提取三元组 ===');
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🗺️ 高支架概念图生成</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>正在提取三元组...</p>
                    <p style="margin: 5px 0;"><strong>焦点问题：</strong>${focusQuestion}</p>
                </div>
            `;
        }
        
        const triplesResult = await window.llmManager.extractTriples(introText);
        if (!triplesResult || !triplesResult.success || !triplesResult.triples) {
            throw new Error(triplesResult?.message || '三元组提取失败');
        }
        
        const triples = triplesResult.triples;
        console.log('三元组提取完成，数量:', triples.length);
        
        // 步骤3：转换为概念图数据
        console.log('=== 步骤3：转换为概念图数据 ===');
        const fullConceptData = window.convertTriplesToConceptData(triples);
        console.log('概念图数据转换完成:', fullConceptData);
        
        // 先对完整概念图应用布局算法，获取节点的实际位置（使用智能布局）
        // 🔴 固定使用改进的Sugiyama算法
        const selectedLayout = 'hierarchical';
        let layoutAppliedFullData = fullConceptData;
        
        try {
            // 🔴 优先使用智能布局，它包含连线优化和节点位置优化
            if (typeof window.applyIntelligentLayout === 'function') {
                console.log('完整概念图：应用智能布局（包含优化）');
                layoutAppliedFullData = window.applyIntelligentLayout(fullConceptData);
            } else if (selectedLayout === 'hierarchical' && typeof window.applySugiyamaLayout === 'function') {
                console.log('完整概念图：应用Sugiyama布局');
                layoutAppliedFullData = window.applySugiyamaLayout(fullConceptData);
                
                // 🔴 应用连线优化，减少交叉（直接修改节点和连线数组）
                if (typeof window.optimizeLinkRouting === 'function') {
                    console.log('完整概念图：应用连线优化');
                    window.optimizeLinkRouting(layoutAppliedFullData.nodes, layoutAppliedFullData.links);
                }
            } else if (selectedLayout === 'force' && typeof window.applyForceDirectedLayout === 'function') {
                console.log('完整概念图：应用力导向布局');
                layoutAppliedFullData = window.applyForceDirectedLayout(fullConceptData, {
                    width: 2400,
                    height: 1200,
                    iterations: 300,
                    coolingFactor: 0.95,
                    linkDistance: 100,
                    nodeCharge: -300,
                    nodeSpacing: 60
                });
                
                // 🔴 应用连线优化（直接修改节点和连线数组）
                if (typeof window.optimizeLinkRouting === 'function') {
                    console.log('完整概念图：应用连线优化');
                    window.optimizeLinkRouting(layoutAppliedFullData.nodes, layoutAppliedFullData.links);
                }
            }
        } catch (error) {
            console.error('完整概念图布局算法应用失败:', error);
        }
        
        // 保存完整的概念图数据（作为专家图，使用布局后的位置）
        window.expertConceptMapData = JSON.parse(JSON.stringify(layoutAppliedFullData));
        
        // 步骤4：移除部分节点到待选概念区（使用布局后的数据）
        console.log('=== 步骤4：移除部分节点到待选概念区 ===');
        const { incompleteGraph, candidateNodes, removedNodePlaceholders } = removeNodesForScaffold(layoutAppliedFullData);
        
        // 保存待完成的概念图数据
        window.currentGraphData = incompleteGraph;
        
        // 保存待选节点
        window.scaffoldCandidateNodes = candidateNodes;
        
        // 保存被移除节点的占位符信息
        window.scaffoldPlaceholders = removedNodePlaceholders;
        
        // 🔴 关键：保存原始的待填入节点ID列表（用于后续恢复）
        // 这个列表在整个支架模式期间保持不变，用于确保虚线框始终正确显示
        window.originalPlaceholderNodeIds = new Set(candidateNodes.map(n => n.id));
        console.log(`保存原始待填入节点ID列表，共 ${window.originalPlaceholderNodeIds.size} 个:`, Array.from(window.originalPlaceholderNodeIds));
        
        // 步骤5：渲染待完成的概念图（右侧）
        console.log('=== 步骤5：渲染待完成的概念图 ===');
        setupScaffoldLayout();
        
        // 应用布局算法到待完成的概念图（使用之前已声明的selectedLayout）
        let layoutAppliedGraph = incompleteGraph;
        
        // 保存待填入节点的ID，以便布局后恢复isPlaceholder属性
        const placeholderNodeIds = new Set(
            incompleteGraph.nodes
                .filter(node => node.isPlaceholder === true)
                .map(node => node.id)
        );
        
        try {
            if (selectedLayout === 'hierarchical' && typeof window.applySugiyamaLayout === 'function') {
                layoutAppliedGraph = window.applySugiyamaLayout(incompleteGraph);
            } else if (selectedLayout === 'force' && typeof window.applyForceDirectedLayout === 'function') {
                layoutAppliedGraph = window.applyForceDirectedLayout(incompleteGraph, {
                    width: 2400,
                    height: 1200,
                    iterations: 300,
                    coolingFactor: 0.95,
                    linkDistance: 100,
                    nodeCharge: -300,
                    nodeSpacing: 60
                });
            }
            
            // 恢复isPlaceholder属性（布局算法可能会丢失）
            if (layoutAppliedGraph.nodes) {
                let restoredCount = 0;
                layoutAppliedGraph.nodes.forEach(node => {
                    if (placeholderNodeIds.has(node.id)) {
                        // 确保 isPlaceholder 属性被设置
                        if (node.isPlaceholder !== true) {
                            node.isPlaceholder = true;
                            restoredCount++;
                            console.log(`恢复了节点 ${node.id} 的 isPlaceholder 属性，标签: ${node.label || node.placeholderLabel || '无标签'}`);
                        } else {
                            console.log(`节点 ${node.id} 的 isPlaceholder 属性已存在，标签: ${node.label || node.placeholderLabel || '无标签'}`);
                        }
                    }
                });
                console.log(`总共恢复了 ${restoredCount} 个节点的 isPlaceholder 属性`);
                
                // 验证：检查最终数据中待填入节点的数量
                const finalPlaceholderCount = layoutAppliedGraph.nodes.filter(n => n.isPlaceholder === true).length;
                console.log(`最终数据中有 ${finalPlaceholderCount} 个待填入节点，期望 ${placeholderNodeIds.size} 个`);
                
                if (finalPlaceholderCount !== placeholderNodeIds.size) {
                    console.warn(`警告：待填入节点数量不匹配！期望 ${placeholderNodeIds.size} 个，实际 ${finalPlaceholderCount} 个`);
                    // 列出所有节点的 isPlaceholder 状态
                    console.log('所有节点的 isPlaceholder 状态:', 
                        layoutAppliedGraph.nodes.map(n => ({ 
                            id: n.id, 
                            label: n.label || n.placeholderLabel || '无标签',
                            isPlaceholder: n.isPlaceholder,
                            shouldBePlaceholder: placeholderNodeIds.has(n.id)
                        }))
                    );
                }
                
                // 最终强制设置：确保所有应该待填入的节点都有 isPlaceholder 属性
                layoutAppliedGraph.nodes.forEach(node => {
                    if (placeholderNodeIds.has(node.id) && node.isPlaceholder !== true) {
                        console.warn(`强制设置节点 ${node.id} 的 isPlaceholder 属性为 true`);
                        node.isPlaceholder = true;
                    }
                });
            }
        } catch (error) {
            console.error('布局算法应用失败:', error);
        }
        
        // 最终验证：确保所有待填入节点都有 isPlaceholder 属性
        const finalCheck = layoutAppliedGraph.nodes.filter(n => n.isPlaceholder === true).length;
        console.log(`最终验证：layoutAppliedGraph 中有 ${finalCheck} 个待填入节点`);
        if (finalCheck === 0 && placeholderNodeIds.size > 0) {
            console.error('错误：布局算法后所有待填入节点的 isPlaceholder 属性都丢失了！');
            // 强制恢复
            layoutAppliedGraph.nodes.forEach(node => {
                if (placeholderNodeIds.has(node.id)) {
                    node.isPlaceholder = true;
                    console.log(`强制恢复节点 ${node.id} 的 isPlaceholder 属性`);
                }
            });
        }
        
        displayIncompleteConceptMap(layoutAppliedGraph);
        displayCandidateNodes(candidateNodes);
        
        // 🔴 初始化支架模式的键盘快捷键（Ctrl+Z 撤销）
        clearScaffoldUndoStack(); // 清空之前的撤销栈
        initScaffoldKeyboardShortcuts();
        
        // 注意：占位符会在displayIncompleteConceptMap内部的drawGraph之后自动绘制
        // 这里不需要再次调用，因为drawGraph会清空SVG
        
        // 更新流程状态
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🗺️ 高支架概念图生成</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>生成完成，请将待选概念添加到概念图中</p>
                    <p style="margin: 5px 0;"><strong>焦点问题：</strong>${focusQuestion}</p>
                    <p style="margin: 5px 0; color: #28a745;">✅ 已生成概念图，${candidateNodes.length}个待选概念</p>
                </div>
            `;
        }
        
        // 恢复按钮状态
        if (window.generateScaffoldConceptMapBtn) {
            window.generateScaffoldConceptMapBtn.classList.remove('loading');
            window.generateScaffoldConceptMapBtn.textContent = '生成支架概念图';
            window.generateScaffoldConceptMapBtn.disabled = false;
        }
        
        isGenerating = false;
        showMessage('高支架概念图生成完成！', 'success');
        
    } catch (error) {
        console.error('❌ 生成高支架概念图失败:', error);
        
        // 恢复按钮状态
        if (window.generateScaffoldConceptMapBtn) {
            window.generateScaffoldConceptMapBtn.classList.remove('loading');
            window.generateScaffoldConceptMapBtn.textContent = '生成支架概念图';
            window.generateScaffoldConceptMapBtn.disabled = false;
        }
        
        isGenerating = false;
        showMessage('生成失败: ' + (error.message || '未知错误'), 'error');
    }
}

//=============================================================================
// 低支架概念图生成功能
//=============================================================================

/**
 * 生成低支架概念图
 * @param {string} focusQuestion - 焦点问题
 */
async function generateLowScaffoldConceptMap(focusQuestion) {
    console.log('开始生成低支架概念图...', { focusQuestion });
    
    if (isGenerating) {
        console.log('正在生成中，忽略重复请求');
        return;
    }
    
    isGenerating = true;
    
    try {
        // 清除之前的概念图内容
        clearPreviousConceptMap();
        
        // 设置焦点问题
        window.focusQuestion = `焦点问题：${focusQuestion}`;
        
        // 显示概念图展示区域
        const conceptMapDisplay = document.querySelector('.concept-map-display');
        if (conceptMapDisplay) {
            conceptMapDisplay.style.display = 'flex';
            conceptMapDisplay.classList.add('scaffold-mode');
            conceptMapDisplay.classList.add('low-scaffold-mode');
        }
        
        // 隐藏占位符
        if (window.graphPlaceholder) {
            window.graphPlaceholder.style.display = 'none';
        }
        
        // 显示加载状态
        showLoadingAnimation();
        
        // 更新流程状态
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🗺️ 低支架概念图生成</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>正在生成相关内容...</p>
                    <p style="margin: 5px 0;"><strong>焦点问题：</strong>${focusQuestion}</p>
                    <p style="margin: 5px 0; color: #667eea;">✨ AI正在生成...</p>
                </div>
            `;
        }
        
        // 步骤1：生成介绍文本
        console.log('=== 步骤1：生成介绍文本 ===');
        
        const textDisplayArea = window.aiIntroText;
        if (textDisplayArea) {
            textDisplayArea.innerHTML = '<div class="streaming-text" style="padding: 10px; line-height: 1.8; color: #333; font-size: 14px;"></div>';
        }
        
        const streamingDiv = textDisplayArea ? textDisplayArea.querySelector('.streaming-text') : null;
        let introText = '';
        
        const introResult = await window.llmManager.generateIntroduction(
            focusQuestion,
            (chunk) => {
                introText += chunk;
                if (streamingDiv) {
                    streamingDiv.textContent = introText;
                }
            }
        );
        
        if (!introResult || !introResult.success) {
            throw new Error(introResult?.message || '介绍文本生成失败');
        }
        
        introText = introResult.text || introText;
        console.log('介绍文本生成完成，长度:', introText.length);
        
        if (streamingDiv) {
            streamingDiv.textContent = introText;
        }
        
        // 步骤2：提取三元组
        console.log('=== 步骤2：提取三元组 ===');
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🗺️ 低支架概念图生成</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>正在提取三元组...</p>
                    <p style="margin: 5px 0;"><strong>焦点问题：</strong>${focusQuestion}</p>
                </div>
            `;
        }
        
        const triplesResult = await window.llmManager.extractTriples(introText);
        if (!triplesResult || !triplesResult.success || !triplesResult.triples) {
            throw new Error(triplesResult?.message || '三元组提取失败');
        }
        
        const triples = triplesResult.triples;
        console.log('三元组提取完成，数量:', triples.length);
        
        // 步骤3：转换为概念图数据（作为专家图）
        console.log('=== 步骤3：转换为概念图数据 ===');
        const fullConceptData = window.convertTriplesToConceptData(triples);
        
        // 应用布局算法（使用智能布局，包含优化步骤）
        // 🔴 固定使用改进的Sugiyama算法
        const selectedLayout = 'hierarchical';
        let layoutAppliedData = fullConceptData;
        
        try {
            // 🔴 优先使用智能布局，它包含连线优化和节点位置优化
            if (typeof window.applyIntelligentLayout === 'function') {
                console.log('低支架概念图：应用智能布局（包含优化）');
                layoutAppliedData = window.applyIntelligentLayout(fullConceptData);
            } else if (selectedLayout === 'hierarchical' && typeof window.applySugiyamaLayout === 'function') {
                layoutAppliedData = window.applySugiyamaLayout(fullConceptData);
                
                // 🔴 应用连线优化，减少交叉（直接修改节点和连线数组）
                if (typeof window.optimizeLinkRouting === 'function') {
                    console.log('低支架概念图：应用连线优化');
                    window.optimizeLinkRouting(layoutAppliedData.nodes, layoutAppliedData.links);
                }
            } else if (selectedLayout === 'force' && typeof window.applyForceDirectedLayout === 'function') {
                layoutAppliedData = window.applyForceDirectedLayout(fullConceptData, {
                    width: 2400,
                    height: 1200
                });
                
                // 🔴 应用连线优化（直接修改节点和连线数组）
                if (typeof window.optimizeLinkRouting === 'function') {
                    console.log('低支架概念图：应用连线优化');
                    window.optimizeLinkRouting(layoutAppliedData.nodes, layoutAppliedData.links);
                }
            }
        } catch (error) {
            console.error('布局算法应用失败:', error);
        }
        
        // 保存完整概念图作为专家图
        window.expertConceptMapData = JSON.parse(JSON.stringify(layoutAppliedData));
        
        // 步骤4：提取待选概念和待选关系词
        console.log('=== 步骤4：提取待选概念和关系词 ===');
        const { concepts, relations } = extractConceptsAndRelations(triples);
        
        // 保存待选概念和关系词
        window.lowScaffoldConcepts = concepts;
        window.lowScaffoldRelations = relations;
        
        // 初始化用户构建的概念图数据
        window.currentGraphData = { nodes: [], links: [] };
        window.userBuiltNodes = [];
        window.userBuiltLinks = [];
        
        // 步骤5：设置低支架模式布局
        console.log('=== 步骤5：设置低支架模式布局 ===');
        setupLowScaffoldLayout();
        
        // 使用 setTimeout 确保 DOM 完全创建后再显示
        setTimeout(() => {
            console.log('开始显示待选概念和关系词，概念数量:', concepts.length, '关系词数量:', relations.length);
            displayLowScaffoldConcepts(concepts);
            displayLowScaffoldRelations(relations);
        }, 100);
        
        // 初始化低支架模式的交互
        initLowScaffoldInteractions();
        
        // 显示焦点问题
        if (typeof window.displayFocusQuestion === 'function' && window.focusQuestion) {
            setTimeout(() => {
                window.displayFocusQuestion();
            }, 100);
        }
        
        // 更新流程状态
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🗺️ 低支架概念图生成</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>请从左侧拖拽概念到画布构建概念图</p>
                    <p style="margin: 5px 0;"><strong>焦点问题：</strong>${focusQuestion}</p>
                    <p style="margin: 5px 0; color: #28a745;">✅ 已提取 ${concepts.length} 个概念，${relations.length} 个关系词</p>
                </div>
            `;
        }
        
        // 恢复按钮状态
        if (window.generateScaffoldConceptMapBtn) {
            window.generateScaffoldConceptMapBtn.classList.remove('loading');
            window.generateScaffoldConceptMapBtn.textContent = '生成支架概念图';
            window.generateScaffoldConceptMapBtn.disabled = false;
        }
        
        isGenerating = false;
        showMessage('低支架概念图生成完成！请从左侧拖拽概念构建概念图', 'success');
        
    } catch (error) {
        console.error('❌ 生成低支架概念图失败:', error);
        
        if (window.generateScaffoldConceptMapBtn) {
            window.generateScaffoldConceptMapBtn.classList.remove('loading');
            window.generateScaffoldConceptMapBtn.textContent = '生成支架概念图';
            window.generateScaffoldConceptMapBtn.disabled = false;
        }
        
        isGenerating = false;
        showMessage('生成失败: ' + (error.message || '未知错误'), 'error');
    }
}

/**
 * 从三元组中提取概念和关系词
 * @param {Array} triples - 三元组数组
 * @returns {Object} { concepts, relations }
 */
function extractConceptsAndRelations(triples) {
    // 使用 Map 来保存概念和层级信息
    const conceptMap = new Map(); // key: 概念名, value: { label, layer }
    const relationSet = new Set();
    const relationCount = new Map(); // 统计关系词使用频率
    
    console.log('extractConceptsAndRelations: 输入三元组数量:', triples ? triples.length : 0);
    console.log('extractConceptsAndRelations: 输入三元组:', triples);
    
    if (!triples || !Array.isArray(triples) || triples.length === 0) {
        console.error('extractConceptsAndRelations: 三元组数组为空或无效');
        return { concepts: [], relations: [] };
    }
    
    triples.forEach((triple, index) => {
        // 三元组格式：{ source, relation, target, layer }
        console.log(`处理三元组 ${index + 1}:`, triple);
        
        // 解析层级信息（格式：L1-L2）
        let sourceLayer = null;
        let targetLayer = null;
        if (triple.layer) {
            const layerMatch = triple.layer.match(/^L(\d+)-L(\d+)$/);
            if (layerMatch) {
                sourceLayer = parseInt(layerMatch[1]);
                targetLayer = parseInt(layerMatch[2]);
            }
        }
        
        // 添加源概念及其层级
        if (triple.source) {
            if (!conceptMap.has(triple.source)) {
                conceptMap.set(triple.source, {
                    label: triple.source,
                    layer: sourceLayer
                });
            } else {
                // 如果已存在，更新层级（取较小的层级，因为概念可能出现在多个三元组中）
                const existing = conceptMap.get(triple.source);
                if (sourceLayer !== null && (existing.layer === null || sourceLayer < existing.layer)) {
                    existing.layer = sourceLayer;
                }
            }
            console.log(`  添加概念: ${triple.source} (层级: L${sourceLayer})`);
        }
        
        // 添加目标概念及其层级
        if (triple.target) {
            if (!conceptMap.has(triple.target)) {
                conceptMap.set(triple.target, {
                    label: triple.target,
                    layer: targetLayer
                });
            } else {
                // 如果已存在，更新层级（取较小的层级）
                const existing = conceptMap.get(triple.target);
                if (targetLayer !== null && (existing.layer === null || targetLayer < existing.layer)) {
                    existing.layer = targetLayer;
                }
            }
            console.log(`  添加概念: ${triple.target} (层级: L${targetLayer})`);
        }
        
        if (triple.relation) {
            relationSet.add(triple.relation);
            // 统计使用频率
            const count = relationCount.get(triple.relation) || 0;
            relationCount.set(triple.relation, count + 1);
            console.log(`  添加关系词: ${triple.relation}`);
        }
    });
    
    // 按层级分组概念
    const conceptsByLayer = {};
    conceptMap.forEach((conceptData, label) => {
        const layer = conceptData.layer !== null ? conceptData.layer : 999; // 没有层级的放在最后
        if (!conceptsByLayer[layer]) {
            conceptsByLayer[layer] = [];
        }
        conceptsByLayer[layer].push(conceptData);
    });
    
    // 按层级排序并转换为数组
    const sortedLayers = Object.keys(conceptsByLayer).map(Number).sort((a, b) => a - b);
    let conceptIndex = 0;
    const concepts = [];
    sortedLayers.forEach(layer => {
        conceptsByLayer[layer].forEach(conceptData => {
            concepts.push({
                id: `concept-${conceptIndex}`,
                label: conceptData.label,
                layer: conceptData.layer,
                used: false
            });
            conceptIndex++;
        });
    });
    
    // 关系词按使用频率排序（频率高的在前），频率相同则按字母顺序
    const relations = Array.from(relationSet)
        .map(relation => ({
            label: relation,
            frequency: relationCount.get(relation) || 0
        }))
        .sort((a, b) => {
            if (b.frequency !== a.frequency) {
                return b.frequency - a.frequency; // 频率高的在前
            }
            return a.label.localeCompare(b.label); // 频率相同按字母顺序
        })
        .map((relation, index) => ({
            id: `relation-${index}`,
            label: relation.label,
            frequency: relation.frequency,
            used: false
        }));
    
    console.log(`✅ 提取到 ${concepts.length} 个概念（按层级排序）:`);
    sortedLayers.forEach(layer => {
        const layerConcepts = concepts.filter(c => c.layer === layer);
        if (layerConcepts.length > 0) {
            console.log(`  L${layer}: ${layerConcepts.map(c => c.label).join(', ')}`);
        }
    });
    console.log(`✅ 提取到 ${relations.length} 个关系词:`, relations.map(r => r.label));
    return { concepts, relations };
}

/**
 * 设置低支架模式的布局（左侧两列 + 右侧画布）
 */
function setupLowScaffoldLayout() {
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (!conceptMapDisplay) return;
    
    // 创建低支架模式布局
    let scaffoldContainer = conceptMapDisplay.querySelector('.scaffold-container');
    if (!scaffoldContainer) {
        scaffoldContainer = document.createElement('div');
        scaffoldContainer.className = 'scaffold-container low-scaffold-container';
        scaffoldContainer.style.cssText = 'display: flex; width: 100%; min-height: 900px; gap: 20px; align-items: stretch;';
        
        conceptMapDisplay.innerHTML = '';
        conceptMapDisplay.appendChild(scaffoldContainer);
    } else {
        scaffoldContainer.classList.add('low-scaffold-container');
        scaffoldContainer.style.cssText = 'display: flex; width: 100%; min-height: 900px; gap: 20px; align-items: stretch;';
        scaffoldContainer.innerHTML = '';
    }
    
    // 左侧：待选概念和关系词区域（分两列）
    const leftPanel = document.createElement('div');
    leftPanel.className = 'low-scaffold-left-panel';
    leftPanel.style.cssText = `
        width: 350px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        border: 1px solid #e9ecef;
        min-height: 900px;
        overflow-y: auto;
    `;
    
    // 待选概念区
    const conceptsArea = document.createElement('div');
    conceptsArea.className = 'low-scaffold-concepts-area';
    conceptsArea.style.cssText = `
        background: white;
        border-radius: 6px;
        padding: 12px;
        border: 1px solid #dee2e6;
    `;
    conceptsArea.innerHTML = `
        <h5 style="margin-bottom: 12px; color: #2c3e50; font-size: 14px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">
            📦 待选概念
        </h5>
        <div class="low-scaffold-concepts-list" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
    `;
    
    // 待选关系词区
    const relationsArea = document.createElement('div');
    relationsArea.className = 'low-scaffold-relations-area';
    relationsArea.style.cssText = `
        flex: 1;
        background: white;
        border-radius: 6px;
        padding: 12px;
        border: 1px solid #dee2e6;
        min-height: 150px;
        overflow-y: auto;
    `;
    relationsArea.innerHTML = `
        <h5 style="margin-bottom: 12px; color: #2c3e50; font-size: 14px; border-bottom: 2px solid #28a745; padding-bottom: 8px;">
            🔗 待选关系词
        </h5>
        <div class="low-scaffold-relations-list" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
    `;
    
    // 操作按钮区
    const buttonsArea = document.createElement('div');
    buttonsArea.className = 'low-scaffold-buttons-area';
    buttonsArea.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 10px;
        border-top: 1px solid #dee2e6;
    `;
    buttonsArea.innerHTML = `
        <button id="showExpertMapBtn" class="btn btn-secondary" style="width: 100%;">
            📊 展示专家图
        </button>
        <button id="compareWithExpertBtn" class="btn btn-outline" style="width: 100%;">
            🔍 与专家图比较
        </button>
    `;
    
    leftPanel.appendChild(conceptsArea);
    leftPanel.appendChild(relationsArea);
    leftPanel.appendChild(buttonsArea);
    scaffoldContainer.appendChild(leftPanel);
    
    console.log('setupLowScaffoldLayout: DOM 结构已创建');
    console.log('  概念列表元素:', document.querySelector('.low-scaffold-concepts-list'));
    console.log('  关系词列表元素:', document.querySelector('.low-scaffold-relations-list'));
    
    // 右侧：空白画布区域
    const graphArea = document.createElement('div');
    graphArea.className = 'scaffold-graph-area low-scaffold-graph-area';
    graphArea.style.cssText = `
        flex: 1;
        background: white;
        border-radius: 8px;
        border: 2px dashed #dee2e6;
        position: relative;
        overflow: auto;
        min-height: 900px;
    `;
    graphArea.innerHTML = `
        <div class="low-scaffold-canvas-hint" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #adb5bd;
            pointer-events: none;
        ">
            <div style="font-size: 48px; margin-bottom: 15px;">📝</div>
            <div style="font-size: 16px;">拖拽左侧概念到此处创建节点</div>
            <div style="font-size: 14px; margin-top: 8px;">点击两个节点可以创建连线</div>
        </div>
        <svg width="100%" height="100%" class="scaffold-concept-graph low-scaffold-svg" viewBox="0 0 2400 1600" style="min-height: 900px;">
        </svg>
    `;
    scaffoldContainer.appendChild(graphArea);
    
    // 专家图展示区域（初始隐藏）
    let expertMapArea = conceptMapDisplay.querySelector('.expert-map-area');
    if (!expertMapArea) {
        expertMapArea = document.createElement('div');
        expertMapArea.className = 'expert-map-area';
        expertMapArea.style.cssText = `
            width: 100%;
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            padding: 15px;
            display: none;
        `;
        expertMapArea.innerHTML = `
            <h4 style="margin-bottom: 15px; color: #2c3e50;">专家图（完整概念图）</h4>
            <svg width="100%" height="100%" class="expert-concept-graph" viewBox="0 0 2400 1200" style="min-height: 600px;">
            </svg>
        `;
        conceptMapDisplay.appendChild(expertMapArea);
    }
    
    // 绑定按钮事件
    bindLowScaffoldButtonEvents(leftPanel, expertMapArea);
}

/**
 * 绑定低支架模式的按钮事件
 */
function bindLowScaffoldButtonEvents(leftPanel, expertMapArea) {
    // 展示专家图按钮
    const showExpertBtn = leftPanel.querySelector('#showExpertMapBtn');
    if (showExpertBtn && !showExpertBtn.dataset.bound) {
        showExpertBtn.dataset.bound = 'true';
        showExpertBtn.addEventListener('click', function() {
            const isVisible = expertMapArea.style.display !== 'none';
            if (isVisible) {
                expertMapArea.style.display = 'none';
                this.textContent = '📊 展示专家图';
            } else {
                expertMapArea.style.display = 'block';
                this.textContent = '📊 隐藏专家图';
                if (window.expertConceptMapData) {
                    displayExpertConceptMap(window.expertConceptMapData);
                }
            }
        });
    }
    
    // 与专家图比较按钮
    const compareBtn = leftPanel.querySelector('#compareWithExpertBtn');
    if (compareBtn && !compareBtn.dataset.bound) {
        compareBtn.dataset.bound = 'true';
        compareBtn.addEventListener('click', function() {
            showMessage('与专家图比较功能即将推出', 'info');
            // TODO: 实现比较功能
        });
    }
}

/**
 * 显示待选概念列表（按层级分组）
 */
function displayLowScaffoldConcepts(concepts) {
    console.log('displayLowScaffoldConcepts: 开始显示，概念数量:', concepts.length);
    const conceptsList = document.querySelector('.low-scaffold-concepts-list');
    if (!conceptsList) {
        console.error('displayLowScaffoldConcepts: 找不到 .low-scaffold-concepts-list 元素');
        // 尝试从保存的数据中重新显示
        if (window.lowScaffoldConcepts && window.lowScaffoldConcepts.length > 0) {
            console.log('尝试延迟显示概念...');
            setTimeout(() => displayLowScaffoldConcepts(window.lowScaffoldConcepts), 200);
        }
        return;
    }
    
    console.log('displayLowScaffoldConcepts: 找到元素，开始渲染');
    conceptsList.innerHTML = '';
    
    if (concepts.length === 0) {
        console.warn('displayLowScaffoldConcepts: 概念数组为空');
        return;
    }
    
    // 按层级分组
    const conceptsByLayer = {};
    concepts.forEach(concept => {
        const layer = concept.layer !== null && concept.layer !== undefined ? concept.layer : 999;
        if (!conceptsByLayer[layer]) {
            conceptsByLayer[layer] = [];
        }
        conceptsByLayer[layer].push(concept);
    });
    
    // 按层级排序
    const sortedLayers = Object.keys(conceptsByLayer).map(Number).sort((a, b) => a - b);
    
    // 为每个层级创建分组
    sortedLayers.forEach(layer => {
        const layerConcepts = conceptsByLayer[layer];
        
        // 创建层级标题
        const layerHeader = document.createElement('div');
        layerHeader.style.cssText = `
            width: 100%;
            margin-top: ${layer === sortedLayers[0] ? '0' : '15px'};
            margin-bottom: 8px;
            padding: 6px 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-align: center;
        `;
        layerHeader.textContent = layer === 999 ? '未分类' : `层级 L${layer}`;
        conceptsList.appendChild(layerHeader);
        
        // 创建该层级的概念容器
        const layerContainer = document.createElement('div');
        layerContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        `;
        
        // 添加该层级的所有概念
        layerConcepts.forEach(concept => {
            const item = document.createElement('div');
            item.className = 'low-scaffold-concept-item';
            item.setAttribute('data-concept-id', concept.id);
            item.setAttribute('data-concept-label', concept.label);
            item.draggable = true;
            item.style.cssText = `
                padding: 8px 12px;
                background: #667eea;
                color: white;
                border-radius: 20px;
                font-size: 13px;
                cursor: grab;
                transition: all 0.2s;
                user-select: none;
            `;
            item.textContent = concept.label;
            
            // 拖拽事件
            item.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: 'concept',
                    id: concept.id,
                    label: concept.label
                }));
                e.dataTransfer.effectAllowed = 'copy';
                this.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', function() {
                this.style.opacity = '1';
            });
            
            // 鼠标悬停效果
            item.addEventListener('mouseenter', function() {
                if (!this.classList.contains('used')) {
                    this.style.transform = 'scale(1.05)';
                    this.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
                }
            });
            
            item.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = 'none';
            });
            
            layerContainer.appendChild(item);
        });
        
        conceptsList.appendChild(layerContainer);
    });
    
    // 调整概念区域高度，使其刚好适应内容，不留多余空间
    setTimeout(() => {
        const conceptsArea = document.querySelector('.low-scaffold-concepts-area');
        if (conceptsArea) {
            // 获取整个区域的实际内容高度（包括标题和所有内容）
            const titleHeight = conceptsArea.querySelector('h5')?.offsetHeight || 0;
            const conceptsList = conceptsArea.querySelector('.low-scaffold-concepts-list');
            if (conceptsList) {
                // 使用 scrollHeight 获取完整内容高度（包括所有层级标题和概念）
                const contentHeight = conceptsList.scrollHeight;
                const padding = 24; // 上下 padding 12px * 2
                const totalHeight = contentHeight + titleHeight + padding;
                
                // 设置高度为内容高度，不留多余空间
                conceptsArea.style.height = `${totalHeight}px`;
                conceptsArea.style.overflow = 'visible';
                conceptsArea.style.flexShrink = '0'; // 防止被压缩
                console.log(`概念区域高度已调整为: ${totalHeight}px (内容: ${contentHeight}px, 标题: ${titleHeight}px, 内边距: ${padding}px)`);
            }
        }
    }, 100);
    
    console.log(`displayLowScaffoldConcepts: 成功显示 ${concepts.length} 个概念，共 ${sortedLayers.length} 个层级`);
}

/**
 * 显示待选关系词列表（按使用频率分组）
 */
function displayLowScaffoldRelations(relations) {
    console.log('displayLowScaffoldRelations: 开始显示，关系词数量:', relations.length);
    const relationsList = document.querySelector('.low-scaffold-relations-list');
    if (!relationsList) {
        console.error('displayLowScaffoldRelations: 找不到 .low-scaffold-relations-list 元素');
        // 尝试从保存的数据中重新显示
        if (window.lowScaffoldRelations && window.lowScaffoldRelations.length > 0) {
            console.log('尝试延迟显示关系词...');
            setTimeout(() => displayLowScaffoldRelations(window.lowScaffoldRelations), 200);
        }
        return;
    }
    
    console.log('displayLowScaffoldRelations: 找到元素，开始渲染');
    relationsList.innerHTML = '';
    
    if (relations.length === 0) {
        console.warn('displayLowScaffoldRelations: 关系词数组为空');
        return;
    }
    
    // 按使用频率分组
    const relationsByFrequency = {};
    relations.forEach(relation => {
        const freq = relation.frequency || 0;
        if (!relationsByFrequency[freq]) {
            relationsByFrequency[freq] = [];
        }
        relationsByFrequency[freq].push(relation);
    });
    
    // 按频率排序（频率高的在前）
    const sortedFrequencies = Object.keys(relationsByFrequency).map(Number).sort((a, b) => b - a);
    
    // 为每个频率组创建分组
    sortedFrequencies.forEach(frequency => {
        const freqRelations = relationsByFrequency[frequency];
        
        // 创建频率标题（只显示频率大于1的）
        if (frequency > 1) {
            const freqHeader = document.createElement('div');
            freqHeader.style.cssText = `
                width: 100%;
                margin-top: ${frequency === sortedFrequencies[0] ? '0' : '12px'};
                margin-bottom: 6px;
                padding: 4px 8px;
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                text-align: center;
            `;
            freqHeader.textContent = `使用 ${frequency} 次`;
            relationsList.appendChild(freqHeader);
        }
        
        // 创建该频率组的关系词容器
        const freqContainer = document.createElement('div');
        freqContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: ${frequency > 1 ? '6px' : '0'};
        `;
        
        // 添加该频率组的所有关系词
        freqRelations.forEach(relation => {
            const item = document.createElement('div');
            item.className = 'low-scaffold-relation-item';
            item.setAttribute('data-relation-id', relation.id);
            item.setAttribute('data-relation-label', relation.label);
            item.draggable = true;
            item.style.cssText = `
                padding: 6px 10px;
                background: #28a745;
                color: white;
                border-radius: 12px;
                font-size: 12px;
                cursor: grab;
                transition: all 0.2s;
                user-select: none;
            `;
            item.textContent = relation.label;
            
            // 拖拽事件
            item.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: 'relation',
                    id: relation.id,
                    label: relation.label
                }));
                e.dataTransfer.effectAllowed = 'copy';
                this.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', function() {
                this.style.opacity = '1';
            });
            
            // 鼠标悬停效果
            item.addEventListener('mouseenter', function() {
                if (!this.classList.contains('used')) {
                    this.style.transform = 'scale(1.05)';
                    this.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.4)';
                }
            });
            
            item.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = 'none';
            });
            
            freqContainer.appendChild(item);
        });
        
        relationsList.appendChild(freqContainer);
    });
    
    console.log(`displayLowScaffoldRelations: 成功显示 ${relations.length} 个关系词，共 ${sortedFrequencies.length} 个频率组`);
}

/**
 * 初始化低支架模式的交互
 */
function initLowScaffoldInteractions() {
    const graphArea = document.querySelector('.low-scaffold-graph-area');
    const svg = document.querySelector('.low-scaffold-svg');
    if (!graphArea || !svg) return;
    
    // 用于连线的状态
    window.lowScaffoldLinkState = {
        isLinking: false,
        sourceNodeId: null,
        tempLine: null
    };
    
    // 拖放概念到画布
    graphArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.style.borderColor = '#667eea';
        this.style.background = 'rgba(102, 126, 234, 0.05)';
    });
    
    graphArea.addEventListener('dragleave', function(e) {
        this.style.borderColor = '#dee2e6';
        this.style.background = 'white';
    });
    
    graphArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = '#dee2e6';
        this.style.background = 'white';
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            if (data.type === 'concept') {
                // 计算放置位置（转换为 SVG 坐标）
                const rect = svg.getBoundingClientRect();
                const viewBox = svg.viewBox.baseVal;
                const scaleX = viewBox.width / rect.width;
                const scaleY = viewBox.height / rect.height;
                
                const x = (e.clientX - rect.left) * scaleX + viewBox.x;
                const y = (e.clientY - rect.top) * scaleY + viewBox.y;
                
                // 创建节点
                addLowScaffoldNode(data.id, data.label, x, y);
                
                // 隐藏提示
                const hint = graphArea.querySelector('.low-scaffold-canvas-hint');
                if (hint) hint.style.display = 'none';
            } else if (data.type === 'relation') {
                // 关系词需要放到连线上，这里暂时提示
                showMessage('请先创建连线，再将关系词拖拽到连线上', 'info');
            }
        } catch (err) {
            console.error('拖放处理失败:', err);
        }
    });
    
    // SVG 点击事件（用于取消连线状态）
    svg.addEventListener('click', function(e) {
        if (e.target === svg && window.lowScaffoldLinkState.isLinking) {
            cancelLowScaffoldLinking();
        }
    });
}

/**
 * 在画布上添加节点
 */
function addLowScaffoldNode(conceptId, label, x, y) {
    const svg = document.querySelector('.low-scaffold-svg');
    if (!svg) return;
    
    // 检查节点是否已添加
    const existingNode = window.currentGraphData.nodes.find(n => n.originalConceptId === conceptId);
    if (existingNode) {
        showMessage('该概念已添加到画布', 'warning');
        return;
    }
    
    // 生成节点ID
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 计算节点尺寸
    const dimensions = window.calculateNodeDimensions ? 
        window.calculateNodeDimensions(label, 70, 35, 14) : 
        { width: Math.max(70, label.length * 14 + 30), height: 35 };
    
    // 添加到数据
    const newNode = {
        id: nodeId,
        label: label,
        x: x,
        y: y,
        width: dimensions.width,
        height: dimensions.height,
        originalConceptId: conceptId
    };
    
    window.currentGraphData.nodes.push(newNode);
    window.userBuiltNodes.push(newNode);
    
    // 创建 SVG 节点
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-node-id', nodeId);
    g.setAttribute('class', 'low-scaffold-node');
    g.style.cursor = 'pointer';
    
    // 节点矩形
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - dimensions.width / 2);
    rect.setAttribute('y', y - dimensions.height / 2);
    rect.setAttribute('width', dimensions.width);
    rect.setAttribute('height', dimensions.height);
    rect.setAttribute('rx', 8);
    rect.setAttribute('fill', '#667eea');
    rect.setAttribute('stroke', '#5a67d8');
    rect.setAttribute('stroke-width', '2');
    
    // 节点文本
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', '500');
    text.textContent = label;
    
    g.appendChild(rect);
    g.appendChild(text);
    svg.appendChild(g);
    
    // 绑定节点事件
    bindLowScaffoldNodeEvents(g, newNode);
    
    // 标记概念为已使用
    markConceptAsUsed(conceptId);
    
    console.log(`添加节点: ${label} at (${x}, ${y})`);
}

/**
 * 绑定低支架节点的交互事件
 */
function bindLowScaffoldNodeEvents(nodeGroup, nodeData) {
    let isDragging = false;
    let startX, startY, originalX, originalY;
    
    // 点击事件 - 用于创建连线
    nodeGroup.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (window.lowScaffoldLinkState.isLinking) {
            // 第二次点击 - 创建连线
            if (window.lowScaffoldLinkState.sourceNodeId !== nodeData.id) {
                createLowScaffoldLink(window.lowScaffoldLinkState.sourceNodeId, nodeData.id);
            }
            cancelLowScaffoldLinking();
        } else {
            // 第一次点击 - 开始连线
            startLowScaffoldLinking(nodeData.id);
        }
    });
    
    // 拖拽事件
    nodeGroup.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return; // 只响应左键
        
        isDragging = true;
        const svg = document.querySelector('.low-scaffold-svg');
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const scaleX = viewBox.width / rect.width;
        const scaleY = viewBox.height / rect.height;
        
        startX = e.clientX;
        startY = e.clientY;
        originalX = nodeData.x;
        originalY = nodeData.y;
        
        nodeGroup.style.cursor = 'grabbing';
        
        const onMouseMove = function(e) {
            if (!isDragging) return;
            
            const dx = (e.clientX - startX) * scaleX;
            const dy = (e.clientY - startY) * scaleY;
            
            nodeData.x = originalX + dx;
            nodeData.y = originalY + dy;
            
            // 更新节点位置
            const rectEl = nodeGroup.querySelector('rect');
            const textEl = nodeGroup.querySelector('text');
            if (rectEl) {
                rectEl.setAttribute('x', nodeData.x - nodeData.width / 2);
                rectEl.setAttribute('y', nodeData.y - nodeData.height / 2);
            }
            if (textEl) {
                textEl.setAttribute('x', nodeData.x);
                textEl.setAttribute('y', nodeData.y + 5);
            }
            
            // 更新连接的连线
            updateLowScaffoldLinks(nodeData.id);
        };
        
        const onMouseUp = function() {
            isDragging = false;
            nodeGroup.style.cursor = 'pointer';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    
    // 鼠标悬停效果
    nodeGroup.addEventListener('mouseenter', function() {
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke-width', '3');
            rect.setAttribute('stroke', '#4c51bf');
        }
    });
    
    nodeGroup.addEventListener('mouseleave', function() {
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke', '#5a67d8');
        }
    });
}

/**
 * 开始连线
 */
function startLowScaffoldLinking(sourceNodeId) {
    window.lowScaffoldLinkState.isLinking = true;
    window.lowScaffoldLinkState.sourceNodeId = sourceNodeId;
    
    // 高亮源节点
    const svg = document.querySelector('.low-scaffold-svg');
    const sourceGroup = svg.querySelector(`g[data-node-id="${sourceNodeId}"]`);
    if (sourceGroup) {
        const rect = sourceGroup.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke', '#f59e0b');
            rect.setAttribute('stroke-width', '3');
        }
    }
    
    showMessage('请点击另一个节点来创建连线', 'info');
}

/**
 * 取消连线
 */
function cancelLowScaffoldLinking() {
    if (window.lowScaffoldLinkState.sourceNodeId) {
        const svg = document.querySelector('.low-scaffold-svg');
        const sourceGroup = svg.querySelector(`g[data-node-id="${window.lowScaffoldLinkState.sourceNodeId}"]`);
        if (sourceGroup) {
            const rect = sourceGroup.querySelector('rect');
            if (rect) {
                rect.setAttribute('stroke', '#5a67d8');
                rect.setAttribute('stroke-width', '2');
            }
        }
    }
    
    window.lowScaffoldLinkState.isLinking = false;
    window.lowScaffoldLinkState.sourceNodeId = null;
}

/**
 * 创建连线
 */
function createLowScaffoldLink(sourceId, targetId) {
    const svg = document.querySelector('.low-scaffold-svg');
    if (!svg) return;
    
    // 检查连线是否已存在
    const existingLink = window.currentGraphData.links.find(
        l => (l.source === sourceId && l.target === targetId) ||
             (l.source === targetId && l.target === sourceId)
    );
    if (existingLink) {
        showMessage('这两个节点之间已有连线', 'warning');
        return;
    }
    
    const sourceNode = window.currentGraphData.nodes.find(n => n.id === sourceId);
    const targetNode = window.currentGraphData.nodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) return;
    
    // 生成连线ID
    const linkId = `link-${sourceId}-${targetId}`;
    
    // 添加到数据
    const newLink = {
        id: linkId,
        source: sourceId,
        target: targetId,
        label: '双击编辑'
    };
    
    window.currentGraphData.links.push(newLink);
    window.userBuiltLinks.push(newLink);
    
    // 绘制连线
    drawLowScaffoldLink(newLink, sourceNode, targetNode);
    
    console.log(`创建连线: ${sourceNode.label} -> ${targetNode.label}`);
    showMessage('连线已创建，可拖拽关系词到连线上', 'success');
}

/**
 * 绘制连线
 */
function drawLowScaffoldLink(link, sourceNode, targetNode) {
    const svg = document.querySelector('.low-scaffold-svg');
    if (!svg) return;
    
    const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linkGroup.setAttribute('data-link-id', link.id);
    linkGroup.setAttribute('class', 'low-scaffold-link');
    
    // 计算连线端点
    const startX = sourceNode.x;
    const startY = sourceNode.y + sourceNode.height / 2;
    const endX = targetNode.x;
    const endY = targetNode.y - targetNode.height / 2;
    
    // 连线
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', startX);
    line.setAttribute('y1', startY);
    line.setAttribute('x2', endX);
    line.setAttribute('y2', endY);
    line.setAttribute('stroke', '#aaa');
    line.setAttribute('stroke-width', '2');
    
    // 箭头
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 10;
    const arrowWidth = 6;
    const arrowX = endX;
    const arrowY = endY;
    
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const arrowAngle1 = angle + Math.PI / 6;
    const arrowAngle2 = angle - Math.PI / 6;
    const arrowPath = `M ${arrowX} ${arrowY} 
                       L ${arrowX - arrowLength * Math.cos(arrowAngle1)} ${arrowY - arrowLength * Math.sin(arrowAngle1)} 
                       L ${arrowX - arrowLength * Math.cos(arrowAngle2)} ${arrowY - arrowLength * Math.sin(arrowAngle2)} Z`;
    arrow.setAttribute('d', arrowPath);
    arrow.setAttribute('fill', '#aaa');
    
    // 连线标签
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', midX);
    labelText.setAttribute('y', midY - 5);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('font-size', '12');
    labelText.setAttribute('fill', '#666');
    labelText.setAttribute('class', 'link-label');
    labelText.textContent = link.label;
    
    linkGroup.appendChild(line);
    linkGroup.appendChild(arrow);
    linkGroup.appendChild(labelText);
    
    // 插入到节点之前（确保连线在节点下层）
    const firstNode = svg.querySelector('.low-scaffold-node');
    if (firstNode) {
        svg.insertBefore(linkGroup, firstNode);
    } else {
        svg.appendChild(linkGroup);
    }
    
    // 绑定连线事件
    bindLowScaffoldLinkEvents(linkGroup, link);
}

/**
 * 绑定连线事件
 */
function bindLowScaffoldLinkEvents(linkGroup, link) {
    // 允许关系词拖放到连线上
    linkGroup.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const line = linkGroup.querySelector('line');
        if (line) {
            line.setAttribute('stroke', '#28a745');
            line.setAttribute('stroke-width', '3');
        }
    });
    
    linkGroup.addEventListener('dragleave', function() {
        const line = linkGroup.querySelector('line');
        if (line) {
            line.setAttribute('stroke', '#aaa');
            line.setAttribute('stroke-width', '2');
        }
    });
    
    linkGroup.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const line = linkGroup.querySelector('line');
        if (line) {
            line.setAttribute('stroke', '#aaa');
            line.setAttribute('stroke-width', '2');
        }
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'relation') {
                // 更新连线标签
                link.label = data.label;
                const labelText = linkGroup.querySelector('.link-label');
                if (labelText) {
                    labelText.textContent = data.label;
                }
                
                // 标记关系词为已使用
                markRelationAsUsed(data.id);
                
                showMessage(`已将关系词"${data.label}"添加到连线`, 'success');
            }
        } catch (err) {
            console.error('关系词拖放处理失败:', err);
        }
    });
    
    // 双击编辑标签
    linkGroup.addEventListener('dblclick', function() {
        const newLabel = prompt('请输入连接词:', link.label);
        if (newLabel && newLabel.trim()) {
            link.label = newLabel.trim();
            const labelText = linkGroup.querySelector('.link-label');
            if (labelText) {
                labelText.textContent = newLabel.trim();
            }
        }
    });
}

/**
 * 更新与节点连接的所有连线
 */
function updateLowScaffoldLinks(nodeId) {
    const svg = document.querySelector('.low-scaffold-svg');
    if (!svg) return;
    
    window.currentGraphData.links.forEach(link => {
        if (link.source === nodeId || link.target === nodeId) {
            const sourceNode = window.currentGraphData.nodes.find(n => n.id === link.source);
            const targetNode = window.currentGraphData.nodes.find(n => n.id === link.target);
            if (!sourceNode || !targetNode) return;
            
            const linkGroup = svg.querySelector(`g[data-link-id="${link.id}"]`);
            if (!linkGroup) return;
            
            const startX = sourceNode.x;
            const startY = sourceNode.y + sourceNode.height / 2;
            const endX = targetNode.x;
            const endY = targetNode.y - targetNode.height / 2;
            
            // 更新连线
            const line = linkGroup.querySelector('line');
            if (line) {
                line.setAttribute('x1', startX);
                line.setAttribute('y1', startY);
                line.setAttribute('x2', endX);
                line.setAttribute('y2', endY);
            }
            
            // 更新箭头
            const angle = Math.atan2(endY - startY, endX - startX);
            const arrowLength = 10;
            const arrow = linkGroup.querySelector('path');
            if (arrow) {
                const arrowAngle1 = angle + Math.PI / 6;
                const arrowAngle2 = angle - Math.PI / 6;
                const arrowPath = `M ${endX} ${endY} 
                                   L ${endX - arrowLength * Math.cos(arrowAngle1)} ${endY - arrowLength * Math.sin(arrowAngle1)} 
                                   L ${endX - arrowLength * Math.cos(arrowAngle2)} ${endY - arrowLength * Math.sin(arrowAngle2)} Z`;
                arrow.setAttribute('d', arrowPath);
            }
            
            // 更新标签位置
            const labelText = linkGroup.querySelector('.link-label');
            if (labelText) {
                labelText.setAttribute('x', (startX + endX) / 2);
                labelText.setAttribute('y', (startY + endY) / 2 - 5);
            }
        }
    });
}

/**
 * 标记概念为已使用
 */
function markConceptAsUsed(conceptId) {
    const conceptItem = document.querySelector(`.low-scaffold-concept-item[data-concept-id="${conceptId}"]`);
    if (conceptItem) {
        conceptItem.classList.add('used');
        conceptItem.style.background = '#adb5bd';
        conceptItem.style.cursor = 'default';
        conceptItem.draggable = false;
    }
    
    // 更新数据
    const concept = window.lowScaffoldConcepts?.find(c => c.id === conceptId);
    if (concept) {
        concept.used = true;
    }
}

/**
 * 标记关系词为已使用
 */
function markRelationAsUsed(relationId) {
    const relationItem = document.querySelector(`.low-scaffold-relation-item[data-relation-id="${relationId}"]`);
    if (relationItem) {
        relationItem.classList.add('used');
        relationItem.style.background = '#adb5bd';
        relationItem.style.cursor = 'default';
        // 关系词可以重复使用，所以不禁用拖拽
    }
}

/**
 * 从完整概念图中移除部分节点，用于支架模式
 * @param {Object} fullGraphData - 完整的概念图数据
 * @returns {Object} { incompleteGraph, candidateNodes }
 */
function removeNodesForScaffold(fullGraphData) {
    const nodes = [...fullGraphData.nodes];
    const links = [...fullGraphData.links];
    
    // 计算要移除的节点数量（移除约30-40%的节点）
    const removeCount = Math.max(1, Math.floor(nodes.length * 0.35));
    
    // 优先移除中间层级的节点（L2、L3），保留L1和部分L2
    const nodesByLayer = {};
    nodes.forEach(node => {
        const layer = node.layer || 1;
        if (!nodesByLayer[layer]) {
            nodesByLayer[layer] = [];
        }
        nodesByLayer[layer].push(node);
    });
    
    // 选择要移除的节点
    const nodesToRemove = [];
    const nodeIdsToRemove = new Set();
    
    // 优先从L2和L3层选择节点
    const layers = Object.keys(nodesByLayer).map(Number).sort((a, b) => a - b);
    let remainingCount = removeCount;
    
    for (const layer of layers) {
        if (layer === 1) continue; // 保留L1层节点
        
        const layerNodes = nodesByLayer[layer];
        const takeCount = Math.min(remainingCount, Math.floor(layerNodes.length * 0.5));
        
        // 随机选择节点
        const shuffled = [...layerNodes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < takeCount && i < shuffled.length; i++) {
            nodesToRemove.push(shuffled[i]);
            nodeIdsToRemove.add(shuffled[i].id);
            remainingCount--;
        }
        
        if (remainingCount <= 0) break;
    }
    
    // 如果还需要移除更多节点，从L2层继续
    if (remainingCount > 0 && nodesByLayer[2]) {
        const layer2Nodes = nodesByLayer[2].filter(n => !nodeIdsToRemove.has(n.id));
        const shuffled = [...layer2Nodes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < remainingCount && i < shuffled.length; i++) {
            nodesToRemove.push(shuffled[i]);
            nodeIdsToRemove.add(shuffled[i].id);
        }
    }
    
    // 🔴 不移除节点，而是保留所有节点，但标记待填入的节点
    // 所有节点都保留，保持原有结构
    const incompleteNodes = nodes.map(node => {
        if (nodeIdsToRemove.has(node.id)) {
            // 标记为待填入状态
            const placeholderNode = {
                ...node,
                isPlaceholder: true, // 标记为占位符节点
                placeholderLabel: node.label // 保存原始标签
            };
            console.log(`标记节点 ${node.id} 为待填入状态，原始标签: ${node.label}`);
            return placeholderNode;
        }
        return node;
    });
    
    // 验证：检查标记的待填入节点数量
    const markedPlaceholderCount = incompleteNodes.filter(n => n.isPlaceholder === true).length;
    console.log(`removeNodesForScaffold: 标记了 ${markedPlaceholderCount} 个待填入节点，期望 ${nodeIdsToRemove.size} 个`);
    if (markedPlaceholderCount !== nodeIdsToRemove.size) {
        console.warn(`警告：待填入节点标记数量不匹配！期望 ${nodeIdsToRemove.size} 个，实际 ${markedPlaceholderCount} 个`);
    }
    
    // 保留所有连线，不需要标记sourceRemoved和targetRemoved
    const incompleteLinks = links.map(link => ({ ...link }));
    
    const incompleteGraph = {
        nodes: incompleteNodes,
        links: incompleteLinks
    };
    
    // 保存待填入节点的信息（用于显示虚线框）
    const removedNodePlaceholders = nodesToRemove.map(node => {
        // 从完整概念图中获取节点的位置和尺寸信息（布局后的位置）
        const fullNode = fullGraphData.nodes.find(n => n.id === node.id);
        if (!fullNode) {
            console.warn('在完整概念图中找不到节点:', node.id);
        }
        
        // 计算节点尺寸（如果不存在则使用默认值）
        const nodeDimensions = window.calculateNodeDimensions ? 
            window.calculateNodeDimensions(fullNode?.label || node.label || '', 70, 35, 14) : 
            { width: 100, height: 50 };
        
        return {
            id: node.id,
            x: fullNode?.x || 0,
            y: fullNode?.y || 0,
            width: fullNode?.width || nodeDimensions.width,
            height: fullNode?.height || nodeDimensions.height,
            label: node.label || fullNode?.label || ''
        };
    });
    
    console.log(`待完成概念图: ${incompleteNodes.length} 个节点, ${incompleteLinks.length} 条连接`);
    console.log(`创建了 ${removedNodePlaceholders.length} 个虚线框占位符`);
    
    // 待选节点（移除的节点），保留位置信息
    const candidateNodes = nodesToRemove.map(node => ({
        id: node.id,
        label: node.label,
        layer: node.layer,
        type: node.type,
        description: node.description,
        importance: node.importance,
        x: node.x, // 保留原始位置
        y: node.y,
        width: node.width,
        height: node.height
    }));
    
    console.log(`移除了 ${candidateNodes.length} 个节点到待选概念区`);
    console.log('待选节点:', candidateNodes.map(n => n.label));
    
    return { incompleteGraph, candidateNodes, removedNodePlaceholders };
}

/**
 * 设置支架模式的布局（左右分栏）
 */
function setupScaffoldLayout() {
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (!conceptMapDisplay) return;
    
    // 创建左右分栏布局
    let scaffoldContainer = conceptMapDisplay.querySelector('.scaffold-container');
    if (!scaffoldContainer) {
        scaffoldContainer = document.createElement('div');
        scaffoldContainer.className = 'scaffold-container';
        scaffoldContainer.style.cssText = 'display: flex; width: 100%; height: 100%; min-height: 900px; gap: 20px;';
        
        // 清空原有内容
        conceptMapDisplay.innerHTML = '';
        conceptMapDisplay.appendChild(scaffoldContainer);
    }
    
    // 左侧：待选概念区
    let candidateArea = scaffoldContainer.querySelector('.candidate-nodes-area');
    if (!candidateArea) {
        candidateArea = document.createElement('div');
        candidateArea.className = 'candidate-nodes-area';
        candidateArea.style.cssText = `
            width: 300px;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e9ecef;
            overflow-y: auto;
            max-height: 800px;
        `;
        candidateArea.innerHTML = `
            <h4 style="margin-bottom: 15px; color: #2c3e50;">待选概念</h4>
            <div class="candidate-nodes-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
            <button id="showExpertMapBtn" class="btn btn-secondary" style="width: 100%; margin-top: 20px;">
                📊 展示专家图
            </button>
        `;
        scaffoldContainer.appendChild(candidateArea);
    }
    
    // 右侧：待完成的概念图
    let graphArea = scaffoldContainer.querySelector('.scaffold-graph-area');
    if (!graphArea) {
        graphArea = document.createElement('div');
        graphArea.className = 'scaffold-graph-area';
        graphArea.style.cssText = `
            flex: 1;
            background: white;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            position: relative;
            overflow: auto;
            min-height: 900px;
        `;
        graphArea.innerHTML = `
            <svg width="100%" height="100%" class="scaffold-concept-graph" viewBox="0 0 2400 1600" style="min-height: 900px;">
            </svg>
        `;
        scaffoldContainer.appendChild(graphArea);
    }
    
    // 专家图展示区域（初始隐藏）
    let expertMapArea = conceptMapDisplay.querySelector('.expert-map-area');
    if (!expertMapArea) {
        expertMapArea = document.createElement('div');
        expertMapArea.className = 'expert-map-area';
        expertMapArea.style.cssText = `
            width: 100%;
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            padding: 15px;
            display: none;
        `;
        expertMapArea.innerHTML = `
            <h4 style="margin-bottom: 15px; color: #2c3e50;">专家图（完整概念图）</h4>
            <svg width="100%" height="100%" class="expert-concept-graph" viewBox="0 0 2400 1200" style="min-height: 600px;">
            </svg>
        `;
        conceptMapDisplay.appendChild(expertMapArea);
    }
    
    // 绑定展示专家图按钮事件
    const showExpertBtn = candidateArea.querySelector('#showExpertMapBtn');
    if (showExpertBtn && !showExpertBtn.dataset.bound) {
        showExpertBtn.dataset.bound = 'true';
        showExpertBtn.addEventListener('click', function() {
            const isVisible = expertMapArea.style.display !== 'none';
            if (isVisible) {
                expertMapArea.style.display = 'none';
                this.textContent = '📊 展示专家图';
            } else {
                expertMapArea.style.display = 'block';
                this.textContent = '📊 隐藏专家图';
                // 如果专家图还没有渲染，则渲染它
                if (!expertMapArea.querySelector('.expert-concept-graph g[data-rendered="true"]')) {
                    displayExpertConceptMap(window.expertConceptMapData);
                }
            }
        });
    }
    
    // 显示导出支架图按钮
    const exportScaffoldBtn = document.getElementById('exportScaffoldBtn');
    if (exportScaffoldBtn) {
        exportScaffoldBtn.style.display = 'inline-block';
    }
    
    // 修改"下载图片"按钮为"导出专家图"（仅在支架模式下）
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.dataset.originalText = downloadBtn.textContent;
        downloadBtn.innerHTML = '📊 导出专家图';
        downloadBtn.dataset.scaffoldMode = 'true';
    }
}

/**
 * 导出支架概念图（包含待完成的概念图和待选概念）
 */
function exportScaffoldConceptMap() {
    console.log('开始导出支架概念图...');
    
    // 检查是否在支架模式
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (!conceptMapDisplay || !conceptMapDisplay.classList.contains('scaffold-mode')) {
        showMessage('请先生成支架概念图', 'warning');
        return;
    }
    
    // 获取支架概念图 SVG
    const scaffoldSvg = document.querySelector('.scaffold-concept-graph');
    if (!scaffoldSvg) {
        showMessage('找不到支架概念图', 'error');
        return;
    }
    
    // 获取待选概念
    const candidateNodes = window.scaffoldCandidateNodes || [];
    if (candidateNodes.length === 0) {
        showMessage('没有待选概念', 'warning');
    }
    
    showMessage('正在生成支架概念图，请稍候...', 'info');
    
    try {
        // 克隆 SVG
        const clonedSvg = scaffoldSvg.cloneNode(true);
        
        // 获取 SVG 尺寸和 viewBox
        const viewBox = scaffoldSvg.getAttribute('viewBox') || '0 0 2400 1600';
        const viewBoxParts = viewBox.split(' ').map(Number);
        const viewBoxX = viewBoxParts[0] || 0;
        const viewBoxY = viewBoxParts[1] || 0;
        const svgWidth = viewBoxParts[2] || 2400;
        const svgHeight = viewBoxParts[3] || 1600;
        
        // 按层级对待选概念进行分组
        const nodesByLayer = {};
        candidateNodes.forEach(node => {
            const layer = node.layer || 2; // 默认层级为2
            if (!nodesByLayer[layer]) {
                nodesByLayer[layer] = [];
            }
            nodesByLayer[layer].push(node);
        });
        
        // 获取所有层级并排序
        const layers = Object.keys(nodesByLayer).map(Number).sort((a, b) => a - b);
        
        // 计算待选概念区域的尺寸
        const nodeWidth = 130;
        const nodeHeight = 45;
        const nodeGap = 25;
        const layerGap = 20; // 层级之间的垂直间距
        const labelWidth = 80; // 层级标签宽度
        
        // 计算总高度
        let candidateAreaHeight = 70; // 标题和分隔线的高度
        layers.forEach(layer => {
            const nodesInLayer = nodesByLayer[layer].length;
            const rowsInLayer = 1; // 每层一行
            candidateAreaHeight += rowsInLayer * (nodeHeight + layerGap);
        });
        candidateAreaHeight += 30; // 底部边距
        
        // 创建新的 SVG，包含概念图和待选概念
        const totalHeight = svgHeight + candidateAreaHeight;
        
        // 设置克隆 SVG 的属性
        clonedSvg.setAttribute('width', svgWidth);
        clonedSvg.setAttribute('height', totalHeight);
        clonedSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${svgWidth} ${totalHeight}`);
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        // 添加白色背景
        const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        backgroundRect.setAttribute('x', viewBoxX);
        backgroundRect.setAttribute('y', viewBoxY);
        backgroundRect.setAttribute('width', svgWidth);
        backgroundRect.setAttribute('height', totalHeight);
        backgroundRect.setAttribute('fill', 'white');
        clonedSvg.insertBefore(backgroundRect, clonedSvg.firstChild);
        
        // 创建待选概念区域的分组
        const candidateGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        candidateGroup.setAttribute('transform', `translate(${viewBoxX}, ${viewBoxY + svgHeight})`);
        
        // 添加分隔线（居中）
        const lineMargin = 100;
        const separatorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        separatorLine.setAttribute('x1', lineMargin);
        separatorLine.setAttribute('y1', '15');
        separatorLine.setAttribute('x2', svgWidth - lineMargin);
        separatorLine.setAttribute('y2', '15');
        separatorLine.setAttribute('stroke', '#667eea');
        separatorLine.setAttribute('stroke-width', '2');
        separatorLine.setAttribute('stroke-dasharray', '10,5');
        candidateGroup.appendChild(separatorLine);
        
        // 添加标题（居中）
        const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleText.setAttribute('x', svgWidth / 2);
        titleText.setAttribute('y', '50');
        titleText.setAttribute('text-anchor', 'middle');
        titleText.setAttribute('font-size', '24');
        titleText.setAttribute('font-weight', 'bold');
        titleText.setAttribute('fill', '#2c3e50');
        titleText.textContent = '待选概念';
        candidateGroup.appendChild(titleText);
        
        // 按层级绘制待选概念节点
        let currentY = 70;
        
        layers.forEach(layer => {
            const nodesInLayer = nodesByLayer[layer];
            
            // 计算该层节点的总宽度，用于居中
            const totalNodesWidth = nodesInLayer.length * nodeWidth + (nodesInLayer.length - 1) * nodeGap;
            const layerStartX = (svgWidth - totalNodesWidth - labelWidth) / 2;
            
            // 绘制层级标签
            const layerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            layerLabel.setAttribute('x', layerStartX);
            layerLabel.setAttribute('y', currentY + nodeHeight / 2);
            layerLabel.setAttribute('text-anchor', 'end');
            layerLabel.setAttribute('dominant-baseline', 'middle');
            layerLabel.setAttribute('font-size', '16');
            layerLabel.setAttribute('font-weight', 'bold');
            layerLabel.setAttribute('fill', '#667eea');
            layerLabel.textContent = `L${layer}:`;
            candidateGroup.appendChild(layerLabel);
            
            // 绘制该层的节点（居中排列）
            nodesInLayer.forEach((node, index) => {
                const x = layerStartX + labelWidth / 2 + index * (nodeWidth + nodeGap);
                const y = currentY;
                
                // 创建节点组
                const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);
                
                // 创建节点背景
                const nodeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                nodeRect.setAttribute('width', nodeWidth);
                nodeRect.setAttribute('height', nodeHeight);
                nodeRect.setAttribute('rx', '8');
                nodeRect.setAttribute('fill', '#667eea');
                nodeRect.setAttribute('stroke', '#5a6fd6');
                nodeRect.setAttribute('stroke-width', '2');
                nodeGroup.appendChild(nodeRect);
                
                // 创建节点文字
                const nodeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                nodeText.setAttribute('x', nodeWidth / 2);
                nodeText.setAttribute('y', nodeHeight / 2);
                nodeText.setAttribute('text-anchor', 'middle');
                nodeText.setAttribute('dominant-baseline', 'middle');
                nodeText.setAttribute('font-size', '14');
                nodeText.setAttribute('fill', 'white');
                nodeText.setAttribute('font-weight', '500');
                // 如果文字太长，截断并添加省略号
                let label = node.label || node.id || '';
                if (label.length > 10) {
                    label = label.substring(0, 9) + '...';
                }
                nodeText.textContent = label;
                nodeGroup.appendChild(nodeText);
                
                candidateGroup.appendChild(nodeGroup);
            });
            
            currentY += nodeHeight + layerGap;
        });
        
        clonedSvg.appendChild(candidateGroup);
        
        // 将 SVG 转换为字符串
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        
        // 创建 Image 对象
        const img = new Image();
        img.onload = function() {
            // 创建 Canvas
            const canvas = document.createElement('canvas');
            const scale = 2; // 高清输出
            canvas.width = svgWidth * scale;
            canvas.height = totalHeight * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, svgWidth, totalHeight);
            ctx.drawImage(img, 0, 0, svgWidth, totalHeight);
            
            // 导出为 PNG
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                // 从焦点问题中提取实际内容（去掉"焦点问题："前缀）
                let focusQuestionText = window.focusQuestion || '';
                const prefixes = ['焦点问题：', '焦点问题:', 'Focus Question: ', 'Focus Question:'];
                for (const prefix of prefixes) {
                    if (focusQuestionText.startsWith(prefix)) {
                        focusQuestionText = focusQuestionText.substring(prefix.length).trim();
                        break;
                    }
                }
                // 清理文件名中不允许的字符
                focusQuestionText = focusQuestionText.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
                link.download = `支架概念图-${focusQuestionText || '未命名'}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                showMessage('支架概念图导出成功！', 'success');
            }, 'image/png');
        };
        
        img.onerror = function() {
            console.error('图片加载失败');
            showMessage('导出失败，请重试', 'error');
        };
        
        // 加载 SVG 数据
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        img.src = svgUrl;
        
    } catch (error) {
        console.error('导出支架概念图失败:', error);
        showMessage('导出失败: ' + error.message, 'error');
    }
}

/**
 * 导出专家图（完整的概念图）
 */
function exportExpertConceptMap() {
    console.log('开始导出专家图...');
    
    // 检查是否有专家图数据
    const expertData = window.expertConceptMapData;
    if (!expertData || !expertData.nodes || expertData.nodes.length === 0) {
        showMessage('没有可导出的专家图数据', 'warning');
        return;
    }
    
    showMessage('正在生成专家图，请稍候...', 'info');
    
    try {
        // 检查专家图是否已经渲染到页面上
        let expertSvg = document.querySelector('.expert-concept-graph');
        const expertMapArea = document.querySelector('.expert-map-area');
        
        // 如果专家图区域存在但未显示，或者 SVG 为空，先渲染专家图
        if (!expertSvg || expertSvg.children.length === 0 || 
            (expertMapArea && expertMapArea.style.display === 'none')) {
            console.log('专家图未渲染，先进行渲染...');
            
            // 临时显示专家图区域
            const wasHidden = expertMapArea && expertMapArea.style.display === 'none';
            if (wasHidden) {
                expertMapArea.style.display = 'block';
            }
            
            // 渲染专家图
            displayExpertConceptMap(expertData);
            
            // 获取渲染后的 SVG
            expertSvg = document.querySelector('.expert-concept-graph');
            
            // 等待渲染完成后导出
            setTimeout(() => {
                doExportExpertSvg(expertSvg, wasHidden, expertMapArea);
            }, 500);
        } else {
            // 直接导出已渲染的专家图
            doExportExpertSvg(expertSvg, false, expertMapArea);
        }
        
    } catch (error) {
        console.error('导出专家图失败:', error);
        showMessage('导出失败: ' + error.message, 'error');
    }
}

/**
 * 执行专家图 SVG 导出
 */
function doExportExpertSvg(expertSvg, wasHidden, expertMapArea) {
    if (!expertSvg) {
        showMessage('找不到专家图 SVG', 'error');
        return;
    }
    
    try {
        // 克隆 SVG
        const clonedSvg = expertSvg.cloneNode(true);
        
        // 获取 viewBox
        const viewBox = expertSvg.getAttribute('viewBox') || '0 0 2400 1200';
        const viewBoxParts = viewBox.split(' ').map(Number);
        const svgWidth = viewBoxParts[2] || 2400;
        const svgHeight = viewBoxParts[3] || 1200;
        
        // 设置 SVG 属性
        clonedSvg.setAttribute('width', svgWidth);
        clonedSvg.setAttribute('height', svgHeight);
        clonedSvg.setAttribute('viewBox', viewBox);
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        // 添加白色背景（插入到最前面）
        const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        backgroundRect.setAttribute('x', viewBoxParts[0] || 0);
        backgroundRect.setAttribute('y', viewBoxParts[1] || 0);
        backgroundRect.setAttribute('width', svgWidth);
        backgroundRect.setAttribute('height', svgHeight);
        backgroundRect.setAttribute('fill', 'white');
        clonedSvg.insertBefore(backgroundRect, clonedSvg.firstChild);
        
        // 将 SVG 转换为字符串
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        
        // 创建 Image 对象
        const img = new Image();
        img.onload = function() {
            // 创建 Canvas
            const canvas = document.createElement('canvas');
            const scale = 2; // 高清输出
            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, svgWidth, svgHeight);
            ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
            
            // 导出为 PNG
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                
                // 从焦点问题中提取文件名
                let focusQuestionText = window.focusQuestion || '';
                const prefixes = ['焦点问题：', '焦点问题:', 'Focus Question: ', 'Focus Question:'];
                for (const prefix of prefixes) {
                    if (focusQuestionText.startsWith(prefix)) {
                        focusQuestionText = focusQuestionText.substring(prefix.length).trim();
                        break;
                    }
                }
                focusQuestionText = focusQuestionText.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
                
                link.download = `专家图-${focusQuestionText || '未命名'}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                
                // 如果之前是隐藏的，恢复隐藏状态
                if (wasHidden && expertMapArea) {
                    expertMapArea.style.display = 'none';
                }
                
                showMessage('专家图导出成功！', 'success');
            }, 'image/png');
        };
        
        img.onerror = function() {
            console.error('图片加载失败');
            // 如果之前是隐藏的，恢复隐藏状态
            if (wasHidden && expertMapArea) {
                expertMapArea.style.display = 'none';
            }
            showMessage('导出失败，请重试', 'error');
        };
        
        // 加载 SVG 数据
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        img.src = svgUrl;
        
    } catch (error) {
        console.error('导出专家图失败:', error);
        showMessage('导出失败: ' + error.message, 'error');
    }
}

/**
 * 显示待完成的概念图（右侧）
 */
function displayIncompleteConceptMap(graphData) {
    const svg = document.querySelector('.scaffold-concept-graph');
    if (!svg) {
        console.error('找不到.scaffold-concept-graph SVG元素');
        return;
    }
    
    // 清空SVG
    svg.innerHTML = '';
    
    // 设置currentGraphData
    window.currentGraphData = graphData;
    
        // 使用drawGraph函数直接渲染到指定的SVG
        if (window.drawGraph) {
            // 检查待填入节点的数量
            const placeholderCount = graphData.nodes.filter(n => n.isPlaceholder === true).length;
            console.log(`displayIncompleteConceptMap: 准备渲染 ${graphData.nodes.length} 个节点，其中 ${placeholderCount} 个是待填入节点`);
            if (placeholderCount > 0) {
                console.log('待填入节点列表:', graphData.nodes.filter(n => n.isPlaceholder === true).map(n => ({ id: n.id, label: n.label || n.placeholderLabel })));
            }
            
            // 临时将SVG添加到concept-graph类，以便drawGraph能找到它
            const originalClass = svg.className.baseVal;
            svg.classList.add('concept-graph');
            
            // 调用drawGraph渲染
            window.drawGraph(graphData);
            
            // 恢复原始类名（保留scaffold-concept-graph）
            svg.className.baseVal = originalClass;
            
            // 验证：检查渲染后SVG中是否有待填入节点
            setTimeout(() => {
                const renderedPlaceholders = svg.querySelectorAll('[data-node-id]');
                console.log(`渲染后SVG中有 ${renderedPlaceholders.length} 个节点元素`);
                
                // 检查是否有虚线框（stroke-dasharray属性）
                const dashedRects = svg.querySelectorAll('rect[stroke-dasharray]');
                console.log(`渲染后SVG中有 ${dashedRects.length} 个虚线框`);
                
                if (placeholderCount > 0 && dashedRects.length === 0) {
                    console.error('错误：应该有待填入节点，但没有渲染虚线框！');
                    console.log('待填入节点数据:', graphData.nodes.filter(n => n.isPlaceholder === true));
                }
            }, 100);
            
            // 🔴 不再需要单独绘制占位符虚线框，因为节点本身已经标记为待填入状态
            // 占位符已经作为节点的一部分在drawGraph中绘制了
        } else {
            console.error('drawGraph函数不存在');
        }
    
    // 调整viewBox以居中节点（调用已有逻辑，需要在显示焦点问题之前）
    if (typeof window.adjustViewBox === 'function' && graphData.nodes) {
        // 获取SVG容器的实际尺寸
        const svgRect = svg.getBoundingClientRect();
        const containerWidth = svgRect.width || 2400;
        const containerHeight = svgRect.height || 1200;
        window.adjustViewBox(graphData.nodes, containerWidth, containerHeight);
    }
    
    // 显示焦点问题（调用已有逻辑，在viewBox调整之后）
    // 确保布局算法已经设置了focusQuestionY和focusQuestionHeight
    // 如果布局算法没有设置，使用默认值
    if (window.focusQuestionY === undefined) {
        window.focusQuestionY = 5;
        console.log('布局算法未设置focusQuestionY，使用默认值5');
    }
    if (window.focusQuestionHeight === undefined) {
        window.focusQuestionHeight = 60;
        console.log('布局算法未设置focusQuestionHeight，使用默认值60');
    }
    
    // 使用setTimeout确保SVG已经渲染完成
    setTimeout(() => {
        if (typeof window.displayFocusQuestion === 'function' && window.focusQuestion) {
            console.log('显示焦点问题:', window.focusQuestion);
            console.log('焦点问题Y坐标:', window.focusQuestionY);
            console.log('焦点问题高度:', window.focusQuestionHeight);
            console.log('SVG元素:', svg);
            console.log('SVG类名:', svg.className);
            window.displayFocusQuestion();
        } else {
            console.warn('无法显示焦点问题:', {
                hasFunction: typeof window.displayFocusQuestion === 'function',
                hasFocusQuestion: !!window.focusQuestion,
                focusQuestion: window.focusQuestion
            });
        }
    }, 200);
    
    // 启用画布缩放（鼠标滚轮）
    if (typeof window.enableCanvasZoom === 'function') {
        window.enableCanvasZoom();
    }
    
    // 重新设置拖放区域
    setupGraphDropZone();
}

/**
 * 设置概念图为拖放目标区域
 */
/**
 * 检测鼠标位置下的待选框节点
 * @param {MouseEvent} e - 鼠标事件
 * @param {SVGElement} svg - SVG元素
 * @returns {Object|null} 找到的待选框节点信息 {nodeElement, nodeData} 或 null
 */
function findPlaceholderNodeAtPosition(e, svg) {
    if (!svg || !window.currentGraphData) return null;
    
    // 计算在SVG中的坐标
    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.getAttribute('viewBox') || '0 0 2400 1200';
    const viewBoxParts = viewBox.split(' ').map(Number);
    const viewBoxX = viewBoxParts[0];
    const viewBoxY = viewBoxParts[1];
    const viewBoxWidth = viewBoxParts[2];
    const viewBoxHeight = viewBoxParts[3];
    
    // 将鼠标坐标转换为SVG坐标
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    const svgX = viewBoxX + (mouseX / svgRect.width) * viewBoxWidth;
    const svgY = viewBoxY + (mouseY / svgRect.height) * viewBoxHeight;
    
    // 查找所有待填入节点
    const placeholderNodes = window.currentGraphData.nodes.filter(n => n.isPlaceholder === true);
    
    // 检查鼠标位置是否在某个待选框内
    for (const nodeData of placeholderNodes) {
        if (nodeData.x === undefined || nodeData.y === undefined) continue;
        
        // 计算节点尺寸
        const nodeLabel = '待填入';
        const nodeDimensions = window.calculateNodeDimensions ? 
            window.calculateNodeDimensions(nodeLabel, 90, 45, 20) : 
            { width: 90, height: 45 };
        const nodeWidth = nodeData.width || nodeDimensions.width;
        const nodeHeight = nodeData.height || nodeDimensions.height;
        
        // 计算节点的边界
        const nodeLeft = nodeData.x - nodeWidth / 2;
        const nodeRight = nodeData.x + nodeWidth / 2;
        const nodeTop = nodeData.y - nodeHeight / 2;
        const nodeBottom = nodeData.y + nodeHeight / 2;
        
        // 检查鼠标位置是否在节点内
        if (svgX >= nodeLeft && svgX <= nodeRight && svgY >= nodeTop && svgY <= nodeBottom) {
            // 找到对应的SVG元素
            const nodeElement = svg.querySelector(`[data-node-id="${nodeData.id}"]`);
            if (nodeElement) {
                return { nodeElement, nodeData };
            }
        }
    }
    
    return null;
}

/**
 * 高亮并放大待选框
 * @param {SVGElement} nodeElement - 节点SVG元素
 */
function highlightPlaceholderNode(nodeElement) {
    if (!nodeElement) return;
    
    // 移除之前的高亮
    clearPlaceholderHighlight();
    
    // 获取矩形元素
    const rect = nodeElement.querySelector('rect');
    if (!rect) return;
    
    // 保存原始属性
    const originalWidth = parseFloat(rect.getAttribute('width'));
    const originalHeight = parseFloat(rect.getAttribute('height'));
    const originalStrokeWidth = parseFloat(rect.getAttribute('stroke-width'));
    const originalOpacity = parseFloat(rect.getAttribute('opacity'));
    
    // 保存到节点元素上，以便后续恢复
    nodeElement.dataset.originalWidth = originalWidth;
    nodeElement.dataset.originalHeight = originalHeight;
    nodeElement.dataset.originalStrokeWidth = originalStrokeWidth;
    nodeElement.dataset.originalOpacity = originalOpacity;
    nodeElement.dataset.isHighlighted = 'true';
    
    // 放大节点（放大1.3倍）
    const scale = 1.3;
    const newWidth = originalWidth * scale;
    const newHeight = originalHeight * scale;
    
    // 更新矩形尺寸和位置（保持中心点不变）
    rect.setAttribute('width', newWidth);
    rect.setAttribute('height', newHeight);
    rect.setAttribute('x', -newWidth / 2);
    rect.setAttribute('y', -newHeight / 2);
    
    // 高亮样式
    rect.setAttribute('stroke', '#ff6b6b'); // 红色高亮
    rect.setAttribute('stroke-width', '3');
    rect.setAttribute('opacity', '1');
    rect.setAttribute('fill', 'rgba(255, 107, 107, 0.1)'); // 浅红色填充
    
    // 更新文字位置和大小
    const text = nodeElement.querySelector('text');
    if (text) {
        text.setAttribute('font-size', parseFloat(text.getAttribute('font-size')) * scale);
    }
}

/**
 * 清除所有待选框的高亮
 */
function clearPlaceholderHighlight() {
    const svg = document.querySelector('.scaffold-concept-graph');
    if (!svg) return;
    
    // 查找所有高亮的待选框
    const highlightedNodes = svg.querySelectorAll('[data-is-highlighted="true"]');
    highlightedNodes.forEach(nodeElement => {
        const rect = nodeElement.querySelector('rect');
        if (!rect) return;
        
        // 恢复原始属性
        const originalWidth = parseFloat(nodeElement.dataset.originalWidth);
        const originalHeight = parseFloat(nodeElement.dataset.originalHeight);
        const originalStrokeWidth = parseFloat(nodeElement.dataset.originalStrokeWidth);
        const originalOpacity = parseFloat(nodeElement.dataset.originalOpacity);
        
        // 恢复尺寸和位置
        rect.setAttribute('width', originalWidth);
        rect.setAttribute('height', originalHeight);
        rect.setAttribute('x', -originalWidth / 2);
        rect.setAttribute('y', -originalHeight / 2);
        
        // 恢复样式
        rect.setAttribute('stroke', '#667eea');
        rect.setAttribute('stroke-width', originalStrokeWidth);
        rect.setAttribute('opacity', originalOpacity);
        rect.setAttribute('fill', 'none');
        
        // 恢复文字大小
        const text = nodeElement.querySelector('text');
        if (text) {
            const originalFontSize = parseFloat(text.getAttribute('font-size')) / 1.3;
            text.setAttribute('font-size', originalFontSize);
        }
        
        // 清除标记
        delete nodeElement.dataset.isHighlighted;
        delete nodeElement.dataset.originalWidth;
        delete nodeElement.dataset.originalHeight;
        delete nodeElement.dataset.originalStrokeWidth;
        delete nodeElement.dataset.originalOpacity;
    });
}

function setupGraphDropZone() {
    const graphArea = document.querySelector('.scaffold-graph-area');
    const svg = document.querySelector('.scaffold-concept-graph');
    
    if (!graphArea || !svg) return;
    
    // 当前高亮的待选框
    let currentHighlightedPlaceholder = null;
    
    // 移除之前的事件监听器（通过重新设置）
    graphArea.ondragover = null;
    graphArea.ondrop = null;
    graphArea.ondragenter = null;
    graphArea.ondragleave = null;
    svg.ondragover = null;
    
    // 在SVG上监听拖拽事件（用于检测待选框）
    svg.ondragover = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 只有在拖拽待选概念时才检测
        if (!window.draggingNode) return;
        
        // 检测鼠标位置下的待选框
        const placeholder = findPlaceholderNodeAtPosition(e, svg);
        
        if (placeholder) {
            // 找到待选框，高亮并放大
            if (currentHighlightedPlaceholder !== placeholder.nodeElement) {
                clearPlaceholderHighlight();
                highlightPlaceholderNode(placeholder.nodeElement);
                currentHighlightedPlaceholder = placeholder.nodeElement;
                e.dataTransfer.dropEffect = 'copy'; // 显示复制效果
            }
        } else {
            // 没有找到待选框，清除高亮
            if (currentHighlightedPlaceholder) {
                clearPlaceholderHighlight();
                currentHighlightedPlaceholder = null;
            }
            e.dataTransfer.dropEffect = 'move';
        }
    };
    
    // 允许拖放
    graphArea.ondragover = function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        // 添加拖放提示样式
        graphArea.style.border = '3px dashed #667eea';
        graphArea.style.background = 'rgba(102, 126, 234, 0.05)';
    };
    
    graphArea.ondragenter = function(e) {
        e.preventDefault();
        e.stopPropagation();
        graphArea.style.border = '3px dashed #667eea';
        graphArea.style.background = 'rgba(102, 126, 234, 0.05)';
    };
    
    graphArea.ondragleave = function(e) {
        e.preventDefault();
        e.stopPropagation();
        // 只有当离开整个区域时才移除样式
        const rect = graphArea.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            graphArea.style.border = '1px solid #e9ecef';
            graphArea.style.background = 'white';
            // 清除待选框高亮
            clearPlaceholderHighlight();
            currentHighlightedPlaceholder = null;
        }
    };
    
    graphArea.ondrop = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 恢复样式
        graphArea.style.border = '1px solid #e9ecef';
        graphArea.style.background = 'white';
        
        // 清除待选框高亮
        clearPlaceholderHighlight();
        
        // 获取拖拽的节点ID
        const nodeId = e.dataTransfer.getData('text/plain');
        if (!nodeId || !window.draggingNode) {
            currentHighlightedPlaceholder = null;
            return;
        }
        
        // 计算在SVG中的坐标（无论拖放到哪里，都使用用户拖放的实际位置）
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.getAttribute('viewBox') || '0 0 2400 1200';
        const viewBoxParts = viewBox.split(' ').map(Number);
        const viewBoxX = viewBoxParts[0];
        const viewBoxY = viewBoxParts[1];
        const viewBoxWidth = viewBoxParts[2];
        const viewBoxHeight = viewBoxParts[3];
        
        // 将鼠标坐标转换为SVG坐标
        const mouseX = e.clientX - svgRect.left;
        const mouseY = e.clientY - svgRect.top;
        const svgX = viewBoxX + (mouseX / svgRect.width) * viewBoxWidth;
        const svgY = viewBoxY + (mouseY / svgRect.height) * viewBoxHeight;
        
        // 检测是否拖放到待选框上
        const placeholder = findPlaceholderNodeAtPosition(e, svg);
        
        if (placeholder) {
            // 拖放到待选框上，填入该待选框，但使用用户拖放的实际位置
            console.log('拖放到待选框:', placeholder.nodeData.id, '用户拖放位置:', svgX, svgY, '待选框位置:', placeholder.nodeData.x, placeholder.nodeData.y);
            addCandidateNodeToGraph(placeholder.nodeData.id, window.draggingNode, svgX, svgY);
            
            // 清除拖拽状态
            window.draggingNodeId = null;
            window.draggingNode = null;
            currentHighlightedPlaceholder = null;
        } else {
            // 拖放到空白区域，不添加到概念图，将概念放回待选区
            console.log('拖放到空白位置，将概念放回待选区');
            
            // 恢复待选节点的样式（如果之前有变化）
            const candidateList = document.querySelector('.candidate-nodes-list');
            const nodeItem = candidateList?.querySelector(`[data-node-id="${window.draggingNodeId}"]`);
            if (nodeItem) {
                nodeItem.style.opacity = '1';
                nodeItem.style.cursor = 'grab';
                nodeItem.style.background = 'white';
                nodeItem.style.borderColor = '#667eea';
            }
            
            // 清除拖拽状态
            window.draggingNodeId = null;
            window.draggingNode = null;
            currentHighlightedPlaceholder = null;
        }
    };
}

/**
 * 显示待选节点（左侧）
 */
function displayCandidateNodes(candidateNodes) {
    const candidateList = document.querySelector('.candidate-nodes-list');
    if (!candidateList) return;
    
    candidateList.innerHTML = '';
    
    candidateNodes.forEach(node => {
        const nodeItem = document.createElement('div');
        nodeItem.className = 'candidate-node-item';
        nodeItem.dataset.nodeId = node.id;
        nodeItem.draggable = true; // 启用拖拽
        nodeItem.style.cssText = `
            padding: 12px;
            background: white;
            border: 2px solid #667eea;
            border-radius: 6px;
            cursor: grab;
            transition: all 0.2s;
            user-select: none;
        `;
        nodeItem.innerHTML = `
            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">${node.label}</div>
            <div style="font-size: 12px; color: #6c757d;">层级: L${node.layer || 1}</div>
            <div style="font-size: 11px; color: #667eea; margin-top: 4px;">👆 拖拽到右侧概念图</div>
        `;
        
        // 拖拽开始
        nodeItem.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', node.id);
            e.dataTransfer.effectAllowed = 'move';
            this.style.opacity = '0.5';
            this.style.cursor = 'grabbing';
            
            // 创建拖拽预览
            const dragPreview = this.cloneNode(true);
            dragPreview.style.cssText = `
                position: absolute;
                top: -1000px;
                left: -1000px;
                width: ${this.offsetWidth}px;
                background: white;
                border: 2px solid #667eea;
                border-radius: 6px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(dragPreview);
            e.dataTransfer.setDragImage(dragPreview, this.offsetWidth / 2, this.offsetHeight / 2);
            
            // 标记正在拖拽的节点
            window.draggingNodeId = node.id;
            window.draggingNode = node;
        });
        
        // 拖拽结束
        nodeItem.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
            this.style.cursor = 'grab';
            
            // 清除待选框高亮
            if (typeof clearPlaceholderHighlight === 'function') {
                clearPlaceholderHighlight();
            }
            
            window.draggingNodeId = null;
            window.draggingNode = null;
            
            // 移除拖拽预览
            const dragPreview = document.querySelector('.drag-preview');
            if (dragPreview) {
                dragPreview.remove();
            }
        });
        
        // 悬停效果
        nodeItem.addEventListener('mouseenter', function() {
            if (!this.draggable || this.style.opacity !== '0.5') {
                this.style.background = '#f0f4ff';
                this.style.transform = 'translateX(5px)';
            }
        });
        nodeItem.addEventListener('mouseleave', function() {
            if (!this.draggable || this.style.opacity !== '0.5') {
                this.style.background = 'white';
                this.style.transform = 'translateX(0)';
            }
        });
        
        candidateList.appendChild(nodeItem);
    });
    
    // 设置右侧概念图为拖放目标
    setupGraphDropZone();
}

/**
 * 将待选节点添加到概念图（拖放到空白区域时使用）
 * 注意：这个函数用于拖放到空白区域，不是拖放到虚线框
 */
function addCandidateNodeToGraphAtPosition(node, x, y) {
    if (!window.currentGraphData) {
        window.currentGraphData = { nodes: [], links: [] };
    }
    
    // 🔴 保存操作前的状态（用于撤销）
    saveScaffoldUndoState('fillNodeAtPosition', {
        nodeId: node.id,
        nodeLabel: node.label,
        x: x,
        y: y
    });
    
    // 🔴 检查节点是否已存在（包括待填入状态的节点）
    const existingNodeIndex = window.currentGraphData.nodes.findIndex(n => n.id === node.id);
    if (existingNodeIndex !== -1) {
        // 如果节点存在且是待填入状态，则将其转换为正常节点
        const existingNode = window.currentGraphData.nodes[existingNodeIndex];
        if (existingNode.isPlaceholder) {
            // 将待填入节点转换为正常节点
            window.currentGraphData.nodes[existingNodeIndex] = {
                ...existingNode,
                isPlaceholder: false,
                label: node.label || existingNode.placeholderLabel || existingNode.label,
                filledWithNodeId: node.id,
                filledWithLabel: node.label,
                x: x || existingNode.x,
                y: y || existingNode.y
            };
        } else {
            showMessage('该概念已添加到概念图中', 'warning');
            return;
        }
    } else {
        // 创建节点副本并设置位置
        // 如果节点有原始位置信息，优先使用；否则使用拖放位置
        const newNode = {
            ...node,
            isPlaceholder: false, // 确保不是待填入状态
            filledWithNodeId: node.id,
            filledWithLabel: node.label,
            x: node.x || x,
            y: node.y || y
        };
        
        // 添加节点
        window.currentGraphData.nodes.push(newNode);
    }
    
    // 检查节点添加是否正确（拖放到空白区域，不检查位置）
    const isCorrect = checkNodeCorrectness(node);
    
    // 🔴 在节点数据中保存正确性状态和位置，以便重新渲染后恢复
    const addedNode = window.currentGraphData.nodes.find(n => n.id === node.id);
    if (addedNode) {
        addedNode.isCorrect = isCorrect; // 保存正确性状态
        addedNode.fixedPosition = true; // 标记为固定位置，不重新布局
        // 保存当前的位置（如果已经设置了）
        if (addedNode.x !== undefined && addedNode.y !== undefined) {
            addedNode.savedX = addedNode.x;
            addedNode.savedY = addedNode.y;
        }
        console.log(`保存节点 ${node.id} 的状态: isCorrect=${isCorrect}, 位置=(${addedNode.x}, ${addedNode.y})`);
    }
    
    // 从待选列表中移除并标记
    markCandidateNodeAsAdded(node.id, isCorrect);
    
    // 🔴 在支架模式下，只重新渲染而不重新应用布局算法，保持布局不变
    if (window.originalPlaceholderNodeIds && window.originalPlaceholderNodeIds.size > 0) {
        // 支架模式：只重新渲染，不改变布局
        redrawWithoutLayout();
    } else {
        // 非支架模式：应用布局算法并重新渲染
        applyLayoutAndRedraw();
    }
    
    // 检查是否所有节点都已添加
    checkScaffoldCompletion();
    
    // 更新正确性统计
    updateCorrectnessStats();
}

/**
 * 将待选节点添加到概念图
 * @param {string|Object} placeholderNodeIdOrNode - 待选框节点ID（如果填入待选框）或待选节点对象（点击方式）
 * @param {Object} candidateNode - 待选节点对象（如果填入待选框）
 * @param {number} dropX - 用户拖放的实际X坐标（可选）
 * @param {number} dropY - 用户拖放的实际Y坐标（可选）
 */
function addCandidateNodeToGraph(placeholderNodeIdOrNode, candidateNode, dropX = null, dropY = null) {
    if (!window.currentGraphData) {
        window.currentGraphData = { nodes: [], links: [] };
    }
    
    let placeholderNodeId = null;
    let node = null;
    
    // 判断调用方式：两个参数（填入待选框）或一个参数（点击方式）
    if (candidateNode) {
        // 两个参数：填入指定的待选框
        placeholderNodeId = placeholderNodeIdOrNode;
        node = candidateNode;
    } else {
        // 一个参数：点击方式，保持向后兼容
        node = placeholderNodeIdOrNode;
    }
    
    // 🔴 保存操作前的状态（用于撤销）
    saveScaffoldUndoState('fillNode', {
        nodeId: node.id,
        nodeLabel: node.label,
        placeholderNodeId: placeholderNodeId
    });
    
    // 🔴 修复：无论用户拖入哪个节点，都应该填入到目标虚线框的位置
    // 不要检查 node.id 是否存在于图中，而是直接操作目标虚线框
    if (placeholderNodeId) {
        // 用户将节点拖入指定的虚线框
        const placeholderIndex = window.currentGraphData.nodes.findIndex(n => n.id === placeholderNodeId && n.isPlaceholder === true);
        if (placeholderIndex !== -1) {
            const placeholderNode = window.currentGraphData.nodes[placeholderIndex];
            
            // 将虚线框替换为用户拖入的节点内容，但保持虚线框的位置
            window.currentGraphData.nodes[placeholderIndex] = {
                ...placeholderNode, // 保留虚线框的位置、尺寸、层级等
                id: placeholderNode.id, // 🔴 关键：保持虚线框的ID（用于后续判断正确性）
                isPlaceholder: false,
                label: node.label, // 使用用户拖入的节点标签
                filledWithNodeId: node.id, // 🔴 记录实际填入的节点ID（用于判断正确性）
                filledWithLabel: node.label,
                // 保持虚线框的位置不变
                x: placeholderNode.x,
                y: placeholderNode.y,
                width: placeholderNode.width,
                height: placeholderNode.height,
                layer: placeholderNode.layer
            };
            console.log(`将待选节点 "${node.label}" (ID: ${node.id}) 填入虚线框 ${placeholderNodeId}，位置保持在: (${placeholderNode.x}, ${placeholderNode.y})`);
        } else {
            console.warn(`找不到待填入的虚线框: ${placeholderNodeId}`);
            showMessage('找不到目标位置', 'warning');
            return;
        }
    } else {
        // 点击方式或拖到空白区域：检查节点是否已存在
        const existingNodeIndex = window.currentGraphData.nodes.findIndex(n => n.id === node.id);
        if (existingNodeIndex !== -1) {
            const existingNode = window.currentGraphData.nodes[existingNodeIndex];
            if (existingNode.isPlaceholder) {
                // 将对应的虚线框转换为正常节点
                window.currentGraphData.nodes[existingNodeIndex] = {
                    ...existingNode,
                    isPlaceholder: false,
                    label: node.label,
                    filledWithNodeId: node.id,
                    filledWithLabel: node.label
                };
                console.log(`点击方式：将虚线框 ${node.id} 转换为正常节点`);
            } else {
                showMessage('该概念已添加到概念图中', 'warning');
                return;
            }
        } else {
            // 节点不存在于图中，直接添加
            const newNode = {
                ...node,
                isPlaceholder: false,
                filledWithNodeId: node.id,
                filledWithLabel: node.label,
                x: node.x || undefined,
                y: node.y || undefined
            };
            window.currentGraphData.nodes.push(newNode);
            console.log(`添加新节点: ${node.id}`);
        }
    }
    
    // 检查节点添加是否正确（如果填入待选框，传递待选框ID）
    const isCorrect = placeholderNodeId ? 
        checkNodeCorrectness(node, placeholderNodeId) : 
        checkNodeCorrectness(node);
    
    // 🔴 在节点数据中保存正确性状态和位置，以便重新渲染后恢复
    // 注意：如果填入虚线框，应该找虚线框节点（通过 placeholderNodeId）
    const targetNodeId = placeholderNodeId || node.id;
    const addedNode = window.currentGraphData.nodes.find(n => n.id === targetNodeId);
    if (addedNode) {
        addedNode.isCorrect = isCorrect; // 保存正确性状态
        addedNode.fixedPosition = true; // 标记为固定位置，不重新布局
        // 保存当前的位置（如果已经设置了）
        if (addedNode.x !== undefined && addedNode.y !== undefined) {
            addedNode.savedX = addedNode.x;
            addedNode.savedY = addedNode.y;
        }
        console.log(`保存节点 ${targetNodeId} 的状态: isCorrect=${isCorrect}, 位置=(${addedNode.x}, ${addedNode.y}), 填入内容: ${node.label}`);
    }
    
    // 从待选列表中移除并标记
    markCandidateNodeAsAdded(node.id, isCorrect);
    
    // 🔴 在支架模式下，只重新渲染而不重新应用布局算法，保持布局不变
    if (window.originalPlaceholderNodeIds && window.originalPlaceholderNodeIds.size > 0) {
        // 支架模式：只重新渲染，不改变布局
        redrawWithoutLayout();
    } else {
        // 非支架模式：应用布局算法并重新渲染
        applyLayoutAndRedraw();
    }
    
    // 检查是否所有节点都已添加
    checkScaffoldCompletion();
    
    // 更新正确性统计
    updateCorrectnessStats();
}

/**
 * 标记待选节点为已添加
 * @param {string} nodeId - 节点ID
 * @param {boolean} isCorrect - 是否正确（可选，如果不提供则自动检查）
 */
function markCandidateNodeAsAdded(nodeId, isCorrect = null) {
    const candidateList = document.querySelector('.candidate-nodes-list');
    const nodeItem = candidateList?.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeItem) return;
    
    // 获取节点数据
    const node = window.scaffoldCandidateNodes?.find(n => n.id === nodeId);
    if (!node) return;
    
    // 如果没有提供正确性，自动检查
    if (isCorrect === null) {
        isCorrect = checkNodeCorrectness(node);
    }
    
    // 禁用拖拽
    nodeItem.draggable = false;
    nodeItem.style.cursor = 'default';
    
    if (isCorrect) {
        nodeItem.style.background = '#d4edda';
        nodeItem.style.borderColor = '#28a745';
        nodeItem.innerHTML = `
            <div style="font-weight: 600; color: #155724; margin-bottom: 4px;">${node.label} ✓</div>
            <div style="font-size: 12px; color: #6c757d;">层级: L${node.layer || 1}</div>
            <div style="font-size: 11px; color: #28a745; margin-top: 4px;">✓ 正确</div>
        `;
    } else {
        nodeItem.style.background = '#f8d7da';
        nodeItem.style.borderColor = '#dc3545';
        nodeItem.innerHTML = `
            <div style="font-weight: 600; color: #721c24; margin-bottom: 4px;">${node.label} ✗</div>
            <div style="font-size: 12px; color: #6c757d;">层级: L${node.layer || 1}</div>
            <div style="font-size: 11px; color: #dc3545; margin-top: 4px;">✗ 不正确</div>
        `;
    }
    
    nodeItem.style.pointerEvents = 'none';
}

/**
 * 应用布局算法并重新渲染
 */
function applyLayoutAndRedraw() {
    // 🔴 固定使用改进的Sugiyama算法
    const selectedLayout = 'hierarchical';
    let layoutAppliedGraph = window.currentGraphData;
    
    // 🔴 保存待填入节点的ID，以便布局后恢复isPlaceholder属性
    // 优先使用全局保存的原始待填入节点ID列表（更可靠）
    // 只有当节点还没有被用户填入时（即当前仍是 isPlaceholder），才保留其待填入状态
    let placeholderNodeIds;
    if (window.originalPlaceholderNodeIds && window.originalPlaceholderNodeIds.size > 0) {
        // 使用原始列表，但排除已经被用户填入的节点
        const filledNodeIds = new Set(
            window.currentGraphData.nodes
                .filter(node => node.isCorrect !== undefined && !node.isPlaceholder)
                .map(node => node.id)
        );
        placeholderNodeIds = new Set(
            Array.from(window.originalPlaceholderNodeIds).filter(id => !filledNodeIds.has(id))
        );
        console.log(`applyLayoutAndRedraw: 使用原始待填入节点列表，排除已填入的 ${filledNodeIds.size} 个节点后剩余 ${placeholderNodeIds.size} 个`);
    } else {
        // 如果没有原始列表，从当前数据中读取
        placeholderNodeIds = new Set(
            window.currentGraphData.nodes
                .filter(node => node.isPlaceholder === true)
                .map(node => node.id)
        );
        console.log(`applyLayoutAndRedraw: 从当前数据读取待填入节点，共 ${placeholderNodeIds.size} 个`);
    }
    
    // 🔴 保存已填入节点的状态（位置、正确性等），以便布局后恢复
    const filledNodeStates = new Map();
    window.currentGraphData.nodes.forEach(node => {
        if (node.fixedPosition && (node.savedX !== undefined || node.x !== undefined)) {
            filledNodeStates.set(node.id, {
                x: node.savedX !== undefined ? node.savedX : node.x,
                y: node.savedY !== undefined ? node.savedY : node.y,
                isCorrect: node.isCorrect,
                fixedPosition: true
            });
        } else if (node.isCorrect !== undefined) {
            // 即使没有固定位置，也保存正确性状态
            filledNodeStates.set(node.id, {
                isCorrect: node.isCorrect
            });
        }
    });
    
    // 🔴 保存所有节点的ID，确保布局算法后所有节点都存在
    const allNodeIds = new Set(window.currentGraphData.nodes.map(n => n.id));
    console.log(`applyLayoutAndRedraw: 保存了 ${placeholderNodeIds.size} 个待填入节点的ID，${filledNodeStates.size} 个已填入节点的状态，总共 ${allNodeIds.size} 个节点`);
    
    try {
        if (selectedLayout === 'hierarchical' && typeof window.applySugiyamaLayout === 'function') {
            layoutAppliedGraph = window.applySugiyamaLayout(window.currentGraphData);
        } else if (selectedLayout === 'force' && typeof window.applyForceDirectedLayout === 'function') {
            layoutAppliedGraph = window.applyForceDirectedLayout(window.currentGraphData, {
                width: 2400,
                height: 1200,
                iterations: 300,
                coolingFactor: 0.95,
                linkDistance: 100,
                nodeCharge: -300,
                nodeSpacing: 60
            });
        }
        
        // 🔴 验证布局算法返回的节点数量
        if (layoutAppliedGraph.nodes) {
            const returnedNodeIds = new Set(layoutAppliedGraph.nodes.map(n => n.id));
            const missingNodeIds = Array.from(allNodeIds).filter(id => !returnedNodeIds.has(id));
            
            if (missingNodeIds.length > 0) {
                console.error(`applyLayoutAndRedraw: 警告！布局算法丢失了 ${missingNodeIds.length} 个节点:`, missingNodeIds);
                // 恢复丢失的节点
                missingNodeIds.forEach(missingId => {
                    const originalNode = window.currentGraphData.nodes.find(n => n.id === missingId);
                    if (originalNode) {
                        console.log(`恢复丢失的节点: ${originalNode.id} (${originalNode.label})`);
                        layoutAppliedGraph.nodes.push({ ...originalNode });
                    }
                });
            }
            
            // 🔴 恢复已填入节点的位置和状态
            layoutAppliedGraph.nodes.forEach(node => {
                if (filledNodeStates.has(node.id)) {
                    const state = filledNodeStates.get(node.id);
                    if (state.x !== undefined && state.y !== undefined) {
                        // 恢复固定位置
                        node.x = state.x;
                        node.y = state.y;
                        node.savedX = state.x;
                        node.savedY = state.y;
                    }
                    // 恢复正确性状态
                    if (state.isCorrect !== undefined) {
                        node.isCorrect = state.isCorrect;
                    }
                    // 保持固定位置标记
                    if (state.fixedPosition) {
                        node.fixedPosition = true;
                    }
                }
            });
        } else {
            console.error('applyLayoutAndRedraw: 布局算法返回的数据中没有nodes数组！');
            // 如果布局算法返回的数据无效，使用原始数据
            layoutAppliedGraph = window.currentGraphData;
        }
        
        // 🔴 验证并恢复所有节点
        if (layoutAppliedGraph.nodes) {
            const finalNodeCount = layoutAppliedGraph.nodes.length;
            const originalNodeCount = window.currentGraphData.nodes.length;
            console.log(`applyLayoutAndRedraw: 布局前节点数=${originalNodeCount}，布局后节点数=${finalNodeCount}`);
            
            if (finalNodeCount < originalNodeCount) {
                console.warn(`applyLayoutAndRedraw: 警告！布局后节点数减少: ${originalNodeCount} -> ${finalNodeCount}`);
            }
        }
        
        // 🔴 恢复isPlaceholder属性（布局算法可能会丢失）
        if (layoutAppliedGraph.nodes && placeholderNodeIds.size > 0) {
            let restoredCount = 0;
            layoutAppliedGraph.nodes.forEach(node => {
                if (placeholderNodeIds.has(node.id)) {
                    // 确保 isPlaceholder 属性被设置
                    if (node.isPlaceholder !== true) {
                        node.isPlaceholder = true;
                        restoredCount++;
                        console.log(`applyLayoutAndRedraw: 恢复了节点 ${node.id} 的 isPlaceholder 属性`);
                    }
                }
            });
            console.log(`applyLayoutAndRedraw: 总共恢复了 ${restoredCount} 个节点的 isPlaceholder 属性`);
            
            // 验证：检查最终数据中待填入节点的数量
            const finalPlaceholderCount = layoutAppliedGraph.nodes.filter(n => n.isPlaceholder === true).length;
            console.log(`applyLayoutAndRedraw: 最终数据中有 ${finalPlaceholderCount} 个待填入节点，期望 ${placeholderNodeIds.size} 个`);
            
            if (finalPlaceholderCount !== placeholderNodeIds.size) {
                console.warn(`applyLayoutAndRedraw: 警告：待填入节点数量不匹配！期望 ${placeholderNodeIds.size} 个，实际 ${finalPlaceholderCount} 个`);
                // 强制恢复所有应该待填入的节点
                layoutAppliedGraph.nodes.forEach(node => {
                    if (placeholderNodeIds.has(node.id) && node.isPlaceholder !== true) {
                        console.warn(`applyLayoutAndRedraw: 强制恢复节点 ${node.id} 的 isPlaceholder 属性`);
                        node.isPlaceholder = true;
                    }
                });
            }
        }
    } catch (error) {
        console.error('布局算法应用失败:', error);
    }
    
    // 重新渲染概念图
    displayIncompleteConceptMap(layoutAppliedGraph);
    window.currentGraphData = layoutAppliedGraph;
    
    // 🔴 不再需要单独绘制占位符虚线框，因为节点本身已经标记为待填入状态
    // 占位符已经作为节点的一部分在drawGraph中绘制了
}

/**
 * 🔴 只重新渲染概念图，不重新应用布局算法
 * 用于支架模式下填入节点时，保持现有布局不变
 */
function redrawWithoutLayout() {
    console.log('redrawWithoutLayout: 只重新渲染，不改变布局');
    
    if (!window.currentGraphData || !window.currentGraphData.nodes) {
        console.warn('redrawWithoutLayout: 没有图形数据');
        return;
    }
    
    // 检查是否处于支架模式
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    const isScaffoldMode = conceptMapDisplay && conceptMapDisplay.classList.contains('scaffold-mode');
    
    if (isScaffoldMode) {
        // 支架模式：渲染到 .scaffold-concept-graph
        const svg = document.querySelector('.scaffold-concept-graph');
        if (svg && window.drawGraph) {
            // 清空 SVG
            svg.innerHTML = '';
            
            // 临时添加 concept-graph 类以便 drawGraph 能找到它
            const originalClass = svg.className.baseVal;
            svg.classList.add('concept-graph');
            
            // 重新渲染
            window.drawGraph(window.currentGraphData);
            
            // 恢复原始类名
            svg.className.baseVal = originalClass;
            
            // 🔴 重新显示焦点问题（因为 drawGraph 会清空 SVG）
            if (typeof window.displayFocusQuestion === 'function' && window.focusQuestion) {
                window.displayFocusQuestion();
                console.log('redrawWithoutLayout: 已重新显示焦点问题');
            }
            
            console.log('redrawWithoutLayout: 支架模式渲染完成');
        }
    } else {
        // 非支架模式：渲染到 .concept-graph
        if (window.drawGraph) {
            window.drawGraph(window.currentGraphData);
            console.log('redrawWithoutLayout: 普通模式渲染完成');
        }
    }
}

//=============================================================================
// 支架模式撤销功能
//=============================================================================

/**
 * 保存支架模式的撤销状态
 * @param {string} actionType - 操作类型（如 'fillNode'）
 * @param {Object} actionData - 操作数据
 */
function saveScaffoldUndoState(actionType, actionData) {
    if (!window.scaffoldUndoStack) {
        window.scaffoldUndoStack = [];
    }
    
    // 深拷贝当前图数据
    const graphDataSnapshot = JSON.parse(JSON.stringify(window.currentGraphData));
    
    // 保存待选节点列表的状态
    const candidateNodesSnapshot = window.scaffoldCandidateNodes ? 
        JSON.parse(JSON.stringify(window.scaffoldCandidateNodes)) : [];
    
    // 🔴 保存占位符状态（用于恢复连线）
    const scaffoldPlaceholdersSnapshot = window.scaffoldPlaceholders ? 
        JSON.parse(JSON.stringify(window.scaffoldPlaceholders)) : [];
    
    // 保存待选节点DOM状态
    const candidateNodesDOMState = [];
    const candidateList = document.querySelector('.candidate-nodes-list');
    if (candidateList) {
        candidateList.querySelectorAll('.candidate-node-item').forEach(item => {
            candidateNodesDOMState.push({
                nodeId: item.getAttribute('data-node-id'),
                innerHTML: item.innerHTML,
                style: item.getAttribute('style'),
                draggable: item.draggable
            });
        });
    }
    
    const undoState = {
        timestamp: Date.now(),
        actionType: actionType,
        actionData: actionData,
        graphData: graphDataSnapshot,
        candidateNodes: candidateNodesSnapshot,
        candidateNodesDOMState: candidateNodesDOMState,
        scaffoldPlaceholders: scaffoldPlaceholdersSnapshot // 🔴 保存占位符状态
    };
    
    window.scaffoldUndoStack.push(undoState);
    
    // 限制撤销栈大小
    if (window.scaffoldUndoStack.length > (window.scaffoldMaxUndoSteps || 20)) {
        window.scaffoldUndoStack.shift();
    }
    
    console.log(`saveScaffoldUndoState: 保存撤销状态，类型: ${actionType}，栈大小: ${window.scaffoldUndoStack.length}`);
}

/**
 * 执行支架模式的撤销操作
 */
function scaffoldUndo() {
    if (!window.scaffoldUndoStack || window.scaffoldUndoStack.length === 0) {
        console.log('scaffoldUndo: 没有可撤销的操作');
        showMessage('没有可撤销的操作', 'info');
        return false;
    }
    
    const undoState = window.scaffoldUndoStack.pop();
    console.log(`scaffoldUndo: 撤销操作，类型: ${undoState.actionType}，剩余栈大小: ${window.scaffoldUndoStack.length}`);
    
    // 恢复图数据
    window.currentGraphData = undoState.graphData;
    
    // 恢复待选节点列表
    window.scaffoldCandidateNodes = undoState.candidateNodes;
    
    // 🔴 恢复占位符状态（确保连线能正确绘制）
    if (undoState.scaffoldPlaceholders) {
        window.scaffoldPlaceholders = undoState.scaffoldPlaceholders;
        console.log(`scaffoldUndo: 恢复占位符状态，共 ${window.scaffoldPlaceholders.length} 个`);
    }
    
    // 🔴 同步更新占位符的坐标信息（从恢复的图数据中获取最新坐标）
    if (window.scaffoldPlaceholders && window.currentGraphData && window.currentGraphData.nodes) {
        window.scaffoldPlaceholders.forEach(placeholder => {
            const nodeInGraph = window.currentGraphData.nodes.find(n => n.id === placeholder.id);
            if (nodeInGraph) {
                // 更新占位符的坐标信息
                placeholder.x = nodeInGraph.x;
                placeholder.y = nodeInGraph.y;
                placeholder.width = nodeInGraph.width;
                placeholder.height = nodeInGraph.height;
                placeholder.layer = nodeInGraph.layer;
            }
        });
        console.log('scaffoldUndo: 已同步占位符坐标信息');
    }
    
    // 🔴 完全恢复待选节点到初始状态
    const candidateList = document.querySelector('.candidate-nodes-list');
    if (candidateList && undoState.actionData && undoState.actionData.nodeId) {
        const nodeId = undoState.actionData.nodeId;
        const nodeLabel = undoState.actionData.nodeLabel;
        const item = candidateList.querySelector(`[data-node-id="${nodeId}"]`);
        
        if (item) {
            // 获取节点数据
            const node = window.scaffoldCandidateNodes?.find(n => n.id === nodeId);
            const layer = node?.layer || 1;
            
            // 恢复到初始状态的样式
            item.style.cssText = `
                padding: 12px;
                background: white;
                border: 2px solid #667eea;
                border-radius: 6px;
                cursor: grab;
                transition: all 0.2s;
                user-select: none;
            `;
            
            // 恢复到初始状态的内容
            item.innerHTML = `
                <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">${nodeLabel}</div>
                <div style="font-size: 12px; color: #6c757d;">层级: L${layer}</div>
                <div style="font-size: 11px; color: #667eea; margin-top: 4px;">👆 拖拽到右侧概念图</div>
            `;
            
            // 恢复可拖拽状态
            item.draggable = true;
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
            
            // 🔴 重新绑定拖拽事件
            rebindCandidateNodeDragEvents(item, node || { id: nodeId, label: nodeLabel, layer: layer });
            
            console.log(`scaffoldUndo: 已恢复节点 ${nodeLabel} 到初始状态`);
        }
    }
    
    // 重新渲染概念图
    redrawWithoutLayout();
    
    // 🔴 使用 setTimeout 确保 DOM 更新完成后再更新统计
    setTimeout(() => {
        updateCorrectnessStats();
    }, 50);
    
    showMessage('已撤销上一步操作', 'success');
    return true;
}

/**
 * 重新绑定待选节点的拖拽事件
 * @param {HTMLElement} nodeItem - 待选节点DOM元素
 * @param {Object} node - 节点数据
 */
function rebindCandidateNodeDragEvents(nodeItem, node) {
    // 移除旧的事件监听器（通过克隆节点来移除）
    const newItem = nodeItem.cloneNode(true);
    nodeItem.parentNode.replaceChild(newItem, nodeItem);
    
    // 重新绑定拖拽开始事件
    newItem.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', node.id);
        e.dataTransfer.effectAllowed = 'move';
        this.style.opacity = '0.5';
        this.style.cursor = 'grabbing';
        
        // 创建拖拽预览
        const dragPreview = this.cloneNode(true);
        dragPreview.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            width: ${this.offsetWidth}px;
            background: white;
            border: 2px solid #667eea;
            border-radius: 6px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(dragPreview);
        e.dataTransfer.setDragImage(dragPreview, this.offsetWidth / 2, this.offsetHeight / 2);
        
        // 标记正在拖拽的节点
        window.draggingNodeId = node.id;
        window.draggingNode = node;
    });
    
    // 重新绑定拖拽结束事件
    newItem.addEventListener('dragend', function(e) {
        this.style.opacity = '1';
        this.style.cursor = 'grab';
        
        // 清除待选框高亮
        if (typeof clearPlaceholderHighlight === 'function') {
            clearPlaceholderHighlight();
        }
        
        window.draggingNodeId = null;
        window.draggingNode = null;
        
        // 移除拖拽预览
        const dragPreviews = document.querySelectorAll('body > div[style*="position: absolute"]');
        dragPreviews.forEach(preview => {
            if (preview.style.top === '-1000px') {
                preview.remove();
            }
        });
    });
    
    // 重新绑定悬停效果
    newItem.addEventListener('mouseenter', function() {
        if (this.draggable && this.style.opacity !== '0.5') {
            this.style.background = '#f0f4ff';
            this.style.transform = 'translateX(5px)';
        }
    });
    
    newItem.addEventListener('mouseleave', function() {
        if (this.draggable && this.style.opacity !== '0.5') {
            this.style.background = 'white';
            this.style.transform = 'translateX(0)';
        }
    });
}

/**
 * 清空支架模式的撤销栈
 */
function clearScaffoldUndoStack() {
    window.scaffoldUndoStack = [];
    console.log('clearScaffoldUndoStack: 撤销栈已清空');
}

/**
 * 初始化支架模式的键盘事件监听（Ctrl+Z 撤销）
 */
function initScaffoldKeyboardShortcuts() {
    // 移除旧的监听器（如果存在）
    if (window.scaffoldKeyboardHandler) {
        document.removeEventListener('keydown', window.scaffoldKeyboardHandler);
    }
    
    // 创建新的监听器
    window.scaffoldKeyboardHandler = function(e) {
        // 检查是否处于支架模式
        const conceptMapDisplay = document.querySelector('.concept-map-display');
        const isScaffoldMode = conceptMapDisplay && conceptMapDisplay.classList.contains('scaffold-mode');
        
        if (!isScaffoldMode) return;
        
        // Ctrl+Z 或 Cmd+Z（Mac）
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            scaffoldUndo();
        }
    };
    
    document.addEventListener('keydown', window.scaffoldKeyboardHandler);
    console.log('initScaffoldKeyboardShortcuts: 键盘快捷键已初始化');
}

// 导出撤销相关函数到全局
window.saveScaffoldUndoState = saveScaffoldUndoState;
window.scaffoldUndo = scaffoldUndo;
window.clearScaffoldUndoStack = clearScaffoldUndoStack;
window.initScaffoldKeyboardShortcuts = initScaffoldKeyboardShortcuts;

/**
 * 绘制虚线框占位符（用于标记被移除节点的位置）
 */
function drawPlaceholderBoxes(placeholders) {
    const svg = document.querySelector('.scaffold-concept-graph');
    if (!svg) {
        console.warn('找不到.scaffold-concept-graph SVG元素，无法绘制占位符');
        return;
    }
    
    console.log('开始绘制占位符，数量:', placeholders.length);
    
    // 移除旧的占位符
    const oldPlaceholders = svg.querySelectorAll('.scaffold-placeholder');
    oldPlaceholders.forEach(ph => ph.remove());
    
    if (!placeholders || placeholders.length === 0) {
        console.log('没有占位符需要绘制');
        return;
    }
    
    placeholders.forEach(placeholder => {
        // 检查该占位符对应的节点是否已添加
        const nodeExists = window.currentGraphData?.nodes.some(n => n.id === placeholder.id);
        if (nodeExists) {
            console.log('节点已添加，跳过占位符:', placeholder.id);
            return; // 节点已添加，不绘制占位符
        }
        
        // 创建占位符组
        const placeholderGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        placeholderGroup.setAttribute('class', 'scaffold-placeholder');
        placeholderGroup.setAttribute('data-placeholder-id', placeholder.id);
        
        // 计算节点尺寸
        const nodeWidth = placeholder.width || 100;
        const nodeHeight = placeholder.height || 50;
        const x = placeholder.x || 0;
        const y = placeholder.y || 0;
        
        console.log('绘制占位符:', placeholder.id, '位置:', x, y, '尺寸:', nodeWidth, nodeHeight);
        
        // 绘制虚线框
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x - nodeWidth / 2);
        rect.setAttribute('y', y - nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#667eea');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '5,5');
        rect.setAttribute('opacity', '0.6');
        rect.setAttribute('rx', '8');
        rect.setAttribute('ry', '8');
        
        // 添加提示文字
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#667eea');
        text.setAttribute('opacity', '0.8');
        text.textContent = '待填入';
        
        placeholderGroup.appendChild(rect);
        placeholderGroup.appendChild(text);
        svg.appendChild(placeholderGroup);
    });
    
    console.log('占位符绘制完成');
}

/**
 * 恢复节点在专家图中的连接关系
 */
function restoreNodeLinks(nodeId) {
    if (!window.expertConceptMapData || !window.currentGraphData) return;
    
    // 找到专家图中该节点的所有连接
    const expertLinks = window.expertConceptMapData.links.filter(link => 
        link.source === nodeId || link.target === nodeId
    );
    
    // 检查哪些连接可以恢复（两端节点都已存在）
    expertLinks.forEach(link => {
        const sourceExists = window.currentGraphData.nodes.some(n => n.id === link.source);
        const targetExists = window.currentGraphData.nodes.some(n => n.id === link.target);
        
        if (sourceExists && targetExists) {
            // 检查连接是否已存在
            const linkExists = window.currentGraphData.links.some(l => 
                (l.source === link.source && l.target === link.target) ||
                (l.source === link.target && l.target === link.source)
            );
            
            if (!linkExists) {
                window.currentGraphData.links.push({
                    id: link.id,
                    source: link.source,
                    target: link.target,
                    label: link.label,
                    type: link.type
                });
            }
        }
    });
}

/**
 * 检查节点添加是否正确
 * 
 * 🔴 核心判断逻辑：
 * - 如果提供了 placeholderNodeId，检查用户拖入的节点ID是否与待填入框的ID相同
 * - 待填入框的ID就是原本应该放置的节点ID（在removeNodesForScaffold中保留了原节点ID）
 * - 所以正确的判断是：placeholderNodeId === node.id
 * 
 * @param {Object} node - 要检查的节点（用户拖入的待选概念）
 * @param {string} placeholderNodeId - 待填入框的ID（可选，用于检查是否填入了正确的位置）
 * @returns {boolean} 是否正确
 */
function checkNodeCorrectness(node, placeholderNodeId = null) {
    console.log('checkNodeCorrectness: 检查节点正确性', {
        nodeId: node.id,
        nodeLabel: node.label,
        placeholderNodeId: placeholderNodeId
    });
    
    if (!window.expertConceptMapData) {
        // 如果没有专家图，无法判断，默认返回true
        console.log('checkNodeCorrectness: 没有专家图数据，默认返回true');
        return true;
    }
    
    // 检查节点是否存在于专家图中
    const expertNode = window.expertConceptMapData.nodes.find(n => n.id === node.id);
    if (!expertNode) {
        console.warn('checkNodeCorrectness: 节点不在专家图中:', node.id);
        return false;
    }
    
    // 🔴 关键判断逻辑：如果提供了待填入框ID，检查是否填入了正确的位置
    // 待填入框的ID就是原本应该放置的节点ID
    // 所以正确的判断是：placeholderNodeId === node.id
    if (placeholderNodeId) {
        const isCorrectPosition = (placeholderNodeId === node.id);
        console.log('checkNodeCorrectness: 检查位置', {
            placeholderNodeId: placeholderNodeId,
            nodeId: node.id,
            isCorrectPosition: isCorrectPosition
        });
        
        if (!isCorrectPosition) {
            // 获取待填入框原本应该放置的节点信息（用于日志）
            const expectedNode = window.expertConceptMapData.nodes.find(n => n.id === placeholderNodeId);
            console.warn('checkNodeCorrectness: 节点位置错误!', {
                expected: expectedNode ? expectedNode.label : placeholderNodeId,
                actual: node.label
            });
            return false;
        }
        
        console.log('checkNodeCorrectness: 节点位置正确!', node.label);
        return true;
    }
    
    // 如果没有提供待填入框ID（拖到空白区域或点击添加），只检查节点是否存在于专家图中
    console.log('checkNodeCorrectness: 没有待填入框ID，节点存在于专家图中，返回true');
    return true;
}

/**
 * 更新正确性统计
 */
function updateCorrectnessStats() {
    const candidateList = document.querySelector('.candidate-nodes-list');
    if (!candidateList) return;
    
    const allItems = candidateList.querySelectorAll('.candidate-node-item');
    let correctCount = 0;
    let incorrectCount = 0;
    let totalCount = allItems.length;
    
    allItems.forEach(item => {
        // 🔴 改进检测逻辑：检查多种方式确定节点状态
        const bgColor = item.style.background || item.style.backgroundColor || '';
        const borderColor = item.style.borderColor || '';
        const innerHTML = item.innerHTML || '';
        
        // 检查是否是正确状态（绿色背景或包含"正确"文字）
        if (bgColor.includes('d4edda') || bgColor.includes('rgb(212, 237, 218)') || 
            borderColor.includes('28a745') || innerHTML.includes('✓ 正确')) {
            correctCount++;
        } 
        // 检查是否是错误状态（红色背景或包含"不正确"文字）
        else if (bgColor.includes('f8d7da') || bgColor.includes('rgb(248, 215, 218)') ||
                 borderColor.includes('dc3545') || innerHTML.includes('✗ 不正确')) {
            incorrectCount++;
        }
        // 其他情况为未添加状态（白色背景，包含"拖拽到右侧概念图"文字）
    });
    
    // 更新统计显示
    let statsArea = document.querySelector('.scaffold-stats');
    if (!statsArea) {
        statsArea = document.createElement('div');
        statsArea.className = 'scaffold-stats';
        statsArea.style.cssText = `
            margin-top: 15px;
            padding: 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        `;
        const candidateArea = document.querySelector('.candidate-nodes-area');
        if (candidateArea) {
            candidateArea.appendChild(statsArea);
        }
    }
    
    const addedCount = correctCount + incorrectCount;
    const accuracy = addedCount > 0 ? ((correctCount / addedCount) * 100).toFixed(1) : 0;
    
    statsArea.innerHTML = `
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #2c3e50;">完成情况</div>
        <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">
            已添加: ${addedCount} / ${totalCount}
        </div>
        <div style="font-size: 12px; color: #28a745; margin-bottom: 4px;">
            正确: ${correctCount}
        </div>
        <div style="font-size: 12px; color: #dc3545; margin-bottom: 4px;">
            错误: ${incorrectCount}
        </div>
        <div style="font-size: 12px; color: #667eea; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e9ecef;">
            准确率: ${accuracy}%
        </div>
    `;
    
    console.log(`updateCorrectnessStats: 总数=${totalCount}, 已添加=${addedCount}, 正确=${correctCount}, 错误=${incorrectCount}`);
}

/**
 * 检查支架完成情况
 */
function checkScaffoldCompletion() {
    const candidateList = document.querySelector('.candidate-nodes-list');
    if (!candidateList) return;
    
    const allItems = candidateList.querySelectorAll('.candidate-node-item');
    const remainingNodes = Array.from(allItems).filter(item => 
        !item.style.background.includes('d4edda') && 
        !item.style.background.includes('f8d7da')
    );
    
    if (remainingNodes.length === 0 && allItems.length > 0) {
        // 计算最终统计
        let correctCount = 0;
        let incorrectCount = 0;
        allItems.forEach(item => {
            if (item.style.background.includes('d4edda')) {
                correctCount++;
            } else if (item.style.background.includes('f8d7da')) {
                incorrectCount++;
            }
        });
        
        const accuracy = allItems.length > 0 ? ((correctCount / allItems.length) * 100).toFixed(1) : 0;
        
        showMessage(
            `恭喜！您已完成所有概念的添加！正确: ${correctCount}, 错误: ${incorrectCount}, 准确率: ${accuracy}%`, 
            'success'
        );
        
        // 显示完成提示
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #28a745; margin-bottom: 10px;">✅ 支架概念图完成</h4>
                    <p style="margin: 5px 0;"><strong>完成情况：</strong>所有概念已添加</p>
                    <p style="margin: 5px 0;"><strong>正确数量：</strong>${correctCount}</p>
                    <p style="margin: 5px 0;"><strong>错误数量：</strong>${incorrectCount}</p>
                    <p style="margin: 5px 0; color: #667eea;"><strong>准确率：</strong>${accuracy}%</p>
                    <p style="margin-top: 10px; font-size: 12px; color: #6c757d;">
                        可以点击"展示专家图"按钮查看完整的概念图进行比对
                    </p>
                </div>
            `;
        }
    }
}

/**
 * 显示专家图（完整概念图）
 */
function displayExpertConceptMap(expertData) {
    const svg = document.querySelector('.expert-concept-graph');
    if (!svg || !expertData) {
        console.error('找不到.expert-concept-graph SVG元素或expertData为空');
        return;
    }
    
    console.log('开始渲染专家图，数据:', expertData);
    
    // 🔴 深拷贝专家数据，避免修改原始数据
    const expertDataCopy = JSON.parse(JSON.stringify(expertData));
    
    // 清空SVG
    svg.innerHTML = '';
    
    // 先应用布局算法（使用智能布局，包含优化步骤）
    // 🔴 固定使用改进的Sugiyama算法
    const selectedLayout = 'hierarchical';
    let layoutAppliedData = expertDataCopy;
    
    try {
        // 🔴 优先使用智能布局，它包含连线优化和节点位置优化
        if (typeof window.applyIntelligentLayout === 'function') {
            console.log('专家图：应用智能布局（包含优化）');
            layoutAppliedData = window.applyIntelligentLayout(expertDataCopy);
        } else if (selectedLayout === 'hierarchical' && typeof window.applySugiyamaLayout === 'function') {
            console.log('专家图：应用Sugiyama布局');
            layoutAppliedData = window.applySugiyamaLayout(expertDataCopy);
            
            // 🔴 应用连线优化，减少交叉（直接修改节点和连线数组）
            if (typeof window.optimizeLinkRouting === 'function') {
                console.log('专家图：应用连线优化');
                window.optimizeLinkRouting(layoutAppliedData.nodes, layoutAppliedData.links);
            }
        } else if (selectedLayout === 'force' && typeof window.applyForceDirectedLayout === 'function') {
            console.log('专家图：应用力导向布局');
            layoutAppliedData = window.applyForceDirectedLayout(expertDataCopy, {
                width: 2400,
                height: 1200,
                iterations: 300,
                coolingFactor: 0.95,
                linkDistance: 100,
                nodeCharge: -300,
                nodeSpacing: 60
            });
            
            // 🔴 应用连线优化（直接修改节点和连线数组）
            if (typeof window.optimizeLinkRouting === 'function') {
                console.log('专家图：应用连线优化');
                window.optimizeLinkRouting(layoutAppliedData.nodes, layoutAppliedData.links);
            }
        }
    } catch (error) {
        console.error('专家图布局算法应用失败:', error);
    }
    
    // 🔴 临时保存并修改状态，确保 drawGraph 渲染到正确的 SVG
    const originalData = window.currentGraphData;
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    const wasScaffoldMode = conceptMapDisplay && conceptMapDisplay.classList.contains('scaffold-mode');
    
    // 临时移除 scaffold-mode 类，这样 drawGraph 就不会优先查找 scaffold-concept-graph
    if (wasScaffoldMode) {
        conceptMapDisplay.classList.remove('scaffold-mode');
    }
    
    // 临时隐藏 scaffold-concept-graph
    const scaffoldSvg = document.querySelector('.scaffold-concept-graph');
    const scaffoldDisplay = scaffoldSvg ? scaffoldSvg.style.display : '';
    if (scaffoldSvg) {
        scaffoldSvg.style.display = 'none';
    }
    
    // 将专家图 SVG 添加 concept-graph 类
    svg.classList.add('concept-graph');
    
    // 设置数据
    window.currentGraphData = layoutAppliedData;
    
    // 使用 drawGraph 渲染（保留原有样式）
    if (window.drawGraph) {
        console.log('调用 drawGraph 渲染专家图');
        window.drawGraph(layoutAppliedData);
    }
    
    // 🔴 恢复所有状态
    // 移除 concept-graph 类
    svg.classList.remove('concept-graph');
    
    // 恢复 scaffold-concept-graph 显示
    if (scaffoldSvg) {
        scaffoldSvg.style.display = scaffoldDisplay;
    }
    
    // 恢复 scaffold-mode 类
    if (wasScaffoldMode) {
        conceptMapDisplay.classList.add('scaffold-mode');
    }
    
    // 恢复原始数据
    window.currentGraphData = originalData;
    
    // 标记已渲染
    const g = svg.querySelector('g');
    if (g) {
        g.setAttribute('data-rendered', 'true');
    }
    
    // 调整viewBox以确保所有内容可见
    adjustExpertMapViewBox(svg, layoutAppliedData);
    
    console.log('专家图渲染完成');
}

/**
 * 调整专家图的viewBox以确保所有内容可见
 */
function adjustExpertMapViewBox(svg, graphData) {
    if (!svg || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
        return;
    }
    
    // 计算所有节点的边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    graphData.nodes.forEach(node => {
        const x = node.x || 0;
        const y = node.y || 0;
        const width = node.width || 100;
        const height = node.height || 50;
        
        minX = Math.min(minX, x - width / 2);
        minY = Math.min(minY, y - height / 2);
        maxX = Math.max(maxX, x + width / 2);
        maxY = Math.max(maxY, y + height / 2);
    });
    
    // 添加边距
    const padding = 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    // 设置viewBox
    const width = maxX - minX;
    const height = maxY - minY;
    svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    
    console.log('专家图viewBox已调整:', `${minX} ${minY} ${width} ${height}`);
}

/**
 * 从图片生成概念图
 * @param {string} imageData - Base64编码的图片数据
 * @param {string} fileName - 文件名
 */
async function generateConceptMapFromImage(imageData, fileName) {
    console.log('开始从图片生成概念图...');
    
    if (isGenerating) {
        console.log('正在生成中，忽略重复请求');
        return;
    }
    
    isGenerating = true;
    
    try {
        // 检查服务是否可用
        if (!window.ImageConceptMapService) {
            throw new Error('图片生成概念图服务未加载');
        }
        
        // 获取API基础URL
        let apiBaseUrl = 'http://localhost:5000/api'; // 默认值
        
        if (window.llmManager && window.llmManager.config && window.llmManager.config.API_BASE_URL) {
            apiBaseUrl = window.llmManager.config.API_BASE_URL;
        } else if (window.portChecker) {
            const currentPort = window.portChecker.getCurrentPort();
            apiBaseUrl = `http://localhost:${currentPort}/api`;
        }
        
        console.log('📍 使用API地址:', apiBaseUrl);
        
        // 清除之前的概念图内容
        clearPreviousConceptMap();
        
        // 先显示概念图展示区域
        const conceptMapDisplay = document.querySelector('.concept-map-display');
        if (conceptMapDisplay) {
            conceptMapDisplay.style.display = 'flex';
        }
        
        // 隐藏占位符
        if (window.graphPlaceholder) {
            window.graphPlaceholder.style.display = 'none';
        }
        
        // 显示加载状态
        showLoadingAnimation();
        
        // 更新流程状态
        if (window.processText) {
            window.processText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🖼️ 从图片生成概念图</h4>
                    <p style="margin: 5px 0;"><strong>当前操作：</strong>正在分析图片并提取概念...</p>
                    <p style="margin: 5px 0;"><strong>文件名：</strong>${fileName}</p>
                    <p style="margin: 5px 0; color: #667eea;">✨ AI正在识别图片中的文字并生成概念图...</p>
                </div>
            `;
        }
        
        // 显示文本内容区域
        if (window.aiIntroText) {
            window.aiIntroText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">🤖 AI分析过程</h4>
                    <div style="text-align: center; padding: 30px 0;">
                        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="margin-top: 15px; color: #666;">正在分析图片，请稍候...</p>
                        <p style="margin-top: 5px; font-size: 12px; color: #999;">使用阿里云百炼 qwen3-vl-plus 模型</p>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
        }
        
        // 创建服务实例
        const imageService = new window.ImageConceptMapService(apiBaseUrl);
        
        // 初始化响应文本
        let fullResponseText = '';
        
        // 定义回调函数
        const onChunk = (content) => {
            // 累积内容
            fullResponseText += content;
            
            // 实时更新显示（可选，显示流式输出）
            if (window.aiIntroText) {
                const displayText = fullResponseText.length > 500 
                    ? fullResponseText.substring(0, 500) + '...' 
                    : fullResponseText;
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 15px;">🤖 AI分析过程 <span style="color: #28a745; font-size: 14px;">⚡ 生成中...</span></h4>
                        <div style="line-height: 1.8; color: #333; font-size: 14px;">
                            <pre style="white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto;">${displayText}</pre>
                        </div>
                    </div>
                `;
            }
        };
        
        const onComplete = (result) => {
            console.log('✅ 从图片生成概念图成功:', result);
            
            if (!result.success) {
                throw new Error(result.message || '生成失败');
            }
            
            // 更新流程状态
            if (window.processText) {
                window.processText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">🖼️ 从图片生成概念图</h4>
                        <p style="margin: 5px 0;"><strong>当前操作：</strong>概念图生成完成</p>
                        <p style="margin: 5px 0;"><strong>文件名：</strong>${fileName}</p>
                        <p style="margin: 5px 0; color: #28a745;">✅ 已成功提取 ${result.triples.length} 个三元组</p>
                    </div>
                `;
            }
            
            // 更新文本内容区域
            if (window.aiIntroText) {
                const focusQuestion = result.focusQuestion || '未提取到焦点问题';
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 15px;">📊 提取结果</h4>
                        <div style="line-height: 1.8; color: #333;">
                            <p><strong>焦点问题：</strong>${focusQuestion}</p>
                            <p><strong>三元组数量：</strong>${result.triples.length}</p>
                        </div>
                    </div>
                `;
            }
            
            // 设置焦点问题
            window.focusQuestion = `焦点问题：${result.focusQuestion}`;
            
            // 将三元组转换为概念图数据
            console.log('开始将三元组转换为概念图数据...');
            const conceptData = window.convertTriplesToConceptData(result.triples);
            console.log('概念图数据转换完成:', conceptData);
            
            const graphData = window.convertToD3Format(conceptData);
            console.log('D3格式数据转换完成:', graphData);
            
            // 渲染概念图
            displayConceptMap(graphData);
            
            // 隐藏加载状态
            hideLoadingState();
            
            showMessage('概念图生成完成！', 'success');
            isGenerating = false;
        };
        
        const onError = (error) => {
            console.error('❌ 从图片生成概念图失败:', error);
            
            // 显示错误信息
            if (window.aiIntroText) {
                // 处理多行错误信息，将换行符转换为HTML
                const errorMessage = (error.message || '未知错误').replace(/\n/g, '<br>');
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #e74c3c; margin-bottom: 10px;">❌ 生成失败</h4>
                        <p style="color: #666; margin: 10px 0; white-space: pre-line;">${errorMessage}</p>
                        <p style="color: #999; font-size: 14px; margin-top: 15px;">请检查：</p>
                        <ul style="color: #999; font-size: 14px; margin: 5px 0; padding-left: 20px;">
                            <li>后端服务是否正常运行</li>
                            <li>API密钥是否配置正确</li>
                            <li>网络连接是否正常</li>
                            <li>图片是否包含可识别的文字内容</li>
                        </ul>
                    </div>
                `;
            }
            
            // 更新流程状态
            if (window.processText) {
                // 处理多行错误信息，将换行符转换为HTML
                const errorMessage = (error.message || '生成失败').replace(/\n/g, '<br>');
                window.processText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #e74c3c; margin-bottom: 10px;">🖼️ 从图片生成概念图</h4>
                        <p style="margin: 5px 0;"><strong>当前操作：</strong>生成失败</p>
                        <p style="margin: 5px 0;"><strong>文件名：</strong>${fileName}</p>
                        <p style="margin: 5px 0; color: #e74c3c; white-space: pre-line;">❌ ${errorMessage}</p>
                    </div>
                `;
            }
            
            hideLoadingState();
            showMessage('从图片生成概念图失败: ' + (error.message || '未知错误'), 'error');
            isGenerating = false;
        };
        
        // 调用服务生成概念图
        await imageService.generate(imageData, onChunk, onComplete, onError);
        
    } catch (error) {
        console.error('❌ 调用图片生成概念图服务时发生错误:', error);
        
        // 显示错误信息
        if (window.aiIntroText) {
            window.aiIntroText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #e74c3c; margin-bottom: 10px;">❌ 系统错误</h4>
                    <p style="color: #666; margin: 10px 0;">${error.message}</p>
                    <p style="color: #999; font-size: 14px; margin-top: 15px;">请确保后端服务正常运行。</p>
                </div>
            `;
        }
        
        hideLoadingState();
        showMessage('系统错误: ' + error.message, 'error');
        isGenerating = false;
    }
}

async function analyzeUploadedConceptMap(imageData, fileName) {
    console.log('开始调用概念图评价API...');
    
    try {
        // 检查评价服务是否可用
        if (!window.ConceptMapEvaluationService) {
            throw new Error('概念图评价服务未加载');
        }
        
        // 获取API基础URL（正确方式）
        let apiBaseUrl = 'http://localhost:5000/api'; // 默认值
        
        if (window.llmManager && window.llmManager.config && window.llmManager.config.API_BASE_URL) {
            apiBaseUrl = window.llmManager.config.API_BASE_URL;
        } else if (window.portChecker) {
            // 从 portChecker 获取当前端口
            const currentPort = window.portChecker.getCurrentPort();
            apiBaseUrl = `http://localhost:${currentPort}/api`;
        }
        
        console.log('📍 使用API地址:', apiBaseUrl);
        
        // 创建评价服务实例
        const evaluationService = new window.ConceptMapEvaluationService(apiBaseUrl);
        
        // 初始化评价结果容器
        let analysisText = '';
        
        // 定义回调函数
        const onChunk = (content) => {
            // 累积内容
            analysisText += content;
            
            // 实时更新显示
            if (window.aiIntroText) {
                // 将评价结果转换为HTML格式（保留换行和格式）
                const analysisHtml = analysisText
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗体
                    .replace(/\n\n/g, '</p><p>')  // 段落
                    .replace(/\n/g, '<br>');  // 换行
                
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 15px;">🤖 AI评价分析结果 <span style="color: #28a745; font-size: 14px;">⚡ 生成中...</span></h4>
                        <div style="line-height: 1.8; color: #333;">
                            <p>${analysisHtml}</p>
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                            <p>评价模型：阿里云百炼 qwen3-vl-plus（流式输出）</p>
                            <p>文件名：${fileName}</p>
                        </div>
                    </div>
                `;
            }
        };
        
        const onComplete = () => {
            console.log('✅ 概念图评价成功（流式）');
            
            // 更新流程状态
            if (window.processText) {
                window.processText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 10px;">📤 概念图评价流程</h4>
                        <p style="margin: 5px 0;"><strong>当前操作：</strong>AI评价分析完成</p>
                        <p style="margin: 5px 0;"><strong>文件名：</strong>${fileName}</p>
                        <p style="margin: 5px 0; color: #28a745;">✅ 评价分析已完成，请查看下方结果</p>
                    </div>
                `;
            }
            
            // 显示最终结果（移除"生成中"标识）
            if (window.aiIntroText) {
                const analysisHtml = analysisText
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗体
                    .replace(/\n\n/g, '</p><p>')  // 段落
                    .replace(/\n/g, '<br>');  // 换行
                
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #667eea; margin-bottom: 15px;">🤖 AI评价分析结果</h4>
                        <div style="line-height: 1.8; color: #333;">
                            <p>${analysisHtml}</p>
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                            <p>评价模型：阿里云百炼 qwen3-vl-plus</p>
                            <p>文件名：${fileName}</p>
                        </div>
                    </div>
                `;
            }
            
            showMessage('概念图评价完成', 'success');
        };
        
        const onError = (error) => {
            console.error('❌ 概念图评价失败:', error);
            
            // 显示错误信息
            if (window.aiIntroText) {
                window.aiIntroText.innerHTML = `
                    <div style="padding: 15px;">
                        <h4 style="color: #e74c3c; margin-bottom: 10px;">❌ 评价失败</h4>
                        <p style="color: #666; margin: 10px 0;">${error || '未知错误'}</p>
                        <p style="color: #999; font-size: 14px; margin-top: 15px;">请检查：</p>
                        <ul style="color: #999; font-size: 14px; margin: 5px 0; padding-left: 20px;">
                            <li>后端服务是否正常运行</li>
                            <li>API密钥是否配置正确</li>
                            <li>网络连接是否正常</li>
                        </ul>
                    </div>
                `;
            }
            
            showMessage('概念图评价失败: ' + error, 'error');
        };
        
        // 调用流式评价API
        await evaluationService.streamAnalyze(imageData, onChunk, onComplete, onError);
        
    } catch (error) {
        console.error('❌ 调用评价服务时发生错误:', error);
        
        // 显示错误信息
        if (window.aiIntroText) {
            window.aiIntroText.innerHTML = `
                <div style="padding: 15px;">
                    <h4 style="color: #e74c3c; margin-bottom: 10px;">❌ 系统错误</h4>
                    <p style="color: #666; margin: 10px 0;">${error.message}</p>
                    <p style="color: #999; font-size: 14px; margin-top: 15px;">请确保后端服务正常运行。</p>
                </div>
            `;
        }
        
        showMessage('系统错误: ' + error.message, 'error');
    }
}

function resetView() {
    // 显示确认弹窗
    if (!confirm('你确定要重置视图吗？未保存的内容将全部被清除')) {
        return;
    }
    
    // 🔴 首先清除支架模式下的内容（如果存在）
    clearPreviousConceptMap();
    
    // 清除所有生成的内容
    currentGraphData = null;
    window.currentGraphData = null;
    
    // 清除低支架模式相关的全局变量
    window.lowScaffoldConcepts = null;
    window.lowScaffoldRelations = null;
    window.userBuiltNodes = null;
    window.userBuiltLinks = null;
    
    // 显示占位符
    if (window.graphPlaceholder) {
        window.graphPlaceholder.style.display = 'flex';
    }
    
    // 隐藏概念图展示区域
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (conceptMapDisplay) {
        conceptMapDisplay.style.display = 'none';
        // 确保移除所有支架模式相关的类
        conceptMapDisplay.classList.remove('scaffold-mode');
        conceptMapDisplay.classList.remove('low-scaffold-mode');
    }
    
    // 编辑工具栏现在在control-bar中，始终可见
    
    // 取消节点选中状态
    deselectNode();
    
    // 清空输入框
    if (window.keywordInput) {
        window.keywordInput.value = '';
    }
    if (window.descriptionTextarea) {
        window.descriptionTextarea.value = '';
    }
    
    // 清空AI介绍文字
    const aiIntroText = document.getElementById('aiIntroText');
    if (aiIntroText) {
        aiIntroText.innerHTML = '';
        aiIntroText.className = 'intro-text';
    }
    
    // 清空概念节点和关系连接列表区域
    const conceptListsArea = document.getElementById('conceptListsArea');
    if (conceptListsArea) {
        conceptListsArea.innerHTML = '';
        conceptListsArea.style.display = 'none';
    }
    
    // 恢复SVG画布（如果之前被上传图片替换了）
    const graphCanvas = document.querySelector('.graph-canvas-fullwidth') || document.querySelector('.graph-canvas');
    let svg = document.querySelector('.concept-graph');
    
    if (!svg && graphCanvas) {
        // SVG不存在，说明之前被上传图片替换了，需要重新创建
        console.log('检测到SVG被替换，正在恢复SVG画布...');
        graphCanvas.innerHTML = '';
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '1200');
        svg.setAttribute('class', 'concept-graph');
        svg.setAttribute('viewBox', '0 0 2400 1200');
        graphCanvas.appendChild(svg);
    }
    
    // 清空SVG画布内容（包括普通概念图和支架概念图）
    if (svg) {
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        
        // 默认显示文字
        const defaultText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        defaultText.setAttribute('x', '1200');
        defaultText.setAttribute('y', '600');
        defaultText.setAttribute('text-anchor', 'middle');
        defaultText.setAttribute('dominant-baseline', 'middle');
        defaultText.setAttribute('font-size', '16');
        defaultText.setAttribute('fill', '#666');
        defaultText.textContent = '概念图将在这里显示';
        svg.appendChild(defaultText);
    }
    
    // 🔴 清空支架模式下的 SVG（如果存在）
    const scaffoldSvg = document.querySelector('.scaffold-concept-graph');
    if (scaffoldSvg) {
        while (scaffoldSvg.firstChild) {
            scaffoldSvg.removeChild(scaffoldSvg.firstChild);
        }
    }
    
    // 🔴 清空专家图的 SVG（如果存在）
    const expertSvg = document.querySelector('.expert-concept-graph');
    if (expertSvg) {
        while (expertSvg.firstChild) {
            expertSvg.removeChild(expertSvg.firstChild);
        }
    }
    
    // 🔴 清空左侧待选概念和关系词列表（低支架模式）
    const conceptsList = document.querySelector('.low-scaffold-concepts-list');
    if (conceptsList) {
        conceptsList.innerHTML = '';
    }
    const relationsList = document.querySelector('.low-scaffold-relations-list');
    if (relationsList) {
        relationsList.innerHTML = '';
    }
    
    // 🔴 清空左侧待选概念列表（高支架模式）
    const candidateList = document.querySelector('.candidate-nodes-list');
    if (candidateList) {
        candidateList.innerHTML = '';
    }
    
    // 清除焦点问题
    window.focusQuestion = null;
    
    // 禁用导出按钮
    if (window.exportBtn) {
        window.exportBtn.disabled = true;
    }
    
    // 重置状态栏
    if (typeof window.updateStatusBar === 'function') {
        window.updateStatusBar({ nodes: [], links: [] });
    }
    
    // 清空历史记录
    clearHistory();
    
    // 重置所有相关状态
    selectedNodeId = null;
    selectedLinkId = null;
    window.isAllNodesSelected = false;
    isDragging = false;
    isLinkCreationMode = false;
    linkSourceNodeId = null;
    linkTargetNodeId = null;
    isGenerating = false;
    
    // 重置生成按钮状态
    resetGenerateButtons();
    
    // 重置全局调整大小状态
    if (window.isResizing !== undefined) {
        window.isResizing = false;
    }
    if (window.resizeStartX !== undefined) {
        window.resizeStartX = 0;
    }
    if (window.resizeStartY !== undefined) {
        window.resizeStartY = 0;
    }
    if (window.originalWidth !== undefined) {
        window.originalWidth = 0;
    }
    if (window.originalHeight !== undefined) {
        window.originalHeight = 0;
    }
    
    // 重置虚拟连接线状态
    if (window.virtualLine) {
        window.virtualLine = null;
    }
    
    // 移除可能存在的虚拟连接线
    const virtualLines = document.querySelectorAll('.virtual-connection-line');
    virtualLines.forEach(line => line.remove());
    
    // 移除可能存在的输入框
    const floatingInputs = document.querySelectorAll('input[style*="position: fixed"], input[style*="position: absolute"]');
    floatingInputs.forEach(input => {
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
    });
    
    // 移除可能存在的控制手柄
    const nodeHandles = document.querySelectorAll('.node-handle');
    nodeHandles.forEach(handle => handle.remove());
    
    showMessage('视图已重置，所有内容已清除，您可以重新开始创建概念图', 'success');
}

//=============================================================================
// 概念图生成函数
//=============================================================================

/**
 * 重置生成按钮状态
 */
function resetGenerateButtons() {
    if (window.keywordBtn) {
        window.keywordBtn.classList.remove('loading');
        window.keywordBtn.textContent = '生成';
        window.keywordBtn.disabled = false;
    }
    if (window.descriptionBtn) {
        window.descriptionBtn.classList.remove('loading');
        window.descriptionBtn.textContent = '分析生成';
        window.descriptionBtn.disabled = false;
    }
    // 🔴 布局算法已固定为改进的Sugiyama算法，无需启用/禁用下拉框
}

async function generateConceptMapWithLLM(type, data) {
    console.log('generateConceptMapWithLLM函数被调用，类型:', type, '数据:', data);
    
    if (isGenerating) {
        console.log('正在生成中，忽略重复请求');
        return;
    }
    
    isGenerating = true;
    console.log('开始生成概念图流程...');
    
    // 🔴 布局算法已固定为改进的Sugiyama算法，无需禁用下拉框
    
    // 清除之前的概念图内容
    console.log('清除之前的概念图内容...');
    clearPreviousConceptMap();
    
    // 清除之前的步骤用时记录
    window.stepDurations = {};
    
    // 记录总开始时间
    const totalStartTime = performance.now();
    
    try {
        // 先显示概念图展示区域
        const conceptMapDisplay = document.querySelector('.concept-map-display');
        conceptMapDisplay.style.display = 'flex';
        
        // 隐藏占位符
        graphPlaceholder.style.display = 'none';
        
        // 显示加载动画
        showLoadingAnimation();
        
        // 显示内容加载状态
        showContentLoadingState(type, data);
        
        // 生成焦点问题
        generateFocusQuestion(type, data);
        
        // 针对焦点问题模式，使用4步流程
        if (type === 'keyword') {
            // === 步骤1：生成介绍文本（流式输出） ===
            const step1Start = performance.now();
            updateProcessStatus(1, 'active', null, 'keyword');
            
            // 清空并准备文本内容展示区域
            const textDisplayArea = window.aiIntroText;
            if (textDisplayArea) {
                textDisplayArea.innerHTML = '<div class="streaming-text" style="padding: 10px; line-height: 1.8; color: #333; font-size: 14px;"></div>';
            }
            
            const streamingDiv = textDisplayArea ? textDisplayArea.querySelector('.streaming-text') : null;
            let introText = '';
            
            console.log('准备开始流式生成介绍文本，显示区域:', textDisplayArea);
            
            // 调用流式生成介绍文本
            const introResult = await window.llmManager.generateIntroduction(
                data.keyword,
                (chunk) => {
                    // 实时显示生成的文本
                    introText += chunk;
                    if (streamingDiv) {
                        streamingDiv.textContent = introText;
                    }
                }
            );
            
            console.log('==================== 步骤1完成检查 ====================');
            console.log('流式文本生成完成，总字数:', introText.length);
            console.log('introResult对象:', introResult);
            console.log('introResult.success:', introResult?.success);
            console.log('introResult.text:', introResult?.text ? '存在，长度:' + introResult.text.length : '不存在');
            console.log('=========================================================');
            
            const step1Duration = ((performance.now() - step1Start) / 1000).toFixed(2) + 's';
            
            if (!introResult) {
                console.error('❌ introResult为null或undefined');
                updateProcessStatus(1, 'error', null, 'keyword');
                showMessage('文本生成返回结果为空', 'warning');
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            if (!introResult.success) {
                console.error('❌ introResult.success为false，introResult:', introResult);
                updateProcessStatus(1, 'error', null, 'keyword');
                showMessage(introResult?.message || '文本生成失败', 'warning');
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            if (!introResult.text || introResult.text.length === 0) {
                console.error('❌ 生成的文本为空');
                updateProcessStatus(1, 'error', null, 'keyword');
                showMessage('生成的文本为空，请重试', 'warning');
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            console.log('✅ 介绍文本生成成功，文本长度:', introResult.text.length);
            console.log('准备进入步骤2：提取三元组');
            updateProcessStatus(1, 'completed', step1Duration, 'keyword');
            
            // 等待一小段时间，确保第一次流式连接完全释放
            console.log('⏳ 等待连接清理...');
            await new Promise(resolve => setTimeout(resolve, 300));
            console.log('✅ 连接清理完成，开始步骤2');
            
            // === 步骤2：提取三元组 ===
            const step2Start = performance.now();
            updateProcessStatus(2, 'active', null, 'keyword');
            
            console.log('=== 步骤2开始：提取三元组 ===');
            console.log('开始从介绍文本提取三元组，文本长度:', introResult.text.length);
            console.log('文本前100字:', introResult.text.substring(0, 100));
            console.log('window.llmManager存在:', !!window.llmManager);
            console.log('extractTriples方法存在:', typeof window.llmManager?.extractTriples);
            
            // 在文本展示区域显示处理状态
            if (streamingDiv) {
                streamingDiv.innerHTML = introText + '<br><br><div style="color: #666; font-style: italic;">正在提取三元组...</div>';
            }
            
            let tripleResult;
            try {
                console.log('准备调用extractTriples...');
                tripleResult = await window.llmManager.extractTriples(introResult.text);
                console.log('extractTriples调用完成');
                console.log('三元组提取返回结果:', tripleResult);
            } catch (error) {
                console.error('三元组提取异常:', error);
                updateProcessStatus(2, 'error', null, 'keyword');
                showMessage('三元组提取异常：' + error.message, 'error');
                if (streamingDiv) {
                    streamingDiv.innerHTML = introText + '<br><br><div style="color: red;">三元组提取异常: ' + error.message + '</div>';
                }
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            const step2Duration = ((performance.now() - step2Start) / 1000).toFixed(2) + 's';
            
            if (!tripleResult || !tripleResult.success || !tripleResult.triples || tripleResult.triples.length === 0) {
                console.error('❌ 三元组提取失败，详细信息:', tripleResult);
                updateProcessStatus(2, 'error', null, 'keyword');
                const errorMsg = tripleResult?.message || tripleResult?.error || '未知错误';
                showMessage('三元组提取失败：' + errorMsg, 'error');
                if (streamingDiv) {
                    let errorHtml = introText + '<br><br><div style="color: #dc3545; background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">';
                    errorHtml += '<strong>❌ 三元组提取失败</strong><br><br>';
                    errorHtml += '<div style="color: #333;">' + errorMsg + '</div>';
                    
                    // 如果有原始响应，显示出来供调试
                    if (tripleResult?.rawResponse) {
                        errorHtml += '<br><details style="cursor: pointer;"><summary style="color: #666;">查看AI原始响应（用于调试）</summary>';
                        const escapedResponse = tripleResult.rawResponse
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');
                        errorHtml += '<pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; max-height: 200px; font-size: 12px;">' + 
                                     escapedResponse + '</pre>';
                        errorHtml += '</details>';
                    }
                    
                    errorHtml += '</div>';
                    streamingDiv.innerHTML = errorHtml;
                }
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            console.log('三元组提取成功，数量:', tripleResult.triples.length, '三元组列表:', tripleResult.triples);
            updateProcessStatus(2, 'completed', step2Duration, 'keyword');
            
            // 恢复原始介绍文本，移除"正在提取三元组..."的提示
            if (streamingDiv) {
                streamingDiv.textContent = introText;
            }
            
            // === 步骤3：概念图的生成（数据处理+渲染） ===
            const step3Start = performance.now();
            updateProcessStatus(3, 'active', null, 'keyword');
            
            // 将三元组转换为概念图数据
            console.log('开始将三元组转换为概念图数据...');
            const conceptData = window.convertTriplesToConceptData(tripleResult.triples);
            console.log('概念图数据转换完成:', conceptData);
            
            const graphData = window.convertToD3Format(conceptData);
            console.log('D3格式数据转换完成:', graphData);
            
            // 渲染概念图
            displayConceptMap(graphData);
            
            // 更新显示信息
            updateGenerationInfo(type, data, conceptData, introResult.text, '');
            
            const step3Duration = ((performance.now() - step3Start) / 1000).toFixed(2) + 's';
            updateProcessStatus(3, 'completed', step3Duration, 'keyword');
            
            // === 步骤4：完成 ===
            const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2) + 's';
            updateProcessStatus(4, 'completed', totalDuration, 'keyword');
            
            showMessage('概念图生成完成！', 'success');
            
        } else {
            // 文本分析模式，流程：焦点问题分析 → 三元组提取 → 概念图渲染（4步）
            
            // === 步骤1：焦点问题分析 ===
            const step1Start = performance.now();
            updateProcessStatus(1, 'active', null, 'description');
            
            console.log('=== 步骤1开始：焦点问题分析 ===');
            console.log('输入文本长度:', data.description.length);
            console.log('输入文本前100字:', data.description.substring(0, 100));
            
            let focusQuestionResult;
            try {
                console.log('准备调用extractFocusQuestion...');
                focusQuestionResult = await window.llmManager.extractFocusQuestion(data.description);
                console.log('extractFocusQuestion调用完成');
                console.log('焦点问题提取返回结果:', focusQuestionResult);
            } catch (error) {
                console.error('焦点问题提取异常:', error);
                updateProcessStatus(1, 'error', null, 'description');
                showMessage('焦点问题提取异常：' + error.message, 'error');
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            const step1Duration = ((performance.now() - step1Start) / 1000).toFixed(2) + 's';
            
            if (!focusQuestionResult || !focusQuestionResult.success || !focusQuestionResult.focusQuestion) {
                console.error('❌ 焦点问题提取失败，详细信息:', focusQuestionResult);
                updateProcessStatus(1, 'error', null, 'description');
                const errorMsg = focusQuestionResult?.message || focusQuestionResult?.error || '未知错误';
                showMessage('焦点问题提取失败：' + errorMsg, 'error');
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            const extractedFocusQuestion = focusQuestionResult.focusQuestion;
            console.log('✅ 焦点问题提取成功:', extractedFocusQuestion);
            
            // 更新全局焦点问题变量（用于显示和导出）
            window.focusQuestion = `焦点问题：${extractedFocusQuestion}`;
            
            updateProcessStatus(1, 'completed', step1Duration, 'description');
            
            // 等待一小段时间
            console.log('⏳ 等待连接清理...');
            await new Promise(resolve => setTimeout(resolve, 300));
            console.log('✅ 连接清理完成，开始步骤2');
            
            // 准备文本内容展示区域，显示用户输入的原始文本
            const textDisplayArea = window.aiIntroText;
            const streamingDiv = textDisplayArea ? textDisplayArea.querySelector('.streaming-text') : null;
            const userInputText = data.description;
            
            if (textDisplayArea) {
                textDisplayArea.innerHTML = '<div class="streaming-text" style="padding: 10px; line-height: 1.8; color: #333; font-size: 14px;"></div>';
                const newStreamingDiv = textDisplayArea.querySelector('.streaming-text');
                if (newStreamingDiv) {
                    newStreamingDiv.textContent = userInputText;
                }
            }
            
            // === 步骤2：提取三元组（直接从用户输入的文本） ===
            const step2Start = performance.now();
            updateProcessStatus(2, 'active', null, 'description');
            
            console.log('=== 步骤2开始：提取三元组 ===');
            console.log('开始从用户输入文本提取三元组，文本长度:', userInputText.length);
            console.log('文本前100字:', userInputText.substring(0, 100));
            
            // 在文本展示区域显示处理状态
            const newStreamingDiv = textDisplayArea ? textDisplayArea.querySelector('.streaming-text') : null;
            if (newStreamingDiv) {
                newStreamingDiv.innerHTML = userInputText + '<br><br><div style="color: #666; font-style: italic;">正在提取三元组...</div>';
            }
            
            let tripleResult;
            try {
                console.log('准备调用extractTriples...');
                tripleResult = await window.llmManager.extractTriples(userInputText);
                console.log('extractTriples调用完成');
                console.log('三元组提取返回结果:', tripleResult);
            } catch (error) {
                console.error('三元组提取异常:', error);
                updateProcessStatus(2, 'error', null, 'description');
                showMessage('三元组提取异常：' + error.message, 'error');
                if (newStreamingDiv) {
                    newStreamingDiv.innerHTML = userInputText + '<br><br><div style="color: red;">三元组提取异常: ' + error.message + '</div>';
                }
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            const step2Duration = ((performance.now() - step2Start) / 1000).toFixed(2) + 's';
            
            if (!tripleResult || !tripleResult.success || !tripleResult.triples || tripleResult.triples.length === 0) {
                console.error('❌ 三元组提取失败，详细信息:', tripleResult);
                updateProcessStatus(2, 'error', null, 'description');
                const errorMsg = tripleResult?.message || tripleResult?.error || '未知错误';
                showMessage('三元组提取失败：' + errorMsg, 'error');
                if (newStreamingDiv) {
                    let errorHtml = userInputText + '<br><br><div style="color: #dc3545; background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">';
                    errorHtml += '<strong>❌ 三元组提取失败</strong><br><br>';
                    errorHtml += '<div style="color: #333;">' + errorMsg + '</div>';
                    
                    // 如果有原始响应，显示出来供调试
                    if (tripleResult?.rawResponse) {
                        errorHtml += '<br><details style="cursor: pointer;"><summary style="color: #666;">查看AI原始响应（用于调试）</summary>';
                        const escapedResponse = tripleResult.rawResponse
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');
                        errorHtml += '<pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; max-height: 200px; font-size: 12px;">' + 
                                     escapedResponse + '</pre>';
                        errorHtml += '</details>';
                    }
                    
                    errorHtml += '</div>';
                    newStreamingDiv.innerHTML = errorHtml;
                }
                isGenerating = false;
                resetGenerateButtons();
                return;
            }
            
            console.log('三元组提取成功，数量:', tripleResult.triples.length, '三元组列表:', tripleResult.triples);
            updateProcessStatus(2, 'completed', step2Duration, 'description');
            
            // 恢复原始文本，移除"正在提取三元组..."的提示
            if (newStreamingDiv) {
                newStreamingDiv.textContent = userInputText;
            }
            
            // === 步骤3：概念图的生成（数据处理+渲染） ===
            const step3Start = performance.now();
            updateProcessStatus(3, 'active', null, 'description');
            
            // 将三元组转换为概念图数据
            console.log('开始将三元组转换为概念图数据...');
            const conceptData = window.convertTriplesToConceptData(tripleResult.triples);
            console.log('概念图数据转换完成:', conceptData);
            
            const graphData = window.convertToD3Format(conceptData);
            console.log('D3格式数据转换完成:', graphData);
            
            // 渲染概念图
            displayConceptMap(graphData);
            
            // 更新显示信息（使用用户输入的文本）
            updateGenerationInfo('description', data, conceptData, userInputText, '');
            
            const step3Duration = ((performance.now() - step3Start) / 1000).toFixed(2) + 's';
            updateProcessStatus(3, 'completed', step3Duration, 'description');
            
            // === 步骤4：完成 ===
            const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2) + 's';
            updateProcessStatus(4, 'completed', totalDuration, 'description');
            
            showMessage('概念图生成完成！', 'success');
        }
        
    } catch (error) {
        console.error('生成过程出错:', error);
        updateProcessStatus(1, 'error'); // 标记为概念图文本内容生成阶段错误
        showMessage('生成失败，请稍后重试', 'warning');
    } finally {
        isGenerating = false;
        hideLoadingState();
        resetGenerateButtons();
        
        // 🔴 布局算法已固定为改进的Sugiyama算法，无需启用下拉框
        
        // 恢复迷思概念探查的生成按钮状态（如果存在）
        if (window.misconceptionGenerateBtn) {
            window.misconceptionGenerateBtn.disabled = false;
            window.misconceptionGenerateBtn.textContent = '🗺️ 一键生成思维导图';
            window.misconceptionGenerateBtn.classList.remove('loading');
            window.misconceptionGenerateBtn = null;
        }
    }
}

function generateFocusQuestion(type, data) {
    let focusQuestion = '';
    if (type === 'keyword') {
        // 焦点问题模式 - 直接使用用户输入的内容
        const keyword = data.keyword;
        focusQuestion = `焦点问题：${keyword}`;
    } else {
        // 文本分析模式
        const textContent = data.description;
        // 提取核心概念
        let coreConcept = '';
        if (textContent.length <= 6) {
            coreConcept = textContent;
        } else {
            // 尝试找到句子的主语或核心名词
            const sentences = textContent.split(/[。！？，；]/);
            const firstSentence = sentences[0].trim();
            if (firstSentence.length <= 6) {
                coreConcept = firstSentence;
            } else {
                // 提取前6个字符作为核心概念
                coreConcept = firstSentence.substring(0, 6) + '...';
            }
        }
        focusQuestion = `焦点问题：${coreConcept}`;
    }
    
    // 将焦点问题存储到全局变量中
    window.focusQuestion = focusQuestion;
}

function clearPreviousConceptMap() {
    console.log('开始清除之前的概念图内容...');
    
    // 清理支架模式的布局（如果存在）
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (conceptMapDisplay) {
        // 移除支架模式类
        conceptMapDisplay.classList.remove('scaffold-mode');
        
        // 移除支架容器及其所有子元素（待选概念区、支架概念图等）
        const scaffoldContainer = conceptMapDisplay.querySelector('.scaffold-container');
        if (scaffoldContainer) {
            scaffoldContainer.remove();
            console.log('已移除支架模式布局');
        }
        
        // 移除专家图区域
        const expertMapArea = conceptMapDisplay.querySelector('.expert-map-area');
        if (expertMapArea) {
            expertMapArea.remove();
        }
        
        // 恢复正常的布局结构
        if (!conceptMapDisplay.querySelector('.graph-canvas-fullwidth')) {
            const graphCanvas = document.createElement('div');
            graphCanvas.className = 'graph-canvas-fullwidth';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '1200');
            svg.setAttribute('class', 'concept-graph');
            svg.setAttribute('viewBox', '0 0 2400 1200');
            graphCanvas.appendChild(svg);
            conceptMapDisplay.appendChild(graphCanvas);
            console.log('已恢复正常的布局结构');
        }
    }
    
    // 清空AI介绍文字（现在在control-bar中）
    const aiIntroText = document.getElementById('aiIntroText');
    if (aiIntroText) {
        aiIntroText.innerHTML = '';
        aiIntroText.className = 'intro-text-compact';
    }
    
    // 清空当前流程文本（现在在control-bar中）
    const processText = document.getElementById('processText');
    if (processText) {
        processText.innerHTML = '';
        processText.className = 'process-text-compact';
    }
    
    // 清空概念节点和关系连接列表区域
    const conceptListsArea = document.getElementById('conceptListsArea');
    if (conceptListsArea) {
        conceptListsArea.innerHTML = '';
        conceptListsArea.style.display = 'none';
    }
    
    // 恢复SVG画布（如果之前被上传图片替换了）
    const graphCanvas = document.querySelector('.graph-canvas-fullwidth') || document.querySelector('.graph-canvas');
    let svg = document.querySelector('.concept-graph');
    
    if (!svg && graphCanvas) {
        // SVG不存在，说明之前被上传图片替换了，需要重新创建
        console.log('检测到SVG被替换，正在恢复SVG画布...');
        graphCanvas.innerHTML = '';
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '1200');
        svg.setAttribute('class', 'concept-graph');
        svg.setAttribute('viewBox', '0 0 2400 1200');
        graphCanvas.appendChild(svg);
    } else if (svg) {
        // SVG存在，只需清空内容
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
    }
    
    // 清除支架模式相关的全局变量
    window.scaffoldCandidateNodes = null;
    window.scaffoldPlaceholders = null;
    window.expertConceptMapData = null;
    window.originalPlaceholderNodeIds = null; // 🔴 清除原始待填入节点ID列表
    window.scaffoldUndoStack = []; // 🔴 清空撤销栈
    
    // 隐藏导出支架图按钮
    const exportScaffoldBtn = document.getElementById('exportScaffoldBtn');
    if (exportScaffoldBtn) {
        exportScaffoldBtn.style.display = 'none';
    }
    
    // 恢复"下载图片"按钮原始状态
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn && downloadBtn.dataset.scaffoldMode === 'true') {
        downloadBtn.innerHTML = downloadBtn.dataset.originalText || '📷 下载图片';
        downloadBtn.dataset.scaffoldMode = 'false';
    }
    
    // 清除焦点问题
    window.focusQuestion = null;
    
    // 清空当前图数据
    currentGraphData = { nodes: [], links: [] };
    
    // 重置状态栏
    if (typeof window.updateStatusBar === 'function') {
        window.updateStatusBar({ nodes: [], links: [] });
    }
    
    // 清空历史记录
    clearHistory();
    
    // 重置所有相关状态
    selectedNodeId = null;
    selectedLinkId = null;
    window.isAllNodesSelected = false;
    isDragging = false;
    isLinkCreationMode = false;
    linkSourceNodeId = null;
    linkTargetNodeId = null;
    
    console.log('概念图内容清除完成');
}

//=============================================================================
// DOM初始化和事件绑定
//=============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始获取元素...');
    
    // 初始化大模型交互模块
    if (window.llmManager) {
        window.llmManager.init();
        console.log('大模型交互模块已初始化');
    } else {
        console.error('大模型交互模块未找到');
    }
    
    // 获取DOM元素并设为全局变量（让所有模块都能访问）
    window.misconceptionTopicInput = document.getElementById('misconceptionTopic');
    window.exploreMisconceptionBtn = document.getElementById('exploreMisconceptionBtn');
    window.scaffoldFocusQuestionInput = document.getElementById('scaffoldFocusQuestion');
    window.generateScaffoldConceptMapBtn = document.getElementById('generateScaffoldConceptMapBtn');
    window.scaffoldTypeHigh = document.getElementById('scaffoldTypeHigh');
    window.scaffoldTypeLow = document.getElementById('scaffoldTypeLow');
    window.keywordInput = document.getElementById('keyword');
    window.descriptionTextarea = document.getElementById('description');
    window.keywordBtn = document.getElementById('generateKeywordBtn');
    window.descriptionBtn = document.getElementById('generateDescriptionBtn');
    window.uploadImageInput = document.getElementById('uploadImage');
    window.uploadImageBtn = document.getElementById('uploadImageBtn');
    window.uploadImageForGenerationInput = document.getElementById('uploadImageForGeneration');
    window.uploadImageForGenerationBtn = document.getElementById('uploadImageForGenerationBtn');
    window.resetBtn = document.getElementById('resetViewBtn');
    // 🔴 导出图片按钮已删除
    window.graphPlaceholder = document.querySelector('.graph-placeholder');
    window.aiIntroText = document.getElementById('aiIntroText');
    
    console.log('基本元素获取结果:');
    console.log('keywordInput:', window.keywordInput);
    console.log('descriptionTextarea:', window.descriptionTextarea);
    console.log('keywordBtn:', window.keywordBtn);
    console.log('descriptionBtn:', window.descriptionBtn);
    console.log('resetBtn:', window.resetBtn);
    console.log('exportBtn:', window.exportBtn);
    console.log('graphPlaceholder:', window.graphPlaceholder);
    
    // 编辑工具栏元素（全局）- 现在在control-bar中
    window.addNodeBtn = document.getElementById('addNodeBtn');
    window.deleteNodeBtn = document.getElementById('deleteNodeBtn');
    window.editNodeBtn = document.getElementById('editNodeBtn');
    window.addLinkBtn = document.getElementById('addLinkBtn');
    window.deleteLinkBtn = document.getElementById('deleteLinkBtn');
    window.editLinkBtn = document.getElementById('editLinkBtn');
    // 🔴 新增按钮
    window.addFocusQuestionBtn = document.getElementById('addFocusQuestionBtn');
    window.addAggregatedLinkBtn = document.getElementById('addAggregatedLinkBtn');
    window.addSameLayerLinkBtn = document.getElementById('addSameLayerLinkBtn');
    window.addSameLayerAggregatedLinkBtn = document.getElementById('addSameLayerAggregatedLinkBtn');
    
    console.log('编辑工具栏元素获取结果:');
    console.log('addNodeBtn:', window.addNodeBtn);
    console.log('deleteNodeBtn:', window.deleteNodeBtn);
    console.log('editNodeBtn:', window.editNodeBtn);
    console.log('addLinkBtn:', window.addLinkBtn);
    console.log('deleteLinkBtn:', window.deleteLinkBtn);
    console.log('editLinkBtn:', window.editLinkBtn);
    console.log('addFocusQuestionBtn:', window.addFocusQuestionBtn);
    console.log('addAggregatedLinkBtn:', window.addAggregatedLinkBtn);
    console.log('addSameLayerLinkBtn:', window.addSameLayerLinkBtn);
    console.log('addSameLayerAggregatedLinkBtn:', window.addSameLayerAggregatedLinkBtn);
    
    // 当前流程元素（全局）
    window.processText = document.getElementById('processText');
    
    console.log('当前流程元素获取结果:');
    console.log('processText:', window.processText);
    
    // 状态栏元素（全局）
    window.nodeCountSpan = document.getElementById('nodeCount');
    window.linkCountSpan = document.getElementById('linkCount');
    window.downloadBtn = document.getElementById('downloadBtn');
    window.loadBtn = document.getElementById('loadBtn');
    window.undoBtn = document.getElementById('undoBtn');
    window.redoBtn = document.getElementById('redoBtn');
    
    console.log('状态栏元素获取结果:');
    console.log('nodeCountSpan:', window.nodeCountSpan);
    console.log('linkCountSpan:', window.linkCountSpan);
    console.log('downloadBtn:', window.downloadBtn);
    console.log('loadBtn:', window.loadBtn);
    console.log('undoBtn:', window.undoBtn);
    console.log('redoBtn:', window.redoBtn);

    //=============================================================================
    // 事件监听器绑定
    //=============================================================================
    
    // 功能标签页切换事件
    const functionTabs = document.querySelectorAll('.function-tab');
    functionTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            functionTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.function-module').forEach(m => m.classList.remove('active'));
            
            // 添加当前标签的活动状态
            this.classList.add('active');
            const targetModule = document.getElementById(`function-${tabId}`);
            if (targetModule) {
                targetModule.classList.add('active');
            }
            
            console.log('切换到功能标签:', tabId);
        });
    });
    
    // 迷思概念探查事件
    if (window.exploreMisconceptionBtn) {
        window.exploreMisconceptionBtn.addEventListener('click', function() {
            console.log('迷思概念探查按钮被点击');
            const topic = window.misconceptionTopicInput.value.trim();
            if (!topic) {
                showMessage('请输入知识点', 'warning');
                return;
            }
            
            // 设置按钮加载状态
            window.exploreMisconceptionBtn.classList.add('loading');
            window.exploreMisconceptionBtn.textContent = '探查中...';
            window.exploreMisconceptionBtn.disabled = true;
            
            console.log('开始探查迷思概念，知识点:', topic);
            
            // 调用迷思概念探查功能
            exploreMisconception(topic);
        });
    }
    
    // 焦点问题生成概念图事件
    if (window.keywordBtn) {
        window.keywordBtn.addEventListener('click', function() {
            console.log('焦点问题生成按钮被点击');
            const keyword = window.keywordInput.value.trim();
            if (!keyword) {
                showMessage('请输入焦点问题', 'warning');
                return;
            }
            
            // 设置按钮加载状态
            window.keywordBtn.classList.add('loading');
            window.keywordBtn.textContent = '生成中...';
            window.keywordBtn.disabled = true;
            
            console.log('开始生成概念图，焦点问题:', keyword);
            generateConceptMapWithLLM('keyword', { keyword: keyword });
        });
    }

    // 文本分析生成概念图事件
    if (window.descriptionBtn) {
        window.descriptionBtn.addEventListener('click', function() {
            console.log('文本分析按钮被点击');
            const description = window.descriptionTextarea.value.trim();
            if (!description) {
                showMessage('请输入描述文本', 'warning');
                return;
            }
            
            // 设置按钮加载状态
            window.descriptionBtn.classList.add('loading');
            window.descriptionBtn.textContent = '生成中...';
            window.descriptionBtn.disabled = true;
            
            console.log('开始生成概念图，描述:', description);
            generateConceptMapWithLLM('description', { description: description });
        });
    }
    
    // 支架概念图生成事件
    if (window.generateScaffoldConceptMapBtn) {
        window.generateScaffoldConceptMapBtn.addEventListener('click', function() {
            console.log('支架概念图生成按钮被点击');
            const focusQuestion = window.scaffoldFocusQuestionInput?.value.trim();
            if (!focusQuestion) {
                showMessage('请输入焦点问题', 'warning');
                return;
            }
            
            // 检查是否选择了支架类型
            const scaffoldType = window.scaffoldTypeHigh?.checked ? 'high' : 
                                window.scaffoldTypeLow?.checked ? 'low' : null;
            
            if (!scaffoldType) {
                showMessage('请选择支架类型（高支架或低支架）', 'warning');
                return;
            }
            
            // 设置按钮加载状态
            window.generateScaffoldConceptMapBtn.classList.add('loading');
            window.generateScaffoldConceptMapBtn.textContent = '生成中...';
            window.generateScaffoldConceptMapBtn.disabled = true;
            
            console.log('开始生成支架概念图，焦点问题:', focusQuestion, '支架类型:', scaffoldType);
            
            // 调用支架概念图生成功能
            if (scaffoldType === 'high') {
                generateHighScaffoldConceptMap(focusQuestion);
            } else {
                // 低支架模式
                generateLowScaffoldConceptMap(focusQuestion);
            }
        });
    }

    // 从图片生成概念图按钮事件
    if (window.uploadImageForGenerationBtn && window.uploadImageForGenerationInput) {
        // 点击上传按钮触发文件选择
        window.uploadImageForGenerationBtn.addEventListener('click', function() {
            console.log('从图片生成概念图按钮被点击');
            window.uploadImageForGenerationInput.click();
        });
        
        // 文件选择后的处理
        window.uploadImageForGenerationInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                console.log('选择的文件:', file.name);
                
                // 验证文件类型
                if (!file.type.startsWith('image/')) {
                    showMessage('请选择图片文件', 'warning');
                    return;
                }
                
                // 验证文件大小（限制为10MB）
                if (file.size > 10 * 1024 * 1024) {
                    showMessage('图片文件大小不能超过10MB', 'warning');
                    return;
                }
                
                showMessage('图片上传中，准备生成概念图...', 'info');
                console.log('图片文件信息 - 名称:', file.name, '大小:', (file.size / 1024).toFixed(2) + 'KB', '类型:', file.type);
                
                // 读取并生成概念图
                const reader = new FileReader();
                reader.onload = function(e) {
                    console.log('图片读取完成，开始生成概念图...');
                    
                    // 生成概念图
                    generateConceptMapFromImage(e.target.result, file.name);
                    
                    // 清空文件输入框，允许重新上传同一文件
                    window.uploadImageForGenerationInput.value = '';
                };
                reader.onerror = function() {
                    showMessage('图片读取失败，请重试', 'error');
                    // 清空文件输入框
                    window.uploadImageForGenerationInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 上传图片按钮事件（用于概念图评价）
    if (window.uploadImageBtn && window.uploadImageInput) {
        // 点击上传按钮触发文件选择
        window.uploadImageBtn.addEventListener('click', function() {
            console.log('上传图片按钮被点击');
            window.uploadImageInput.click();
        });
        
        // 文件选择后的处理
        window.uploadImageInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                console.log('选择的文件:', file.name);
                
                // 验证文件类型
                if (!file.type.startsWith('image/')) {
                    showMessage('请选择图片文件', 'warning');
                    return;
                }
                
                // 验证文件大小（限制为10MB）
                if (file.size > 10 * 1024 * 1024) {
                    showMessage('图片文件大小不能超过10MB', 'warning');
                    return;
                }
                
                showMessage('图片上传中...', 'info');
                console.log('图片文件信息 - 名称:', file.name, '大小:', (file.size / 1024).toFixed(2) + 'KB', '类型:', file.type);
                
                // 读取并显示图片
                const reader = new FileReader();
                reader.onload = function(e) {
                    console.log('图片读取完成，开始显示...');
                    
                    // 显示上传的图片
                    displayUploadedImage(e.target.result, file.name);
                    
                    showMessage('图片上传成功: ' + file.name, 'success');
                    
                    // 清空文件输入框，允许重新上传同一文件
                    window.uploadImageInput.value = '';
                };
                reader.onerror = function() {
                    showMessage('图片读取失败，请重试', 'error');
                    // 清空文件输入框
                    window.uploadImageInput.value = '';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 重置视图按钮事件
    if (window.resetBtn) {
        window.resetBtn.addEventListener('click', function() {
            console.log('重置视图按钮被点击');
            resetView();
        });
    }

    // 导出图片按钮事件
    if (window.exportBtn) {
        window.exportBtn.addEventListener('click', function() {
            console.log('导出图片按钮被点击');
            exportConceptMap();
        });
    }

    // 编辑工具栏事件绑定
    if (window.addNodeBtn) {
        window.addNodeBtn.addEventListener('click', function() {
            console.log('添加节点按钮被点击');
            addNewNode();
        });
    }

    if (window.deleteNodeBtn) {
        window.deleteNodeBtn.addEventListener('click', function() {
            console.log('删除节点按钮被点击');
            deleteSelectedNode();
        });
    }

    if (window.editNodeBtn) {
        window.editNodeBtn.addEventListener('click', function() {
            console.log('编辑节点按钮被点击');
            editSelectedNode();
        });
    }

    if (window.addLinkBtn) {
        window.addLinkBtn.addEventListener('click', function() {
            console.log('添加连线按钮被点击');
            addNewLink();
        });
    }

    if (window.deleteLinkBtn) {
        window.deleteLinkBtn.addEventListener('click', function() {
            console.log('删除连线按钮被点击');
            deleteSelectedLink();
        });
    }

    if (window.editLinkBtn) {
        window.editLinkBtn.addEventListener('click', function() {
            console.log('编辑连线按钮被点击');
            editSelectedLink();
        });
    }

    // 🔴 布局选择已固定为改进的Sugiyama算法，无需事件监听
    // 🔴 自动布局按钮已删除
    
    // 🔴 新增按钮事件绑定
    if (window.addFocusQuestionBtn) {
        window.addFocusQuestionBtn.addEventListener('click', function() {
            console.log('添加焦点问题按钮被点击');
            addFocusQuestion();
        });
    }
    
    if (window.addAggregatedLinkBtn) {
        window.addAggregatedLinkBtn.addEventListener('click', function() {
            console.log('聚合连接按钮被点击');
            addAggregatedLink();
        });
    }
    
    if (window.addSameLayerLinkBtn) {
        window.addSameLayerLinkBtn.addEventListener('click', function() {
            console.log('同级连接按钮被点击');
            addSameLayerLink();
        });
    }
    
    if (window.addSameLayerAggregatedLinkBtn) {
        window.addSameLayerAggregatedLinkBtn.addEventListener('click', function() {
            console.log('同级聚合连接按钮被点击');
            addSameLayerAggregatedLink();
        });
    }

    // 状态栏按钮事件
    if (window.downloadBtn) {
        window.downloadBtn.addEventListener('click', function() {
            // 检查是否在支架模式
            if (this.dataset.scaffoldMode === 'true') {
                console.log('导出专家图按钮被点击');
                exportExpertConceptMap();
            } else {
                console.log('下载图片按钮被点击');
                downloadConceptMapImage();
            }
        });
    }
    
    // 导出支架概念图按钮事件
    const exportScaffoldBtn = document.getElementById('exportScaffoldBtn');
    if (exportScaffoldBtn) {
        exportScaffoldBtn.addEventListener('click', function() {
            console.log('导出支架概念图按钮被点击');
            exportScaffoldConceptMap();
        });
    }

    if (window.loadBtn) {
        window.loadBtn.addEventListener('click', function() {
            console.log('加载数据按钮被点击');
            loadConceptMap();
        });
    }

    if (window.undoBtn) {
        window.undoBtn.addEventListener('click', function() {
            console.log('撤销按钮被点击');
            undoOperation();
        });
    }

    if (window.redoBtn) {
        window.redoBtn.addEventListener('click', function() {
            console.log('重做按钮被点击');
            redoOperation();
        });
    }

    // 键盘快捷键事件监听
    document.addEventListener('keydown', function(e) {
        // 如果正在输入文本，不处理快捷键
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            // 如果按的是 Delete 或 Backspace，且不在输入框中，可以删除
            if ((e.key === 'Delete' || e.key === 'Backspace') && 
                activeElement.tagName !== 'INPUT' && 
                activeElement.tagName !== 'TEXTAREA') {
                // 允许删除操作
            } else {
                return; // 其他快捷键在输入框中不处理
            }
        }
        
        // Ctrl+Z: 撤销
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            console.log('Ctrl+Z 被按下，执行撤销操作');
            if (typeof undoOperation === 'function') {
                undoOperation();
            }
            return;
        }
        
        // Ctrl+Shift+Z 或 Ctrl+Y: 重做
        if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
            e.preventDefault();
            console.log('Ctrl+Shift+Z 或 Ctrl+Y 被按下，执行重做操作');
            if (typeof redoOperation === 'function') {
                redoOperation();
            }
            return;
        }
        
        // Ctrl+A: 全选节点
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            console.log('Ctrl+A 被按下，执行全选节点操作');
            if (typeof selectAllNodes === 'function') {
                selectAllNodes();
            }
            return;
        }
        
        // Delete 或 Backspace: 删除选中的节点或连线
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // 检查是否有选中的节点
            if (selectedNodeId) {
                e.preventDefault();
                console.log('Delete/Backspace 被按下，删除选中的节点:', selectedNodeId);
                if (typeof deleteSelectedNode === 'function') {
                    deleteSelectedNode();
                }
                return;
            }
            
            // 检查是否有选中的连线
            if (selectedLinkId) {
                e.preventDefault();
                console.log('Delete/Backspace 被按下，删除选中的连线:', selectedLinkId);
                if (typeof deleteSelectedLink === 'function') {
                    deleteSelectedLink();
                }
                return;
            }
        }
    });

    // 初始化页面
    initializePage();
});

//=============================================================================
// 新增功能函数
//=============================================================================

/**
 * 添加焦点问题
 * 创建一个新的概念图（如果还没有），并显示一个空的焦点问题框供用户编辑
 */
function addFocusQuestion() {
    // 确保概念图已初始化
    if (!window.currentGraphData) {
        window.currentGraphData = { 
            nodes: [], 
            links: [],
            layoutType: 'straight'
        };
    }
    
    // 显示概念图展示区域
    const conceptMapDisplay = document.querySelector('.concept-map-display');
    if (conceptMapDisplay) {
        conceptMapDisplay.style.display = 'flex';
    }
    
    // 隐藏占位符
    if (window.graphPlaceholder) {
        window.graphPlaceholder.style.display = 'none';
    }
    
    // 设置空的焦点问题
    window.focusQuestion = '焦点问题：';
    
    // 绘制图形（即使没有节点，也要显示SVG）
    if (typeof window.drawGraph === 'function' && window.currentGraphData) {
        window.drawGraph(window.currentGraphData);
    }
    
    // 显示焦点问题框
    if (typeof window.displayFocusQuestion === 'function') {
        window.displayFocusQuestion();
        
        // 延迟一下，确保焦点问题框已经渲染，然后自动触发编辑模式
        setTimeout(() => {
            if (typeof window.editFocusQuestionText === 'function') {
                window.editFocusQuestionText();
            }
        }, 100);
    }
}

/**
 * 添加聚合连接
 * 进入拖拽式聚合连接创建模式（默认两个分支）
 */
function addAggregatedLink() {
    if (!window.currentGraphData || window.currentGraphData.nodes.length < 2) {
        showMessage('需要至少两个节点才能添加聚合连接', 'warning');
        return;
    }
    
    // 🔴 检查是否已经在聚合连接模式中（通过按钮文本和全局状态判断）
    const btn = document.getElementById('addAggregatedLinkBtn');
    const isInMode = (btn && btn.textContent === '取消连线') || 
                     (window.currentLinkCreationType === 'aggregated');
    
    if (isInMode) {
        // 如果已经在聚合连接模式中，退出模式
        if (typeof window.exitClickLinkCreationMode === 'function') {
            window.exitClickLinkCreationMode();
        }
        return;
    }
    
    // 调用拖拽式连线创建功能
    if (typeof window.enterDragLinkCreationMode === 'function') {
        window.enterDragLinkCreationMode('aggregated');
    } else {
        showMessage('连线创建功能未初始化', 'error');
    }
}

/**
 * 添加同级连接
 * 进入拖拽式同级连接创建模式（连接同一层级的两个节点）
 */
function addSameLayerLink() {
    if (!window.currentGraphData || window.currentGraphData.nodes.length < 2) {
        showMessage('需要至少两个节点才能添加同级连接', 'warning');
        return;
    }
    
    // 🔴 检查是否已经在同级连接模式中（通过按钮文本和全局状态判断）
    const btn = document.getElementById('addSameLayerLinkBtn');
    const isInMode = (btn && btn.textContent === '取消连线') || 
                     (window.currentLinkCreationType === 'sameLayer');
    
    if (isInMode) {
        // 如果已经在同级连接模式中，退出模式
        if (typeof window.exitClickLinkCreationMode === 'function') {
            window.exitClickLinkCreationMode();
        }
        return;
    }
    
    // 调用拖拽式连线创建功能
    if (typeof window.enterDragLinkCreationMode === 'function') {
        window.enterDragLinkCreationMode('sameLayer');
    } else {
        showMessage('连线创建功能未初始化', 'error');
    }
}

/**
 * 添加同级聚合连接
 * 进入拖拽式同级聚合连接创建模式（默认两个分支）
 */
function addSameLayerAggregatedLink() {
    if (!window.currentGraphData || window.currentGraphData.nodes.length < 2) {
        showMessage('需要至少两个节点才能添加同级聚合连接', 'warning');
        return;
    }
    
    // 🔴 检查是否已经在同级聚合连接模式中（通过按钮文本和全局状态判断）
    const btn = document.getElementById('addSameLayerAggregatedLinkBtn');
    const isInMode = (btn && btn.textContent === '取消连线') || 
                     (window.currentLinkCreationType === 'sameLayerAggregated');
    
    if (isInMode) {
        // 如果已经在同级聚合连接模式中，退出模式
        if (typeof window.exitClickLinkCreationMode === 'function') {
            window.exitClickLinkCreationMode();
        }
        return;
    }
    
    // 调用拖拽式连线创建功能
    if (typeof window.enterDragLinkCreationMode === 'function') {
        window.enterDragLinkCreationMode('sameLayerAggregated');
    } else {
        showMessage('连线创建功能未初始化', 'error');
    }
}

