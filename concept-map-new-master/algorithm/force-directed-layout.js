// 力导向布局算法模块
// 实现基于物理模拟的力导向图布局算法

/**
 * 力导向布局算法主函数
 * @param {Object} graphData - 图形数据 {nodes: Array, links: Array}
 * @param {Object} options - 布局选项
 * @param {number} options.width - 画布宽度
 * @param {number} options.height - 画布高度
 * @param {number} options.iterations - 迭代次数（默认300）
 * @param {number} options.coolingFactor - 冷却因子（默认0.95）
 * @param {number} options.linkDistance - 理想连线长度（默认100）
 * @param {number} options.nodeCharge - 节点电荷强度（默认-300）
 * @param {number} options.nodeSpacing - 节点最小间距（默认60）
 * @returns {Object} 优化后的图形数据
 */
function applyForceDirectedLayout(graphData, options = {}) {
    console.log('应用力导向布局算法...');
    
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('图形数据为空，跳过布局优化');
        return graphData;
    }

    const nodes = [...graphData.nodes];
    const links = [...graphData.links];
    
    // 默认参数
    const width = options.width || 1200;
    const height = options.height || 800;
    const maxIterations = options.iterations || 300;
    const coolingFactor = options.coolingFactor || 0.95;
    const linkDistance = options.linkDistance || 100;
    const nodeCharge = options.nodeCharge || -300;
    const nodeSpacing = options.nodeSpacing || 60;
    
    // 初始化节点位置
    initializeNodePositions(nodes, width, height);
    
    // 初始化节点速度
    nodes.forEach(node => {
        node.vx = 0;
        node.vy = 0;
    });
    
    // 执行力导向迭代
    const temperature = 1.0;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const currentTemp = temperature * Math.pow(coolingFactor, iteration);
        
        // 重置力（固定位置的节点不参与力的计算）
        nodes.forEach(node => {
            if (!node.fixedPosition) {
                node.fx = 0;
                node.fy = 0;
            }
        });
        
        // 应用斥力（节点间排斥，固定位置的节点不参与）
        applyRepulsiveForces(nodes, nodeCharge, nodeSpacing);
        
        // 应用引力（连线连接，固定位置的节点不参与）
        applyAttractiveForces(nodes, links, linkDistance);
        
        // 应用边界约束（固定位置的节点不参与）
        applyBoundaryConstraints(nodes, width, height);
        
        // 更新节点位置（固定位置的节点不更新）
        updateNodePositions(nodes, currentTemp);
        
        // 检查收敛性
        if (currentTemp < 0.01) {
            console.log(`布局在 ${iteration} 次迭代后收敛`);
            break;
        }
    }
    
    // 最终位置调整
    finalizeNodePositions(nodes, width, height);
    
    console.log('力导向布局完成');
    return { ...graphData, nodes, links };
}

/**
 * 初始化节点位置
 * @param {Array} nodes - 节点数组
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 */
function initializeNodePositions(nodes, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    
    nodes.forEach((node, i) => {
        if (node.x === undefined || node.y === undefined) {
            // 如果节点没有位置，使用圆形分布初始化
            const angle = (2 * Math.PI * i) / nodes.length;
            node.x = centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 50;
            node.y = centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 50;
        }
    });
}

/**
 * 应用斥力（节点间相互排斥）
 * @param {Array} nodes - 节点数组
 * @param {number} charge - 电荷强度（负值表示排斥）
 * @param {number} minDistance - 最小距离
 */
function applyRepulsiveForces(nodes, charge, minDistance) {
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];
            
            // 🔴 如果两个节点都是固定位置，跳过力的计算
            if (nodeA.fixedPosition && nodeB.fixedPosition) {
                continue;
            }
            
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // 避免距离过小导致力过大
                const safeDistance = Math.max(distance, minDistance);
                
                // 计算斥力（库仑定律）
                const force = charge / (safeDistance * safeDistance);
                const fx = (dx / safeDistance) * force;
                const fy = (dy / safeDistance) * force;
                
                // 应用力（牛顿第三定律）
                // 🔴 固定位置的节点不接收力，但可以施加力给其他节点
                if (!nodeA.fixedPosition) {
                    nodeA.fx = (nodeA.fx || 0) - fx;
                    nodeA.fy = (nodeA.fy || 0) - fy;
                }
                if (!nodeB.fixedPosition) {
                    nodeB.fx = (nodeB.fx || 0) + fx;
                    nodeB.fy = (nodeB.fy || 0) + fy;
                }
            }
        }
    }
}

/**
 * 应用引力（连线连接的节点相互吸引）
 * @param {Array} nodes - 节点数组
 * @param {Array} links - 连线数组
 * @param {number} idealDistance - 理想连线长度
 */
function applyAttractiveForces(nodes, links, idealDistance) {
    links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        
        if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // 计算引力（胡克定律）
                const displacement = distance - idealDistance;
                const force = displacement * 0.1; // 弹性系数
                
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                
                // 应用力（固定位置的节点不接收力，但可以施加力给其他节点）
                if (!source.fixedPosition) {
                    source.fx = (source.fx || 0) + fx;
                    source.fy = (source.fy || 0) + fy;
                }
                if (!target.fixedPosition) {
                    target.fx = (target.fx || 0) - fx;
                    target.fy = (target.fy || 0) - fy;
                }
            }
        }
    });
}

/**
 * 应用边界约束（保持节点在画布内）
 * @param {Array} nodes - 节点数组
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 */
function applyBoundaryConstraints(nodes, width, height) {
    const margin = 50;
    
    nodes.forEach(node => {
        // 🔴 如果节点有固定位置，不应用边界约束
        if (node.fixedPosition) {
            return;
        }
        
        // 考虑节点尺寸（如果有的话）
        const nodeWidth = node.width || 70;
        const nodeHeight = node.height || 35;
        const halfWidth = nodeWidth / 2;
        const halfHeight = nodeHeight / 2;
        
        // 左边界
        if (node.x - halfWidth < margin) {
            node.fx = (node.fx || 0) + (margin + halfWidth - node.x) * 0.1;
        }
        // 右边界
        if (node.x + halfWidth > width - margin) {
            node.fx = (node.fx || 0) - (node.x + halfWidth - (width - margin)) * 0.1;
        }
        // 上边界
        if (node.y - halfHeight < margin) {
            node.fy = (node.fy || 0) + (margin + halfHeight - node.y) * 0.1;
        }
        // 下边界
        if (node.y + halfHeight > height - margin) {
            node.fy = (node.fy || 0) - (node.y + halfHeight - (height - margin)) * 0.1;
        }
    });
}

/**
 * 更新节点位置
 * @param {Array} nodes - 节点数组
 * @param {number} temperature - 温度参数（控制移动幅度）
 */
function updateNodePositions(nodes, temperature) {
    const damping = 0.85; // 阻尼系数
    
    nodes.forEach(node => {
        // 🔴 如果节点有固定位置，保持其位置不变
        if (node.fixedPosition && node.savedX !== undefined && node.savedY !== undefined) {
            node.x = node.savedX;
            node.y = node.savedY;
            node.vx = 0;
            node.vy = 0;
            return;
        }
        
        // 更新速度（基于力）
        node.vx = (node.vx || 0) * damping + (node.fx || 0) * temperature;
        node.vy = (node.vy || 0) * damping + (node.fy || 0) * temperature;
        
        // 限制最大速度
        const maxVelocity = 10;
        const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (velocity > maxVelocity) {
            node.vx = (node.vx / velocity) * maxVelocity;
            node.vy = (node.vy / velocity) * maxVelocity;
        }
        
        // 更新位置
        node.x += node.vx;
        node.y += node.vy;
    });
}

/**
 * 最终位置调整
 * @param {Array} nodes - 节点数组
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 */
function finalizeNodePositions(nodes, width, height) {
    const margin = 50;
    
    nodes.forEach(node => {
        // 🔴 如果节点有固定位置，保持其位置不变
        if (node.fixedPosition && node.savedX !== undefined && node.savedY !== undefined) {
            node.x = node.savedX;
            node.y = node.savedY;
            // 清理临时属性
            delete node.vx;
            delete node.vy;
            delete node.fx;
            delete node.fy;
            return;
        }
        
        // 确保节点在可视区域内
        const nodeWidth = node.width || 70;
        const nodeHeight = node.height || 35;
        const halfWidth = nodeWidth / 2;
        const halfHeight = nodeHeight / 2;
        
        node.x = Math.max(margin + halfWidth, Math.min(width - margin - halfWidth, node.x));
        node.y = Math.max(margin + halfHeight, Math.min(height - margin - halfHeight, node.y));
        
        // 清理临时属性
        delete node.vx;
        delete node.vy;
        delete node.fx;
        delete node.fy;
    });
}

/**
 * 力导向布局（简化版，用于快速布局）
 * @param {Object} graphData - 图形数据
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @returns {Object} 优化后的图形数据
 */
function quickForceLayout(graphData, width = 1200, height = 800) {
    return applyForceDirectedLayout(graphData, {
        width,
        height,
        iterations: 150,
        coolingFactor: 0.92,
        linkDistance: 100,
        nodeCharge: -300,
        nodeSpacing: 60
    });
}

/**
 * 力导向布局（精细版，用于高质量布局）
 * @param {Object} graphData - 图形数据
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @returns {Object} 优化后的图形数据
 */
function preciseForceLayout(graphData, width = 1200, height = 800) {
    return applyForceDirectedLayout(graphData, {
        width,
        height,
        iterations: 500,
        coolingFactor: 0.98,
        linkDistance: 120,
        nodeCharge: -500,
        nodeSpacing: 80
    });
}

// 导出函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        applyForceDirectedLayout,
        initializeNodePositions,
        applyRepulsiveForces,
        applyAttractiveForces,
        applyBoundaryConstraints,
        updateNodePositions,
        finalizeNodePositions,
        quickForceLayout,
        preciseForceLayout
    };
} else if (typeof window !== 'undefined') {
    // 浏览器环境 - 显式地将函数添加到 window 对象，确保全局可访问
    window.applyForceDirectedLayout = applyForceDirectedLayout;
    window.initializeNodePositions = initializeNodePositions;
    window.applyRepulsiveForces = applyRepulsiveForces;
    window.applyAttractiveForces = applyAttractiveForces;
    window.applyBoundaryConstraints = applyBoundaryConstraints;
    window.updateNodePositions = updateNodePositions;
    window.finalizeNodePositions = finalizeNodePositions;
    window.quickForceLayout = quickForceLayout;
    window.preciseForceLayout = preciseForceLayout;
    
    console.log('✅ force-directed-layout.js 已加载，所有函数已添加到全局作用域');
}


