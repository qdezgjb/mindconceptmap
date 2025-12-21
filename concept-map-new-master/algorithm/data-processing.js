// 数据处理算法模块
// 处理概念图数据的转换、分析和处理

/**
 * 验证层级关系是否有效（只允许从高层到低层的相邻层连接，支持任意层数）
 * @param {string} layerRelation - 层级关系标记（如L1-L2、L2-L3、L3-L4、L4-L5等）
 * @returns {boolean} 是否有效
 */
function validateLayerRelation(layerRelation) {
    if (!layerRelation || layerRelation.trim() === '') {
        console.log('⚠️ 缺少层级信息，拒绝该三元组');
        return false; // 如果没有层级信息，拒绝该三元组
    }
    
    // 匹配格式：L数字-L数字（如L1-L2、L2-L3、L3-L4、L4-L5等）
    const layerPattern = /^L(\d+)-L(\d+)$/;
    const match = layerRelation.trim().match(layerPattern);
    
    if (!match) {
        console.log('⚠️ 无效的层级关系格式:', layerRelation);
        return false;
    }
    
    const sourceLayer = parseInt(match[1]);
    const targetLayer = parseInt(match[2]);
    
    // 允许从高层到低层的相邻层连接（如L1→L2、L2→L3、L3→L4、L4→L5等）
    // 允许同层连接（如L2→L2、L3→L3等）
    // 不允许跨层（如L1→L3）、反向（如L2→L1）
    const isValid = targetLayer === sourceLayer + 1 || targetLayer === sourceLayer;
    
    if (!isValid) {
        if (targetLayer < sourceLayer) {
            console.log('⚠️ 无效的层级关系:', layerRelation, '拒绝反向连接（从低层到高层）');
        } else {
            console.log('⚠️ 无效的层级关系:', layerRelation, '拒绝跨层连接（必须相邻层或同层）');
        }
    }
    
    return isValid;
}

/**
 * 确保第一层只有一个节点，内容与焦点问题相关，删除其他L1层节点
 * @param {Object} conceptData - 概念图数据
 * @returns {Object} 处理后的概念图数据
 */
function ensureSingleFirstLayer(conceptData) {
    console.log('确保第一层只有一个节点...');
    
    if (!conceptData || !conceptData.nodes || conceptData.nodes.length === 0) {
        return conceptData;
    }
    
    const nodes = [...conceptData.nodes];
    const links = [...conceptData.links];
    
    // 获取当前焦点问题（从全局变量或元数据中）
    let currentKeyword = '';
    if (window.focusQuestion) {
        // 从焦点问题中提取关键词
        const match = window.focusQuestion.match(/焦点问题：(.*?)(是什么|\?|\.\.\.)/);
        if (match) {
            currentKeyword = match[1].trim();
        }
    }
    
    // 如果没有找到焦点问题，尝试从元数据中获取
    if (!currentKeyword && conceptData.metadata && conceptData.metadata.keyword) {
        currentKeyword = conceptData.metadata.keyword;
    }
    
    // 如果仍然没有焦点问题，使用第一个节点作为焦点问题
    if (!currentKeyword && nodes.length > 0) {
        currentKeyword = nodes[0].label;
    }
    
    console.log('当前焦点问题:', currentKeyword);
    
    // 找到所有L1层节点
    const layer1Nodes = nodes.filter(node => node.layer === 1);
    console.log(`找到 ${layer1Nodes.length} 个L1层节点:`, layer1Nodes.map(n => n.label));
    
    // 找到与焦点问题最相关的L1节点作为唯一的第一层节点
    let firstLayerNode = null;
    let bestMatchScore = 0;
    
    layer1Nodes.forEach(node => {
        const matchScore = calculateKeywordMatchScore(node.label, currentKeyword);
        if (matchScore > bestMatchScore) {
            bestMatchScore = matchScore;
            firstLayerNode = node;
        }
    });
    
    // 如果没有找到L1节点，尝试从所有节点中找到最相关的
    if (!firstLayerNode) {
    nodes.forEach(node => {
        const matchScore = calculateKeywordMatchScore(node.label, currentKeyword);
        if (matchScore > bestMatchScore) {
            bestMatchScore = matchScore;
            firstLayerNode = node;
        }
    });
    }
    
    // ⚠️ 确保第一层节点有layer=1属性
    if (firstLayerNode) {
        firstLayerNode.layer = 1;
        console.log(`设置第一层节点"${firstLayerNode.label}"的layer=1`);
    }
    
    // 如果没有找到合适的节点，创建一个新的第一层节点
    if (!firstLayerNode) {
        firstLayerNode = {
            id: 'first-layer',
            label: currentKeyword || '核心概念',
            type: 'main',
            description: '第一层核心节点',
            importance: 10,
            layer: 1 // ⚠️ 第一层节点必须有layer=1属性
        };
        nodes.unshift(firstLayerNode);
    }
    
    // 🔴🔴🔴 关键：删除所有其他L1层节点
    const nodesToRemove = new Set();
    const firstLayerId = firstLayerNode.id;
    
    nodes.forEach(node => {
        // 如果是L1层节点但不是选中的第一层节点，标记为删除
        if (node.layer === 1 && node.id !== firstLayerId) {
            nodesToRemove.add(node.id);
            console.log(`标记删除L1层节点: "${node.label}" (id: ${node.id})`);
        }
    });
    
    // 删除标记的节点
    const filteredNodes = nodes.filter(node => !nodesToRemove.has(node.id));
    console.log(`删除了 ${nodes.length - filteredNodes.length} 个L1层节点`);
    
    // 处理连线：删除涉及被删除节点的连线，或将它们重定向到第一层节点
    const newLinks = [];
    links.forEach(link => {
        const sourceRemoved = nodesToRemove.has(link.source);
        const targetRemoved = nodesToRemove.has(link.target);
        
        if (sourceRemoved && targetRemoved) {
            // 源和目标都被删除，跳过这条连线
            console.log(`删除连线（源和目标都被删除）: ${link.source} -> ${link.target}`);
            return;
        } else if (sourceRemoved) {
            // 源节点被删除，将连线重定向到第一层节点
            console.log(`重定向连线（源节点被删除）: ${link.source} -> ${link.target}，改为 ${firstLayerId} -> ${link.target}`);
            newLinks.push({
                ...link,
                source: firstLayerId
            });
        } else if (targetRemoved) {
            // 目标节点被删除，将连线重定向到第一层节点（如果源不是第一层节点）
            if (link.source !== firstLayerId) {
                console.log(`重定向连线（目标节点被删除）: ${link.source} -> ${link.target}，改为 ${link.source} -> ${firstLayerId}`);
                newLinks.push({
                    ...link,
                    target: firstLayerId
                });
            } else {
                // 源是第一层节点，目标是已删除的L1节点，删除这条连线
                console.log(`删除连线（第一层节点指向已删除的L1节点）: ${link.source} -> ${link.target}`);
            }
        } else {
            // 正常连线，保留
            newLinks.push(link);
        }
    });
    
    // 确保第一层节点在数组的第一位
    const firstLayerIndex = filteredNodes.findIndex(n => n.id === firstLayerId);
        if (firstLayerIndex > 0) {
        filteredNodes.splice(firstLayerIndex, 1);
        filteredNodes.unshift(firstLayerNode);
    } else if (firstLayerIndex === -1) {
        // 如果第一层节点不在数组中，添加到第一位
        filteredNodes.unshift(firstLayerNode);
        }
    
    // 调整连线的方向，确保第一层节点作为源节点（对于指向第一层节点的连线）
    newLinks.forEach(link => {
        // 如果连线指向第一层节点，确保第一层节点是源节点
        if (link.target === firstLayerId && link.source !== firstLayerId) {
            // 交换源和目标
            const temp = link.source;
            link.source = link.target;
            link.target = temp;
        }
    });
    
    console.log('第一层节点处理完成:', firstLayerNode.label);
    console.log('节点数量:', filteredNodes.length, '(删除了', nodes.length - filteredNodes.length, '个L1节点)');
    console.log('连线数量:', newLinks.length, '(原', links.length, '条)');
    console.log('连线详情:', newLinks.map(link => ({
        source: filteredNodes.find(n => n.id === link.source)?.label || link.source,
        target: filteredNodes.find(n => n.id === link.target)?.label || link.target,
        label: link.label
    })));
    
    return {
        nodes: filteredNodes,
        links: newLinks,
        metadata: conceptData.metadata || {}
    };
}

/**
 * 计算焦点问题匹配度
 * @param {string} nodeLabel - 节点标签
 * @param {string} keyword - 焦点问题关键词
 * @returns {number} 匹配度得分
 */
function calculateKeywordMatchScore(nodeLabel, keyword) {
    if (!keyword || !nodeLabel) return 0;
    
    const keywordLower = keyword.toLowerCase();
    const nodeLabelLower = nodeLabel.toLowerCase();
    
    // 完全匹配得分最高
    if (nodeLabelLower === keywordLower) return 100;
    
    // 包含关键词得分较高
    if (nodeLabelLower.includes(keywordLower)) return 80;
    
    // 关键词包含节点标签得分中等
    if (keywordLower.includes(nodeLabelLower)) return 60;
    
    // 部分匹配得分较低
    const keywordWords = keywordLower.split(/[\s,，。！？；：""''（）()]+/);
    const nodeWords = nodeLabelLower.split(/[\s,，。！？；：""''（）()]+/);
    
    let matchCount = 0;
    keywordWords.forEach(word => {
        if (word.length > 1 && nodeWords.some(nodeWord => nodeWord.includes(word))) {
            matchCount++;
        }
    });
    
    return matchCount * 20;
}

/**
 * 转换API数据为D3.js格式
 * @param {Object} conceptData - 概念图数据
 * @returns {Object} D3.js格式的图形数据
 */
function convertToD3Format(conceptData) {
    // 确保第一层只有一个节点，内容与关键词相关
    const processedData = ensureSingleFirstLayer(conceptData);
    
    const nodes = processedData.nodes.map((node, index) => ({
        id: node.id,
        label: node.label,
        x: 0, // 初始位置设为0，由智能布局算法确定
        y: 0,
        type: node.type,
        description: node.description,
        importance: node.importance || 5,
        layer: node.layer // ⚠️ 保留layer属性，供Sugiyama布局算法使用
    }));

    const links = processedData.links.map((link, index) => ({
        id: link.id || `link-${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        label: link.label,
        type: link.type,
        strength: link.strength || 5,
        // 确保不包含贝塞尔曲线属性，统一使用直线连接
        isCurved: false
    }));

    const graphData = {
        nodes: nodes,
        links: links,
        metadata: processedData.metadata || {}
    };

    // 应用智能布局算法
    return applyIntelligentLayout(graphData);
}

/**
 * 解析AI响应中的三元组（支持层次信息）
 * @param {string} response - AI响应文本
 * @returns {Array} 三元组数组
 */
function parseTriplesFromResponse(response) {
    console.log('parseTriplesFromResponse 被调用，响应:', response);
    console.log('响应内容（前500字符）:', response.substring(0, 500));
    
    const triples = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
        let trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // 移除可能的序号前缀（如："1. "、"1、"、"- "等）
        trimmedLine = trimmedLine.replace(/^[\d\-\*•]+[\.、\s]+/, '');
        
        // 尝试匹配新格式：(概念1, 关系, 概念2, 层级关系)
        let match = trimmedLine.match(/^\((.*?),\s*(.*?),\s*(.*?),\s*(L\d+-L\d+)\)$/);
        
        // 如果没有层级信息，尝试匹配旧格式
        if (!match) {
            // 1. 标准英文括号格式: (概念1, 关系, 概念2)
            match = trimmedLine.match(/^\((.*?),\s*(.*?),\s*(.*?)\)$/);
            if (match) {
                match.push(''); // 添加空的层级信息
            }
        }
        
        // 2. 中文括号格式: （概念1, 关系, 概念2, 层级关系）
        if (!match) {
            match = trimmedLine.match(/^（(.*?),\s*(.*?),\s*(.*?),?\s*(L\d+-L\d+)?\s*）$/);
        }
        
        // 3. 中文逗号格式: (概念1，关系，概念2，层级关系)
        if (!match) {
            match = trimmedLine.match(/^\((.*?)，\s*(.*?)，\s*(.*?)，?\s*(L\d+-L\d+)?\s*\)$/);
        }
        
        // 4. 混合格式: （概念1，关系，概念2，层级关系）
        if (!match) {
            match = trimmedLine.match(/^（(.*?)，\s*(.*?)，\s*(.*?)，?\s*(L\d+-L\d+)?\s*）$/);
        }
        
        // 5. 宽松格式：只要包含括号和逗号
        if (!match) {
            match = trimmedLine.match(/[（\(](.*?)[,，]\s*(.*?)[,，]\s*(.*?)(?:[,，]\s*(L\d+-L\d+))?\s*[）\)]/);
        }
        
        // 6. 箭头格式：概念1 -> 关系 -> 概念2
        if (!match) {
            const arrowMatch = trimmedLine.match(/(.*?)\s*[-=]>?\s*(.*?)\s*[-=]>?\s*(.*?)$/);
            if (arrowMatch) {
                match = ['', arrowMatch[1], arrowMatch[2], arrowMatch[3], ''];
            }
        }
        
        if (match && match.length >= 4) {
            const concept1 = match[1].trim();
            const relation = match[2].trim();
            const concept2 = match[3].trim();
            const layerRelation = match[4] ? match[4].trim() : '';
            
            // 验证提取的内容不为空且合理（长度不超过50个字符）
            if (concept1 && relation && concept2 && 
                concept1.length > 0 && concept1.length <= 50 &&
                relation.length > 0 && relation.length <= 20 &&
                concept2.length > 0 && concept2.length <= 50) {
                
                // 验证层级关系是否有效
                const isValidLayerRelation = validateLayerRelation(layerRelation);
                if (!isValidLayerRelation) {
                    console.log('× 层级关系无效，跳过:', { 
                        concept1, 
                        relation, 
                        concept2, 
                        layerRelation,
                        reason: '层级关系不符合相邻层规则'
                    });
                    continue; // 跳过这个三元组
                }
                
                triples.push({
                    source: concept1,
                    relation: relation,
                    target: concept2,
                    layer: layerRelation // 保持layer字段名以兼容现有代码
                });
                console.log('✓ 解析到三元组:', { 
                    source: concept1, 
                    relation: relation, 
                    target: concept2,
                    layer_relation: layerRelation || '未指定'
                });
            } else {
                console.log('× 三元组格式不合理:', { concept1, relation, concept2, layerRelation });
            }
        } else {
            console.log('× 无法解析的行:', trimmedLine);
        }
    }
    
    console.log(`总共解析出三元组数量: ${triples.length}/${lines.length} 行`);
    return triples;
}

/**
 * 将三元组转换为概念图数据（支持三层结构）
 * @param {Array} triples - 三元组数组
 * @returns {Object} 概念图数据
 */
function convertTriplesToConceptData(triples) {
    console.log('convertTriplesToConceptData 被调用，三元组:', triples);
    
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    let nodeId = 1;
    
    // 获取当前焦点问题
    let currentKeyword = '';
    if (window.focusQuestion) {
        const match = window.focusQuestion.match(/焦点问题：(.*?)(是什么|\?|\.\.\.)/);
        if (match) {
            currentKeyword = match[1].trim();
        }
    }
    
    // 分析三元组中的层次信息，确定各层节点
    // 🔴🔴🔴 关键改进：使用"首次确定"策略，确保同一个节点内容只能在一个层级
    // 第一次遇到节点时就确定其层级，后续遇到相同节点时强制使用该层级
    const nodeLayerMap = new Map(); // nodeName -> final layer number (首次确定后不再改变)
    const nodeLayerConflicts = []; // 记录冲突的三元组信息，用于调试
    
    triples.forEach((triple, index) => {
        const { source, target, layer } = triple;
        
        // 根据层级关系，确定源节点和目标节点的层级（支持任意层数）
        let sourceLayer = null;
        let targetLayer = null;
        
        // 匹配格式：L数字-L数字（如L1-L2、L2-L3、L3-L4、L4-L5等）
        const layerPattern = /^L(\d+)-L(\d+)$/;
        const match = layer.trim().match(layerPattern);
        
        if (!match) {
            console.warn(`⚠️ 无效的层级标记格式"${layer}"，跳过三元组: (${source}, ${triple.relation}, ${target})`);
            return; // 跳过此三元组
        }
        
        sourceLayer = parseInt(match[1]);
        targetLayer = parseInt(match[2]);
        
        // ⚠️ 允许正向相邻层连接（从高层到低层，且必须相邻：L1→L2、L2→L3、L3→L4、L4→L5等）
        // ⚠️ 允许同层连接（L2→L2、L3→L3等）
        if (targetLayer !== sourceLayer + 1 && targetLayer !== sourceLayer) {
            if (targetLayer < sourceLayer) {
                // ❌ 拒绝反向连接
                console.warn(`❌ 拒绝反向连接三元组: (${source}, ${triple.relation}, ${target}, ${layer})`);
                console.warn(`   反向连接违反了层次结构规则，已跳过此三元组`);
            } else {
                // ❌ 拒绝跨层连接
                console.warn(`❌ 拒绝跨层连接三元组: (${source}, ${triple.relation}, ${target}, ${layer})`);
                console.warn(`   跨层连接违反了层次结构规则，已跳过此三元组`);
            }
            return; // 跳过此三元组
        }
        
        // 🔴🔴🔴 首次确定策略：如果节点还没有层级，就确定它；如果已有层级但不同，记录冲突并使用首次确定的层级
        if (!nodeLayerMap.has(source)) {
            // 源节点首次出现，确定其层级
            nodeLayerMap.set(source, sourceLayer);
        } else {
            // 源节点已存在，检查层级是否一致
            const existingLayer = nodeLayerMap.get(source);
            if (existingLayer !== sourceLayer) {
                // 层级冲突！使用首次确定的层级，记录冲突信息
                nodeLayerConflicts.push({
                    node: source,
                    existingLayer: existingLayer,
                    newLayer: sourceLayer,
                    tripleIndex: index,
                    triple: triple
                });
                console.warn(`⚠️ 节点"${source}"层级冲突：已确定为L${existingLayer}，但三元组#${index}要求L${sourceLayer}，保持L${existingLayer}（首次确定原则）`);
                console.warn(`   三元组: (${source}, ${triple.relation}, ${target}, ${layer})`);
            }
            // 保持首次确定的层级，不改变
        }
        
        if (!nodeLayerMap.has(target)) {
            // 目标节点首次出现，确定其层级
            nodeLayerMap.set(target, targetLayer);
        } else {
            // 目标节点已存在，检查层级是否一致
            const existingLayer = nodeLayerMap.get(target);
            if (existingLayer !== targetLayer) {
                // 层级冲突！使用首次确定的层级，记录冲突信息
                nodeLayerConflicts.push({
                    node: target,
                    existingLayer: existingLayer,
                    newLayer: targetLayer,
                    tripleIndex: index,
                    triple: triple
                });
                console.warn(`⚠️ 节点"${target}"层级冲突：已确定为L${existingLayer}，但三元组#${index}要求L${targetLayer}，保持L${existingLayer}（首次确定原则）`);
                console.warn(`   三元组: (${source}, ${triple.relation}, ${target}, ${layer})`);
            }
            // 保持首次确定的层级，不改变
        }
    });
    
    // 输出冲突统计
    if (nodeLayerConflicts.length > 0) {
        console.warn(`\n⚠️⚠️⚠️ 共发现 ${nodeLayerConflicts.length} 个节点层级冲突！`);
        console.warn(`   这说明AI生成的三元组中，同一个概念被标记为不同的层级。`);
        console.warn(`   系统已采用"首次确定"策略，使用每个节点首次出现的层级。`);
        console.warn(`   建议检查AI生成的结果，确保同一个概念在整个三元组列表中始终使用相同的层级标记。\n`);
    }
    
    // 处理没有层级的节点（理论上不应该发生，因为所有有效三元组都会确定层级）
    const allNodes = new Set();
    triples.forEach(triple => {
        allNodes.add(triple.source);
        allNodes.add(triple.target);
    });
    
    // 找到最大层级，用于默认分配
    let maxLayer = 1;
    nodeLayerMap.forEach((layer) => {
        if (layer > maxLayer) maxLayer = layer;
    });
    
    allNodes.forEach(nodeName => {
        if (!nodeLayerMap.has(nodeName)) {
            console.warn(`⚠️ 节点"${nodeName}"没有明确的层级，默认分配到L${maxLayer}`);
            nodeLayerMap.set(nodeName, maxLayer);
        }
    });
    
    // 创建动态层级集合（支持任意层数）
    const layerNodesMap = new Map(); // layer -> Set of node names
    
    nodeLayerMap.forEach((layer, nodeName) => {
        if (!layerNodesMap.has(layer)) {
            layerNodesMap.set(layer, new Set());
        }
        layerNodesMap.get(layer).add(nodeName);
    });
    
    // 如果没有明确的层次信息，尝试从三元组中推断
    const layer1Nodes = layerNodesMap.get(1) || new Set();
    if (layer1Nodes.size === 0 && currentKeyword) {
        layer1Nodes.add(currentKeyword);
        if (!layerNodesMap.has(1)) {
            layerNodesMap.set(1, new Set());
        }
        layerNodesMap.get(1).add(currentKeyword);
        nodeLayerMap.set(currentKeyword, 1);
    }
    
    // 如果还是没有第一层节点，从出现频率最高的概念中选择
    if (layer1Nodes.size === 0 && triples.length > 0) {
        const conceptCount = new Map();
        triples.forEach(triple => {
            conceptCount.set(triple.source, (conceptCount.get(triple.source) || 0) + 1);
            conceptCount.set(triple.target, (conceptCount.get(triple.target) || 0) + 1);
        });
        
        let maxCount = 0;
        let topConcept = '';
        conceptCount.forEach((count, concept) => {
            if (count > maxCount) {
                maxCount = count;
                topConcept = concept;
            }
        });
        
        if (topConcept) {
            if (!layerNodesMap.has(1)) {
                layerNodesMap.set(1, new Set());
            }
            layerNodesMap.get(1).add(topConcept);
            nodeLayerMap.set(topConcept, 1);
            currentKeyword = topConcept;
        }
    }
    
    // 动态输出所有层级的节点
    console.log('层次分配结果:');
    const sortedLayers = Array.from(layerNodesMap.keys()).sort((a, b) => a - b);
    sortedLayers.forEach(layer => {
        const nodes = Array.from(layerNodesMap.get(layer));
        console.log(`  L${layer}层节点:`, nodes);
    });
    
    // 确保第一层至少有一个节点
    if (layer1Nodes.size === 0) {
        console.warn(`⚠️ 第一层没有节点，尝试从焦点问题或L2中提升一个`);
        // 如果L1层没有节点，从焦点问题或L2中提升一个
        if (currentKeyword) {
            if (!layerNodesMap.has(1)) {
                layerNodesMap.set(1, new Set());
            }
            layerNodesMap.get(1).add(currentKeyword);
            nodeLayerMap.set(currentKeyword, 1);
            console.warn(`   ✓ 使用焦点问题作为L1节点: ${currentKeyword}`);
        } else {
            const layer2Nodes = layerNodesMap.get(2) || new Set();
            if (layer2Nodes.size > 0) {
                const firstL2Node = Array.from(layer2Nodes)[0];
                layer2Nodes.delete(firstL2Node);
                if (!layerNodesMap.has(1)) {
                    layerNodesMap.set(1, new Set());
                }
                layerNodesMap.get(1).add(firstL2Node);
                nodeLayerMap.set(firstL2Node, 1);
                console.warn(`   ✓ 将L2节点"${firstL2Node}"提升为L1节点`);
            }
        }
    }
    
    // 动态输出层级统计
    console.log('节点层级分配完成:');
    sortedLayers.forEach(layer => {
        const count = layerNodesMap.get(layer).size;
        console.log(`  L${layer}层: ${count}个`);
    });
    
    // 辅助函数：获取节点的最终层级（简化版，直接使用nodeLayerMap）
    const getNodeLayer = (nodeName) => {
        // 直接从nodeLayerMap获取已确定的层级
        if (nodeLayerMap.has(nodeName)) {
            return nodeLayerMap.get(nodeName);
        }
        
        // 如果节点不在映射中，说明它不在任何三元组中，默认分配到最大层级
        const maxLayer = Math.max(...Array.from(nodeLayerMap.values()), 1);
        console.warn(`⚠️ 节点"${nodeName}"不在层级映射中，默认分配到L${maxLayer}`);
        return maxLayer;
    };
    
    // 过滤掉包含被移除节点的三元组
    const validTriples = triples.filter(triple => {
        const { source, target } = triple;
        // 检查两个节点是否都在有效的节点映射中
        const sourceValid = nodeLayerMap.has(source);
        const targetValid = nodeLayerMap.has(target);
        
        if (!sourceValid || !targetValid) {
            console.warn(`× 跳过三元组（节点已被移除）: (${source}, ${triple.relation}, ${target})`);
            return false;
        }
        return true;
    });
    
    console.log(`过滤后的三元组数量: ${validTriples.length}/${triples.length}`);
    
    // 🔴🔴🔴 关键改进：先收集所有唯一节点，避免重复创建
    const uniqueNodeNames = new Set();
    validTriples.forEach(triple => {
        uniqueNodeNames.add(triple.source.trim());
        uniqueNodeNames.add(triple.target.trim());
    });
    
    // 先创建所有唯一节点
    uniqueNodeNames.forEach(nodeName => {
        if (!nodeMap.has(nodeName)) {
            const nodeLayer = getNodeLayer(nodeName);
            nodeMap.set(nodeName, nodeId.toString());
            
            nodes.push({
                id: nodeId.toString(),
                label: nodeName,
                type: nodeLayer === 1 ? 'main' : (nodeLayer === 2 ? 'core' : 'detail'),
                description: `从文本中提取的概念: ${nodeName}`,
                importance: nodeLayer === 1 ? 10 : (nodeLayer === 2 ? 8 : 6),
                layer: nodeLayer
            });
            nodeId++;
        }
    });
    
    // 处理所有有效三元组，创建连线
    let linkIndex = 0;
    validTriples.forEach((triple, index) => {
        const { source, relation, target, layer } = triple;
        
        // 确保节点已存在（应该已经在上一步创建）
        const sourceId = nodeMap.get(source.trim());
        const targetId = nodeMap.get(target.trim());
        
        if (!sourceId || !targetId) {
            console.warn(`⚠️ 跳过三元组（节点未找到）: (${source}, ${relation}, ${target})`);
            return;
        }
        
        // 🔴🔴🔴 再次验证：确保源节点和目标节点的实际层级满足要求（允许同层连接）
        const sourceLayer = getNodeLayer(source.trim());
        const targetLayer = getNodeLayer(target.trim());
        
        // 禁止反向连接（从低层到高层）
        if (sourceLayer > targetLayer) {
            console.warn(`❌ 最终过滤：拒绝反向连接 (${source}[L${sourceLayer}] -> ${target}[L${targetLayer}])`);
            console.warn(`   连接词: "${relation}"，反向连接违反层次结构规则，已跳过`);
            return;
        }
        
        // 允许同层连接和相邻层连接
        // 禁止跨层连接（非相邻层且非同层）
        if (targetLayer !== sourceLayer + 1 && targetLayer !== sourceLayer) {
            console.warn(`❌ 最终过滤：拒绝跨层连接 (${source}[L${sourceLayer}] -> ${target}[L${targetLayer}])`);
            console.warn(`   连接词: "${relation}"，跨层连接违反层次结构规则，已跳过`);
            return;
        }
        
        // 同层连接标记
        if (sourceLayer === targetLayer) {
            console.log(`✓ 允许同层连接: (${source}[L${sourceLayer}] -> ${target}[L${targetLayer}])，连接词: "${relation}"`);
        }
        
        // 添加关系连线
        const newLink = {
            id: `link-${linkIndex}`,
            source: sourceId,
            target: targetId,
            label: relation,
            type: 'relation',
            strength: 6,
            layer: layer || ''
        };
        links.push(newLink);
        linkIndex++;
        console.log(`✓ 添加连线 #${linkIndex}:`, {
            source: `${source}[L${sourceLayer}]`,
            target: `${target}[L${targetLayer}]`,
            relation: relation,
            layer: layer,
            sourceId: newLink.source,
            targetId: newLink.target
        });
    });
    
    // 按层次排序节点：第一层 -> 第二层 -> 第三层
    nodes.sort((a, b) => {
        if (a.layer !== b.layer) {
            return a.layer - b.layer;
        }
        return a.importance - b.importance;
    });
    
    // 输出节点统计信息（动态统计所有层级）
    const layerCounts = new Map();
    nodes.forEach(node => {
        const layer = node.layer || 1;
        layerCounts.set(layer, (layerCounts.get(layer) || 0) + 1);
    });
    
    console.log(`✅ 节点处理完成: 总计${nodes.length}个节点`);
    const sortedLayersForStats = Array.from(layerCounts.keys()).sort((a, b) => a - b);
    const layerStats = sortedLayersForStats.map(layer => `L${layer}=${layerCounts.get(layer)}`).join(', ');
    console.log(`  各层分布: ${layerStats}`);
    
    // 重新分配节点ID，确保第一层节点的ID最小
    const oldToNewIdMap = new Map();
    nodes.forEach((node, index) => {
        const oldId = node.id;
        const newId = (index + 1).toString();
        node.id = newId;
        oldToNewIdMap.set(oldId, newId);
    });
    
    // 更新连线中的节点ID引用
    links.forEach(link => {
        link.source = oldToNewIdMap.get(link.source) || link.source;
        link.target = oldToNewIdMap.get(link.target) || link.target;
    });
    
    const conceptData = {
        nodes: nodes,
        links: links,
        metadata: {
            summary: `基于AI介绍内容提取的 ${triples.length} 个三元组构建的分层概念图`,
            domain: 'AI介绍分析',
            source: 'AI介绍内容',
            tripleCount: triples.length,
            keyword: currentKeyword,
            layerInfo: (() => {
                const info = {};
                sortedLayers.forEach(layer => {
                    info[`layer${layer}Count`] = layerNodesMap.get(layer).size;
                });
                return info;
            })()
        }
    };
    
    console.log('转换完成的概念图数据:', conceptData);
    sortedLayers.forEach(layer => {
        const count = layerNodesMap.get(layer).size;
        console.log(`  L${layer}层节点数: ${count}`);
    });
    
    // 打印每个节点的layer属性，用于调试
    console.log('节点layer属性详情:');
    nodes.forEach(node => {
        console.log(`  - ${node.label}: layer=${node.layer}`);
    });
    
    // 🔴🔴🔴 相似节点检测与合并（关键步骤）
    console.log('🔍 开始检测和合并相似节点...');
    const nodeLabelMap = new Map(); // 存储节点ID到标签的映射
    nodes.forEach(node => {
        nodeLabelMap.set(node.id, node.label);
    });
    
    // 相似度检测函数（简化版，基于关键词匹配）
    const isSimilarNode = (label1, label2) => {
        const normalize = (str) => {
            // 移除常见的修饰词和方向词
            return str.replace(/^(从|在|就|其|的|了|是|有|为|方向|方面|看|而言|上|中|下)/g, '')
                     .replace(/(方向|方面|看|而言|上|中|下)$/g, '')
                     .trim();
        };
        
        const norm1 = normalize(label1);
        const norm2 = normalize(label2);
        
        // 如果规范化后的标签相同或高度相似，认为是相似节点
        if (norm1 === norm2) {
            return true;
        }
        
        // 检查是否一个包含另一个（去除修饰词后）
        if (norm1.length > 0 && norm2.length > 0) {
            if (norm1.includes(norm2) || norm2.includes(norm1)) {
                // 确保不是完全不同的概念（长度差异不能太大）
                const lengthRatio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
                if (lengthRatio > 0.5) {
                    return true;
                }
            }
        }
        
        return false;
    };
    
    // 查找相似节点并创建合并映射
    const mergeMap = new Map(); // 存储需要合并的节点：旧节点ID -> 新节点ID
    const processedNodes = new Set();
    
    nodes.forEach(node1 => {
        if (processedNodes.has(node1.id)) {
            return;
        }
        
        // 查找与node1相似的节点
        const similarNodes = nodes.filter(node2 => {
            if (node2.id === node1.id || processedNodes.has(node2.id)) {
                return false;
            }
            // 只合并同一层级的相似节点
            if (node1.layer !== node2.layer) {
                return false;
            }
            return isSimilarNode(node1.label, node2.label);
        });
        
        if (similarNodes.length > 0) {
            // 选择最简洁的标签作为统一标签
            const allLabels = [node1.label, ...similarNodes.map(n => n.label)];
            const unifiedLabel = allLabels.reduce((shortest, current) => {
                const normalize = (str) => str.replace(/^(从|在|就|其|的|了|是|有|为|方向|方面|看|而言|上|中|下)/g, '')
                                              .replace(/(方向|方面|看|而言|上|中|下)$/g, '')
                                              .trim();
                const normShortest = normalize(shortest);
                const normCurrent = normalize(current);
                // 优先选择规范化后更短的标签
                if (normCurrent.length < normShortest.length) {
                    return current;
                }
                // 如果长度相同，选择原始标签更短的
                if (normCurrent.length === normShortest.length && current.length < shortest.length) {
                    return current;
                }
                return shortest;
            });
            
            console.log(`  🔗 发现相似节点，合并为: "${unifiedLabel}"`);
            console.log(`     - "${node1.label}" (保留)`);
            
            // 将所有相似节点合并到node1
            similarNodes.forEach(similarNode => {
                mergeMap.set(similarNode.id, node1.id);
                processedNodes.add(similarNode.id);
                console.log(`     - "${similarNode.label}" (合并到 "${unifiedLabel}")`);
            });
            
            // 如果统一标签与node1的标签不同，更新node1的标签
            if (unifiedLabel !== node1.label) {
                console.log(`     - 更新节点标签: "${node1.label}" -> "${unifiedLabel}"`);
                node1.label = unifiedLabel;
            }
        }
        
        processedNodes.add(node1.id);
    });
    
    // 如果发现相似节点，执行合并
    if (mergeMap.size > 0) {
        console.log(`✅ 共发现 ${mergeMap.size} 个相似节点需要合并`);
        
        // 更新所有连线，将合并的节点ID替换为统一节点ID
        links.forEach(link => {
            if (mergeMap.has(link.source)) {
                link.source = mergeMap.get(link.source);
            }
            if (mergeMap.has(link.target)) {
                link.target = mergeMap.get(link.target);
            }
        });
        
        // 移除重复的连线（源节点和目标节点都相同的连线）
        const linkKeySet = new Set();
        const uniqueLinks = [];
        links.forEach(link => {
            const linkKey = `${link.source}-${link.label}-${link.target}`;
            if (!linkKeySet.has(linkKey)) {
                linkKeySet.add(linkKey);
                uniqueLinks.push(link);
            } else {
                console.log(`  🗑️ 移除重复连线: ${nodeLabelMap.get(link.source)} --[${link.label}]--> ${nodeLabelMap.get(link.target)}`);
            }
        });
        links.length = 0;
        links.push(...uniqueLinks);
        
        // 移除被合并的节点
        const nodesToKeep = nodes.filter(node => !mergeMap.has(node.id));
        console.log(`✅ 合并完成: 从 ${nodes.length} 个节点减少到 ${nodesToKeep.length} 个节点`);
        nodes.length = 0;
        nodes.push(...nodesToKeep);
    } else {
        console.log('✅ 未发现相似节点，无需合并');
    }
    
    // 🚫 检查并移除孤立节点（没有任何连接线的节点）
    const nodeIdsInLinks = new Set();
    links.forEach(link => {
        nodeIdsInLinks.add(link.source);
        nodeIdsInLinks.add(link.target);
    });
    
    const isolatedNodes = nodes.filter(node => !nodeIdsInLinks.has(node.id));
    if (isolatedNodes.length > 0) {
        console.warn(`⚠️ 发现 ${isolatedNodes.length} 个孤立节点（没有任何连接线），将被移除:`);
        isolatedNodes.forEach(node => {
            console.warn(`  - 孤立节点: "${node.label}" (id: ${node.id}, layer: ${node.layer})`);
        });
        
        // 移除孤立节点
        const filteredNodes = nodes.filter(node => nodeIdsInLinks.has(node.id));
        console.log(`✅ 已移除 ${isolatedNodes.length} 个孤立节点，剩余 ${filteredNodes.length} 个节点`);
        conceptData.nodes = filteredNodes;
    } else {
        console.log('✅ 所有节点都有连接线，没有孤立节点');
    }
    
    return conceptData;
}

/**
 * 判断两个节点之间是否为层次连接
 * @param {Object} source - 源节点
 * @param {Object} target - 目标节点
 * @param {Array} allNodes - 所有节点
 * @param {Array} allLinks - 所有连线
 * @returns {boolean} 是否为层次连接
 */
function isHierarchicalConnection(source, target, allNodes, allLinks) {
    // 计算节点的层次级别（基于y坐标）
    const sourceLevel = Math.round(source.y / 100); // 每100像素为一个层次
    const targetLevel = Math.round(target.y / 100);
    
    // 如果层次不同，则为层次连接
    if (sourceLevel !== targetLevel) {
        return true;
    }
    
    // 检查是否存在间接的层次关系
    // 通过BFS查找是否存在从source到target的层次路径
    const visited = new Set();
    const queue = [{ node: source, level: sourceLevel }];
    
    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current.node.id)) continue;
        visited.add(current.node.id);
        
        // 查找当前节点的所有连接
        allLinks.forEach(link => {
            if (link.source === current.node.id) {
                const nextNode = allNodes.find(n => n.id === link.target);
                if (nextNode) {
                    const nextLevel = Math.round(nextNode.y / 100);
                    if (nextLevel !== current.level) {
                        // 找到层次变化，说明存在层次关系
                        if (nextNode.id === target.id) {
                            return true; // 找到层次连接
                        }
                        queue.push({ node: nextNode, level: nextLevel });
                    }
                }
            }
        });
    }
    
    // 默认情况下，如果y坐标差异较大，认为是层次连接
    const yDiff = Math.abs(target.y - source.y);
    return yDiff > 80; // 如果y坐标差异大于80像素，认为是层次连接
}

/**
 * 计算文字实际尺寸的函数
 * @param {string} text - 文字内容
 * @param {string} fontSize - 字体大小
 * @param {string} fontFamily - 字体族
 * @returns {Object} 文字尺寸
 */
function calculateTextDimensions(text, fontSize = '16', fontFamily = 'Arial, sans-serif') {
    // 创建临时SVG元素来测量文字尺寸
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    
    tempText.setAttribute('font-size', fontSize);
    tempText.setAttribute('font-family', fontFamily);
    tempText.setAttribute('font-weight', '500');
    tempText.textContent = text;
    
    tempSvg.appendChild(tempText);
    document.body.appendChild(tempSvg);
    
    // 获取文字的实际尺寸
    const bbox = tempText.getBBox();
    const width = bbox.width;
    const height = bbox.height;
    
    // 清理临时元素
    document.body.removeChild(tempSvg);
    
    return { width, height };
}

/**
 * 计算节点最佳尺寸的函数
 * @param {string} nodeLabel - 节点标签
 * @param {number} minWidth - 最小宽度
 * @param {number} minHeight - 最小高度
 * @param {number} padding - 内边距
 * @returns {Object} 节点尺寸
 */
function calculateNodeDimensions(nodeLabel, minWidth = 80, minHeight = 40, padding = 16) {
    if (!nodeLabel || nodeLabel.trim() === '') {
        return { width: minWidth, height: minHeight };
    }
    
    // 计算文字尺寸（放大字体）
    const textDimensions = calculateTextDimensions(nodeLabel, '13', 'Arial, sans-serif');
    
    // 计算节点尺寸（文字尺寸 + 内边距）
    const nodeWidth = Math.max(minWidth, textDimensions.width + padding);
    const nodeHeight = Math.max(minHeight, textDimensions.height + padding);
    
    return { width: nodeWidth, height: nodeHeight };
}

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        ensureSingleFirstLayer,
        calculateKeywordMatchScore,
        convertToD3Format,
        parseTriplesFromResponse,
        convertTriplesToConceptData,
        isHierarchicalConnection,
        calculateTextDimensions,
        calculateNodeDimensions
    };
} else if (typeof window !== 'undefined') {
    // 浏览器环境 - 显式地将函数添加到 window 对象，确保全局可访问
    window.ensureSingleFirstLayer = ensureSingleFirstLayer;
    window.calculateKeywordMatchScore = calculateKeywordMatchScore;
    window.convertToD3Format = convertToD3Format;
    window.parseTriplesFromResponse = parseTriplesFromResponse;
    window.convertTriplesToConceptData = convertTriplesToConceptData;
    window.isHierarchicalConnection = isHierarchicalConnection;
    window.calculateTextDimensions = calculateTextDimensions;
    window.calculateNodeDimensions = calculateNodeDimensions;
    
    console.log('✅ data-processing.js 已加载，所有函数已添加到全局作用域');
}
