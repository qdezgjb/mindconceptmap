// 概念图布局算法模块
// 包含所有布局相关的算法函数
// 
// 注意：此文件中的力导向布局算法已整合到 force-directed-layout.js
// - 通用力导向算法：force-directed-layout.js（核心算法实现）
// - 项目特定版本：此文件中的 applyForceDirectedLayoutWithProjectSpecifics（包含焦点问题节点处理）
// - 布局协调器：此文件中的 applyIntelligentLayout（自动选择布局算法）

/**
 * 检测聚合连线（用于布局算法）
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
 * 智能布局算法 - 自动选择最优布局方式
 * @param {Object} graphData - 图形数据
 * @returns {Object} 优化后的图形数据
 */
function applyIntelligentLayout(graphData) {
    console.log('应用智能布局算法...');
    
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('图形数据为空，跳过布局优化');
        return graphData;
    }

    const nodes = [...graphData.nodes];
    const links = [...graphData.links];
    
    // 🔴 强制使用层次布局（Sugiyama算法），不再自动选择
    console.log('强制使用Sugiyama层次布局算法');
    
    let optimizedGraph;
    
    // 直接使用Sugiyama布局算法
    if (typeof window.applySugiyamaLayout === 'function') {
        optimizedGraph = window.applySugiyamaLayout(graphData);
    } else {
        console.warn('Sugiyama布局算法未找到，使用力导向布局作为备选');
        optimizedGraph = applyForceDirectedLayoutOnly(graphData);
    }
    
    console.log('智能布局完成');
    return optimizedGraph;
}

/**
 * 仅应用力导向布局算法（项目特定版本，包含焦点问题节点处理）
 * @param {Object} graphData - 图形数据
 * @returns {Object} 优化后的图形数据
 */
function applyForceDirectedLayoutOnly(graphData) {
    console.log('应用力导向布局（项目特定版本）...');
    
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('图形数据为空，跳过布局优化');
        return graphData;
    }

    const nodes = [...graphData.nodes];
    const links = [...graphData.links];
    
    // 动态计算画布尺寸
    const maxNodeWidth = Math.max(...nodes.map(node => {
        const nodeDimensions = window.calculateNodeDimensions ? 
            window.calculateNodeDimensions(node.label || '', 70, 35, 14) :
            { width: 100, height: 50 };
        return node.width || nodeDimensions.width;
    }));
    
    // 计算合适的画布尺寸
    const width = Math.max(600, Math.min(1200, nodes.length * (maxNodeWidth + 80) + 200));
    const height = Math.max(500, Math.min(1000, nodes.length * 80 + 300));
    
    // 力导向布局参数
    const nodeSpacing = Math.max(60, Math.min(100, width / (nodes.length + 2)));
    const linkLength = Math.max(80, Math.min(120, height / (nodes.length + 2)));
    
    // 初始化节点位置（如果节点没有位置）
    if (typeof window.initializeNodePositions === 'function') {
        // 使用 force-directed-layout.js 中的初始化函数
        window.initializeNodePositions(nodes, width, height);
    } else {
        // 备用初始化方法
        nodes.forEach((node, i) => {
            if (node.x === undefined || node.y === undefined) {
                const angle = (2 * Math.PI * i) / nodes.length;
                const radius = Math.min(width, height) / 3;
                node.x = width / 2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 50;
                node.y = height / 2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 50;
            }
        });
    }
    
    // 应用项目特定的力导向算法（包含焦点问题节点处理）
    applyForceDirectedLayoutWithProjectSpecifics(nodes, links, width, height, nodeSpacing, linkLength);
    
    // 最终调整（项目特定逻辑）
    finalizePositions(nodes, width, height);
    
    // 调整viewBox（项目特定逻辑）
    if (typeof window.adjustViewBox === 'function') {
        window.adjustViewBox(nodes, width, height);
    }
    
    // 重新显示焦点问题，确保位置正确
    if (typeof window.displayFocusQuestion === 'function') {
        window.displayFocusQuestion();
    }
    
    console.log('力导向布局完成');
    return { ...graphData, nodes, links };
}

/**
 * 分析图形结构，自动选择布局算法
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @returns {string} 布局算法类型
 */
function analyzeGraphStructure(nodes, links) {
    if (nodes.length <= 1) return 'force';
    
    // 检查是否有明确的第一级关键词节点
    let hasFirstLevelNode = false;
    if (window.focusQuestion) {
        const match = window.focusQuestion.match(/焦点问题：(.*?)(是什么|\?|\.\.\.)/);
        if (match) {
            const currentKeyword = match[1].trim();
            hasFirstLevelNode = nodes.some(node => {
                const nodeLabel = node.label || '';
                return nodeLabel === currentKeyword || 
                       nodeLabel.includes(currentKeyword) || 
                       currentKeyword.includes(nodeLabel);
            });
        }
    }
    
    // 计算层次性指标
    const hierarchyScore = calculateHierarchyScore(nodes, links);
    
    console.log(`结构分析结果: 层次性=${hierarchyScore.toFixed(2)}, 有第一级节点=${hasFirstLevelNode}`);
    
    // 如果有明确的第一级节点，优先使用层次布局
    if (hasFirstLevelNode) {
        return 'hierarchical'; // Sugiyama算法
    }
    
    // 根据层次性指标选择布局算法
    if (hierarchyScore > 0.6) { // 降低阈值，更容易选择层次布局
        return 'hierarchical'; // Sugiyama算法
    } else {
        return 'force';        // 力导向布局
    }
}

/**
 * 计算层次性指标
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @returns {number} 层次性得分
 */
function calculateHierarchyScore(nodes, links) {
    if (links.length === 0) return 0;
    
    let hierarchicalLinks = 0;
    const nodeLevels = new Map();
    
    // 使用BFS计算节点层次
    const visited = new Set();
    const inDegree = new Map();
    nodes.forEach(node => inDegree.set(node.id, 0));
    
    links.forEach(link => {
        inDegree.set(link.target, (inDegree.get(link.target) || 0) + 1);
    });
    
    const roots = nodes.filter(node => inDegree.get(node.id) === 0);
    if (roots.length === 0) return 0;
    
    let currentLevel = 0;
    let currentNodes = [...roots];
    
    while (currentNodes.length > 0) {
        currentNodes.forEach(node => {
            nodeLevels.set(node.id, currentLevel);
            visited.add(node.id);
        });
        
        const nextLevel = [];
        currentNodes.forEach(node => {
            links.forEach(link => {
                if (link.source === node.id && !visited.has(link.target)) {
                    const targetNode = nodes.find(n => n.id === link.target);
                    if (targetNode && !nextLevel.includes(targetNode)) {
                        nextLevel.push(targetNode);
                    }
                }
            });
        });
        
        currentNodes = nextLevel;
        currentLevel++;
    }
    
    // 计算层次性连线比例
    links.forEach(link => {
        const sourceLevel = nodeLevels.get(link.source) || 0;
        const targetLevel = nodeLevels.get(link.target) || 0;
        if (targetLevel > sourceLevel) {
            hierarchicalLinks++;
        }
    });
    
    return hierarchicalLinks / links.length;
}

/**
 * 简单的斥力实现（回退函数，当 force-directed-layout.js 未加载时使用）
 * @param {Array} nodes - 节点数组
 * @param {number} charge - 电荷强度
 * @param {number} minDistance - 最小距离
 */
function applySimpleRepulsiveForces(nodes, charge, minDistance) {
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];
            
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const safeDistance = Math.max(distance, minDistance);
                const force = charge / (safeDistance * safeDistance);
                const fx = (dx / safeDistance) * force;
                const fy = (dy / safeDistance) * force;
                
                nodeA.fx = (nodeA.fx || 0) - fx;
                nodeA.fy = (nodeA.fy || 0) - fy;
                nodeB.fx = (nodeB.fx || 0) + fx;
                nodeB.fy = (nodeB.fy || 0) + fy;
            }
        }
    }
}

/**
 * 应用力导向布局算法（项目特定版本，包含焦点问题节点处理）
 * 此函数结合了 force-directed-layout.js 的核心算法和项目特定的逻辑
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {number} nodeSpacing - 节点间距
 * @param {number} linkLength - 连线长度
 */
function applyForceDirectedLayoutWithProjectSpecifics(nodes, links, width, height, nodeSpacing, linkLength) {
    const maxIterations = 300;
    const coolingFactor = 0.95;
    const temperature = 1.0;
    
    // 初始化节点速度
    nodes.forEach(node => {
        if (!node.vx) node.vx = 0;
        if (!node.vy) node.vy = 0;
    });
    
    // 模拟物理力
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const currentTemp = temperature * Math.pow(coolingFactor, iteration);
        
        // 重置力
        nodes.forEach(node => {
            node.fx = 0;
            node.fy = 0;
        });
        
        // 应用斥力（使用 force-directed-layout.js 中的通用实现）
        if (typeof window.applyRepulsiveForces === 'function') {
            window.applyRepulsiveForces(nodes, -300, nodeSpacing);
        } else {
            // 回退：如果 force-directed-layout.js 未加载，使用简单的斥力实现
            console.warn('force-directed-layout.js 未加载，使用简化的斥力实现');
            applySimpleRepulsiveForces(nodes, -300, nodeSpacing);
        }
        
        // 应用引力（使用项目特定的实现，包含焦点问题节点处理）
        applyAttractiveForces(nodes, links, linkLength, currentTemp);
        
        // 应用边界力（使用项目特定的实现，包含焦点问题节点处理）
        applyBoundaryForces(nodes, width, height, currentTemp);
        
        // 更新位置（使用项目特定的实现）
        updateNodePositions(nodes, currentTemp);
        
        // 检查收敛性
        if (currentTemp < 0.01) break;
    }
}

/**
 * 应用引力 - 保持连线连接，并增强第一级节点的引力
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @param {number} linkLength - 连线长度
 * @param {number} temperature - 温度参数
 */
function applyAttractiveForces(nodes, links, linkLength, temperature) {
    // 获取第一级焦点问题节点
    let firstLevelNode = null;
    if (window.focusQuestion) {
        const match = window.focusQuestion.match(/焦点问题：(.*?)(是什么|\?|\.\.\.)/);
        if (match) {
            const currentKeyword = match[1].trim();
            firstLevelNode = nodes.find(node => {
                const nodeLabel = node.label || '';
                return nodeLabel === currentKeyword || 
                       nodeLabel.includes(currentKeyword) || 
                       currentKeyword.includes(nodeLabel);
            });
        }
    }
    
    // 检测聚合连线
    const aggregatedLinks = detectAggregatedLinksForLayout(links);
    const aggregatedLinkMap = new Map(); // key: linkId, value: aggregatedGroup
    aggregatedLinks.forEach(group => {
        group.links.forEach(link => {
            const linkId = link.id || `link-${link.source}-${link.target}`;
            aggregatedLinkMap.set(linkId, group);
        });
    });
    
    links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        
        if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // 计算引力强度
                let force = (distance - linkLength) / distance * temperature * 0.3;
                
                // 如果连线涉及第一级节点，增强引力
                if (firstLevelNode && (source.id === firstLevelNode.id || target.id === firstLevelNode.id)) {
                    force *= 1.5; // 增强50%的引力
                }
                
                // 如果是聚合连线，增强引力使节点更靠近
                const linkId = link.id || `link-${link.source}-${link.target}`;
                if (aggregatedLinkMap.has(linkId)) {
                    force *= 2.5; // 聚合连线的引力增强2.5倍
                }
                
                // 应用引力
                const fx = dx * force;
                const fy = dy * force;
                
                source.vx = (source.vx || 0) + fx;
                source.vy = (source.vy || 0) + fy;
                target.vx = (target.vx || 0) - fx;
                target.vy = (target.vy || 0) - fy;
            }
        }
    });
    
    // 对聚合连线的目标节点之间也添加额外的引力，使它们聚集在一起
    aggregatedLinks.forEach(group => {
        const sourceNode = nodes.find(n => n.id === group.sourceId);
        if (!sourceNode) return;
        
        const targetNodes = group.links
            .map(link => nodes.find(n => n.id === link.target))
            .filter(node => node !== undefined);
        
        if (targetNodes.length < 2) return;
        
        // 计算目标节点的中心位置
        const centerX = targetNodes.reduce((sum, node) => sum + node.x, 0) / targetNodes.length;
        const centerY = targetNodes.reduce((sum, node) => sum + node.y, 0) / targetNodes.length;
        
        // 对每个目标节点，添加向中心聚集的引力
        targetNodes.forEach(targetNode => {
            const dx = centerX - targetNode.x;
            const dy = centerY - targetNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // 计算向中心聚集的引力（使用较短的理想距离）
                const idealDistance = linkLength * 0.6; // 聚合节点的理想距离更短
                const force = (distance - idealDistance) / distance * temperature * 0.2;
                
                const fx = dx * force;
                const fy = dy * force;
                
                targetNode.vx = (targetNode.vx || 0) + fx;
                targetNode.vy = (targetNode.vy || 0) + fy;
            }
        });
    });
    
    // 为第一级节点添加额外的引力，让其他节点倾向于围绕它排列
    if (firstLevelNode) {
        nodes.forEach(node => {
            if (node.id !== firstLevelNode.id) {
                const dx = firstLevelNode.x - node.x;
                const dy = firstLevelNode.y - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    // 计算到第一级节点的引力（较弱，避免过度聚集）
                    const force = (distance - linkLength * 2) / distance * temperature * 0.05;
                    
                    // 应用引力
                    const fx = dx * force;
                    const fy = dy * force;
                    
                    node.vx = (node.vx || 0) + fx;
                    node.vy = (node.vy || 0) + fy;
                }
            }
        });
    }
}

/**
 * 应用边界力 - 保持节点在可视区域，统一边界间距，确保第一级节点在焦点问题下方
 * @param {Array} nodes - 节点数组
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {number} temperature - 温度参数
 */
function applyBoundaryForces(nodes, width, height, temperature) {
    // 统一的边界间距，与层次布局保持一致
    const margin = 200; // 增加左右边界间距，与assignCoordinates保持一致
    const topMargin = 20; // 调整顶部边界间距，与焦点问题框位置保持一致
    const bottomMargin = 150; // 底部边界间距
    
    // 获取第一级焦点问题节点
    let firstLevelNode = null;
    if (window.focusQuestion) {
        const match = window.focusQuestion.match(/焦点问题：(.*?)(是什么|\?|\.\.\.)/);
        if (match) {
            const currentKeyword = match[1].trim();
            firstLevelNode = nodes.find(node => {
                const nodeLabel = node.label || '';
                return nodeLabel === currentKeyword || 
                       nodeLabel.includes(currentKeyword) || 
                       currentKeyword.includes(nodeLabel);
            });
        }
    }
    
    nodes.forEach(node => {
        // 考虑节点尺寸的边界检查
        const nodeDimensions = window.calculateNodeDimensions(node.label || '', 70, 35, 14);
        const nodeWidth = node.width || nodeDimensions.width;
        const nodeHeight = node.height || nodeDimensions.height;
        
        // 增加安全边距
        const safeMargin = margin + 20;
        const safeTopMargin = topMargin + 20;
        const safeBottomMargin = bottomMargin + 20;
        
        // 左边界检查
        if (node.x - nodeWidth / 2 < safeMargin) {
            node.vx = (node.vx || 0) + (safeMargin + nodeWidth / 2 - node.x) * temperature * 0.2;
        }
        // 右边界检查
        if (node.x + nodeWidth / 2 > width - safeMargin) {
            node.vx = (node.vx || 0) + (width - safeMargin - nodeWidth / 2 - node.x) * temperature * 0.2;
        }
        
        // 第一级节点的特殊边界处理 - 强制严格居中
        if (firstLevelNode && node.id === firstLevelNode.id) {
            // 第一级节点强制固定在焦点问题正下方的中心位置
            const targetY = topMargin + 160; // 增大与焦点问题的间距
            const targetX = width / 2; // 严格居中
            
            const yDiff = targetY - node.y;
            const xDiff = targetX - node.x;
            
            // 强力拉回到目标位置
            node.vy = (node.vy || 0) + yDiff * temperature * 1.0; // 增强Y方向固定力
            node.vx = (node.vx || 0) + xDiff * temperature * 1.0; // 增强X方向居中力
            
            console.log(`强制第一级焦点问题节点"${node.label}"居中: 目标(${targetX}, ${targetY}), 当前(${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
        } else {
            // 普通节点的边界处理，需要避免与第一级节点重叠
            // 上边界检查 - 确保节点不会上移超过第一级节点的位置
            if (firstLevelNode) {
                const minY = topMargin + 160 + 80; // 第一级节点位置 + 间距（增大间距）
                if (node.y < minY) {
                    node.vy = (node.vy || 0) + (minY - node.y) * temperature * 0.3;
                }
            } else if (node.y - nodeHeight / 2 < safeTopMargin) {
                node.vy = (node.vy || 0) + (safeTopMargin + nodeHeight / 2 - node.y) * temperature * 0.2;
            }
            
            // 下边界检查
            if (node.y + nodeHeight / 2 > height - safeBottomMargin) {
                node.vy = (node.vy || 0) + (height - safeBottomMargin - nodeHeight / 2 - node.y) * temperature * 0.2;
            }
        }
    });
}

/**
 * 更新节点位置
 * @param {Array} nodes - 节点数组
 * @param {number} temperature - 温度参数
 */
function updateNodePositions(nodes, temperature) {
    const damping = 0.8; // 阻尼系数
    
    nodes.forEach(node => {
        // 更新位置
        node.x += (node.vx || 0) * temperature;
        node.y += (node.vy || 0) * temperature;
        
        // 应用阻尼
        node.vx = (node.vx || 0) * damping;
        node.vy = (node.vy || 0) * damping;
        
        // 清理速度
        if (Math.abs(node.vx) < 0.01) node.vx = 0;
        if (Math.abs(node.vy) < 0.01) node.vy = 0;
    });
}

/**
 * 最终位置调整
 * @param {Array} nodes - 节点数组
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 */
function finalizePositions(nodes, width, height) {
    const margin = 60;
    
    nodes.forEach(node => {
        // 确保节点在可视区域内
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
        
        // 清理临时属性
        delete node.vx;
        delete node.vy;
    });
    
    // 清理连线中的贝塞尔曲线属性，确保统一使用直线
    if (window.currentGraphData && window.currentGraphData.links) {
        window.currentGraphData.links.forEach(link => {
            delete link.isCurved;
            delete link.controlX;
            delete link.controlY;
        });
    }
}

// ==================== 连线路由优化算法 ====================
// 以下函数用于优化连线路由，避免重叠和文字标签重叠

/**
 * 优化连线路由，避免重叠和文字标签重叠
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 */
function optimizeLinkRouting(nodes, links) {
    console.log('优化连线路由，避免重叠...');
    
    // 检测连线交叉，通过调整节点位置来避免重叠
    for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
            const linkA = links[i];
            const linkB = links[j];
            
            if (hasLinkIntersection(linkA, linkB, nodes)) {
                // 调整节点位置，避免连线重叠
                adjustNodePositionsToAvoidOverlap(linkA, linkB, nodes);
            }
        }
    }
    
    // 优化文字标签位置，避免重叠
    optimizeLabelPositions(nodes, links);
    
    // 确保同级节点间距均匀
    ensureUniformSpacing(nodes, links);
}

/**
 * 检测连线是否相交
 * @param {Object} linkA - 连线A
 * @param {Object} linkB - 连线B
 * @param {Array} nodes - 节点数组
 * @returns {boolean} 是否相交
 */
function hasLinkIntersection(linkA, linkB, nodes) {
    const sourceA = nodes.find(n => n.id === linkA.source);
    const targetA = nodes.find(n => n.id === linkA.target);
    const sourceB = nodes.find(n => n.id === linkB.source);
    const targetB = nodes.find(n => n.id === linkB.target);
    
    if (!sourceA || !targetA || !sourceB || !targetB) return false;
    
    // 简单的线段相交检测
    return lineSegmentsIntersect(
        sourceA.x, sourceA.y, targetA.x, targetA.y,
        sourceB.x, sourceB.y, targetB.x, targetB.y
    );
}

/**
 * 检测连接线是否与节点重叠
 * @param {Object} link - 连线对象
 * @param {Array} nodes - 节点数组
 * @returns {Object} 重叠检测结果
 */
function hasLinkNodeOverlap(link, nodes) {
    const source = nodes.find(n => n.id === link.source);
    const target = nodes.find(n => n.id === link.target);
    
    // 🔴 修复：返回对象而不是布尔值，保持返回值格式一致
    if (!source || !target) return { hasOverlap: false };
    
    // 计算连接线的起点和终点（节点边缘）
    const sourceDimensions = calculateNodeDimensions(source.label || '', 70, 35, 14);
    const targetDimensions = calculateNodeDimensions(target.label || '', 70, 35, 14);
    
    const sourceWidth = source.width || sourceDimensions.width;
    const sourceHeight = source.height || sourceDimensions.height;
    const targetWidth = target.width || targetDimensions.width;
    const targetHeight = target.height || targetDimensions.height;
    
    // 判断节点间的层次关系
    const isHierarchical = window.isHierarchicalConnection(source, target, nodes, [link]);
    
    let startX, startY, endX, endY;
    
    if (isHierarchical) {
        // 层次连接：正常连接（从上到下：源节点下边，目标节点上边；从下到上：源节点上边，目标节点下边）
        if (target.y > source.y) {
            // 目标节点在下方：从源节点下边连接到目标节点上边
            startX = source.x;
            startY = source.y + sourceHeight / 2;
            endX = target.x;
            endY = target.y - targetHeight / 2;
        } else {
            // 目标节点在上方：从源节点上边连接到目标节点下边
            startX = source.x;
            startY = source.y - sourceHeight / 2;
            endX = target.x;
            endY = target.y + targetHeight / 2;
        }
    } else {
        // 同级连接：从节点的下边中点出发连接到另一个节点的下边中点
        startX = source.x;
        startY = source.y + sourceHeight / 2;
        endX = target.x;
        endY = target.y + targetHeight / 2;
    }
    
    // 检查连接线是否与其他节点重叠
    for (const node of nodes) {
        if (node.id === link.source || node.id === link.target) continue;
        
        const nodeDimensions = window.calculateNodeDimensions(node.label || '', 70, 35, 14);
        const nodeWidth = node.width || nodeDimensions.width;
        const nodeHeight = node.height || nodeDimensions.height;
        
        // 检查线段与矩形是否相交
        if (lineRectIntersect(startX, startY, endX, endY, 
            node.x - nodeWidth / 2, node.y - nodeHeight / 2, 
            nodeWidth, nodeHeight)) {
            return { hasOverlap: true, overlappingNode: node };
        }
    }
    
    return { hasOverlap: false };
}

/**
 * 检测线段与矩形是否相交
 * @param {number} lineStartX - 线段起点X
 * @param {number} lineStartY - 线段起点Y
 * @param {number} lineEndX - 线段终点X
 * @param {number} lineEndY - 线段终点Y
 * @param {number} rectX - 矩形X坐标
 * @param {number} rectY - 矩形Y坐标
 * @param {number} rectWidth - 矩形宽度
 * @param {number} rectHeight - 矩形高度
 * @returns {boolean} 是否相交
 */
function lineRectIntersect(lineStartX, lineStartY, lineEndX, lineEndY, 
                          rectX, rectY, rectWidth, rectHeight) {
    // 检查线段的两个端点是否在矩形内
    if (pointInRect(lineStartX, lineStartY, rectX, rectY, rectWidth, rectHeight) ||
        pointInRect(lineEndX, lineEndY, rectX, rectY, rectWidth, rectHeight)) {
        return true;
    }
    
    // 检查线段是否与矩形的四条边相交
    const rectEdges = [
        [rectX, rectY, rectX + rectWidth, rectY], // 上边
        [rectX + rectWidth, rectY, rectX + rectWidth, rectY + rectHeight], // 右边
        [rectX, rectY + rectHeight, rectX + rectWidth, rectY + rectHeight], // 下边
        [rectX, rectY, rectX, rectY + rectHeight] // 左边
    ];
    
    for (const edge of rectEdges) {
        if (lineSegmentsIntersect(lineStartX, lineStartY, lineEndX, lineEndY,
            edge[0], edge[1], edge[2], edge[3])) {
            return true;
        }
    }
    
    return false;
}

/**
 * 检查点是否在矩形内
 * @param {number} px - 点X坐标
 * @param {number} py - 点Y坐标
 * @param {number} rectX - 矩形X坐标
 * @param {number} rectY - 矩形Y坐标
 * @param {number} rectWidth - 矩形宽度
 * @param {number} rectHeight - 矩形高度
 * @returns {boolean} 是否在矩形内
 */
function pointInRect(px, py, rectX, rectY, rectWidth, rectHeight) {
    return px >= rectX && px <= rectX + rectWidth && 
           py >= rectY && py <= rectY + rectHeight;
}

/**
 * 计算折线路径点，避开重叠的节点
 * @param {Object} link - 连线对象
 * @param {Array} nodes - 节点数组
 * @param {Array} allLinks - 所有连线数组（用于检测双向连接）
 * @returns {Object} 路径数据
 */
function calculatePolylinePath(link, nodes, allLinks = null) {
    let source = nodes.find(n => n.id === link.source);
    let target = nodes.find(n => n.id === link.target);
    
    // 🔴 支持支架模式：如果找不到节点，尝试从占位符中获取
    if (!source && window.scaffoldPlaceholders) {
        const placeholder = window.scaffoldPlaceholders.find(p => p.id === link.source);
        if (placeholder) {
            source = {
                id: placeholder.id,
                x: placeholder.x || 0,
                y: placeholder.y || 0,
                width: placeholder.width || 100,
                height: placeholder.height || 50,
                label: '待填入',
                layer: placeholder.layer
            };
        }
    }
    
    if (!target && window.scaffoldPlaceholders) {
        const placeholder = window.scaffoldPlaceholders.find(p => p.id === link.target);
        if (placeholder) {
            target = {
                id: placeholder.id,
                x: placeholder.x || 0,
                y: placeholder.y || 0,
                width: placeholder.width || 100,
                height: placeholder.height || 50,
                label: '待填入',
                layer: placeholder.layer
            };
        }
    }
    
    if (!source || !target) return null;
    
    // 检测双向连接（两个节点之间相互有连线）
    let isBidirectional = false;
    let isFirstLink = true; // 用于确定圆弧方向
    if (allLinks) {
        const reverseLink = allLinks.find(l => 
            l.source === link.target && l.target === link.source && l.id !== link.id
        );
        if (reverseLink) {
            isBidirectional = true;
            // 根据link的ID或source/target的ID来确定哪条线向上弯曲，哪条向下弯曲
            // 使用source和target的ID组合来确定方向，确保一致性
            const linkKey = `${link.source}-${link.target}`;
            const reverseKey = `${link.target}-${link.source}`;
            // 如果当前link的key字典序小于reverse key，则向上弯曲，否则向下弯曲
            isFirstLink = linkKey < reverseKey;
        }
    }
    
    // 计算连接线的起点和终点（节点边缘）
    const sourceDimensions = calculateNodeDimensions(source.label || '', 70, 35, 14);
    const targetDimensions = calculateNodeDimensions(target.label || '', 70, 35, 14);
    
    const sourceWidth = source.width || sourceDimensions.width;
    const sourceHeight = source.height || sourceDimensions.height;
    const targetWidth = target.width || targetDimensions.width;
    const targetHeight = target.height || targetDimensions.height;
    
    // 判断节点间的层次关系
    const isHierarchical = window.isHierarchicalConnection(source, target, nodes, [link]);
    
    // 🔴 检查是否为用户自行创建的同级连接（不需要检测层级，直接使用弧线）
    const isUserCreatedSameLayer = link.isUserCreatedSameLayer === true;
    
    // 检测同层连接（两个节点在同一层）
    const isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
    
    let startX, startY, endX, endY;
    
    if (isHierarchical && !isUserCreatedSameLayer) {
        // 层次连接：正常连接（从上到下：源节点下边，目标节点上边；从下到上：源节点上边，目标节点下边）
        if (target.y > source.y) {
            // 目标节点在下方：从源节点下边连接到目标节点上边
            startX = source.x;
            startY = source.y + sourceHeight / 2;
            endX = target.x;
            endY = target.y - targetHeight / 2;
        } else {
            // 目标节点在上方：从源节点上边连接到目标节点下边
            startX = source.x;
            startY = source.y - sourceHeight / 2;
            endX = target.x;
            endY = target.y + targetHeight / 2;
        }
    } else {
        // 同级连接：从节点的下边中点出发连接到另一个节点的下边中点
        startX = source.x;
        startY = source.y + sourceHeight / 2;
        endX = target.x;
        endY = target.y + targetHeight / 2;
    }
    
    // 🔴 如果是用户自行创建的同级连接，直接使用圆弧连线（向下弯曲），不需要检测层级
    if (isUserCreatedSameLayer) {
        return calculateCurvedPath(startX, startY, endX, endY, false); // false表示向下弯曲
    }
    
    // 如果是同层连接，使用圆弧连线（向下弯曲）
    if (isSameLayer) {
        return calculateCurvedPath(startX, startY, endX, endY, false); // false表示向下弯曲
    }
    
    // 如果是双向连接，使用圆弧连线
    if (isBidirectional) {
        return calculateCurvedPath(startX, startY, endX, endY, isFirstLink);
    }
    
    // 检查是否有重叠
    const overlapCheck = hasLinkNodeOverlap(link, nodes);
    if (!overlapCheck.hasOverlap) {
        // 没有重叠，返回直线路径
        return {
            isPolyline: false,
            isCurved: false,
            path: `M ${startX} ${startY} L ${endX} ${endY}`,
            waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
        };
    }
    
    // 有重叠，计算折线路径
    const waypoints = calculateWaypoints(startX, startY, endX, endY, nodes, link);
    
    // 构建SVG路径
    let path = `M ${waypoints[0].x} ${waypoints[0].y}`;
    for (let i = 1; i < waypoints.length; i++) {
        path += ` L ${waypoints[i].x} ${waypoints[i].y}`;
    }
    
    return {
        isPolyline: true,
        isCurved: false,
        path: path,
        waypoints: waypoints
    };
}

/**
 * 计算圆弧路径（用于双向连接）
 * @param {number} startX - 起点X坐标
 * @param {number} startY - 起点Y坐标
 * @param {number} endX - 终点X坐标
 * @param {number} endY - 终点Y坐标
 * @param {boolean} isFirstLink - 是否为第一条连线（用于确定弯曲方向）
 * @returns {Object} 路径数据
 */
function calculateCurvedPath(startX, startY, endX, endY, isFirstLink) {
    // 计算中点
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // 计算连线的方向和垂直方向
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 计算垂直方向（用于控制点）
    const perpX = -dy / distance;
    const perpY = dx / distance;
    
    // 圆弧的弯曲程度（距离越大，弯曲程度越大）
    // 对于同级连接，增大弧度
    const curvature = Math.min(distance * 0.5, 150); // 增大弯曲程度，最大弯曲150px
    
    // 确定弯曲方向
    let curveDirection;
    if (isFirstLink === false) {
        // 同级连接：强制向下弯曲（从节点下方通过）
        // 确保控制点在起点和终点的下方
        const maxY = Math.max(startY, endY);
        // 先尝试一个方向
        const testY1 = midY + perpY * curvature;
        const testY2 = midY - perpY * curvature;
        
        // 选择让控制点更下方的方向
        if (testY1 > maxY && testY2 > maxY) {
            // 两个方向都在下方，选择更下方的
            curveDirection = testY1 > testY2 ? 1 : -1;
        } else if (testY1 > maxY) {
            curveDirection = 1;
        } else if (testY2 > maxY) {
            curveDirection = -1;
        } else {
            // 两个方向都不够下方，强制向下
            // 使用perpY的符号：如果perpY>0（从左到右），使用-1让控制点更下方
            curveDirection = perpY > 0 ? -1 : 1;
        }
    } else {
        // 双向连接：第一条线向上弯曲，第二条线向下弯曲
        curveDirection = isFirstLink ? 1 : -1;
    }
    
    let controlX = midX + perpX * curvature * curveDirection;
    let controlY = midY + perpY * curvature * curveDirection;
    
    // 对于同级连接，强制确保控制点在起点和终点下方
    if (isFirstLink === false) {
        const maxY = Math.max(startY, endY);
        if (controlY <= maxY) {
            // 强制控制点在maxY下方至少80px（确保明显在节点下方）
            controlY = maxY + 80;
            // 保持控制点与中点的X距离比例，但调整Y值
            const originalOffsetX = controlX - midX;
            const originalOffsetY = controlY - midY;
            // 如果原始偏移Y不为0，保持X偏移的比例
            if (Math.abs(originalOffsetY) > 0.001) {
                const newOffsetY = controlY - midY;
                const ratio = newOffsetY / originalOffsetY;
                controlX = midX + originalOffsetX * ratio;
            }
        }
    }
    
    // 使用二次贝塞尔曲线创建圆弧
    const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
    
    // 计算路径上的点（用于标签位置和箭头计算）
    // 在路径的50%位置（控制点附近）作为中点
    const waypoints = [
        { x: startX, y: startY },
        { x: controlX, y: controlY },
        { x: endX, y: endY }
    ];
    
    return {
        isPolyline: false,
        isCurved: true,
        path: path,
        waypoints: waypoints,
        controlPoint: { x: controlX, y: controlY }
    };
}

/**
 * 计算折线的路径点 - 最多只生成3个路径点（2个线段）
 * @param {number} startX - 起点X坐标
 * @param {number} startY - 起点Y坐标
 * @param {number} endX - 终点X坐标
 * @param {number} endY - 终点Y坐标
 * @param {Array} nodes - 节点数组
 * @param {Object} link - 连线对象
 * @returns {Array} 路径点数组
 */
function calculateWaypoints(startX, startY, endX, endY, nodes, link) {
    const waypoints = [{ x: startX, y: startY }];
    
    // 获取所有可能重叠的节点
    const overlappingNodes = [];
    for (const node of nodes) {
        if (node.id === link.source || node.id === link.target) continue;
        
        const nodeDimensions = window.calculateNodeDimensions(node.label || '', 70, 35, 14);
        const nodeWidth = node.width || nodeDimensions.width;
        const nodeHeight = node.height || nodeDimensions.height;
        
        if (lineRectIntersect(startX, startY, endX, endY, 
            node.x - nodeWidth / 2, node.y - nodeHeight / 2, 
            nodeWidth, nodeHeight)) {
            overlappingNodes.push({
                node: node,
                x: node.x,
                y: node.y,
                width: nodeWidth,
                height: nodeHeight
            });
        }
    }
    
    if (overlappingNodes.length === 0) {
        // 没有重叠节点，返回直线
        waypoints.push({ x: endX, y: endY });
        return waypoints;
    }
    
    // 按距离起点的远近排序重叠节点
    overlappingNodes.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - startX, 2) + Math.pow(a.y - startY, 2));
        const distB = Math.sqrt(Math.pow(b.x - startX, 2) + Math.pow(b.y - startY, 2));
        return distA - distB;
    });
    
    // 只处理第一个重叠节点，创建两段折线
    const overlapNode = overlappingNodes[0];
    
    // 计算单个绕行点 - 只生成一个中间点，形成两段线
    const detourPoint = calculateSingleDetourPoint(
        startX, startY, endX, endY, 
        overlapNode.x, overlapNode.y, 
        overlapNode.width, overlapNode.height
    );
    
    // 只添加一个绕行点，形成两段折线
    if (detourPoint) {
        waypoints.push(detourPoint); // 中间绕行点
    }
    
    // 添加终点
    waypoints.push({ x: endX, y: endY });
    
    return waypoints;
}

/**
 * 计算单个绕行点 - 只生成一个中间点，形成两段折线
 * @param {number} startX - 起点X坐标
 * @param {number} startY - 起点Y坐标
 * @param {number} endX - 终点X坐标
 * @param {number} endY - 终点Y坐标
 * @param {number} nodeX - 节点X坐标
 * @param {number} nodeY - 节点Y坐标
 * @param {number} nodeWidth - 节点宽度
 * @param {number} nodeHeight - 节点高度
 * @returns {Object|null} 绕行点坐标
 */
function calculateSingleDetourPoint(startX, startY, endX, endY, 
                                  nodeX, nodeY, nodeWidth, nodeHeight) {
    // 计算节点边界
    const nodeLeft = nodeX - nodeWidth / 2;
    const nodeRight = nodeX + nodeWidth / 2;
    const nodeTop = nodeY - nodeHeight / 2;
    const nodeBottom = nodeY + nodeHeight / 2;
    
    // 计算连线的方向
    const dx = endX - startX;
    const dy = endY - startY;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    // 计算绕行距离，确保有足够空间放置文字，增加距离让角度更明显
    const detourDistance = 80;
    
    if (isHorizontal) {
        // 水平连线，垂直绕行 - 强制向下弯曲
        if (dx > 0) {
            // 从左到右
            if (startX < nodeLeft && endX > nodeRight) {
                // 连线穿过节点，需要绕行 - 强制选择下方绕行
                const detourY = nodeBottom + detourDistance; // 只使用下方绕行
                
                // 计算绕行点的X坐标，让两段长度尽量一致
                const totalDistance = endX - startX;
                const offsetRatio = 0.5; // 使用50%位置，让两段长度一致
                const detourX = startX + totalDistance * offsetRatio;
                
                return { x: detourX, y: detourY };
            }
        } else {
            // 从右到左
            if (startX > nodeRight && endX < nodeLeft) {
                // 强制选择下方绕行
                const detourY = nodeBottom + detourDistance;
                
                // 计算绕行点的X坐标，让两段长度尽量一致
                const totalDistance = startX - endX;
                const offsetRatio = 0.5; // 使用50%位置，让两段长度一致
                const detourX = endX + totalDistance * offsetRatio;
                
                return { x: detourX, y: detourY };
            }
        }
    } else {
        // 垂直连线，水平绕行 - 确保折线向下弯曲
        if (dy > 0) {
            // 从上到下 - 正常情况，绕行点向下
            if (startY < nodeTop && endY > nodeBottom) {
                const detourX1 = nodeLeft - detourDistance;
                const detourX2 = nodeRight + detourDistance;
                
                const distLeft = Math.abs(startX - detourX1) + Math.abs(endX - detourX1);
                const distRight = Math.abs(startX - detourX2) + Math.abs(endX - detourX2);
                
                const detourX = distLeft < distRight ? detourX1 : detourX2;
                
                // 计算绕行点的Y坐标，让两段长度尽量一致
                const totalDistance = endY - startY;
                const offsetRatio = 0.5; // 使用50%位置，让两段长度一致
                const detourY = startY + totalDistance * offsetRatio;
                
                return { x: detourX, y: detourY };
            }
        } else {
            // 从下到上 - 特殊处理，确保折线向下弯曲
            if (startY > nodeBottom && endY < nodeTop) {
                const detourX1 = nodeLeft - detourDistance;
                const detourX2 = nodeRight + detourDistance;
                
                const distLeft = Math.abs(startX - detourX1) + Math.abs(endX - detourX1);
                const distRight = Math.abs(startX - detourX2) + Math.abs(endX - detourX2);
                
                const detourX = distLeft < distRight ? detourX1 : detourX2;
                
                // 对于从下到上的连线，绕行点放在节点下方，确保折线向下弯曲
                const detourY = nodeBottom + detourDistance;
                
                return { x: detourX, y: detourY };
            }
        }
    }
    
    return null;
}

/**
 * 线段相交检测
 * @param {number} x1 - 线段1起点X
 * @param {number} y1 - 线段1起点Y
 * @param {number} x2 - 线段1终点X
 * @param {number} y2 - 线段1终点Y
 * @param {number} x3 - 线段2起点X
 * @param {number} y3 - 线段2起点Y
 * @param {number} x4 - 线段2终点X
 * @param {number} y4 - 线段2终点Y
 * @returns {boolean} 是否相交
 */
function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * 调整节点位置避免连线重叠
 * @param {Object} linkA - 连线A
 * @param {Object} linkB - 连线B
 * @param {Array} nodes - 节点数组
 */
function adjustNodePositionsToAvoidOverlap(linkA, linkB, nodes) {
    const sourceA = nodes.find(n => n.id === linkA.source);
    const targetA = nodes.find(n => n.id === linkA.target);
    const sourceB = nodes.find(n => n.id === linkB.source);
    const targetB = nodes.find(n => n.id === linkB.target);
    
    if (!sourceA || !targetA || !sourceB || !targetB) return;
    
    // 计算两条连线的中点
    const midA = { x: (sourceA.x + targetA.x) / 2, y: (sourceA.y + targetA.y) / 2 };
    const midB = { x: (sourceB.x + targetB.x) / 2, y: (sourceB.y + targetB.y) / 2 };
    
    // 计算中点之间的距离
    const distance = Math.sqrt(Math.pow(midB.x - midA.x, 2) + Math.pow(midB.y - midA.y, 2));
    
    // 如果中点太近，轻微调整其中一个连线的目标节点位置
    if (distance < 50) {
        const offset = 20;
        const angle = Math.atan2(targetB.y - sourceB.y, targetB.x - sourceB.x);
        
        // 垂直于连线方向偏移目标节点
        const perpAngle = angle + Math.PI / 2;
        targetB.x += Math.cos(perpAngle) * offset;
        targetB.y += Math.sin(perpAngle) * offset;
    }
}

/**
 * 优化文字标签位置，避免重叠
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 */
function optimizeLabelPositions(nodes, links) {
    console.log('优化文字标签位置...');
    
    // 为每个连线计算最佳标签位置
    links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        
        if (!source || !target) return;
        
        // 计算连线中点
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        
        // 计算标签尺寸
        const labelWidth = Math.max(80, (link.label || '双击编辑').length * 12);
        const labelHeight = 20;
        
        // 检查标签是否与其他元素重叠
        let bestOffset = { x: 0, y: 0 };
        let minOverlap = Infinity;
        
        // 尝试不同的偏移位置，减少偏移量使标签更紧凑
        const offsets = [
            { x: 0, y: 0 },
            { x: 15, y: 0 },
            { x: -15, y: 0 },
            { x: 0, y: 15 },
            { x: 0, y: -15 },
            { x: 15, y: 15 },
            { x: -15, y: -15 },
            { x: 10, y: 10 },
            { x: -10, y: -10 }
        ];
        
        offsets.forEach(offset => {
            const overlap = calculateLabelOverlap(
                midX + offset.x, midY + offset.y,
                labelWidth, labelHeight,
                nodes, links, link.id
            );
            
            if (overlap < minOverlap) {
                minOverlap = overlap;
                bestOffset = offset;
            }
        });
        
        // 存储最佳标签位置
        link.labelX = midX + bestOffset.x;
        link.labelY = midY + bestOffset.y;
    });
}

/**
 * 计算标签与其他元素的重叠程度
 * @param {number} labelX - 标签X坐标
 * @param {number} labelY - 标签Y坐标
 * @param {number} labelWidth - 标签宽度
 * @param {number} labelHeight - 标签高度
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @param {string} currentLinkId - 当前连线ID
 * @returns {number} 重叠程度
 */
function calculateLabelOverlap(labelX, labelY, labelWidth, labelHeight, nodes, links, currentLinkId) {
    let overlap = 0;
    
    // 检查与节点的重叠
    nodes.forEach(node => {
        const nodeWidth = Math.max(100, (node.label || '').length * 12);
        const nodeHeight = 40;
        
        if (rectanglesOverlap(
            labelX - labelWidth/2, labelY - labelHeight/2, labelWidth, labelHeight,
            node.x - nodeWidth/2, node.y - nodeHeight/2, nodeWidth, nodeHeight
        )) {
            overlap += 100; // 与节点重叠惩罚很大
        }
    });
    
    // 检查与其他标签的重叠
    links.forEach(link => {
        if (link.id === currentLinkId) return;
        
        if (link.labelX !== undefined && link.labelY !== undefined) {
            const otherLabelWidth = Math.max(80, (link.label || '双击编辑').length * 12);
            const otherLabelHeight = 20;
            
            if (rectanglesOverlap(
                labelX - labelWidth/2, labelY - labelHeight/2, labelWidth, labelHeight,
                link.labelX - otherLabelWidth/2, link.labelY - otherLabelHeight/2, otherLabelWidth, otherLabelHeight
            )) {
                overlap += 50; // 与标签重叠惩罚
            }
        }
    });
    
    return overlap;
}

/**
 * 检查两个矩形是否重叠
 * @param {number} x1 - 矩形1X坐标
 * @param {number} y1 - 矩形1Y坐标
 * @param {number} w1 - 矩形1宽度
 * @param {number} h1 - 矩形1高度
 * @param {number} x2 - 矩形2X坐标
 * @param {number} y2 - 矩形2Y坐标
 * @param {number} w2 - 矩形2宽度
 * @param {number} h2 - 矩形2高度
 * @returns {boolean} 是否重叠
 */
function rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1);
}

/**
 * 确保同级节点间距均匀
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 */
function ensureUniformSpacing(nodes, links) {
    console.log('确保同级节点间距均匀...');
    
    // 按y坐标分组，找出同级节点
    const levelGroups = new Map();
    nodes.forEach(node => {
        const level = Math.round(node.y / 50); // 50像素内的节点认为是同级
        if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
        }
        levelGroups.get(level).push(node);
    });
    
    // 为每一层调整节点间距
    levelGroups.forEach((levelNodes, level) => {
        if (levelNodes.length <= 1) return;
        
        // 按x坐标排序
        levelNodes.sort((a, b) => a.x - b.x);
        
        // 计算所有节点的实际宽度
        const nodeWidths = levelNodes.map(node => {
            const nodeDimensions = calculateNodeDimensions(node.label || '', 70, 35, 14);
            return node.width || nodeDimensions.width;
        });
        
        // 固定间距，确保节点不重叠
        const minSpacing = 150; // 固定间距
        
        // 计算总宽度（所有节点宽度 + 间距）
        const totalNodeWidth = nodeWidths.reduce((sum, width) => sum + width, 0);
        const totalSpacing = (levelNodes.length - 1) * minSpacing;
        const totalWidth = totalNodeWidth + totalSpacing;
        
        // 计算起始位置（居中）
        const centerX = 400; // 画布中心
        let currentX = centerX - totalWidth / 2;
        
        // 重新分配x坐标，确保间距均匀
        levelNodes.forEach((node, index) => {
            const nodeWidth = nodeWidths[index];
            currentX += nodeWidth / 2;
            node.x = currentX;
            currentX += nodeWidth / 2 + minSpacing;
            
            console.log(`节点${index + 1} "${node.label}" 位置: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
        });
    });
}

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        applyIntelligentLayout,
        analyzeGraphStructure,
        calculateHierarchyScore,
        applyForceDirectedLayoutOnly,
        applyForceDirectedLayoutWithProjectSpecifics,
        applyAttractiveForces,
        applyBoundaryForces,
        updateNodePositions,
        finalizePositions,
        optimizeLinkRouting,
        hasLinkIntersection,
        hasLinkNodeOverlap,
        lineRectIntersect,
        pointInRect,
        calculatePolylinePath,
        calculateWaypoints,
        calculateSingleDetourPoint,
        lineSegmentsIntersect,
        adjustNodePositionsToAvoidOverlap,
        optimizeLabelPositions,
        calculateLabelOverlap,
        rectanglesOverlap,
        ensureUniformSpacing
    };
} else if (typeof window !== 'undefined') {
    // 浏览器环境 - 显式地将函数添加到 window 对象，确保全局可访问
    window.applyIntelligentLayout = applyIntelligentLayout;
    window.analyzeGraphStructure = analyzeGraphStructure;
    window.calculateHierarchyScore = calculateHierarchyScore;
    window.applyForceDirectedLayoutOnly = applyForceDirectedLayoutOnly;
    window.applyForceDirectedLayoutWithProjectSpecifics = applyForceDirectedLayoutWithProjectSpecifics;
    window.applyAttractiveForces = applyAttractiveForces;
    window.applyBoundaryForces = applyBoundaryForces;
    window.updateNodePositions = updateNodePositions;
    window.finalizePositions = finalizePositions;
    window.optimizeLinkRouting = optimizeLinkRouting;
    window.hasLinkIntersection = hasLinkIntersection;
    window.hasLinkNodeOverlap = hasLinkNodeOverlap;
    window.lineRectIntersect = lineRectIntersect;
    window.pointInRect = pointInRect;
    window.calculatePolylinePath = calculatePolylinePath;
    window.calculateWaypoints = calculateWaypoints;
    window.calculateSingleDetourPoint = calculateSingleDetourPoint;
    window.lineSegmentsIntersect = lineSegmentsIntersect;
    window.adjustNodePositionsToAvoidOverlap = adjustNodePositionsToAvoidOverlap;
    window.optimizeLabelPositions = optimizeLabelPositions;
    window.calculateLabelOverlap = calculateLabelOverlap;
    window.rectanglesOverlap = rectanglesOverlap;
    window.ensureUniformSpacing = ensureUniformSpacing;
    
    console.log('✅ layout-algorithms.js 已加载，所有函数已添加到全局作用域');
}
