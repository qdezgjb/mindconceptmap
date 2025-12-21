// 概念图自动生成系统 - 交互操作模块
// 包含: 节点操作、连线操作、拖拽处理

//=============================================================================
// 节点操作函数
//=============================================================================


// editNodeText
function editNodeText(nodeId) {
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // 获取SVG画布和其位置信息（支持普通和支架模式）
        let svg = document.querySelector('.scaffold-concept-graph');
        if (!svg) {
            svg = document.querySelector('.concept-graph');
        }
        if (!svg) {
            console.error('SVG 元素未找到');
            return;
        }

        // 直接从DOM获取节点组元素的实际位置
        const nodeGroup = svg.querySelector(`g[data-node-id="${nodeId}"]`);
        if (!nodeGroup) {
            console.error('节点组元素未找到');
            return;
        }

        // 获取节点矩形元素
        const nodeRect = nodeGroup.querySelector('rect');
        if (!nodeRect) {
            console.error('节点矩形元素未找到');
            return;
        }

        // 获取节点组在页面中的实际位置
        const nodeGroupRect = nodeGroup.getBoundingClientRect();
        
        // 获取节点矩形的尺寸（从SVG属性获取，更准确）
        const nodeWidth = parseFloat(nodeRect.getAttribute('width')) || (node.width || Math.max(70, (node.label || '').length * 10));
        const nodeHeight = parseFloat(nodeRect.getAttribute('height')) || (node.height || 30);
        
        // 计算输入框尺寸（与节点尺寸相同）
        const inputWidth = nodeWidth;
        const inputHeight = nodeHeight;
        
        // 节点组的getBoundingClientRect()返回的是节点组在页面中的位置
        // 由于节点矩形是相对于组中心定位的（x: -width/2, y: -height/2），
        // 所以节点组的中心就是节点的中心
        const nodeCenterX = nodeGroupRect.left + nodeGroupRect.width / 2;
        const nodeCenterY = nodeGroupRect.top + nodeGroupRect.height / 2;
        
        // 计算输入框在页面中的绝对位置（节点中心减去输入框尺寸的一半）
        const inputLeft = nodeCenterX - inputWidth / 2;
        const inputTop = nodeCenterY - inputHeight / 2;

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.label || '';
        input.style.cssText = `
            position: fixed;
            left: ${inputLeft}px;
            top: ${inputTop}px;
            width: ${inputWidth}px;
            height: ${inputHeight}px;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: inherit;
            z-index: 10000;
            background: white;
            text-align: center;
            box-sizing: border-box;
            outline: none;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        `;

        // 添加到页面
        document.body.appendChild(input);
        input.focus();
        input.select();

        // 添加窗口大小变化和滚动监听器
        const updatePosition = () => {
            // 重新从DOM获取节点组元素的实际位置
            const currentNodeGroup = svg.querySelector(`g[data-node-id="${nodeId}"]`);
            if (!currentNodeGroup) return;
            
            const nodeGroupRect = currentNodeGroup.getBoundingClientRect();
            
            // 节点组的中心就是节点的中心
            const nodeCenterX = nodeGroupRect.left + nodeGroupRect.width / 2;
            const nodeCenterY = nodeGroupRect.top + nodeGroupRect.height / 2;
            
            // 计算输入框在页面中的绝对位置（节点中心减去输入框尺寸的一半）
            const newInputLeft = nodeCenterX - inputWidth / 2;
            const newInputTop = nodeCenterY - inputHeight / 2;
            
            input.style.left = `${newInputLeft}px`;
            input.style.top = `${newInputTop}px`;
        };

        // 监听窗口大小变化
        window.addEventListener('resize', updatePosition);
        
        // 监听滚动事件
        window.addEventListener('scroll', updatePosition, true);

        // 处理输入完成
        let isEditingFinished = false; // 防止重复调用
        
        const finishEdit = () => {
            if (isEditingFinished) return; // 如果已经完成，直接返回
            isEditingFinished = true;
            
            // 移除事件监听器
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            
            const newLabel = input.value.trim();
            if (newLabel && newLabel !== node.label) {
                node.label = newLabel;
                
                // 检测并解决可能的节点重叠（简化版本）
                const hasOverlap = false;
                
                if (hasOverlap) {
                    console.log('检测到节点编辑后的重叠');
                    showMessage('节点文字已更新，检测到重叠', 'success');
                } else {
                    showMessage('节点文字已更新', 'success');
                }
                
                // 更新全局变量
                window.currentGraphData = currentGraphData;
                
                drawGraph(currentGraphData);
                updateStatusBar(currentGraphData);
                saveToHistory(currentGraphData);
            }
            
            // 检查input是否还在DOM中，再移除
            if (input && input.parentNode === document.body) {
                document.body.removeChild(input);
            }
        };

        // 回车键确认
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                finishEdit();
            }
        });

        // 失去焦点时确认
        input.addEventListener('blur', finishEdit);

        // ESC键取消
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (isEditingFinished) return; // 如果已经完成，直接返回
                isEditingFinished = true;
                
                // 移除事件监听器
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
                
                // 检查input是否还在DOM中，再移除
                if (input && input.parentNode === document.body) {
                    document.body.removeChild(input);
                }
            }
        });
    }

// selectNode
function selectNode(nodeId) {
        console.log(`选中节点: ${nodeId}, 之前选中的节点: ${selectedNodeId}`);
        
        // 取消全选状态
        window.isAllNodesSelected = false;
        
        // 取消连线选中（节点和连线选中互斥）
        deselectLink();
        
        // 先取消所有节点的选中状态
        const allNodes = document.querySelectorAll('g[data-node-id]');
        allNodes.forEach(nodeGroup => {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                // 🔴 检查是否是虚线框节点（占位符），如果是则保持原样式
                const nodeIdAttr = nodeGroup.getAttribute('data-node-id');
                const node = currentGraphData && currentGraphData.nodes ? 
                    currentGraphData.nodes.find(n => String(n.id) === String(nodeIdAttr)) : null;
                
                if (node && node.isPlaceholder) {
                    // 虚线框节点保持原样式
                    rect.setAttribute('stroke', '#667eea');
                    rect.setAttribute('stroke-width', '2');
                    rect.setAttribute('stroke-dasharray', '5,5');
                } else if (node && node.isCorrect === true) {
                    // 正确填入的节点保持绿色边框
                    rect.setAttribute('stroke', '#28a745');
                    rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', 'none');
                } else if (node && node.isCorrect === false) {
                    // 错误填入的节点保持红色边框
                    rect.setAttribute('stroke', '#dc3545');
                    rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', 'none');
                } else {
                    // 普通节点恢复白色边框
                rect.setAttribute('stroke', '#fff');
                rect.setAttribute('stroke-width', '2');
                    rect.setAttribute('stroke-dasharray', 'none');
                }
            }
            // 移除之前节点的控制手柄
            removeNodeHandles(nodeGroup);
        });

        // 选中新节点
        selectedNodeId = nodeId;
        const nodeGroup = document.querySelector(`g[data-node-id="${nodeId}"]`);
        if (nodeGroup) {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                // 🔴 检查选中的节点是否是虚线框节点
                const node = currentGraphData && currentGraphData.nodes ? 
                    currentGraphData.nodes.find(n => String(n.id) === String(nodeId)) : null;
                
                if (node && node.isPlaceholder) {
                    // 虚线框节点选中时加粗边框但保持虚线样式
                    rect.setAttribute('stroke', '#ffd700');
                    rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', '5,5');
                } else {
                rect.setAttribute('stroke', '#ffd700'); // 金色边框表示选中
                rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', 'none');
                }
            }
            
            // 为选中的节点添加控制手柄
            addNodeHandles(nodeGroup);
        }

        // 更新删除和编辑按钮状态
        updateNodeOperationButtons();
        updateLinkOperationButtons();
        
        console.log(`选中状态更新完成，当前选中节点: ${selectedNodeId}`);
        showMessage(`已选中节点: ${nodeId}`, 'info');
    }

// deselectNode
function deselectNode() {
        if (selectedNodeId) {
            const nodeGroup = document.querySelector(`g[data-node-id="${selectedNodeId}"]`);
            if (nodeGroup) {
                const rect = nodeGroup.querySelector('rect');
                if (rect) {
                    // 🔴 检查是否是虚线框节点（占位符），如果是则恢复虚线样式
                    const node = currentGraphData && currentGraphData.nodes ? 
                        currentGraphData.nodes.find(n => String(n.id) === String(selectedNodeId)) : null;
                    
                    if (node && node.isPlaceholder) {
                        // 虚线框节点恢复原样式
                        rect.setAttribute('stroke', '#667eea');
                        rect.setAttribute('stroke-width', '2');
                        rect.setAttribute('stroke-dasharray', '5,5');
                    } else if (node && node.isCorrect === true) {
                        // 正确填入的节点保持绿色边框
                        rect.setAttribute('stroke', '#28a745');
                        rect.setAttribute('stroke-width', '3');
                        rect.setAttribute('stroke-dasharray', 'none');
                    } else if (node && node.isCorrect === false) {
                        // 错误填入的节点保持红色边框
                        rect.setAttribute('stroke', '#dc3545');
                        rect.setAttribute('stroke-width', '3');
                        rect.setAttribute('stroke-dasharray', 'none');
                    } else {
                        // 普通节点恢复白色边框
                    rect.setAttribute('stroke', '#fff');
                    rect.setAttribute('stroke-width', '2');
                        rect.setAttribute('stroke-dasharray', 'none');
                    }
                }
                // 移除控制手柄
                removeNodeHandles(nodeGroup);
            }
            selectedNodeId = null;
            updateNodeOperationButtons();
            updateLinkOperationButtons();
        }
    }

// selectAllNodes - 选中所有节点
function selectAllNodes() {
        if (!currentGraphData || !currentGraphData.nodes || currentGraphData.nodes.length === 0) {
            showMessage('没有可选的节点', 'info');
            return;
        }
        
        // 取消连线选中
        deselectLink();
        
        // 设置全选状态
        window.isAllNodesSelected = true;
        
        // 将所有节点标记为选中状态
        const allNodes = document.querySelectorAll('g[data-node-id]');
        allNodes.forEach(nodeGroup => {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                const nodeIdAttr = nodeGroup.getAttribute('data-node-id');
                
                // 🔴 检查是否是虚线框节点（占位符），如果是则保持虚线样式
                const node = currentGraphData && currentGraphData.nodes ? 
                    currentGraphData.nodes.find(n => String(n.id) === String(nodeIdAttr)) : null;
                
                if (node && node.isPlaceholder) {
                    // 虚线框节点选中时加粗边框但保持虚线样式
                    rect.setAttribute('stroke', '#ffd700');
                    rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', '5,5');
                } else {
                rect.setAttribute('stroke', '#ffd700'); // 金色边框表示选中
                rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', 'none');
                }
            }
        });
        
        // 选中第一个节点（作为主要选中节点，用于显示控制手柄）
        if (currentGraphData.nodes.length > 0) {
            const firstNodeId = currentGraphData.nodes[0].id;
            selectedNodeId = firstNodeId;
            const firstNodeGroup = document.querySelector(`g[data-node-id="${firstNodeId}"]`);
            if (firstNodeGroup) {
                // 为第一个节点添加控制手柄
                addNodeHandles(firstNodeGroup);
            }
        }
        
        // 更新按钮状态
        updateNodeOperationButtons();
        updateLinkOperationButtons();
        
        showMessage(`已选中所有节点（共 ${currentGraphData.nodes.length} 个）`, 'info');
    }

// selectLink
function selectLink(linkId) {
        console.log(`选中连线: ${linkId}, 之前选中的连线: ${selectedLinkId}`);
        
        // 取消节点选中（节点和连线选中互斥）
        deselectNode();
        
        // 先取消所有连线的选中状态
        const allLinks = document.querySelectorAll('g[data-link-id]');
        allLinks.forEach(linkGroup => {
            const line = linkGroup.querySelector('path:nth-child(1)');
            const arrow = linkGroup.querySelector('path:nth-child(2)');
            if (line) {
                line.setAttribute('stroke', '#aaa');
                line.setAttribute('stroke-width', '2');
            }
            if (arrow) {
                arrow.setAttribute('fill', '#aaa');
                arrow.setAttribute('stroke', '#aaa');
            }
        });

        // 选中新连线
        selectedLinkId = linkId;
        const linkGroup = document.querySelector(`g[data-link-id="${linkId}"]`);
        if (linkGroup) {
            const line = linkGroup.querySelector('path:nth-child(1)');
            const arrow = linkGroup.querySelector('path:nth-child(2)');
            if (line) {
                line.setAttribute('stroke', '#ffd700'); // 金色表示选中
                line.setAttribute('stroke-width', '3'); // 加粗
            }
            if (arrow) {
                arrow.setAttribute('fill', '#ffd700');
                arrow.setAttribute('stroke', '#ffd700');
            }
        }

        // 更新删除和编辑按钮状态
        updateNodeOperationButtons();
        updateLinkOperationButtons();
        
        console.log(`选中状态更新完成，当前选中连线: ${selectedLinkId}`);
        showMessage(`已选中连线: ${linkId}`, 'info');
    }

// deselectLink
function deselectLink() {
        if (selectedLinkId) {
            const linkGroup = document.querySelector(`g[data-link-id="${selectedLinkId}"]`);
            if (linkGroup) {
                const line = linkGroup.querySelector('path:nth-child(1)');
                const arrow = linkGroup.querySelector('path:nth-child(2)');
                if (line) {
                    line.setAttribute('stroke', '#aaa');
                    line.setAttribute('stroke-width', '2');
                }
                if (arrow) {
                    arrow.setAttribute('fill', '#aaa');
                    arrow.setAttribute('stroke', '#aaa');
                }
            }
            selectedLinkId = null;
            updateNodeOperationButtons();
            updateLinkOperationButtons();
        }
    }

// addNodeHandles
function addNodeHandles(nodeGroup) {
        const rect = nodeGroup.querySelector('rect');
        if (!rect) return;

        const nodeId = nodeGroup.getAttribute('data-node-id');
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // 获取节点尺寸 - 优先使用保存的尺寸，否则从实际的rect元素获取
        const nodeData = currentGraphData.nodes.find(n => n.id === nodeId);
        const nodeWidth = nodeData?.width || (() => {
            const actualRect = nodeGroup.querySelector('rect');
            return actualRect ? parseFloat(actualRect.getAttribute('width')) : Math.max(100, (nodeData?.label || '').length * 12);
        })();
        const nodeHeight = nodeData?.height || (() => {
            const actualRect = nodeGroup.querySelector('rect');
            return actualRect ? parseFloat(actualRect.getAttribute('height')) : 40;
        })();

        // 创建8个控制手柄
        const handlePositions = [
            // 四个角落的箭头（用于调整大小）- 移到节点外部
            { x: -nodeWidth/2 - 15, y: -nodeHeight/2 - 15, type: 'resize', direction: 'top-left' },
            { x: nodeWidth/2 + 15, y: -nodeHeight/2 - 15, type: 'resize', direction: 'top-right' },
            { x: nodeWidth/2 + 15, y: nodeHeight/2 + 15, type: 'resize', direction: 'bottom-right' },
            { x: -nodeWidth/2 - 15, y: nodeHeight/2 + 15, type: 'resize', direction: 'bottom-left' },
            // 四个边缘的箭头（用于创建连接线）
            { x: 0, y: -nodeHeight/2 - 10, type: 'connect', direction: 'top' },
            { x: nodeWidth/2 + 10, y: 0, type: 'connect', direction: 'right' },
            { x: 0, y: nodeHeight/2 + 10, type: 'connect', direction: 'bottom' },
            { x: -nodeWidth/2 - 10, y: 0, type: 'connect', direction: 'left' }
        ];

        handlePositions.forEach((pos, index) => {
            const handle = createHandle(pos, index, nodeId);
            nodeGroup.appendChild(handle);
        });
    }

// createHandle
function createHandle(pos, index, nodeId) {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'node-handle');
        handle.setAttribute('data-handle-type', pos.type);
        handle.setAttribute('data-handle-direction', pos.direction);
        handle.setAttribute('data-node-id', nodeId);
        handle.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

        if (pos.type === 'resize') {
            // 创建调整大小的手柄（小方块）- 移到节点外部
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', '12');
            rect.setAttribute('height', '12');
            rect.setAttribute('x', '-6');
            rect.setAttribute('y', '-6');
            rect.setAttribute('fill', '#ffd700');
            rect.setAttribute('stroke', '#333');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('cursor', 'nw-resize');
            handle.appendChild(rect);

            // 添加调整大小的事件监听器
            addResizeHandlers(handle, pos.direction, nodeId);
        } else {
            // 创建连接线手柄（小箭头）
            const arrow = createArrow(pos.direction);
            handle.appendChild(arrow);

            // 添加连接线的事件监听器
            addConnectionHandlers(handle, pos.direction, nodeId);
        }

        return handle;
    }

// createArrow
function createArrow(direction) {
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('fill', '#007bff');
        arrow.setAttribute('stroke', '#333');
        arrow.setAttribute('stroke-width', '2');
        arrow.setAttribute('cursor', 'crosshair');

        // 根据方向设置箭头路径 - 稍微增大箭头
        const arrowPaths = {
            'top': 'M0,-8 L-4,0 L4,0 Z',
            'right': 'M8,0 L0,-4 L0,4 Z',
            'bottom': 'M0,8 L-4,0 L4,0 Z',
            'left': 'M-8,0 L0,-4 L0,4 Z'
        };

        arrow.setAttribute('d', arrowPaths[direction] || arrowPaths['top']);
        return arrow;
    }

// removeNodeHandles
function removeNodeHandles(nodeGroup) {
        const handles = nodeGroup.querySelectorAll('.node-handle');
        handles.forEach(handle => handle.remove());
    }

// addResizeHandlers
function addResizeHandlers(handle, direction, nodeId) {
        handle.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            // 设置全局调整大小状态
            window.isResizing = true;
            window.resizeStartX = e.clientX;
            window.resizeStartY = e.clientY;
            
            const node = currentGraphData.nodes.find(n => n.id === nodeId);
            if (node) {
                window.originalWidth = Math.max(100, (node.label || '').length * 12);
                window.originalHeight = 40;
            }
            
            // 添加全局调整大小事件监听器
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', handleResizeEnd);
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'nw-resize';
        });
    }

// handleResize
function handleResize(e) {
        if (!window.isResizing) return;
        
        const deltaX = e.clientX - window.resizeStartX;
        const deltaY = e.clientY - window.resizeStartY;
        
        // 根据拖拽方向计算新的尺寸 - 让缩放幅度与拖动范围一致
        // 使用更大的乘数，让拖拽距离直接对应缩放效果
        const scaleX = 1 + (deltaX / window.originalWidth) * 1.0;  // 增加敏感度到1.0，拖拽一个节点宽度对应2倍缩放
        const scaleY = 1 + (deltaY / window.originalHeight) * 1.0; // 增加敏感度到1.0，拖拽一个节点高度对应2倍缩放
        
        // 等比例缩放
        const scale = Math.min(scaleX, scaleY);
        
        // 确保缩放系数在合理范围内，扩大缩放范围
        const clampedScale = Math.max(0.2, Math.min(scale, 8.0)); // 限制缩放范围在0.2到8.0之间
        
        // 添加调试信息
        console.log('缩放调试:', {
            deltaX, deltaY,
            originalWidth: window.originalWidth,
            originalHeight: window.originalHeight,
            scale, clampedScale,
            newWidth: Math.max(80, window.originalWidth * clampedScale),
            newHeight: Math.max(40, window.originalHeight * clampedScale)
        });
        
        // 更新节点尺寸
        const nodeGroup = document.querySelector(`g[data-node-id="${selectedNodeId}"]`);
        if (nodeGroup) {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                const newWidth = Math.max(80, window.originalWidth * clampedScale);
                const newHeight = Math.max(40, window.originalHeight * clampedScale);
                
                rect.setAttribute('width', newWidth);
                rect.setAttribute('height', newHeight);
                rect.setAttribute('x', -newWidth / 2);
                rect.setAttribute('y', -newHeight / 2);
                
                // 更新文字大小 - 让文字缩放更加明显
                const text = nodeGroup.querySelector('text');
                let newFontSize = 10; // 默认字体大小
                if (text) {
                    newFontSize = Math.max(8, 10 * clampedScale);
                    text.setAttribute('font-size', newFontSize);
                    
                    // 同时调整文字位置，确保在节点中心
                    text.setAttribute('y', 4); // 保持垂直居中
                }
                
                // 将缩放后的尺寸保存到节点数据中
                const node = currentGraphData.nodes.find(n => n.id === selectedNodeId);
                if (node) {
                    node.width = newWidth;
                    node.height = newHeight;
                    node.fontSize = newFontSize;
                    node.scale = clampedScale;
                    
                    // 添加调试信息
                    console.log('节点缩放数据已保存:', {
                        nodeId: selectedNodeId,
                        width: node.width,
                        height: node.height,
                        fontSize: node.fontSize,
                        scale: node.scale
                    });
                }
            }
        }
    }

// handleResizeEnd
function handleResizeEnd(e) {
        if (!window.isResizing) return;
        
        window.isResizing = false;
        
        // 恢复页面样式
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // 移除全局事件监听器
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
        
        // 重新绘制图形以更新控制手柄位置
        if (selectedNodeId) {
            const nodeGroup = document.querySelector(`g[data-node-id="${selectedNodeId}"]`);
            if (nodeGroup) {
                removeNodeHandles(nodeGroup);
                addNodeHandles(nodeGroup);
            }
        }
        
        // 保存到历史记录
        saveToHistory(currentGraphData);
        showMessage('节点大小已调整', 'info');
    }

// addNewNode
function addNewNode() {
        console.log('addNewNode 函数被调用');
        
        // 若未初始化，创建空图并展示画布
        if (typeof window.ensureGraphInitialized === 'function') {
            window.ensureGraphInitialized();
        } else {
            console.error('ensureGraphInitialized 函数未找到');
            return;
        }
        console.log('图形初始化完成，当前数据:', currentGraphData);
        
        const newNodeId = (currentGraphData.nodes.length + 1).toString();
        console.log('新节点ID:', newNodeId);
        
        // 计算新节点位置
        const x = Math.random() * 600 + 100;
        const y = Math.random() * 260 + 80;

        const newNode = {
            id: newNodeId,
            label: `新节点${newNodeId}`,
            x: x,
            y: y,
            type: 'detail'
        };
        
        console.log('新节点对象:', newNode);
        
        currentGraphData.nodes.push(newNode);
        console.log('节点已添加到数据中，当前节点数量:', currentGraphData.nodes.length);
        

        
        // 更新全局变量
        window.currentGraphData = currentGraphData;
        
        console.log('开始绘制图形...');
        drawGraph(currentGraphData);
        console.log('图形绘制完成');
        
        updateStatusBar(currentGraphData);
        console.log('状态栏已更新');
        
        saveToHistory(currentGraphData);
        console.log('历史记录已保存');
        
        showMessage('新节点已添加', 'success');
        console.log('addNewNode 函数执行完成');
    }

// deleteSelectedNode
function deleteSelectedNode() {
        if (!currentGraphData || currentGraphData.nodes.length === 0) {
            showMessage('没有可删除的节点', 'warning');
            return;
        }
        
        // 如果全选所有节点，删除所有节点
        if (window.isAllNodesSelected) {
            const nodeCount = currentGraphData.nodes.length;
            // 清空所有节点和连线
            currentGraphData.nodes = [];
            currentGraphData.links = [];
            
            // 更新全局变量
            window.currentGraphData = currentGraphData;
            
            // 重新绘制图形
            drawGraph(currentGraphData);
            updateStatusBar(currentGraphData);
            saveToHistory(currentGraphData);
            
            // 取消全选状态
            window.isAllNodesSelected = false;
            selectedNodeId = null;
            deselectNode();
            
            showMessage(`已删除所有节点（共 ${nodeCount} 个）`, 'success');
            return;
        }
        
        if (!selectedNodeId) {
            showMessage('请先选择要删除的节点', 'info');
            return;
        }

        // 从数据中移除节点
        currentGraphData.nodes = currentGraphData.nodes.filter(node => node.id !== selectedNodeId);
        
        // 从连线中移除包含该节点的连线
        currentGraphData.links = currentGraphData.links.filter(link => 
            link.source !== selectedNodeId && link.target !== selectedNodeId
        );

        // 更新全局变量
        window.currentGraphData = currentGraphData;

        // 重新绘制图形
        drawGraph(currentGraphData);
        updateStatusBar(currentGraphData);
        saveToHistory(currentGraphData);
        deselectNode(); // 取消选中
        showMessage('节点已删除', 'success');
    }

// editSelectedNode
function editSelectedNode() {
        if (!currentGraphData || currentGraphData.nodes.length === 0) {
            showMessage('没有可编辑的节点', 'warning');
            return;
        }
        
        if (!selectedNodeId) {
        showMessage('请先选择要编辑的节点', 'info');
            return;
        }

        editNodeText(selectedNodeId);
    }

// changeNodeColor (已移除 - 样式设置功能已替换为撤销/重做)
// function changeNodeColor() {
//         const color = window.nodeColorPicker.value;
//         showMessage(`节点颜色已更改为: ${color}`, 'info');
//         
//         // 这里将来会更新D3.js节点颜色
//     }

// changeNodeShape (已移除 - 样式设置功能已替换为撤销/重做)
// function changeNodeShape() {
//         const shape = window.nodeShapeSelect.value;
//         showMessage(`节点形状已更改为: ${nodeShapeSelect.options[nodeShapeSelect.selectedIndex].text}`, 'info');
//         
//         // 这里将来会更新D3.js节点形状
//     }



//=============================================================================
// 连线操作函数
//=============================================================================


// editLinkLabel
function editLinkLabel(linkId) {
        const link = currentGraphData.links.find(l => (l.id || `link-${l.source}-${l.target}`) === linkId);
        if (!link) return;

        // 获取SVG画布和其位置信息
        const svg = document.querySelector('.concept-graph');
        if (!svg) {
            console.error('concept-graph SVG 元素未找到');
            return;
        }
        const svgRect = svg.getBoundingClientRect();

        // 找到连接线标签元素
        const linkLabel = svg.querySelector(`text[data-link-id="${linkId}"]`);
        if (!linkLabel) return;

        // 获取标签的位置
        const labelX = parseFloat(linkLabel.getAttribute('x'));
        const labelY = parseFloat(linkLabel.getAttribute('y'));

        // 计算输入框在页面中的绝对位置
        const inputLeft = svgRect.left + labelX - 50; // 输入框宽度的一半
        const inputTop = svgRect.top + labelY - 15;   // 输入框高度的一半

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.value = link.label || '';
        input.style.cssText = `
            position: fixed;
            left: ${inputLeft}px;
            top: ${inputTop}px;
            width: 100px;
            height: 30px;
            border: 2px solid #667eea;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: inherit;
            z-index: 1000;
            background: white;
            text-align: center;
            box-sizing: border-box;
            outline: none;
        `;

        document.body.appendChild(input);
        input.focus();
        input.select();

        // 保存编辑结果
function saveEdit() {
            const newLabel = input.value.trim();
            link.label = newLabel;
            
            // 更新标签显示
            linkLabel.textContent = newLabel || '双击编辑';
            
            // 移除输入框
            document.body.removeChild(input);
            
            // 更新全局变量
            window.currentGraphData = currentGraphData;
            
            // 保存到历史记录
            saveToHistory(currentGraphData);
            showMessage('连接线标签已更新', 'info');
        }

        // 处理键盘事件
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                document.body.removeChild(input);
            }
        });

        // 处理失焦事件
        input.addEventListener('blur', function() {
            if (document.body.contains(input)) {
                saveEdit();
            }
        });

        // 动态调整输入框位置（处理窗口滚动和缩放）
function updateInputPosition() {
            if (document.body.contains(input)) {
                const newSvgRect = svg.getBoundingClientRect();
                const newInputLeft = newSvgRect.left + labelX - 50;
                const newInputTop = newSvgRect.top + labelY - 15;
                input.style.left = newInputLeft + 'px';
                input.style.top = newInputTop + 'px';
            }
        }

        window.addEventListener('resize', updateInputPosition);
        window.addEventListener('scroll', updateInputPosition);
    }

// saveEdit
function saveEdit() {
            const newLabel = input.value.trim();
            link.label = newLabel;
            
            // 更新标签显示
            linkLabel.textContent = newLabel || '双击编辑';
            
            // 移除输入框
            document.body.removeChild(input);
            
            // 更新全局变量
            window.currentGraphData = currentGraphData;
            
            // 保存到历史记录
            saveToHistory(currentGraphData);
            showMessage('连接线标签已更新', 'info');
        }

// updateInputPosition
function updateInputPosition() {
            if (document.body.contains(input)) {
                const newSvgRect = svg.getBoundingClientRect();
                const newInputLeft = newSvgRect.left + labelX - 50;
                const newInputTop = newSvgRect.top + labelY - 15;
                input.style.left = newInputLeft + 'px';
                input.style.top = newInputTop + 'px';
            }
        }

// addConnectionHandlers
function addConnectionHandlers(handle, direction, nodeId) {
        let isDragging = false;
        let virtualLine = null;
        let startX, startY;
        
        handle.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // 进入拖拽连接线创建模式
            enterConnectionDragMode(nodeId, direction, e);
            
            // 创建虚拟连接线
            window.virtualLine = createVirtualConnectionLine(nodeId, direction, e.clientX, e.clientY);
            
            // 添加全局拖拽事件监听器
            document.addEventListener('mousemove', handleConnectionDrag);
            document.addEventListener('mouseup', handleConnectionDragEnd);
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'crosshair';
        });
    }

// enterConnectionMode
function enterConnectionMode(sourceNodeId, direction) {
        // 设置连接线创建状态
        isLinkCreationMode = true;
        linkSourceNodeId = sourceNodeId;
        linkTargetNodeId = null;
        
        // 更新按钮状态
        window.addLinkBtn.textContent = '取消连线';
        window.addLinkBtn.style.backgroundColor = '#dc3545';
        
        // 显示提示信息
        showMessage(`从节点 ${sourceNodeId} 的 ${direction} 方向创建连线，请选择目标节点`, 'info');
        
        // 添加画布点击事件，用于选择目标节点
        const svg = document.querySelector('.concept-graph');
        if (svg) {
            svg.addEventListener('click', handleConnectionTargetSelection);
        }
        
        // 修改按钮点击事件，用于取消连线创建
        addLinkBtn.removeEventListener('click', addNewLink);
        addLinkBtn.addEventListener('click', exitConnectionMode);
    }

// handleConnectionTargetSelection
function handleConnectionTargetSelection(e) {
        if (!isLinkCreationMode) return;
        
        // 检查是否点击的是节点
        const nodeGroup = e.target.closest('g[data-node-id]');
        if (!nodeGroup) return;
        
        const targetNodeId = nodeGroup.getAttribute('data-node-id');
        
        if (targetNodeId !== linkSourceNodeId) {
            // 选择目标节点
            linkTargetNodeId = targetNodeId;
            
            // 创建连线
            createLink(linkSourceNodeId, targetNodeId);
            
            // 退出连接线创建模式
            exitConnectionMode();
        } else {
            showMessage('不能连接到同一个节点', 'warning');
        }
    }

// exitConnectionMode
function exitConnectionMode() {
        isLinkCreationMode = false;
        linkSourceNodeId = null;
        linkTargetNodeId = null;
        
        // 恢复按钮状态和事件
        window.addLinkBtn.textContent = '添加连线';
        window.addLinkBtn.style.backgroundColor = '';
        
        // 移除取消事件监听器，恢复原有的事件监听器
        addLinkBtn.removeEventListener('click', exitConnectionMode);
        addLinkBtn.addEventListener('click', addNewLink);
        
        // 移除画布点击事件
        const svg = document.querySelector('.concept-graph');
        if (svg) {
            svg.removeEventListener('click', handleConnectionTargetSelection);
        }
        
        showMessage('已退出连线创建模式', 'info');
    }

// addNewLink - 拖拽式连线创建
function addNewLink() {
        if (!currentGraphData || currentGraphData.nodes.length < 2) {
            showMessage('需要至少两个节点才能添加连线', 'warning');
            return;
        }
        
        // 🔴 检查是否已经在普通连线模式中（通过按钮文本和全局状态判断）
        const btn = document.getElementById('addLinkBtn');
        const isInMode = (btn && btn.textContent === '取消连线') || 
                         (currentLinkCreationType === 'normal' && window.currentLinkCreationType === 'normal');
        
        if (isInMode) {
            // 如果已经在普通连线模式中，退出模式
            if (typeof exitClickLinkCreationMode === 'function') {
                exitClickLinkCreationMode();
            }
            return;
        }
        
        // 进入拖拽式连线创建模式
        enterDragLinkCreationMode('normal');
    }

// enterLinkCreationMode
function enterLinkCreationMode() {
        isLinkCreationMode = true;
        linkSourceNodeId = null;
        linkTargetNodeId = null;
        
        // 更新按钮状态
        window.addLinkBtn.textContent = '取消连线';
        window.addLinkBtn.style.backgroundColor = '#dc3545';
        
        // 显示提示信息
        showMessage('请选择连线的起始节点，或点击"取消连线"按钮退出', 'info');
        
        // 添加画布点击事件，用于选择节点
        const svg = document.querySelector('.concept-graph');
        if (svg) {
            svg.addEventListener('click', handleLinkNodeSelection);
        }
        
        // 移除原有的事件监听器，添加新的取消事件监听器
        addLinkBtn.removeEventListener('click', addNewLink);
        addLinkBtn.addEventListener('click', exitLinkCreationMode);
    }

// exitLinkCreationMode
function exitLinkCreationMode() {
        isLinkCreationMode = false;
        linkSourceNodeId = null;
        linkTargetNodeId = null;
        
        // 恢复按钮状态和事件
        window.addLinkBtn.textContent = '添加连线';
        window.addLinkBtn.style.backgroundColor = '';
        
        // 移除取消事件监听器，恢复原有的事件监听器
        addLinkBtn.removeEventListener('click', exitLinkCreationMode);
        addLinkBtn.addEventListener('click', addNewLink);
        
        // 移除画布点击事件
        const svg = document.querySelector('.concept-graph');
        if (svg) {
            svg.removeEventListener('click', handleLinkNodeSelection);
        }
        
        // 清除所有节点的临时选中状态
        clearTemporaryNodeSelection();
        
        showMessage('已退出连线创建模式', 'info');
    }

// handleLinkNodeSelection
function handleLinkNodeSelection(e) {
        if (!isLinkCreationMode) return;
        
        // 检查是否点击的是节点
        const nodeGroup = e.target.closest('g[data-node-id]');
        if (!nodeGroup) return;
        
        const nodeId = nodeGroup.getAttribute('data-node-id');
        
        if (!linkSourceNodeId) {
            // 选择起始节点
            linkSourceNodeId = nodeId;
            highlightNodeForLink(nodeId, 'source');
            showMessage(`已选择起始节点: ${nodeId}，请选择结束节点`, 'info');
        } else if (!linkTargetNodeId && nodeId !== linkSourceNodeId) {
            // 选择结束节点
            linkTargetNodeId = nodeId;
            highlightNodeForLink(nodeId, 'target');
            
            // 创建连线
            createLink(linkSourceNodeId, linkTargetNodeId);
            
            // 退出连线创建模式
            exitLinkCreationMode();
        } else if (nodeId === linkSourceNodeId) {
            // 重新选择起始节点
            linkSourceNodeId = null;
            clearTemporaryNodeSelection();
            showMessage('请重新选择连线的起始节点', 'info');
        }
    }

// highlightNodeForLink
function highlightNodeForLink(nodeId, type) {
        const nodeGroup = document.querySelector(`g[data-node-id="${nodeId}"]`);
        if (nodeGroup) {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                if (type === 'source') {
                    rect.setAttribute('stroke', '#28a745'); // 绿色表示起始节点
                    rect.setAttribute('stroke-width', '4');
                } else if (type === 'target') {
                    rect.setAttribute('stroke', '#007bff'); // 蓝色表示结束节点
                    rect.setAttribute('stroke-width', '4');
                }
            }
        }
    }

// clearTemporaryNodeSelection
function clearTemporaryNodeSelection() {
        const allNodes = document.querySelectorAll('g[data-node-id]');
        allNodes.forEach(nodeGroup => {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                const nodeIdAttr = nodeGroup.getAttribute('data-node-id');
                
                // 🔴 检查是否是虚线框节点（占位符），如果是则保持原样式
                const node = currentGraphData && currentGraphData.nodes ? 
                    currentGraphData.nodes.find(n => String(n.id) === String(nodeIdAttr)) : null;
                
                // 恢复原始样式
                if (selectedNodeId === nodeIdAttr) {
                    // 选中的节点
                    if (node && node.isPlaceholder) {
                        rect.setAttribute('stroke', '#ffd700');
                        rect.setAttribute('stroke-width', '3');
                        rect.setAttribute('stroke-dasharray', '5,5');
                    } else {
                    rect.setAttribute('stroke', '#ffd700'); // 保持选中状态
                    rect.setAttribute('stroke-width', '3');
                        rect.setAttribute('stroke-dasharray', 'none');
                    }
                } else if (node && node.isPlaceholder) {
                    // 虚线框节点保持原样式
                    rect.setAttribute('stroke', '#667eea');
                    rect.setAttribute('stroke-width', '2');
                    rect.setAttribute('stroke-dasharray', '5,5');
                } else if (node && node.isCorrect === true) {
                    // 正确填入的节点保持绿色边框
                    rect.setAttribute('stroke', '#28a745');
                    rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', 'none');
                } else if (node && node.isCorrect === false) {
                    // 错误填入的节点保持红色边框
                    rect.setAttribute('stroke', '#dc3545');
                    rect.setAttribute('stroke-width', '3');
                    rect.setAttribute('stroke-dasharray', 'none');
                } else {
                    rect.setAttribute('stroke', '#fff');
                    rect.setAttribute('stroke-width', '2');
                    rect.setAttribute('stroke-dasharray', 'none');
                }
            }
        });
    }

// createLink
function createLink(sourceId, targetId) {
        // 检查是否已存在相同的连线
        const existingLink = currentGraphData.links.find(link => 
            (link.source === sourceId && link.target === targetId) ||
            (link.source === targetId && link.target === sourceId)
        );
        
        if (existingLink) {
            showMessage('这两个节点之间已经存在连线', 'warning');
            return;
        }
        
        // 获取节点信息
        const sourceNode = currentGraphData.nodes.find(n => n.id === sourceId);
        const targetNode = currentGraphData.nodes.find(n => n.id === targetId);
        
        if (!sourceNode || !targetNode) {
            showMessage('无法找到源节点或目标节点', 'error');
            return;
        }
        
        const sourceLayer = sourceNode.layer || 0;
        const targetLayer = targetNode.layer || 0;
        
        // 创建新连线
        const newLink = {
            id: `link-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            label: '', // 可以后续添加连线标签
            // 确保使用直线连接，不使用贝塞尔曲线
            isCurved: false,
            layer: `L${sourceLayer}-L${targetLayer}` // 添加层级信息
        };
        
        // 添加到数据中
        currentGraphData.links.push(newLink);
        
        // 更新全局变量
        window.currentGraphData = currentGraphData;
        
        // 重新绘制图形
        drawGraph(currentGraphData);
        
        // 更新状态栏
        updateStatusBar(currentGraphData);
        
        // 保存到历史记录
        saveToHistory(currentGraphData);
        
        showMessage(`连线已创建: ${sourceId} → ${targetId}`, 'success');
    }

// deleteSelectedLink
function deleteSelectedLink() {
        if (!currentGraphData || currentGraphData.links.length === 0) {
            showMessage('没有可删除的连线', 'warning');
            return;
        }
        
        if (!selectedLinkId) {
            showMessage('请先选择要删除的连线', 'info');
            return;
        }

        // 从数据中移除连线
        currentGraphData.links = currentGraphData.links.filter(link => {
            const linkId = link.id || `link-${link.source}-${link.target}`;
            return linkId !== selectedLinkId;
        });

        // 更新全局变量
        window.currentGraphData = currentGraphData;

        // 重新绘制图形
        drawGraph(currentGraphData);
        updateStatusBar(currentGraphData);
        saveToHistory(currentGraphData);
        deselectLink(); // 取消选中
        showMessage('连线已删除', 'success');
    }

// editSelectedLink
function editSelectedLink() {
        if (!currentGraphData || currentGraphData.links.length === 0) {
            showMessage('没有可编辑的连线', 'warning');
            return;
        }
        
        if (!selectedLinkId) {
            showMessage('请先选择要编辑的连线', 'info');
            return;
        }

        editLinkLabel(selectedLinkId);
    }

// changeLinkColor (已移除 - 样式设置功能已替换为撤销/重做)
// function changeLinkColor() {
//         const color = window.linkColorPicker.value;
//         showMessage(`连线颜色已更改为: ${color}`, 'info');
//         
//         // 这里将来会更新D3.js连线颜色
//     }

// updateLinkOperationButtons
function updateLinkOperationButtons() {
        console.log('updateLinkOperationButtons 被调用，selectedLinkId:', selectedLinkId);
        
        if (window.deleteLinkBtn) {
            window.deleteLinkBtn.disabled = !selectedLinkId;
            console.log('删除连线按钮状态:', window.deleteLinkBtn.disabled);
        } else {
            console.error('deleteLinkBtn 元素未找到');
        }
        
        if (window.editLinkBtn) {
            window.editLinkBtn.disabled = !selectedLinkId;
            console.log('编辑连线按钮状态:', window.editLinkBtn.disabled);
        } else {
            console.error('editLinkBtn 元素未找到');
        }
    }

// enterConnectionDragMode
function enterConnectionDragMode(sourceNodeId, direction, e) {
        // 设置连接线创建状态
        isLinkCreationMode = true;
        linkSourceNodeId = sourceNodeId;
        linkTargetNodeId = null;
        
        // 更新按钮状态
        window.addLinkBtn.textContent = '取消连线';
        window.addLinkBtn.style.backgroundColor = '#dc3545';
        
        // 显示提示信息
        showMessage(`从节点 ${sourceNodeId} 的 ${direction} 方向拖拽创建连线，松开鼠标到目标节点上完成连接`, 'info');
        
        // 修改按钮点击事件，用于取消连线创建
        addLinkBtn.removeEventListener('click', addNewLink);
        addLinkBtn.addEventListener('click', exitConnectionMode);
    }

// createVirtualConnectionLine
function createVirtualConnectionLine(sourceNodeId, direction, startX, startY) {
        const svg = document.querySelector('.concept-graph');
        if (!svg) return null;
        
        // 创建虚拟连接线组
        const virtualLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        virtualLineGroup.setAttribute('class', 'virtual-connection-line');
        
        // 创建虚拟连接线路径
        const virtualLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        virtualLine.setAttribute('stroke', '#ff6b6b');
        virtualLine.setAttribute('stroke-width', '2');
        virtualLine.setAttribute('stroke-dasharray', '5,5');
        virtualLine.setAttribute('opacity', '0.7');
        virtualLine.setAttribute('fill', 'none');
        
        // 设置起点（从源节点的边缘开始）
        const sourceNode = currentGraphData.nodes.find(n => n.id === sourceNodeId);
        if (sourceNode) {
            const nodeWidth = sourceNode.width || Math.max(70, (sourceNode.label || '').length * 10);
            const nodeHeight = sourceNode.height || 30;
            
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
            
            // 创建初始路径（从起点到起点，形成点）
            const initialPath = `M ${startX} ${startY} L ${startX} ${startY}`;
            virtualLine.setAttribute('d', initialPath);
            
            // 存储起点信息，供拖拽时使用
            virtualLine.setAttribute('data-start-x', startX);
            virtualLine.setAttribute('data-start-y', startY);
        }
        
        // 将虚拟连接线添加到组中
        virtualLineGroup.appendChild(virtualLine);
        svg.appendChild(virtualLineGroup);
        return virtualLineGroup;
    }

// handleConnectionDrag
function handleConnectionDrag(e) {
        if (!isLinkCreationMode || !window.virtualLine) return;
        
        const virtualLineGroup = window.virtualLine;
        if (virtualLineGroup) {
            const virtualLine = virtualLineGroup.querySelector('path');
            if (virtualLine) {
                // 将鼠标坐标转换为SVG坐标
                const svg = document.querySelector('.concept-graph');
                if (svg) {
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
                    
                    // 获取起点坐标
                    const startX = parseFloat(virtualLine.getAttribute('data-start-x'));
                    const startY = parseFloat(virtualLine.getAttribute('data-start-y'));
                    
                    // 更新虚拟连接线路径
                    const path = `M ${startX} ${startY} L ${svgPt.x} ${svgPt.y}`;
                    virtualLine.setAttribute('d', path);
                }
            }
        }
    }

// handleConnectionDragEnd
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
            
            if (targetNodeId !== linkSourceNodeId) {
                // 创建连线
                createLink(linkSourceNodeId, targetNodeId);
                showMessage(`已创建从节点 ${linkSourceNodeId} 到节点 ${targetNodeId} 的连接线`, 'success');
            } else {
                showMessage('不能连接到同一个节点', 'warning');
            }
        } else {
            showMessage('请拖拽到目标节点上完成连接', 'warning');
        }
        
        // 移除虚拟连接线
        if (window.virtualLine) {
            window.virtualLine.remove();
            window.virtualLine = null;
        }
        
        // 退出连接线创建模式
        exitConnectionMode();
    }



//=============================================================================
// 拖拽处理函数
//=============================================================================


// startDrag
function startDrag(nodeId, clientX, clientY) {
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // 设置拖动状态
        isDragging = true;
        selectedNodeId = nodeId;
        dragStartX = clientX;
        dragStartY = clientY;
        dragOriginalNodeX = node.x;
        dragOriginalNodeY = node.y;

        // 选中节点
        selectNode(nodeId);

        // 改变鼠标样式和节点样式
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
    }

// handleDrag
function handleDrag(e) {
        if (!isDragging || !selectedNodeId) return;

        const node = currentGraphData.nodes.find(n => n.id === selectedNodeId);
        if (!node) return;

        // 计算新位置
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        let newX = dragOriginalNodeX + deltaX;
        let newY = dragOriginalNodeY + deltaY;

        // 🔴 节点吸附功能：在支架模式下，自动吸附到附近的占位符或节点
        if (window.scaffoldPlaceholders && window.scaffoldPlaceholders.length > 0) {
            const snapDistance = 30; // 吸附距离阈值
            
            // 检查是否靠近占位符
            for (const placeholder of window.scaffoldPlaceholders) {
                // 检查占位符对应的节点是否已添加
                const nodeExists = currentGraphData.nodes.some(n => n.id === placeholder.id);
                if (nodeExists) continue;
                
                const placeholderX = placeholder.x || 0;
                const placeholderY = placeholder.y || 0;
                const distance = Math.sqrt(
                    Math.pow(newX - placeholderX, 2) + Math.pow(newY - placeholderY, 2)
                );
                
                if (distance < snapDistance) {
                    // 吸附到占位符位置
                    newX = placeholderX;
                    newY = placeholderY;
                    break;
                }
            }
            
            // 检查是否靠近其他节点（用于对齐）
            for (const otherNode of currentGraphData.nodes) {
                if (otherNode.id === selectedNodeId) continue;
                
                const distanceX = Math.abs(newX - otherNode.x);
                const distanceY = Math.abs(newY - otherNode.y);
                
                // 水平对齐
                if (distanceY < snapDistance && distanceX < 100) {
                    newY = otherNode.y;
                }
                // 垂直对齐
                if (distanceX < snapDistance && distanceY < 100) {
                    newX = otherNode.x;
                }
            }
        }

        // 更新节点位置
        node.x = newX;
        node.y = newY;

        // 同步更新节点分组的位置，保证视觉上跟随移动
        const nodeGroup = document.querySelector(`g[data-node-id="${selectedNodeId}"]`);
        if (nodeGroup) {
            nodeGroup.setAttribute('transform', `translate(${newX}, ${newY})`);
        }

        // 使用 requestAnimationFrame 更新连接线位置，确保流畅跟随
        if (!window.dragUpdateFrame) {
            window.dragUpdateFrame = requestAnimationFrame(() => {
                updateConnectedLinks(selectedNodeId);
                window.dragUpdateFrame = null;
            });
        }
    }

// handleDragEnd
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
                rect.setAttribute('stroke-width', '3'); // 保持选中状态的边框
            }
        }

        // 检测并解决节点重叠
        const draggedNode = currentGraphData.nodes.find(n => n.id === selectedNodeId);
        if (draggedNode) {
            // 检查拖动的节点是否与其他节点重叠（简化版本）
            const hasOverlap = false;
            
            if (hasOverlap) {
                console.log('检测到拖动后的节点重叠');
                showMessage('检测到节点重叠', 'info');
            }
        }

        // 清理拖拽更新动画帧
        if (window.dragUpdateFrame) {
            cancelAnimationFrame(window.dragUpdateFrame);
            window.dragUpdateFrame = null;
        }

        // 最终更新连接线位置，确保准确性
        updateConnectedLinks(selectedNodeId);

        // 移除全局事件监听器
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);

        // 更新全局变量
        window.currentGraphData = currentGraphData;
        
        // 保存到历史记录
        saveToHistory(currentGraphData);
        showMessage('节点位置已更新', 'info');
    }

//=============================================================================
// 拖拽式连线创建功能
//=============================================================================

// 当前连线创建模式：'normal' | 'aggregated' | 'sameLayerAggregated'
let currentLinkCreationType = 'normal';
let clickLinkSourceNodeId = null;
let clickLinkTargetNodes = []; // 用于聚合连接，存储多个目标节点

// enterClickLinkCreationMode - 进入点击式连线创建模式
function enterClickLinkCreationMode(linkType) {
    currentLinkCreationType = linkType;
    clickLinkSourceNodeId = null;
    clickLinkTargetNodes = [];
    
    // 设置全局标志，供renderer.js检查
    window.currentLinkCreationType = linkType;
    
    // 更新按钮状态并添加取消事件监听器
    const buttonMap = {
        'normal': { btn: window.addLinkBtn, text: '🔗 添加连线', originalHandler: 'addNewLink' },
        'aggregated': { btn: window.addAggregatedLinkBtn, text: '🔀 聚合连接', originalHandler: 'addAggregatedLink' },
        'sameLayer': { btn: window.addSameLayerLinkBtn, text: '🔗 同级连接', originalHandler: 'addSameLayerLink' },
        'sameLayerAggregated': { btn: window.addSameLayerAggregatedLinkBtn, text: '🔄 同级聚合连接', originalHandler: 'addSameLayerAggregatedLink' }
    };
    
    const buttonInfo = buttonMap[linkType];
    if (buttonInfo && buttonInfo.btn) {
        // 保存原始文本
        buttonInfo.btn.setAttribute('data-original-text', buttonInfo.btn.textContent);
        
        // 更新按钮文本和样式
        buttonInfo.btn.textContent = '取消连线';
        buttonInfo.btn.style.backgroundColor = '#dc3545';
        
        // 移除所有现有的事件监听器（通过克隆按钮）
        const newBtn = buttonInfo.btn.cloneNode(true);
        buttonInfo.btn.parentNode.replaceChild(newBtn, buttonInfo.btn);
        
        // 更新按钮引用
        if (linkType === 'normal') {
            window.addLinkBtn = newBtn;
        } else if (linkType === 'aggregated') {
            window.addAggregatedLinkBtn = newBtn;
        } else if (linkType === 'sameLayer') {
            window.addSameLayerLinkBtn = newBtn;
        } else if (linkType === 'sameLayerAggregated') {
            window.addSameLayerAggregatedLinkBtn = newBtn;
        }
        
        // 更新按钮文本和样式
        newBtn.textContent = '取消连线';
        newBtn.style.backgroundColor = '#dc3545';
        
        // 添加取消事件监听器
        newBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // 如果是聚合连接模式且已有至少两个目标节点，先完成创建
            if ((linkType === 'aggregated' || linkType === 'sameLayerAggregated') && 
                clickLinkSourceNodeId && clickLinkTargetNodes.length >= 2) {
                if (linkType === 'aggregated') {
                    createAggregatedLinks(clickLinkSourceNodeId, clickLinkTargetNodes);
                } else {
                    createSameLayerAggregatedLinks(clickLinkSourceNodeId, clickLinkTargetNodes);
                }
            } else if (linkType === 'normal' && clickLinkSourceNodeId) {
                // 普通连线模式：如果已选择源节点，清除选择
                clearTemporaryNodeSelection();
                clickLinkSourceNodeId = null;
                showMessage('已取消源节点选择，请重新点击源节点', 'info');
                return; // 不退出模式，允许重新选择
            }
            exitClickLinkCreationMode();
        });
    }
    
    // 显示提示信息
    const messages = {
        'normal': '请点击第一个节点（源节点），然后点击第二个节点（目标节点）创建连线',
        'aggregated': '请点击源节点，然后依次点击目标节点创建聚合连接',
        'sameLayer': '请点击第一个节点（源节点），然后点击第二个节点（目标节点）创建同级连接（弧线）',
        'sameLayerAggregated': '请点击源节点，然后依次点击同级目标节点创建同级聚合连接'
    };
    showMessage(messages[linkType] || messages['normal'], 'info');
    
    // 为所有节点添加点击事件监听器
    enableNodeClickForLinkCreation();
}

// enableNodeClickForLinkCreation - 为节点启用点击连线创建
function enableNodeClickForLinkCreation() {
    const svg = document.querySelector('.concept-graph') || document.querySelector('.scaffold-concept-graph');
    if (!svg) return;
    
    // 添加SVG点击事件监听器（如果还没有添加）
    if (!svg.hasAttribute('data-link-creation-listener')) {
        svg.addEventListener('click', handleNodeClickForLink);
        svg.setAttribute('data-link-creation-listener', 'true');
    }
    
    // 为所有节点添加视觉提示（改变鼠标样式）
    const allNodes = svg.querySelectorAll('g[data-node-id]');
    allNodes.forEach(nodeGroup => {
        const rect = nodeGroup.querySelector('rect');
        if (rect) {
            rect.style.cursor = 'pointer';
        }
    });
}

// handleNodeClickForLink - 节点点击处理（用于连线创建）
function handleNodeClickForLink(e) {
    // 检查是否在连线创建模式（通过检查currentLinkCreationType是否设置）
    const isInLinkCreationMode = currentLinkCreationType === 'normal' ||
                                  currentLinkCreationType === 'aggregated' ||
                                  currentLinkCreationType === 'sameLayer' ||
                                  currentLinkCreationType === 'sameLayerAggregated';
    
    // 如果不在连线创建模式，返回false让事件继续处理（选中节点）
    if (!isInLinkCreationMode) {
        return false;
    }
    
    // 检查是否点击的是节点
    const nodeGroup = e.target.closest('g[data-node-id]');
    
    if (currentLinkCreationType === 'normal') {
        // 普通连线模式
        if (!nodeGroup) {
            // 点击了画布空白区域，如果已选择源节点则取消选择
            if (clickLinkSourceNodeId) {
                clearTemporaryNodeSelection();
                clickLinkSourceNodeId = null;
                showMessage('已取消源节点选择，请重新点击源节点', 'info');
                return true; // 已处理
            }
            return false; // 不在连线创建模式，让事件继续处理
        }
        
        e.stopPropagation();
        
        const nodeId = nodeGroup.getAttribute('data-node-id');
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        if (!clickLinkSourceNodeId) {
            // 选择源节点
            clickLinkSourceNodeId = nodeId;
            highlightNodeForLink(nodeId, 'source');
            showMessage(`已选择源节点: ${nodeId}，请选择待连接节点`, 'info');
            return true; // 已处理
        } else if (nodeId === clickLinkSourceNodeId) {
            showMessage('不能连接到同一个节点，请点击其他节点', 'warning');
            return true; // 已处理
        } else {
            // 选择目标节点，创建连线
            createLink(clickLinkSourceNodeId, nodeId);
            exitClickLinkCreationMode();
            return true; // 已处理
        }
    } else if (currentLinkCreationType === 'sameLayer') {
        // 同级连接模式
        if (!nodeGroup) {
            // 点击了画布空白区域，如果已选择源节点则取消选择
            if (clickLinkSourceNodeId) {
                clearTemporaryNodeSelection();
                clickLinkSourceNodeId = null;
                showMessage('已取消源节点选择，请重新点击源节点', 'info');
                return true; // 已处理
            }
            return false; // 不在连线创建模式，让事件继续处理
        }
        
        e.stopPropagation();
        
        const nodeId = nodeGroup.getAttribute('data-node-id');
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return true; // 已处理
        
        if (!clickLinkSourceNodeId) {
            // 选择源节点
            clickLinkSourceNodeId = nodeId;
            highlightNodeForLink(nodeId, 'source');
            showMessage(`已选择源节点: ${nodeId}，请选择目标节点（将使用弧线连接）`, 'info');
            return true; // 已处理
        } else if (nodeId === clickLinkSourceNodeId) {
            showMessage('不能连接到同一个节点，请点击其他节点', 'warning');
            return true; // 已处理
        } else {
            // 🔴 用户自行创建概念图模式下不需要检测是否是同级节点，直接使用弧线连接
            // 选择目标节点，创建同级连接（使用弧线）
            createSameLayerLink(clickLinkSourceNodeId, nodeId);
            exitClickLinkCreationMode();
            return true; // 已处理
        }
    } else if (currentLinkCreationType === 'aggregated' || currentLinkCreationType === 'sameLayerAggregated') {
        // 聚合连接模式
        if (!nodeGroup) {
            // 点击了画布空白区域
            if (clickLinkSourceNodeId && clickLinkTargetNodes.length >= 2) {
                // 如果已选择源节点和至少两个目标节点，完成创建
                if (currentLinkCreationType === 'aggregated') {
                    createAggregatedLinks(clickLinkSourceNodeId, clickLinkTargetNodes);
                } else {
                    createSameLayerAggregatedLinks(clickLinkSourceNodeId, clickLinkTargetNodes);
                }
                exitClickLinkCreationMode();
            } else if (clickLinkSourceNodeId && clickLinkTargetNodes.length === 1) {
                // 如果只选择了一个目标节点，提示需要至少两个
                showMessage('聚合连接需要至少两个目标节点，请继续点击目标节点', 'warning');
            } else if (clickLinkSourceNodeId) {
                // 如果只选择了源节点，提示继续选择目标节点
                showMessage('请继续点击目标节点，选择至少两个目标节点后点击画布空白处完成创建', 'info');
            }
            return true; // 已处理
        }
        
        e.stopPropagation();
        
        const nodeId = nodeGroup.getAttribute('data-node-id');
        const node = currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return true; // 已处理
        
        if (!clickLinkSourceNodeId) {
            // 选择源节点
            clickLinkSourceNodeId = nodeId;
            highlightNodeForLink(nodeId, 'source');
            
            const message = currentLinkCreationType === 'aggregated' 
                ? `已选择源节点: ${nodeId}，请依次点击目标节点`
                : `已选择源节点: ${nodeId}，请依次点击同级目标节点`;
            showMessage(message, 'info');
            return true; // 已处理
        } else if (nodeId === clickLinkSourceNodeId) {
            showMessage('不能连接到同一个节点，请点击其他节点', 'warning');
            return true; // 已处理
        } else {
            // 选择目标节点
            if (currentLinkCreationType === 'sameLayerAggregated') {
                // 检查是否为同级节点
                const sourceNode = currentGraphData.nodes.find(n => n.id === clickLinkSourceNodeId);
                const sourceLayer = sourceNode ? (sourceNode.layer || 0) : 0;
                const targetLayer = node.layer || 0;
                
                if (sourceLayer !== targetLayer) {
                    showMessage('同级聚合连接只能连接同一层级的节点', 'warning');
                    return true; // 已处理
                }
            }
            
            // 检查是否已经选择过这个节点
            if (clickLinkTargetNodes.includes(nodeId)) {
                showMessage('该节点已被选择，请点击其他节点', 'warning');
                return true; // 已处理
            }
            
            clickLinkTargetNodes.push(nodeId);
            highlightNodeForLink(nodeId, 'target');
            
            // 提示用户点击画布空白处完成创建
            if (clickLinkTargetNodes.length >= 2) {
                showMessage(`已选择 ${clickLinkTargetNodes.length} 个目标节点，点击画布空白处完成创建`, 'success');
            } else {
                showMessage(`已选择 ${clickLinkTargetNodes.length} 个目标节点，继续点击添加更多节点，或选择至少两个节点后点击画布空白处完成创建`, 'info');
            }
            return true; // 已处理
        }
    }
    
    return false; // 未处理，让事件继续
}

// exitClickLinkCreationMode - 退出点击连线创建模式
function exitClickLinkCreationMode() {
    // 清除节点高亮
    clearTemporaryNodeSelection();
    
    currentLinkCreationType = 'normal';
    clickLinkSourceNodeId = null;
    clickLinkTargetNodes = [];
    
    // 清除全局标志
    window.currentLinkCreationType = null;
    
    // 恢复按钮状态
    // 通过ID重新获取按钮元素（因为按钮可能被克隆了）
    const addLinkBtn = document.getElementById('addLinkBtn');
    const addAggregatedLinkBtn = document.getElementById('addAggregatedLinkBtn');
    const addSameLayerLinkBtn = document.getElementById('addSameLayerLinkBtn');
    const addSameLayerAggregatedLinkBtn = document.getElementById('addSameLayerAggregatedLinkBtn');
    
    if (addLinkBtn) {
        addLinkBtn.textContent = '🔗 添加连线';
        addLinkBtn.style.backgroundColor = '';
        window.addLinkBtn = addLinkBtn;
        // 🔴 重新绑定点击事件（因为按钮可能被克隆了，需要重新绑定）
        addLinkBtn.onclick = null; // 清除旧的事件监听器
        addLinkBtn.addEventListener('click', function() {
            console.log('添加连线按钮被点击');
            if (typeof window.addNewLink === 'function') {
                window.addNewLink();
            } else if (typeof addNewLink === 'function') {
                addNewLink();
            }
        });
    }
    if (addAggregatedLinkBtn) {
        addAggregatedLinkBtn.textContent = '🔀 聚合连接';
        addAggregatedLinkBtn.style.backgroundColor = '';
        window.addAggregatedLinkBtn = addAggregatedLinkBtn;
        // 🔴 重新绑定点击事件（因为按钮可能被克隆了，需要重新绑定）
        addAggregatedLinkBtn.onclick = null; // 清除旧的事件监听器
        addAggregatedLinkBtn.addEventListener('click', function() {
            console.log('聚合连接按钮被点击');
            if (typeof window.addAggregatedLink === 'function') {
                window.addAggregatedLink();
            }
        });
    }
    if (addSameLayerLinkBtn) {
        addSameLayerLinkBtn.textContent = '🔗 同级连接';
        addSameLayerLinkBtn.style.backgroundColor = '';
        window.addSameLayerLinkBtn = addSameLayerLinkBtn;
        // 🔴 重新绑定点击事件（因为按钮可能被克隆了，需要重新绑定）
        addSameLayerLinkBtn.onclick = null; // 清除旧的事件监听器
        addSameLayerLinkBtn.addEventListener('click', function() {
            console.log('同级连接按钮被点击');
            if (typeof window.addSameLayerLink === 'function') {
                window.addSameLayerLink();
            }
        });
    }
    if (addSameLayerAggregatedLinkBtn) {
        addSameLayerAggregatedLinkBtn.textContent = '🔄 同级聚合连接';
        addSameLayerAggregatedLinkBtn.style.backgroundColor = '';
        window.addSameLayerAggregatedLinkBtn = addSameLayerAggregatedLinkBtn;
        // 🔴 重新绑定点击事件（因为按钮可能被克隆了，需要重新绑定）
        addSameLayerAggregatedLinkBtn.onclick = null; // 清除旧的事件监听器
        addSameLayerAggregatedLinkBtn.addEventListener('click', function() {
            console.log('同级聚合连接按钮被点击');
            if (typeof window.addSameLayerAggregatedLink === 'function') {
                window.addSameLayerAggregatedLink();
            }
        });
    }
    
    // 移除SVG点击事件监听器
    const svg = document.querySelector('.concept-graph') || document.querySelector('.scaffold-concept-graph');
    if (svg && svg.hasAttribute('data-link-creation-listener')) {
        svg.removeEventListener('click', handleNodeClickForLink);
        svg.removeAttribute('data-link-creation-listener');
    }
    
    // 恢复节点鼠标样式
    if (svg) {
        const allNodes = svg.querySelectorAll('g[data-node-id]');
        allNodes.forEach(nodeGroup => {
            const rect = nodeGroup.querySelector('rect');
            if (rect) {
                rect.style.cursor = '';
            }
        });
    }
    
    showMessage('已退出连线创建模式', 'info');
}

// createAggregatedLinks - 创建聚合连接（默认两个分支）
function createAggregatedLinks(sourceId, targetIds) {
    if (!targetIds || targetIds.length < 2) {
        showMessage('聚合连接需要至少两个目标节点', 'warning');
        return;
    }
    
    // 为每个目标节点创建连线，使用相同的标签
    const linkLabel = prompt('请输入连接词（用于聚合连接）:', '');
    if (linkLabel === null) {
        showMessage('已取消创建聚合连接', 'info');
        return;
    }
    
    // 为每个目标节点创建连线，使用相同的标签
    const createdLinks = [];
    targetIds.forEach(targetId => {
        // 检查是否已存在相同的连线
        const existingLink = currentGraphData.links.find(link => 
            link.source === sourceId && link.target === targetId
        );
        
        if (!existingLink) {
            const sourceNode = currentGraphData.nodes.find(n => n.id === sourceId);
            const sourceLayer = sourceNode ? (sourceNode.layer || 0) : 0;
            const targetNode = currentGraphData.nodes.find(n => n.id === targetId);
            const targetLayer = targetNode ? (targetNode.layer || 0) : 0;
            
            const newLink = {
                id: `link-${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                label: linkLabel || '双击编辑',
                isCurved: false,
                layer: `L${sourceLayer}-L${targetLayer}`
            };
            
            currentGraphData.links.push(newLink);
            createdLinks.push(newLink);
        }
    });
    
    if (createdLinks.length > 0) {
        window.currentGraphData = currentGraphData;
        drawGraph(currentGraphData);
        saveToHistory(currentGraphData);
        showMessage(`已创建聚合连接，包含 ${createdLinks.length} 个分支`, 'success');
    } else {
        showMessage('所有连线已存在', 'warning');
    }
}

// createSameLayerLink - 创建同级连接（连接同一层级的两个节点）
function createSameLayerLink(sourceId, targetId) {
    const sourceNode = currentGraphData.nodes.find(n => n.id === sourceId);
    const targetNode = currentGraphData.nodes.find(n => n.id === targetId);
    
    if (!sourceNode || !targetNode) {
        showMessage('无法找到源节点或目标节点', 'error');
        return;
    }
    
    const sourceLayer = sourceNode.layer || 0;
    const targetLayer = targetNode.layer || 0;
    
    // 🔴 用户自行创建概念图模式下不需要检测是否是同级节点，直接使用弧线连接
    // 不进行层级验证，允许连接任意两个节点
    
    // 检查是否已存在相同的连线
    const existingLink = currentGraphData.links.find(link => 
        link.source === sourceId && link.target === targetId
    );
    
    if (existingLink) {
        showMessage('连线已存在', 'warning');
        return;
    }
    
    // 创建连线（用户自行创建的同级连接，直接使用弧线，不需要检测层级）
    const newLink = {
        id: `link-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        label: '双击编辑',
        // 🔴 标记为用户自行创建的同级连接，直接使用弧线，不需要检测层级
        isUserCreatedSameLayer: true,
        layer: `L${sourceLayer}-L${targetLayer}` // 保留层级信息，但不用于验证
    };
    
    currentGraphData.links.push(newLink);
    window.currentGraphData = currentGraphData;
    drawGraph(currentGraphData);
    saveToHistory(currentGraphData);
    showMessage('已创建同级连接（弧线）', 'success');
}

// createSameLayerAggregatedLinks - 创建同级聚合连接（默认两个分支）
function createSameLayerAggregatedLinks(sourceId, targetIds) {
    if (!targetIds || targetIds.length < 2) {
        showMessage('同级聚合连接需要至少两个目标节点', 'warning');
        return;
    }
    
    const sourceNode = currentGraphData.nodes.find(n => n.id === sourceId);
    if (!sourceNode) {
        showMessage('无法找到源节点', 'error');
        return;
    }
    
    // 🔴 检查是否是用户自行创建模式
    const nodesWithLayer = currentGraphData.nodes.filter(n => n.layer !== undefined && n.layer !== null);
    const isUserCreatedMode = nodesWithLayer.length === 0 || nodesWithLayer.length < currentGraphData.nodes.length * 0.5;
    
    // 获取源节点层级（用于后续创建连线）
    const sourceLayer = sourceNode.layer !== undefined && sourceNode.layer !== null ? sourceNode.layer : 0;
    
    // 🔴 用户自行创建模式下不需要进行层级检测，其他模式需要检测层级
    if (!isUserCreatedMode) {
        // 验证所有目标节点都是同一层级
        const invalidTargets = targetIds.filter(targetId => {
            const targetNode = currentGraphData.nodes.find(n => n.id === targetId);
            return !targetNode || (targetNode.layer || 0) !== sourceLayer;
        });
        
        if (invalidTargets.length > 0) {
            showMessage('同级聚合连接只能连接同一层级的节点', 'warning');
            return;
        }
    }
    
    // 为每个目标节点创建连线，使用相同的标签
    let linkLabel = prompt('请输入连接词（用于同级聚合连接）:', '');
    if (linkLabel === null) {
        showMessage('已取消创建同级聚合连接', 'info');
        return;
    }
    
    // 确保连接词不为空
    linkLabel = linkLabel.trim();
    if (!linkLabel) {
        showMessage('连接词不能为空，请重新输入', 'warning');
        return;
    }
    
    // 为每个目标节点创建连线，使用相同的标签
    const createdLinks = [];
    targetIds.forEach(targetId => {
        // 检查是否已存在相同的连线
        const existingLink = currentGraphData.links.find(link => 
            link.source === sourceId && link.target === targetId
        );
        
        if (!existingLink) {
            const newLink = {
                id: `link-${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                label: linkLabel, // 已经验证过不为空
                isCurved: false,
                layer: `L${sourceLayer}-L${sourceLayer}`, // 同级连接
                isSameLayerAggregated: true // 🔴 标记为同级聚合连接，只有通过此功能创建的连线才会被聚合
            };
            
            currentGraphData.links.push(newLink);
            createdLinks.push(newLink);
        }
    });
    
    if (createdLinks.length > 0) {
        window.currentGraphData = currentGraphData;
        drawGraph(currentGraphData);
        saveToHistory(currentGraphData);
        showMessage(`已创建同级聚合连接，包含 ${createdLinks.length} 个分支`, 'success');
    } else {
        showMessage('所有连线已存在', 'warning');
    }
}

// 导出函数到全局作用域
window.enterDragLinkCreationMode = enterClickLinkCreationMode; // 保持向后兼容
window.enterClickLinkCreationMode = enterClickLinkCreationMode;
window.exitClickLinkCreationMode = exitClickLinkCreationMode;
window.handleNodeClickForLink = handleNodeClickForLink;
window.createAggregatedLinks = createAggregatedLinks;
window.createSameLayerLink = createSameLayerLink;
window.createSameLayerAggregatedLinks = createSameLayerAggregatedLinks;

