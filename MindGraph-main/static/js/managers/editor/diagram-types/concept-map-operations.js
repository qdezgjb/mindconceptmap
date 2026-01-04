/**
 * Concept Map Operations
 * ======================
 * 
 * Handles add/delete/update operations specific to Concept Maps.
 * Manages concepts (freeform nodes with positions) and connections.
 * 
 * Copyright 2024-2025 北京思源智教科技有限公司 (Beijing Siyuan Zhijiao Technology Co., Ltd.)
 * All Rights Reserved
 * 
 * Proprietary License - All use without explicit permission is prohibited.
 * Unauthorized use, copying, modification, distribution, or execution is strictly prohibited.
 * 
 * @author WANG CUNCHI
 */

class ConceptMapOperations {
    constructor(eventBus, stateManager, logger) {
        this.eventBus = eventBus;
        this.stateManager = stateManager;
        this.logger = logger || console;
        
        this.logger.info('ConceptMapOperations', 'Concept Map Operations initialized');
    }
    
    /**
     * Add a new concept node to Concept Map
     * 使用 concept-map-renderer.js 中的 addNewConceptNode 函数
     * 注意：概念图使用独立的渲染系统，添加节点后不触发重新渲染事件
     * @param {Object} spec - Current diagram spec
     * @param {Object} editor - Editor instance
     * @returns {Object} Updated spec
     */
    addNode(spec, editor) {
        this.logger.debug('ConceptMapOperations', 'addNode called');
        
        // 使用 concept-map-renderer.js 中的 addNewConceptNode 函数
        // 这个函数直接在 SVG 中添加节点，不需要重新渲染整个图
        if (typeof window.addNewConceptNode === 'function') {
            const newNode = window.addNewConceptNode();
            
            if (newNode) {
                // 同步更新 spec，确保数据一致性
                if (!spec) {
                    spec = { topic: '', concepts: [], relationships: [] };
                }
                if (!Array.isArray(spec.concepts)) {
                    spec.concepts = [];
                }
                
                // 将新节点添加到 spec.concepts
                spec.concepts.push({
                    text: newNode.label,
                    x: newNode.x,
                    y: newNode.y
                });
                
                this.logger.debug('ConceptMapOperations', `Added new concept via renderer. Total concepts: ${spec.concepts.length}`);
                
                // 重要：概念图使用独立的渲染系统（concept-map-renderer.js）
                // 不触发 diagram:node_added 事件，避免 InteractiveEditor 重新渲染整个图
                // 节点已经由 addNewConceptNode() 直接添加到 SVG 中了
                
                // 只显示通知
                if (window.eventBus) {
                    window.eventBus.emit('notification:show', {
                        message: '新节点已添加',
                        type: 'success'
                    });
                }
            }
            
            return spec;
        }
        
        // 如果 addNewConceptNode 不可用，回退到原来的逻辑（会触发重新渲染）
        this.logger.warn('ConceptMapOperations', 'addNewConceptNode not available, using fallback');
        
        if (!spec || !Array.isArray(spec.concepts)) {
            this.logger.error('ConceptMapOperations', 'Invalid concept map spec');
            return null;
        }
        
        // Add new concept to spec with language support
        const newConceptText = window.languageManager?.translate('newConcept') || 'New Concept';
        spec.concepts.push({
            text: newConceptText,
            x: 400,
            y: 300
        });
        
        this.logger.debug('ConceptMapOperations', `Added new concept (fallback). Total concepts: ${spec.concepts.length}`);
        
        // Emit node added event (会触发重新渲染)
        this.eventBus.emit('diagram:node_added', {
            diagramType: 'concept_map',
            nodeType: 'concept',
            spec
        });
        
        return spec;
    }
    
    /**
     * Delete selected concept nodes from Concept Map
     * 使用 concept-map-renderer.js 中的删除函数
     * @param {Object} spec - Current diagram spec
     * @param {Array} nodeIds - Node IDs to delete (not used, uses renderer's selection)
     * @returns {Object} Updated spec
     */
    deleteNodes(spec, nodeIds) {
        this.logger.debug('ConceptMapOperations', 'deleteNodes called');
        
        // 使用 concept-map-renderer.js 中的删除函数
        if (typeof window.deleteConceptSelected === 'function') {
            window.deleteConceptSelected();
            this.logger.debug('ConceptMapOperations', 'Deleted via renderer');
            return spec;
        }
        
        // 回退到原来的逻辑
        if (!spec || !Array.isArray(spec.concepts)) {
            this.logger.error('ConceptMapOperations', 'Invalid concept map spec');
            return null;
        }
        
        // Collect node texts to delete from spec
        const textsToDelete = new Set();
        
        nodeIds.forEach(nodeId => {
            const shapeElement = d3.select(`[data-node-id="${nodeId}"]`);
            if (!shapeElement.empty()) {
                // Find associated text to match with spec
                const parentGroup = shapeElement.node()?.parentNode;
                let nodeText = '';
                
                if (parentGroup && parentGroup.tagName === 'g') {
                    const textElement = d3.select(parentGroup).select('text');
                    if (!textElement.empty()) {
                        // Use extractTextFromSVG to properly read tspan content
                        nodeText = (typeof window.extractTextFromSVG === 'function')
                            ? window.extractTextFromSVG(textElement)
                            : textElement.text();
                    }
                } else {
                    const textElement = d3.select(`[data-text-for="${nodeId}"]`);
                    if (!textElement.empty()) {
                        // Use extractTextFromSVG to properly read tspan content
                        nodeText = (typeof window.extractTextFromSVG === 'function')
                            ? window.extractTextFromSVG(textElement)
                            : textElement.text();
                    }
                }
                
                if (nodeText) {
                    textsToDelete.add(nodeText);
                }
            }
        });
        
        // Remove from concepts array
        spec.concepts = spec.concepts.filter(
            concept => !textsToDelete.has(concept.text)
        );
        
        // Remove connections involving deleted nodes
        if (Array.isArray(spec.connections)) {
            spec.connections = spec.connections.filter(
                conn => !textsToDelete.has(conn.from) && !textsToDelete.has(conn.to)
            );
        }
        
        const deletedCount = textsToDelete.size;
        this.logger.debug('ConceptMapOperations', `Deleted ${deletedCount} concept node(s)`);
        
        // Emit nodes deleted event
        this.eventBus.emit('diagram:nodes_deleted', {
            diagramType: 'concept_map',
            deletedCount: deletedCount,
            spec
        });
        
        // Emit operation completed for history
        this.eventBus.emit('diagram:operation_completed', {
            operation: 'delete_nodes',
            snapshot: JSON.parse(JSON.stringify(spec))
        });
        
        return spec;
    }
    
    /**
     * 清空画布
     * @param {Object} spec - Current diagram spec
     * @returns {Object} Updated spec (empty)
     */
    clearCanvas(spec) {
        this.logger.debug('ConceptMapOperations', 'clearCanvas called');
        
        // 使用 concept-map-renderer.js 中的清空函数
        if (typeof window.clearConceptCanvas === 'function') {
            window.clearConceptCanvas();
            this.logger.debug('ConceptMapOperations', 'Canvas cleared via renderer');
            
            // 返回空的 spec
            return {
                topic: spec?.topic || '',
                concepts: [],
                relationships: []
            };
        }
        
        this.logger.warn('ConceptMapOperations', 'clearConceptCanvas not available');
        return spec;
    }
    
    /**
     * 撤销操作
     */
    undo() {
        this.logger.debug('ConceptMapOperations', 'undo called');
        
        // 使用 concept-map-renderer.js 中的撤销函数
        if (typeof window.undoConceptOperation === 'function') {
            window.undoConceptOperation();
            this.logger.debug('ConceptMapOperations', 'Undo via renderer');
        } else {
            this.logger.warn('ConceptMapOperations', 'undoConceptOperation not available');
        }
    }
    
    /**
     * Update a concept node in Concept Map
     * Concept maps use generic text update (text is stored in spec.concepts)
     * @param {Object} spec - Current diagram spec
     * @param {string} nodeId - Node ID
     * @param {Object} updates - Updates to apply
     * @returns {Object} Updated spec
     */
    updateNode(spec, nodeId, updates) {
        if (!spec || !Array.isArray(spec.concepts)) {
            this.logger.error('ConceptMapOperations', 'Invalid concept map spec');
            return null;
        }
        
        // Find the node element by data-node-id
        const nodeElement = d3.select(`[data-node-id="${nodeId}"]`);
        if (nodeElement.empty()) {
            this.logger.warn('ConceptMapOperations', `Node not found: ${nodeId}`);
            return spec;
        }
        
        // Determine if nodeElement is a <g> group (concept map structure)
        const nodeTagName = nodeElement.node()?.tagName?.toLowerCase();
        const isGroupElement = nodeTagName === 'g';
        
        // Find the text element(s) for this node
        let textElement = null;
        let nodeText = '';
        
        // First, try to get text from data-concept-text attribute (most reliable)
        const storedText = nodeElement.attr('data-concept-text');
        if (storedText) {
            nodeText = storedText;
        }
        
        if (isGroupElement) {
            // Concept map structure: <g data-node-id="xxx"><rect/><text/></g>
            // Find text element inside the group
            textElement = nodeElement.select('text');
            if (!textElement.empty() && !nodeText) {
                // Use extractTextFromSVG to properly read tspan content
                nodeText = (typeof window.extractTextFromSVG === 'function')
                    ? window.extractTextFromSVG(textElement)
                    : textElement.text();
            }
        } else {
            // Other structures: text is sibling or has data-text-for attribute
            const textByDataAttr = d3.select(`[data-text-for="${nodeId}"]`);
            if (!textByDataAttr.empty()) {
                textElement = textByDataAttr;
                if (!nodeText) {
                    nodeText = (typeof window.extractTextFromSVG === 'function')
                        ? window.extractTextFromSVG(textElement)
                        : textElement.text();
                }
            } else {
                // Try next sibling
                const shapeNode = nodeElement.node();
                if (shapeNode.nextElementSibling && shapeNode.nextElementSibling.tagName === 'text') {
                    textElement = d3.select(shapeNode.nextElementSibling);
                    if (!nodeText) {
                        nodeText = (typeof window.extractTextFromSVG === 'function')
                            ? window.extractTextFromSVG(textElement)
                            : textElement.text();
                    }
                }
            }
        }
        
        this.logger.debug('ConceptMapOperations', 'updateNode - found elements', {
            nodeId,
            isGroupElement,
            hasTextElement: textElement && !textElement.empty(),
            nodeText: nodeText?.substring(0, 50),
            newText: updates.text?.substring(0, 50)
        });
        
        // Initialize node dimensions metadata if it doesn't exist
        if (!spec._node_dimensions) {
            spec._node_dimensions = {};
        }
        
        // Find the concept in spec and update it
        if (nodeText && updates.text !== undefined) {
            // Check if this is the focus question / topic node
            // Focus question node has special format: "焦点问题：{topic}" or node id is 'focus-question-node'
            const isFocusQuestionNode = nodeId === 'focus-question-node' || 
                                        nodeText.startsWith('焦点问题：') || 
                                        nodeText.startsWith('焦点问题:');
            
            if (isFocusQuestionNode || nodeText === spec.topic) {
                // Update topic/focus question
                const oldText = spec.topic;
                // Extract the actual topic text (remove prefix if present in the new text)
                let newTopicText = updates.text;
                if (newTopicText.startsWith('焦点问题：')) {
                    newTopicText = newTopicText.substring('焦点问题：'.length);
                } else if (newTopicText.startsWith('焦点问题:')) {
                    newTopicText = newTopicText.substring('焦点问题:'.length);
                }
                spec.topic = newTopicText;
                
                // Update connections that reference the topic
                if (Array.isArray(spec.connections)) {
                    spec.connections.forEach(conn => {
                        if (conn.from === oldText) {
                            conn.from = updates.text;
                        }
                        if (conn.to === oldText) {
                            conn.to = updates.text;
                        }
                    });
                }
                // Also update relationships array if it exists
                if (Array.isArray(spec.relationships)) {
                    spec.relationships.forEach(rel => {
                        if (rel.from === oldText) {
                            rel.from = updates.text;
                        }
                        if (rel.to === oldText) {
                            rel.to = updates.text;
                        }
                    });
                }
                
                // Update _layout.positions key if it exists (concept maps use text as position keys)
                if (spec._layout && spec._layout.positions && spec._layout.positions[oldText]) {
                    spec._layout.positions[updates.text] = spec._layout.positions[oldText];
                    delete spec._layout.positions[oldText];
                }
                
                // Update data-concept-text attribute in DOM
                if (!nodeElement.empty()) {
                    nodeElement.attr('data-concept-text', newTopicText);
                }
                
                // CRITICAL: Actually update the DOM text content
                // For focus question node, display the full format with prefix
                if (textElement && !textElement.empty()) {
                    const displayText = isFocusQuestionNode ? `焦点问题：${newTopicText}` : newTopicText;
                    textElement.text(displayText);
                    this.logger.debug('ConceptMapOperations', 'Updated topic text in DOM', { displayText });
                    
                    // Also update window.focusQuestion for focus question node
                    if (isFocusQuestionNode) {
                        window.focusQuestion = newTopicText;
                    }
                }
                
                this.logger.debug('ConceptMapOperations', `Updated topic from "${oldText}" to "${newTopicText}"`);
            } else {
                // Find concept in concepts array
                // Concepts can be strings or objects with text property
                let conceptIndex = -1;
                let concept = null;
                
                for (let i = 0; i < spec.concepts.length; i++) {
                    const c = spec.concepts[i];
                    if (typeof c === 'string') {
                        if (c === nodeText) {
                            conceptIndex = i;
                            concept = c;
                            break;
                        }
                    } else if (c && typeof c === 'object' && c.text === nodeText) {
                        conceptIndex = i;
                        concept = c;
                        break;
                    }
                }
                
                if (concept !== null && conceptIndex >= 0) {
                    // Get old text before update
                    const oldText = typeof concept === 'string' ? concept : concept.text;
                    
                    // Check if we should preserve dimensions (when emptying node)
                    const preservedWidth = nodeElement.attr('data-preserved-width');
                    const preservedHeight = nodeElement.attr('data-preserved-height');
                    const preservedRadius = nodeElement.attr('data-preserved-radius');
                    
                    if ((preservedWidth && preservedHeight || preservedRadius) && updates.text === '') {
                        // Use the old text as key since we're updating it
                        const nodeKey = `concept-${oldText}`;
                        spec._node_dimensions[nodeKey] = {};
                        if (preservedWidth && preservedHeight) {
                            spec._node_dimensions[nodeKey].w = parseFloat(preservedWidth);
                            spec._node_dimensions[nodeKey].h = parseFloat(preservedHeight);
                        }
                        if (preservedRadius) {
                            spec._node_dimensions[nodeKey].r = parseFloat(preservedRadius);
                        }
                        // Also store with new (empty) text key for lookup after update
                        spec._node_dimensions[`concept-${updates.text}`] = spec._node_dimensions[nodeKey];
                        this.logger.debug('ConceptMapOperations', 'Preserved dimensions for empty concept node', {
                            nodeKey,
                            dimensions: spec._node_dimensions[nodeKey]
                        });
                    }
                    
                    // Update the concept in the array
                    // If it's a string, replace it directly; if it's an object, update the text property
                    if (typeof concept === 'string') {
                        spec.concepts[conceptIndex] = updates.text;
                    } else {
                        spec.concepts[conceptIndex].text = updates.text;
                    }
                    
                    // Update data-concept-text attribute in DOM for future matching
                    if (!nodeElement.empty()) {
                        nodeElement.attr('data-concept-text', updates.text);
                    }
                    
                    // CRITICAL: Actually update the DOM text content
                    if (textElement && !textElement.empty()) {
                        textElement.text(updates.text);
                        this.logger.debug('ConceptMapOperations', 'Updated concept text in DOM');
                    }
                    
                    // Update connections that reference this concept
                    if (Array.isArray(spec.connections)) {
                        spec.connections.forEach(conn => {
                            if (conn.from === oldText) {
                                conn.from = updates.text;
                            }
                            if (conn.to === oldText) {
                                conn.to = updates.text;
                            }
                        });
                    }
                    // Also update relationships array if it exists
                    if (Array.isArray(spec.relationships)) {
                        spec.relationships.forEach(rel => {
                            if (rel.from === oldText) {
                                rel.from = updates.text;
                            }
                            if (rel.to === oldText) {
                                rel.to = updates.text;
                            }
                        });
                    }
                    
                    // Update _layout.positions key if it exists (concept maps use text as position keys)
                    if (spec._layout && spec._layout.positions && spec._layout.positions[oldText]) {
                        spec._layout.positions[updates.text] = spec._layout.positions[oldText];
                        delete spec._layout.positions[oldText];
                    }
                    
                    this.logger.debug('ConceptMapOperations', `Updated concept from "${oldText}" to "${updates.text}"`);
                } else {
                    this.logger.warn('ConceptMapOperations', `Concept not found in spec for text: "${nodeText}"`, {
                        nodeId,
                        nodeText,
                        conceptsInSpec: spec.concepts,
                        topicInSpec: spec.topic,
                        conceptsLength: spec.concepts?.length
                    });
                }
            }
        } else {
            this.logger.warn('ConceptMapOperations', `Cannot update: nodeText is empty or updates.text is undefined`, {
                nodeText,
                hasTextUpdate: updates.text !== undefined
            });
        }
        
        // Update position if provided
        if (updates.x !== undefined || updates.y !== undefined) {
            const concept = spec.concepts.find(c => c.text === (updates.text || nodeText));
            if (concept) {
                if (updates.x !== undefined) {
                    concept.x = updates.x;
                }
                if (updates.y !== undefined) {
                    concept.y = updates.y;
                }
            }
        }
        
        this.logger.debug('ConceptMapOperations', 'Updated node', {
            nodeId,
            updates
        });
        
        // Emit node updated event with skipRender flag
        // Concept maps use independent rendering system, DOM is already updated directly
        // We don't want to trigger full re-render which would lose layout
        this.eventBus.emit('diagram:node_updated', {
            diagramType: 'concept_map',
            nodeId,
            updates,
            spec,
            skipRender: true  // CRITICAL: Don't re-render the entire diagram
        });
        
        // Emit operation completed for history
        this.eventBus.emit('diagram:operation_completed', {
            operation: 'update_node',
            snapshot: JSON.parse(JSON.stringify(spec))
        });
        
        return spec;
    }
    
    /**
     * Validate Concept Map spec
     * @param {Object} spec - Diagram spec
     * @returns {boolean} Whether spec is valid
     */
    validateSpec(spec) {
        if (!spec) {
            return false;
        }
        
        if (!Array.isArray(spec.concepts)) {
            this.logger.warn('ConceptMapOperations', 'Invalid or missing concepts array');
            return false;
        }
        
        return true;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.logger.debug('ConceptMapOperations', 'Destroying');
        
        // This manager doesn't register event listeners (only emits)
        // Just nullify references
        this.eventBus = null;
        this.stateManager = null;
        this.logger = null;
    }
}

// Make available globally
window.ConceptMapOperations = ConceptMapOperations;

