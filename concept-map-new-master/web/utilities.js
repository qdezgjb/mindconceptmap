// 概念图自动生成系统 - 工具和辅助功能模块
// 包含: 布局控制、连线路由、历史管理、导出功能

//=============================================================================
// 布局控制函数
//=============================================================================


// applyAutoLayout
async function applyAutoLayout() {
        if (!currentGraphData) {
            showMessage('没有可用的图形数据', 'warning');
            return;
        }
        
        // 根据当前选择的布局类型应用对应的布局算法
        const selectedLayout = window.layoutSelect ? window.layoutSelect.value : 'hierarchical';
        console.log('自动布局，使用布局类型:', selectedLayout);
        
        // 直接调用 changeLayout 函数，它会根据选择的布局类型应用对应的算法
        changeLayout(selectedLayout);
    }

// applyHierarchicalLayout - 应用层次布局（Sugiyama算法）
function applyHierarchicalLayout(graphData) {
    console.log('应用层次布局（Sugiyama算法）...');
    
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        console.warn('图形数据为空，跳过布局');
        return graphData;
    }
    
    // 调用Sugiyama布局算法
    if (typeof window.applySugiyamaLayout === 'function') {
        return window.applySugiyamaLayout(graphData);
    } else {
        console.warn('Sugiyama布局算法未找到，使用智能布局作为备选');
        return applyIntelligentLayout(graphData);
    }
}

// changeLayout
function changeLayout(layoutType) {
        // 如果传入了布局类型参数，使用参数；否则从下拉框获取
        const selectedLayout = layoutType || window.layoutSelect.value;
        const layoutSelect = window.layoutSelect;
        const layoutName = layoutSelect ? layoutSelect.options[layoutSelect.selectedIndex].text : selectedLayout;
        
        console.log('切换布局:', selectedLayout, '布局名称:', layoutName);
        
        // 检查是否正在生成概念图
        if (window.isGenerating) {
            console.log('changeLayout: 正在生成概念图中，布局选项已保存，将在生成完成后应用');
            // 不执行布局切换，但保存用户的选择，在生成完成后会自动应用
            return;
        }
        
        // 检查是否有可用的图形数据
        if (!currentGraphData || !currentGraphData.nodes || currentGraphData.nodes.length === 0) {
            // 只在调试模式下记录，不显示警告
            // 这是正常情况：用户可能只是想切换布局选项，还没有生成概念图
            // 或者在生成过程中切换了布局选项
            if (console.debug) {
                console.debug('changeLayout: 没有可用的图形数据，跳过布局切换（这是正常情况）');
            }
            return;
        }
        
        showMessage(`正在应用${layoutName}...`, 'info');
        
        try {
            // 根据选择的布局类型应用不同的算法
            let optimizedGraph;
            
            switch (selectedLayout) {
                case 'force':
                    // 力导向布局 - 使用 force-directed-layout.js 中的算法
                    console.log('应用力导向布局算法...');
                    console.log('当前图形数据节点数:', currentGraphData.nodes.length);
                    
                    // 清除节点上的层次布局相关属性，并重置位置以强制重新计算
                    const cleanedGraphData = {
                        nodes: currentGraphData.nodes.map(node => {
                            const cleanedNode = { ...node };
                            // 清除层次布局相关的属性
                            delete cleanedNode.layer;
                            // 清除位置坐标，强制力导向布局重新初始化位置
                            // 这样可以从头开始计算，而不是基于层次布局的位置
                            delete cleanedNode.x;
                            delete cleanedNode.y;
                            return cleanedNode;
                        }),
                        links: [...currentGraphData.links]
                    };
                    
                    if (typeof window.applyForceDirectedLayout === 'function') {
                        // 获取画布尺寸 - 从 viewBox 获取，而不是屏幕像素尺寸
                        const svg = document.querySelector('.concept-graph');
                        let width = 2400; // 默认 viewBox 宽度
                        let height = 1200; // 默认 viewBox 高度
                        if (svg) {
                            const viewBox = svg.getAttribute('viewBox');
                            if (viewBox) {
                                const viewBoxParts = viewBox.split(' ');
                                if (viewBoxParts.length === 4) {
                                    width = parseFloat(viewBoxParts[2]);
                                    height = parseFloat(viewBoxParts[3]);
                                }
                            }
                        }
                        
                        console.log('调用 applyForceDirectedLayout，使用 viewBox 尺寸:', width, 'x', height);
                        optimizedGraph = window.applyForceDirectedLayout(cleanedGraphData, {
                            width: width,
                            height: height,
                            iterations: 300,
                            coolingFactor: 0.95,
                            linkDistance: 100,
                            nodeCharge: -300,
                            nodeSpacing: 60
                        });
                        console.log('applyForceDirectedLayout 完成，返回节点数:', optimizedGraph?.nodes?.length);
                        if (optimizedGraph && optimizedGraph.nodes && optimizedGraph.nodes.length > 0) {
                            console.log('第一个节点位置:', optimizedGraph.nodes[0].x, optimizedGraph.nodes[0].y);
                            console.log('最后一个节点位置:', optimizedGraph.nodes[optimizedGraph.nodes.length - 1].x, optimizedGraph.nodes[optimizedGraph.nodes.length - 1].y);
                        }
                    } else if (typeof window.applyForceDirectedLayoutOnly === 'function') {
                        // 回退到项目特定版本
                        console.warn('applyForceDirectedLayout 未找到，使用 applyForceDirectedLayoutOnly');
                        optimizedGraph = window.applyForceDirectedLayoutOnly(cleanedGraphData);
                    } else {
                        throw new Error('力导向布局算法未加载');
                    }
                    break;
                case 'hierarchical':
                    // Sugiyama布局 - 使用 sugiyama-layout.js 中的算法
                    console.log('应用Sugiyama层次布局算法...');
                    if (typeof window.applySugiyamaLayout === 'function') {
                        optimizedGraph = window.applySugiyamaLayout(currentGraphData);
                    } else {
                        throw new Error('Sugiyama布局算法未加载');
                    }
                    break;
                default:
                    // 默认智能布局
                    console.log('应用智能布局算法...');
                    if (typeof window.applyIntelligentLayout === 'function') {
                        optimizedGraph = window.applyIntelligentLayout(currentGraphData);
                    } else {
                        throw new Error('智能布局算法未加载');
                    }
            }
            
            if (optimizedGraph) {
                // 更新当前图形数据
                currentGraphData = optimizedGraph;
                window.currentGraphData = currentGraphData;
                
                // 重新绘制图形
                drawGraph(currentGraphData);
                
                // 更新状态栏
                updateStatusBar(currentGraphData);
                
                // 保存到历史记录
                saveToHistory(currentGraphData);
                
                showMessage(`${layoutName}应用成功！`, 'success');
                console.log('布局切换完成:', selectedLayout);
            } else {
                throw new Error('布局算法返回空结果');
            }
        } catch (error) {
            console.error('布局切换失败:', error);
            showMessage('布局切换失败: ' + error.message, 'error');
        }
    }



//=============================================================================
// 连线路由扩展函数
//=============================================================================


// calculateSingleDetourPoint
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

// calculateDetourPoints
function calculateDetourPoints(startX, startY, endX, endY, 
                                 nodeX, nodeY, nodeWidth, nodeHeight) {
        const detourPoints = [];
        
        // 计算节点边界
        const nodeLeft = nodeX - nodeWidth / 2;
        const nodeRight = nodeX + nodeWidth / 2;
        const nodeTop = nodeY - nodeHeight / 2;
        const nodeBottom = nodeY + nodeHeight / 2;
        
        // 计算连线的方向
        const dx = endX - startX;
        const dy = endY - startY;
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        
        // 计算绕行距离，确保有足够空间放置文字
        const detourDistance = 50; // 增加绕行距离，为文字留出更多空间
        
        if (isHorizontal) {
            // 水平连线，垂直绕行
            if (dx > 0) {
                // 从左到右
                if (startX < nodeLeft && endX > nodeRight) {
                    // 连线穿过节点，需要绕行
                    const detourY1 = nodeTop - detourDistance; // 上方绕行
                    const detourY2 = nodeBottom + detourDistance; // 下方绕行
                    
                    // 选择更近的绕行路径
                    const distTop = Math.abs(startY - detourY1) + Math.abs(endY - detourY1);
                    const distBottom = Math.abs(startY - detourY2) + Math.abs(endY - detourY2);
                    
                    if (distTop < distBottom) {
                        // 上方绕行 - 只生成两个绕行点
                        detourPoints.push({ x: nodeLeft - 30, y: detourY1 });
                        detourPoints.push({ x: nodeRight + 30, y: detourY1 });
                    } else {
                        // 下方绕行 - 只生成两个绕行点
                        detourPoints.push({ x: nodeLeft - 30, y: detourY2 });
                        detourPoints.push({ x: nodeRight + 30, y: detourY2 });
                    }
                }
            } else {
                // 从右到左
                if (startX > nodeRight && endX < nodeLeft) {
                    // 连线穿过节点，需要绕行
                    const detourY1 = nodeTop - detourDistance;
                    const detourY2 = nodeBottom + detourDistance;
                    
                    const distTop = Math.abs(startY - detourY1) + Math.abs(endY - detourY1);
                    const distBottom = Math.abs(startY - detourY2) + Math.abs(endY - detourY2);
                    
                    if (distTop < distBottom) {
                        detourPoints.push({ x: nodeRight + 30, y: detourY1 });
                        detourPoints.push({ x: nodeLeft - 30, y: detourY1 });
                    } else {
                        detourPoints.push({ x: nodeRight + 30, y: detourY2 });
                        detourPoints.push({ x: nodeLeft - 30, y: detourY2 });
                    }
                }
            }
        } else {
            // 垂直连线，水平绕行
            if (dy > 0) {
                // 从上到下
                if (startY < nodeTop && endY > nodeBottom) {
                    const detourX1 = nodeLeft - detourDistance;
                    const detourX2 = nodeRight + detourDistance;
                    
                    const distLeft = Math.abs(startX - detourX1) + Math.abs(endX - detourX1);
                    const distRight = Math.abs(startX - detourX2) + Math.abs(endX - detourX2);
                    
                    if (distLeft < distRight) {
                        detourPoints.push({ x: detourX1, y: nodeTop - 30 });
                        detourPoints.push({ x: detourX1, y: nodeBottom + 30 });
                    } else {
                        detourPoints.push({ x: detourX2, y: nodeTop - 30 });
                        detourPoints.push({ x: detourX2, y: nodeBottom + 30 });
                    }
                }
            } else {
                // 从下到上
                if (startY > nodeBottom && endY < nodeTop) {
                    const detourX1 = nodeLeft - detourDistance;
                    const detourX2 = nodeRight + detourDistance;
                    
                    const distLeft = Math.abs(startX - detourX1) + Math.abs(endX - detourX1);
                    const distRight = Math.abs(startX - detourX2) + Math.abs(endX - detourX2);
                    
                    if (distLeft < distRight) {
                        detourPoints.push({ x: detourX1, y: nodeBottom + 30 });
                        detourPoints.push({ x: detourX1, y: nodeTop - 30 });
                    } else {
                        detourPoints.push({ x: detourX2, y: nodeBottom + 30 });
                        detourPoints.push({ x: detourX2, y: nodeTop - 30 });
                    }
                }
            }
        }
        
        return detourPoints;
    }

// adjustNodePositionsToAvoidOverlap
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

// optimizeLabelPositions
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

// calculateLabelOverlap
function calculateLabelOverlap(labelX, labelY, labelWidth, labelHeight, nodes, links, currentLinkId) {
        let overlap = 0;
        
        // 检查与节点的重叠
        nodes.forEach(node => {
            const nodeWidth = Math.max(70, (node.label || '').length * 10);
            const nodeHeight = 30;
            
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

// ensureUniformSpacing
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
                const nodeDimensions = window.calculateNodeDimensions(node.label || '', 60, 30, 10);
                return node.width || nodeDimensions.width;
            });
            
            // 固定间距，确保节点不重叠
            const minSpacing = 120; // 固定间距（节点缩小后相应减小）
            
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



//=============================================================================
// 历史记录和数据持久化函数
//=============================================================================


// saveConceptMap
function saveConceptMap() {
        if (!currentGraphData) {
            showMessage('没有可保存的概念图', 'warning');
            return;
        }
        
        try {
            const dataStr = JSON.stringify(currentGraphData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `概念图_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showMessage('概念图已保存', 'success');
        } catch (error) {
            showMessage('保存失败', 'error');
            console.error('保存失败:', error);
        }
    }

// loadConceptMap
function loadConceptMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.nodes && data.links) {
                        currentGraphData = data;
                        window.currentGraphData = currentGraphData;
                        displayConceptMap(data);
                        showMessage('概念图加载成功', 'success');
                    } else {
                        showMessage('文件格式不正确', 'error');
                    }
                } catch (error) {
                    showMessage('文件解析失败', 'error');
                    console.error('解析失败:', error);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

// saveToHistory
function saveToHistory(data) {
        console.log('saveToHistory 被调用，数据:', data);
        
        // 移除当前位置之后的历史记录
        operationHistory = operationHistory.slice(0, currentHistoryIndex + 1);
        console.log('历史记录已截断，当前索引:', currentHistoryIndex);
        
        // 添加新的状态
        operationHistory.push(JSON.parse(JSON.stringify(data)));
        console.log('新状态已添加到历史记录');
        
        // 限制历史记录大小
        if (operationHistory.length > maxHistorySize) {
            operationHistory.shift();
            console.log('历史记录已限制大小，移除最旧记录');
        } else {
            currentHistoryIndex++;
            console.log('历史记录索引已更新:', currentHistoryIndex);
        }
        
        updateHistoryButtons();
        console.log('历史记录按钮状态已更新');
    }

// undoOperation
function undoOperation() {
        if (currentHistoryIndex > 0) {
            currentHistoryIndex--;
            const previousData = operationHistory[currentHistoryIndex];
            currentGraphData = JSON.parse(JSON.stringify(previousData));
            window.currentGraphData = currentGraphData;
            updateStatusBar(currentGraphData);
            updateHistoryButtons();
            showMessage('已撤销操作', 'info');
            
            // 重新绘制图形
            drawGraph(currentGraphData);
        }
    }

// redoOperation
function redoOperation() {
        if (currentHistoryIndex < operationHistory.length - 1) {
            currentHistoryIndex++;
            const nextData = operationHistory[currentHistoryIndex];
            currentGraphData = JSON.parse(JSON.stringify(nextData));
            window.currentGraphData = currentGraphData;
            updateStatusBar(nextData);
            updateHistoryButtons();
            showMessage('已重做操作', 'info');
            
            // 重新绘制图形
            drawGraph(currentGraphData);
        }
    }

// clearHistory
function clearHistory() {
        operationHistory = [];
        currentHistoryIndex = -1;
        updateHistoryButtons();
    }



//=============================================================================
// 导出处理函数
//=============================================================================


// exportConceptMap
function exportConceptMap() {
        if (!currentGraphData) {
            showMessage('没有可导出的概念图', 'warning');
            return;
        }
        
        // 这里将来会实现实际的导出功能
        showMessage('导出功能开发中...', 'info');
        
        // 模拟导出过程
        setTimeout(() => {
            showMessage('概念图导出成功！', 'success');
        }, 1000);
    }

// downloadConceptMapImage
function downloadConceptMapImage() {
        if (!currentGraphData || currentGraphData.nodes.length === 0) {
            showMessage('没有可下载的概念图', 'warning');
            return;
        }

        // 退出所有编辑模式，确保下载的图片是干净的状态
        exitAllEditModes();

        try {
            // 获取SVG元素
            const svg = document.querySelector('.concept-graph');
            if (!svg) {
                showMessage('找不到概念图元素', 'error');
                return;
            }

            // 显示下载中状态
            showMessage('正在生成PNG图片，请稍候...', 'info');

            // 创建SVG的副本，避免修改原始元素
            const clonedSvg = svg.cloneNode(true);
            
            // 设置SVG的尺寸和样式
            const svgRect = svg.getBoundingClientRect();
            const width = svgRect.width;
            const height = svgRect.height;
            
            // 设置SVG属性
            clonedSvg.setAttribute('width', width);
            clonedSvg.setAttribute('height', height);
            clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            
            // 获取当前viewBox
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
                clonedSvg.setAttribute('viewBox', viewBox);
            }
            
            // 添加背景色
            const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            backgroundRect.setAttribute('width', '100%');
            backgroundRect.setAttribute('height', '100%');
            backgroundRect.setAttribute('fill', 'white');
            clonedSvg.insertBefore(backgroundRect, clonedSvg.firstChild);
            
            // 将SVG转换为字符串
            const svgData = new XMLSerializer().serializeToString(clonedSvg);
            
            // 创建Image对象
            const img = new Image();
            
            // 添加错误处理
            img.onerror = function() {
                showMessage('图片生成失败，请重试', 'error');
            };
            
            img.onload = function() {
                try {
                    // 创建Canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 设置Canvas尺寸
                    canvas.width = width;
                    canvas.height = height;
                    
                    // 绘制白色背景
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, width, height);
                    
                    // 将SVG绘制到Canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // 转换为PNG格式
                    canvas.toBlob(function(blob) {
                        if (blob) {
                            // 创建下载链接
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            
                            // 生成文件名
                            const now = new Date();
                            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
                            const filename = `概念图_${timestamp}.png`;
                            
                            link.download = filename;
                            link.style.display = 'none';
                            
                            // 触发下载
                            document.body.appendChild(link);
                            link.click();
                            
                            // 清理
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                            
                            showMessage('概念图已下载为PNG文件', 'success');
                        } else {
                            showMessage('PNG图片生成失败', 'error');
                        }
                    }, 'image/png', 0.95); // 设置PNG质量
                } catch (canvasError) {
                    console.error('Canvas处理失败:', canvasError);
                    showMessage('图片处理失败: ' + canvasError.message, 'error');
                }
            };
            
            // 设置SVG数据
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            
        } catch (error) {
            console.error('下载失败:', error);
            showMessage('下载失败: ' + error.message, 'error');
        }
    }

// exitAllEditModes - 退出所有编辑模式
function exitAllEditModes() {
        console.log('退出所有编辑模式...');
        
        // 1. 取消节点选中状态
        if (typeof deselectNode === 'function') {
            deselectNode();
        }
        
        // 2. 退出连线创建模式
        if (typeof window.isLinkCreationMode !== 'undefined' && window.isLinkCreationMode) {
            if (typeof exitLinkCreationMode === 'function') {
                exitLinkCreationMode();
            } else {
                // 手动清理连线创建模式状态
                window.isLinkCreationMode = false;
                window.linkSourceNodeId = null;
                window.linkTargetNodeId = null;
                
                // 恢复添加连线按钮状态
                if (window.addLinkBtn) {
                    window.addLinkBtn.textContent = '添加连线';
                    window.addLinkBtn.style.backgroundColor = '';
                }
                
                // 移除虚拟连接线
                const virtualLines = document.querySelectorAll('.virtual-connection-line');
                virtualLines.forEach(line => line.remove());
            }
        }
        
        // 3. 停止拖拽操作
        if (typeof window.isDragging !== 'undefined' && window.isDragging) {
            window.isDragging = false;
        }
        
        // 4. 停止调整大小操作
        if (typeof window.isResizing !== 'undefined' && window.isResizing) {
            window.isResizing = false;
            window.resizeStartX = 0;
            window.resizeStartY = 0;
        }
        
        // 5. 移除所有浮动输入框
        const floatingInputs = document.querySelectorAll('input[style*="position: fixed"], input[style*="position: absolute"]');
        floatingInputs.forEach(input => {
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        });
        
        // 6. 移除所有控制手柄
        const nodeHandles = document.querySelectorAll('.node-handle');
        nodeHandles.forEach(handle => handle.remove());
        
        // 7. 更新按钮状态
        if (typeof updateNodeOperationButtons === 'function') {
            updateNodeOperationButtons();
        }
        
        console.log('所有编辑模式已退出');
    }

// 将exitAllEditModes函数添加到全局作用域
if (typeof window !== 'undefined') {
    window.exitAllEditModes = exitAllEditModes;
}

