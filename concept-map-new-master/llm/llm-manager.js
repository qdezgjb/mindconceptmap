// AI服务管理器模块 (LLM Manager)
// 统一管理与大模型API的交互，包括三元组提取和概念图生成
// 
// 核心职责：
// - 管理和协调所有AI服务（三元组提取、概念图生成）
// - 提供统一的对外接口（LLMManager）
// - API配置和端口管理
// - 集成介绍文本生成服务（可选依赖）

/**
 * API配置和端口管理
 */
class LLMConfig {
    constructor() {
        this.API_BASE_URL = 'http://localhost:5000/api';
        this.currentPort = null; // 缓存当前端口
    }
    
    /**
     * 更新API地址（带缓存优化）
     * @param {boolean} force - 是否强制更新并打印日志
     */
    updateApiUrl(force = false) {
        let newPort = null;
        
        if (window.portChecker) {
            newPort = window.portChecker.getCurrentPort();
        } else {
            // 备用方案：从localStorage获取
            const savedPort = localStorage.getItem('flask_port');
            newPort = savedPort ? parseInt(savedPort) : 5000;
        }
        
        // 只有端口变化或强制更新时才打印日志
        if (newPort !== this.currentPort || force) {
            const oldPort = this.currentPort;
            this.currentPort = newPort;
            this.API_BASE_URL = `http://localhost:${newPort}/api`;
            
            if (force || oldPort === null) {
                // 首次初始化时打印详细信息
                console.log(`✅ API端口已配置: ${newPort}`);
                console.log(`   API地址: ${this.API_BASE_URL}`);
            } else if (oldPort !== newPort) {
                // 端口变化时打印警告
                console.warn(`⚠️ API端口已变更: ${oldPort} → ${newPort}`);
                console.log(`   新API地址: ${this.API_BASE_URL}`);
            }
        }
        // 如果端口未变化，静默更新，不打印日志
    }
}

/**
 * 三元组提取服务
 */
class TripleExtractionService {
    constructor(config) {
        this.config = config;
    }
    
    /**
     * 从文本内容中提取三元组
     * @param {string} introText - 输入文本
     * @returns {Promise<Array>} 三元组数组
     */
    async extractTriplesFromIntro(introText) {
        console.log('🔍 开始三元组提取，文本长度:', introText.length);
        console.log('   文本内容（前200字符）:', introText.substring(0, 200));
        
        try {
            // 静默更新API地址（不打印日志，除非端口变化）
            this.config.updateApiUrl();
            
            // 构建三元组提取提示词（简化版，减少处理时间）
            const triplePrompt = this.buildTriplePrompt(introText);
            
            console.log('   提示词长度:', triplePrompt.length, '字符');
            
            // 直接调用API
            const requestUrl = `${this.config.API_BASE_URL}/chat`;
            const requestBody = { message: triplePrompt };
            
            // 添加超时控制（75秒，略大于后端的60秒超时）
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.error('❌ 请求超时（75秒），正在取消...');
                controller.abort();
            }, 75000); // 75秒超时
            
            try {
                console.log('📤 [三元组提取] 发送请求');
                console.log('   URL:', requestUrl);
                console.log('   时间戳:', new Date().toISOString());
                const fetchStart = performance.now();
                
                const response = await fetch(requestUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                
                const fetchDuration = ((performance.now() - fetchStart) / 1000).toFixed(2);
                clearTimeout(timeoutId);
                
                console.log(`✅ 收到响应（${fetchDuration}s）- 状态: ${response.status}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    console.log(`   AI返回内容长度: ${result.response.length} 字符`);
                    
                    // 解析三元组（调用data-processing.js中的全局函数）
                    if (typeof window.parseTriplesFromResponse !== 'function') {
                        console.error('❌ parseTriplesFromResponse 函数未定义，请检查 data-processing.js 是否正确加载');
                        console.error('当前 window 对象上的相关函数:', {
                            parseTriplesFromResponse: typeof window.parseTriplesFromResponse,
                            convertTriplesToConceptData: typeof window.convertTriplesToConceptData,
                            convertToD3Format: typeof window.convertToD3Format
                        });
                        return {
                            success: false,
                            error: '三元组解析函数未加载',
                            message: '系统错误：三元组解析函数未加载，请刷新页面重试'
                        };
                    }
                    
                    const triples = window.parseTriplesFromResponse(result.response);
                    console.log(`✅ 成功提取 ${triples.length} 个三元组`);
                    
                    if (triples.length === 0) {
                        console.warn('⚠️ 未能从AI响应中解析到任何三元组');
                        console.log('AI完整响应内容:', result.response);
                        return {
                            success: false,
                            error: '未能解析到三元组',
                            message: 'AI返回了内容，但未能提取到有效的三元组。请检查AI返回格式是否正确。',
                            rawResponse: result.response
                        };
                    }
                    
                    return {
                        success: true,
                        triples: triples,
                        message: `成功从文本中提取 ${triples.length} 个三元组`,
                        rawResponse: result.response
                    };
                } else {
                    console.error('❌ AI响应失败:', result.error);
                    return {
                        success: false,
                        error: result.error || '未知错误',
                        message: `三元组提取失败: ${result.error || '未知错误'}`
                    };
                }
                
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    console.error('❌ 请求超时（75秒）');
                    throw new Error('请求超时：大模型处理时间过长。建议：1) 稍后重试 2) 检查网络连接');
                }
                throw error;
            }
            
        } catch (error) {
            console.error('❌ 三元组提取失败:', error);
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            let userMessage = '网络请求失败';
            if (error.message.includes('超时')) {
                userMessage = error.message;
            } else if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
                userMessage = '无法连接到后端服务，请确认：1) 后端服务是否启动 2) 端口是否正确(5000) 3) 网络连接是否正常';
            } else {
                userMessage = `请求失败: ${error.message}`;
            }
            
            return {
                success: false,
                error: error.message,
                message: userMessage
            };
        }
    }
    
    /**
     * 构建三元组提取提示词（层级标记版本）
     * @param {string} introText - 输入文本
     * @returns {string} 提示词
     */
    buildTriplePrompt(introText) {
        // 层级标记提取提示词：添加层级标记，只在相邻层之间提取三元组关系
        return `# 重要任务：从文本中提取概念关系，构建分层知识图谱

## ⚠️ 核心规则（必须严格遵守）：
- **🔴🔴🔴 最重要：严格按文本提取，禁止自行生成新内容**
  - **所有概念和关系词必须完全来源于提供的文本**
  - **绝对禁止自行创造、补充或生成文本中不存在的概念、节点或关系**
  - **如果文本中没有足够的内容，只能提取文本中实际存在的部分，不能自行添加**
  - **所有三元组中的概念词必须能在文本中找到对应的表述或直接引用**
- **为每个概念添加层级标记（L1、L2、L3、L4、L5等，根据内容自然确定层数）**
- **只能从高层到低层提取三元组**（L1→L2、L2→L3、L3→L4、L4→L5等，单向流动，必须相邻层）
- **允许同层提取**（L2→L2、L3→L3、L4→L4等同层连接，使用圆弧连接）
- **严格禁止反向提取**（绝对不能从低层到高层，如L2→L1、L3→L2、L4→L3等）
- **严格禁止跨层提取**（绝对不能从L1直接连接到L3或L4，必须逐层连接）
- **总三元组数：20-28个（建议范围，如果文本内容不足，以实际可提取的数量为准）**
- **内容长度要求：约300字左右**
- **层级完整性要求：每一层都必须有节点（如果文本内容不足，允许减少层数）**
- **⭐ 层数确定：根据文本内容的复杂度和层次结构自然确定层数，可以是3层、4层、5层或更多，不限制在4层**
- **⭐ 相邻层连接强制要求（最重要）：**
  - **相邻层之间必须提取足够的三元组**（如L1→L2至少4个，L2→L3至少6个，L3→L4至少6个等）
  - 这些三元组必须覆盖不同的节点组合，确保层次间的充分连接
  - **但前提是文本中确实存在这些内容，不能为了满足数量要求而自行生成**

## 层级划分方法（可根据内容扩展）：
1. **L1（第一层）**：核心主题概念（通常1个节点）
2. **L2（第二层）**：主要分类或维度
3. **L3（第三层）**：具体分类或子维度
4. **L4（第四层）**：具体细节或实例
5. **L5、L6等（更深层）**：根据内容需要，可以继续细分（如需要更详细的层次结构）

## 提取规则：
1. **🔴🔴🔴 严格按文本提取（最重要）：**
   - **仔细阅读提供的文本，只提取文本中明确提到或隐含的概念**
   - **所有概念词必须能在文本中找到对应的表述**
   - **如果文本中没有某个概念，绝对不能自行创造或补充**
   - **关系词也必须基于文本中实际存在的关系，不能自行推断或创造**
2. 将文本按句号、分号、逗号等标点符号分割成行
3. 分析每行内容，确定概念的层级归属（只分析文本中实际存在的概念）
4. **节点数量**：根据文本内容自然确定，不设限制，但必须全部来源于文本
4. **层级数量和完整性要求**：
   - **根据文本内容的复杂度和层次结构自然确定层数**，可以是3层、4层、5层或更多，不限制在4层
   - 必须确保每一层都有至少1个节点
   - 不能出现空层的情况
5. **⭐ 相邻层连接强制要求（从高到低，最关键）**：
   - **相邻层之间必须提取足够的三元组**（如L1→L2至少4个，L2→L3至少6个，L3→L4至少6个，L4→L5至少6个等）
   - 这些三元组必须覆盖不同的源节点和目标节点，确保层次间的充分连接
   - 每个层级的节点应该至少有一个连接到下一层
   - **🚫🚫🚫 绝对禁止孤立节点：每个节点都必须至少有一条连接线（要么作为源节点，要么作为目标节点，或者两者都是）**
   - **如果某个节点没有任何连接线，必须删除该节点或为其添加连接**
6. **只能从高层到低层提取关系**（L1→L2、L2→L3、L3→L4、L4→L5等，单向，必须相邻层）
7. **总三元组数量分配**（根据实际层数调整）：
   - L1→L2：4-6个三元组
   - L2→L3：6-10个三元组
   - L3→L4：6-10个三元组
   - L4→L5：6-10个三元组（如果存在）
   - 更多层级以此类推
   - 总计：20-28个三元组
8. **允许同层提取（L2→L2、L3→L3、L4→L4等），禁止跨层和反向提取**
9. **每层概念只能连接到下一层（向下）**，如L1→L2、L2→L3、L3→L4、L4→L5等
10. **最底层不能再向下连接**
13. **根据文本内容自然提取节点，不设数量上限**
14. **内容长度控制：确保提取的内容适合约300字的介绍**

## ⭐ 相邻层连接强制要求（最重要，必须首先确保）：
**在开始提取之前，必须计划好层间连接，确保：**
1. **L1→L2：至少4个三元组**
   - 从L1的唯一节点（核心主题）连接到L2的至少4个不同节点
   - 覆盖L2层的主要节点，建立核心主题与主要分类的关系
   
2. **L2→L3：至少6个三元组**
   - 从L2的不同节点连接到L3的至少6个不同节点
   - 每个L2节点尽量连接到L3层的节点
   - 确保L3层的节点都有来自L2的连接
   - **🚫 绝对禁止：L3层中不能有任何孤立节点（没有任何连接线的节点）**
   
3. **L3→L4：至少6个三元组**
   - 从L3的不同节点连接到L4的至少6个不同节点
   - 每个L3节点尽量连接到L4层的节点
   - 确保L4层的节点都有来自L3的连接
   - **🚫 绝对禁止：L4层中不能有任何孤立节点（没有任何连接线的节点）**

**这是最关键的要求，必须在提取过程中时刻记住！**

## 🔍 层级验证步骤（必须执行）：
在输出每个三元组之前，必须进行以下检查：
1. **🔴🔴🔴 相似内容检查（最重要，必须首先执行）：**
   - 检查概念1是否与已提取的其他概念相似或重复
   - 检查概念2是否与已提取的其他概念相似或重复
   - 如果发现相似概念，必须合并为一个节点，使用统一的表述
   - 确保不会因为表述的细微差异而创建重复节点
2. **检查概念1的层级**：确定它是L1、L2、L3还是L4
3. **检查概念2的层级**：确定它是L1、L2、L3还是L4
4. **检查节点层级**：确保节点层级合理分配
5. **验证层级关系（只允许从高到低）**：
   - 如果概念1是L1，概念2必须是L2（L1→L2）
   - 如果概念1是L2，概念2必须是L3（L2→L3）
   - 如果概念1是L3，概念2必须是L4（L3→L4）
   - 如果概念1是L4，不能再向下连接
6. **拒绝无效连接**：
   - ❌ 拒绝L2-L1、L3-L2、L4-L3（反向，从低到高）
   - ❌ 拒绝L1-L3、L1-L4（跨层）
   - ❌ 拒绝L2-L4（跨层）
   - ✅ 允许L2-L2、L3-L3、L4-L4、L5-L5等同层连接（使用圆弧连接）
   - ❌ 拒绝L3-L1、L4-L1、L4-L2（反向跨层）
7. **层级完整性检查**：
   - ✓ 确保L1层至少有1个节点
   - ✓ 确保L2层至少有1个节点
   - ✓ 确保L3层至少有1个节点
   - ✓ 确保L4层至少有1个节点
8. **⭐ 相邻层连接检查（从高到低，最关键）**：
   - ✓ **确保L1→L2之间有至少 4 个三元组**（从L1到L2的不同节点）
   - ✓ **确保L2→L3之间有至少 6 个三元组**（从L2的不同节点到L3的不同节点）
   - ✓ **确保L3→L4之间有至少 6 个三元组**（从L3的不同节点到L4的不同节点）
   - ✓ 验证每对相邻层之间的三元组数量是否充足
   - ✓ 验证连接是否覆盖了各层的不同节点
   - ✓ **🚫🚫🚫 绝对禁止孤立节点检查：确保每个节点都至少有一条连接线（作为源节点或目标节点）**
   - ✓ **如果发现任何节点没有任何连接线，必须删除该节点或为其添加连接**
9. **内容长度检查**：
   - ✓ 确保提取的内容适合约300字的介绍
   - ✓ 避免过于冗长或过于简短的描述

## 输出格式（严格遵守）：
每行一个三元组，格式为：(概念1, 关系词, 概念2, 层级关系)

层级关系标记（只允许从高到低的相邻层）：
- L1-L2: 第一层到第二层的关系（✅ 允许）
- L2-L3: 第二层到第三层的关系（✅ 允许）
- L3-L4: 第三层到第四层的关系（✅ 允许）
- L4-L5: 第四层到第五层的关系（✅ 允许，如果存在）
- L5-L6: 第五层到第六层的关系（✅ 允许，如果存在）
- 更多层级以此类推（✅ 允许相邻层连接）
- ❌ 禁止反向连接（如L2-L1、L3-L2、L4-L3、L5-L4等，从低到高）
- ❌ 禁止跨层连接（如L1-L3、L1-L4、L2-L4、L2-L5等，必须逐层连接）
- ✅ 允许同层连接（如L2-L2、L3-L3、L4-L4等，使用圆弧连接）

## 关系词选择（⭐ 关键：必须准确反映两个节点之间的具体关系）：
**关系词要简洁（2-4字），不含助词（如"的"、"了"等），但能让"概念1 + 关系词 + 概念2"连读成通顺且语义准确的话**

**⭐ 核心原则：根据两个节点的具体内容，选择最能准确描述它们之间关系的关系词，避免使用过于通用的词汇**

### 关系词类型（根据节点内容灵活选择）：

**1. 包含/组成关系**（当概念1包含或由概念2组成时）：
- 包括、包含、涵盖、含有、构成、组成、分为、分为、划分为
- 示例："人工智能" + "包括" + "机器学习"、"计算机系统" + "由" + "硬件和软件" + "构成"

**2. 因果关系**（当概念1导致或引起概念2时）：
- 导致、引发、造成、产生、引起、促使、推动、促进、促成、带来
- 示例："环境污染" + "导致" + "生态破坏"、"技术进步" + "推动" + "社会发展"

**3. 时间/顺序关系**（当概念1在时间上先于或后于概念2时）：
- 先于、后于、始于、终于、经过、经历、进入、发展到
- 示例："种子" + "经过" + "发芽" + "长成" + "植物"、"工业革命" + "始于" + "18世纪"

**4. 功能/用途关系**（当概念1用于实现概念2，或概念2是概念1的功能时）：
- 用于、应用于、服务于、实现、支持、提供、满足、解决
- 示例："算法" + "用于" + "数据处理"、"教育" + "服务于" + "人才培养"

**5. 依赖/基础关系**（当概念1依赖于概念2，或概念2是概念1的基础时）：
- 需要、基于、依赖、借助、通过、依靠、建立在、来源于
- 示例："深度学习" + "基于" + "神经网络"、"经济发展" + "需要" + "资源支持"

**6. 属性/特征关系**（当概念2是概念1的属性或特征时）：
- 具有、表现为、特征是、特点是、体现在、显示为
- 示例："民主制度" + "具有" + "选举权"、"市场经济" + "特点是" + "自由竞争"

**7. 影响/作用关系**（当概念1对概念2产生影响或作用时）：
- 影响、作用于、改变、改善、提升、降低、增强、削弱
- 示例："教育" + "影响" + "个人发展"、"政策" + "作用于" + "经济运行"

**8. 归属/分类关系**（当概念2属于概念1的类别时）：
- 属于、归类为、划分为、分类为、归入
- 示例："哺乳动物" + "属于" + "脊椎动物"、"诗歌" + "归类为" + "文学体裁"

**9. 对比/区别关系**（当概念1与概念2形成对比或区别时）：
- 区别于、不同于、相对于、对比于、相比
- 示例："民主制" + "区别于" + "专制制"、"传统方法" + "不同于" + "现代方法"

**10. 转化/演变关系**（当概念1转化为或演变为概念2时）：
- 转化为、演变为、发展成为、转变为、变成
- 示例："蒸汽机" + "演变为" + "内燃机"、"封建社会" + "转变为" + "资本主义社会"

**11. 条件/前提关系**（当概念2是概念1的条件或前提时）：
- 需要、要求、前提是、条件是、必须、依赖于
- 示例："成功" + "需要" + "努力"、"健康" + "前提是" + "良好生活习惯"

**12. 结果/后果关系**（当概念2是概念1的结果或后果时）：
- 结果是、后果是、产生、形成、造成、带来
- 示例："学习" + "结果是" + "知识积累"、"污染" + "后果是" + "环境恶化"

### ⭐ 关系词选择指导原则：

1. **语义准确性优先**：关系词必须准确反映两个节点之间的实际关系，不能使用过于宽泛的词汇
2. **上下文相关**：根据两个节点的具体内容，选择最能体现它们之间关系的关系词
3. **避免通用词汇**：尽量避免使用"是"、"有"、"包括"等过于通用的词汇，除非它们确实是最准确的表达
4. **语义丰富性**：优先选择语义更丰富、更具体的关系词，如"引发"比"导致"更具体，"演变为"比"变成"更准确
5. **可读性**：确保"概念1 + 关系词 + 概念2"能连读成通顺且语义清晰的句子

### ✅ 优秀示例（根据节点内容选择准确的关系词）：
- ✓ 优秀："清政腐败" + "引发" + "民众不满" → 准确反映因果关系
- ✓ 优秀："机器学习" + "基于" + "统计学原理" → 准确反映依赖关系
- ✓ 优秀："工业革命" + "推动" + "城市化进程" → 准确反映影响关系
- ✓ 优秀："民主制度" + "区别于" + "专制制度" → 准确反映对比关系
- ✓ 优秀："封建社会" + "演变为" + "资本主义社会" → 准确反映演变关系
- ✓ 优秀："环境污染" + "导致" + "生态破坏" → 准确反映因果关系
- ✓ 优秀："教育投入" + "促进" + "人才培养" → 准确反映促进作用

### ❌ 较差示例（关系词过于通用或不准确）：
- ✗ 较差："辛亥革命" + "有" + "革命思想" → 单字动词，语义不明确
- ✗ 较差："革命" + "的原因是" + "腐败" → 包含助词"的"，不符合格式
- ✗ 较差："人工智能" + "包括" + "深度学习" → 虽然正确，但"涵盖"或"包含"可能更准确
- ✗ 较差："经济发展" + "是" + "社会进步" → 使用"是"过于简单，应使用"推动"或"促进"

### ❌ 禁止使用：
- 单字关系词如"是"、"有"、"为"（除非确实是最准确的表达）
- 包含助词的关系词如"的背景是"、"导致了"、"的原因"
- 过于宽泛且不准确的关系词

### 🔴🔴🔴 语义逻辑验证（极其重要）：
**每个三元组必须在语义上成立，"概念1 + 关系词 + 概念2" 必须是一个逻辑正确的陈述！**

**常见错误类型及修正：**
1. **目标/结果混淆（最常见错误）**：
   - ❌ 错误："建立君主立宪" + "目标为" + "未成功" → 语义错误！"未成功"不是目标，是结果
   - ✅ 正确："建立君主立宪" + "结果是" + "失败" 或 "君主立宪运动" + "以...告终" + "失败"
   - ❌ 错误："戊戌变法" + "目标是" + "被镇压" → 语义错误！"被镇压"是结果不是目标
   - ✅ 正确："戊戌变法" + "目标是" + "政治改革"，另起一条 "戊戌变法" + "结果是" + "被镇压"
   
2. **因果关系颠倒**：
   - ❌ 错误："社会进步" + "导致" + "教育发展" → 因果可能颠倒
   - ✅ 正确："教育发展" + "促进" + "社会进步"

3. **概念类型不匹配**：
   - 行动/尝试 + "目标为/目标是" + 应接具体目标，不能接结果状态
   - 行动/尝试 + "结果是/导致" + 应接结果状态
   - 原因/条件 + "引发/导致" + 应接结果/后果

**验证步骤（每个三元组必须执行）**：
1. 判断概念1的类型（行动?事件?状态?目标?）
2. 判断概念2的类型（行动?事件?状态?目标?结果?）
3. 检查关系词是否能正确连接这两种类型的概念
4. 朗读"概念1 + 关系词 + 概念2"，确认是否是一个合理的陈述
5. 如果语义不通，必须调整关系词或拆分为多个三元组

## 概念要求：
1. **🔴🔴🔴 最重要：严格按文本提取概念**
   - **所有概念词必须完全来源于提供的文本，不能自行创造、补充或生成**
   - **概念词可以是文本中的直接引用，也可以是文本中明确提到或隐含的概念**
   - **如果文本中没有某个概念，绝对不能自行添加或创造**
2. **🔴🔴🔴 节点文字长度限制（关键要求）：**
   - **每个节点的文字长度必须不超过12个字（包括标点符号）**
   - **必须对文本内容进行浓缩提取，提取最核心、最简洁的概念表述**
   - **如果文本中的概念表述超过12个字，必须进行浓缩和精简，保留核心含义**
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
     - ❌ 错误（超过12字）："广泛的社会参与涉及多个群体"
     - ✅ 正确（浓缩后）："广泛社会参与"（6字）
3. **概念词浓缩提取方法：**
   - **识别核心概念**：从文本中识别出最核心的概念词
   - **去除冗余信息**：删除不必要的修饰词、解释性文字
   - **保留关键信息**：确保浓缩后的概念仍然准确表达原意
   - **统一表述**：如果文本中有多种表述方式，选择最简洁、最准确的表述
3. 必须明确标注层级（L1、L2、L3、L4）
4. **🔴🔴🔴 关键要求：同一个概念在整个三元组列表中必须始终使用相同的层级标记！**
   - 例如：如果"革命党人"在第一个三元组中被标记为L2，那么在所有后续三元组中，它也必须始终是L2，绝对不能变成L3或其他层级
   - 如果同一个概念在不同三元组中被标记为不同层级，会导致层级冲突错误
5. **🔴🔴🔴 相似内容识别与合并（关键要求）：**
   - **在提取三元组之前，必须仔细识别文本中相似、重复或表达同一概念的内容**
   - **将相似内容合并为一个节点，使用统一的表述方式**
   - **禁止将相似内容创建为两个不同的节点**
   - **相似内容识别规则：**
     - 如果文本中出现"历史背景"、"从历史背景看"、"历史背景方向"等相似表述，应统一为一个节点（如"历史背景"）
     - 如果文本中出现"核心内容"、"在核心内容上"、"核心内容方向"等相似表述，应统一为一个节点（如"核心内容"）
     - 如果文本中出现"革命对象"、"就革命对象而言"、"革命对象方向"等相似表述，应统一为一个节点（如"革命对象"）
     - 如果文本中出现"实践影响"、"其实践影响"、"实践影响方向"等相似表述，应统一为一个节点（如"实践影响"）
     - 如果文本中出现"旧三民主义"、"旧一民主义"等相似表述，应统一为一个节点（如"旧三民主义"）
     - 如果文本中出现"新三民主义"、"新一民主义"等相似表述，应统一为一个节点（如"新三民主义"）
   - **合并原则：**
     - 选择最简洁、最准确的表述作为统一节点名称
     - 如果文本中多次提到同一概念但表述略有不同，应识别为同一概念并统一表述
     - 避免因为表述的细微差异而创建重复节点
   - **检查步骤：**
     - 在输出三元组之前，检查是否有相似或重复的概念
     - 如果有相似概念，将它们合并为一个节点
     - 确保所有指向相似概念的关系都指向合并后的统一节点
6. 优先选择每层中最核心的概念（但必须来源于文本）

## 层级提取示例：
假设文本为：
"辛亥革命是1911年爆发的资产阶级民主革命。它旨在推翻清朝封建专制统治，建立共和制度，实现民族独立。革命的主要特点是广泛的社会参与，涉及知识分子、新军、民众和海外华侨。革命成果包括推翻帝制、建立民国、传播民主思想、促进社会变革等。"

层级分析（四层结构）：
- L1: 辛亥革命（核心主题，1个节点）
- L2: 推翻清朝、建立共和、民族独立、社会参与（主要目标，4个节点）
- L3: 知识分子、新军、民众、海外华侨（具体参与者和要素，4个节点）
- L4: 推翻帝制、建立民国、传播民主、社会变革（具体成果，4个节点）

提取结果（必须保证每层之间有足够的连接）：

**L1→L2 连接（至少3个）**：
(辛亥革命, 旨在, 推翻清朝, L1-L2)
(辛亥革命, 目标是, 建立共和, L1-L2)
(辛亥革命, 追求, 民族独立, L1-L2)
(辛亥革命, 特点是, 社会参与, L1-L2)

**L2→L3 连接（至少4个）**：
(社会参与, 涉及, 知识分子, L2-L3)
(社会参与, 涉及, 新军, L2-L3)
(社会参与, 涉及, 民众, L2-L3)
(社会参与, 涉及, 海外华侨, L2-L3)

**L3→L4 连接（至少4个）**：
(知识分子, 推动, 传播民主, L3-L4)
(新军, 实现, 推翻帝制, L3-L4)
(民众, 促成, 社会变革, L3-L4)
(海外华侨, 支持, 建立民国, L3-L4)

## ❌ 严格禁止的提取方式：
**同层提取（现在允许，使用圆弧连接）**：
- ✅ 允许：(辛亥革命背景, 包含, 民族独立, L2-L2) - 同层提取，使用圆弧连接
- ✅ 允许：(知识分子, 包含, 新军, L3-L3) - 同层提取，使用圆弧连接
- ✅ 允许：(新军, 包含, 民众, L3-L3) - 同层提取，使用圆弧连接

**跨层提取（绝对错误）**：
- ❌ 错误：(辛亥革命, 涉及, 知识分子, L1-L3) - 跨层提取
- ❌ 错误：(辛亥革命, 涉及, 民众, L1-L3) - 跨层提取
- ❌ 错误：(辛亥革命, 涉及, 列强侵略, L1-L3) - 跨层提取

## ✅ 正确的提取方式（从高层到低层，每层之间必须有足够的连接）：

**L1→L2 连接示例（至少3个）**：
- ✅ 正确：(辛亥革命, 旨在, 推翻清朝, L1-L2) - 从L1到L2，向下
- ✅ 正确：(辛亥革命, 目标是, 建立共和, L1-L2) - 从L1到L2，向下
- ✅ 正确：(辛亥革命, 追求, 民族独立, L1-L2) - 从L1到L2，向下
- ✅ 正确：(辛亥革命, 特点是, 社会参与, L1-L2) - 从L1到L2，向下

**L2→L3 连接示例（至少4个）**：
- ✅ 正确：(推翻清朝, 依靠, 知识分子, L2-L3) - 从L2到L3，向下
- ✅ 正确：(社会参与, 涉及, 新军, L2-L3) - 从L2到L3，向下
- ✅ 正确：(社会参与, 涉及, 民众, L2-L3) - 从L2到L3，向下
- ✅ 正确：(民族独立, 需要, 海外华侨, L2-L3) - 从L2到L3，向下

**L3→L4 连接示例（至少4个）**：
- ✅ 正确：(知识分子, 推动, 传播民主, L3-L4) - 从L3到L4，向下
- ✅ 正确：(新军, 实现, 推翻帝制, L3-L4) - 从L3到L4，向下
- ✅ 正确：(民众, 促成, 社会变革, L3-L4) - 从L3到L4，向下
- ✅ 正确：(海外华侨, 支持, 建立民国, L3-L4) - 从L3到L4，向下

## 文本内容：
${introText}

## 最终检查清单：
✓ **🔴🔴🔴 最重要：所有概念和关系词都严格来源于提供的文本，没有自行生成或创造任何新内容**
✓ **🔴🔴🔴 相似内容合并检查（关键）：已识别并合并所有相似或重复的概念，没有创建重复节点**
  - ✓ 已检查"历史背景"、"从历史背景看"、"历史背景方向"等相似表述，统一为一个节点
  - ✓ 已检查"核心内容"、"在核心内容上"、"核心内容方向"等相似表述，统一为一个节点
  - ✓ 已检查"革命对象"、"就革命对象而言"、"革命对象方向"等相似表述，统一为一个节点
  - ✓ 已检查"实践影响"、"其实践影响"、"实践影响方向"等相似表述，统一为一个节点
  - ✓ 已检查所有其他相似或重复的概念，确保每个概念只有一个节点
✓ 为每个概念明确标注层级（L1、L2、L3、L4），且同一个概念在整个三元组列表中必须始终使用相同的层级标记
✓ 节点数量根据文本内容自然确定，不设限制（但必须全部来源于文本）
✓ **只能从高层到低层提取**（L1→L2、L2→L3、L3→L4）

**✅ 同层连接允许检查（必须逐一核对）：**
✓ **允许L2-L2连接**（同一层的L2概念之间可以有连接，使用圆弧连接）
✓ **允许L3-L3连接**（同一层的L3概念之间可以有连接，使用圆弧连接）
✓ **允许L4-L4连接**（同一层的L4概念之间可以有连接，使用圆弧连接）
✓ **允许L5-L5连接**（同一层的L5概念之间可以有连接，使用圆弧连接）
✓ **同层连接将使用圆弧路径，中间断开放置连接词**

✓ 绝对禁止跨层提取（L1-L3、L1-L4、L2-L4等）
✓ **绝对禁止反向提取**（L2→L1、L3→L2、L4→L3等）
✓ L1层概念只能连接到L2层（向下）
✓ L2层概念只能连接到L3层（向下）
✓ L3层概念只能连接到L4层（向下）
✓ L4层是最底层，不能再向下
✓ 每个三元组都经过层级验证
✓ 拒绝所有L1-L3、L1-L4连接
✓ 拒绝所有L2-L4连接
✓ **拒绝所有L2-L1、L3-L2、L4-L3反向连接**
✓ 总共20-28个三元组
✓ **🔴🔴🔴 节点文字长度检查（关键）：每个节点的文字长度不超过12个字，已进行浓缩提取**
✓ 关系词准确，不使用"是"、"有"
✓ 层级关系标记正确（L1-L2、L2-L3、L3-L4等）
✓ **层级完整性：每一层都有至少1个节点**
✓ **⭐ 相邻层连接数量要求（最关键）：**
  - **L1→L2 之间必须有至少 4 个三元组**
  - **L2→L3 之间必须有至少 6 个三元组**
  - **L3→L4 之间必须有至少 6 个三元组**
✓ **内容长度：适合约300字的介绍**
✓ **L1→L2 之间有至少 4 个连接（覆盖L2的不同节点）**
✓ **L2→L3 之间有至少 6 个连接（覆盖L2和L3的不同节点）**
✓ **L3→L4 之间有至少 6 个连接（覆盖L3和L4的不同节点）**
✓ **🚫🚫🚫 绝对禁止孤立节点：每个节点都必须至少有一条连接线（作为源节点或目标节点）**
✓ **如果某个节点没有任何连接线，必须删除该节点或为其添加连接**

## ⚠️ 输出前最后提醒：
**🔴🔴🔴 最重要提醒：严格按文本提取，禁止自行生成新内容！**
- 所有概念和关系词必须完全来源于提供的文本
- 如果文本内容不足，只能提取文本中实际存在的部分，不能为了满足数量要求而自行添加
- 绝对禁止自行创造、补充或生成文本中不存在的概念、节点或关系

请开始输出三元组（记住：**严格按文本提取，禁止自行生成**，只能从高层到低层提取或同层提取，允许同层连接（L2→L2、L3→L3等），绝对禁止反向和跨层提取，L1→L2、L2→L3、L3→L4单向流动，**确保每个相邻层之间都有足够的三元组连接（L1→L2至少4个，L2→L3至少6个，L3→L4至少6个，但前提是文本中确实存在这些内容）**，**🔴🔴🔴 相似内容识别与合并：在提取前必须识别文本中相似或重复的概念，将它们合并为一个节点，使用统一的表述，禁止创建重复节点**，**🚫🚫🚫 绝对禁止孤立节点：每个节点都必须至少有一条连接线（作为源节点或目标节点），如果某个节点没有任何连接线，必须删除该节点或为其添加连接**，**🔴🔴🔴 节点文字长度限制：每个节点的文字长度必须不超过12个字，必须对文本内容进行浓缩提取，提取最核心、最简洁的概念表述**，内容适合约300字介绍）：`;
    }
    
}

/**
 * 概念图生成服务
 */
class ConceptMapGenerationService {
    constructor(config) {
        this.config = config;
    }
    
    /**
     * 生成概念图
     * @param {string} type - 生成类型 ('keyword' 或 'description')
     * @param {Object} data - 输入数据
     * @returns {Promise<Object>} 生成结果
     */
    async generateConceptMap(type, data) {
        console.log('🗺️ 开始生成概念图，类型:', type, '数据:', data);
        
        try {
            // 静默更新API地址（不打印日志，除非端口变化）
            this.config.updateApiUrl();
            
            // 构建概念图生成提示词
            const conceptPrompt = this.buildConceptPrompt(type, data);
            
            let conceptResponse;
            
            if (type === 'keyword') {
                // 焦点问题模式：只调用概念图生成API，直接生成节点和关系
                console.log('准备发送焦点问题生成请求...');
                console.log('请求URL:', `${this.config.API_BASE_URL}/chat`);
                console.log('请求内容:', conceptPrompt.substring(0, 100) + '...');
                
                // 创建一个带超时的fetch请求
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 50000); // 50秒超时
                
                try {
                    conceptResponse = await fetch(`${this.config.API_BASE_URL}/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: conceptPrompt }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        throw new Error('请求超时（50秒），请稍后重试');
                    }
                    throw error;
                }
                
                console.log('概念图生成API响应状态:', conceptResponse.status);
            } else {
                // 文本分析模式：只调用概念图生成API，不生成介绍内容
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 50000); // 50秒超时
                
                try {
                    conceptResponse = await fetch(`${this.config.API_BASE_URL}/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: conceptPrompt }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        throw new Error('请求超时（50秒），请稍后重试');
                    }
                    throw error;
                }
            }
            
            const conceptResult = await conceptResponse.json();
            console.log('概念图生成API响应结果:', conceptResult);
            
            // 处理概念图生成结果
            if (conceptResult.success) {
                console.log('概念图生成成功，开始解析JSON...');
                try {
                    const content = conceptResult.response;
                    const startIdx = content.indexOf('{');
                    const endIdx = content.lastIndexOf('}') + 1;
                    
                    if (startIdx !== -1 && endIdx !== -1) {
                        const jsonContent = content.substring(startIdx, endIdx);
                        const conceptData = JSON.parse(jsonContent);
                        
                        // 提取JSON前后的AI描述文本
                        const beforeJson = content.substring(0, startIdx).trim();
                        const afterJson = content.substring(endIdx).trim();
                        const aiDescription = (beforeJson + ' ' + afterJson).trim();
                        
                        return {
                            success: true,
                            data: conceptData,
                            aiResponse: content, // 保存完整的AI响应
                            aiDescription: aiDescription, // AI的描述文本
                            message: '概念图生成成功！'
                        };
                    } else {
                        throw new Error('响应中未找到有效的JSON数据');
                    }
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    return {
                        success: false,
                        error: '概念图数据解析失败',
                        message: '概念图数据解析失败'
                    };
                }
            } else {
                let errorMessage = '未知错误';
                if (conceptResult.error) {
                    if (conceptResult.error.includes('timeout') || conceptResult.error.includes('超时')) {
                        errorMessage = 'AI服务响应超时，请稍后重试';
                    } else if (conceptResult.error.includes('HTTPSConnectionPool')) {
                        errorMessage = 'AI服务连接超时，请检查网络或稍后重试';
                    } else {
                        errorMessage = conceptResult.error;
                    }
                }
                
                return {
                    success: false,
                    error: errorMessage,
                    message: `概念图生成失败: ${errorMessage}`
                };
            }
            
        } catch (error) {
            console.error('请求失败:', error);
            return {
                success: false,
                error: error.message,
                message: '网络请求失败，请检查后端服务是否启动'
            };
        }
    }
    
    /**
     * 构建概念图生成提示词（三层结构版本）
     * @param {string} type - 生成类型
     * @param {Object} data - 输入数据
     * @returns {string} 提示词
     */
    buildConceptPrompt(type, data) {
        if (type === 'keyword') {
            return `# 任务
请为焦点问题"${data.keyword}"生成一个分层结构的概念图，以JSON格式输出。

## 层级结构说明（可根据内容自然确定层数，不限制在4层）：
- **第一层（L1）**：核心主题概念（通常1个节点）
- **第二层（L2）**：主要分类或维度
- **第三层（L3）**：具体分类或子维度
- **第四层（L4）**：具体细节或实例
- **第五层及更深层（L5、L6等）**：根据内容需要，可以继续细分
- **节点数量**：根据内容自然确定，不设限制
- **层数确定**：根据内容的复杂度和层次结构自然确定层数，可以是3层、4层、5层或更多

# JSON格式示例（13个节点）
{
  "nodes": [
    {"id": "1", "label": "${data.keyword}", "type": "main", "description": "第一层核心节点", "importance": 10, "layer": 1},
    {"id": "2", "label": "核心概念1", "type": "core", "description": "第二层核心概念", "importance": 8, "layer": 2},
    {"id": "3", "label": "核心概念2", "type": "core", "description": "第二层核心概念", "importance": 8, "layer": 2},
    {"id": "4", "label": "核心概念3", "type": "core", "description": "第二层核心概念", "importance": 8, "layer": 2},
    {"id": "5", "label": "核心概念4", "type": "core", "description": "第二层核心概念", "importance": 8, "layer": 2},
    {"id": "6", "label": "扩展概念1", "type": "detail", "description": "第三层扩展概念", "importance": 6, "layer": 3},
    {"id": "7", "label": "扩展概念2", "type": "detail", "description": "第三层扩展概念", "importance": 6, "layer": 3},
    {"id": "8", "label": "扩展概念3", "type": "detail", "description": "第三层扩展概念", "importance": 6, "layer": 3},
    {"id": "9", "label": "扩展概念4", "type": "detail", "description": "第三层扩展概念", "importance": 6, "layer": 3},
    {"id": "10", "label": "细化概念1", "type": "detail", "description": "第四层细化概念", "importance": 4, "layer": 4},
    {"id": "11", "label": "细化概念2", "type": "detail", "description": "第四层细化概念", "importance": 4, "layer": 4},
    {"id": "12", "label": "细化概念3", "type": "detail", "description": "第四层细化概念", "importance": 4, "layer": 4},
    {"id": "13", "label": "细化概念4", "type": "detail", "description": "第四层细化概念", "importance": 4, "layer": 4}
  ],
  "links": [
    {"source": "1", "target": "2", "label": "方面包括", "type": "relation", "strength": 8},
    {"source": "1", "target": "3", "label": "方面包括", "type": "relation", "strength": 8},
    {"source": "1", "target": "4", "label": "方面包括", "type": "relation", "strength": 8},
    {"source": "1", "target": "5", "label": "方面包括", "type": "relation", "strength": 8},
    {"source": "2", "target": "6", "label": "内容包括", "type": "relation", "strength": 6},
    {"source": "2", "target": "7", "label": "内容包括", "type": "relation", "strength": 6},
    {"source": "3", "target": "8", "label": "导致", "type": "relation", "strength": 6},
    {"source": "4", "target": "9", "label": "促进", "type": "relation", "strength": 6},
    {"source": "6", "target": "10", "label": "涉及", "type": "relation", "strength": 4},
    {"source": "7", "target": "11", "label": "涉及", "type": "relation", "strength": 4},
    {"source": "8", "target": "12", "label": "包含", "type": "relation", "strength": 4},
    {"source": "9", "target": "13", "label": "包含", "type": "relation", "strength": 4}
  ],
  "metadata": {"keyword": "${data.keyword}", "summary": "概念图摘要", "domain": "领域"}
}

# 重要说明
- 节点数量根据内容自然确定，不设限制
- 第一层通常是核心主题概念
- 确保层级结构清晰，从高层到低层
- **节点label可以包含更多详细信息，不限制字数**：根据内容需要，节点label可以是简短的概念名称，也可以是更详细的描述性文字，以准确表达概念内容为准
- **关系label必须简洁且能读成完整句子**：不含助词（如"的"、"了"），但能让"源节点 + 关系词 + 目标节点"连读通顺
  - ✓ 好："人工智能" + "领域包括" + "机器学习" = "人工智能领域包括机器学习"
  - ✓ 好："辛亥革命" + "背景包括" + "清政腐败" = "辛亥革命背景包括清政腐败"
  - ✓ 好："清政腐败" + "引发" + "民众不满" = "清政腐败引发民众不满"
  - ✗ 差：单字关系词如"是"、"有"
  - ✗ 差：包含助词如"的背景是"、"导致了"
- 推荐关系词（2-4字动词短语）：包括、包含、涵盖、导致、引发、促进、推动、应用于、基于、需要等
- 必须包含layer属性（1、2、3、4等，根据内容确定）
- 确保JSON格式正确，可直接解析

## 最终检查清单：
✓ 每个节点都有layer属性
✓ 层级结构清晰，从L1开始逐层向下（可以是L1到L4，或更多层）
✓ 节点数量根据内容自然确定
✓ 层数根据内容复杂度自然确定，不限制在4层

请直接输出JSON，不要有其他解释文字。`;
        } else {
            return `分析文本提取分层结构概念图JSON：
${data.description}

## 层级结构说明（可根据内容自然确定层数，不限制在4层）：
- 第一层：核心概念
- 第二层：主要分类或维度
- 第三层：具体分类或子维度
- 第四层：具体细节或实例
- 第五层及更深层：根据内容需要，可以继续细分
- 节点数量根据内容自然确定，不设限制
- 层数确定：根据内容的复杂度和层次结构自然确定层数，可以是3层、4层、5层或更多

格式：
{
  "nodes": [
    {"id": "1", "label": "核心概念", "type": "main", "description": "描述", "importance": 10, "layer": 1},
    {"id": "2", "label": "核心概念1", "type": "core", "description": "描述", "importance": 8, "layer": 2},
    {"id": "3", "label": "核心概念2", "type": "core", "description": "描述", "importance": 8, "layer": 2},
    {"id": "4", "label": "核心概念3", "type": "core", "description": "描述", "importance": 8, "layer": 2},
    {"id": "5", "label": "核心概念4", "type": "core", "description": "描述", "importance": 8, "layer": 2},
    {"id": "6", "label": "扩展概念1", "type": "detail", "description": "描述", "importance": 6, "layer": 3},
    {"id": "7", "label": "扩展概念2", "type": "detail", "description": "描述", "importance": 6, "layer": 3},
    {"id": "8", "label": "扩展概念3", "type": "detail", "description": "描述", "importance": 6, "layer": 3},
    {"id": "9", "label": "扩展概念4", "type": "detail", "description": "描述", "importance": 6, "layer": 3},
    {"id": "10", "label": "细化概念1", "type": "detail", "description": "描述", "importance": 4, "layer": 4},
    {"id": "11", "label": "细化概念2", "type": "detail", "description": "描述", "importance": 4, "layer": 4},
    {"id": "12", "label": "细化概念3", "type": "detail", "description": "描述", "importance": 4, "layer": 4},
    {"id": "13", "label": "细化概念4", "type": "detail", "description": "描述", "importance": 4, "layer": 4}
  ],
  "links": [
    {"source": "1", "target": "2", "label": "方面包括", "type": "relation", "strength": 8},
    {"source": "2", "target": "6", "label": "内容包括", "type": "relation", "strength": 6},
    {"source": "6", "target": "10", "label": "涉及", "type": "relation", "strength": 4}
  ],
  "metadata": {"summary": "概要", "domain": "领域", "keyInsights": "洞察"}
}

要求：
- 节点数量根据内容自然确定，不设限制
- 必须包含layer属性（1、2、3、4等，根据内容确定，不限制在4层）
- **关系词要简洁且能读成完整句子**：不含助词（如"的"、"了"），使用2-4字动词短语
  - 推荐：包括、包含、涵盖、导致、引发、促进、推动、应用于、基于、需要等
  - 禁止：单字关系词如"是"、"有"
  - 禁止：包含助词如"的背景是"、"导致了"
- **节点label不限制字数**：根据内容需要，可以是简短的概念名称，也可以是更详细的描述性文字，以准确表达概念内容为准`;
        }
    }
}

/**
 * 大模型交互管理器
 */
class LLMManager {
    constructor() {
        this.config = new LLMConfig();
        
        // 初始化内置服务
        this.tripleService = new TripleExtractionService(this.config);
        this.conceptMapService = new ConceptMapGenerationService(this.config);
        
        // 介绍文本服务（独立模块，可选依赖）
        if (typeof IntroductionTextService !== 'undefined') {
            this.introService = new IntroductionTextService(this.config.API_BASE_URL);
        } else {
            console.warn('IntroductionTextService 未加载，请确保引入 introduction-service.js');
        }
        
        // 焦点问题提取服务（独立模块，可选依赖）
        if (typeof FocusQuestionService !== 'undefined') {
            this.focusQuestionService = new FocusQuestionService(this.config.API_BASE_URL);
        } else {
            console.warn('FocusQuestionService 未加载，请确保引入 focus-question-service.js');
        }
    }
    
    /**
     * 初始化
     */
    init() {
        // 页面加载时更新API地址（首次强制打印日志）
        this.config.updateApiUrl(true);
        
        // 监听端口变化事件
        window.addEventListener('portChanged', (event) => {
            console.log(`📡 检测到端口变化事件: ${event.detail.port}`);
            // 端口变化时会自动检测并打印警告
            this.config.updateApiUrl(true);
            
            // 更新独立服务的API地址
            if (this.introService) {
                this.introService.apiBaseUrl = this.config.API_BASE_URL;
            }
            if (this.focusQuestionService) {
                this.focusQuestionService.apiBaseUrl = this.config.API_BASE_URL;
            }
        });
    }
    
    /**
     * 生成介绍文本（流式）
     * @param {string} keyword - 关键词
     * @param {Function} onChunk - 接收文本片段的回调函数
     * @returns {Promise<Object>} 生成结果
     */
    async generateIntroduction(keyword, onChunk) {
        if (!this.introService) {
            return {
                success: false,
                error: 'IntroductionTextService 未加载',
                message: '介绍文本生成服务未初始化'
            };
        }
        return await this.introService.generateIntroduction(keyword, onChunk);
    }
    
    /**
     * 提取三元组
     * @param {string} introText - 输入文本
     * @returns {Promise<Object>} 提取结果
     */
    async extractTriples(introText) {
        return await this.tripleService.extractTriplesFromIntro(introText);
    }
    
    /**
     * 生成概念图
     * @param {string} type - 生成类型
     * @param {Object} data - 输入数据
     * @returns {Promise<Object>} 生成结果
     */
    async generateConceptMap(type, data) {
        return await this.conceptMapService.generateConceptMap(type, data);
    }
    
    /**
     * 提取焦点问题（从文本中）
     * @param {string} text - 用户输入的文本内容
     * @returns {Promise<Object>} 提取结果 {success, focusQuestion, message}
     */
    async extractFocusQuestion(text) {
        if (!this.focusQuestionService) {
            return {
                success: false,
                error: 'FocusQuestionService 未加载',
                message: '焦点问题提取服务未初始化'
            };
        }
        return await this.focusQuestionService.extractFocusQuestion(text);
    }
}

// 创建全局实例
window.llmManager = new LLMManager();

// 导出类供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LLMConfig,
        TripleExtractionService,
        ConceptMapGenerationService,
        LLMManager
    };
}
