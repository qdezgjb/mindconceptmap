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
    
    // 检查是否已有层级信息（包括 layer=0 的焦点问题节点）
    const nodesWithLayer = nodes.filter(node => node.layer !== undefined && node.layer >= 0);
    
    if (nodesWithLayer.length > 0) {
        console.log(`Sugiyama: 检测到 ${nodesWithLayer.length} 个节点已有layer属性`);
        
        const levels = new Map();
        nodes.forEach(node => {
            // layer=0 是焦点问题节点，保持不变
            // layer=undefined 的节点设为 layer=1
            if (node.layer === undefined) {
                node.layer = 1;
            }
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
    
    console.log(`Sugiyama: 层次分配完成，共 ${levels.size} 层`);
    return levels;
}

// ============================================================================
// Sugiyama 算法步骤2: 节点排序
// ============================================================================

function orderNodesInLayers(nodes, links, levels) {
    console.log('Sugiyama: 开始节点排序...');
    
    const nodeMap = new Map();
    nodes.forEach(node => nodeMap.set(node.id, node));
    
    const orderedLevels = new Map();
    
    levels.forEach((levelNodes, level) => {
        if (levelNodes.length <= 1) {
            orderedLevels.set(level, levelNodes);
            return;
        }
        
        // 计算重心
        const nodeBarycenters = new Map();
        levelNodes.forEach(node => {
            let totalWeight = 0;
            let weightedSum = 0;
            
            links.forEach(link => {
                const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                
                if (sourceId === node.id) {
                    const targetNode = nodeMap.get(targetId);
                    if (targetNode && targetNode.layer > node.layer) {
                        weightedSum += targetNode.x || 0;
                        totalWeight += 1;
                    }
                } else if (targetId === node.id) {
                    const sourceNode = nodeMap.get(sourceId);
                    if (sourceNode && sourceNode.layer < node.layer) {
                        weightedSum += sourceNode.x || 0;
                        totalWeight += 1;
                    }
                }
            });
            
            nodeBarycenters.set(node.id, totalWeight > 0 ? weightedSum / totalWeight : 0);
        });
        
        // 按重心排序
        const sortedNodes = [...levelNodes].sort((a, b) => {
            return (nodeBarycenters.get(a.id) || 0) - (nodeBarycenters.get(b.id) || 0);
        });
        
        orderedLevels.set(level, sortedNodes);
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
    
    // 布局参数 (与 concept-map-new-master 一致)
    const horizontalMargin = 150;
    const focusToLayer1Spacing = 60; // 焦点问题到第一层的间距
    const minLayerSpacing = 180; // 最小层间距
    const minGapBetweenLayers = 50; // 相邻层节点之间的最小间隙
    
    const levelCount = orderedLevels.size;
    const focusQuestionHeight = 60;
    
    // 计算每层节点的最大高度
    const levelHeights = new Map();
    orderedLevels.forEach((levelNodes, level) => {
        let maxHeight = 50;
        levelNodes.forEach(node => {
            let nodeHeight = 50;
            if (typeof window.calculateNodeDimensions === 'function') {
                const dims = window.calculateNodeDimensions(node.label || '', 90, 45, 20);
                nodeHeight = node.height || dims.height;
                node.width = node.width || dims.width;
                node.height = nodeHeight;
            }
            maxHeight = Math.max(maxHeight, nodeHeight);
        });
        levelHeights.set(level, maxHeight);
    });
    
    // 计算动态层间距
    const layerSpacings = [];
    for (let i = 0; i < levelCount - 1; i++) {
        const currentLevelHeight = levelHeights.get(i) || 50;
        const nextLevelHeight = levelHeights.get(i + 1) || 50;
        const dynamicSpacing = currentLevelHeight / 2 + minGapBetweenLayers + nextLevelHeight / 2;
        const finalSpacing = Math.max(minLayerSpacing, dynamicSpacing);
        layerSpacings.push(finalSpacing);
    }
    
    // 关键：使用固定的起始位置，而不是根据画布高度计算
    const focusQuestionY = 80; // 焦点问题的Y坐标
    const layer1Y = focusQuestionY + focusQuestionHeight + focusToLayer1Spacing; // 约200
    
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
        focusNodes.forEach(node => {
            // 计算焦点问题节点尺寸
            const fontSize = 18;
            const textLength = (node.label || '').length;
            const estimatedTextWidth = textLength * (fontSize * 0.6);
            node.width = Math.max(300, estimatedTextWidth + 60);
            node.height = 60;
            
            node.x = centerX;
            node.y = focusQuestionY;
            console.log(`Sugiyama: 焦点问题节点 "${node.label}" 坐标 (${node.x.toFixed(0)}, ${node.y.toFixed(0)})`);
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
                const dims = window.calculateNodeDimensions(node.label || '', 90, 45, 20);
                node.width = node.width || dims.width;
                node.height = node.height || dims.height;
                return node.width;
            }
            return node.width || 100;
        });
        
        const totalNodeWidth = nodeWidths.reduce((sum, w) => sum + w, 0);
        
        // 计算间距
        let nodeSpacing;
        if (levelNodes.length === 1) {
            nodeSpacing = 0;
        } else if (levelNodes.length === 2) {
            nodeSpacing = 150;
        } else if (levelNodes.length <= 4) {
            nodeSpacing = 120;
        } else if (levelNodes.length <= 6) {
            nodeSpacing = 80;
        } else if (levelNodes.length <= 10) {
            nodeSpacing = 55;
        } else {
            nodeSpacing = Math.max(30, 50 - (levelNodes.length - 10) * 2);
        }
        
        const totalSpacing = (levelNodes.length - 1) * nodeSpacing;
        let totalWidth = totalNodeWidth + totalSpacing;
        
        // 确保不超出边界
        const maxWidth = width - 2 * horizontalMargin;
        if (totalWidth > maxWidth && levelNodes.length > 1) {
            nodeSpacing = Math.max(20, (maxWidth - totalNodeWidth) / (levelNodes.length - 1));
            totalWidth = totalNodeWidth + (levelNodes.length - 1) * nodeSpacing;
        }
        
        // 居中
        const centerX = width / 2;
        let startX = centerX - totalWidth / 2;
        if (startX < horizontalMargin) startX = horizontalMargin;
        
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
 * @param {Array} nodes - 所有节点
 * @param {Array} links - 所有连接
 * @param {number} width - 画布宽度
 * @param {number} horizontalMargin - 水平边距
 */
function optimizeParentChildAlignment(nodes, links, width, horizontalMargin) {
    console.log('Sugiyama: 开始优化父子节点位置对齐...');
    
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
    
    console.log('Sugiyama: 父子节点位置对齐优化完成');
}

// ============================================================================
// 调整 ViewBox
// ============================================================================

function adjustViewBox(nodes, baseWidth, baseHeight) {
    console.log('Sugiyama: 调整viewBox并居中画布...');
    
    if (!nodes || nodes.length === 0) {
        return;
    }
    
    // 计算节点边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // 纳入焦点问题框
    if (window.focusQuestionY !== undefined && window.focusQuestionHeight !== undefined) {
        minY = Math.min(minY, window.focusQuestionY - 30);
    }
    
    nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
            const nodeWidth = node.width || 100;
            const nodeHeight = node.height || 50;
            minX = Math.min(minX, node.x - nodeWidth / 2);
            minY = Math.min(minY, node.y - nodeHeight / 2);
            maxX = Math.max(maxX, node.x + nodeWidth / 2);
            maxY = Math.max(maxY, node.y + nodeHeight / 2);
        }
    });
    
    // 添加边距
    const horizontalMargin = 100;
    const topMargin = 30;
    const bottomMargin = 80;
    
    // 计算内容边界（含边距）
    const paddedMinX = minX - horizontalMargin;
    const paddedMaxX = maxX + horizontalMargin;
    const paddedMinY = minY - topMargin;
    const paddedMaxY = maxY + bottomMargin;
    
    const contentWidth = paddedMaxX - paddedMinX;
    const contentHeight = paddedMaxY - paddedMinY;
    
    // 视口尺寸：至少为画布尺寸，同时覆盖内容
    const viewWidth = Math.max(baseWidth, contentWidth);
    const viewHeight = Math.max(baseHeight, contentHeight);
    
    // 计算内容中心，并将 viewBox 居中到内容
    const centerX = (paddedMinX + paddedMaxX) / 2;
    const centerY = (paddedMinY + paddedMaxY) / 2;
    const viewBoxX = centerX - viewWidth / 2;
    const viewBoxY = centerY - viewHeight / 2;
    
    console.log(`Sugiyama: 节点边界 X:[${minX.toFixed(0)}, ${maxX.toFixed(0)}] Y:[${minY.toFixed(0)}, ${maxY.toFixed(0)}]`);
    console.log(`Sugiyama: ViewBox: ${viewBoxX.toFixed(0)} ${viewBoxY.toFixed(0)} ${viewWidth.toFixed(0)} ${viewHeight.toFixed(0)}`);
    
    // 更新 SVG viewBox
    const svg = document.querySelector('#d3-container svg') || 
                document.querySelector('.concept-graph');
    if (svg) {
        svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight}`);
        // 同时更新 SVG 的 width 属性，保持与视口宽度一致
        svg.setAttribute('width', viewWidth);
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
    
    // 获取画布尺寸
    let width = 1600;
    let height = 800; // 使用合理的默认高度
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(' ');
            if (parts.length === 4) {
                width = parseFloat(parts[2]) || width;
                // 不使用 viewBox 的高度，使用固定值
            }
        }
        // 也尝试从 getBoundingClientRect 获取宽度
        const rect = svg.getBoundingClientRect();
        if (rect.width > 0) {
            width = Math.max(width, rect.width);
        }
    }
    
    console.log(`Sugiyama: 画布尺寸 ${width} x ${height}`);
    
    // 执行算法
    const levels = assignLayers(nodes, links);
    const orderedLevels = orderNodesInLayers(nodes, links, levels);
    assignCoordinates(nodes, orderedLevels, width, height, links);
    
    // 优化父子节点位置对齐
    const horizontalMargin = 50;
    optimizeParentChildAlignment(nodes, links, width, horizontalMargin);
    
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
    console.log('✅ Sugiyama布局算法已注册到全局作用域');
}
