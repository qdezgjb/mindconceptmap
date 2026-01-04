/**
 * Sugiyama 层次布局算法
 * 
 * 完全采用 concept-map-new-master 的布局方式
 * 
 * Copyright 2024-2025 北京思源智教科技有限公司
 */

// ============================================================================
// Sugiyama 算法步骤1: 层次分配
// ============================================================================

function assignLayers(nodes, links) {
    console.log('Sugiyama: 开始层次分配...');
    
    const nodeMap = new Map();
    nodes.forEach(node => nodeMap.set(node.id, node));
    
    // 🔴 检测聚合连接，用于层级约束
    const aggregatedLinks = detectAggregateGroupsForLayout(links);
    console.log(`Sugiyama: 检测到 ${aggregatedLinks.length} 组聚合连接`);
    
    // 检查是否已有层级信息（包括 layer=0 的焦点问题节点）
    const nodesWithLayer = nodes.filter(node => node.layer !== undefined && node.layer >= 0);
    
    if (nodesWithLayer.length > 0) {
        console.log(`Sugiyama: 检测到 ${nodesWithLayer.length} 个节点已有layer属性`);
        
        // 先设置默认层级
        nodes.forEach(node => {
            // layer=0 是焦点问题节点，保持不变
            // layer=undefined 的节点设为 layer=1
            if (node.layer === undefined) {
                node.layer = 1;
            }
        });
        
        // 🔴 聚合连接约束：确保聚合连接的目标节点在源节点的下层
        if (aggregatedLinks.length > 0) {
            console.log('Sugiyama: 应用聚合连接层级约束...');
            let adjusted = true;
            let iterations = 0;
            const maxIterations = 10; // 防止无限循环
            
            while (adjusted && iterations < maxIterations) {
                adjusted = false;
                iterations++;
                
                aggregatedLinks.forEach(group => {
                    const sourceNode = nodeMap.get(group.sourceId);
                    if (!sourceNode) return;
                    
                    const sourceLayer = sourceNode.layer;
                    // 焦点问题节点(layer=0)不参与聚合约束
                    if (sourceLayer === 0) return;
                    
                    group.targetIds.forEach(targetId => {
                        const targetNode = nodeMap.get(targetId);
                        if (!targetNode) return;
                        
                        // 如果目标节点的层级不大于源节点，则调整
                        if (targetNode.layer <= sourceLayer) {
                            const oldLayer = targetNode.layer;
                            targetNode.layer = sourceLayer + 1;
                            console.log(`  Sugiyama聚合约束: 将节点"${targetNode.label}"从layer=${oldLayer}调整到layer=${targetNode.layer}（源节点"${sourceNode.label}"在layer=${sourceLayer}）`);
                            adjusted = true;
                        }
                    });
                });
            }
            
            if (iterations >= maxIterations) {
                console.warn('Sugiyama: 聚合连接层级约束调整达到最大迭代次数');
            }
        }
        
        // 使用调整后的layer值分配levels
        const levels = new Map();
        nodes.forEach(node => {
            // 使用 layer 值作为 level（焦点问题节点 layer=0 -> level=0）
            const level = node.layer;
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level).push(node);
        });
        
        console.log(`Sugiyama: 使用现有层级，共 ${levels.size} 层`);
        levels.forEach((levelNodes, level) => {
            console.log(`  Level ${level}: ${levelNodes.length} 个节点`);
        });
        return levels;
    }
    
    // 使用 BFS 分配层级
    console.log('Sugiyama: 使用 BFS 算法分配层级');
    
    nodes.forEach(node => node.layer = -1);
    
    // 计算入度
    const inDegree = new Map();
    nodes.forEach(node => inDegree.set(node.id, 0));
    links.forEach(link => {
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
    });
    
    // 找根节点
    const rootNodes = nodes.filter(node => inDegree.get(node.id) === 0);
    if (rootNodes.length === 0 && nodes.length > 0) {
        rootNodes.push(nodes[0]);
    }
    
    console.log(`Sugiyama: 找到 ${rootNodes.length} 个根节点`);
    
    const levels = new Map();
    let currentLevel = 0;
    let currentLevelNodes = [...rootNodes];
    
    while (currentLevelNodes.length > 0) {
        currentLevelNodes.forEach(node => node.layer = currentLevel + 1);
        levels.set(currentLevel, currentLevelNodes);
        
        const nextLevelNodes = [];
        currentLevelNodes.forEach(node => {
            links.forEach(link => {
                const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                
                if (sourceId === node.id) {
                    const targetNode = nodeMap.get(targetId);
                    if (targetNode && targetNode.layer === -1) {
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
    
    // 处理孤立节点
    const isolatedNodes = nodes.filter(node => node.layer === -1);
    if (isolatedNodes.length > 0) {
        console.log(`Sugiyama: 发现 ${isolatedNodes.length} 个孤立节点`);
        isolatedNodes.forEach(node => node.layer = currentLevel + 1);
        levels.set(currentLevel, isolatedNodes);
    }
    
    // 🔴 BFS分配后应用聚合连接约束
    if (aggregatedLinks.length > 0) {
        console.log('Sugiyama BFS后应用聚合连接层级约束...');
        let adjusted = true;
        let iterations = 0;
        const maxIterations = 10;
        
        while (adjusted && iterations < maxIterations) {
            adjusted = false;
            iterations++;
            
            aggregatedLinks.forEach(group => {
                const sourceNode = nodeMap.get(group.sourceId);
                if (!sourceNode) return;
                
                const sourceLayer = sourceNode.layer;
                if (sourceLayer === 0) return; // 跳过焦点问题节点
                
                group.targetIds.forEach(targetId => {
                    const targetNode = nodeMap.get(targetId);
                    if (!targetNode) return;
                    
                    if (targetNode.layer <= sourceLayer) {
                        const oldLayer = targetNode.layer;
                        targetNode.layer = sourceLayer + 1;
                        console.log(`  Sugiyama聚合约束(BFS): 将节点"${targetNode.label}"从layer=${oldLayer}调整到layer=${targetNode.layer}`);
                        adjusted = true;
                    }
                });
            });
        }
        
        // 重建levels Map
        levels.clear();
        nodes.forEach(node => {
            const level = node.layer;
            if (!levels.has(level)) {
                levels.set(level, []);
            }
            levels.get(level).push(node);
        });
    }
    
    console.log(`Sugiyama: 层次分配完成，共 ${levels.size} 层`);
    return levels;
}

// ============================================================================
// Sugiyama 算法步骤2: 节点排序（减少连线交叉）
// 移植自 concept-map-new-master，增强了聚合连线支持
// ============================================================================

/**
 * 检测聚合连线（用于排序优化）
 * @param {Array} links - 连线数组
 * @returns {Array} 聚合连接组数组
 */
function detectAggregatedLinksForSorting(links) {
    const groups = new Map();
    
    links.forEach(link => {
        const label = link.label || '';
        const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
        
        // 只对非空且有意义的连接词进行聚合
        if (label && label.trim().length > 0 && label !== '双击编辑') {
            const key = `${sourceId}_${label}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    sourceId: sourceId,
                    label: label,
                    targetIds: []
                });
            }
            groups.get(key).targetIds.push(targetId);
        }
    });
    
    // 只返回有2个或更多目标的组（需要聚合）
    return Array.from(groups.values()).filter(group => group.targetIds.length >= 2);
}

function orderNodesInLayers(nodes, links, levels) {
    console.log('Sugiyama: 开始节点排序（减少连线交叉）...');
    
    const nodeMap = new Map();
    nodes.forEach(node => nodeMap.set(node.id, node));
    
    // 为每层分配初始索引（用于计算重心）
    const nodeIndexInLayer = new Map();
    levels.forEach((levelNodes, level) => {
        levelNodes.forEach((node, idx) => {
            nodeIndexInLayer.set(node.id, idx);
        });
    });
    
    const orderedLevels = new Map();
    
    // 按层级顺序处理（从上到下）
    const sortedLevelKeys = Array.from(levels.keys()).sort((a, b) => a - b);
    
    sortedLevelKeys.forEach((level) => {
        const levelNodes = levels.get(level);
        
        if (levelNodes.length <= 1) {
            orderedLevels.set(level, levelNodes);
            return;
        }
        
        // 获取当前层的 layer 值
        const currentLayer = levelNodes[0]?.layer || (level + 1);
        
        // 计算每个节点的父节点索引（用于重心计算）
        // 关键：使用父节点在其层中的索引位置，而不是 X 坐标
        const nodeParentIndices = new Map();
        
        levelNodes.forEach(node => {
            const parentIndices = [];
            
            links.forEach(link => {
                const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
                const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
                
                // 找到连接到当前节点的父节点
                if (targetId === node.id) {
                    const parentNode = nodeMap.get(sourceId);
                    if (parentNode && parentNode.layer !== undefined && parentNode.layer < currentLayer) {
                        // 获取父节点在其层中的索引
                        const parentIndex = nodeIndexInLayer.get(sourceId);
                        if (parentIndex !== undefined) {
                            parentIndices.push(parentIndex);
                        }
                    }
                }
            });
            
            // 计算父节点的平均索引（作为排序依据）
            if (parentIndices.length > 0) {
                const avgIndex = parentIndices.reduce((sum, idx) => sum + idx, 0) / parentIndices.length;
                nodeParentIndices.set(node.id, avgIndex);
            } else {
                // 没有父节点，使用当前索引
                nodeParentIndices.set(node.id, nodeIndexInLayer.get(node.id) || 0);
            }
        });
        
        // 按父节点的平均索引排序
        const sortedNodes = [...levelNodes].sort((a, b) => {
            const indexA = nodeParentIndices.get(a.id) || 0;
            const indexB = nodeParentIndices.get(b.id) || 0;
            return indexA - indexB;
        });
        
        // 更新节点在层中的索引
        sortedNodes.forEach((node, idx) => {
            nodeIndexInLayer.set(node.id, idx);
        });
        
        orderedLevels.set(level, sortedNodes);
        console.log(`Sugiyama: 第${level}层排序完成: ${sortedNodes.map(n => n.label || n.id).join(', ')}`);
    });
    
    console.log('Sugiyama: 节点排序完成');
    return orderedLevels;
}

// ============================================================================
// Sugiyama 算法步骤3: 坐标分配 (采用 concept-map-new-master 的方式)
// ============================================================================

function assignCoordinates(nodes, orderedLevels, width, height, links = []) {
    console.log('Sugiyama: 开始坐标分配...');
    console.log(`Sugiyama: 画布尺寸 ${width} x ${height}`);
    
    // 布局参数
    const horizontalMargin = 50; // 左右边距
    const focusToLayer1Spacing = 160; // 焦点问题到第一层的间距
    const minLayerSpacing = 300; // 最小层间距（继续增大）
    const minGapBetweenLayers = 150; // 相邻层节点之间的最小间隙（继续增大）
    
    const levelCount = orderedLevels.size;
    const focusQuestionHeight = 80; // 与其他地方保持一致
    
    // 计算每层节点的最大高度
    const levelHeights = new Map();
    orderedLevels.forEach((levelNodes, level) => {
        let maxHeight = 85; // 默认最小高度
        levelNodes.forEach(node => {
            let nodeHeight = 85; // 默认高度
            if (typeof window.calculateNodeDimensions === 'function') {
                // 使用默认参数（minWidth=220, minHeight=85, padding=36）来获得更大的节点尺寸
                const dims = window.calculateNodeDimensions(node.label || '');
                nodeHeight = dims.height;
                node.width = dims.width;
                node.height = nodeHeight;
            }
            maxHeight = Math.max(maxHeight, nodeHeight);
        });
        levelHeights.set(level, maxHeight);
    });
    
    // 计算动态层间距
    const layerSpacings = [];
    for (let i = 0; i < levelCount - 1; i++) {
        const currentLevelHeight = levelHeights.get(i) || 85;
        const nextLevelHeight = levelHeights.get(i + 1) || 85;
        const dynamicSpacing = currentLevelHeight / 2 + minGapBetweenLayers + nextLevelHeight / 2;
        const finalSpacing = Math.max(minLayerSpacing, dynamicSpacing);
        layerSpacings.push(finalSpacing);
    }
    
    // 关键：使用固定的起始位置
    // 焦点问题框中心 Y = 50，减少顶部空隙
    const focusQuestionY = 50; // 焦点问题的Y坐标（中心点）
    const layer1Y = focusQuestionY + focusQuestionHeight / 2 + focusToLayer1Spacing; // 焦点问题底边 + 间距
    
    console.log(`Sugiyama: 焦点问题Y=${focusQuestionY}, 第一层Y=${layer1Y}`);
    
    // 保存焦点问题位置到全局
    window.focusQuestionY = focusQuestionY;
    window.focusQuestionHeight = focusQuestionHeight;
    
    // 按 level 顺序排序后遍历（Map 遍历顺序可能不按 key 排序）
    const sortedLevels = Array.from(orderedLevels.entries())
        .sort((a, b) => a[0] - b[0]);
    
    // 先处理焦点问题节点（layer=0）
    const focusQuestionLevel = sortedLevels.find(([level]) => level === 0);
    if (focusQuestionLevel) {
        const [, focusNodes] = focusQuestionLevel;
        const centerX = width / 2;
        console.log(`Sugiyama: 焦点问题居中计算 - 画布宽度=${width}, 中心X=${centerX}`);
        focusNodes.forEach(node => {
            // 关键修复：保留已设置的宽度（来自 convertToConceptMapFormat），不要覆盖
            // 用户要求焦点问题框使用固定的很长的宽度（1400px）
            if (!node.width) {
                // 仅当没有预设宽度时才计算
                const fontSize = 18;
                const textLength = (node.label || '').length;
                const estimatedTextWidth = textLength * (fontSize * 0.6);
                node.width = Math.max(300, estimatedTextWidth + 60);
            }
            if (!node.height) {
                node.height = 60;
            }
            
            node.x = centerX;
            node.y = focusQuestionY;
            // 详细日志：验证焦点问题框居中
            const leftEdge = node.x - node.width / 2;
            const rightEdge = node.x + node.width / 2;
            console.log(`Sugiyama: 焦点问题节点 "${node.label.substring(0, 20)}..." 坐标 (${node.x.toFixed(0)}, ${node.y.toFixed(0)}), 宽度=${node.width}, 左边界=${leftEdge.toFixed(0)}, 右边界=${rightEdge.toFixed(0)}`);
        });
    }
    
    // 过滤掉焦点问题节点，只处理普通节点
    const normalLevels = sortedLevels.filter(([level]) => level > 0);
    
    let currentY = layer1Y;
    normalLevels.forEach(([level, levelNodes], idx) => {
        const y = currentY;
        
        console.log(`Sugiyama: 第${level}层 Y坐标=${y.toFixed(0)}, 节点数=${levelNodes.length}`);
        
        // 计算节点宽度
        const nodeWidths = levelNodes.map(node => {
            if (typeof window.calculateNodeDimensions === 'function') {
                // 使用默认参数（minWidth=220, minHeight=85, padding=36）来获得更大的节点尺寸
                const dims = window.calculateNodeDimensions(node.label || '');
                node.width = dims.width;
                node.height = dims.height;
                return node.width;
            }
            return node.width || 220;
        });
        
        const totalNodeWidth = nodeWidths.reduce((sum, w) => sum + w, 0);
        
        // 计算间距（增大同行节点之间的间距）
        let nodeSpacing;
        if (levelNodes.length === 1) {
            nodeSpacing = 0;
        } else if (levelNodes.length === 2) {
            nodeSpacing = 280;
        } else if (levelNodes.length <= 4) {
            nodeSpacing = 220;
        } else if (levelNodes.length <= 6) {
            nodeSpacing = 180; // 增大
        } else if (levelNodes.length <= 8) {
            nodeSpacing = 150; // 增大
        } else if (levelNodes.length <= 10) {
            nodeSpacing = 120; // 增大
        } else if (levelNodes.length <= 12) {
            nodeSpacing = 100; // 新增：12个以内
        } else {
            nodeSpacing = Math.max(80, 90 - (levelNodes.length - 12) * 1); // 多节点时保持较大间距
        }
        
        const totalSpacing = (levelNodes.length - 1) * nodeSpacing;
        let totalWidth = totalNodeWidth + totalSpacing;
        
        // 计算可用宽度
        const maxAvailableWidth = width - 2 * horizontalMargin;
        
        // 如果总宽度超出可用宽度，压缩间距使其适合
        if (totalWidth > maxAvailableWidth && levelNodes.length > 1) {
            const adjustedSpacing = (maxAvailableWidth - totalNodeWidth) / (levelNodes.length - 1);
            nodeSpacing = Math.max(adjustedSpacing, 10); // 最小间距10px
            // 重新计算总宽度
            totalWidth = totalNodeWidth + (levelNodes.length - 1) * nodeSpacing;
            console.log(`Sugiyama: 第${level}层自适应间距: ${nodeSpacing.toFixed(1)}px`);
        }
        
        // 关键：以画布中心线为轴严格对称排布
        // startX = centerX - totalWidth / 2，确保节点组以中心线为轴对称
        const centerX = width / 2;
        const startX = centerX - totalWidth / 2;
        
        let currentX = startX;
        
        levelNodes.forEach((node, index) => {
            const nodeWidth = nodeWidths[index];
            currentX += nodeWidth / 2;
            node.x = currentX;
            node.y = y;
            currentX += nodeWidth / 2 + nodeSpacing;
            
            console.log(`Sugiyama: 节点 "${node.label}" 坐标 (${node.x.toFixed(0)}, ${node.y.toFixed(0)})`);
        });
        
        // 更新下一层的Y坐标
        if (idx < normalLevels.length - 1) {
            currentY = y + (layerSpacings[idx] || minLayerSpacing);
        }
    });
    
    console.log('Sugiyama: 坐标分配完成');
}

// ============================================================================
// 优化父子节点位置对齐
// ============================================================================

/**
 * 优化父子节点位置对齐 - 让有连接关系的上下层节点在垂直方向上更接近
 * 关键改进：子节点的X坐标尽量接近其父节点的X坐标，而不是均匀分布
 * 注意：排除焦点问题节点（layer=0），它不参与对齐计算
 * @param {Array} nodes - 所有节点
 * @param {Array} links - 所有连接
 * @param {number} width - 画布宽度
 * @param {number} horizontalMargin - 水平边距
 */
function optimizeParentChildAlignment(nodes, links, width, horizontalMargin) {
    console.log('Sugiyama: 开始优化父子节点位置对齐（让子节点靠近父节点）...');
    
    if (!nodes || nodes.length === 0 || !links || links.length === 0) {
        console.log('没有节点或连接，跳过位置优化');
        return;
    }
    
    // 创建节点ID到节点的映射
    const nodeById = new Map();
    nodes.forEach(node => nodeById.set(node.id, node));
    
    // 按层级分组节点（排除焦点问题节点 layer=0）
    const layerNodes = new Map();
    nodes.forEach(node => {
        // 跳过焦点问题节点
        if (node.layer === 0 || node.isFocusQuestion) {
            return;
        }
        const layer = node.layer || 1;
        if (!layerNodes.has(layer)) {
            layerNodes.set(layer, []);
        }
        layerNodes.get(layer).push(node);
    });
    
    // 获取所有层级（只包含概念图节点的层级，不包含 layer=0）
    const sortedLayers = Array.from(layerNodes.keys()).sort((a, b) => a - b);
    
    console.log('  概念图层级数:', sortedLayers.length, '层级:', sortedLayers);
    
    // 最小节点间距
    const minNodeGap = 30;
    
    // 从第二层开始遍历（第一层 layer=1 保持 assignCoordinates 的居中布局）
    // 只对 layer >= 2 的节点进行父子对齐优化
    for (let i = 0; i < sortedLayers.length; i++) {
        const currentLayer = sortedLayers[i];
        
        // 跳过第一层概念图节点（layer=1），它们应该保持居中
        if (currentLayer <= 1) {
            console.log(`  跳过第${currentLayer}层，保持居中布局`);
            continue;
        }
        
        const currentNodes = layerNodes.get(currentLayer);
        
        if (!currentNodes || currentNodes.length === 0) continue;
        
        // 第一步：计算每个节点的理想X位置（父节点的平均X位置）
        const nodeIdealPositions = new Map();
        
        currentNodes.forEach(node => {
            // 找到所有连接到该节点的父节点（排除焦点问题节点）
            const parentNodes = [];
            links.forEach(link => {
                const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
                const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
                
                if (targetId === node.id) {
                    const parent = nodeById.get(sourceId);
                    // 排除焦点问题节点作为父节点
                    if (parent && parent.layer !== undefined && parent.layer >= 1 && parent.layer < node.layer) {
                        parentNodes.push(parent);
                    }
                }
            });
            
            // 计算理想X位置
            let idealX;
            if (parentNodes.length > 0) {
                // 使用父节点的平均X位置作为理想位置
                idealX = parentNodes.reduce((sum, p) => sum + p.x, 0) / parentNodes.length;
                console.log(`    节点 "${node.label}" 父节点: ${parentNodes.map(p => p.label).join(', ')}, 理想X: ${idealX.toFixed(0)}`);
            } else {
                // 没有有效父节点，保持当前位置
                idealX = node.x;
            }
            
            nodeIdealPositions.set(node.id, {
                node: node,
                idealX: idealX,
                parentCount: parentNodes.length,
                width: node.width || 220
            });
        });
        
        // 第二步：按理想X位置排序节点
        const sortedNodes = [...currentNodes].sort((a, b) => {
            const infoA = nodeIdealPositions.get(a.id);
            const infoB = nodeIdealPositions.get(b.id);
            return infoA.idealX - infoB.idealX;
        });
        
        // 第三步：分配X坐标，尽量接近理想位置，同时避免重叠
        // 使用贪心算法：按排序顺序依次放置，确保不重叠
        const placedNodes = [];
        
        sortedNodes.forEach(node => {
            const info = nodeIdealPositions.get(node.id);
            const nodeWidth = info.width;
            let targetX = info.idealX;
            
            // 检查是否与已放置的节点重叠，如果重叠则调整位置
            let adjusted = false;
            for (const placed of placedNodes) {
                const placedWidth = nodeIdealPositions.get(placed.id).width;
                const minDist = (nodeWidth + placedWidth) / 2 + minNodeGap;
                const dist = Math.abs(targetX - placed.x);
                
                if (dist < minDist) {
                    // 需要调整位置
                    if (targetX >= placed.x) {
                        // 当前节点在右边，向右推
                        targetX = placed.x + minDist;
                    } else {
                        // 当前节点在左边，向左推
                        targetX = placed.x - minDist;
                    }
                    adjusted = true;
                }
            }
            
            // 确保在画布边界内
            const halfWidth = nodeWidth / 2;
            if (targetX - halfWidth < horizontalMargin) {
                targetX = horizontalMargin + halfWidth;
            }
            if (targetX + halfWidth > width - horizontalMargin) {
                targetX = width - horizontalMargin - halfWidth;
            }
            
            node.x = targetX;
            placedNodes.push(node);
            
            if (adjusted) {
                console.log(`    节点 "${node.label}" 调整后X: ${targetX.toFixed(0)} (理想: ${info.idealX.toFixed(0)})`);
            }
        });
        
        // 第四步：解决重叠问题 - 再次检查并推开重叠的节点
        resolveOverlaps(sortedNodes, nodeIdealPositions, minNodeGap, horizontalMargin, width);
        
        // 更新layerNodes
        layerNodes.set(currentLayer, sortedNodes);
    }
    
    console.log('Sugiyama: 父子节点位置对齐优化完成');
}

/**
 * 解决节点重叠问题
 * 注意：这个函数只解决重叠，不做居中。居中由 centerAllNodes 统一处理。
 */
function resolveOverlaps(nodes, nodeIdealPositions, minNodeGap, horizontalMargin, width) {
    if (nodes.length <= 1) return;
    
    // 按X坐标排序
    nodes.sort((a, b) => a.x - b.x);
    
    // 从左到右检查并推开重叠的节点
    for (let i = 1; i < nodes.length; i++) {
        const prevNode = nodes[i - 1];
        const currNode = nodes[i];
        
        const prevWidth = nodeIdealPositions.get(prevNode.id).width;
        const currWidth = nodeIdealPositions.get(currNode.id).width;
        const minDist = (prevWidth + currWidth) / 2 + minNodeGap;
        
        if (currNode.x - prevNode.x < minDist) {
            // 需要向右推
            currNode.x = prevNode.x + minDist;
        }
    }
    
    // 检查是否超出边界，如果超出则压缩间距
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    const firstWidth = nodeIdealPositions.get(firstNode.id).width;
    const lastWidth = nodeIdealPositions.get(lastNode.id).width;
    
    const layerMinX = firstNode.x - firstWidth / 2;
    const layerMaxX = lastNode.x + lastWidth / 2;
    const layerWidth = layerMaxX - layerMinX;
    
    const availableWidth = width - 2 * horizontalMargin;
    
    // 如果层宽度超过可用宽度，需要压缩间距并居中
    if (layerWidth > availableWidth) {
        let totalNodeWidth = 0;
        nodes.forEach(node => {
            totalNodeWidth += nodeIdealPositions.get(node.id).width;
        });
        
        const availableSpacing = availableWidth - totalNodeWidth;
        const spacingPerGap = nodes.length > 1 ? availableSpacing / (nodes.length - 1) : 0;
        const actualSpacing = Math.max(10, spacingPerGap);
        
        // 计算压缩后的总宽度，并居中分配
        const compressedTotalWidth = totalNodeWidth + (nodes.length - 1) * actualSpacing;
        const canvasCenter = width / 2;
        let currentX = canvasCenter - compressedTotalWidth / 2;
        
        nodes.forEach(node => {
            const nodeWidth = nodeIdealPositions.get(node.id).width;
            currentX += nodeWidth / 2;
            node.x = currentX;
            currentX += nodeWidth / 2 + actualSpacing;
        });
    }
}

/**
 * 检测聚合连接组（用于布局优化）
 * 只检测标记为聚合连接的连线
 * @param {Array} links - 所有连接
 * @returns {Array} 聚合组数组，每个元素包含 {key, sourceId, label, targetIds}
 */
function detectAggregateGroupsForLayout(links) {
    const groups = new Map();
    
    links.forEach(link => {
        // 只处理标记为聚合连接的连线
        if (!link.isAggregated) return;
        
        const label = link.label || '';
        const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target?.id;
        const key = `${sourceId}_${label}`;
        
        if (!groups.has(key)) {
            groups.set(key, {
                key: key,
                sourceId: sourceId,
                label: label,
                targetIds: []
            });
        }
        groups.get(key).targetIds.push(targetId);
    });
    
    // 只返回有2个或更多目标的组（需要聚合）
    return Array.from(groups.values()).filter(group => group.targetIds.length >= 2);
}

// ============================================================================
// 居中所有节点
// ============================================================================

/**
 * 将概念图节点整体居中于画布
 * 注意：只居中概念图节点（layer >= 1），焦点问题节点（layer = 0）单独处理
 * @param {Array} nodes - 所有节点
 * @param {number} canvasWidth - 画布宽度
 */
function centerAllNodes(nodes, canvasWidth) {
    console.log('Sugiyama: 开始居中概念图节点...');
    
    if (!nodes || nodes.length === 0) {
        return;
    }
    
    // 只计算概念图节点的边界（排除焦点问题节点 layer=0）
    // 这样焦点问题框不会影响概念图的居中计算
    let minX = Infinity, maxX = -Infinity;
    let conceptNodeCount = 0;
    
    nodes.forEach(node => {
        // 只处理概念图节点（layer >= 1 或 layer === undefined）
        // 排除焦点问题节点（layer === 0 或 isFocusQuestion === true）
        if (node.layer === 0 || node.isFocusQuestion) {
            return; // 跳过焦点问题节点
        }
        
        if (node.x !== undefined) {
            const nodeWidth = node.width || 220;
            minX = Math.min(minX, node.x - nodeWidth / 2);
            maxX = Math.max(maxX, node.x + nodeWidth / 2);
            conceptNodeCount++;
        }
    });
    
    if (minX === Infinity || maxX === -Infinity || conceptNodeCount === 0) {
        console.log('Sugiyama: 没有有效概念图节点坐标，跳过居中');
        return;
    }
    
    // 计算概念图节点整体的中心
    const nodesCenter = (minX + maxX) / 2;
    
    // 计算画布中心
    const canvasCenter = canvasWidth / 2;
    
    // 计算需要的偏移量
    const offsetX = canvasCenter - nodesCenter;
    
    console.log(`Sugiyama: 概念图节点数: ${conceptNodeCount}`);
    console.log(`Sugiyama: 概念图边界 X:[${minX.toFixed(0)}, ${maxX.toFixed(0)}]`);
    console.log(`Sugiyama: 概念图中心: ${nodesCenter.toFixed(0)}, 画布中心: ${canvasCenter.toFixed(0)}, 偏移: ${offsetX.toFixed(0)}`);
    
    // 如果偏移量太小，不需要调整
    if (Math.abs(offsetX) < 5) {
        console.log('Sugiyama: 概念图已居中，无需调整');
        return;
    }
    
    // 只平移概念图节点（layer >= 1），保持焦点问题节点位置不变
    nodes.forEach(node => {
        // 跳过焦点问题节点
        if (node.layer === 0 || node.isFocusQuestion) {
            return;
        }
        
        if (node.x !== undefined) {
            node.x += offsetX;
        }
    });
    
    console.log(`Sugiyama: 概念图节点已向${offsetX > 0 ? '右' : '左'}平移 ${Math.abs(offsetX).toFixed(0)}px`);
}

// ============================================================================
// 调整 ViewBox
// ============================================================================

function adjustViewBox(nodes, baseWidth, baseHeight) {
    console.log('Sugiyama: 调整viewBox并居中画布...');
    
    if (!nodes || nodes.length === 0) {
        return;
    }
    
    // 检查是否只有焦点问题节点（没有其他概念节点）
    const conceptNodes = nodes.filter(node => node.layer !== 0 && !node.isFocusQuestion);
    if (conceptNodes.length === 0) {
        // 只有焦点问题框，不调整 viewBox，保持默认画布尺寸
        console.log('Sugiyama: 只有焦点问题节点，保持默认viewBox，不进行调整');
        return;
    }
    
    // 计算所有节点的垂直边界（包括焦点问题节点）
    let minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
            const nodeHeight = node.height || 85;
            minY = Math.min(minY, node.y - nodeHeight / 2);
            maxY = Math.max(maxY, node.y + nodeHeight / 2);
        }
    });
    
    // 添加边距（减少上下空隙）
    const topMargin = 10;  // 顶部边距
    const bottomMargin = 20; // 底部边距
    
    // viewBox 从内容实际开始的位置开始，减少上下空白
    const viewBoxX = 0;
    const viewBoxY = minY - topMargin;  // 从内容顶部开始，留少量边距
    const viewWidth = baseWidth;  // 使用容器的完整宽度
    const contentHeight = maxY - minY + topMargin + bottomMargin;
    const viewHeight = Math.max(contentHeight, 400);  // 确保最小高度
    
    console.log(`Sugiyama: 内容垂直范围 Y:[${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);
    console.log(`Sugiyama: 画布完整宽度: ${baseWidth}, viewBox高度: ${viewHeight.toFixed(0)}`);
    console.log(`Sugiyama: ViewBox: ${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight.toFixed(0)}`);
    
    // 更新 SVG viewBox
    const svg = document.querySelector('#d3-container svg') || 
                document.querySelector('.concept-graph');
    if (svg) {
        svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight}`);
        // 不设置固定的 width/height，让 CSS 的 100% 生效
        // preserveAspectRatio: xMidYMid meet 会自动将内容居中于容器
    }
}

// ============================================================================
// 主入口函数
// ============================================================================

function applySugiyamaLayout(graphData) {
    console.log('Sugiyama: 开始应用布局算法...');
    
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('Sugiyama: 数据为空');
        return graphData;
    }
    
    // 深拷贝
    const nodes = graphData.nodes.map(n => ({ ...n }));
    const links = graphData.links.map(l => ({ ...l }));
    
    // 获取画布尺寸 - 从 viewBox 获取，viewBox 已经使用了容器的实际尺寸
    let width = 1600;
    let height = 800;
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        const viewBox = svg.getAttribute('viewBox');
        console.log(`Sugiyama: 获取到的 viewBox = "${viewBox}"`);
        if (viewBox) {
            const parts = viewBox.split(' ');
            if (parts.length === 4) {
                width = parseFloat(parts[2]) || width;
                height = parseFloat(parts[3]) || height;
            }
        }
    } else {
        console.warn('Sugiyama: 未找到 SVG 元素，使用默认宽度');
    }
    
    console.log(`Sugiyama: 画布尺寸 ${width} x ${height}, 焦点问题框将居中于 x=${width/2}`);
    
    // 执行算法
    const levels = assignLayers(nodes, links);
    const orderedLevels = orderNodesInLayers(nodes, links, levels);
    assignCoordinates(nodes, orderedLevels, width, height, links);
    
    // 注意：不再调用 optimizeParentChildAlignment
    // 按照 concept-map-new-master 的方式，让节点以画布中心线为轴对称排布
    // 保持各个节点之间的距离相同（统一间距）
    
    // 全局居中（以画布中心线为轴对称，保证左右空隙一致）
    centerAllNodes(nodes, width);
    
    // 调整 viewBox
    adjustViewBox(nodes, width, height);
    
    // 验证
    let allHaveCoords = true;
    nodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) {
            console.error(`Sugiyama: 节点 "${node.label}" 没有坐标!`);
            allHaveCoords = false;
        }
    });
    
    console.log('Sugiyama: 布局算法应用完成');
    
    // 标准化 links 的 source 和 target 为字符串 ID
    // 这是关键修复：确保拖动时能正确匹配连线
    const normalizedLinks = links.map(link => ({
        ...link,
        source: typeof link.source === 'string' ? link.source : (link.source && link.source.id) || link.source,
        target: typeof link.target === 'string' ? link.target : (link.target && link.target.id) || link.target
    }));
    
    // 调试：确认返回的节点有正确坐标
    console.log('Sugiyama: 返回数据验证（前3个节点）:');
    nodes.slice(0, 3).forEach((n, i) => {
        console.log(`  Sugiyama返回 节点${i}: "${n.label}" x=${n.x}, y=${n.y}`);
    });
    
    return {
        nodes: nodes,
        links: normalizedLinks,
        metadata: graphData.metadata || {}
    };
}

// ============================================================================
// 导出
// ============================================================================

if (typeof window !== 'undefined') {
    window.applySugiyamaLayout = applySugiyamaLayout;
    window.adjustViewBox = adjustViewBox;
    window.centerAllNodes = centerAllNodes;
    console.log('✅ Sugiyama布局算法已注册到全局作用域');
}

