/**
 * Concept Map Renderer for MindGraph
 * 
 * 完全采用 concept-map-new-master 的布局和渲染方式
 * 
 * Copyright 2024-2025 北京思源智教科技有限公司
 */

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 计算文字尺寸
 */
function calculateTextDimensions(text, fontSize = '24', fontFamily = 'Arial, sans-serif') {
    if (!text) return { width: 0, height: 0 };
    
    // 简单估算：中文字符约 fontSize 宽度，英文字符约 fontSize * 0.6 宽度
    const size = parseInt(fontSize) || 24;
    let width = 0;
    for (const char of text) {
        if (/[\u4e00-\u9fa5]/.test(char)) {
            width += size;
            } else {
            width += size * 0.6;
        }
    }
    const height = size * 1.2;
    return { width: Math.ceil(width), height: Math.ceil(height) };
}

/**
 * 计算节点尺寸
 */
function calculateNodeDimensions(nodeLabel, minWidth = 220, minHeight = 85, padding = 36) {
    if (!nodeLabel || nodeLabel.trim() === '') {
        return { width: minWidth, height: minHeight };
    }
    
    // 使用24号字体计算文字尺寸（与节点字体大小保持一致）
    const textDimensions = calculateTextDimensions(nodeLabel, '24', 'Arial, sans-serif');
    const nodeWidth = Math.max(minWidth, textDimensions.width + padding * 2);
    const nodeHeight = Math.max(minHeight, textDimensions.height + padding);
    
    return { width: nodeWidth, height: nodeHeight };
}

/**
 * 计算两个节点之间最近的上下边中点连接点
 * 选择距离最短的连接方式：源上/下边中点 → 目标上/下边中点
 * @param {Object} source - 源节点 {x, y, width, height, layer}
 * @param {Object} target - 目标节点 {x, y, width, height, layer}
 * @param {boolean} isSameLayer - 是否是同级连接（可选，如果不传则自动判断）
 * @returns {Object} { startX, startY, endX, endY }
 */
function calculateNearestEdgeConnection(source, target, isSameLayer) {
    const sourceTop = { x: source.x, y: source.y - source.height / 2 };
    const sourceBottom = { x: source.x, y: source.y + source.height / 2 };
    const targetTop = { x: target.x, y: target.y - target.height / 2 };
    const targetBottom = { x: target.x, y: target.y + target.height / 2 };
    
    // 如果没有传入 isSameLayer，自动判断
    if (isSameLayer === undefined) {
        isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
    }
    
    // 计算两个节点中心点的 Y 坐标差异
    const yDifference = Math.abs(source.y - target.y);
    // 使用较大节点的高度作为阈值
    const heightThreshold = Math.max(source.height, target.height);
    
    // 同级连接：只有当 layer 相同 且 Y 坐标差异小于一个节点高度时，才使用下方中点到下方中点
    // 这样手动放置的节点即使 layer 相同，如果位置差异大也会使用最近边连接
    if (isSameLayer && yDifference < heightThreshold) {
        return {
            startX: sourceBottom.x,
            startY: sourceBottom.y,
            endX: targetBottom.x,
            endY: targetBottom.y
        };
    }
    
    // 非同级连接或Y坐标差异大：计算所有4种连接组合的距离，选择最近的
    const connections = [
        { 
            start: sourceTop, 
            end: targetTop, 
            dist: Math.hypot(sourceTop.x - targetTop.x, sourceTop.y - targetTop.y) 
        },
        { 
            start: sourceTop, 
            end: targetBottom, 
            dist: Math.hypot(sourceTop.x - targetBottom.x, sourceTop.y - targetBottom.y) 
        },
        { 
            start: sourceBottom, 
            end: targetTop, 
            dist: Math.hypot(sourceBottom.x - targetTop.x, sourceBottom.y - targetTop.y) 
        },
        { 
            start: sourceBottom, 
            end: targetBottom, 
            dist: Math.hypot(sourceBottom.x - targetBottom.x, sourceBottom.y - targetBottom.y) 
        }
    ];
    
    // 选择距离最短的连接
    const nearest = connections.reduce((min, curr) => curr.dist < min.dist ? curr : min);
    
    return {
        startX: nearest.start.x,
        startY: nearest.start.y,
        endX: nearest.end.x,
        endY: nearest.end.y
    };
}

/**
 * 获取连线的源/目标节点ID（兼容字符串ID和对象引用两种情况）
 */
function getLinkNodeId(nodeRef) {
    if (typeof nodeRef === 'string') {
        return nodeRef;
    } else if (nodeRef && typeof nodeRef === 'object') {
        return nodeRef.id;
    }
    return null;
}

// 导出到全局供 sugiyama-layout 使用
if (typeof window !== 'undefined') {
    window.calculateNodeDimensions = calculateNodeDimensions;
    window.calculateTextDimensions = calculateTextDimensions;
    window.getLinkNodeId = getLinkNodeId;
}

// ============================================================================
// 主渲染函数
// ============================================================================

function renderConceptMap(spec, theme = null, dimensions = null) {
    console.log('ConceptMapRenderer: 开始渲染概念图 (concept-map style)');
    console.log('ConceptMapRenderer: 原始spec数据:', spec);
    
    // 确保 spec 是有效对象（不是数组或其他类型）
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        console.error('ConceptMapRenderer: spec 必须是对象，收到:', typeof spec);
        return;
    }
    
    // 支持两种数据格式：
    // 1. MindGraph 格式: { topic, concepts, relationships }
    // 2. Concept-map 格式: { nodes, links } (已有坐标)
    
    // 检测数据格式
    const hasNodesLinks = spec.nodes && Array.isArray(spec.nodes) && spec.nodes.length > 0 &&
                          spec.links && Array.isArray(spec.links) &&
                          spec.nodes.every(n => n && typeof n === 'object' && n.id);
    const hasTopicConcepts = spec.topic && typeof spec.topic === 'string' && spec.topic.trim() !== '' &&
                             spec.concepts && Array.isArray(spec.concepts);
    
    console.log('ConceptMapRenderer: 数据格式检测:', { hasNodesLinks, hasTopicConcepts });
    
    // 如果 concepts 为空，显示空白画布（等待 LLM 生成）
    if (hasTopicConcepts && spec.concepts.length === 0) {
        console.log('ConceptMapRenderer: concepts 为空，显示空白画布等待数据生成');
        // 不返回错误，继续创建空白画布
    }
    
    if (!hasNodesLinks && !hasTopicConcepts) {
        console.error('ConceptMapRenderer: 无效的概念图数据 - 需要 {topic, concepts, relationships} 或 {nodes, links}');
        console.error('ConceptMapRenderer: spec内容:', JSON.stringify(spec, null, 2));
                return;
            }
            
    // 确保 relationships 存在（兼容旧数据）
    if (hasTopicConcepts && !Array.isArray(spec.relationships)) {
        spec.relationships = [];
    }
    
    // 清空容器
    const container = document.getElementById('d3-container');
    if (!container) {
        console.error('ConceptMapRenderer: 找不到 #d3-container');
                return;
            }
    container.innerHTML = '';
    
    // 获取容器的实际尺寸，用于设置 viewBox
    // 注意：使用 clientWidth/clientHeight 避免小数造成亚像素偏移
    const containerRect = container.getBoundingClientRect();
    const width = Math.round(container.clientWidth || containerRect.width || 1600);
    const height = Math.round(container.clientHeight || containerRect.height || 800);
    // 如果浏览器可视宽度大于容器宽度，则只向左平移 viewBox，不拉伸宽度，避免缩放内容
    const viewportWidth = Math.round(document.documentElement.clientWidth || window.innerWidth || width);
    const viewBoxX = (viewportWidth > width) ? -(viewportWidth - width) : 0;
    
    console.log(`ConceptMapRenderer: 容器尺寸 ${containerRect.width.toFixed(0)}x${containerRect.height.toFixed(0)}, viewBox 尺寸 ${width.toFixed(0)}x${height.toFixed(0)}`);
    
    // 创建 SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    // 保持 viewBox 宽度为容器宽度，仅平移 minX，避免缩放变小
    svg.setAttribute('viewBox', `${viewBoxX} 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'concept-graph');
    container.appendChild(svg);
    
    // 设置背景 - 添加 class 防止被当作节点处理
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('class', 'background');
    bgRect.setAttribute('width', width);
    bgRect.setAttribute('height', height);
    bgRect.setAttribute('fill', '#f5f5f5');
    bgRect.setAttribute('pointer-events', 'none'); // 不响应鼠标事件
    svg.appendChild(bgRect);
    
    // 添加箭头定义
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 8');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '4');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M 0 0 L 10 4 L 0 8 z');
    arrowPath.setAttribute('fill', '#aaa');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);
    
    // ========================================================================
    // 准备图形数据
    // ========================================================================
    let graphData;
    
    // 优先使用 topic/concepts/relationships 格式（MindGraph 主要格式）
    if (hasTopicConcepts) {
        // 转换 MindGraph 格式 -> nodes/links 格式
        console.log('ConceptMapRenderer: 转换 topic/concepts/relationships 格式');
        graphData = convertToConceptMapFormat(spec);
    } else if (hasNodesLinks) {
        // 数据已经是 nodes/links 格式，直接使用
        console.log('ConceptMapRenderer: 使用 nodes/links 格式数据');
        graphData = {
            nodes: spec.nodes.map(n => ({ ...n })),
            links: spec.links.map(l => ({ ...l })),
            metadata: spec.metadata || {}
        };
        
        // 检查节点是否已有坐标
        const hasCoords = graphData.nodes.some(n => n.x !== undefined && n.y !== undefined);
        console.log('ConceptMapRenderer: 节点是否已有坐标:', hasCoords);
        } else {
        console.error('ConceptMapRenderer: 无法识别数据格式');
        return;
    }
    
    console.log('ConceptMapRenderer: 准备后的数据', graphData);
    console.log('ConceptMapRenderer: 节点数:', graphData.nodes.length, '连线数:', graphData.links.length);
    
    // ========================================================================
    // 应用 Sugiyama 布局（仅当有概念节点时）
    // ========================================================================
    let layoutResult = graphData;
    
    // 检查是否只有焦点问题节点
    const conceptNodes = graphData.nodes.filter(n => n.layer !== 0 && !n.isFocusQuestion);
    const hasOnlyFocusQuestion = conceptNodes.length === 0;
    
    if (hasOnlyFocusQuestion) {
        // 只有焦点问题框，直接设置位置，不需要运行布局算法
        console.log('ConceptMapRenderer: 只有焦点问题节点，跳过Sugiyama布局，直接定位');
        graphData.nodes.forEach(node => {
            if (node.layer === 0 || node.isFocusQuestion) {
                node.x = width / 2;
                node.y = 50; // 与 sugiyama-layout.js 保持一致
                if (!node.width) node.width = 1400;
                if (!node.height) node.height = 80;
            }
        });
        layoutResult = graphData;
    } else if (typeof window.applySugiyamaLayout === 'function') {
        console.log('ConceptMapRenderer: 应用 Sugiyama 布局算法');
        layoutResult = window.applySugiyamaLayout(graphData);
    } else {
        console.warn('ConceptMapRenderer: Sugiyama 布局不可用，使用默认布局');
        applyDefaultLayout(graphData.nodes, graphData.links, width, height);
        layoutResult = graphData;
    }
    
    // 验证布局结果
    layoutResult.nodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) {
            console.error('ConceptMapRenderer: 节点没有坐标', node);
        }
    });
    
    // 确定主题（用于区分主题节点样式）
    let topic = spec.topic;
    if (!topic && layoutResult.nodes.length > 0) {
        // 如果没有 topic，找 layer=1 的节点作为主题
        const topicNode = layoutResult.nodes.find(n => n.layer === 1);
        topic = topicNode ? topicNode.label : layoutResult.nodes[0].label;
    }
    
    // ========================================================================
    // 调试：检查布局结果中前几个节点的坐标
    // ========================================================================
    console.log('ConceptMapRenderer: 布局结果验证（前5个节点）:');
    layoutResult.nodes.slice(0, 5).forEach((node, idx) => {
        console.log(`  节点${idx}: "${node.label}" x=${node.x}, y=${node.y}, layer=${node.layer}`);
    });
    
    // ========================================================================
    // 优化标签位置（避免连接词重叠）
    // ========================================================================
    optimizeLabelPositions(layoutResult.nodes, layoutResult.links);
    
    // ========================================================================
    // 预先计算并更新所有节点的尺寸（确保连线计算使用正确的尺寸）
    // ========================================================================
    layoutResult.nodes.forEach(node => {
        const isFocusQuestion = node.isFocusQuestion || node.id === 'focus-question-node';
        if (isFocusQuestion) {
            node.width = 1400;
            node.height = 80;
        } else {
            const dims = calculateNodeDimensions(node.label || '');
            node.width = dims.width;
            node.height = dims.height;
        }
    });
    
    // ========================================================================
    // 渲染连线（先渲染连线，再渲染节点，确保节点在连线上方）
    // ========================================================================
    drawLinks(svg, layoutResult.nodes, layoutResult.links, topic);
    
    // ========================================================================
    // 渲染节点
    // ========================================================================
    drawNodes(svg, layoutResult.nodes, topic);
    
    // ========================================================================
    // 设置当前图数据（用于拖动功能）- 必须在显示焦点问题之前设置
    // ========================================================================
    if (typeof setCurrentGraphData === 'function') {
        setCurrentGraphData(layoutResult);
    }

    // ========================================================================
    // 调试：输出焦点问题框的居中诊断信息（使用布局数据和变换后的 BBox）
    // ========================================================================
    (function logFocusQuestionDiagnostics() {
        const container = document.getElementById('d3-container');
        const svgEl = container?.querySelector('svg');
        const focusNode = layoutResult.nodes.find(
            n => n.layer === 0 || n.isFocusQuestion || n.id === 'focus-question-node'
        );
        const viewBoxParts = svgEl?.getAttribute('viewBox')?.split(' ').map(Number) || [];
        const viewBoxX = viewBoxParts[0] || 0;
        const viewBoxY = viewBoxParts[1] || 0;
        const viewBoxWidth = viewBoxParts[2] || 0;
        const viewBoxHeight = viewBoxParts[3] || 0;

        // 基于布局数据的理论左右间距
        let leftSpace = null;
        let rightSpace = null;
        if (focusNode && focusNode.width) {
            leftSpace = focusNode.x - focusNode.width / 2 - viewBoxX;
            rightSpace = (viewBoxX + viewBoxWidth) - (focusNode.x + focusNode.width / 2);
        }

        // 基于实际渲染后的 BBox（含 transform）
        let bboxTransformed = null;
        const focusGroup = svgEl?.querySelector('[data-node-id="focus-question-node"]');
        const bbox = focusGroup?.getBBox?.();
        const ctm = focusGroup?.getCTM?.();
        if (bbox && ctm) {
            // 仅处理平移/缩放场景：应用 CTM 到 BBox 四个角求最小包围盒
            const pts = [
                { x: bbox.x, y: bbox.y },
                { x: bbox.x + bbox.width, y: bbox.y },
                { x: bbox.x, y: bbox.y + bbox.height },
                { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
            ].map(p => ({
                x: p.x * ctm.a + p.y * ctm.c + ctm.e,
                y: p.x * ctm.b + p.y * ctm.d + ctm.f
            }));
            const xs = pts.map(p => p.x);
            const ys = pts.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            bboxTransformed = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }

        const diag = {
            containerWidth: container?.clientWidth,
            containerHeight: container?.clientHeight,
            viewBox: { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight },
            focusNode,
            leftSpace,
            rightSpace,
            leftRightDiff: (leftSpace !== null && rightSpace !== null) ? (rightSpace - leftSpace) : null,
            focusBBoxTransformed: bboxTransformed,
            focusBBoxRaw: bbox || null
        };
        console.log('[ConceptMap] 居中诊断', diag);
    })();
    
    // ========================================================================
    // 显示焦点问题（可拖动的节点）
    // ========================================================================
    if (window.focusQuestion) {
        displayFocusQuestion(svg, width);
    }
    
    // ========================================================================
    // 添加画布点击处理（点击空白取消选中）
    // ========================================================================
    if (typeof setupCanvasClickHandler === 'function') {
        setupCanvasClickHandler(svg);
    }
    
    console.log('ConceptMapRenderer: 渲染完成');
}

// ============================================================================
// 数据格式转换
// ============================================================================

function convertToConceptMapFormat(spec) {
    console.log('convertToConceptMapFormat: 输入spec', spec);
    console.log('convertToConceptMapFormat: spec.topic =', spec.topic);
    console.log('convertToConceptMapFormat: spec.concepts =', spec.concepts);
    console.log('convertToConceptMapFormat: spec.relationships =', spec.relationships);
    
        const nodes = [];
        const links = [];
        
    // 构建邻接表用于层级计算
    // 注意：只使用 concepts 中的节点，不包括 topic（topic 作为焦点问题单独处理）
    const adjacencyList = new Map();
    const inDegree = new Map();
    const outDegree = new Map();
    
    // 只收集 concepts 中的节点（不包括 topic，因为 topic 可能不在 relationships 中）
    const allLabels = new Set(spec.concepts || []);
    allLabels.forEach(label => {
        adjacencyList.set(label, []);
        inDegree.set(label, 0);
        outDegree.set(label, 0);
    });
    
    // 构建有向图
    (spec.relationships || []).forEach(rel => {
        const from = rel.from || rel.source;
        const to = rel.to || rel.target;
        // 只处理两端都在 concepts 中的关系
        if (from && to && allLabels.has(from) && allLabels.has(to)) {
            adjacencyList.get(from).push(to);
            inDegree.set(to, (inDegree.get(to) || 0) + 1);
            outDegree.set(from, (outDegree.get(from) || 0) + 1);
        }
    });
    
    // 找到根节点（入度为0且有出边的节点，优先选择有出边的）
    let rootNodes = [];
    allLabels.forEach(label => {
        if (inDegree.get(label) === 0) {
            rootNodes.push(label);
        }
    });
    
    // 如果有多个根节点，优先选择有出边的（真正的根节点）
    const rootsWithOutEdges = rootNodes.filter(r => outDegree.get(r) > 0);
    if (rootsWithOutEdges.length > 0) {
        rootNodes = rootsWithOutEdges;
        console.log('convertToConceptMapFormat: 选择有出边的根节点:', rootNodes);
    }
    
    // 如果没有根节点（可能是循环图），选择出边最多的节点作为根
    if (rootNodes.length === 0 && allLabels.size > 0) {
        let maxOutDegree = 0;
        let bestRoot = null;
        allLabels.forEach(label => {
            if (outDegree.get(label) > maxOutDegree) {
                maxOutDegree = outDegree.get(label);
                bestRoot = label;
            }
        });
        if (bestRoot) {
            rootNodes = [bestRoot];
            console.log('convertToConceptMapFormat: 无入度为0的节点，选择出边最多的节点作为根:', bestRoot);
        }
    }
    
    console.log('convertToConceptMapFormat: 根节点:', rootNodes);
    
    // 使用 BFS 从根节点分配层级
    const conceptLayers = new Map();
    const queue = [];
    
    // 根节点分配到 layer 1（焦点问题在 layer 0）
    rootNodes.forEach(root => {
        conceptLayers.set(root, 1);
        queue.push({ label: root, layer: 1 });
    });
    
    while (queue.length > 0) {
        const { label, layer } = queue.shift();
        const neighbors = adjacencyList.get(label) || [];
        neighbors.forEach(neighbor => {
            if (!conceptLayers.has(neighbor)) {
                conceptLayers.set(neighbor, layer + 1);
                queue.push({ label: neighbor, layer: layer + 1 });
            }
        });
    }
    
    // 为没有层级的节点分配层级（孤立节点或循环图中的节点）
    // 根据它们与已分配节点的关系来决定层级
    let changed = true;
    while (changed) {
        changed = false;
        allLabels.forEach(label => {
            if (!conceptLayers.has(label)) {
                // 查找这个节点的邻居中是否有已分配层级的
                const neighbors = adjacencyList.get(label) || [];
                for (const neighbor of neighbors) {
                    if (conceptLayers.has(neighbor)) {
                        // 如果邻居有层级，这个节点的层级是邻居层级-1（作为父节点）
                        const neighborLayer = conceptLayers.get(neighbor);
                        conceptLayers.set(label, Math.max(1, neighborLayer - 1));
                        queue.push({ label: label, layer: conceptLayers.get(label) });
                        changed = true;
                        break;
                    }
                }
                
                // 也检查是否有节点指向这个节点
                if (!conceptLayers.has(label)) {
                    for (const [otherLabel, otherNeighbors] of adjacencyList) {
                        if (otherNeighbors.includes(label) && conceptLayers.has(otherLabel)) {
                            // 如果有节点指向这个节点，这个节点的层级是那个节点的层级+1
                            const otherLayer = conceptLayers.get(otherLabel);
                            conceptLayers.set(label, otherLayer + 1);
                            changed = true;
                            break;
                        }
                    }
                }
            }
        });
    }
    
    // 最后，为仍然没有层级的节点分配默认层级 2
    allLabels.forEach(label => {
        if (!conceptLayers.has(label)) {
            conceptLayers.set(label, 2);
            console.log(`convertToConceptMapFormat: 孤立节点 "${label}" 分配默认层级 2`);
        }
    });
    
    console.log('convertToConceptMapFormat: 层级分配:', Array.from(conceptLayers.entries()));
    
    // 主题节点使用焦点问题节点的 ID，这样连线可以正确关联
    const topicId = 'focus-question-node';
    const topicLayer = conceptLayers.get(spec.topic) || 1;
    
    // 创建标签到ID的映射（包含主题，用于连线）
    const topicIdMap = new Map();
    topicIdMap.set(spec.topic, topicId);
    
    // 添加焦点问题节点（主题节点）- 这样布局算法可以正确处理它
    const focusQuestionLabel = `焦点问题：${spec.topic}`;
    nodes.push({
        id: topicId,
        label: focusQuestionLabel,
        layer: 0,  // 焦点问题在最顶层
        type: 'focus-question',
        isFocusQuestion: true,
        width: 1400,  // 固定宽度 1400px
        height: 80    // 固定高度 80px（扩大）
    });
    console.log(`  添加焦点问题节点: id=${topicId}, label=${focusQuestionLabel}, layer=0, width=1400`);
        
    // 添加概念节点
    console.log('convertToConceptMapFormat: 开始添加概念节点，数量:', spec.concepts ? spec.concepts.length : 0);
    if (spec.concepts && Array.isArray(spec.concepts)) {
        spec.concepts.forEach((concept, i) => {
            // 跳过主题节点（已经添加）
            if (concept === spec.topic) return;
            
            const conceptId = `node-concept-${i}`;
            const layer = conceptLayers.get(concept) || 2;
            nodes.push({
                id: conceptId,
                label: concept,
                layer: layer
            });
            console.log(`  添加概念节点: id=${conceptId}, label=${concept}, layer=${layer}`);
        });
    }
    
    console.log('convertToConceptMapFormat: 节点总数:', nodes.length);
    
    // 创建标签到ID的映射（包含主题，用于连线）
    const labelToId = new Map();
    labelToId.set(spec.topic, topicId); // 主题也放入映射，但不添加为节点
    nodes.forEach(node => {
        labelToId.set(node.label, node.id);
    });
    
    console.log('convertToConceptMapFormat: labelToId映射:', Array.from(labelToId.entries()));
    
    // 添加关系连线（包括焦点问题节点与第一层节点的连线）
    // 参考 conceptmap 文件夹：禁止跨层连接，只允许相邻层连接和同层连接
    console.log('convertToConceptMapFormat: 开始添加关系，数量:', spec.relationships ? spec.relationships.length : 0);
    if (spec.relationships && Array.isArray(spec.relationships)) {
        // 创建 label 到 layer 的映射
        const labelToLayer = new Map();
        labelToLayer.set(spec.topic, 0); // 焦点问题是 layer 0
        nodes.forEach(node => {
            labelToLayer.set(node.label, node.layer);
        });
        
        let skippedCrossLayer = 0;
        spec.relationships.forEach((rel, i) => {
            const fromLabel = rel.from || rel.source;
            const toLabel = rel.to || rel.target;
            
            const sourceId = labelToId.get(fromLabel);
            const targetId = labelToId.get(toLabel);
            
            // 获取源节点和目标节点的层级
            const sourceLayer = labelToLayer.get(fromLabel);
            const targetLayer = labelToLayer.get(toLabel);
            
            console.log(`  关系${i}: from="${fromLabel}"[L${sourceLayer}], to="${toLabel}"[L${targetLayer}], sourceId=${sourceId}, targetId=${targetId}`);
            
            // 检查是否是跨层连接（禁止跨层连接，只允许相邻层和同层）
            if (sourceLayer !== undefined && targetLayer !== undefined) {
                const layerDiff = Math.abs(targetLayer - sourceLayer);
                // 允许相邻层连接（层级差为1）和同层连接（层级差为0）
                // 禁止跨层连接（层级差 > 1）
                if (layerDiff > 1) {
                    console.warn(`  ❌ 关系${i}被跳过: 跨层连接 L${sourceLayer} -> L${targetLayer}（层级差=${layerDiff} > 1）`);
                    skippedCrossLayer++;
                    return; // 跳过这条连线
                }
            }
            
            if (sourceId && targetId) {
                // 🔴🔴🔴 移植自 concept-map-new-master：禁止生成到焦点问题框的连接线
                // 焦点问题框应该是独立的 UI 元素，不参与图的连接关系
                if (targetId === 'focus-question-node') {
                    console.warn(`  ❌ 关系${i}被跳过: 禁止连接到焦点问题框 (${fromLabel} -> ${toLabel})`);
                    return; // 跳过指向焦点问题节点的连线
                }
                if (sourceId === 'focus-question-node') {
                    console.warn(`  ❌ 关系${i}被跳过: 禁止从焦点问题框出发 (${fromLabel} -> ${toLabel})`);
                    return; // 跳过从焦点问题节点出发的连线
                }
                
                links.push({
                    id: `link-${i}`,
                    source: sourceId,
                    target: targetId,
                    label: rel.label || rel.relationship || ''
                });
            } else {
                console.warn(`  关系${i}被跳过: sourceId或targetId为空`);
            }
        });
        
        if (skippedCrossLayer > 0) {
            console.warn(`convertToConceptMapFormat: 共跳过 ${skippedCrossLayer} 条跨层连接`);
        }
    }
    
    // ========================================================================
    // 确保第一层（Layer 1）只有一个节点
    // ========================================================================
    const layer1Nodes = nodes.filter(n => n.layer === 1);
    console.log(`convertToConceptMapFormat: Layer 1 节点数: ${layer1Nodes.length}`);
    
    if (layer1Nodes.length > 1) {
        console.log('convertToConceptMapFormat: Layer 1 有多个节点，需要合并或选择');
        
        // 找到与焦点问题最相关的节点
        const keyword = spec.topic || '';
        let bestNode = layer1Nodes[0];
        let bestScore = 0;
        
        layer1Nodes.forEach(node => {
            const score = calculateKeywordMatchScore(node.label, keyword);
            if (score > bestScore) {
                bestScore = score;
                bestNode = node;
            }
        });
        
        console.log(`convertToConceptMapFormat: 选择 "${bestNode.label}" 作为唯一的 Layer 1 节点`);
        
        // 将其他 Layer 1 节点移到 Layer 2，并重定向连线
        const nodesToDemote = layer1Nodes.filter(n => n.id !== bestNode.id);
        nodesToDemote.forEach(node => {
            console.log(`  将节点 "${node.label}" 从 Layer 1 移到 Layer 2`);
            node.layer = 2;
            
            // 添加从 bestNode 到该节点的连线（如果不存在）
            const existingLink = links.find(l => 
                (getLinkNodeId(l.source) === bestNode.id && getLinkNodeId(l.target) === node.id) ||
                (getLinkNodeId(l.source) === node.id && getLinkNodeId(l.target) === bestNode.id)
            );
            if (!existingLink) {
                links.push({
                    id: `link-auto-${bestNode.id}-${node.id}`,
                    source: bestNode.id,
                    target: node.id,
                    label: '包含'
                });
                console.log(`  添加连线: "${bestNode.label}" -> "${node.label}"`);
            }
        });
    }
    
    // ========================================================================
    // 移除孤立节点（没有任何连线的节点，焦点问题节点除外）
    // ========================================================================
    const connectedNodeIds = new Set();
    links.forEach(link => {
        connectedNodeIds.add(getLinkNodeId(link.source));
        connectedNodeIds.add(getLinkNodeId(link.target));
    });
    
    const isolatedNodes = nodes.filter(n => 
        !connectedNodeIds.has(n.id) && 
        n.id !== 'focus-question-node' && 
        !n.isFocusQuestion
    );
    
    if (isolatedNodes.length > 0) {
        console.log(`convertToConceptMapFormat: 发现 ${isolatedNodes.length} 个孤立节点，将移除`);
        isolatedNodes.forEach(node => {
            console.log(`  移除孤立节点: "${node.label}" (layer=${node.layer})`);
        });
        
        // 过滤掉孤立节点
        const isolatedIds = new Set(isolatedNodes.map(n => n.id));
        const filteredNodes = nodes.filter(n => !isolatedIds.has(n.id));
        nodes.length = 0;
        nodes.push(...filteredNodes);
    }
    
    console.log('convertToConceptMapFormat: 最终节点数:', nodes.length, '连线数:', links.length);
    return { nodes, links, metadata: {} };
}

/**
 * 计算焦点问题匹配度
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

// ============================================================================
// 默认布局
// ============================================================================

function applyDefaultLayout(nodes, links, width, height) {
    const topMargin = 150;
    const layerSpacing = 180;
    
    // 按层级分组
    const layers = new Map();
    nodes.forEach(node => {
        const layer = node.layer || 1;
        if (!layers.has(layer)) {
            layers.set(layer, []);
        }
        layers.get(layer).push(node);
    });
    
    // 分配坐标
    layers.forEach((layerNodes, layer) => {
        const y = topMargin + (layer - 1) * layerSpacing;
        const spacing = width / (layerNodes.length + 1);
        
        layerNodes.forEach((node, i) => {
            node.x = spacing * (i + 1);
            node.y = y;
            
            const dims = calculateNodeDimensions(node.label);
            node.width = dims.width;
            node.height = dims.height;
        });
    });
}

// ============================================================================
// 渲染节点
// ============================================================================

function drawNodes(svg, nodes, topic) {
    console.log('drawNodes: 渲染节点，数量:', nodes.length);
    
    // 调试：输出前几个节点的坐标
    nodes.slice(0, 5).forEach((node, idx) => {
        console.log(`drawNodes: 节点 ${idx}: "${node.label}" 坐标 (${node.x}, ${node.y}) layer=${node.layer}`);
    });
    
    nodes.forEach((node, idx) => {
        // 验证节点数据有效性
        if (!node || typeof node !== 'object') {
            console.warn('drawNodes: 无效节点数据，跳过', idx, node);
            return;
        }
        
        if (!node.id) {
            console.warn('drawNodes: 节点没有ID，跳过', idx, node);
            return;
        }
        
        if (node.x === undefined || node.y === undefined) {
            console.warn('drawNodes: 节点没有坐标，跳过', node.id, node);
            return;
        }
        
        // 确保 label 是有效字符串
        const nodeLabel = (node.label !== undefined && node.label !== null) 
            ? String(node.label) 
            : node.id;
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-node-id', node.id);
        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        
        // 检测是否是焦点问题节点
        const isFocusQuestion = node.isFocusQuestion || node.id === 'focus-question-node';
        
        // 计算节点尺寸
        let dims;
        if (isFocusQuestion) {
            // 焦点问题节点样式 - 固定宽度，大大加长
            // 用户要求：焦点问题框长度设为固定值并且大大加长
            dims = {
                width: 1400, // 固定宽度 1400px，足够容纳很长的文本
                height: 80 // 高度80（与 convertToConceptMapFormat 保持一致）
            };
        } else {
            // 使用 calculateNodeDimensions 计算节点尺寸（确保使用最新的默认值）
            dims = calculateNodeDimensions(nodeLabel);
        }
        // 使用计算的尺寸，并更新到节点数据中（确保连线计算使用正确的尺寸）
        const nodeWidth = dims.width;
        const nodeHeight = dims.height;
        node.width = nodeWidth;
        node.height = nodeHeight;
        const isTopic = nodeLabel === topic;
        const radius = isFocusQuestion ? 10 : 10; // 移植：统一圆角10
        
        // 创建圆角矩形
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -nodeWidth / 2);
        rect.setAttribute('y', -nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('rx', radius);
        rect.setAttribute('ry', radius);
        
        // 焦点问题节点使用特殊样式（移植自 concept-map-new-master）
        if (isFocusQuestion) {
            rect.setAttribute('fill', '#f8f9fa'); // 移植：浅灰色背景
            rect.setAttribute('fill-opacity', '0.9'); // 移植：透明度0.9
            rect.setAttribute('stroke', '#667eea'); // 移植：紫蓝色边框
            rect.setAttribute('stroke-width', '2'); // 移植：边框宽度2
        } else {
            // 使用用户设置的样式，如果没有则使用默认值
            const defaultFill = isTopic ? '#5a4fcf' : '#667eea';
            const defaultStroke = '#fff';
            const defaultStrokeWidth = isTopic ? '3' : '2';
            const defaultOpacity = '0.9';
            
            rect.setAttribute('fill', node.fillColor || defaultFill);
            rect.setAttribute('fill-opacity', node.opacity || defaultOpacity);
            rect.setAttribute('stroke', node.strokeColor || defaultStroke);
            rect.setAttribute('stroke-width', node.strokeWidth || defaultStrokeWidth);
        }
        rect.setAttribute('cursor', isFocusQuestion ? 'move' : 'pointer'); // 移植：拖拽光标
        g.appendChild(rect);
        
        // 创建文字
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        
        // 使用用户设置的文字样式，如果没有则使用默认值
        const defaultFontSize = isFocusQuestion ? '28' : '24';
        const defaultFontWeight = isFocusQuestion ? '600' : '500';
        const defaultTextColor = isFocusQuestion ? '#2c3e50' : 'white';
        const defaultFontFamily = 'Inter, sans-serif';
        
        text.setAttribute('font-size', node.fontSize || defaultFontSize);
        text.setAttribute('font-weight', node.fontWeight || defaultFontWeight);
        text.setAttribute('fill', node.textColor || defaultTextColor);
        text.setAttribute('font-family', node.fontFamily || defaultFontFamily);
        if (node.fontStyle) text.setAttribute('font-style', node.fontStyle);
        if (node.textDecoration) text.setAttribute('text-decoration', node.textDecoration);
        text.setAttribute('pointer-events', 'none');
        text.textContent = nodeLabel;
        g.appendChild(text);
        
        // 保存尺寸到节点
        node.width = nodeWidth;
        node.height = nodeHeight;
        
        svg.appendChild(g);
        
        // 添加拖动监听器
        if (typeof attachDragListeners === 'function') {
            attachDragListeners(g, node.id);
        }
        
        // 添加交互监听器（单击选中、双击编辑）
        if (typeof attachNodeInteractionListeners === 'function') {
            attachNodeInteractionListeners(g, node.id);
        }
    });
}

// ============================================================================
// 聚合连接检测
// ============================================================================

/**
 * 检测聚合连接（相同源节点和相同连接词的连线）
 * 注意：自动聚合功能已禁用，只有手动创建的聚合连接才会显示为聚合样式
 * @param {Array} links - 连线数组
 * @returns {Array} 聚合连接组数组，每个组包含 {sourceId, label, links: [...]}
 */
function detectAggregatedLinks(links) {
    // 禁用自动聚合功能 - 只检测已标记为聚合的连线组
    // 普通连接线不会自动变成聚合连接
    const groups = new Map();
    
    links.forEach(link => {
        // 只有明确标记为聚合连接的才参与聚合
        if (!link.isAggregated) return;
        
        const label = link.label || '双击编辑';
        const sourceId = getLinkNodeId(link.source);
        const key = `${sourceId}_${label}`;
        if (!groups.has(key)) {
            groups.set(key, {
                sourceId: sourceId,
                label: label,
                links: []
            });
        }
        groups.get(key).links.push(link);
    });
    
    // 只返回有2个或更多连线的组（需要聚合）
    const aggregatedGroups = Array.from(groups.values()).filter(group => group.links.length >= 2);
    
    if (aggregatedGroups.length > 0) {
        console.log(`检测到 ${aggregatedGroups.length} 组聚合连接:`, aggregatedGroups.map(g => ({
            sourceId: g.sourceId,
            label: g.label,
            count: g.links.length
        })));
    }
    
    return aggregatedGroups;
}

/**
 * 绘制聚合连接
 * @param {Object} group - 聚合连接组 {sourceId, label, links: [...]}
 * @param {Map} nodeById - 节点Map
 * @param {Array} allNodes - 所有节点数组
 * @param {number} offsetIndex - 同一源节点的聚合组索引（用于偏移计算）
 * @param {number} totalGroups - 同一源节点的聚合组总数
 * @param {Set} mixedSourceIds - 同时有聚合连接和普通连接的源节点ID集合
 */
function drawAggregatedLink(svg, group, nodeById, allNodes, offsetIndex = 0, totalGroups = 1, mixedSourceIds = new Set()) {
    const sourceNode = nodeById.get(group.sourceId);
    if (!sourceNode) {
        console.warn('drawAggregatedLink: 源节点未找到', group.sourceId);
        return;
    }
    
    // 从 group 或其 links 中读取用户自定义的样式
    const firstLink = group.links && group.links[0];
    const userLineColor = group.lineColor || firstLink?.lineColor || '#aaa';
    const userLineWidth = group.lineWidth || firstLink?.lineWidth || '2';
    const userTextColor = group.textColor || firstLink?.textColor || '#333';
    const userFontSize = group.fontSize || firstLink?.fontSize || '24';
    const userFontFamily = group.fontFamily || firstLink?.fontFamily || 'Inter, sans-serif';
    const userFontWeight = group.fontWeight || firstLink?.fontWeight || '500';
    const userFontStyle = group.fontStyle || firstLink?.fontStyle || 'normal';
    const userTextDecoration = group.textDecoration || firstLink?.textDecoration || 'none';
    const userOpacity = group.opacity || firstLink?.opacity || '1';
    
    // 计算源节点尺寸
    const sourceDims = calculateNodeDimensions(sourceNode.label || '');
    const sourceWidth = sourceNode.width || sourceDims.width;
    const sourceHeight = sourceNode.height || sourceDims.height;
    
    // 计算所有目标节点的位置
    const targetNodes = group.links.map(link => {
        const targetId = getLinkNodeId(link.target);
        const target = nodeById.get(targetId);
        if (!target) return null;
        const targetDims = calculateNodeDimensions(target.label || '');
        return {
            node: target,
            link: link,
            width: target.width || targetDims.width,
            height: target.height || targetDims.height
        };
    }).filter(item => item !== null);
    
    if (targetNodes.length === 0) return;
    
    // 计算源节点底部中心点（所有连接线从同一点出发，不偏移）
    const sourceX = sourceNode.x;
    const sourceY = sourceNode.y + sourceHeight / 2;
    
    // 计算目标节点的平均连接点（目标节点顶部中心）
    const avgTargetX = targetNodes.reduce((sum, t) => sum + t.node.x, 0) / targetNodes.length;
    const avgTargetY = targetNodes.reduce((sum, t) => sum + (t.node.y - t.height / 2), 0) / targetNodes.length;
    
    // 计算从源节点到平均目标位置的方向向量
    const dx = avgTargetX - sourceX;
    const dy = avgTargetY - sourceY;
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (totalDistance === 0) return;
    
    const normalizedDx = dx / totalDistance;
    const normalizedDy = dy / totalDistance;
    
    // 标签位置在源节点到平均目标位置的中点
    const labelToSourceDistance = totalDistance / 2;
    const labelX = sourceX + normalizedDx * labelToSourceDistance;
    const labelY = sourceY + normalizedDy * labelToSourceDistance;
    
    // 计算标签宽度，用于确定断开间隙大小
    const labelWidth = Math.max(40, group.label.length * 12);
    const textGap = Math.max(25, labelWidth * 0.6);
    
    // 创建聚合连接组
    const aggregateGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    aggregateGroup.setAttribute('data-aggregate-group', 'true');
    aggregateGroup.setAttribute('data-source-id', group.sourceId);
    aggregateGroup.setAttribute('data-label', group.label);
    const uniqueKey = `${group.sourceId}_${group.label}`;
    aggregateGroup.setAttribute('data-aggregate-key', uniqueKey);
    
    // 绘制主连接线（从源节点到标签位置前断开）
    const mainLineEndDistance = Math.max(0, labelToSourceDistance - textGap / 2);
    const mainLineEndX = sourceX + normalizedDx * mainLineEndDistance;
    const mainLineEndY = sourceY + normalizedDy * mainLineEndDistance;
    
    const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    mainLine.setAttribute('x1', sourceX);
    mainLine.setAttribute('y1', sourceY);
    mainLine.setAttribute('x2', mainLineEndX);
    mainLine.setAttribute('y2', mainLineEndY);
    mainLine.setAttribute('stroke', userLineColor);
    mainLine.setAttribute('stroke-width', userLineWidth);
    mainLine.setAttribute('fill', 'none');
    mainLine.setAttribute('stroke-linecap', 'round');
    mainLine.setAttribute('opacity', userOpacity);
    // 保存用户样式以便后续恢复
    mainLine.setAttribute('data-user-color', userLineColor);
    mainLine.setAttribute('data-user-width', userLineWidth);
    mainLine.setAttribute('data-user-opacity', userOpacity);
    aggregateGroup.appendChild(mainLine);
    
    // 添加连接词标签
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', labelX);
    labelText.setAttribute('y', labelY + 4);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('font-size', userFontSize);
    labelText.setAttribute('fill', userTextColor);
    labelText.setAttribute('font-weight', userFontWeight);
    labelText.setAttribute('font-family', userFontFamily);
    labelText.setAttribute('font-style', userFontStyle);
    labelText.setAttribute('text-decoration', userTextDecoration);
    labelText.setAttribute('opacity', userOpacity);
    labelText.setAttribute('pointer-events', 'all');
    labelText.setAttribute('cursor', 'pointer');
    labelText.setAttribute('data-aggregate-label', 'true');
    labelText.setAttribute('data-aggregate-key', uniqueKey);
    // 保存用户样式以便后续恢复
    labelText.setAttribute('data-user-text-color', userTextColor);
    labelText.textContent = group.label;
    
    // 添加双击编辑事件监听器
    labelText.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        editAggregateLinkLabel(group);
    });
    
    // 添加单击选中事件监听器
    labelText.addEventListener('click', function(e) {
        e.stopPropagation();
        selectAggregateLink(uniqueKey, group);
    });
    
    aggregateGroup.appendChild(labelText);
    
    // 为聚合组添加单击选中事件
    aggregateGroup.addEventListener('click', function(e) {
        e.stopPropagation();
        selectAggregateLink(uniqueKey, group);
    });
    
    // 分支连接线从标签位置后开始
    const branchStartDistance = labelToSourceDistance + textGap / 2;
    const branchStartX = sourceX + normalizedDx * branchStartDistance;
    const branchStartY = sourceY + normalizedDy * branchStartDistance;
    
    // 绘制分支连接线（从标签位置后到每个目标节点）
    targetNodes.forEach(({ node: target, link, width, height }) => {
        const targetX = target.x;
        const targetY = target.y - height / 2;
        
        // 计算从分支起点到目标节点的方向
        const branchDx = targetX - branchStartX;
        const branchDy = targetY - branchStartY;
        const branchLength = Math.sqrt(branchDx * branchDx + branchDy * branchDy);
        
        if (branchLength === 0) return;
        
        // 创建分支线（完整的线，不断开）
        const branchLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        branchLine.setAttribute('x1', branchStartX);
        branchLine.setAttribute('y1', branchStartY);
        branchLine.setAttribute('x2', targetX);
        branchLine.setAttribute('y2', targetY);
        branchLine.setAttribute('stroke', userLineColor);
        branchLine.setAttribute('stroke-width', userLineWidth);
        branchLine.setAttribute('fill', 'none');
        branchLine.setAttribute('stroke-linecap', 'round');
        branchLine.setAttribute('opacity', userOpacity);
        branchLine.setAttribute('data-link-id', link.id);
        // 保存用户样式以便后续恢复
        branchLine.setAttribute('data-user-color', userLineColor);
        branchLine.setAttribute('data-user-width', userLineWidth);
        branchLine.setAttribute('data-user-opacity', userOpacity);
        branchLine.style.cursor = 'pointer';
        aggregateGroup.appendChild(branchLine);
        
        // 绘制箭头（在分支线末端）
        const arrowLength = 8;
        const arrowOffset = arrowLength / branchLength;
        const arrowX = targetX - branchDx * arrowOffset;
        const arrowY = targetY - branchDy * arrowOffset;
        
        const angle = Math.atan2(branchDy, branchDx);
        const arrowAngle1 = angle + Math.PI / 8;
        const arrowAngle2 = angle - Math.PI / 8;
        
        const arrowPoint1X = arrowX - arrowLength * Math.cos(arrowAngle1);
        const arrowPoint1Y = arrowY - arrowLength * Math.sin(arrowAngle1);
        const arrowPoint2X = arrowX - arrowLength * Math.cos(arrowAngle2);
        const arrowPoint2Y = arrowY - arrowLength * Math.sin(arrowAngle2);
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', `M ${arrowX} ${arrowY} L ${arrowPoint1X} ${arrowPoint1Y} L ${arrowPoint2X} ${arrowPoint2Y} Z`);
        arrow.setAttribute('fill', userLineColor);
        arrow.setAttribute('stroke', userLineColor);
        arrow.setAttribute('stroke-width', '1');
        arrow.setAttribute('opacity', userOpacity);
        arrow.setAttribute('data-link-id', link.id);
        // 保存用户样式以便后续恢复
        arrow.setAttribute('data-user-color', userLineColor);
        arrow.setAttribute('data-user-opacity', userOpacity);
        arrow.style.cursor = 'pointer';
        aggregateGroup.appendChild(arrow);
    });
    
    // 确定正确的容器添加聚合连接
    // 传入的 svg 参数可能是 svg 元素本身，也可能是 zoom-group（在 updateConnectedLinks 调用时）
    let container;
    if (svg.classList && svg.classList.contains('zoom-group')) {
        // 传入的已经是 zoom-group
        container = svg;
    } else {
        // 传入的是 svg，需要找到 zoom-group
        const zoomGroup = svg.querySelector('g.zoom-group');
        container = zoomGroup || svg;
    }
    
    // 找到第一个节点组，将聚合连接插入到节点之前（连接线在节点下方）
    const firstNodeGroup = container.querySelector('g[data-node-id]');
    if (firstNodeGroup && firstNodeGroup.parentNode === container) {
        container.insertBefore(aggregateGroup, firstNodeGroup);
    } else {
        container.appendChild(aggregateGroup);
    }
    console.log(`drawAggregatedLink: 绘制聚合连接 "${group.label}" (${targetNodes.length}个分支)`);
}

// ============================================================================
// 标签位置优化（避免连接词重叠）
// ============================================================================

/**
 * 检测两个矩形是否重叠
 */
function rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1);
}

/**
 * 计算标签与其他元素的重叠程度
 */
function calculateLabelOverlap(labelX, labelY, labelWidth, labelHeight, nodes, links, currentLinkId) {
    let overlap = 0;
    
    // 检查与节点的重叠
    nodes.forEach(node => {
        const nodeWidth = node.width || 220;
        const nodeHeight = node.height || 85;
        
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
            const otherLabelWidth = Math.max(60, (link.label || '双击编辑').length * 10);
            const otherLabelHeight = 18;
            
            if (rectanglesOverlap(
                labelX - labelWidth/2, labelY - labelHeight/2, labelWidth, labelHeight,
                link.labelX - otherLabelWidth/2, link.labelY - otherLabelHeight/2, otherLabelWidth, otherLabelHeight
            )) {
                overlap += 50; // 与其他标签重叠惩罚
            }
        }
    });
    
    return overlap;
}

/**
 * 优化文字标签位置，避免重叠
 */
function optimizeLabelPositions(nodes, links) {
    console.log('optimizeLabelPositions: 优化标签位置...');
    
    // 为每个连线计算最佳标签位置
    links.forEach(link => {
        const sourceId = getLinkNodeId(link.source);
        const targetId = getLinkNodeId(link.target);
        const source = nodes.find(n => n.id === sourceId);
        const target = nodes.find(n => n.id === targetId);
        
        if (!source || !target) return;
        
        // 计算连线中点
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        
        // 计算标签尺寸
        const labelWidth = Math.max(60, (link.label || '双击编辑').length * 10);
        const labelHeight = 18;
        
        // 检查标签是否与其他元素重叠
        let bestOffset = { x: 0, y: 0 };
        let minOverlap = Infinity;
        
        // 尝试不同的偏移位置
        const offsets = [
            { x: 0, y: 0 },
            { x: 12, y: 0 },
            { x: -12, y: 0 },
            { x: 0, y: 12 },
            { x: 0, y: -12 },
            { x: 12, y: 10 },
            { x: -12, y: -10 },
            { x: 12, y: -10 },
            { x: -12, y: 10 }
        ];
        
        offsets.forEach(offset => {
            const overlapScore = calculateLabelOverlap(
                midX + offset.x, midY + offset.y,
                labelWidth, labelHeight,
                nodes, links, link.id
            );
            
            if (overlapScore < minOverlap) {
                minOverlap = overlapScore;
                bestOffset = offset;
            }
        });
        
        // 存储最佳标签位置
        link.labelX = midX + bestOffset.x;
        link.labelY = midY + bestOffset.y;
    });
    
    console.log('optimizeLabelPositions: 标签位置优化完成');
}

// ============================================================================
// 渲染连线
// ============================================================================

function drawLinks(svg, nodes, links, topic) {
    console.log('drawLinks: 渲染连线，原始数量:', links.length);
    
    // 🔴🔴🔴 移植自 concept-map-new-master：禁止生成到焦点问题框的连接线
    // 焦点问题框应该是独立的 UI 元素，不参与图的连接关系
    const filteredLinks = links.filter(link => {
        const targetId = getLinkNodeId(link.target);
        const sourceId = getLinkNodeId(link.source);
        // 过滤掉目标是焦点问题节点的连接线
        if (targetId === 'focus-question-node') {
            console.log(`drawLinks: 过滤掉指向焦点问题框的连接线: ${sourceId} -> ${targetId}`);
            return false;
        }
        // 过滤掉源是焦点问题节点的连接线（焦点问题框不应该有任何连接）
        if (sourceId === 'focus-question-node') {
            console.log(`drawLinks: 过滤掉从焦点问题框出发的连接线: ${sourceId} -> ${targetId}`);
            return false;
        }
        return true;
    });
    console.log(`drawLinks: 过滤后连线数量: ${filteredLinks.length}（过滤了 ${links.length - filteredLinks.length} 条指向/来自焦点问题框的连线）`);
    
    // 调试：输出前3个节点的坐标
    console.log('drawLinks: 节点坐标检查（前3个）:');
    nodes.slice(0, 3).forEach((node, idx) => {
        console.log(`  drawLinks 节点${idx}: "${node.label}" x=${node.x}, y=${node.y}`);
    });
    
    // 创建节点映射
    const nodeById = new Map();
    nodes.forEach(node => {
        if (node && node.id) {
            nodeById.set(node.id, node);
        }
    });
    
    // 清理旧的聚合连接，避免重复渲染导致多个连接词
    const oldAggregateGroups = svg.querySelectorAll('g[data-aggregate-group="true"]');
    oldAggregateGroups.forEach(g => g.remove());
    
    // 检测聚合连接（使用过滤后的连线）
    const aggregatedLinks = detectAggregatedLinks(filteredLinks);
    
    // 创建已聚合连线的ID集合与源-目标对集合
    const aggregatedLinkIds = new Set();
    const aggregatedPairs = new Set(); // key: `${sourceId}->${targetId}`
    aggregatedLinks.forEach(group => {
        group.links.forEach(link => {
            aggregatedLinkIds.add(link.id);
            const s = getLinkNodeId(link.source);
            const t = getLinkNodeId(link.target);
            aggregatedPairs.add(`${s}->${t}`);
        });
    });
    
    // 🔴 预先检测哪些源节点同时有聚合连接和普通连接（用于聚合连接偏左）
    const tempRegularLinks = filteredLinks.filter(link => {
        if (aggregatedLinkIds.has(link.id)) return false;
        const s = getLinkNodeId(link.source);
        const t = getLinkNodeId(link.target);
        if (aggregatedPairs.has(`${s}->${t}`)) return false;
        return true;
    });
    const aggregatedSourceIds = new Set(aggregatedLinks.map(g => g.sourceId));
    const regularSourceIds = new Set(tempRegularLinks.map(link => getLinkNodeId(link.source)));
    const mixedSourceIds = new Set([...aggregatedSourceIds].filter(id => regularSourceIds.has(id)));
    
    // 先绘制聚合连接（处理同一源节点有多个聚合组的情况，添加偏移避免重叠）
    // 按源节点分组，计算每个源节点有多少个聚合组
    const sourceGroupCount = new Map();
    aggregatedLinks.forEach(group => {
        const count = sourceGroupCount.get(group.sourceId) || 0;
        sourceGroupCount.set(group.sourceId, count + 1);
    });
    
    // 记录每个源节点当前的索引
    const sourceGroupIndex = new Map();
    aggregatedLinks.forEach(group => {
        const currentIndex = sourceGroupIndex.get(group.sourceId) || 0;
        const totalGroups = sourceGroupCount.get(group.sourceId) || 1;
        
        // 绘制聚合连接，传入索引、总数和混合连接信息
        drawAggregatedLink(svg, group, nodeById, nodes, currentIndex, totalGroups, mixedSourceIds);
        
        // 更新索引
        sourceGroupIndex.set(group.sourceId, currentIndex + 1);
    });
    
    // 过滤掉已聚合的连线（使用过滤后的连线列表）
    const regularLinks = filteredLinks.filter(link => {
        if (aggregatedLinkIds.has(link.id)) return false;
        const s = getLinkNodeId(link.source);
        const t = getLinkNodeId(link.target);
        // 如果存在同源同目标的聚合连接，优先聚合，跳过普通连线
        if (aggregatedPairs.has(`${s}->${t}`)) return false;
        return true;
    });
    console.log(`drawLinks: 普通连线 ${regularLinks.length} 条，聚合连接组 ${aggregatedLinks.length} 组`);
    console.log(`drawLinks: 检测到 ${mixedSourceIds.size} 个源节点同时有聚合连接和普通连接:`, [...mixedSourceIds]);
    
    // 渲染普通连线
    regularLinks.forEach((link, idx) => {
        // 兼容 source/target 可能是字符串ID或对象引用
        const sourceId = getLinkNodeId(link.source);
        const targetId = getLinkNodeId(link.target);
        
        const source = nodeById.get(sourceId);
        const target = nodeById.get(targetId);
        
        if (!source || !target) {
            console.warn('drawLinks: 找不到源或目标节点', { sourceId, targetId, link });
                return;
            }
            
        if (source.x === undefined || target.x === undefined) {
            console.warn('drawLinks: 节点没有坐标', { source, target });
            return;
        }
        
        // 计算节点尺寸
        const sourceWidth = source.width || calculateNodeDimensions(source.label).width;
        const sourceHeight = source.height || calculateNodeDimensions(source.label).height;
        const targetWidth = target.width || calculateNodeDimensions(target.label).width;
        const targetHeight = target.height || calculateNodeDimensions(target.label).height;
        
        // 判断是否是同级连接
        const isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
        
        // 计算连接点：选择两个节点上下边中点中距离最近的两个
        // 同级连接强制使用下方中点到下方中点
        const sourceWithDims = { x: source.x, y: source.y, width: sourceWidth, height: sourceHeight, layer: source.layer };
        const targetWithDims = { x: target.x, y: target.y, width: targetWidth, height: targetHeight, layer: target.layer };
        const { startX, startY, endX, endY } = calculateNearestEdgeConnection(sourceWithDims, targetWithDims, isSameLayer);
        
        // 创建连线组
        const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        lineGroup.setAttribute('data-link-id', link.id);
        
        // 计算路径（使用折线路径计算，检测重叠并避开）
        let pathData = calculatePolylinePath(link, nodes, links);
        
        // 如果 calculatePolylinePath 返回 null，使用默认路径
        // 手动创建的连线始终使用直线，不使用曲线
        if (!pathData) {
            if (link.isManuallyCreated) {
                // 手动创建的连线始终使用直线
                pathData = {
                    isCurved: false,
                    isPolyline: false,
                    path: `M ${startX} ${startY} L ${endX} ${endY}`,
                    waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
                };
            } else if (isSameLayer) {
                pathData = calculateCurvedPath(startX, startY, endX, endY);
            } else {
                pathData = {
                    isCurved: false,
                    isPolyline: false,
                    path: `M ${startX} ${startY} L ${endX} ${endY}`,
                    waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
                };
            }
        }
        
        // 计算断开间隙和标签位置（同级曲线需要放在断开的正中央）
        const labelText = link.label || '双击编辑';
        const textWidth = Math.max(40, labelText.length * 10);
        const textGap = Math.max(20, textWidth * 0.6);
        let arcLength; // 供曲线分支后续复用
        
        // 计算标签位置（严格位于连线断开的中点）
        let midX, midY;
        if (pathData.isCurved && pathData.controlPoint) {
            // 对于曲线，直接按照“断开处中心”定位
            arcLength = estimateQuadraticBezierLength(startX, startY, pathData.controlPoint.x, pathData.controlPoint.y, endX, endY);
            const gapStart = (arcLength - textGap) / 2;
            const gapCenter = gapStart + textGap / 2;
            
            // 采样寻找曲线上指定弧长位置的坐标
            const steps = 100;
            let accumulated = 0;
            let prevX = startX, prevY = startY;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const invT = 1 - t;
                const curX = invT * invT * startX + 2 * invT * t * pathData.controlPoint.x + t * t * endX;
                const curY = invT * invT * startY + 2 * invT * t * pathData.controlPoint.y + t * t * endY;
                const segLen = Math.sqrt(Math.pow(curX - prevX, 2) + Math.pow(curY - prevY, 2));
                
                if (accumulated + segLen >= gapCenter) {
                    const ratio = (gapCenter - accumulated) / segLen;
                    midX = prevX + (curX - prevX) * ratio;
                    midY = prevY + (curY - prevY) * ratio;
                    break;
                }
                
                accumulated += segLen;
                prevX = curX;
                prevY = curY;
            }
            
            // 若采样未命中，回退到曲线终点（极少发生）
            if (midX === undefined) {
                midX = endX;
                midY = endY;
            }
        } else if (pathData.isPolyline && pathData.waypoints && pathData.waypoints.length >= 3) {
            // 折线：找到总弧长中点位置
            let totalLength = 0;
            const segmentLengths = [];
            for (let i = 1; i < pathData.waypoints.length; i++) {
                const wp1 = pathData.waypoints[i - 1];
                const wp2 = pathData.waypoints[i];
                const segLen = Math.sqrt(Math.pow(wp2.x - wp1.x, 2) + Math.pow(wp2.y - wp1.y, 2));
                segmentLengths.push(segLen);
                totalLength += segLen;
            }
            
            const targetLength = totalLength / 2;
            let accumulatedLength = 0;
            
            for (let i = 0; i < segmentLengths.length; i++) {
                if (accumulatedLength + segmentLengths[i] >= targetLength) {
                    // 标签在这一段上
                    const wp1 = pathData.waypoints[i];
                    const wp2 = pathData.waypoints[i + 1];
                    const remainingLength = targetLength - accumulatedLength;
                    const ratio = remainingLength / segmentLengths[i];
                    midX = wp1.x + (wp2.x - wp1.x) * ratio;
                    midY = wp1.y + (wp2.y - wp1.y) * ratio;
                    break;
                }
                accumulatedLength += segmentLengths[i];
            }
            
            // 如果没找到（理论上不会发生），使用几何中点
            if (midX === undefined) {
                const midPointIndex = Math.floor(pathData.waypoints.length / 2);
                const wp1 = pathData.waypoints[midPointIndex - 1];
                const wp2 = pathData.waypoints[midPointIndex];
                midX = (wp1.x + wp2.x) / 2;
                midY = (wp1.y + wp2.y) / 2;
            }
        } else {
            // 直线：几何中点就是弧长中点
            midX = (startX + endX) / 2;
            midY = (startY + endY) / 2;
        }
        
        // 计算连线长度和断开位置
        const totalLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        
        // 从 link 数据中读取用户自定义的样式
        const userLineColor = link.lineColor || '#aaa';
        const userLineWidth = link.lineWidth || '2';
        const userOpacity = link.opacity || '1';
        
        // 绘制路径（中间断开放连接词）
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', pathData.path);
        line.setAttribute('stroke', userLineColor);
        line.setAttribute('stroke-width', userLineWidth);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');
        line.setAttribute('opacity', userOpacity);
        // 保存用户样式以便后续恢复
        line.setAttribute('data-user-color', userLineColor);
        line.setAttribute('data-user-width', userLineWidth);
        line.setAttribute('data-user-opacity', userOpacity);
        
        // 设置断开模式（只有当连线足够长时才断开，用于显示标签）
        if (pathData.isCurved && pathData.controlPoint) {
            // 曲线：使用曲线长度计算断开
            const arcLen = arcLength !== undefined ? arcLength : estimateQuadraticBezierLength(startX, startY, pathData.controlPoint.x, pathData.controlPoint.y, endX, endY);
            if (arcLen > textGap * 2) {
                const curveGapStart = (arcLen - textGap) / 2;
                line.setAttribute('stroke-dasharray', `${curveGapStart} ${textGap} ${arcLen - curveGapStart - textGap}`);
            }
        } else if (pathData.isPolyline && pathData.waypoints && pathData.waypoints.length >= 3) {
            // 折线：计算整条折线的总长度
            let polylineLength = 0;
            for (let i = 1; i < pathData.waypoints.length; i++) {
                const wp1 = pathData.waypoints[i - 1];
                const wp2 = pathData.waypoints[i];
                polylineLength += Math.sqrt(Math.pow(wp2.x - wp1.x, 2) + Math.pow(wp2.y - wp1.y, 2));
            }
            if (polylineLength > textGap * 2) {
                const gapStart = (polylineLength - textGap) / 2;
                line.setAttribute('stroke-dasharray', `${gapStart} ${textGap} ${polylineLength - gapStart - textGap}`);
            }
        } else {
            // 直线：使用直线长度，只有足够长时才断开
            if (totalLength > textGap * 2) {
                const gapStart = (totalLength - textGap) / 2;
                line.setAttribute('stroke-dasharray', `${gapStart} ${textGap} ${totalLength - gapStart - textGap}`);
            }
        }
        
        lineGroup.appendChild(line);
        
        // 绘制箭头（根据路径类型计算方向）
        const arrowLength = 8;
        let arrowAngle;
        
        if (pathData.isCurved && pathData.controlPoint) {
            // 曲线：计算曲线末端的切线方向
            const tangentX = 2 * (1 - 0.99) * (pathData.controlPoint.x - startX) + 2 * 0.99 * (endX - pathData.controlPoint.x);
            const tangentY = 2 * (1 - 0.99) * (pathData.controlPoint.y - startY) + 2 * 0.99 * (endY - pathData.controlPoint.y);
            arrowAngle = Math.atan2(tangentY, tangentX);
        } else if (pathData.isPolyline && pathData.waypoints && pathData.waypoints.length >= 2) {
            // 折线：使用最后一段线的方向
            const lastPoint = pathData.waypoints[pathData.waypoints.length - 1];
            const secondLastPoint = pathData.waypoints[pathData.waypoints.length - 2];
            arrowAngle = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
        } else {
            // 直线
            arrowAngle = Math.atan2(endY - startY, endX - startX);
        }
        
        const arrowAngle1 = arrowAngle + Math.PI / 8;
        const arrowAngle2 = arrowAngle - Math.PI / 8;
        
        const arrowPoint1X = endX - arrowLength * Math.cos(arrowAngle1);
        const arrowPoint1Y = endY - arrowLength * Math.sin(arrowAngle1);
        const arrowPoint2X = endX - arrowLength * Math.cos(arrowAngle2);
        const arrowPoint2Y = endY - arrowLength * Math.sin(arrowAngle2);
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', `M ${endX} ${endY} L ${arrowPoint1X} ${arrowPoint1Y} L ${arrowPoint2X} ${arrowPoint2Y} Z`);
        arrow.setAttribute('fill', userLineColor);
        arrow.setAttribute('stroke', userLineColor);
        arrow.setAttribute('stroke-width', '1');
        arrow.setAttribute('opacity', userOpacity);
        // 保存用户样式以便后续恢复
        arrow.setAttribute('data-user-color', userLineColor);
        arrow.setAttribute('data-user-opacity', userOpacity);
        lineGroup.appendChild(arrow);
        
        // 从 link 数据中读取用户自定义的文字样式
        const userTextColor = link.textColor || '#333';
        const userFontSize = link.fontSize || '24';
        const userFontFamily = link.fontFamily || 'Inter, sans-serif';
        const userFontWeight = link.fontWeight || '500';
        const userFontStyle = link.fontStyle || 'normal';
        const userTextDecoration = link.textDecoration || 'none';
        
        // 添加连线标签（直接放在中间断开处，不需要背景）
        const linkLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        linkLabel.setAttribute('x', midX);
        linkLabel.setAttribute('y', midY + 4);
        linkLabel.setAttribute('text-anchor', 'middle');
        linkLabel.setAttribute('font-size', userFontSize);
        linkLabel.setAttribute('fill', userTextColor);
        linkLabel.setAttribute('font-weight', userFontWeight);
        linkLabel.setAttribute('font-family', userFontFamily);
        linkLabel.setAttribute('font-style', userFontStyle);
        linkLabel.setAttribute('text-decoration', userTextDecoration);
        linkLabel.setAttribute('opacity', userOpacity);
        linkLabel.setAttribute('data-link-id', link.id);
        linkLabel.setAttribute('data-link-label', 'true');
        linkLabel.setAttribute('pointer-events', 'all');
        linkLabel.setAttribute('cursor', 'pointer');
        // 保存用户样式以便后续恢复
        linkLabel.setAttribute('data-user-text-color', userTextColor);
        linkLabel.textContent = labelText;
        lineGroup.appendChild(linkLabel);
        
        // 连线标签双击编辑
        linkLabel.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            editLinkLabel(link.id);
        });
        
        // 连线组单击选中
        lineGroup.addEventListener('click', function(e) {
            e.stopPropagation();
            selectLink(link.id);
        });
        
        // 设置连线组样式
        lineGroup.style.cursor = 'pointer';
        
        // 找到合适的容器添加连线（考虑 zoom-group 的情况）
        const zoomGroup = svg.querySelector('g.zoom-group');
        const container = zoomGroup || svg;
        
        // 找到第一个节点组，将连线插入到节点之前（连线在节点下方）
        const firstNodeGroup = container.querySelector('g[data-node-id]');
        if (firstNodeGroup && firstNodeGroup.parentNode === container) {
            container.insertBefore(lineGroup, firstNodeGroup);
        } else {
            container.appendChild(lineGroup);
        }
    });
}

/**
 * 估算二次贝塞尔曲线长度
 */
function estimateQuadraticBezierLength(x0, y0, cx, cy, x1, y1) {
    // 使用分段逼近法估算曲线长度
    const segments = 10;
    let length = 0;
    let prevX = x0;
    let prevY = y0;
    
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const invT = 1 - t;
        
        // 二次贝塞尔曲线公式
        const x = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
        const y = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;
        
        length += Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2));
        prevX = x;
        prevY = y;
    }
    
    return length;
}

/**
 * 估算三次贝塞尔曲线长度
 */
function estimateCubicBezierLength(x0, y0, cx1, cy1, cx2, cy2, x1, y1) {
    // 使用分段逼近法估算曲线长度
    const segments = 20;
    let length = 0;
    let prevX = x0;
    let prevY = y0;
    
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const t1 = 1 - t;
        
        // 三次贝塞尔曲线公式
        // B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
        const x = t1*t1*t1*x0 + 3*t1*t1*t*cx1 + 3*t1*t*t*cx2 + t*t*t*x1;
        const y = t1*t1*t1*y0 + 3*t1*t1*t*cy1 + 3*t1*t*t*cy2 + t*t*t*y1;
        
        length += Math.sqrt(Math.pow(x - prevX, 2) + Math.pow(y - prevY, 2));
        prevX = x;
        prevY = y;
    }
    
    return length;
}

/**
 * 计算曲线路径
 */
function calculateCurvedPath(startX, startY, endX, endY) {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 垂直方向
    const perpX = -dy / distance;
    const perpY = dx / distance;
    
    // 曲率
    const curvature = Math.min(distance * 0.5, 100);
    
    // 向下弯曲
    const maxY = Math.max(startY, endY);
    let controlY = midY + Math.abs(perpY) * curvature;
    if (controlY <= maxY) {
        controlY = maxY + 60;
    }
    const controlX = midX;
    
    return {
        isCurved: true,
        isPolyline: false,
        path: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
        waypoints: [
            { x: startX, y: startY },
            { x: controlX, y: controlY },
            { x: endX, y: endY }
        ],
        controlPoint: { x: controlX, y: controlY }
    };
}

// ============================================================================
// 连线重叠检测和折线路径计算（移植自 concept-map-new-master）
// ============================================================================

/**
 * 检测连接线是否与节点重叠
 * @param {Object} link - 连线对象
 * @param {Array} nodes - 节点数组
 * @returns {Object} 重叠检测结果
 */
function hasLinkNodeOverlap(link, nodes) {
    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    
    if (!source || !target) return { hasOverlap: false };
    
    const sourceWidth = source.width || 220;
    const sourceHeight = source.height || 85;
    const targetWidth = target.width || 220;
    const targetHeight = target.height || 85;
    
    // 判断是否是同级连接
    const isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
    
    // 计算连接点：选择两个节点上下边中点中距离最近的两个
    // 同级连接强制使用下方中点到下方中点
    const sourceWithDims = { x: source.x, y: source.y, width: sourceWidth, height: sourceHeight, layer: source.layer };
    const targetWithDims = { x: target.x, y: target.y, width: targetWidth, height: targetHeight, layer: target.layer };
    const { startX, startY, endX, endY } = calculateNearestEdgeConnection(sourceWithDims, targetWithDims, isSameLayer);
    
    // 检查连接线是否与其他节点重叠
    for (const node of nodes) {
        if (node.id === sourceId || node.id === targetId) continue;
        
        const nodeWidth = node.width || 220;
        const nodeHeight = node.height || 85;
        
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
 */
function pointInRect(px, py, rectX, rectY, rectWidth, rectHeight) {
    return px >= rectX && px <= rectX + rectWidth && 
           py >= rectY && py <= rectY + rectHeight;
}

/**
 * 线段相交检测
 */
function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * 计算折线路径点，避开重叠的节点
 * @param {Object} link - 连线对象
 * @param {Array} nodes - 节点数组
 * @param {Array} allLinks - 所有连线数组
 * @returns {Object} 路径数据
 */
function calculatePolylinePath(link, nodes, allLinks = null) {
    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    
    if (!source || !target) return null;
    
    const sourceWidth = source.width || 220;
    const sourceHeight = source.height || 85;
    const targetWidth = target.width || 220;
    const targetHeight = target.height || 85;
    
    // 判断是否是同层连接（用于决定是否使用曲线和连接点）
    const isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
    
    // 计算连接点：选择两个节点上下边中点中距离最近的两个
    // 同级连接强制使用下方中点到下方中点
    const sourceWithDims = { x: source.x, y: source.y, width: sourceWidth, height: sourceHeight, layer: source.layer };
    const targetWithDims = { x: target.x, y: target.y, width: targetWidth, height: targetHeight, layer: target.layer };
    const { startX, startY, endX, endY } = calculateNearestEdgeConnection(sourceWithDims, targetWithDims, isSameLayer);
    
    // 手动创建的连线始终使用直线，不使用曲线
    if (link.isManuallyCreated) {
        return {
            isPolyline: false,
            isCurved: false,
            path: `M ${startX} ${startY} L ${endX} ${endY}`,
            waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
        };
    }
    
    if (isSameLayer) {
        // 同级连接使用曲线（从下方中点到下方中点）
        return calculateCurvedPath(startX, startY, endX, endY);
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
 * 计算折线的路径点
 */
function calculateWaypoints(startX, startY, endX, endY, nodes, link) {
    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    
    const waypoints = [{ x: startX, y: startY }];
    
    // 获取所有可能重叠的节点
    const overlappingNodes = [];
    for (const node of nodes) {
        if (node.id === sourceId || node.id === targetId) continue;
        
        const nodeWidth = node.width || 220;
        const nodeHeight = node.height || 85;
        
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
        waypoints.push({ x: endX, y: endY });
        return waypoints;
    }
    
    // 按距离起点的远近排序重叠节点
    overlappingNodes.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.x - startX, 2) + Math.pow(a.y - startY, 2));
        const distB = Math.sqrt(Math.pow(b.x - startX, 2) + Math.pow(b.y - startY, 2));
        return distA - distB;
    });
    
    // 只处理第一个重叠节点，创建折线
    const overlapNode = overlappingNodes[0];
    
    const detourPoint = calculateSingleDetourPoint(
        startX, startY, endX, endY, 
        overlapNode.x, overlapNode.y, 
        overlapNode.width, overlapNode.height
    );
    
    if (detourPoint) {
        waypoints.push(detourPoint);
    }
    
    waypoints.push({ x: endX, y: endY });
    
    return waypoints;
}

/**
 * 计算单个绕行点
 */
function calculateSingleDetourPoint(startX, startY, endX, endY, 
                                  nodeX, nodeY, nodeWidth, nodeHeight) {
    const nodeLeft = nodeX - nodeWidth / 2;
    const nodeRight = nodeX + nodeWidth / 2;
    const nodeTop = nodeY - nodeHeight / 2;
    const nodeBottom = nodeY + nodeHeight / 2;
    
    const dx = endX - startX;
    const dy = endY - startY;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    const detourDistance = 60;
    
    if (isHorizontal) {
        // 水平连线，垂直绕行
        if (dx > 0) {
            if (startX < nodeLeft && endX > nodeRight) {
                const detourY = nodeBottom + detourDistance;
                const totalDistance = endX - startX;
                const detourX = startX + totalDistance * 0.5;
                return { x: detourX, y: detourY };
            }
        } else {
            if (startX > nodeRight && endX < nodeLeft) {
                const detourY = nodeBottom + detourDistance;
                const totalDistance = startX - endX;
                const detourX = endX + totalDistance * 0.5;
                return { x: detourX, y: detourY };
            }
        }
    } else {
        // 垂直连线，水平绕行
        if (dy > 0) {
            if (startY < nodeTop && endY > nodeBottom) {
                const detourX1 = nodeLeft - detourDistance;
                const detourX2 = nodeRight + detourDistance;
                
                const distLeft = Math.abs(startX - detourX1) + Math.abs(endX - detourX1);
                const distRight = Math.abs(startX - detourX2) + Math.abs(endX - detourX2);
                
                const detourX = distLeft < distRight ? detourX1 : detourX2;
                const totalDistance = endY - startY;
                const detourY = startY + totalDistance * 0.5;
                
                return { x: detourX, y: detourY };
            }
        } else {
            if (startY > nodeBottom && endY < nodeTop) {
                const detourX1 = nodeLeft - detourDistance;
                const detourX2 = nodeRight + detourDistance;
                
                const distLeft = Math.abs(startX - detourX1) + Math.abs(endX - detourX1);
                const distRight = Math.abs(startX - detourX2) + Math.abs(endX - detourX2);
                
                const detourX = distLeft < distRight ? detourX1 : detourX2;
                const detourY = nodeBottom + detourDistance;
                
                return { x: detourX, y: detourY };
            }
        }
    }
    
    return null;
}

// ============================================================================
// 显示焦点问题（已整合到 drawNodes 中，此函数仅用于兼容性）
// ============================================================================

function displayFocusQuestion(svg, width) {
    // 焦点问题节点现在通过 convertToConceptMapFormat 添加到节点数组
    // 并通过 drawNodes 渲染，此函数保留用于兼容性
    console.log('ConceptMap: displayFocusQuestion 已调用（焦点问题节点通过 drawNodes 渲染）');
}

// ============================================================================
// 节点拖动功能
// ============================================================================

// 拖动状态
let isDragging = false;
let selectedNodeId = null;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginalNodeX = 0;
let dragOriginalNodeY = 0;
let currentGraphData = null; // 存储当前图数据

/**
 * 开始拖动节点
 */
function startDrag(nodeId, clientX, clientY) {
    if (!currentGraphData || !currentGraphData.nodes) return;
    
    const node = currentGraphData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // 设置拖动状态
    isDragging = true;
    selectedNodeId = nodeId;
    dragStartX = clientX;
    dragStartY = clientY;
    dragOriginalNodeX = node.x;
    dragOriginalNodeY = node.y;
    
    // 选中节点样式
    const nodeGroup = document.querySelector(`g[data-node-id="${nodeId}"]`);
    if (nodeGroup) {
        nodeGroup.style.cursor = 'grabbing';
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            rect.setAttribute('fill-opacity', '0.7');
            rect.setAttribute('stroke-width', '4');
        }
    }
    
    // 添加全局拖动事件监听器
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    
    // 防止文本选择
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    
    console.log(`ConceptMap: 开始拖动节点 "${node.label}"`);
}

/**
 * 处理拖动
 */
function handleDrag(e) {
    if (!isDragging || !selectedNodeId || !currentGraphData) return;
    
    const node = currentGraphData.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    
    // 获取SVG变换信息
    const svg = document.querySelector('#d3-container svg');
    if (!svg) return;
    
    // 计算缩放比例
    let scale = 1;
    const zoomGroup = svg.querySelector('g.zoom-group');
    if (zoomGroup) {
        const transform = zoomGroup.getAttribute('transform');
        if (transform) {
            const scaleMatch = transform.match(/scale\(([^)]+)\)/);
            if (scaleMatch) {
                scale = parseFloat(scaleMatch[1]) || 1;
            }
        }
    }
    
    // 计算新位置（考虑缩放）
    const deltaX = (e.clientX - dragStartX) / scale;
    const deltaY = (e.clientY - dragStartY) / scale;
    
    let newX = dragOriginalNodeX + deltaX;
    let newY = dragOriginalNodeY + deltaY;
    
    // 节点对齐吸附功能
    const snapDistance = 20;
    for (const otherNode of currentGraphData.nodes) {
        if (otherNode.id === selectedNodeId) continue;
        
        const distanceX = Math.abs(newX - otherNode.x);
        const distanceY = Math.abs(newY - otherNode.y);
        
        // 水平对齐
        if (distanceY < snapDistance && distanceX < 150) {
            newY = otherNode.y;
        }
        // 垂直对齐
        if (distanceX < snapDistance && distanceY < 150) {
            newX = otherNode.x;
        }
    }
    
    // 更新节点位置
    node.x = newX;
    node.y = newY;
    
    // 同步更新节点分组的位置
    const nodeGroup = document.querySelector(`g[data-node-id="${selectedNodeId}"]`);
    if (nodeGroup) {
        nodeGroup.setAttribute('transform', `translate(${newX}, ${newY})`);
    }
    
    // 使用 requestAnimationFrame 更新连接线位置
    if (!window.dragUpdateFrame) {
        window.dragUpdateFrame = requestAnimationFrame(() => {
            updateConnectedLinks(selectedNodeId);
            window.dragUpdateFrame = null;
        });
    }
}

/**
 * 结束拖动
 */
function handleDragEnd(e) {
    if (!isDragging || !selectedNodeId) return;
    
    // 清理拖动状态
    isDragging = false;
    
    // 恢复鼠标样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    const nodeGroup = document.querySelector(`g[data-node-id="${selectedNodeId}"]`);
    if (nodeGroup) {
        nodeGroup.style.cursor = 'pointer';
        
        // 恢复节点样式
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            rect.setAttribute('fill-opacity', '0.9');
            rect.setAttribute('stroke-width', '3');
        }
    }
    
    // 清理拖拽更新动画帧
    if (window.dragUpdateFrame) {
        cancelAnimationFrame(window.dragUpdateFrame);
        window.dragUpdateFrame = null;
    }
    
    // 最终更新连接线位置
    updateConnectedLinks(selectedNodeId);
    
    // 移除全局事件监听器
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
    
    const node = currentGraphData?.nodes.find(n => n.id === selectedNodeId);
    console.log(`ConceptMap: 完成拖动节点 "${node?.label}" 到 (${node?.x?.toFixed(0)}, ${node?.y?.toFixed(0)})`);
    
    // 更新全局变量
    window.currentGraphData = currentGraphData;
}

/**
 * 更新与节点相连的连接线
 */
function updateConnectedLinks(nodeId) {
    if (!currentGraphData || !currentGraphData.links) return;
    
    const svg = document.querySelector('#d3-container svg') || 
                document.querySelector('.concept-graph');
    if (!svg) {
        console.warn('updateConnectedLinks: 找不到SVG元素');
        return;
    }
    
    // 找到所有与该节点相关的连线（兼容字符串ID和对象引用）
    const relatedLinks = currentGraphData.links.filter(link => {
        const sourceId = getLinkNodeId(link.source);
        const targetId = getLinkNodeId(link.target);
        return sourceId === nodeId || targetId === nodeId;
    });
    
    console.log(`updateConnectedLinks: 节点 ${nodeId} 相关连线数: ${relatedLinks.length}`);
    
    // 检测聚合连接
    const aggregatedLinks = detectAggregatedLinks(currentGraphData.links);
    const aggregatedLinkIds = new Set();
    aggregatedLinks.forEach(group => {
        group.links.forEach(link => {
            aggregatedLinkIds.add(link.id);
        });
    });
    
    // 找到与当前节点相关的聚合连接组
    const relatedAggregateGroups = aggregatedLinks.filter(group => {
        return group.sourceId === nodeId || 
               group.links.some(link => getLinkNodeId(link.target) === nodeId);
    });
    
    // 找到所有需要重绘的聚合组（包括同一源节点的所有聚合组）
    // 关键修复：如果删除了某个源节点的聚合组，需要重绘该源节点的所有聚合组
    const affectedSourceIds = new Set();
    relatedAggregateGroups.forEach(group => {
        affectedSourceIds.add(group.sourceId);
    });
    // 当前节点本身也是潜在的源节点
    affectedSourceIds.add(nodeId);
    
    // 找到所有需要重绘的聚合组（同一源节点的所有聚合组都要重绘）
    const groupsToRedraw = aggregatedLinks.filter(group => {
        return affectedSourceIds.has(group.sourceId);
    });
    
    // 更新聚合连接（重绘整个组）
    const nodeById = new Map();
    currentGraphData.nodes.forEach(node => {
        if (node && node.id) nodeById.set(node.id, node);
    });
    
    // 先删除所有与该节点相关的旧聚合连接组（基于 sourceId）
    const allAggregateGroups = svg.querySelectorAll('g[data-aggregate-group="true"]');
    allAggregateGroups.forEach(aggregateGroup => {
        const sourceId = aggregateGroup.getAttribute('data-source-id');
        // 检查该聚合连接组是否需要重绘
        if (affectedSourceIds.has(sourceId)) {
            aggregateGroup.remove();
        }
    });
    
    // 找到合适的容器（考虑 zoom-group）
    const zoomGroup = svg.querySelector('g.zoom-group');
    const container = zoomGroup || svg;
    
    // 重新绘制所有需要重绘的聚合连接（处理同一源节点有多个聚合组的情况，添加偏移避免重叠）
    // 按源节点分组，计算每个源节点有多少个聚合组
    const sourceGroupCount = new Map();
    aggregatedLinks.forEach(group => {
        const count = sourceGroupCount.get(group.sourceId) || 0;
        sourceGroupCount.set(group.sourceId, count + 1);
    });
    
    // 记录每个源节点当前的索引
    const sourceGroupIndex = new Map();
    // 关键修复：重绘所有受影响的聚合组，而不仅仅是直接相关的聚合组
    groupsToRedraw.forEach(group => {
        const currentIndex = sourceGroupIndex.get(group.sourceId) || 0;
        const totalGroups = sourceGroupCount.get(group.sourceId) || 1;
        
        // 绘制聚合连接，传入索引和总数用于偏移计算
        drawAggregatedLink(container, group, nodeById, currentGraphData.nodes, currentIndex, totalGroups);
        
        // 更新索引
        sourceGroupIndex.set(group.sourceId, currentIndex + 1);
    });
    
    // 更新普通连线（排除已聚合的连线）
    relatedLinks.forEach(link => {
        if (aggregatedLinkIds.has(link.id)) return; // 跳过聚合连线
        
        const sourceId = getLinkNodeId(link.source);
        const targetId = getLinkNodeId(link.target);
        const linkIdStr = link.id || `link-${sourceId}-${targetId}`;
        const linkGroup = svg.querySelector(`g[data-link-id="${linkIdStr}"]`);
        
        if (linkGroup) {
            updateLinkPosition(linkGroup, link);
        } else {
            // 连线元素不存在（可能是从聚合状态变成普通连线），需要创建
            console.log(`updateConnectedLinks: 连线元素不存在，创建新的: ${linkIdStr}`);
            createSingleLinkElement(container, link, nodeById);
        }
    });
}

/**
 * 创建单条连线元素
 */
function createSingleLinkElement(container, link, nodeById) {
    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    
    const source = nodeById.get(sourceId);
    const target = nodeById.get(targetId);
    
    if (!source || !target) {
        console.warn('createSingleLinkElement: 找不到源或目标节点', { sourceId, targetId });
        return;
    }
    
    if (source.x === undefined || target.x === undefined) {
        console.warn('createSingleLinkElement: 节点没有坐标', { source, target });
        return;
    }
    
    // 计算节点尺寸
    const sourceWidth = source.width || calculateNodeDimensions(source.label).width;
    const sourceHeight = source.height || calculateNodeDimensions(source.label).height;
    const targetWidth = target.width || calculateNodeDimensions(target.label).width;
    const targetHeight = target.height || calculateNodeDimensions(target.label).height;
    
    // 判断是否是同级连接
    const isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
    
    // 计算连接点
    const sourceWithDims = { x: source.x, y: source.y, width: sourceWidth, height: sourceHeight, layer: source.layer };
    const targetWithDims = { x: target.x, y: target.y, width: targetWidth, height: targetHeight, layer: target.layer };
    const { startX, startY, endX, endY } = calculateNearestEdgeConnection(sourceWithDims, targetWithDims, isSameLayer);
    
    // 创建连线组
    const linkIdStr = link.id || `link-${sourceId}-${targetId}`;
    const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linkGroup.setAttribute('data-link-id', linkIdStr);
    linkGroup.setAttribute('class', 'link-group');
    linkGroup.style.cursor = 'pointer';
    
    // 手动创建的连线始终使用直线
    const isManuallyCreated = link.isManuallyCreated === true;
    let pathData;
    if (isManuallyCreated) {
        // 手动创建的连线始终使用直线
        pathData = `M${startX},${startY} L${endX},${endY}`;
    } else if (isSameLayer) {
        // 同级连接使用曲线
        const curvedPathData = calculateCurvedPath(startX, startY, endX, endY);
        pathData = curvedPathData.path;
    } else {
        // 普通连接使用直线
        pathData = `M${startX},${startY} L${endX},${endY}`;
    }
    
    // 创建路径
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', pathData);
    line.setAttribute('stroke', link.lineColor || '#aaa');
    line.setAttribute('stroke-width', link.lineWidth || '2');
    line.setAttribute('fill', 'none');
    line.setAttribute('opacity', link.opacity || '1');
    if (link.lineColor) line.setAttribute('data-user-color', link.lineColor);
    if (link.lineWidth) line.setAttribute('data-user-width', link.lineWidth);
    if (link.opacity) line.setAttribute('data-user-opacity', link.opacity);
    
    linkGroup.appendChild(line);
    
    // 创建箭头
    const arrowSize = 8;
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowPath = `M${endX},${endY} L${endX - arrowSize * Math.cos(angle - Math.PI/6)},${endY - arrowSize * Math.sin(angle - Math.PI/6)} L${endX - arrowSize * Math.cos(angle + Math.PI/6)},${endY - arrowSize * Math.sin(angle + Math.PI/6)} Z`;
    
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', arrowPath);
    arrow.setAttribute('fill', link.lineColor || '#aaa');
    arrow.setAttribute('stroke', link.lineColor || '#aaa');
    arrow.setAttribute('opacity', link.opacity || '1');
    if (link.lineColor) arrow.setAttribute('data-user-color', link.lineColor);
    if (link.opacity) arrow.setAttribute('data-user-opacity', link.opacity);
    
    linkGroup.appendChild(arrow);
    
    // 创建标签
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', midX);
    labelText.setAttribute('y', midY - 10);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('font-size', link.fontSize || '24');
    labelText.setAttribute('font-family', link.fontFamily || 'Inter, sans-serif');
    labelText.setAttribute('fill', link.textColor || '#333');
    labelText.setAttribute('data-link-label', 'true');
    labelText.textContent = link.label || '双击编辑';
    if (link.textColor) labelText.setAttribute('data-user-text-color', link.textColor);
    
    linkGroup.appendChild(labelText);
    
    // 添加到容器（在节点之前）
    const firstNode = container.querySelector('g[data-node-id]');
    if (firstNode) {
        container.insertBefore(linkGroup, firstNode);
    } else {
        container.appendChild(linkGroup);
    }
    
    // 绑定交互事件
    if (typeof attachLinkInteractionListeners === 'function') {
        attachLinkInteractionListeners(linkGroup, linkIdStr);
    }
    
    console.log(`createSingleLinkElement: 创建连线 ${linkIdStr}`);
}

/**
 * 更新单条连线位置
 */
function updateLinkPosition(linkGroup, link) {
    if (!currentGraphData || !currentGraphData.nodes) return;
    
    // 获取源和目标节点（兼容字符串ID和对象引用）
    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    
    const sourceNode = currentGraphData.nodes.find(n => n.id === sourceId);
    const targetNode = currentGraphData.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
        console.warn(`updateLinkPosition: 找不到节点 source=${sourceId}, target=${targetId}`);
        return;
    }
    
    // 计算节点尺寸
    const sourceWidth = sourceNode.width || calculateNodeDimensions(sourceNode.label).width;
    const sourceHeight = sourceNode.height || calculateNodeDimensions(sourceNode.label).height;
    const targetWidth = targetNode.width || calculateNodeDimensions(targetNode.label).width;
    const targetHeight = targetNode.height || calculateNodeDimensions(targetNode.label).height;
    
    // 判断是否是同层连接（必须两个节点都有有效的 layer 属性，且 layer 相同）
    const isSameLayer = sourceNode.layer !== undefined && targetNode.layer !== undefined && sourceNode.layer === targetNode.layer;
    
    // 计算连接点：选择两个节点上下边中点中距离最近的两个
    // 同级连接强制使用下方中点到下方中点
    const sourceWithDims = { x: sourceNode.x, y: sourceNode.y, width: sourceWidth, height: sourceHeight, layer: sourceNode.layer };
    const targetWithDims = { x: targetNode.x, y: targetNode.y, width: targetWidth, height: targetHeight, layer: targetNode.layer };
    const { startX, startY, endX, endY } = calculateNearestEdgeConnection(sourceWithDims, targetWithDims, isSameLayer);
    
    // 获取连接线元素
    const line = linkGroup.querySelector('path:first-child');
    const arrow = linkGroup.querySelector('path:nth-child(2)');
    const labelText = linkGroup.querySelector('text');
    
    if (!line) return;
    
    // 更新路径
    let pathData;
    // 手动创建的连线始终使用直线
    if (link.isManuallyCreated) {
        pathData = {
            isCurved: false,
            path: `M ${startX} ${startY} L ${endX} ${endY}`,
            waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
        };
    } else if (isSameLayer) {
        pathData = calculateCurvedPath(startX, startY, endX, endY);
    } else {
        pathData = {
            isCurved: false,
            path: `M ${startX} ${startY} L ${endX} ${endY}`,
            waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
        };
    }
    
    line.setAttribute('d', pathData.path);
    
    // 更新断开样式（只有连线足够长时才断开，用于显示标签）
    const labelTextContent = link.label || '双击编辑';
    const textWidth = Math.max(40, labelTextContent.length * 10);
    const textGap = Math.max(20, textWidth * 0.6);
    
    if (pathData.isCurved && pathData.controlPoint) {
        const arcLength = estimateQuadraticBezierLength(
            startX, startY, 
            pathData.controlPoint.x, pathData.controlPoint.y, 
            endX, endY
        );
        if (arcLength > textGap * 2) {
            const curveGapStart = (arcLength - textGap) / 2;
            line.setAttribute('stroke-dasharray', `${curveGapStart} ${textGap} ${arcLength - curveGapStart - textGap}`);
        } else {
            line.removeAttribute('stroke-dasharray');
        }
    } else {
        const totalLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        if (totalLength > textGap * 2) {
            const gapStart = (totalLength - textGap) / 2;
            line.setAttribute('stroke-dasharray', `${gapStart} ${textGap} ${totalLength - gapStart - textGap}`);
        } else {
            line.removeAttribute('stroke-dasharray');
        }
    }
    
    // 更新箭头位置
    if (arrow) {
        const arrowLength = 8;
        let angle;
        if (pathData.isCurved && pathData.controlPoint) {
            angle = Math.atan2(endY - pathData.controlPoint.y, endX - pathData.controlPoint.x);
            } else {
            angle = Math.atan2(endY - startY, endX - startX);
        }
        
        const arrowAngle1 = angle + Math.PI / 8;
        const arrowAngle2 = angle - Math.PI / 8;
        
        const arrowPoint1X = endX - arrowLength * Math.cos(arrowAngle1);
        const arrowPoint1Y = endY - arrowLength * Math.sin(arrowAngle1);
        const arrowPoint2X = endX - arrowLength * Math.cos(arrowAngle2);
        const arrowPoint2Y = endY - arrowLength * Math.sin(arrowAngle2);
        
        arrow.setAttribute('d', `M ${endX} ${endY} L ${arrowPoint1X} ${arrowPoint1Y} L ${arrowPoint2X} ${arrowPoint2Y} Z`);
    }
    
    // 更新标签位置：同级曲线保持在断开间隙的正中央（沿弧长）
    if (labelText) {
        let midX, midY;
        
        if (pathData.isCurved && pathData.controlPoint) {
            const arcLength = estimateQuadraticBezierLength(
                startX, startY, 
                pathData.controlPoint.x, pathData.controlPoint.y, 
                endX, endY
            );
            const gapStart = (arcLength - textGap) / 2;
            const gapCenter = gapStart + textGap / 2;
            
            // 采样寻找弧长为 gapCenter 的点
            const steps = 100;
            let accumulated = 0;
            let prevX = startX;
            let prevY = startY;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const invT = 1 - t;
                const curX = invT * invT * startX + 2 * invT * t * pathData.controlPoint.x + t * t * endX;
                const curY = invT * invT * startY + 2 * invT * t * pathData.controlPoint.y + t * t * endY;
                const segLen = Math.sqrt(Math.pow(curX - prevX, 2) + Math.pow(curY - prevY, 2));
                
                if (accumulated + segLen >= gapCenter) {
                    const ratio = (gapCenter - accumulated) / segLen;
                    midX = prevX + (curX - prevX) * ratio;
                    midY = prevY + (curY - prevY) * ratio;
                    break;
                }
                
                accumulated += segLen;
                prevX = curX;
                prevY = curY;
            }
            
            // 保险兜底：若未命中则使用终点
            if (midX === undefined) {
                midX = endX;
                midY = endY;
            }
        } else {
            midX = (startX + endX) / 2;
            midY = (startY + endY) / 2;
        }
        
        labelText.setAttribute('x', midX);
        labelText.setAttribute('y', midY + 4);
    }
}

/**
 * 为节点添加拖动监听器
 */
function attachDragListeners(nodeGroup, nodeId) {
    nodeGroup.style.cursor = 'pointer';
    
    nodeGroup.addEventListener('mousedown', (e) => {
        // 只响应左键
        if (e.button !== 0) return;
        
        // 阻止默认行为
        e.preventDefault();
        e.stopPropagation();
        
        // 获取 SVG 坐标系中的鼠标位置
        startDrag(nodeId, e.clientX, e.clientY);
    });
}

/**
 * 设置当前图数据（供外部调用）
 */
function setCurrentGraphData(graphData) {
    // 标准化 links 的 source 和 target 为字符串 ID
    if (graphData && graphData.links) {
        graphData.links = graphData.links.map(link => ({
            ...link,
            source: getLinkNodeId(link.source) || link.source,
            target: getLinkNodeId(link.target) || link.target
        }));
    }
    currentGraphData = graphData;
    window.currentGraphData = graphData;
    console.log('setCurrentGraphData: 数据已设置，节点数:', graphData?.nodes?.length, '连线数:', graphData?.links?.length);
}

// ============================================================================
// 添加节点功能（移植自 concept-map-new-master/web/interactions.js）
// ============================================================================

// 当前选中的节点ID
let selectedConceptNodeId = null;

/**
 * 双击编辑节点文字（移植自 concept-map-new-master/web/interactions.js）
 */
function editConceptNodeText(nodeId) {
    const node = currentGraphData?.nodes?.find(n => n.id === nodeId);
    if (!node) {
        console.error('ConceptMap: 节点未找到:', nodeId);
        return;
    }

    // 获取SVG画布
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) {
        console.error('ConceptMap: SVG 元素未找到');
        return;
    }

    // 获取节点组元素
    const nodeGroup = svg.querySelector(`g[data-node-id="${nodeId}"]`);
    if (!nodeGroup) {
        console.error('ConceptMap: 节点组元素未找到');
        return;
    }

    // 获取节点矩形元素
    const nodeRect = nodeGroup.querySelector('rect');
    if (!nodeRect) {
        console.error('ConceptMap: 节点矩形元素未找到');
        return;
    }

    // 获取节点组在页面中的实际位置
    const nodeGroupRect = nodeGroup.getBoundingClientRect();
    
    // 获取节点矩形的尺寸
    const nodeWidth = parseFloat(nodeRect.getAttribute('width')) || node.width || 220;
    const nodeHeight = parseFloat(nodeRect.getAttribute('height')) || node.height || 85;
    
    // 计算输入框位置
    const nodeCenterX = nodeGroupRect.left + nodeGroupRect.width / 2;
    const nodeCenterY = nodeGroupRect.top + nodeGroupRect.height / 2;
    const inputLeft = nodeCenterX - nodeWidth / 2;
    const inputTop = nodeCenterY - nodeHeight / 2;

    // 判断是否是焦点问题节点
    const isFocusQuestionNode = node.isFocusQuestion || nodeId === 'focus-question-node';
    const focusPrefix = '焦点问题：';
    
    // 获取编辑内容（焦点问题节点只编辑问题部分，不编辑前缀）
    let editValue = node.label || '';
    if (isFocusQuestionNode && editValue.startsWith(focusPrefix)) {
        editValue = editValue.substring(focusPrefix.length);
    }

    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = editValue;
    input.style.cssText = `
        position: fixed;
        left: ${inputLeft}px;
        top: ${inputTop}px;
        width: ${nodeWidth}px;
        height: ${nodeHeight}px;
        border: 2px solid ${isFocusQuestionNode ? '#5a4fcf' : '#667eea'};
        border-radius: 8px;
        padding: 0 8px;
        font-size: ${isFocusQuestionNode ? '16px' : '14px'};
        font-weight: ${isFocusQuestionNode ? '600' : '500'};
        text-align: center;
        background: white;
        color: #333;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        outline: none;
    `;
    
    document.body.appendChild(input);
    input.focus();
    input.select();

    // 防止重复保存的标志
    let isSaved = false;

    // 保存修改
    function saveEdit() {
        // 防止重复调用
        if (isSaved) return;
        isSaved = true;
        
        let newText = input.value.trim();
        
        // 焦点问题节点需要添加前缀
        if (isFocusQuestionNode && newText) {
            newText = focusPrefix + newText;
            // 同时更新 window.focusQuestion
            window.focusQuestion = input.value.trim();
        }
        
        const oldLabel = node.label;
        if (newText && newText !== oldLabel) {
            // 更新数据
            node.label = newText;
            
            // 更新DOM中的文字
            const textElement = nodeGroup.querySelector('text');
            if (textElement) {
                textElement.textContent = newText;
            }
            
            // 重新计算节点尺寸
            const newDims = isFocusQuestionNode 
                ? calculateFocusQuestionDimensions(newText)
                : calculateNodeDimensions(newText);
            node.width = newDims.width;
            node.height = newDims.height;
            
            // 更新矩形尺寸
            nodeRect.setAttribute('width', newDims.width);
            nodeRect.setAttribute('height', newDims.height);
            nodeRect.setAttribute('x', -newDims.width / 2);
            nodeRect.setAttribute('y', -newDims.height / 2);
            
            console.log('ConceptMap: 节点文字已更新:', nodeId, newText);
            
            // 更新连接线
            updateConnectedLinks(nodeId);
            
            // 保存到历史记录（支持撤销）
            saveToHistory(currentGraphData);
            console.log('ConceptMap: 历史记录已保存');
        }
        
        // 移除输入框
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
    }
    
    // 计算焦点问题节点尺寸
    // 关键修复：使用固定宽度 1400px
    function calculateFocusQuestionDimensions(text) {
        const width = 1400; // 固定宽度 1400px
        const height = 80; // 固定高度 80px（与其他地方保持一致）
        return { width, height };
    }

    // 回车保存
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            isSaved = true; // 标记为已处理，防止 blur 再次触发保存
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        }
    });

    // 失焦保存
    input.addEventListener('blur', function() {
        if (!isSaved) {
            saveEdit();
        }
    });
}

/**
 * 单击选中节点（移植自 concept-map-new-master/web/interactions.js）
 */
function selectConceptNode(nodeId) {
    console.log('ConceptMap: 选中节点:', nodeId);
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 取消所有节点的选中状态并移除控制手柄
    const allNodes = svg.querySelectorAll('g[data-node-id]');
    allNodes.forEach(nodeGroup => {
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            // 恢复默认边框（焦点问题框使用紫蓝色边框，其他节点使用白色边框）
            const isFocusQuestion = nodeGroup.getAttribute('data-node-id') === 'focus-question-node';
            rect.setAttribute('stroke', isFocusQuestion ? '#667eea' : '#fff');
            rect.setAttribute('stroke-width', '2');
        }
        // 移除之前节点的控制手柄
        removeNodeHandles(nodeGroup);
    });

    // 选中新节点
    selectedConceptNodeId = nodeId;
    const nodeGroup = svg.querySelector(`g[data-node-id="${nodeId}"]`);
    if (nodeGroup) {
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            // 选中时显示金色边框
            rect.setAttribute('stroke', '#ffd700');
            rect.setAttribute('stroke-width', '3');
        }
        
        // 为选中的节点添加控制手柄
        addNodeHandles(nodeGroup);
        
        // 通知 MindGraph 的选择管理器
        if (window.eventBus) {
            window.eventBus.emit('node:selected', {
                nodeId: nodeId,
                diagramType: 'concept_map'
            });
        }
        
        // 更新 MindGraph 的选中状态
        const editor = window.interactiveEditor;
        if (editor && editor.selectionManager) {
            editor.selectionManager.clearSelection();
            editor.selectionManager.selectNode(nodeId);
        }
        
        // CRITICAL: Update stateManager selection (source of truth for getSelectedNodes)
        // This is the primary selection state used by property panel operations
        if (window.stateManager && typeof window.stateManager.selectNodes === 'function') {
            window.stateManager.selectNodes([nodeId]);
        }

        // Also emit interaction:selection_changed to update ToolbarManager.currentSelection (fallback)
        if (window.eventBus) {
            window.eventBus.emit('interaction:selection_changed', {
                selectedNodes: [nodeId],
                nodeId,
                diagramType: 'concept_map'
            });
        }

        // 打开属性面板（通过 selection:changed 事件驱动 PropertyPanelManager）
        if (window.eventBus) {
            window.eventBus.emit('selection:changed', {
                selectedNodes: [nodeId],
                nodeId,
                shouldAutoOpenPanel: true
            });
        }
    }
    
    console.log('ConceptMap: 节点已选中:', nodeId);
}

/**
 * 取消选中节点
 */
function deselectConceptNode() {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 取消所有节点的选中状态并移除控制手柄
    const allNodes = svg.querySelectorAll('g[data-node-id]');
    allNodes.forEach(nodeGroup => {
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            // 恢复默认边框（焦点问题框使用紫蓝色边框，其他节点使用白色边框）
            const isFocusQuestion = nodeGroup.getAttribute('data-node-id') === 'focus-question-node';
            rect.setAttribute('stroke', isFocusQuestion ? '#667eea' : '#fff');
            rect.setAttribute('stroke-width', '2');
        }
        // 移除控制手柄
        removeNodeHandles(nodeGroup);
    });
    
    selectedConceptNodeId = null;

    // 同步清空 SelectionManager 选中状态
    const editor = window.interactiveEditor;
    if (editor && editor.selectionManager) {
        editor.selectionManager.clearSelection();
    }

    // 通知属性面板关闭/清空
    if (window.eventBus) {
        window.eventBus.emit('selection:cleared', {
            shouldHidePanel: true
        });
    }
}

// ============================================================================
// 控制手柄功能（移植自 concept-map-new-master/web/interactions.js）
// ============================================================================

// 连线创建状态
let isLinkCreationMode = false;
let linkSourceNodeId = null;
let linkTargetNodeId = null;

/**
 * 为节点添加控制手柄
 */
function addNodeHandles(nodeGroup) {
    const rect = nodeGroup.querySelector('rect');
    if (!rect) return;

    const nodeId = nodeGroup.getAttribute('data-node-id');
    const node = currentGraphData?.nodes?.find(n => n.id === nodeId);
    if (!node) return;

    // 获取节点尺寸
    const nodeWidth = node.width || parseFloat(rect.getAttribute('width')) || 220;
    const nodeHeight = node.height || parseFloat(rect.getAttribute('height')) || 85;

    // 创建4个连接线手柄（四个边缘的箭头）
    const handlePositions = [
        { x: 0, y: -nodeHeight/2 - 12, type: 'connect', direction: 'top' },
        { x: nodeWidth/2 + 12, y: 0, type: 'connect', direction: 'right' },
        { x: 0, y: nodeHeight/2 + 12, type: 'connect', direction: 'bottom' },
        { x: -nodeWidth/2 - 12, y: 0, type: 'connect', direction: 'left' }
    ];

    handlePositions.forEach((pos) => {
        const handle = createHandle(pos, nodeId);
        nodeGroup.appendChild(handle);
    });
}

/**
 * 创建单个手柄
 */
function createHandle(pos, nodeId) {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handle.setAttribute('class', 'node-handle');
    handle.setAttribute('data-handle-type', pos.type);
    handle.setAttribute('data-handle-direction', pos.direction);
    handle.setAttribute('data-node-id', nodeId);
    handle.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    // 创建连接线手柄（小箭头）
    const arrow = createArrow(pos.direction);
    handle.appendChild(arrow);

    // 添加连接线的事件监听器
    addConnectionHandlers(handle, pos.direction, nodeId);

    return handle;
}

/**
 * 创建箭头形状
 */
function createArrow(direction) {
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('fill', '#007bff');
    arrow.setAttribute('stroke', '#333');
    arrow.setAttribute('stroke-width', '2');
    arrow.setAttribute('cursor', 'crosshair');

    // 根据方向设置箭头路径
    const arrowPaths = {
        'top': 'M0,-8 L-5,2 L5,2 Z',
        'right': 'M8,0 L-2,-5 L-2,5 Z',
        'bottom': 'M0,8 L-5,-2 L5,-2 Z',
        'left': 'M-8,0 L2,-5 L2,5 Z'
    };

    arrow.setAttribute('d', arrowPaths[direction] || arrowPaths['top']);
    return arrow;
}

/**
 * 移除节点的控制手柄
 */
function removeNodeHandles(nodeGroup) {
    const handles = nodeGroup.querySelectorAll('.node-handle');
    handles.forEach(handle => handle.remove());
}

/**
 * 添加连接线创建处理器
 */
function addConnectionHandlers(handle, direction, nodeId) {
    handle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // 进入拖拽连接线创建模式
        enterConnectionDragMode(nodeId, direction);
        
        // 创建虚拟连接线
        window.virtualLine = createVirtualConnectionLine(nodeId, direction);
        
        // 添加全局拖拽事件监听器
        document.addEventListener('mousemove', handleConnectionDrag);
        document.addEventListener('mouseup', handleConnectionDragEnd);
        
        // 防止文本选择
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
    });
}

/**
 * 进入连接线拖拽模式
 */
function enterConnectionDragMode(sourceNodeId, direction) {
    isLinkCreationMode = true;
    linkSourceNodeId = sourceNodeId;
    linkTargetNodeId = null;
    
    console.log('ConceptMap: 进入连线创建模式，源节点:', sourceNodeId, '方向:', direction);
}

/**
 * 创建虚拟连接线
 */
function createVirtualConnectionLine(sourceNodeId, direction) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return null;
    
    const sourceNode = currentGraphData?.nodes?.find(n => n.id === sourceNodeId);
    if (!sourceNode) return null;
    
    // 创建虚拟连接线组
    const virtualLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    virtualLineGroup.setAttribute('class', 'virtual-connection-line');
    
    // 创建虚拟连接线路径
    const virtualLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    virtualLine.setAttribute('stroke', '#ff6b6b');
    virtualLine.setAttribute('stroke-width', '3');
    virtualLine.setAttribute('stroke-dasharray', '8,4');
    virtualLine.setAttribute('opacity', '0.8');
    virtualLine.setAttribute('fill', 'none');
    virtualLine.setAttribute('pointer-events', 'none');
    
    // 计算起点
    const nodeWidth = sourceNode.width || 220;
    const nodeHeight = sourceNode.height || 85;
    
    let startX, startY;
    switch (direction) {
        case 'top':
            startX = sourceNode.x;
            startY = sourceNode.y - nodeHeight / 2;
            break;
        case 'right':
            startX = sourceNode.x + nodeWidth / 2;
            startY = sourceNode.y;
            break;
        case 'bottom':
            startX = sourceNode.x;
            startY = sourceNode.y + nodeHeight / 2;
            break;
        case 'left':
            startX = sourceNode.x - nodeWidth / 2;
            startY = sourceNode.y;
            break;
    }
    
    // 创建初始路径
    virtualLine.setAttribute('d', `M ${startX} ${startY} L ${startX} ${startY}`);
    virtualLine.setAttribute('data-start-x', startX);
    virtualLine.setAttribute('data-start-y', startY);
    
    virtualLineGroup.appendChild(virtualLine);
    
    // 找到合适的容器添加虚拟连线（考虑 zoom-group 的情况）
    const zoomGroup = svg.querySelector('g.zoom-group');
    const container = zoomGroup || svg;
    container.appendChild(virtualLineGroup);
    
    return virtualLineGroup;
}

/**
 * 处理连接线拖拽
 */
function handleConnectionDrag(e) {
    if (!isLinkCreationMode || !window.virtualLine) return;
    
    const virtualLineGroup = window.virtualLine;
    const virtualLine = virtualLineGroup.querySelector('path');
    if (!virtualLine) return;
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 将鼠标坐标转换为SVG坐标
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    // 获取起点坐标
    const startX = parseFloat(virtualLine.getAttribute('data-start-x'));
    const startY = parseFloat(virtualLine.getAttribute('data-start-y'));
    
    // 更新虚拟连接线路径
    virtualLine.setAttribute('d', `M ${startX} ${startY} L ${svgPt.x} ${svgPt.y}`);
}

/**
 * 处理连接线拖拽结束
 */
function handleConnectionDragEnd(e) {
    if (!isLinkCreationMode) return;
    
    // 恢复页面样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // 移除全局事件监听器
    document.removeEventListener('mousemove', handleConnectionDrag);
    document.removeEventListener('mouseup', handleConnectionDragEnd);
    
    // 检查鼠标是否在目标节点上
    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    const targetNodeGroup = targetElement?.closest('g[data-node-id]');
    
    if (targetNodeGroup) {
        const targetNodeId = targetNodeGroup.getAttribute('data-node-id');
        
        if (targetNodeId && targetNodeId !== linkSourceNodeId) {
            // 创建连线
            createConceptLink(linkSourceNodeId, targetNodeId);
        } else if (targetNodeId === linkSourceNodeId) {
            console.log('ConceptMap: 不能连接到同一个节点');
        }
    } else {
        console.log('ConceptMap: 请拖拽到目标节点上完成连接');
    }
    
    // 移除虚拟连接线
    if (window.virtualLine) {
        window.virtualLine.remove();
        window.virtualLine = null;
    }
    
    // 退出连接线创建模式
    isLinkCreationMode = false;
    linkSourceNodeId = null;
    linkTargetNodeId = null;
}

/**
 * 创建连线
 */
function createConceptLink(sourceId, targetId) {
    if (!currentGraphData) {
        console.error('ConceptMap: 没有图数据');
        return;
    }
    
    // 🔴 禁止创建与焦点问题框相关的连线
    if (sourceId === 'focus-question-node' || targetId === 'focus-question-node') {
        console.warn('ConceptMap: 禁止创建与焦点问题框相关的连线');
        if (typeof showMessage === 'function') {
            showMessage('焦点问题框不能与其他节点建立连接');
        }
        return;
    }
    
    if (!currentGraphData.links) {
        currentGraphData.links = [];
    }
    
    // 检查是否已存在相同的连线
    const existingLink = currentGraphData.links.find(link => {
        const linkSourceId = getLinkNodeId(link.source);
        const linkTargetId = getLinkNodeId(link.target);
        return (linkSourceId === sourceId && linkTargetId === targetId) ||
               (linkSourceId === targetId && linkTargetId === sourceId);
    });
    
    if (existingLink) {
        console.log('ConceptMap: 这两个节点之间已经存在连线');
        return;
    }
    
    // 获取节点信息
    const sourceNode = currentGraphData.nodes.find(n => n.id === sourceId);
    const targetNode = currentGraphData.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
        console.error('ConceptMap: 无法找到源节点或目标节点');
        return;
    }
    
    // 创建新连线（标记为手动创建，始终使用直线）
    const newLink = {
        id: `link-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        label: '生成中...',  // 临时标签，等待LLM生成
        isManuallyCreated: true  // 手动创建的连线始终使用直线
    };
    
    // 添加到数据中
    currentGraphData.links.push(newLink);
    window.currentGraphData = currentGraphData;
    
    // 直接在SVG中绘制新连线（先显示临时标签）
    drawSingleLink(newLink);
    
    console.log('ConceptMap: 连线已创建:', sourceId, '→', targetId);
    
    // 异步调用LLM生成连接词
    generateLinkLabelAsync(newLink, sourceNode.label, targetNode.label);
}

/**
 * 异步生成连接词
 */
async function generateLinkLabelAsync(link, sourceLabel, targetLabel) {
    console.log('ConceptMap: 开始生成连接词', sourceLabel, '→', targetLabel);
    
    try {
        // 获取焦点问题作为上下文
        let focusQuestion = '';
        const focusNode = currentGraphData?.nodes?.find(n => n.isFocusQuestion || n.id === 'focus-question-node');
        if (focusNode && focusNode.label) {
            // 从 "焦点问题：xxx" 中提取实际问题
            focusQuestion = focusNode.label.replace(/^焦点问题[：:]\s*/, '');
        }
        
        // 调用API生成连接词
        const response = await fetch('/api/generate_link_label', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_concept: sourceLabel,
                target_concept: targetLabel,
                focus_question: focusQuestion,
                language: 'zh',
                llm: 'qwen'  // 使用默认模型，可以改为从配置读取
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.link_label) {
            // 更新连线标签
            link.label = data.link_label;
            
            // 更新数据中的连线
            const existingLink = currentGraphData.links.find(l => l.id === link.id);
            if (existingLink) {
                existingLink.label = data.link_label;
            }
            window.currentGraphData = currentGraphData;
            
            // 更新DOM中的标签显示
            updateLinkLabelInDOM(link.id, data.link_label);
            
            // 保存到历史记录
            saveToHistory(currentGraphData);
            
            console.log('ConceptMap: 连接词已生成:', data.link_label);
            
            if (typeof showMessage === 'function') {
                showMessage(`已生成连接词: ${data.link_label}`, 'success');
            }
        } else {
            throw new Error(data.error || '生成失败');
        }
    } catch (error) {
        console.error('ConceptMap: 生成连接词失败:', error);
        
        // 生成失败时设置默认标签
        link.label = '双击编辑';
        const existingLink = currentGraphData.links.find(l => l.id === link.id);
        if (existingLink) {
            existingLink.label = '双击编辑';
        }
        window.currentGraphData = currentGraphData;
        
        // 更新DOM
        updateLinkLabelInDOM(link.id, '双击编辑');
        
        // 保存到历史记录
        saveToHistory(currentGraphData);
    }
}

/**
 * 更新DOM中的连线标签
 */
function updateLinkLabelInDOM(linkId, newLabel) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 查找对应的标签元素
    const labelText = svg.querySelector(`text[data-link-id="${linkId}"]`);
    if (labelText) {
        labelText.textContent = newLabel;
        console.log('ConceptMap: DOM中的连接词已更新:', linkId, newLabel);
    }
}

/**
 * 绘制单条连线
 */
function drawSingleLink(link) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    const sourceId = getLinkNodeId(link.source);
    const targetId = getLinkNodeId(link.target);
    
    // 🔴 禁止绘制与焦点问题框相关的连线
    if (sourceId === 'focus-question-node' || targetId === 'focus-question-node') {
        console.log(`drawSingleLink: 跳过与焦点问题框相关的连线: ${sourceId} -> ${targetId}`);
        return;
    }
    
    const source = currentGraphData?.nodes?.find(n => n.id === sourceId);
    const target = currentGraphData?.nodes?.find(n => n.id === targetId);
    
    if (!source || !target) return;
    
    // 计算节点尺寸
    const sourceWidth = source.width || 220;
    const sourceHeight = source.height || 85;
    const targetWidth = target.width || 220;
    const targetHeight = target.height || 85;
    
    // 判断是否是同层连接（必须两个节点都有有效的 layer 属性，且 layer 相同）
    const isSameLayer = source.layer !== undefined && target.layer !== undefined && source.layer === target.layer;
    
    // 计算连接点：选择两个节点上下边中点中距离最近的两个
    // 同级连接强制使用下方中点到下方中点
    const sourceWithDims = { x: source.x, y: source.y, width: sourceWidth, height: sourceHeight, layer: source.layer };
    const targetWithDims = { x: target.x, y: target.y, width: targetWidth, height: targetHeight, layer: target.layer };
    const { startX, startY, endX, endY } = calculateNearestEdgeConnection(sourceWithDims, targetWithDims, isSameLayer);
    
    // 创建连线组
    const lineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    lineGroup.setAttribute('data-link-id', link.id);
    
    // 手动创建的连线始终使用直线
    let pathData = {
        isCurved: false,
        isPolyline: false,
        path: `M ${startX} ${startY} L ${endX} ${endY}`,
        waypoints: [{ x: startX, y: startY }, { x: endX, y: endY }]
    };
    
    // 计算标签位置（严格位于连线断开的中点）
    let midX, midY;
    if (pathData.isCurved && pathData.controlPoint) {
        // 对于曲线，使用弧长中点对应的 t 值（约0.5，但需要微调）
        // 简化：对于向下弯曲的曲线，中点大约在水平中点、垂直方向在控制点附近
        const controlX = pathData.controlPoint.x;
        const controlY = pathData.controlPoint.y;
        
        // 使用弧长中点估算（t ≈ 0.5 通常接近弧长中点）
        const t = 0.5;
        const t1 = 1 - t;
        midX = t1 * t1 * startX + 2 * t1 * t * controlX + t * t * endX;
        midY = t1 * t1 * startY + 2 * t1 * t * controlY + t * t * endY;
    } else if (pathData.isPolyline && pathData.waypoints && pathData.waypoints.length >= 3) {
        // 折线：找到总弧长中点位置
        let totalLength = 0;
        const segmentLengths = [];
        for (let i = 1; i < pathData.waypoints.length; i++) {
            const wp1 = pathData.waypoints[i - 1];
            const wp2 = pathData.waypoints[i];
            const segLen = Math.sqrt(Math.pow(wp2.x - wp1.x, 2) + Math.pow(wp2.y - wp1.y, 2));
            segmentLengths.push(segLen);
            totalLength += segLen;
        }
        
        const targetLength = totalLength / 2;
        let accumulatedLength = 0;
        
        for (let i = 0; i < segmentLengths.length; i++) {
            if (accumulatedLength + segmentLengths[i] >= targetLength) {
                const wp1 = pathData.waypoints[i];
                const wp2 = pathData.waypoints[i + 1];
                const remainingLength = targetLength - accumulatedLength;
                const ratio = remainingLength / segmentLengths[i];
                midX = wp1.x + (wp2.x - wp1.x) * ratio;
                midY = wp1.y + (wp2.y - wp1.y) * ratio;
                break;
            }
            accumulatedLength += segmentLengths[i];
        }
        
        if (midX === undefined) {
            midX = (startX + endX) / 2;
            midY = (startY + endY) / 2;
        }
    } else {
        midX = (startX + endX) / 2;
        midY = (startY + endY) / 2;
    }
    
    // 计算连线长度
    const totalLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const labelText = link.label || '双击编辑';
    const textWidth = Math.max(40, labelText.length * 10);
    const textGap = Math.max(20, textWidth * 0.6);
    
    // 创建路径
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData.path);
    path.setAttribute('stroke', '#aaa');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    
    // 设置断开模式（只有当连线足够长时才断开，用于显示标签）
    if (pathData.isCurved && pathData.controlPoint) {
        const arcLength = estimateQuadraticBezierLength(startX, startY, pathData.controlPoint.x, pathData.controlPoint.y, endX, endY);
        if (arcLength > textGap * 2) {
            const gapStart = (arcLength - textGap) / 2;
            path.setAttribute('stroke-dasharray', `${gapStart} ${textGap} ${arcLength - gapStart - textGap}`);
        }
    } else {
        if (totalLength > textGap * 2) {
            const gapStart = (totalLength - textGap) / 2;
            path.setAttribute('stroke-dasharray', `${gapStart} ${textGap} ${totalLength - gapStart - textGap}`);
        }
    }
    
    lineGroup.appendChild(path);
    
    // 计算箭头方向
    let angle;
    if (pathData.isCurved && pathData.controlPoint) {
        // 曲线：基于终点处的切线方向
        const tangentX = 2 * (endX - pathData.controlPoint.x);
        const tangentY = 2 * (endY - pathData.controlPoint.y);
        angle = Math.atan2(tangentY, tangentX);
    } else {
        // 直线：基于起点到终点的方向
        angle = Math.atan2(endY - startY, endX - startX);
    }
    
    const arrowLength = 8;
    const arrowAngle1 = angle + Math.PI / 8;
    const arrowAngle2 = angle - Math.PI / 8;
    
    const arrowPoint1X = endX - arrowLength * Math.cos(arrowAngle1);
    const arrowPoint1Y = endY - arrowLength * Math.sin(arrowAngle1);
    const arrowPoint2X = endX - arrowLength * Math.cos(arrowAngle2);
    const arrowPoint2Y = endY - arrowLength * Math.sin(arrowAngle2);
    
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', `M ${endX} ${endY} L ${arrowPoint1X} ${arrowPoint1Y} L ${arrowPoint2X} ${arrowPoint2Y} Z`);
    arrowPath.setAttribute('fill', '#aaa');
    arrowPath.setAttribute('stroke', '#aaa');
    arrowPath.setAttribute('stroke-width', '1');
    lineGroup.appendChild(arrowPath);
    
    // 添加连线标签
    const linkLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    linkLabel.setAttribute('x', midX);
    linkLabel.setAttribute('y', midY + 4);
    linkLabel.setAttribute('text-anchor', 'middle');
    linkLabel.setAttribute('font-size', '24');
    linkLabel.setAttribute('fill', '#333');
    linkLabel.setAttribute('font-weight', '500');
    linkLabel.setAttribute('data-link-id', link.id);
    linkLabel.setAttribute('data-link-label', 'true');
    linkLabel.setAttribute('pointer-events', 'all');
    linkLabel.setAttribute('cursor', 'pointer');
    linkLabel.textContent = labelText;
    lineGroup.appendChild(linkLabel);
    
    // 连线标签双击编辑
    linkLabel.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        editLinkLabel(link.id);
    });
    
    // 连线组单击选中
    lineGroup.addEventListener('click', function(e) {
        e.stopPropagation();
        selectLink(link.id);
    });
    
    // 设置连线组样式
    lineGroup.style.cursor = 'pointer';
    
    // 找到合适的容器添加连线（考虑 zoom-group 的情况）
    const zoomGroup = svg.querySelector('g.zoom-group');
    const container = zoomGroup || svg;
    
    // 找到第一个节点组，将连线插入到节点之前（连线在节点下方）
    const firstNodeGroup = container.querySelector('g[data-node-id]');
    if (firstNodeGroup && firstNodeGroup.parentNode === container) {
        container.insertBefore(lineGroup, firstNodeGroup);
    } else {
        container.appendChild(lineGroup);
    }
}

/**
 * 为节点组添加交互监听器（单击选中、双击编辑）
 */
function attachNodeInteractionListeners(nodeGroup, nodeId) {
    // 单击选中
    nodeGroup.addEventListener('click', function(e) {
        e.stopPropagation();
        selectConceptNode(nodeId);
    });
    
    // 双击编辑
    nodeGroup.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        editConceptNodeText(nodeId);
    });
}

/**
 * 添加焦点问题节点到概念图
 */
function addFocusQuestionNode(focusQuestion) {
    console.log('ConceptMap: addFocusQuestionNode 被调用，焦点问题:', focusQuestion);
    
    if (!focusQuestion || !focusQuestion.trim()) {
        console.warn('ConceptMap: 焦点问题为空');
        return null;
    }
    
    // 设置全局焦点问题
    window.focusQuestion = focusQuestion.trim();
    
    // 确保有图数据
    if (!currentGraphData) {
        currentGraphData = { nodes: [], links: [], metadata: {} };
    }
    if (!currentGraphData.nodes) {
        currentGraphData.nodes = [];
    }
    if (!currentGraphData.links) {
        currentGraphData.links = [];
    }
    
    // 检查是否已存在焦点问题节点
    const existingFocusNode = currentGraphData.nodes.find(n => n.id === 'focus-question-node' || n.isFocusQuestion);
    if (existingFocusNode) {
        // 更新现有焦点问题节点
        existingFocusNode.label = `焦点问题：${focusQuestion.trim()}`;
        // 关键修复：使用固定宽度 1400px
        const newWidth = 1400; // 固定宽度 1400px
        const newHeight = 60; // 固定高度 60px
        existingFocusNode.width = newWidth;
        existingFocusNode.height = newHeight;
        // 更新 DOM
        const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
        const container = svg?.querySelector('.zoom-group') || svg;
        if (container) {
            const focusGroup = container.querySelector('[data-node-id="focus-question-node"]');
            if (focusGroup) {
                const textElement = focusGroup.querySelector('text');
                if (textElement) {
                    textElement.textContent = existingFocusNode.label;
                }
                const rectElement = focusGroup.querySelector('rect');
                if (rectElement) {
                    rectElement.setAttribute('width', newWidth);
                    rectElement.setAttribute('height', newHeight);
                    rectElement.setAttribute('x', -newWidth / 2);
                    rectElement.setAttribute('y', -newHeight / 2);
                }
                // 再次基于真实文字宽度自适应（避免文字过长仍溢出）
                requestAnimationFrame(() => resizeFocusGroup(focusGroup, existingFocusNode));
            }
        }
        console.log('ConceptMap: 更新现有焦点问题节点');
        showMessage(`焦点问题已更新为：${focusQuestion.trim()}`);
        return existingFocusNode;
    }
    
    // 获取 SVG 尺寸
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    let svgWidth = 1600;
    if (svg) {
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(' ');
            if (parts.length === 4) {
                svgWidth = parseFloat(parts[2]) || svgWidth;
            }
        } else {
            svgWidth = parseFloat(svg.getAttribute('width')) || svgWidth;
        }
    }
    
    // 计算焦点问题节点尺寸
    // 关键修复：使用固定宽度 1400px，确保焦点问题框足够长
    const focusLabel = `焦点问题：${focusQuestion.trim()}`;
    const nodeWidth = 1400; // 固定宽度 1400px，用户要求的很长的焦点问题框
    const nodeHeight = 60; // 固定高度 60px
    
    // 焦点问题节点位置（画布顶部中央）
    const x = svgWidth / 2;
    const y = 80;
    
    // 创建焦点问题节点
    const focusNode = {
        id: 'focus-question-node',
        label: focusLabel,
        x: x,
        y: y,
        width: nodeWidth,
        height: nodeHeight,
        layer: 0,
        type: 'focus-question',
        isFocusQuestion: true
    };
    
    // 添加到数据
    currentGraphData.nodes.unshift(focusNode); // 添加到数组开头
    window.currentGraphData = currentGraphData;
    
    // 渲染焦点问题节点
    const container = svg?.querySelector('.zoom-group') || svg;
    if (container) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-node-id', focusNode.id);
        g.setAttribute('transform', `translate(${focusNode.x}, ${focusNode.y})`);
        
        // 创建圆角矩形（移植自 concept-map-new-master 样式）
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -nodeWidth / 2);
        rect.setAttribute('y', -nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('rx', 10); // 移植：圆角从12改为10
        rect.setAttribute('ry', 10);
        rect.setAttribute('fill', '#f8f9fa'); // 移植：浅灰色背景
        rect.setAttribute('fill-opacity', '0.9'); // 移植：透明度0.9
        rect.setAttribute('stroke', '#667eea'); // 移植：紫蓝色边框
        rect.setAttribute('stroke-width', '2'); // 移植：边框宽度2
        rect.setAttribute('cursor', 'move'); // 移植：拖拽光标
        g.appendChild(rect);
        
        // 创建文字（移植自 concept-map-new-master 样式）
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '28'); // 移植：字体大小28
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', '#2c3e50'); // 移植：深灰色文字
        text.setAttribute('pointer-events', 'none');
        text.textContent = focusLabel;
        g.appendChild(text);
        
        container.appendChild(g);

        // 创建后基于实际文字宽度再次调整矩形尺寸，防止长文本溢出
        requestAnimationFrame(() => resizeFocusGroup(g, focusNode));
        
        // 添加拖动和交互监听器
        if (typeof attachDragListeners === 'function') {
            attachDragListeners(g, focusNode.id);
        }
        if (typeof attachNodeInteractionListeners === 'function') {
            attachNodeInteractionListeners(g, focusNode.id);
        }
    }
    
    // 保存到历史记录
    saveToHistory(currentGraphData);
    
    console.log('ConceptMap: 焦点问题节点已添加');
    showMessage(`焦点问题已添加：${focusQuestion.trim()}`);
    
    return focusNode;
}

/**
 * 根据文字真实尺寸调整焦点问题框大小（移植自 concept-map-new-master）
 * @param {SVGGElement} focusGroup 
 * @param {Object} focusNode 数据对象（含 label、width、height）
 */
function resizeFocusGroup(focusGroup, focusNode) {
    if (!focusGroup || !focusNode) return;
    const textEl = focusGroup.querySelector('text');
    const rectEl = focusGroup.querySelector('rect');
    if (!textEl || !rectEl) return;

    // 关键修复：使用固定宽度 1400px，不再根据文字宽度动态计算
    const newWidth = 1400; // 固定宽度 1400px
    const newHeight = 60; // 固定高度 60px

    rectEl.setAttribute('width', newWidth);
    rectEl.setAttribute('height', newHeight);
    rectEl.setAttribute('x', -newWidth / 2);
    rectEl.setAttribute('y', -newHeight / 2);

    // 同步更新数据对象，后续布局可用
    focusNode.width = newWidth;
    focusNode.height = newHeight;
}

/**
 * 添加新节点到概念图
 */
function addNewNode() {
    console.log('ConceptMap: addNewNode 函数被调用');
    
    // 确保有图数据
    if (!currentGraphData) {
        currentGraphData = { nodes: [], links: [], metadata: {} };
    }
    if (!currentGraphData.nodes) {
        currentGraphData.nodes = [];
    }
    if (!currentGraphData.links) {
        currentGraphData.links = [];
    }
    
    // 生成新节点ID
    const existingIds = currentGraphData.nodes.map(n => {
        const match = n.id.match(/node-concept-(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : -1;
    const newNodeId = `node-concept-${maxId + 1}`;
    
    console.log('ConceptMap: 新节点ID:', newNodeId);
    
    // 获取 SVG 尺寸
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    let svgWidth = 1600, svgHeight = 800;
    if (svg) {
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(' ');
            if (parts.length === 4) {
                svgWidth = parseFloat(parts[2]) || svgWidth;
                svgHeight = parseFloat(parts[3]) || svgHeight;
            }
        }
    }
    
    // 计算新节点位置（在画布中央区域随机位置）
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    const x = centerX + (Math.random() - 0.5) * 400;
    const y = centerY + (Math.random() - 0.5) * 200;
    
    // 计算节点尺寸
    const newLabel = `新概念${maxId + 2}`;
    const dims = calculateNodeDimensions(newLabel);
    
    // 创建新节点
    const newNode = {
        id: newNodeId,
        label: newLabel,
        x: x,
        y: y,
        width: dims.width,
        height: dims.height,
        layer: 2,
        type: 'concept'
    };
    
    console.log('ConceptMap: 新节点对象:', newNode);
    
    // 添加到数据
    currentGraphData.nodes.push(newNode);
    window.currentGraphData = currentGraphData;
    
    console.log('ConceptMap: 节点已添加，当前节点数量:', currentGraphData.nodes.length);
    
    // 直接在 SVG 中添加节点（不重新渲染整个图）
    if (svg) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-node-id', newNode.id);
        g.setAttribute('transform', `translate(${newNode.x}, ${newNode.y})`);
        
        const nodeWidth = newNode.width;
        const nodeHeight = newNode.height;
        const radius = 10;
        
        // 创建圆角矩形
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -nodeWidth / 2);
        rect.setAttribute('y', -nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('rx', radius);
        rect.setAttribute('ry', radius);
        rect.setAttribute('fill', '#667eea');
        rect.setAttribute('fill-opacity', '0.9');
        rect.setAttribute('stroke', '#fff');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('cursor', 'pointer');
        g.appendChild(rect);
        
        // 创建文字
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '24');
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', 'white');
        text.setAttribute('pointer-events', 'none');
        text.textContent = newNode.label;
        g.appendChild(text);
        
        // 找到合适的容器添加节点（考虑 zoom-group 的情况）
        const zoomGroup = svg.querySelector('g.zoom-group');
        const container = zoomGroup || svg;
        container.appendChild(g);
        
        // 添加拖动监听器
        attachDragListeners(g, newNode.id);
        
        // 添加交互监听器（单击选中、双击编辑）
        attachNodeInteractionListeners(g, newNode.id);
        
        console.log('ConceptMap: 节点已渲染到画布');
    }
    
    // 保存到历史记录（支持撤销）
    saveToHistory(currentGraphData);
    console.log('ConceptMap: 历史记录已保存');
    
    // 显示消息
    if (typeof showMessage === 'function') {
        showMessage('新节点已添加', 'success');
    }
    
    console.log('ConceptMap: addNewNode 函数执行完成');
    return newNode;
}

/**
 * 在指定位置添加概念节点（用于拖拽放置）
 * @param {string} conceptText - 概念文本
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 */
function addConceptNodeAtPosition(conceptText, x, y) {
    console.log('ConceptMap: addConceptNodeAtPosition', { conceptText, x, y });
    
    // 确保有图数据
    if (!currentGraphData) {
        currentGraphData = { nodes: [], links: [], metadata: {} };
    }
    if (!currentGraphData.nodes) {
        currentGraphData.nodes = [];
    }
    if (!currentGraphData.links) {
        currentGraphData.links = [];
    }
    
    // 生成新节点ID
    const existingIds = currentGraphData.nodes.map(n => {
        const match = n.id.match(/node-concept-(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : -1;
    const newNodeId = `node-concept-${maxId + 1}`;
    
    // 计算节点尺寸
    const dims = calculateNodeDimensions(conceptText);
    
    // 创建新节点
    const newNode = {
        id: newNodeId,
        label: conceptText,
        x: x,
        y: y,
        width: dims.width,
        height: dims.height,
        layer: 2,
        type: 'concept'
    };
    
    // 添加到数据
    currentGraphData.nodes.push(newNode);
    window.currentGraphData = currentGraphData;
    
    console.log('ConceptMap: 新概念节点已添加到数据，ID:', newNodeId);
    
    // 在 SVG 中渲染节点
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-node-id', newNode.id);
        g.setAttribute('transform', `translate(${newNode.x}, ${newNode.y})`);
        
        const nodeWidth = newNode.width;
        const nodeHeight = newNode.height;
        const radius = 10;
        
        // 创建圆角矩形
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -nodeWidth / 2);
        rect.setAttribute('y', -nodeHeight / 2);
        rect.setAttribute('width', nodeWidth);
        rect.setAttribute('height', nodeHeight);
        rect.setAttribute('rx', radius);
        rect.setAttribute('ry', radius);
        rect.setAttribute('fill', '#667eea');
        rect.setAttribute('fill-opacity', '0.9');
        rect.setAttribute('stroke', '#fff');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('cursor', 'pointer');
        g.appendChild(rect);
        
        // 创建文字
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '24');
        text.setAttribute('font-weight', '500');
        text.setAttribute('fill', 'white');
        text.setAttribute('pointer-events', 'none');
        text.textContent = newNode.label;
        g.appendChild(text);
        
        // 找到合适的容器添加节点
        const zoomGroup = svg.querySelector('g.zoom-group');
        const container = zoomGroup || svg;
        container.appendChild(g);
        
        // 添加拖动监听器
        attachDragListeners(g, newNode.id);
        
        // 添加交互监听器
        attachNodeInteractionListeners(g, newNode.id);
        
        console.log('ConceptMap: 概念节点已渲染到画布');
    }
    
    // 保存到历史记录
    saveToHistory(currentGraphData);
    
    // 显示消息
    if (typeof showMessage === 'function') {
        showMessage(`已添加概念: ${conceptText}`, 'success');
    }
    
    return newNode;
}

// 导出到全局
window.addConceptNodeAtPosition = addConceptNodeAtPosition;

// ============================================================================
// 连线选中和编辑功能（移植自 concept-map-new-master/web/interactions.js）
// ============================================================================

// 当前选中的连线ID
let selectedLinkId = null;

/**
 * 双击编辑连接词
 */
function editLinkLabel(linkId) {
    const link = currentGraphData?.links?.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
    if (!link) {
        console.error('ConceptMap: 连线未找到:', linkId);
        return;
    }
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) {
        console.error('ConceptMap: SVG 元素未找到');
        return;
    }
    
    const svgRect = svg.getBoundingClientRect();

    // 找到连接线标签元素
    const linkLabel = svg.querySelector(`text[data-link-id="${linkId}"]`);
    if (!linkLabel) {
        console.error('ConceptMap: 连线标签未找到:', linkId);
        return;
    }

    // 获取标签的位置
    const labelX = parseFloat(linkLabel.getAttribute('x'));
    const labelY = parseFloat(linkLabel.getAttribute('y'));

    // 将SVG坐标转换为页面坐标
    const pt = svg.createSVGPoint();
    pt.x = labelX;
    pt.y = labelY;
    const screenPt = pt.matrixTransform(svg.getScreenCTM());

    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = link.label || '';
    input.placeholder = '输入连接词';
    input.style.cssText = `
        position: fixed;
        left: ${screenPt.x - 60}px;
        top: ${screenPt.y - 15}px;
        width: 120px;
        height: 30px;
        border: 2px solid #667eea;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12px;
        font-family: inherit;
        z-index: 10000;
        background: white;
        text-align: center;
        box-sizing: border-box;
        outline: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(input);
    input.focus();
    input.select();

    // 防止重复保存的标志
    let isSaved = false;

    // 保存编辑结果
    function saveEdit() {
        // 防止重复调用
        if (isSaved) return;
        isSaved = true;
        
        const newLabel = input.value.trim();
        link.label = newLabel;
        
        // 更新标签显示
        linkLabel.textContent = newLabel || '双击编辑';
        
        // 移除输入框
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
        
        // 更新全局变量
        window.currentGraphData = currentGraphData;
        
        // 保存到历史记录（支持撤销）
        saveToHistory(currentGraphData);
        
        console.log('ConceptMap: 连接词已更新:', linkId, newLabel);
    }

    // 处理键盘事件
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            isSaved = true; // 标记为已处理，防止 blur 再次触发保存
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        }
    });

    // 处理失焦事件
    input.addEventListener('blur', function() {
        if (!isSaved && document.body.contains(input)) {
            saveEdit();
        }
    });
}

/**
 * 编辑聚合连接的标签（移植自 concept-map-new-master/web/renderer.js）
 * @param {Object} group - 聚合连接组
 */
function editAggregateLinkLabel(group) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    const uniqueKey = `${group.sourceId}_${group.label}`;
    const labelElement = svg.querySelector(`text[data-aggregate-label="true"][data-aggregate-key="${uniqueKey}"]`);
    if (!labelElement) {
        console.error('ConceptMap: 聚合连接标签未找到:', uniqueKey);
        return;
    }
    
    const currentLabel = group.label;
    const labelX = parseFloat(labelElement.getAttribute('x'));
    const labelY = parseFloat(labelElement.getAttribute('y'));
    
    // 将SVG坐标转换为页面坐标
    const pt = svg.createSVGPoint();
    pt.x = labelX;
    pt.y = labelY;
    const screenPt = pt.matrixTransform(svg.getScreenCTM());
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentLabel;
    input.placeholder = '输入连接词';
    input.style.cssText = `
        position: fixed;
        left: ${screenPt.x - 60}px;
        top: ${screenPt.y - 15}px;
        width: 120px;
        height: 30px;
        border: 2px solid #667eea;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12px;
        font-family: inherit;
        z-index: 10000;
        background: white;
        text-align: center;
        box-sizing: border-box;
        outline: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(input);
    input.focus();
    input.select();
    
    let isSaved = false;
    
    const finishEdit = () => {
        if (isSaved) return;
        isSaved = true;
        
        const newLabel = input.value.trim();
        if (newLabel && newLabel !== currentLabel) {
            // 更新所有相关连线的标签
            group.links.forEach(link => {
                link.label = newLabel;
            });
            
            // 更新显示
            labelElement.textContent = newLabel;
            
            // 更新聚合组的属性
            const oldUniqueKey = `${group.sourceId}_${group.label}`;
            const aggregateGroup = svg.querySelector(`g[data-aggregate-group="true"][data-aggregate-key="${oldUniqueKey}"]`);
            if (aggregateGroup) {
                const newUniqueKey = `${group.sourceId}_${newLabel}`;
                aggregateGroup.setAttribute('data-label', newLabel);
                aggregateGroup.setAttribute('data-aggregate-key', newUniqueKey);
                labelElement.setAttribute('data-aggregate-key', newUniqueKey);
            }
            
            // 更新 group 对象的标签
            group.label = newLabel;
            
            // 更新全局数据
            window.currentGraphData = currentGraphData;
            
            // 保存到历史记录（支持撤销）
            saveToHistory(currentGraphData);
            
            console.log('ConceptMap: 聚合连接标签已更新:', oldUniqueKey, '->', newLabel);
        }
        
        // 移除输入框
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
    };
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            isSaved = true;
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        }
    });
    
    input.addEventListener('blur', function() {
        if (!isSaved && document.body.contains(input)) {
            finishEdit();
        }
    });
}

/**
 * 单击选中连线
 */
function selectLink(linkId) {
    console.log('ConceptMap: 选中连线:', linkId);
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 取消节点选中（节点和连线选中互斥）
    deselectConceptNode();
    
    // 取消聚合连接选中
    deselectAggregateLink();
    
    // 清除节点选择状态
    if (window.stateManager && typeof window.stateManager.selectNodes === 'function') {
        window.stateManager.selectNodes([]);
    }
    
    // 先取消所有连线的选中状态（恢复到用户设置的样式）
    const allLinks = svg.querySelectorAll('g[data-link-id]');
    allLinks.forEach(linkGroup => {
        const line = linkGroup.querySelector('path:first-child');
        const arrow = linkGroup.querySelector('path:nth-child(2)');
        if (line) {
            // 恢复到用户设置的样式，而不是默认值
            const savedColor = line.getAttribute('data-user-color') || '#aaa';
            const savedWidth = line.getAttribute('data-user-width') || '2';
            line.setAttribute('stroke', savedColor);
            line.setAttribute('stroke-width', savedWidth);
        }
        if (arrow) {
            const savedColor = arrow.getAttribute('data-user-color') || '#aaa';
            arrow.setAttribute('fill', savedColor);
            arrow.setAttribute('stroke', savedColor);
        }
    });

    // 移除之前的连接词手柄
    removeLinkLabelHandles();
    
    // 选中新连线
    selectedLinkId = linkId;
    const linkGroup = svg.querySelector(`g[data-link-id="${linkId}"]`);
    if (linkGroup) {
        const line = linkGroup.querySelector('path:first-child');
        const arrow = linkGroup.querySelector('path:nth-child(2)');
        
        // 获取连线数据（用于初始化用户设置）
        const link = currentGraphData?.links?.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
        
        if (line) {
            // 如果还没有保存用户设置，使用数据中的值或当前值进行初始化
            if (!line.hasAttribute('data-user-color')) {
                const currentColor = link?.lineColor || line.getAttribute('stroke') || '#aaa';
                line.setAttribute('data-user-color', currentColor);
            }
            if (!line.hasAttribute('data-user-width')) {
                const currentWidth = link?.lineWidth || line.getAttribute('stroke-width') || '2';
                line.setAttribute('data-user-width', currentWidth);
            }
            if (!line.hasAttribute('data-user-opacity')) {
                const currentOpacity = link?.opacity || line.getAttribute('opacity') || '1';
                line.setAttribute('data-user-opacity', currentOpacity);
            }
            
            // 设置选中高亮样式
            line.setAttribute('stroke', '#ffd700'); // 金色表示选中
            line.setAttribute('stroke-width', '3'); // 加粗
        }
        if (arrow) {
            // 如果还没有保存用户设置，使用数据中的值或当前值进行初始化
            if (!arrow.hasAttribute('data-user-color')) {
                const currentColor = link?.lineColor || arrow.getAttribute('fill') || '#aaa';
                arrow.setAttribute('data-user-color', currentColor);
            }
            if (!arrow.hasAttribute('data-user-opacity')) {
                const currentOpacity = link?.opacity || arrow.getAttribute('opacity') || '1';
                arrow.setAttribute('data-user-opacity', currentOpacity);
            }
            
            arrow.setAttribute('fill', '#ffd700');
            arrow.setAttribute('stroke', '#ffd700');
        }
        
        // 添加连接词手柄
        addLinkLabelHandles(linkId);
        
        // 获取连线的当前样式（使用保存的用户设置或数据中的值）
        const linkLabel = linkGroup.querySelector('text[data-link-label="true"]');
        const linkData = {
            linkId: linkId,
            label: link?.label || linkLabel?.textContent || '',
            lineColor: line?.getAttribute('data-user-color') || link?.lineColor || '#aaa',
            lineWidth: line?.getAttribute('data-user-width') || link?.lineWidth || '2',
            textColor: link?.textColor || linkLabel?.getAttribute('fill') || '#333',
            fontSize: link?.fontSize || linkLabel?.getAttribute('font-size') || '24',
            fontFamily: link?.fontFamily || linkLabel?.getAttribute('font-family') || 'Inter, sans-serif',
            fontWeight: link?.fontWeight || linkLabel?.getAttribute('font-weight') || '500',
            fontStyle: link?.fontStyle || linkLabel?.getAttribute('font-style') || 'normal',
            textDecoration: link?.textDecoration || linkLabel?.getAttribute('text-decoration') || 'none',
            opacity: line?.getAttribute('data-user-opacity') || link?.opacity || '1'
        };
        
        // 触发连线选择事件，打开属性面板
        if (window.eventBus) {
            window.eventBus.emit('link:selected', {
                linkId: linkId,
                linkData: linkData,
                diagramType: 'concept_map'
            });
        }
    }

    console.log('ConceptMap: 连线已选中:', linkId);
}

/**
 * 获取当前选中的连线ID
 */
function getSelectedLinkId() {
    return selectedLinkId;
}

/**
 * 更新连线样式（支持普通连线和聚合连接）
 */
function updateLinkStyle(linkId, styles) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 检查是否是聚合连接
    if (linkId.startsWith('aggregate-')) {
        updateAggregateLinkStyle(linkId.replace('aggregate-', ''), styles);
        return;
    }
    
    const linkGroup = svg.querySelector(`g[data-link-id="${linkId}"]`);
    if (!linkGroup) return;
    
    const line = linkGroup.querySelector('path:first-child');
    const arrow = linkGroup.querySelector('path:nth-child(2)');
    const linkLabel = linkGroup.querySelector('text[data-link-label="true"]');
    
    // 更新连线颜色并保存用户设置
    if (styles.lineColor !== undefined) {
        if (line) {
            line.setAttribute('stroke', styles.lineColor);
            line.setAttribute('data-user-color', styles.lineColor);  // 保存用户设置
        }
        if (arrow) {
            arrow.setAttribute('fill', styles.lineColor);
            arrow.setAttribute('stroke', styles.lineColor);
            arrow.setAttribute('data-user-color', styles.lineColor);  // 保存用户设置
        }
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.lineColor = styles.lineColor;
            }
        }
    }
    
    // 更新连线宽度并保存用户设置
    if (styles.lineWidth !== undefined) {
        if (line) {
            line.setAttribute('stroke-width', styles.lineWidth);
            line.setAttribute('data-user-width', styles.lineWidth);  // 保存用户设置
        }
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.lineWidth = styles.lineWidth;
            }
        }
    }
    
    // 更新透明度并保存用户设置
    if (styles.opacity !== undefined) {
        if (line) {
            line.setAttribute('opacity', styles.opacity);
            line.setAttribute('data-user-opacity', styles.opacity);  // 保存用户设置
        }
        if (arrow) {
            arrow.setAttribute('opacity', styles.opacity);
            arrow.setAttribute('data-user-opacity', styles.opacity);  // 保存用户设置
        }
        if (linkLabel) {
            linkLabel.setAttribute('opacity', styles.opacity);
        }
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.opacity = styles.opacity;
            }
        }
    }
    
    // 更新文字颜色并保存用户设置
    if (styles.textColor !== undefined && linkLabel) {
        linkLabel.setAttribute('fill', styles.textColor);
        linkLabel.setAttribute('data-user-text-color', styles.textColor);  // 保存用户设置
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.textColor = styles.textColor;
            }
        }
    }
    
    // 更新文字内容
    if (styles.label !== undefined && linkLabel) {
        linkLabel.textContent = styles.label;
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.label = styles.label;
            }
        }
    }
    
    // 更新字体大小
    if (styles.fontSize !== undefined && linkLabel) {
        linkLabel.setAttribute('font-size', styles.fontSize);
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.fontSize = styles.fontSize;
            }
        }
    }
    
    // 更新字体
    if (styles.fontFamily !== undefined && linkLabel) {
        linkLabel.setAttribute('font-family', styles.fontFamily);
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.fontFamily = styles.fontFamily;
            }
        }
    }
    
    // 更新字体粗细
    if (styles.fontWeight !== undefined && linkLabel) {
        linkLabel.setAttribute('font-weight', styles.fontWeight);
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.fontWeight = styles.fontWeight;
            }
        }
    }
    
    // 更新字体样式（斜体）
    if (styles.fontStyle !== undefined && linkLabel) {
        linkLabel.setAttribute('font-style', styles.fontStyle);
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.fontStyle = styles.fontStyle;
            }
        }
    }
    
    // 更新文字装饰（下划线、删除线）
    if (styles.textDecoration !== undefined && linkLabel) {
        linkLabel.setAttribute('text-decoration', styles.textDecoration);
        // 同步更新数据
        if (currentGraphData?.links) {
            const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
            if (link) {
                link.textDecoration = styles.textDecoration;
            }
        }
    }
    
    console.log('ConceptMap: 连线样式已更新:', linkId, styles);
}

/**
 * 更新聚合连接样式
 */
function updateAggregateLinkStyle(aggregateKey, styles) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    const aggregateGroup = svg.querySelector(`g[data-aggregate-key="${aggregateKey}"]`);
    if (!aggregateGroup) return;
    
    const lines = aggregateGroup.querySelectorAll('line');
    const arrows = aggregateGroup.querySelectorAll('path');
    const labelText = aggregateGroup.querySelector('text[data-aggregate-label="true"]');
    
    // 更新连线颜色
    if (styles.lineColor !== undefined) {
        lines.forEach(line => {
            line.setAttribute('stroke', styles.lineColor);
            line.setAttribute('data-user-color', styles.lineColor);
        });
        arrows.forEach(arrow => {
            arrow.setAttribute('fill', styles.lineColor);
            arrow.setAttribute('stroke', styles.lineColor);
            arrow.setAttribute('data-user-color', styles.lineColor);
        });
    }
    
    // 更新连线宽度
    if (styles.lineWidth !== undefined) {
        lines.forEach(line => {
            line.setAttribute('stroke-width', styles.lineWidth);
            line.setAttribute('data-user-width', styles.lineWidth);
        });
    }
    
    // 更新透明度
    if (styles.opacity !== undefined) {
        lines.forEach(line => {
            line.setAttribute('opacity', styles.opacity);
            line.setAttribute('data-user-opacity', styles.opacity);
        });
        arrows.forEach(arrow => {
            arrow.setAttribute('opacity', styles.opacity);
            arrow.setAttribute('data-user-opacity', styles.opacity);
        });
        if (labelText) {
            labelText.setAttribute('opacity', styles.opacity);
        }
        aggregateGroup.setAttribute('data-user-opacity', styles.opacity);
    }
    
    // 更新文字颜色
    if (styles.textColor !== undefined && labelText) {
        labelText.setAttribute('fill', styles.textColor);
        labelText.setAttribute('data-user-text-color', styles.textColor);
    }
    
    // 更新文字内容（聚合连接的标签）
    if (styles.label !== undefined && labelText) {
        labelText.textContent = styles.label;
        aggregateGroup.setAttribute('data-label', styles.label);
        
        // 同步更新相关连线的标签
        if (selectedAggregateGroup && selectedAggregateGroup.links) {
            selectedAggregateGroup.links.forEach(link => {
                link.label = styles.label;
            });
            selectedAggregateGroup.label = styles.label;
        }
    }
    
    // 更新字体大小
    if (styles.fontSize !== undefined && labelText) {
        labelText.setAttribute('font-size', styles.fontSize);
    }
    
    // 更新字体族
    if (styles.fontFamily !== undefined && labelText) {
        labelText.setAttribute('font-family', styles.fontFamily);
    }
    
    // 更新字体粗细
    if (styles.fontWeight !== undefined && labelText) {
        labelText.setAttribute('font-weight', styles.fontWeight);
    }
    
    // 更新字体样式（斜体）
    if (styles.fontStyle !== undefined && labelText) {
        labelText.setAttribute('font-style', styles.fontStyle);
    }
    
    // 更新文字装饰（下划线、删除线）
    if (styles.textDecoration !== undefined && labelText) {
        labelText.setAttribute('text-decoration', styles.textDecoration);
    }
    
    // 将样式保存到 currentGraphData.links 中的对应连线数据
    // 这样当重新绘制聚合连接时可以从数据中读取
    if (currentGraphData && currentGraphData.links) {
        // 解析 aggregateKey 获取 sourceId 和 label
        const parts = aggregateKey.split('_');
        const sourceId = parts[0];
        const label = parts.slice(1).join('_');
        
        // 找到所有匹配的连线并更新样式
        currentGraphData.links.forEach(link => {
            const linkSourceId = getLinkNodeId(link.source);
            if (linkSourceId === sourceId && (link.label === label || (!link.label && label === '双击编辑'))) {
                // 保存样式到连线数据
                if (styles.lineColor !== undefined) link.lineColor = styles.lineColor;
                if (styles.lineWidth !== undefined) link.lineWidth = styles.lineWidth;
                if (styles.textColor !== undefined) link.textColor = styles.textColor;
                if (styles.fontSize !== undefined) link.fontSize = styles.fontSize;
                if (styles.fontFamily !== undefined) link.fontFamily = styles.fontFamily;
                if (styles.fontWeight !== undefined) link.fontWeight = styles.fontWeight;
                if (styles.fontStyle !== undefined) link.fontStyle = styles.fontStyle;
                if (styles.textDecoration !== undefined) link.textDecoration = styles.textDecoration;
                if (styles.opacity !== undefined) link.opacity = styles.opacity;
                if (styles.label !== undefined) link.label = styles.label;
            }
        });
        
        // 更新全局变量
        window.currentGraphData = currentGraphData;
    }
    
    console.log('ConceptMap: 聚合连接样式已更新:', aggregateKey, styles);
}

// 暴露给全局
window.updateLinkStyle = updateLinkStyle;
window.updateAggregateLinkStyle = updateAggregateLinkStyle;
window.getSelectedLinkId = getSelectedLinkId;

/**
 * 取消选中连线
 */
function deselectLink() {
    if (!selectedLinkId) return;
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    const linkGroup = svg.querySelector(`g[data-link-id="${selectedLinkId}"]`);
    if (linkGroup) {
        const line = linkGroup.querySelector('path:first-child');
        const arrow = linkGroup.querySelector('path:nth-child(2)');
        if (line) {
            // 恢复到用户设置的样式，而不是默认值
            const savedColor = line.getAttribute('data-user-color') || '#aaa';
            const savedWidth = line.getAttribute('data-user-width') || '2';
            const savedOpacity = line.getAttribute('data-user-opacity') || '1';
            line.setAttribute('stroke', savedColor);
            line.setAttribute('stroke-width', savedWidth);
            line.setAttribute('opacity', savedOpacity);
        }
        if (arrow) {
            const savedColor = arrow.getAttribute('data-user-color') || '#aaa';
            const savedOpacity = arrow.getAttribute('data-user-opacity') || '1';
            arrow.setAttribute('fill', savedColor);
            arrow.setAttribute('stroke', savedColor);
            arrow.setAttribute('opacity', savedOpacity);
        }
    }
    
    selectedLinkId = null;
    
    // 移除连接词手柄
    removeLinkLabelHandles();
}

// 当前选中的聚合连接key
let selectedAggregateKey = null;
let selectedAggregateGroup = null;

/**
 * 单击选中聚合连接
 */
function selectAggregateLink(aggregateKey, group) {
    console.log('ConceptMap: 选中聚合连接:', aggregateKey);
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 取消节点选中（节点和连线选中互斥）
    deselectConceptNode();
    
    // 取消普通连线选中
    deselectLink();
    
    // 取消之前的聚合连接选中
    deselectAggregateLink();
    
    // 选中新的聚合连接
    selectedAggregateKey = aggregateKey;
    selectedAggregateGroup = group;
    
    const aggregateGroupEl = svg.querySelector(`g[data-aggregate-key="${aggregateKey}"]`);
    if (aggregateGroupEl) {
        // 高亮主线和分支线（先保存原始样式）
        const lines = aggregateGroupEl.querySelectorAll('line');
        lines.forEach(line => {
            // 保存原始样式（如果还没有保存）
            if (!line.hasAttribute('data-user-color')) {
                line.setAttribute('data-user-color', line.getAttribute('stroke') || '#aaa');
            }
            if (!line.hasAttribute('data-user-width')) {
                line.setAttribute('data-user-width', line.getAttribute('stroke-width') || '2');
            }
            if (!line.hasAttribute('data-user-opacity')) {
                line.setAttribute('data-user-opacity', line.getAttribute('opacity') || '1');
            }
            // 设置高亮
            line.setAttribute('stroke', '#ffd700');
            line.setAttribute('stroke-width', '3');
        });
        
        // 高亮箭头（先保存原始样式）
        const arrows = aggregateGroupEl.querySelectorAll('path');
        arrows.forEach(arrow => {
            // 保存原始样式（如果还没有保存）
            if (!arrow.hasAttribute('data-user-color')) {
                arrow.setAttribute('data-user-color', arrow.getAttribute('fill') || '#aaa');
            }
            if (!arrow.hasAttribute('data-user-opacity')) {
                arrow.setAttribute('data-user-opacity', arrow.getAttribute('opacity') || '1');
            }
            // 设置高亮
            arrow.setAttribute('fill', '#ffd700');
            arrow.setAttribute('stroke', '#ffd700');
        });
        
        // 添加聚合连接手柄
        addAggregateLabelHandles(aggregateKey, group);
        
        // 获取聚合连接的标签元素用于读取属性
        const labelText = aggregateGroupEl.querySelector('text[data-aggregate-label="true"]');
        const mainLine = aggregateGroupEl.querySelector('line');
        
        // 构建连接数据用于属性面板
        const linkData = {
            linkId: `aggregate-${aggregateKey}`,
            label: group.label || '',
            lineColor: mainLine?.getAttribute('data-user-color') || '#aaa',
            lineWidth: mainLine?.getAttribute('data-user-width') || '2',
            textColor: labelText?.getAttribute('data-user-text-color') || labelText?.getAttribute('fill') || '#333',
            fontSize: labelText?.getAttribute('font-size') || '24',
            fontFamily: labelText?.getAttribute('font-family') || 'Inter, sans-serif',
            fontWeight: labelText?.getAttribute('font-weight') || '500',
            fontStyle: labelText?.getAttribute('font-style') || 'normal',
            textDecoration: labelText?.getAttribute('text-decoration') || 'none',
            opacity: aggregateGroupEl.getAttribute('data-user-opacity') || '1',
            isAggregate: true,
            aggregateKey: aggregateKey,
            aggregateGroup: group
        };
        
        // 触发连线选中事件，打开属性面板
        if (window.eventBus) {
            window.eventBus.emit('link:selected', {
                linkId: `aggregate-${aggregateKey}`,
                linkData: linkData
            });
        }
    }
    
    console.log('ConceptMap: 聚合连接已选中:', aggregateKey);
}

/**
 * 取消选中聚合连接
 */
function deselectAggregateLink() {
    if (!selectedAggregateKey) return;
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    const aggregateGroupEl = svg.querySelector(`g[data-aggregate-key="${selectedAggregateKey}"]`);
    if (aggregateGroupEl) {
        // 恢复主线和分支线颜色（使用保存的用户样式）
        const lines = aggregateGroupEl.querySelectorAll('line');
        lines.forEach(line => {
            const savedColor = line.getAttribute('data-user-color') || '#aaa';
            const savedWidth = line.getAttribute('data-user-width') || '2';
            const savedOpacity = line.getAttribute('data-user-opacity') || '1';
            line.setAttribute('stroke', savedColor);
            line.setAttribute('stroke-width', savedWidth);
            line.setAttribute('opacity', savedOpacity);
        });
        
        // 恢复箭头颜色（使用保存的用户样式）
        const arrows = aggregateGroupEl.querySelectorAll('path');
        arrows.forEach(arrow => {
            const savedColor = arrow.getAttribute('data-user-color') || '#aaa';
            const savedOpacity = arrow.getAttribute('data-user-opacity') || '1';
            arrow.setAttribute('fill', savedColor);
            arrow.setAttribute('stroke', savedColor);
            arrow.setAttribute('opacity', savedOpacity);
        });
    }
    
    selectedAggregateKey = null;
    selectedAggregateGroup = null;
    
    // 移除手柄
    removeLinkLabelHandles();
}

/**
 * 为聚合连接添加手柄
 */
function addAggregateLabelHandles(aggregateKey, group) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 找到聚合连接组
    const aggregateGroupEl = svg.querySelector(`g[data-aggregate-key="${aggregateKey}"]`);
    if (!aggregateGroupEl) return;
    
    // 找到连接词标签
    const labelText = aggregateGroupEl.querySelector('text[data-aggregate-label="true"]');
    if (!labelText) {
        console.log('ConceptMap: 聚合连接没有标签，跳过添加手柄');
        return;
    }
    
    // 获取标签位置和文字宽度
    const labelX = parseFloat(labelText.getAttribute('x')) || 0;
    const labelY = parseFloat(labelText.getAttribute('y')) || 0;
    const textContent = labelText.textContent || '';
    const textWidth = textContent.length * 24 * 0.6; // 估算文字宽度
    
    // 手柄大小和偏移（向外偏移，不遮盖文字）
    const handleOffsetX = Math.max(50, textWidth / 2 + 25); // 水平偏移
    const handleOffsetY = 35; // 垂直偏移
    const handleSize = 10;
    
    // 创建4个手柄（上下左右，向外偏移不遮盖文字）
    const handlePositions = [
        { x: 0, y: -handleOffsetY, direction: 'top' },
        { x: handleOffsetX, y: 0, direction: 'right' },
        { x: 0, y: handleOffsetY, direction: 'bottom' },
        { x: -handleOffsetX, y: 0, direction: 'left' }
    ];
    
    // 创建手柄容器
    const handlesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handlesGroup.setAttribute('class', 'link-label-handles');
    handlesGroup.setAttribute('data-for-aggregate', aggregateKey);
    
    handlePositions.forEach(pos => {
        const handle = createAggregateLabelHandle(labelX + pos.x, labelY + pos.y - 4, handleSize, pos.direction, aggregateKey, group);
        handlesGroup.appendChild(handle);
    });
    
    // 添加到 SVG 最上层
    svg.appendChild(handlesGroup);
    
    console.log('ConceptMap: 已为聚合连接添加手柄:', aggregateKey);
}

/**
 * 创建聚合连接的单个手柄
 */
function createAggregateLabelHandle(x, y, size, direction, aggregateKey, group) {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handle.setAttribute('class', 'link-label-handle');
    handle.setAttribute('data-direction', direction);
    handle.setAttribute('transform', `translate(${x}, ${y})`);
    handle.style.cursor = 'crosshair';
    
    // 绘制箭头图标
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathD = '';
    const arrowSize = size / 2;
    
    switch (direction) {
        case 'top':
            pathD = `M 0 ${-arrowSize} L ${arrowSize} ${arrowSize} L ${-arrowSize} ${arrowSize} Z`;
            break;
        case 'bottom':
            pathD = `M 0 ${arrowSize} L ${arrowSize} ${-arrowSize} L ${-arrowSize} ${-arrowSize} Z`;
            break;
        case 'left':
            pathD = `M ${-arrowSize} 0 L ${arrowSize} ${-arrowSize} L ${arrowSize} ${arrowSize} Z`;
            break;
        case 'right':
            pathD = `M ${arrowSize} 0 L ${-arrowSize} ${-arrowSize} L ${-arrowSize} ${arrowSize} Z`;
            break;
    }
    
    arrowPath.setAttribute('d', pathD);
    arrowPath.setAttribute('fill', '#4a90d9');
    arrowPath.setAttribute('stroke', '#2d6cb5');
    arrowPath.setAttribute('stroke-width', '1');
    handle.appendChild(arrowPath);
    
    // 添加一个更大的透明点击区域
    const clickArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clickArea.setAttribute('r', size);
    clickArea.setAttribute('fill', 'transparent');
    handle.appendChild(clickArea);
    
    // 添加拖拽事件
    addAggregateHandleDragEvents(handle, direction, aggregateKey, group);
    
    return handle;
}

/**
 * 添加聚合连接手柄的拖拽事件
 */
function addAggregateHandleDragEvents(handle, direction, aggregateKey, group) {
    handle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        console.log('ConceptMap: 开始从聚合连接拖拽添加更多节点');
        
        // 进入拖拽模式
        isLinkHandleDragging = true;
        // 存储聚合连接信息而不是普通连线ID
        linkHandleSourceLinkId = null;
        window._aggregateDragGroup = group;  // 临时存储聚合组信息
        
        // 获取起始位置
        const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
        if (!svg) return;
        
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
        
        // 创建虚拟连接线
        linkHandleVirtualLine = createLinkHandleVirtualLine(svgPt.x, svgPt.y);
        
        // 添加全局事件监听
        document.addEventListener('mousemove', handleLinkHandleDrag);
        document.addEventListener('mouseup', handleAggregateHandleDragEnd);
        
        // 防止文本选择
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
    });
}

/**
 * 处理聚合连接手柄拖拽结束
 */
function handleAggregateHandleDragEnd(e) {
    if (!isLinkHandleDragging) return;
    
    console.log('ConceptMap: 聚合连接手柄拖拽结束');
    
    // 恢复页面样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // 移除全局事件监听
    document.removeEventListener('mousemove', handleLinkHandleDrag);
    document.removeEventListener('mouseup', handleAggregateHandleDragEnd);
    
    // 移除高亮
    const highlighted = document.querySelector('.node-hover-highlight');
    if (highlighted) {
        highlighted.classList.remove('node-hover-highlight');
        const rect = highlighted.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke', rect.getAttribute('data-original-stroke') || '#4a90d9');
            rect.setAttribute('stroke-width', rect.getAttribute('data-original-stroke-width') || '2');
        }
    }
    
    // 检查鼠标是否在目标节点上
    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    const targetNodeGroup = targetElement?.closest('g[data-node-id]');
    
    const group = window._aggregateDragGroup;
    
    if (targetNodeGroup && group) {
        const targetNodeId = targetNodeGroup.getAttribute('data-node-id');
        const sourceId = group.sourceId;
        
        // 检查目标节点是否已经在聚合连接中
        const existingTargetIds = group.links.map(link => getLinkNodeId(link.target));
        
        if (targetNodeId !== sourceId && 
            targetNodeId !== 'focus-question-node' && 
            !existingTargetIds.includes(targetNodeId)) {
            // 添加新节点到聚合连接
            addNodeToAggregateGroup(group, targetNodeId);
        } else if (targetNodeId === 'focus-question-node') {
            console.log('ConceptMap: 不能连接到焦点问题节点');
            if (typeof showMessage === 'function') {
                showMessage('焦点问题框不能与其他节点建立连接');
            }
        } else if (existingTargetIds.includes(targetNodeId)) {
            console.log('ConceptMap: 该节点已经在聚合连接中');
            if (typeof showMessage === 'function') {
                showMessage('该节点已经在聚合连接中', 'info');
            }
        } else {
            console.log('ConceptMap: 不能连接到源节点');
        }
    } else {
        console.log('ConceptMap: 请拖拽到目标节点上完成连接');
    }
    
    // 清理
    window._aggregateDragGroup = null;
    
    // 移除虚拟连接线
    if (linkHandleVirtualLine) {
        linkHandleVirtualLine.remove();
        linkHandleVirtualLine = null;
    }
    
    // 重置状态
    isLinkHandleDragging = false;
    linkHandleSourceLinkId = null;
}

/**
 * 将新节点添加到聚合连接组
 */
function addNodeToAggregateGroup(group, targetNodeId) {
    if (!currentGraphData || !currentGraphData.links) {
        console.error('ConceptMap: 没有图数据');
        return;
    }
    
    const sourceId = group.sourceId;
    const linkLabel = group.label;
    
    // 检查是否已存在相同的连线
    const existingLink = currentGraphData.links.find(link => {
        const linkSourceId = getLinkNodeId(link.source);
        const linkTargetId = getLinkNodeId(link.target);
        return linkSourceId === sourceId && linkTargetId === targetNodeId;
    });
    
    if (existingLink) {
        console.log('ConceptMap: 这两个节点之间已经存在连线');
        if (typeof showMessage === 'function') {
            showMessage('这两个节点之间已经存在连线', 'info');
        }
        return;
    }
    
    // 保存当前状态用于撤销
    saveToHistory(currentGraphData);
    
    // 创建新连线（使用相同的连接词，加入聚合）
    const newLink = {
        id: `link-${sourceId}-${targetNodeId}`,
        source: sourceId,
        target: targetNodeId,
        label: linkLabel,
        isManuallyCreated: true,
        isAggregated: true  // 标记为聚合连接
    };
    
    // 添加到数据中
    currentGraphData.links.push(newLink);
    window.currentGraphData = currentGraphData;
    
    console.log('ConceptMap: 已添加节点到聚合连接:', newLink);
    
    // 重新渲染连线
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg && currentGraphData.nodes) {
        // 清除旧连线和虚拟连线
        svg.querySelectorAll('g[data-link-id]').forEach(g => g.remove());
        svg.querySelectorAll('g[data-aggregate-group="true"]').forEach(g => g.remove());
        svg.querySelectorAll('.link-handle-virtual-line').forEach(v => v.remove());
        svg.querySelectorAll('.link-label-handles').forEach(h => h.remove());
        
        // 重新绘制所有连线
        drawLinks(svg, currentGraphData.nodes, currentGraphData.links, currentGraphData.topic || '');
        
        if (typeof showMessage === 'function') {
            showMessage('已添加到聚合连接', 'success');
        }
    }
    
    // 取消选中
    deselectAggregateLink();
    
    // 发送操作完成事件用于历史记录
    if (window.eventBus) {
        window.eventBus.emit('diagram:operation_completed', {
            operation: 'add_to_aggregate_group',
            snapshot: JSON.parse(JSON.stringify(currentGraphData)),
            diagramType: 'concept_map'
        });
    }
}

// ============================================================================
// 连接词手柄功能 - 支持拖拽创建聚合连接
// ============================================================================

// 连接词拖拽状态
let isLinkHandleDragging = false;
let linkHandleSourceLinkId = null;
let linkHandleVirtualLine = null;

/**
 * 为选中的连接线添加手柄（在连接词周围）
 */
function addLinkLabelHandles(linkId) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 找到连接线组
    const linkGroup = svg.querySelector(`g[data-link-id="${linkId}"]`);
    if (!linkGroup) return;
    
    // 找到连接词标签
    const linkLabel = linkGroup.querySelector('text[data-link-label="true"]');
    if (!linkLabel) {
        console.log('ConceptMap: 连接线没有连接词标签，跳过添加手柄');
        return;
    }
    
    // 获取标签位置和文字宽度
    const labelX = parseFloat(linkLabel.getAttribute('x')) || 0;
    const labelY = parseFloat(linkLabel.getAttribute('y')) || 0;
    const textContent = linkLabel.textContent || '';
    const textWidth = textContent.length * 24 * 0.6; // 估算文字宽度
    
    // 手柄大小和偏移（向外偏移，不遮盖文字）
    const handleOffsetX = Math.max(50, textWidth / 2 + 25); // 水平偏移
    const handleOffsetY = 35; // 垂直偏移
    const handleSize = 10;
    
    // 创建4个手柄（上下左右，向外偏移不遮盖文字）
    const handlePositions = [
        { x: 0, y: -handleOffsetY, direction: 'top' },
        { x: handleOffsetX, y: 0, direction: 'right' },
        { x: 0, y: handleOffsetY, direction: 'bottom' },
        { x: -handleOffsetX, y: 0, direction: 'left' }
    ];
    
    // 创建手柄容器
    const handlesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handlesGroup.setAttribute('class', 'link-label-handles');
    handlesGroup.setAttribute('data-for-link', linkId);
    
    handlePositions.forEach(pos => {
        const handle = createLinkLabelHandle(labelX + pos.x, labelY + pos.y - 4, handleSize, pos.direction, linkId);
        handlesGroup.appendChild(handle);
    });
    
    // 添加到 SVG 最上层（确保可点击）
    svg.appendChild(handlesGroup);
    
    console.log('ConceptMap: 已为连接词添加手柄:', linkId);
}

/**
 * 创建单个连接词手柄
 */
function createLinkLabelHandle(x, y, size, direction, linkId) {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    handle.setAttribute('class', 'link-label-handle');
    handle.setAttribute('data-direction', direction);
    handle.setAttribute('transform', `translate(${x}, ${y})`);
    handle.style.cursor = 'crosshair';
    
    // 绘制箭头图标
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathD = '';
    const arrowSize = size / 2;
    
    switch (direction) {
        case 'top':
            pathD = `M 0 ${-arrowSize} L ${arrowSize} ${arrowSize} L ${-arrowSize} ${arrowSize} Z`;
            break;
        case 'bottom':
            pathD = `M 0 ${arrowSize} L ${arrowSize} ${-arrowSize} L ${-arrowSize} ${-arrowSize} Z`;
            break;
        case 'left':
            pathD = `M ${-arrowSize} 0 L ${arrowSize} ${-arrowSize} L ${arrowSize} ${arrowSize} Z`;
            break;
        case 'right':
            pathD = `M ${arrowSize} 0 L ${-arrowSize} ${-arrowSize} L ${-arrowSize} ${arrowSize} Z`;
            break;
    }
    
    arrowPath.setAttribute('d', pathD);
    arrowPath.setAttribute('fill', '#4a90d9');
    arrowPath.setAttribute('stroke', '#2d6cb5');
    arrowPath.setAttribute('stroke-width', '1');
    handle.appendChild(arrowPath);
    
    // 添加一个更大的透明点击区域
    const clickArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clickArea.setAttribute('r', size);
    clickArea.setAttribute('fill', 'transparent');
    handle.appendChild(clickArea);
    
    // 添加拖拽事件
    addLinkHandleDragEvents(handle, direction, linkId);
    
    return handle;
}

/**
 * 添加连接词手柄的拖拽事件
 */
function addLinkHandleDragEvents(handle, direction, linkId) {
    handle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        console.log('ConceptMap: 开始从连接词拖拽创建聚合连接');
        
        // 进入拖拽模式
        isLinkHandleDragging = true;
        linkHandleSourceLinkId = linkId;
        
        // 获取起始位置（手柄位置）
        const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
        if (!svg) return;
        
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
        
        // 创建虚拟连接线
        linkHandleVirtualLine = createLinkHandleVirtualLine(svgPt.x, svgPt.y);
        
        // 添加全局事件监听
        document.addEventListener('mousemove', handleLinkHandleDrag);
        document.addEventListener('mouseup', handleLinkHandleDragEnd);
        
        // 防止文本选择
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'crosshair';
    });
}

/**
 * 创建连接词手柄拖拽时的虚拟连接线
 */
function createLinkHandleVirtualLine(startX, startY) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return null;
    
    const virtualLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    virtualLine.setAttribute('d', `M ${startX} ${startY} L ${startX} ${startY}`);
    virtualLine.setAttribute('stroke', '#4a90d9');
    virtualLine.setAttribute('stroke-width', '2');
    virtualLine.setAttribute('stroke-dasharray', '5,5');
    virtualLine.setAttribute('fill', 'none');
    virtualLine.setAttribute('data-start-x', startX);
    virtualLine.setAttribute('data-start-y', startY);
    virtualLine.setAttribute('class', 'link-handle-virtual-line');
    virtualLine.style.pointerEvents = 'none';
    
    svg.appendChild(virtualLine);
    
    return virtualLine;
}

/**
 * 处理连接词手柄拖拽
 */
function handleLinkHandleDrag(e) {
    if (!isLinkHandleDragging || !linkHandleVirtualLine) return;
    
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 将鼠标坐标转换为 SVG 坐标
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    // 获取起点坐标
    const startX = parseFloat(linkHandleVirtualLine.getAttribute('data-start-x'));
    const startY = parseFloat(linkHandleVirtualLine.getAttribute('data-start-y'));
    
    // 更新虚拟连接线路径
    linkHandleVirtualLine.setAttribute('d', `M ${startX} ${startY} L ${svgPt.x} ${svgPt.y}`);
    
    // 高亮悬停的节点
    highlightHoveredNode(e.clientX, e.clientY);
}

/**
 * 高亮鼠标悬停的节点
 */
function highlightHoveredNode(clientX, clientY) {
    // 移除之前的高亮
    const prevHighlighted = document.querySelector('.node-hover-highlight');
    if (prevHighlighted) {
        prevHighlighted.classList.remove('node-hover-highlight');
        const rect = prevHighlighted.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke', rect.getAttribute('data-original-stroke') || '#4a90d9');
            rect.setAttribute('stroke-width', rect.getAttribute('data-original-stroke-width') || '2');
        }
    }
    
    // 查找当前悬停的节点
    const targetElement = document.elementFromPoint(clientX, clientY);
    const targetNodeGroup = targetElement?.closest('g[data-node-id]');
    
    if (targetNodeGroup) {
        targetNodeGroup.classList.add('node-hover-highlight');
        const rect = targetNodeGroup.querySelector('rect');
        if (rect) {
            // 保存原始样式
            if (!rect.hasAttribute('data-original-stroke')) {
                rect.setAttribute('data-original-stroke', rect.getAttribute('stroke') || '#4a90d9');
                rect.setAttribute('data-original-stroke-width', rect.getAttribute('stroke-width') || '2');
            }
            // 设置高亮样式
            rect.setAttribute('stroke', '#ffd700');
            rect.setAttribute('stroke-width', '3');
        }
    }
}

/**
 * 处理连接词手柄拖拽结束
 */
function handleLinkHandleDragEnd(e) {
    if (!isLinkHandleDragging) return;
    
    console.log('ConceptMap: 连接词手柄拖拽结束');
    
    // 恢复页面样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // 移除全局事件监听
    document.removeEventListener('mousemove', handleLinkHandleDrag);
    document.removeEventListener('mouseup', handleLinkHandleDragEnd);
    
    // 移除高亮
    const highlighted = document.querySelector('.node-hover-highlight');
    if (highlighted) {
        highlighted.classList.remove('node-hover-highlight');
        const rect = highlighted.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke', rect.getAttribute('data-original-stroke') || '#4a90d9');
            rect.setAttribute('stroke-width', rect.getAttribute('data-original-stroke-width') || '2');
        }
    }
    
    // 检查鼠标是否在目标节点上
    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    const targetNodeGroup = targetElement?.closest('g[data-node-id]');
    
    if (targetNodeGroup && linkHandleSourceLinkId) {
        const targetNodeId = targetNodeGroup.getAttribute('data-node-id');
        
        // 获取原连接线信息
        const sourceLink = currentGraphData?.links?.find(link => {
            const linkId = link.id || `link-${getLinkNodeId(link.source)}-${getLinkNodeId(link.target)}`;
            return linkId === linkHandleSourceLinkId;
        });
        
        if (sourceLink) {
            const sourceLinkSourceId = getLinkNodeId(sourceLink.source);
            const sourceLinkTargetId = getLinkNodeId(sourceLink.target);
            
            // 不能连接到原连接线的源节点或目标节点
            if (targetNodeId !== sourceLinkSourceId && targetNodeId !== sourceLinkTargetId && targetNodeId !== 'focus-question-node') {
                // 创建聚合连接
                addToAggregateLink(sourceLink, targetNodeId);
            } else if (targetNodeId === 'focus-question-node') {
                console.log('ConceptMap: 不能连接到焦点问题节点');
                if (typeof showMessage === 'function') {
                    showMessage('焦点问题框不能与其他节点建立连接');
                }
            } else {
                console.log('ConceptMap: 不能连接到原连接线的节点');
            }
        }
    } else {
        console.log('ConceptMap: 请拖拽到目标节点上完成连接');
    }
    
    // 移除虚拟连接线
    if (linkHandleVirtualLine) {
        linkHandleVirtualLine.remove();
        linkHandleVirtualLine = null;
    }
    
    // 重置状态
    isLinkHandleDragging = false;
    linkHandleSourceLinkId = null;
}

/**
 * 将目标节点添加到聚合连接
 */
function addToAggregateLink(sourceLink, targetNodeId) {
    if (!currentGraphData || !currentGraphData.links) {
        console.error('ConceptMap: 没有图数据');
        return;
    }
    
    const sourceLinkSourceId = getLinkNodeId(sourceLink.source);
    const linkLabel = sourceLink.label || '双击编辑';  // 使用默认标签
    
    // 检查是否已存在相同的连线
    const existingLink = currentGraphData.links.find(link => {
        const linkSourceId = getLinkNodeId(link.source);
        const linkTargetId = getLinkNodeId(link.target);
        return linkSourceId === sourceLinkSourceId && linkTargetId === targetNodeId;
    });
    
    if (existingLink) {
        console.log('ConceptMap: 这两个节点之间已经存在连线');
        if (typeof showMessage === 'function') {
            showMessage('这两个节点之间已经存在连线', 'info');
        }
        return;
    }
    
    // 保存当前状态用于撤销
    saveToHistory(currentGraphData);
    
    // 创建新连线（使用相同的连接词，形成聚合）
    const newLink = {
        id: `link-${sourceLinkSourceId}-${targetNodeId}`,
        source: sourceLinkSourceId,
        target: targetNodeId,
        label: linkLabel,  // 使用相同的连接词
        isManuallyCreated: true,
        isAggregated: true  // 标记为聚合连接
    };
    
    // 同时标记源连线为聚合连接
    sourceLink.isAggregated = true;
    
    // 添加到数据中
    currentGraphData.links.push(newLink);
    window.currentGraphData = currentGraphData;
    
    console.log('ConceptMap: 已创建聚合连接:', newLink);
    
    // 重新渲染连线（drawLinks 内部会自动处理聚合连接样式和事件绑定）
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg && currentGraphData.nodes) {
        // 清除旧连线和虚拟连线
        svg.querySelectorAll('g[data-link-id]').forEach(g => g.remove());
        svg.querySelectorAll('g[data-aggregate-group="true"]').forEach(g => g.remove());
        svg.querySelectorAll('.link-handle-virtual-line').forEach(v => v.remove());
        svg.querySelectorAll('.link-label-handles').forEach(h => h.remove());
        
        // 重新绘制所有连线（使用现有的聚合连接样式）
        drawLinks(svg, currentGraphData.nodes, currentGraphData.links, currentGraphData.topic || '');
        
        if (typeof showMessage === 'function') {
            showMessage('聚合连接创建成功', 'success');
        }
    }
    
    // 取消选中
    deselectLink();
    
    // 注意：不发送 diagram:spec_updated 事件，因为它会触发完整重新渲染导致节点位置重置
    // 我们已经手动重新渲染了连线，只需要发送 operation_completed 事件用于历史记录
    if (window.eventBus) {
        window.eventBus.emit('diagram:operation_completed', {
            operation: 'add_aggregate_link',
            snapshot: JSON.parse(JSON.stringify(currentGraphData)),
            diagramType: 'concept_map'
        });
    }
}

/**
 * 移除连接词手柄
 */
function removeLinkLabelHandles() {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    // 移除所有连接词手柄
    const handles = svg.querySelectorAll('.link-label-handles');
    handles.forEach(h => h.remove());
    
    console.log('ConceptMap: 已移除连接词手柄');
}

/**
 * 为SVG画布添加点击空白取消选中功能
 */
function setupCanvasClickHandler(svg) {
    if (svg && !svg.hasAttribute('data-canvas-click-bound')) {
        svg.addEventListener('click', function(e) {
            // 如果点击的是画布空白区域（不是节点或连线），则取消选中
            if (e.target === svg || e.target.classList.contains('background')) {
                deselectConceptNode();
                deselectLink();
                deselectAggregateLink();
                deselectAllLinks();  // 清除多选连线状态
                
                // 清除 StateManager 中的节点选择
                if (window.stateManager && typeof window.stateManager.selectNodes === 'function') {
                    window.stateManager.selectNodes([]);
                }
                
                // 关闭属性面板
                if (window.eventBus) {
                    window.eventBus.emit('selection:cleared', { shouldHidePanel: true });
                }
            }
        });
        svg.setAttribute('data-canvas-click-bound', 'true');
    }
}

// ============================================================================
// 历史记录管理（撤销功能）
// ============================================================================

// 操作历史记录
let operationHistory = [];
let currentHistoryIndex = -1;
const maxHistorySize = 20;

/**
 * 保存当前状态到历史记录
 */
function saveToHistory(data) {
    if (!data) return;
    
    console.log('saveToHistory: 保存状态到历史记录');
    
    // 移除当前位置之后的历史记录
    operationHistory = operationHistory.slice(0, currentHistoryIndex + 1);
    
    // 添加新的状态（深拷贝）
    operationHistory.push(JSON.parse(JSON.stringify(data)));
    
    // 限制历史记录大小
    if (operationHistory.length > maxHistorySize) {
        operationHistory.shift();
    } else {
        currentHistoryIndex++;
    }
    
    console.log('saveToHistory: 历史记录索引:', currentHistoryIndex, '总数:', operationHistory.length);
}

/**
 * 撤销操作
 */
function undoOperation() {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        const previousData = operationHistory[currentHistoryIndex];
        currentGraphData = JSON.parse(JSON.stringify(previousData));
        window.currentGraphData = currentGraphData;
        
        // 重新绘制图形
        const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
        if (svg) {
            // 清空当前内容
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }
            // 重新渲染
            renderConceptMap(currentGraphData);
        }
        
        showMessage('已撤销操作', 'info');
        console.log('undoOperation: 撤销成功，当前索引:', currentHistoryIndex);
    } else {
        showMessage('没有可撤销的操作', 'warning');
    }
}

// ============================================================================
// 删除节点和连线功能
// ============================================================================

/**
 * 删除选中的节点
 */
function deleteSelectedNode() {
    if (!currentGraphData || !currentGraphData.nodes) {
        showMessage('没有可删除的节点', 'warning');
        return;
    }
    
    if (!selectedConceptNodeId) {
        showMessage('请先选择要删除的节点', 'info');
        return;
    }
    
    // 保存当前状态用于撤销
    saveToHistory(currentGraphData);
    
    // 从数据中移除节点
    currentGraphData.nodes = currentGraphData.nodes.filter(n => n.id !== selectedConceptNodeId);
    
    // 移除与该节点相关的所有连线
    currentGraphData.links = currentGraphData.links.filter(link => {
        const sourceId = getLinkNodeId(link.source);
        const targetId = getLinkNodeId(link.target);
        return sourceId !== selectedConceptNodeId && targetId !== selectedConceptNodeId;
    });
    
    // 更新全局变量
    window.currentGraphData = currentGraphData;
    
    // 只删除DOM元素，不重新布局
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        // 找到合适的容器（考虑 zoom-group）
        const zoomGroup = svg.querySelector('g.zoom-group');
        const container = zoomGroup || svg;
        
        // 删除节点DOM元素
        const nodeToRemove = container.querySelector(`g[data-node-id="${selectedConceptNodeId}"]`);
        if (nodeToRemove) {
            nodeToRemove.remove();
        }
        
        // 删除与该节点相关的连线DOM元素
        const allLinkGroups = container.querySelectorAll('g[data-link-id]');
        allLinkGroups.forEach(linkGroup => {
            const linkId = linkGroup.getAttribute('data-link-id');
            // 检查这条连线是否还存在于数据中
            const linkExists = currentGraphData.links.some(link => {
                const id = link.id || `link-${getLinkNodeId(link.source)}-${getLinkNodeId(link.target)}`;
                return id === linkId;
            });
            if (!linkExists) {
                linkGroup.remove();
            }
        });
        
        // 删除与该节点相关的聚合连接DOM元素
        const allAggregateGroups = container.querySelectorAll('g[data-aggregate-group="true"]');
        allAggregateGroups.forEach(aggregateGroup => {
            const sourceId = aggregateGroup.getAttribute('data-source-id');
            // 如果源节点被删除，移除该聚合连接
            if (sourceId === selectedConceptNodeId) {
                aggregateGroup.remove();
            }
        });
    }
    
    const deletedNodeId = selectedConceptNodeId;
    
    // 取消选中
    deselectConceptNode();
    
    showMessage('节点已删除', 'success');
    console.log('deleteSelectedNode: 节点已删除:', deletedNodeId);
}

/**
 * 删除选中的连线
 */
function deleteSelectedLink() {
    if (!currentGraphData || !currentGraphData.links) {
        showMessage('没有可删除的连线', 'warning');
        return;
    }
    
    if (!selectedLinkId) {
        showMessage('请先选择要删除的连线', 'info');
        return;
    }
    
    // 保存当前状态用于撤销
    saveToHistory(currentGraphData);
    
    // 从数据中移除连线
    currentGraphData.links = currentGraphData.links.filter(link => {
        const linkId = link.id || `link-${getLinkNodeId(link.source)}-${getLinkNodeId(link.target)}`;
        return linkId !== selectedLinkId;
    });
    
    // 更新全局变量
    window.currentGraphData = currentGraphData;
    
    // 只删除DOM元素，不重新布局
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        // 找到合适的容器（考虑 zoom-group）
        const zoomGroup = svg.querySelector('g.zoom-group');
        const container = zoomGroup || svg;
        
        // 删除连线DOM元素
        const linkToRemove = container.querySelector(`g[data-link-id="${selectedLinkId}"]`);
        if (linkToRemove) {
            linkToRemove.remove();
        }
        
        // 也检查聚合连接中是否有该连线
        const allAggregateGroups = container.querySelectorAll('g[data-aggregate-group="true"]');
        allAggregateGroups.forEach(aggregateGroup => {
            const branchLines = aggregateGroup.querySelectorAll(`[data-link-id="${selectedLinkId}"]`);
            branchLines.forEach(el => el.remove());
            
            // 如果聚合组内没有分支线了，删除整个聚合组
            const remainingBranches = aggregateGroup.querySelectorAll('[data-link-id]');
            if (remainingBranches.length === 0) {
                aggregateGroup.remove();
            }
        });
    }
    
    const deletedLinkId = selectedLinkId;
    
    // 取消选中
    deselectLink();
    
    showMessage('连线已删除', 'success');
    console.log('deleteSelectedLink: 连线已删除:', deletedLinkId);
}

/**
 * 删除选中的内容（节点或连线）
 */
function deleteSelected() {
    if (selectedConceptNodeId) {
        deleteSelectedNode();
    } else if (selectedLinkId) {
        deleteSelectedLink();
    } else {
        showMessage('请先选择要删除的节点或连线', 'info');
    }
}

/**
 * 清空画布
 */
function clearCanvas() {
    if (!currentGraphData) return;
    
    // 保存当前状态用于撤销
    saveToHistory(currentGraphData);
    
    // 清空所有节点和连线
    currentGraphData.nodes = [];
    currentGraphData.links = [];
    
    // 更新全局变量
    window.currentGraphData = currentGraphData;
    
    // 重新绘制图形
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        renderConceptMap(currentGraphData);
    }
    
    // 取消选中
    deselectConceptNode();
    deselectLink();
    
    showMessage('画布已清空', 'success');
    console.log('clearCanvas: 画布已清空');
}

/**
 * 获取焦点问题框的当前文本内容
 * @returns {string|null} 焦点问题内容，如果没有则返回 null
 */
function getFocusQuestionContent() {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return null;
    
    // 查找焦点问题节点
    const focusQuestionNode = svg.querySelector('[data-node-id="focus-question-node"]');
    if (!focusQuestionNode) return null;
    
    // 获取文本内容
    const textElement = focusQuestionNode.querySelector('text');
    if (!textElement) return null;
    
    let fullText = textElement.textContent || '';
    
    // 如果文本包含"焦点问题："前缀，去掉它
    if (fullText.startsWith('焦点问题：')) {
        fullText = fullText.substring(5);
    } else if (fullText.startsWith('焦点问题:')) {
        fullText = fullText.substring(5);
    }
    
    return fullText.trim() || null;
}

/**
 * 清空除焦点问题框外的所有节点和连线
 * @returns {string|null} 焦点问题内容
 */
function clearConceptMapExceptFocus() {
    if (!currentGraphData) return null;
    
    // 获取当前焦点问题内容
    const focusContent = getFocusQuestionContent();
    
    if (!focusContent) {
        console.warn('clearConceptMapExceptFocus: 没有找到焦点问题');
        return null;
    }
    
    // 保存当前状态用于撤销
    saveToHistory(currentGraphData);
    
    // 只保留焦点问题节点
    const focusNode = currentGraphData.nodes.find(n => n.id === 'focus-question-node' || n.isFocusQuestion);
    
    if (focusNode) {
        // 更新焦点问题节点的文本（使用当前DOM中的内容）
        focusNode.label = `焦点问题：${focusContent}`;
        currentGraphData.nodes = [focusNode];
    } else {
        currentGraphData.nodes = [];
    }
    
    // 清空所有连线
    currentGraphData.links = [];
    
    // 清空概念列表（如果有的话）
    if (currentGraphData.concepts) {
        currentGraphData.concepts = [];
    }
    if (currentGraphData.relationships) {
        currentGraphData.relationships = [];
    }
    
    // 更新 topic
    currentGraphData.topic = focusContent;
    
    // 更新全局变量
    window.currentGraphData = currentGraphData;
    window.focusQuestion = focusContent;
    
    // 重新绘制图形
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (svg) {
        // 清除所有元素
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        // 重新渲染（只有焦点问题框）
        renderConceptMap(currentGraphData);
    }
    
    // 取消选中
    deselectConceptNode();
    deselectLink();
    deselectAggregateLink();
    
    console.log('clearConceptMapExceptFocus: 已清空除焦点问题框外的所有节点，焦点问题:', focusContent);
    
    return focusContent;
}

/**
 * 显示消息
 */
function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    
    const colors = {
        'info': '#667eea',
        'success': '#28a745',
        'warning': '#ffc107',
        'error': '#dc3545'
    };
    
    messageEl.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10001;
        background: ${colors[type] || colors.info};
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: fadeInOut 2s ease-in-out;
    `;
    
    // 添加动画样式
    if (!document.querySelector('#message-animation-style')) {
        const style = document.createElement('style');
        style.id = 'message-animation-style';
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 2000);
}

// ============================================================================
// 键盘快捷键处理
// ============================================================================

// ============================================================================
// 全选功能
// ============================================================================

// 存储全选的连线ID列表
let selectedLinkIds = [];

/**
 * 全选所有节点
 */
function selectAllNodes() {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg || !currentGraphData?.nodes) return;
    
    // 取消连线选择（不影响节点）
    deselectAllLinks();
    deselectLink();
    
    // 获取所有非焦点问题的节点ID（排除焦点问题框）
    const nodeIds = currentGraphData.nodes
        .filter(n => !n.isFocusQuestion && n.type !== 'focus-question' && n.id !== 'focus-question-node')
        .map(n => n.id);
    
    if (nodeIds.length === 0) {
        showMessage('没有可选择的节点', 'info');
        return;
    }
    
    // 先恢复所有节点的默认样式（不使用 deselectConceptNode 以避免触发 selection:cleared）
    const allNodes = svg.querySelectorAll('g[data-node-id]');
    allNodes.forEach(nodeGroup => {
        const nodeId = nodeGroup.getAttribute('data-node-id');
        const isFocusQuestion = nodeId === 'focus-question-node';
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            // 恢复默认边框
            rect.setAttribute('stroke', isFocusQuestion ? '#667eea' : '#fff');
            rect.setAttribute('stroke-width', '2');
        }
        // 移除之前的控制手柄
        removeNodeHandles(nodeGroup);
    });
    
    // 清除单选状态
    selectedConceptNodeId = null;
    
    // 使用 StateManager 选择所有节点
    if (window.stateManager && typeof window.stateManager.selectNodes === 'function') {
        window.stateManager.selectNodes(nodeIds);
    }
    
    // 高亮所有被选中的节点（和单选一样的金色边框效果）
    nodeIds.forEach(nodeId => {
        const nodeGroup = svg.querySelector(`g[data-node-id="${nodeId}"]`);
        if (nodeGroup) {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                // 选中时显示金色边框（和单选 selectConceptNode 一样）
                rect.setAttribute('stroke', '#ffd700');
                rect.setAttribute('stroke-width', '3');
            }
        }
    });
    
    // 触发多选事件，打开属性面板（多节点模式）
    if (window.eventBus) {
        window.eventBus.emit('nodes:multi_selected', {
            nodeIds: nodeIds,
            count: nodeIds.length,
            diagramType: 'concept_map'
        });
    }
    
    showMessage(`已选择 ${nodeIds.length} 个节点`, 'success');
    console.log('ConceptMap: 全选节点:', nodeIds);
}

/**
 * 全选所有连线（包括聚合连接）
 */
function selectAllLinks() {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg || !currentGraphData?.links) return;
    
    // 取消节点选择
    deselectConceptNode();
    if (window.stateManager && typeof window.stateManager.selectNodes === 'function') {
        window.stateManager.selectNodes([]);
    }
    
    // 取消之前的选中状态
    deselectAggregateLink();
    deselectLink();
    
    // 获取所有普通连线ID
    const linkIds = currentGraphData.links.map(l => l.id || `link-${l.source}-${l.target}`);
    
    // 获取所有聚合连接的key
    const aggregateGroups = svg.querySelectorAll('g[data-aggregate-group="true"]');
    const aggregateKeys = Array.from(aggregateGroups).map(g => g.getAttribute('data-aggregate-key'));
    
    const totalCount = linkIds.length + aggregateKeys.length;
    
    if (totalCount === 0) {
        showMessage('没有可选择的连线', 'info');
        return;
    }
    
    // 存储选中的连线ID（包括聚合连接的key）
    selectedLinkIds = [...linkIds, ...aggregateKeys.map(k => `aggregate-${k}`)];
    
    // 高亮所有普通连线
    linkIds.forEach(linkId => {
        const linkGroup = svg.querySelector(`g[data-link-id="${linkId}"]`);
        if (linkGroup) {
            const line = linkGroup.querySelector('path:first-child');
            const arrow = linkGroup.querySelector('path:nth-child(2)');
            
            if (line) {
                // 保存用户设置（如果没有）
                if (!line.hasAttribute('data-user-color')) {
                    line.setAttribute('data-user-color', line.getAttribute('stroke') || '#aaa');
                }
                if (!line.hasAttribute('data-user-width')) {
                    line.setAttribute('data-user-width', line.getAttribute('stroke-width') || '2');
                }
                if (!line.hasAttribute('data-user-opacity')) {
                    line.setAttribute('data-user-opacity', line.getAttribute('opacity') || '1');
                }
                // 设置选中高亮
                line.setAttribute('stroke', '#ffd700');
                line.setAttribute('stroke-width', '3');
            }
            if (arrow) {
                if (!arrow.hasAttribute('data-user-color')) {
                    arrow.setAttribute('data-user-color', arrow.getAttribute('fill') || '#aaa');
                }
                if (!arrow.hasAttribute('data-user-opacity')) {
                    arrow.setAttribute('data-user-opacity', arrow.getAttribute('opacity') || '1');
                }
                arrow.setAttribute('fill', '#ffd700');
                arrow.setAttribute('stroke', '#ffd700');
            }
        }
    });
    
    // 高亮所有聚合连接
    aggregateGroups.forEach(aggregateGroupEl => {
        // 高亮主线和分支线
        const lines = aggregateGroupEl.querySelectorAll('line');
        lines.forEach(line => {
            // 保存用户设置（如果没有）
            if (!line.hasAttribute('data-user-color')) {
                line.setAttribute('data-user-color', line.getAttribute('stroke') || '#aaa');
            }
            if (!line.hasAttribute('data-user-width')) {
                line.setAttribute('data-user-width', line.getAttribute('stroke-width') || '2');
            }
            if (!line.hasAttribute('data-user-opacity')) {
                line.setAttribute('data-user-opacity', line.getAttribute('opacity') || '1');
            }
            line.setAttribute('stroke', '#ffd700');
            line.setAttribute('stroke-width', '3');
        });
        
        // 高亮箭头
        const arrows = aggregateGroupEl.querySelectorAll('path');
        arrows.forEach(arrow => {
            if (!arrow.hasAttribute('data-user-color')) {
                arrow.setAttribute('data-user-color', arrow.getAttribute('fill') || '#aaa');
            }
            if (!arrow.hasAttribute('data-user-opacity')) {
                arrow.setAttribute('data-user-opacity', arrow.getAttribute('opacity') || '1');
            }
            arrow.setAttribute('fill', '#ffd700');
            arrow.setAttribute('stroke', '#ffd700');
        });
    });
    
    // 触发多选连线事件，打开属性面板（多连线模式）
    if (window.eventBus) {
        window.eventBus.emit('links:multi_selected', {
            linkIds: selectedLinkIds,
            count: selectedLinkIds.length,
            diagramType: 'concept_map'
        });
    }
    
    const aggregateCount = aggregateKeys.length;
    const normalCount = linkIds.length;
    if (aggregateCount > 0) {
        showMessage(`已选择 ${normalCount} 条连线 + ${aggregateCount} 组聚合连接`, 'success');
    } else {
        showMessage(`已选择 ${normalCount} 条连线`, 'success');
    }
    console.log('ConceptMap: 全选连线:', selectedLinkIds);
}

/**
 * 取消全部连线选择（包括聚合连接）
 */
function deselectAllLinks() {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    selectedLinkIds.forEach(linkId => {
        // 检查是否是聚合连接
        if (linkId.startsWith('aggregate-')) {
            const aggregateKey = linkId.replace('aggregate-', '');
            const aggregateGroupEl = svg.querySelector(`g[data-aggregate-key="${aggregateKey}"]`);
            if (aggregateGroupEl) {
                // 恢复聚合连接的主线和分支线
                const lines = aggregateGroupEl.querySelectorAll('line');
                lines.forEach(line => {
                    const savedColor = line.getAttribute('data-user-color') || '#aaa';
                    const savedWidth = line.getAttribute('data-user-width') || '2';
                    const savedOpacity = line.getAttribute('data-user-opacity') || '1';
                    line.setAttribute('stroke', savedColor);
                    line.setAttribute('stroke-width', savedWidth);
                    line.setAttribute('opacity', savedOpacity);
                });
                
                // 恢复聚合连接的箭头
                const arrows = aggregateGroupEl.querySelectorAll('path');
                arrows.forEach(arrow => {
                    const savedColor = arrow.getAttribute('data-user-color') || '#aaa';
                    const savedOpacity = arrow.getAttribute('data-user-opacity') || '1';
                    arrow.setAttribute('fill', savedColor);
                    arrow.setAttribute('stroke', savedColor);
                    arrow.setAttribute('opacity', savedOpacity);
                });
            }
        } else {
            // 普通连线
            const linkGroup = svg.querySelector(`g[data-link-id="${linkId}"]`);
            if (linkGroup) {
                const line = linkGroup.querySelector('path:first-child');
                const arrow = linkGroup.querySelector('path:nth-child(2)');
                
                if (line) {
                    const savedColor = line.getAttribute('data-user-color') || '#aaa';
                    const savedWidth = line.getAttribute('data-user-width') || '2';
                    const savedOpacity = line.getAttribute('data-user-opacity') || '1';
                    line.setAttribute('stroke', savedColor);
                    line.setAttribute('stroke-width', savedWidth);
                    line.setAttribute('opacity', savedOpacity);
                }
                if (arrow) {
                    const savedColor = arrow.getAttribute('data-user-color') || '#aaa';
                    const savedOpacity = arrow.getAttribute('data-user-opacity') || '1';
                    arrow.setAttribute('fill', savedColor);
                    arrow.setAttribute('stroke', savedColor);
                    arrow.setAttribute('opacity', savedOpacity);
                }
            }
        }
    });
    
    selectedLinkIds = [];
}

/**
 * 获取当前选中的所有连线ID
 */
function getSelectedLinkIds() {
    return selectedLinkIds;
}

/**
 * 更新所有选中连线的样式
 */
function updateAllSelectedLinksStyle(styles) {
    const svg = document.querySelector('#d3-container svg') || document.querySelector('.concept-graph');
    if (!svg) return;
    
    selectedLinkIds.forEach(linkId => {
        updateLinkStyle(linkId, styles);
    });
}

/**
 * 初始化键盘快捷键
 */
function initKeyboardShortcuts() {
    // 移除旧的监听器（如果存在）
    if (window.conceptMapKeyboardHandler) {
        document.removeEventListener('keydown', window.conceptMapKeyboardHandler);
    }
    
    // 创建新的监听器
    window.conceptMapKeyboardHandler = function(e) {
        // 如果正在输入文本，不处理快捷键
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            return;
        }
        
        // Ctrl+Z: 撤销
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            console.log('Ctrl+Z 被按下，执行撤销操作');
            undoOperation();
            return;
        }
        
        // Delete 或 Backspace: 删除选中的节点或连线
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            console.log('Delete 被按下，执行删除操作');
            deleteSelected();
            return;
        }
        
        // Ctrl+A: 全选所有节点
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            console.log('Ctrl+A 被按下，全选所有节点');
            selectAllNodes();
            return;
        }
        
        // Ctrl+L: 全选所有连线
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            console.log('Ctrl+L 被按下，全选所有连线');
            selectAllLinks();
            return;
        }
    };
    
    document.addEventListener('keydown', window.conceptMapKeyboardHandler);
    console.log('键盘快捷键已初始化');
}

// 页面加载时初始化键盘快捷键
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initKeyboardShortcuts);
    } else {
        initKeyboardShortcuts();
    }
}

// ============================================================================
// 导出
// ============================================================================

if (typeof window !== 'undefined') {
    window.ConceptMapRenderer = {
        renderConceptMap,
        addNewNode,
        editConceptNodeText,
        selectConceptNode,
        deselectConceptNode,
        addNodeHandles,
        removeNodeHandles,
        createConceptLink,
        editLinkLabel,
        selectLink,
        deselectLink,
        deleteSelected,
        deleteSelectedNode,
        deleteSelectedLink,
        clearCanvas,
        undoOperation,
        saveToHistory
    };
    window.renderConceptMap = renderConceptMap;
    window.attachDragListeners = attachDragListeners;
    window.setCurrentGraphData = setCurrentGraphData;
    window.updateConnectedLinks = updateConnectedLinks;
    window.addNewConceptNode = addNewNode;
    window.addFocusQuestionNode = addFocusQuestionNode;
    window.editConceptNodeText = editConceptNodeText;
    window.selectConceptNode = selectConceptNode;
    window.deselectConceptNode = deselectConceptNode;
    window.setupCanvasClickHandler = setupCanvasClickHandler;
    window.addNodeHandles = addNodeHandles;
    window.removeNodeHandles = removeNodeHandles;
    window.createConceptLink = createConceptLink;
    window.editLinkLabel = editLinkLabel;
    window.selectLink = selectLink;
    window.deselectLink = deselectLink;
    // 新增功能导出
    window.deleteConceptSelected = deleteSelected;
    window.deleteConceptNode = deleteSelectedNode;
    window.deleteConceptLink = deleteSelectedLink;
    window.clearConceptCanvas = clearCanvas;
    window.undoConceptOperation = undoOperation;
    window.saveConceptToHistory = saveToHistory;
    window.showConceptMessage = showMessage;
    window.clearConceptMapExceptFocus = clearConceptMapExceptFocus;
    window.getFocusQuestionContent = getFocusQuestionContent;
    // 全选功能导出
    window.selectAllNodes = selectAllNodes;
    window.selectAllLinks = selectAllLinks;
    window.deselectAllLinks = deselectAllLinks;
    window.getSelectedLinkIds = getSelectedLinkIds;
    window.updateAllSelectedLinksStyle = updateAllSelectedLinksStyle;
    // 聚合连接功能导出
    window.selectAggregateLink = selectAggregateLink;
    window.deselectAggregateLink = deselectAggregateLink;
    window.updateAggregateLinkStyle = updateAggregateLinkStyle;
    
    console.log('✅ ConceptMapRenderer (concept-map style) 已注册到全局作用域');
}
