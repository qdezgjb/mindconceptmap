// Sugiyama层次布局算法模块
// 包含完整的Sugiyama算法实现，用于绘制层次结构的概念图

/**
 * Sugiyama算法步骤1: 层次分配
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @returns {Map} 层次Map，键为层次编号，值为该层的节点数组
 */
function assignLayers(nodes, links) {
    console.log('开始层次分配...');
    
    // 创建节点Map以便快速查找
    const nodeMap = new Map();
    nodes.forEach(node => {
        nodeMap.set(node.id, node);
    });
    
    // 检查是否所有节点都已经有layer属性
    const nodesWithLayer = nodes.filter(node => node.layer !== undefined && node.layer >= 1);
    const useExistingLayers = nodesWithLayer.length > 0;
    
    if (useExistingLayers) {
        console.log(`检测到${nodesWithLayer.length}个节点已有layer属性，使用现有层级信息`);
        console.log('节点layer详情:');
        nodes.forEach(node => {
            console.log(`  - ${node.label}: layer=${node.layer}, id=${node.id}`);
        });
        
        // ⚠️ 重要：冻结节点的layer属性，防止被意外修改
        // 使用节点已有的layer属性进行分配，绝不调整层级
        const levels = new Map();
        
        nodes.forEach(node => {
            // 严格保持节点原有的 layer 值，不做任何调整
            const nodeLayer = node.layer;
            
            // 验证 layer 值的有效性（移除层级上限限制，支持任意层数）
            if (nodeLayer === undefined || nodeLayer < 1) {
                console.error(`❌ 节点"${node.label}"的layer值无效: ${nodeLayer}，强制设为1`);
                node.layer = 1;
            }
            
            // 转换为从0开始的层级（layer=1变为level=0，layer=2变为level=1，以此类推）
            const level = node.layer - 1;
            
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level).push(node);
            
            // ⚠️ 关键：这里不再重新赋值 node.layer，避免任何可能的修改
            // node.layer 保持其原始值不变
        });
        
        console.log(`使用现有层级分配完成，共${levels.size}层`);
        console.log(`总节点数: ${nodes.length}`);
        levels.forEach((levelNodes, level) => {
            console.log(`第${level}层(layer=${level + 1}，节点数=${levelNodes.length}): ${levelNodes.map(n => `${n.label}(id=${n.id})`).join(', ')}`);
        });
        
        // 验证：检查是否所有节点都被分配到某一层
        const totalNodesInLevels = Array.from(levels.values()).reduce((sum, arr) => sum + arr.length, 0);
        if (totalNodesInLevels !== nodes.length) {
            console.error(`❌ 节点分配错误！总节点数=${nodes.length}，分配到层级的节点数=${totalNodesInLevels}`);
        }
        
        // 验证每个节点的layer属性是否正确
        console.log('验证节点layer属性:');
        nodes.forEach(node => {
            const expectedLevel = node.layer - 1;
            const actualLevel = Array.from(levels.entries()).find(([level, levelNodes]) => 
                levelNodes.some(n => n.id === node.id)
            )?.[0];
            if (expectedLevel !== actualLevel) {
                console.error(`❌ 节点"${node.label}"层级不匹配！期望level=${expectedLevel}(layer=${node.layer})，实际level=${actualLevel}`);
            }
        });
        
        return levels;
    }
    
    console.log('节点没有layer属性，使用BFS算法分配层级');
    
    // 初始化所有节点的层次为-1（未分配）
    nodes.forEach(node => {
        node.layer = -1;
    });
    
    // 找到所有入度为0的节点（根节点）
    const inDegree = new Map();
    nodes.forEach(node => {
        inDegree.set(node.id, 0);
    });
    
    links.forEach(link => {
        const targetId = link.target;
        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
    });
    
    const rootNodes = nodes.filter(node => inDegree.get(node.id) === 0);
    console.log(`找到${rootNodes.length}个根节点:`, rootNodes.map(n => n.label));
    
    // 从根节点开始进行BFS层次分配
    const levels = new Map();
    let currentLevel = 0;
    let currentLevelNodes = [...rootNodes];
    
    while (currentLevelNodes.length > 0) {
        console.log(`分配第${currentLevel}层，节点数: ${currentLevelNodes.length}`);
        
        // 将当前层的节点标记层次（使用1-based的layer值）
        currentLevelNodes.forEach(node => {
            node.layer = currentLevel + 1; // layer从1开始
        });
        
        // 存储当前层（level从0开始）
        levels.set(currentLevel, currentLevelNodes);
        
        // 找到下一层的节点
        const nextLevelNodes = [];
        currentLevelNodes.forEach(node => {
            links.forEach(link => {
                if (link.source === node.id) {
                    const targetNode = nodeMap.get(link.target);
                    if (targetNode && targetNode.layer === -1) {
                        // 检查是否已经在下一层候选列表中
                        if (!nextLevelNodes.find(n => n.id === targetNode.id)) {
                            nextLevelNodes.push(targetNode);
                        }
                    }
                }
            });
        });
        
        currentLevelNodes = nextLevelNodes;
        currentLevel++;
    }
    
    // 处理孤立的节点（没有连线的节点）
    const isolatedNodes = nodes.filter(node => node.layer === -1);
    if (isolatedNodes.length > 0) {
        console.log(`发现${isolatedNodes.length}个孤立节点，分配到第${currentLevel}层`);
        isolatedNodes.forEach(node => {
            node.layer = currentLevel + 1; // layer从1开始
        });
        levels.set(currentLevel, isolatedNodes);
    }
    
    // 🔴 验证：确保所有节点都被分配到层级
    const allAssignedNodeIds = new Set();
    levels.forEach((levelNodes, level) => {
        levelNodes.forEach(node => allAssignedNodeIds.add(node.id));
    });
    const missingInLevels = nodes.filter(node => !allAssignedNodeIds.has(node.id));
    if (missingInLevels.length > 0) {
        console.error(`❌ 警告！有 ${missingInLevels.length} 个节点不在levels中:`, missingInLevels.map(n => `${n.label}(${n.id})`));
        // 强制将这些节点添加到第1层
        missingInLevels.forEach(node => {
            console.log(`  强制将节点 "${node.label}" 添加到第1层`);
            if (!levels.has(0)) {
                levels.set(0, []);
            }
            levels.get(0).push(node);
            if (node.layer === undefined || node.layer < 1) {
                node.layer = 1;
            }
        });
    }
    
    // 🔴 验证：确保所有节点都有有效的layer属性
    const unassignedNodes = nodes.filter(node => node.layer === undefined || node.layer < 1);
    if (unassignedNodes.length > 0) {
        console.error(`❌ 警告！有 ${unassignedNodes.length} 个节点没有有效的layer属性:`, unassignedNodes.map(n => `${n.label}(${n.id})`));
        // 强制将这些节点分配到第1层
        unassignedNodes.forEach(node => {
            console.log(`  强制将节点 "${node.label}" 的layer设置为1`);
            node.layer = 1;
            // 确保节点也在levels中
            if (!allAssignedNodeIds.has(node.id)) {
                if (!levels.has(0)) {
                    levels.set(0, []);
                }
                levels.get(0).push(node);
            }
        });
    }
    
    console.log(`层次分配完成，共${levels.size}层，总节点数: ${nodes.length}`);
    levels.forEach((levelNodes, level) => {
        console.log(`第${level}层(layer=${level + 1}): ${levelNodes.map(n => n.label).join(', ')}`);
    });
    
    // 不应用每层节点数量限制，保持原有层级结构
    return levels;
}

/**
 * Sugiyama算法步骤2: 节点排序 - 减少连线交叉
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @param {Map} levels - 层次Map
 * @returns {Map} 排序后的层次Map
 */
function orderNodesInLayers(nodes, links, levels) {
    console.log('开始节点排序，减少连线交叉...');
    
    // 创建节点Map
    const nodeMap = new Map();
    nodes.forEach(node => {
        nodeMap.set(node.id, node);
    });
    
    // 检测聚合连线
    const aggregatedLinks = detectAggregatedLinksForLayout(links);
    const aggregatedTargetNodes = new Set(); // 聚合连线的目标节点ID集合
    aggregatedLinks.forEach(group => {
        group.links.forEach(link => {
            aggregatedTargetNodes.add(link.target);
        });
    });
    
    const orderedLevels = new Map();
    
    // 对每一层进行排序
    levels.forEach((levelNodes, level) => {
        console.log(`排序第${level}层，节点数: ${levelNodes.length}`);
        
        if (levelNodes.length <= 1) {
            // 如果只有0个或1个节点，直接使用
            orderedLevels.set(level, levelNodes);
            return;
        }
        
        // 使用重心排序算法，并考虑聚合连线
        const sortedNodes = sortNodesByBarycenter(levelNodes, links, nodeMap, level, aggregatedLinks, aggregatedTargetNodes);
        
        // 禁用节点顺序优化，直接返回排序后的节点
        orderedLevels.set(level, sortedNodes);
        
        console.log(`第${level}层排序完成:`, sortedNodes.map(n => n.label));
    });
    
    console.log('节点排序完成');
    return orderedLevels;
}

/**
 * 检测聚合连线（用于层次布局）
 * @param {Array} links - 连线数组
 * @returns {Array} 聚合连接组数组，每个组包含 {sourceId, label, links: [...]}
 */
function detectAggregatedLinksForLayout(links) {
    const groups = new Map();
    
    links.forEach(link => {
        const label = link.label || '双击编辑';
        // 只对非空且有意义的连接词进行聚合（排除默认值）
        if (label && label !== '双击编辑' && label.trim().length > 0) {
            const key = `${link.source}_${label}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    sourceId: link.source,
                    label: label,
                    links: []
                });
            }
            groups.get(key).links.push(link);
        }
    });
    
    // 只返回有2个或更多连线的组（需要聚合）
    return Array.from(groups.values()).filter(group => group.links.length >= 2);
}

/**
 * 按重心排序节点
 * @param {Array} levelNodes - 层次中的节点数组
 * @param {Array} links - 连线数组
 * @param {Map} nodeMap - 节点Map
 * @param {number} level - 层次编号（0-based）
 * @param {Array} aggregatedLinks - 聚合连线组数组
 * @param {Set} aggregatedTargetNodes - 聚合连线的目标节点ID集合
 * @returns {Array} 排序后的节点数组
 */
function sortNodesByBarycenter(levelNodes, links, nodeMap, level, aggregatedLinks = [], aggregatedTargetNodes = new Set()) {
    console.log(`对第${level}层进行重心排序...`);
    
    // 如果层中只有一个或零个节点，直接返回
    if (levelNodes.length <= 1) {
        return levelNodes;
    }
    
    // 获取当前层的 layer 值（1-based）- 验证所有节点的layer是否一致
    const currentLayer = levelNodes[0].layer; // 假设同一层的节点 layer 值相同
    const allSameLayer = levelNodes.every(n => n.layer === currentLayer);
    if (!allSameLayer) {
        console.error(`❌ 第${level}层节点layer不一致！`);
        levelNodes.forEach(n => {
            console.error(`  - ${n.label}: layer=${n.layer}`);
        });
    }
    console.log(`  当前层layer值: ${currentLayer}，预期layer值: ${level + 1}`);
    
    // 计算每个节点的重心
    const nodeBarycenters = new Map();
    
    // 检测同层连接：找出有同层连接的节点对
    const sameLayerConnections = new Map(); // nodeId -> Set of connected nodeIds (same layer)
    links.forEach(link => {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (sourceNode && targetNode && sourceNode.layer === targetNode.layer && sourceNode.layer === currentLayer) {
            // 同层连接
            if (!sameLayerConnections.has(link.source)) {
                sameLayerConnections.set(link.source, new Set());
            }
            if (!sameLayerConnections.has(link.target)) {
                sameLayerConnections.set(link.target, new Set());
            }
            sameLayerConnections.get(link.source).add(link.target);
            sameLayerConnections.get(link.target).add(link.source);
        }
    });
    
    levelNodes.forEach(node => {
        let totalWeight = 0;
        let weightedSum = 0;
        
        // 计算连接到上层和下层节点的平均位置
        links.forEach(link => {
            if (link.source === node.id) {
                const targetNode = nodeMap.get(link.target);
                if (targetNode && targetNode.layer > currentLayer) {
                    // 连接到下层
                    const targetIndex = Array.from(nodeMap.values())
                        .filter(n => n.layer === targetNode.layer)
                        .sort((a, b) => a.x - b.x)
                        .findIndex(n => n.id === targetNode.id);
                    
                    if (targetIndex !== -1) {
                        weightedSum += targetIndex;
                        totalWeight += 1;
                    }
                }
            } else if (link.target === node.id) {
                const sourceNode = nodeMap.get(link.source);
                if (sourceNode && sourceNode.layer < currentLayer) {
                    // 连接到上层
                    const sourceIndex = Array.from(nodeMap.values())
                        .filter(n => n.layer === sourceNode.layer)
                        .sort((a, b) => a.x - b.x)
                        .findIndex(n => n.id === sourceNode.id);
                    
                    if (sourceIndex !== -1) {
                        weightedSum += sourceIndex;
                        totalWeight += 1;
                    }
                }
            }
        });
        
        const barycenter = totalWeight > 0 ? weightedSum / totalWeight : 0;
        nodeBarycenters.set(node.id, barycenter);
    });
    
    // 按重心排序，但优先将聚合连线的目标节点聚集在一起，同时考虑同层连接
    const sortedNodes = [...levelNodes].sort((a, b) => {
        const isAggregatedA = aggregatedTargetNodes.has(a.id);
        const isAggregatedB = aggregatedTargetNodes.has(b.id);
        
        // 检查是否有同层连接
        const hasSameLayerConnectionA = sameLayerConnections.has(a.id);
        const hasSameLayerConnectionB = sameLayerConnections.has(b.id);
        const areConnected = (hasSameLayerConnectionA && sameLayerConnections.get(a.id).has(b.id)) ||
                             (hasSameLayerConnectionB && sameLayerConnections.get(b.id).has(a.id));
        
        // 如果两个节点有同层连接，优先将它们放在一起（但优先层级靠近原则）
        if (areConnected) {
            // 有同层连接的节点优先相邻，但还是要考虑重心（层级靠近）
            const barycenterA = nodeBarycenters.get(a.id) || 0;
            const barycenterB = nodeBarycenters.get(b.id) || 0;
            return barycenterA - barycenterB;
        }
        
        // 如果两个节点都是聚合连线的目标节点，检查它们是否属于同一个聚合组
        if (isAggregatedA && isAggregatedB) {
            // 找到它们所属的聚合组
            let groupA = null, groupB = null;
            for (const group of aggregatedLinks) {
                if (group.links.some(link => link.target === a.id)) {
                    groupA = group;
                }
                if (group.links.some(link => link.target === b.id)) {
                    groupB = group;
                }
            }
            
            // 如果属于同一个聚合组，按重心排序；否则按聚合组的源节点位置排序
            if (groupA && groupB && groupA.sourceId === groupB.sourceId) {
                const barycenterA = nodeBarycenters.get(a.id) || 0;
                const barycenterB = nodeBarycenters.get(b.id) || 0;
                return barycenterA - barycenterB;
            } else {
                // 不同聚合组，按源节点位置排序
                const sourceA = groupA ? nodeMap.get(groupA.sourceId) : null;
                const sourceB = groupB ? nodeMap.get(groupB.sourceId) : null;
                if (sourceA && sourceB) {
                    return (sourceA.x || 0) - (sourceB.x || 0);
                }
            }
        }
        
        // 聚合连线的目标节点优先放在一起
        if (isAggregatedA && !isAggregatedB) return -1;
        if (!isAggregatedA && isAggregatedB) return 1;
        
        // 其他情况按重心排序（优先层级靠近）
        const barycenterA = nodeBarycenters.get(a.id) || 0;
        const barycenterB = nodeBarycenters.get(b.id) || 0;
        return barycenterA - barycenterB;
    });
    
    console.log(`第${level}层重心排序完成`);
    return sortedNodes;
}

/**
 * Sugiyama算法步骤3: 坐标分配 - 支持多层布局，层间距相同，居中显示，四周间距相同
 * @param {Array} nodes - 节点数组
 * @param {Map} orderedLevels - 排序后的层次Map
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {Array} links - 连线数组
 */
function assignCoordinates(nodes, orderedLevels, width, height, links = []) {
    console.log('开始坐标分配...');
    
    // 计算布局参数
    const horizontalMargin = 150; // 左右边距
    const focusToLayer1Spacing = 60; // 焦点问题到第一层的间距（增大间距）
    const minLayerSpacing = 220; // 最小层间距（220px，增大行间距）
    const minGapBetweenLayers = 50; // 相邻层节点之间的最小间隙（50px，增大行间距）
    
    // 计算总层数和内容总高度
    const levelCount = orderedLevels.size;
    const focusQuestionHeight = 60; // 焦点问题框的估计高度
    
    // 首先计算每层节点的最大高度，用于动态调整层间距
    const levelHeights = new Map();
    orderedLevels.forEach((levelNodes, level) => {
        let maxHeight = 0;
        levelNodes.forEach(node => {
            let nodeHeight = 50; // 默认高度
            if (window.calculateNodeDimensions) {
                const nodeDimensions = window.calculateNodeDimensions(node.label || '', 90, 45, 20);
                nodeHeight = node.height || nodeDimensions.height;
            } else if (node.height) {
                nodeHeight = node.height;
            }
            maxHeight = Math.max(maxHeight, nodeHeight);
        });
        levelHeights.set(level, maxHeight);
        console.log(`第${level}层最大节点高度: ${maxHeight}px`);
    });
    
    // 计算动态层间距：确保相邻层节点不重叠
    // 间距 = 上层节点高度/2 + 最小间隙 + 下层节点高度/2
    const layerSpacings = [];
    for (let i = 0; i < levelCount - 1; i++) {
        const currentLevelHeight = levelHeights.get(i) || 50;
        const nextLevelHeight = levelHeights.get(i + 1) || 50;
        const dynamicSpacing = currentLevelHeight / 2 + minGapBetweenLayers + nextLevelHeight / 2;
        const finalSpacing = Math.max(minLayerSpacing, dynamicSpacing);
        layerSpacings.push(finalSpacing);
        console.log(`第${i}层到第${i+1}层的间距: ${finalSpacing.toFixed(1)}px (动态计算: ${dynamicSpacing.toFixed(1)}px)`);
    }
    
    // 计算总内容高度
    let totalSpacing = 0;
    layerSpacings.forEach(spacing => totalSpacing += spacing);
    const totalContentHeight = focusQuestionHeight + focusToLayer1Spacing + totalSpacing;
    
    // 整体布局位置设置
    // 焦点问题框的Y坐标设置为80，距离上边界有一定间距
    // viewBox的Y起始位置设置为0，焦点问题框会显示在顶部区域
    const focusQuestionY = 80; // 焦点问题的Y坐标，距离顶部80px
    const topMargin = 30; // 上边距为30px
    const bottomMargin = 50; // 下边距固定为50px，不再居中
    
    // 计算第一层的Y坐标（相对于焦点问题框）
    const layer1Y = focusQuestionY + focusQuestionHeight + focusToLayer1Spacing; // 第一层的Y坐标
    
    console.log(`布局参数: 上边距=${topMargin.toFixed(1)}, 下边距=${bottomMargin.toFixed(1)}, 焦点到第一层间距=${focusToLayer1Spacing}`);
    console.log(`焦点问题Y坐标: ${focusQuestionY.toFixed(1)}, 第一层Y坐标: ${layer1Y.toFixed(1)}`);
    console.log(`总层数: ${levelCount}, 总内容高度: ${totalContentHeight.toFixed(1)}, 画布高度: ${height}`);
    
    // 保存焦点问题的Y坐标到全局，供displayFocusQuestion使用
    window.focusQuestionY = focusQuestionY;
    window.focusQuestionHeight = focusQuestionHeight;
    
    // 遍历每一层，分配坐标
    let currentY = layer1Y;
    orderedLevels.forEach((levelNodes, level) => {
        // 使用累积的Y坐标，而不是固定的间距
        const y = currentY;
        
        console.log(`==== 第${level}层(layer=${level + 1}) Y坐标: ${y} ====`);
        console.log(`  节点列表: ${levelNodes.map(n => n.label).join(', ')}`);
        console.log(`  节点layer属性: ${levelNodes.map(n => `${n.label}(${n.layer})`).join(', ')}`);
        
        // 计算当前层的可用宽度（考虑左右边距）
        const availableWidth = width - 2 * horizontalMargin;
        
        // 计算每个节点的实际宽度
        const nodeWidths = levelNodes.map(node => {
            if (window.calculateNodeDimensions) {
                const nodeDimensions = window.calculateNodeDimensions(node.label || '', 90, 45, 20);
                return node.width || nodeDimensions.width;
            }
            return node.width || 100; // 默认宽度
        });
        
        // 计算所有节点的总宽度
        const totalNodeWidth = nodeWidths.reduce((sum, w) => sum + w, 0);
        
        // 自适应间距：根据节点数量动态调整，保持美观
        const minSpacing = 30; // 最小间距
        const maxSpacing = 150; // 最大间距（节点少时，大幅增大）
        
        // 计算节点间距：节点越多，间距越小
        let nodeSpacing;
        if (levelNodes.length === 1) {
            // 只有一个节点时，居中显示，不需要间距
            nodeSpacing = 0;
        } else if (levelNodes.length === 2) {
            // 2个节点时使用最大间距
            nodeSpacing = maxSpacing;
        } else if (levelNodes.length <= 4) {
            // 3-4个节点时使用较大间距
            nodeSpacing = 120;
        } else if (levelNodes.length <= 6) {
            // 5-6个节点，适中间距
            nodeSpacing = 80;
        } else if (levelNodes.length <= 10) {
            // 7-10个节点，适当减小间距
            nodeSpacing = 55;
        } else {
            // 节点很多时使用较小间距，但保持可读性
            nodeSpacing = Math.max(minSpacing, 50 - (levelNodes.length - 10) * 2);
        }
        
        // 计算所有节点的总宽度（节点宽度 + 间距）
        const totalSpacing = levelNodes.length > 1 ? (levelNodes.length - 1) * nodeSpacing : 0;
        let totalWidth = totalNodeWidth + totalSpacing;
        
        // 计算起始X坐标（居中显示）
        const centerX = width / 2;
        const maxAvailableWidth = width - 2 * horizontalMargin;
        
        // 如果空间不足，进一步减小间距
        if (totalWidth > maxAvailableWidth && levelNodes.length > 1) {
            const adjustedSpacing = (maxAvailableWidth - totalNodeWidth) / (levelNodes.length - 1);
            nodeSpacing = Math.max(adjustedSpacing, minSpacing);
            // 重新计算总宽度
            const newTotalSpacing = levelNodes.length > 1 ? (levelNodes.length - 1) * nodeSpacing : 0;
            totalWidth = totalNodeWidth + newTotalSpacing;
            console.log(`第${level}层自适应间距: ${nodeSpacing.toFixed(1)}px`);
        }
        
        // 居中显示
        let startX = centerX - totalWidth / 2;
        // 确保在边界内
        if (startX < horizontalMargin) {
            startX = horizontalMargin;
        }
        const endX = startX + totalWidth;
        if (endX > width - horizontalMargin) {
            startX = width - horizontalMargin - totalWidth;
            if (startX < horizontalMargin) {
                startX = horizontalMargin;
            }
        }
        
        let currentX = startX;
        
        // 检测聚合连线，对聚合连线的目标节点进行特殊处理
        const aggregatedLinks = detectAggregatedLinksForLayout(window.currentGraphData ? window.currentGraphData.links : []);
        const aggregatedTargetNodes = new Set();
        const aggregatedGroupsByTarget = new Map(); // targetId -> group
        aggregatedLinks.forEach(group => {
            group.links.forEach(link => {
                aggregatedTargetNodes.add(link.target);
                aggregatedGroupsByTarget.set(link.target, group);
            });
        });
        
        // 为每个节点分配坐标（居中排布，统一间距）
        levelNodes.forEach((node, index) => {
            const nodeWidth = nodeWidths[index];
            
            // 🔴 如果节点有固定位置，保持其位置不变，跳过布局计算
            if (node.fixedPosition && node.savedX !== undefined && node.savedY !== undefined) {
                // 保持固定位置，但更新Y坐标以保持在同一层
                node.x = node.savedX;
                node.y = node.savedY; // 保持用户拖放的Y坐标，不强制到层级Y
                console.log(`  节点 "${node.label}" 保持固定位置: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
                // 不更新 currentX，因为固定位置的节点不影响其他节点的布局
                return; // 在 forEach 中使用 return 跳过当前迭代
            }
            
            // 统一使用相同的间距，确保同一行节点间距一致
            // 当前节点的X坐标（节点中心）
            currentX += nodeWidth / 2;
            node.x = currentX;
            node.y = y;
            
            // 移动到下一个节点的起始位置（当前节点右边缘 + 统一间距）
            currentX += nodeWidth / 2 + nodeSpacing;
            
            console.log(`  节点 "${node.label}" (layer=${node.layer}) 坐标: (${node.x.toFixed(1)}, ${y}), 宽度: ${nodeWidth.toFixed(1)}, 间距: ${nodeSpacing.toFixed(1)}`);
        });
        
        console.log(`  第${level}层间距: ${nodeSpacing.toFixed(1)}px, 节点数: ${levelNodes.length}, 总宽度: ${totalWidth.toFixed(1)}px`);
        
        console.log(`第${level}层坐标分配完成，节点数: ${levelNodes.length}`);
        
        // 更新下一层的起始Y坐标
        // spacing 已经是从当前层中心到下一层中心的距离（包含节点高度和间隙）
        // 所以下一层中心 = 当前层中心 + spacing
        if (level < levelCount - 1) {
            const spacing = layerSpacings[level];
            currentY = y + spacing;
            console.log(`  下一层(level=${level+1})的Y坐标将设置为: ${currentY.toFixed(1)}`);
        }
    });
    
    console.log('坐标分配完成');
    
    // 🔴 新增：优化父子节点位置对齐（让有连接词的上下级节点距离更近）
    optimizeParentChildAlignment(nodes, links, width, horizontalMargin);
}

/**
 * 优化父子节点位置对齐 - 让有连接关系的上下层节点在垂直方向上更接近
 * @param {Array} nodes - 所有节点
 * @param {Array} links - 所有连接
 * @param {number} width - 画布宽度
 * @param {number} horizontalMargin - 水平边距
 */
function optimizeParentChildAlignment(nodes, links, width, horizontalMargin) {
    console.log('开始优化父子节点位置对齐...');
    
    if (!nodes || nodes.length === 0 || !links || links.length === 0) {
        console.log('没有节点或连接，跳过位置优化');
        return;
    }
    
    // 创建节点ID到节点的映射
    const nodeById = new Map();
    nodes.forEach(node => nodeById.set(node.id, node));
    
    // 按层级分组节点
    const layerNodes = new Map();
    nodes.forEach(node => {
        const layer = node.layer || 1;
        if (!layerNodes.has(layer)) {
            layerNodes.set(layer, []);
        }
        layerNodes.get(layer).push(node);
    });
    
    // 对每层节点按X坐标排序
    layerNodes.forEach((nodesInLayer, layer) => {
        nodesInLayer.sort((a, b) => a.x - b.x);
    });
    
    // 获取所有层级，从第2层开始调整（第1层保持居中）
    const sortedLayers = Array.from(layerNodes.keys()).sort((a, b) => a - b);
    
    // 只进行一轮调整，避免多次迭代导致问题
    console.log('  进行父子节点位置优化...');
    
    // 从上到下调整：根据父节点位置调整子节点排序
    for (let i = 1; i < sortedLayers.length; i++) {
        const currentLayer = sortedLayers[i];
        const currentNodes = layerNodes.get(currentLayer);
        
        if (!currentNodes || currentNodes.length === 0) continue;
        
        // 计算每个节点的理想X位置（父节点的平均X位置）
        const idealPositions = new Map();
        
        currentNodes.forEach(node => {
            // 找到所有连接到该节点的父节点
            const parentNodes = [];
            links.forEach(link => {
                if (link.target === node.id) {
                    const parent = nodeById.get(link.source);
                    if (parent && parent.layer < node.layer) {
                        parentNodes.push(parent);
                    }
                }
            });
            
            if (parentNodes.length > 0) {
                // 计算父节点的平均X位置
                const avgParentX = parentNodes.reduce((sum, p) => sum + p.x, 0) / parentNodes.length;
                idealPositions.set(node.id, avgParentX);
            } else {
                // 没有父节点的，使用当前位置作为理想位置
                idealPositions.set(node.id, node.x);
            }
        });
        
        // 按理想位置排序所有节点
        const sortedCurrentNodes = [...currentNodes].sort((a, b) => {
            const idealA = idealPositions.get(a.id) || a.x;
            const idealB = idealPositions.get(b.id) || b.x;
            return idealA - idealB;
        });
        
        // 重新分配X坐标，确保不重叠
        const nodeWidths = sortedCurrentNodes.map(node => {
            if (window.calculateNodeDimensions) {
                const dim = window.calculateNodeDimensions(node.label || '', 90, 45, 20);
                return node.width || dim.width;
            }
            return node.width || 100;
        });
        
        const totalNodeWidth = nodeWidths.reduce((sum, w) => sum + w, 0);
        
        // 使用与原布局相同的间距逻辑
        let nodeSpacing;
        if (sortedCurrentNodes.length <= 1) {
            nodeSpacing = 0;
        } else if (sortedCurrentNodes.length === 2) {
            nodeSpacing = 150;
        } else if (sortedCurrentNodes.length <= 4) {
            nodeSpacing = 120;
        } else if (sortedCurrentNodes.length <= 6) {
            nodeSpacing = 80;
        } else if (sortedCurrentNodes.length <= 10) {
            nodeSpacing = 55;
        } else {
            nodeSpacing = Math.max(30, 50 - (sortedCurrentNodes.length - 10) * 2);
        }
        
        const totalSpacing = sortedCurrentNodes.length > 1 ? (sortedCurrentNodes.length - 1) * nodeSpacing : 0;
        const totalWidth = totalNodeWidth + totalSpacing;
        
        // 居中计算起始位置
        const centerX = width / 2;
        let startX = centerX - totalWidth / 2;
        if (startX < horizontalMargin) startX = horizontalMargin;
        
        // 直接分配新的X坐标，不使用平滑过渡（避免重叠）
        let currentX = startX;
        sortedCurrentNodes.forEach((node, idx) => {
            const nodeWidth = nodeWidths[idx];
            currentX += nodeWidth / 2;
            node.x = currentX; // 直接赋值，确保不重叠
            currentX += nodeWidth / 2 + nodeSpacing;
        });
        
        // 更新layerNodes中的排序
        layerNodes.set(currentLayer, sortedCurrentNodes);
    }
    
    console.log('父子节点位置对齐优化完成');
}

/**
 * 调整SVG的viewBox，确保所有节点都在可视范围内
 * @param {Array} nodes - 节点数组
 * @param {number} baseWidth - 基础宽度
 * @param {number} baseHeight - 基础高度
 */
function adjustViewBox(nodes, baseWidth, baseHeight) {
    console.log('调整viewBox...');
    
    if (!nodes || nodes.length === 0) {
        console.log('没有节点，跳过viewBox调整');
        return;
    }
    
    // 计算所有节点的边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // 如果有焦点问题框，将其纳入边界计算（优先考虑焦点问题框）
    let hasFocusQuestion = false;
    if (window.focusQuestionY !== undefined && window.focusQuestionHeight !== undefined) {
        minY = window.focusQuestionY; // 焦点问题框的Y坐标作为最小Y
        maxY = window.focusQuestionY + window.focusQuestionHeight; // 焦点问题框的底部作为初始最大Y
        hasFocusQuestion = true;
        console.log('将焦点问题框纳入边界计算:', {
            focusY: window.focusQuestionY,
            focusHeight: window.focusQuestionHeight,
            minY: minY,
            maxY: maxY
        });
    }
    
    // 遍历所有节点，更新边界
    nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y); // 确保包含所有节点
            maxX = Math.max(maxX, node.x);
            maxY = Math.max(maxY, node.y); // 确保包含所有节点
        }
    });
    
    // 添加边距（保持一致性）
    const horizontalMargin = 50;
    const topVerticalMargin = 5; // 顶部边距为5px
    const bottomVerticalMargin = 50; // 底部边距固定为50px
    
    // 计算边界（考虑边距）
    const calculatedMinX = Math.max(0, minX - horizontalMargin);
    const calculatedMinY = Math.max(0, minY - topVerticalMargin); // 确保不小于0
    const calculatedMaxX = Math.min(baseWidth, maxX + horizontalMargin);
    const calculatedMaxY = maxY + bottomVerticalMargin; // 使用底部边距
    
    // 计算新的viewBox - 上边界设置为0，焦点问题框从Y=5开始
    const viewBoxStartY = 0; // Y起始位置设置为0
    const viewBoxStartX = 0; // 始终从左侧开始
    
    // 计算需要的高度：从0到calculatedMaxY
    const finalHeight = Math.max(baseHeight, calculatedMaxY); // 确保高度足够
    const finalWidth = baseWidth; // 宽度固定为画布宽度
    
    console.log('ViewBox计算详情:', {
        '节点边界': { minX, minY, maxX, maxY },
        '计算后边界': { calculatedMinX, calculatedMinY, calculatedMaxX, calculatedMaxY },
        '焦点问题框': hasFocusQuestion ? { y: window.focusQuestionY, height: window.focusQuestionHeight } : '无',
        'viewBox': { x: viewBoxStartX, y: viewBoxStartY, width: finalWidth, height: finalHeight }
    });
    
    // 更新SVG的viewBox（支持普通概念图和支架概念图）
    let svg = document.querySelector('.concept-graph');
    if (!svg) {
        svg = document.querySelector('.scaffold-concept-graph');
    }
    if (svg) {
        svg.setAttribute('viewBox', `${viewBoxStartX} ${viewBoxStartY} ${finalWidth} ${finalHeight}`);
        console.log(`ViewBox已调整: ${viewBoxStartX} ${viewBoxStartY} ${finalWidth} ${finalHeight}`);
        console.log(`节点边界: (${minX}, ${minY}) - (${maxX}, ${maxY})`);
        console.log(`画布尺寸: ${baseWidth} x ${baseHeight}`);
    }
}

/**
 * 应用Sugiyama布局算法 - 统一入口函数
 * @param {Object} graphData - 图形数据（包含nodes和links）
 * @returns {Object} 应用布局后的图形数据
 */
function applySugiyamaLayout(graphData) {
    console.log('开始应用Sugiyama层次布局算法...');
    
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('图形数据为空，跳过布局');
        return graphData;
    }
    
    const nodes = [...graphData.nodes];
    const links = [...graphData.links];
    
    // 动态获取SVG容器的实际宽度（支持普通概念图和支架概念图）
    let svg = document.querySelector('.concept-graph');
    if (!svg) {
        svg = document.querySelector('.scaffold-concept-graph');
    }
    let containerWidth = 1600;
    let containerHeight = 700; // 统一为700，与HTML和CSS保持一致
    
    if (svg) {
        const svgRect = svg.getBoundingClientRect();
        containerWidth = svgRect.width || 1600;
        containerHeight = svgRect.height || 700; // 统一为700
        console.log(`SVG容器实际尺寸: ${containerWidth} x ${containerHeight}`);
    }
    
    // 使用容器的实际宽度和固定高度
    const width = Math.floor(containerWidth);
    const height = 700; // 固定使用700，与HTML和CSS保持一致
    
    console.log(`画布尺寸: ${width} x ${height}`);
    
    // Sugiyama算法三步骤
    // 步骤1: 层次分配
    const levels = assignLayers(nodes, links);
    
    // 步骤2: 节点排序（减少交叉）
    const orderedLevels = orderNodesInLayers(nodes, links, levels);
    
    // 步骤3: 坐标分配
    assignCoordinates(nodes, orderedLevels, width, height, links);
    
    // 调整viewBox，确保所有元素都在可视范围内
    adjustViewBox(nodes, width, height);
    
    // 重新显示焦点问题，确保位置正确
    if (typeof window.displayFocusQuestion === 'function') {
        window.displayFocusQuestion();
    }
    
    console.log('Sugiyama布局算法应用完成');
    
    return {
        nodes: nodes,
        links: links,
        metadata: graphData.metadata || {}
    };
}

// 导出函数供外部使用
if (typeof window !== 'undefined') {
    window.applySugiyamaLayout = applySugiyamaLayout;
    window.adjustViewBox = adjustViewBox;
    console.log('✅ Sugiyama布局算法已注册到全局作用域');
}
