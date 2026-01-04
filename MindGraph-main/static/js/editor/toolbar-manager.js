/**
 * ToolbarManager - Manages toolbar actions and property panel
 * 
 * Copyright 2024-2025 北京思源智教科技有限公司 (Beijing Siyuan Zhijiao Technology Co., Ltd.)
 * All Rights Reserved
 * 
 * Proprietary License - All use without explicit permission is prohibited.
 * Unauthorized use, copying, modification, distribution, or execution is strictly prohibited.
 * 
 * @author WANG CUNCHI
 */

// Multi-LLM Configuration
const LLM_CONFIG = {
    MODELS: ['qwen', 'deepseek', 'hunyuan', 'kimi', 'doubao'],
    TIMEOUT_MS: 60000, // 60 seconds per LLM request
    RENDER_DELAY_MS: 300, // Delay before fitting diagram to window
    MODEL_NAMES: {
        'qwen': 'Qwen',
        'deepseek': 'DeepSeek',
        'hunyuan': 'Hunyuan',
        'kimi': 'Kimi',
        'doubao': 'Doubao'
    }
};

class ToolbarManager {
    constructor(editor) {
        this.editor = editor;
        this.propertyPanel = null;
        this.currentSelection = [];
        this.isAutoCompleting = false; // Flag to prevent concurrent auto-complete operations
        
        // NEW: Add owner identifier for Event Bus Listener Registry
        this.ownerId = 'ToolbarManager';
        
        // Session management - store session ID for lifecycle management
        this.sessionId = editor.sessionId;
        this.diagramType = editor.diagramType;
        
        // NOTE: activeAbortControllers removed - now managed by LLMEngineManager
        // Cancellation is handled via Event Bus to LLMAutoCompleteManager
        
        // Initialize DiagramValidator and LearningModeManager for Learning Mode
        this.validator = new DiagramValidator();
        this.learningModeManager = null; // Initialize on first use to access editor reference
        
        logger.debug('ToolbarManager', `Created for session ${this.sessionId?.substr(-8)}`, {
            diagramType: this.diagramType
        });
        
        // Register this instance in the global registry
        this.registerInstance();
        
        this.initializeElements();
        this.attachEventListeners();
        this.listenToSelectionChanges();
    }
    
    /**
     * Cancel all in-progress LLM requests
     * Called when returning to gallery or destroying the editor
     * Delegates to LLMAutoCompleteManager via Event Bus
     */
    cancelAllLLMRequests() {
        logger.info('ToolbarManager', 'Requesting cancellation of all LLM requests');
        // Delegate to LLMAutoCompleteManager which manages actual abort controllers
        window.eventBus.emit('autocomplete:cancel_requested', {});
    }
    
    // NOTE: logToBackend() removed - use logger.debug/info/warn/error directly
    
    /**
     * Register this toolbar manager instance globally, cleaning up old instances from different sessions
     */
    registerInstance() {
        // Initialize global registry if it doesn't exist
        if (!window.toolbarManagerRegistry) {
            window.toolbarManagerRegistry = new Map();
            logger.debug('ToolbarManager', 'Registry initialized');
        }
        
        // Clean up any existing toolbar manager from a different session
        window.toolbarManagerRegistry.forEach((oldManager, oldSessionId) => {
            if (oldSessionId !== this.sessionId) {
                logger.debug('ToolbarManager', 'Cleaning up old instance', {
                    oldSession: oldSessionId?.substr(-8)
                });
                oldManager.destroy();
                window.toolbarManagerRegistry.delete(oldSessionId);
            }
        });
        
        // Register this instance
        window.toolbarManagerRegistry.set(this.sessionId, this);
        logger.debug('ToolbarManager', 'Instance registered', {
            session: this.sessionId?.substr(-8)
        });
    }
    
    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Toolbar buttons
        this.addFocusBtn = document.getElementById('add-focus-btn');
        this.addNodeBtn = document.getElementById('add-node-btn');
        
        // LLM selector buttons (convert NodeList to Array for .find() support)
        this.llmButtons = Array.from(document.querySelectorAll('.llm-btn'));
        this.deleteNodeBtn = document.getElementById('delete-node-btn');
        this.autoCompleteBtn = document.getElementById('auto-complete-btn');
        this.lineModeBtn = document.getElementById('line-mode-btn');
        this.interactionBtn = document.getElementById('interaction-btn');  // 🆕 Interaction button (concept map only)
        this.learningBtn = document.getElementById('learning-btn');  // 🆕 Learning Mode button
        this.thinkingBtn = document.getElementById('thinking-btn');  // 🆕 Node Palette button
        this.duplicateNodeBtn = document.getElementById('duplicate-node-btn');
        this.emptyNodeBtn = document.getElementById('empty-node-btn');
        this.flowMapOrientationBtn = document.getElementById('flow-map-orientation-btn');
        this.clearCanvasBtn = document.getElementById('clear-canvas-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.redoBtn = document.getElementById('redo-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.importBtn = document.getElementById('import-btn');
        this.importFileInput = document.getElementById('import-file-input');
        
        // Line mode state
        this.isLineMode = false;
        
        // Property panel
        this.propertyPanel = document.getElementById('property-panel');
        this.closePropBtn = document.getElementById('close-properties');
        
        // Property inputs
        this.propText = document.getElementById('prop-text');
        this.propTextApply = document.getElementById('prop-text-apply');
        this.propFontSize = document.getElementById('prop-font-size');
        this.propFontFamily = document.getElementById('prop-font-family');
        this.propBold = document.getElementById('prop-bold');
        this.propItalic = document.getElementById('prop-italic');
        this.propUnderline = document.getElementById('prop-underline');
        this.propStrikethrough = document.getElementById('prop-strikethrough');
        
        // Color properties - hidden inputs for actual values
        this.propTextColor = document.getElementById('prop-text-color');
        this.propFillColor = document.getElementById('prop-fill-color');
        this.propStrokeColor = document.getElementById('prop-stroke-color');
        
        // Color buttons and shared palette
        this.btnTextColor = document.getElementById('btn-text-color');
        this.btnFillColor = document.getElementById('btn-fill-color');
        this.btnStrokeColor = document.getElementById('btn-stroke-color');
        this.previewTextColor = document.getElementById('preview-text-color');
        this.previewFillColor = document.getElementById('preview-fill-color');
        this.previewStrokeColor = document.getElementById('preview-stroke-color');
        this.colorPaletteDropdown = document.getElementById('color-palette-dropdown');
        this.sharedColorPalette = document.getElementById('shared-color-palette');
        this.propColorHex = document.getElementById('prop-color-hex');
        this.activeColorType = null; // 'text', 'fill', 'stroke', 'link-text', or 'link-line'
        
        // Link mode color properties
        this.propLinkTextColor = document.getElementById('prop-link-text-color');
        this.propLinkLineColor = document.getElementById('prop-link-line-color');
        this.btnLinkTextColor = document.getElementById('btn-link-text-color');
        this.btnLinkLineColor = document.getElementById('btn-link-line-color');
        this.previewLinkTextColor = document.getElementById('preview-link-text-color');
        this.previewLinkLineColor = document.getElementById('preview-link-line-color');
        this.linkColorPaletteDropdown = document.getElementById('link-color-palette-dropdown');
        this.linkSharedColorPalette = document.getElementById('link-shared-color-palette');
        this.propLinkColorHex = document.getElementById('prop-link-color-hex');
        this.propLinkLineWidth = document.getElementById('prop-link-line-width');
        this.linkLineWidthValue = document.getElementById('link-line-width-value');
        
        
        this.propStrokeWidth = document.getElementById('prop-stroke-width');
        this.propOpacity = document.getElementById('prop-opacity');
        
        // Value displays
        this.strokeWidthValue = document.getElementById('stroke-width-value');
        this.opacityValue = document.getElementById('opacity-value');
        
        // Status bar elements
        this.nodeCountElement = document.getElementById('node-count');
        
        // Initialize LLM selection and results cache
        this.selectedLLM = 'qwen';  // Default to Qwen
        this.llmResults = {};  // Cache for all LLM results
        this.isGeneratingMulti = false;  // Flag for multi-LLM generation
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // LLM selector buttons
        this.llmButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleLLMSelection(btn);
            });
        });
        
        // Set initial active state based on saved selection
        this.updateLLMButtonStates();
        
        // Toolbar buttons - stop event propagation to prevent conflicts
        this.addFocusBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleAddFocusQuestion();
        });
        this.addNodeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleAddNode();
        });
        this.deleteNodeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDeleteNode();
        });
        this.autoCompleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();  // Also prevent default to be extra safe
            
            // VERBOSE LOG: Mouse click on auto-complete button
            logger.info('ToolbarManager', '=== AUTO-COMPLETE BUTTON CLICKED ===', {
                timestamp: new Date().toISOString(),
                mouseEvent: {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    target: e.target?.id || 'unknown',
                    button: e.button
                },
                currentState: {
                    diagramType: this.editor?.diagramType,
                    sessionId: this.editor?.sessionId,
                    isAutoCompleting: this.isAutoCompleting,
                    isGeneratingMulti: this.isGeneratingMulti
                }
            });
            
            this.handleAutoComplete();
        });
        this.lineModeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLineMode();
        });
        this.interactionBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleInteraction();
        });
        this.flowMapOrientationBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            // CRITICAL: Only allow flip for flow_map diagram type
            // Delegate to ViewManager via Event Bus
            if (this.editor && this.editor.diagramType === 'flow_map' && window.eventBus) {
                window.eventBus.emit('view:flip_orientation_requested');
            }
        });
        this.learningBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleLearningMode();
        });
        this.thinkingBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleThinkingMode();
        });
        this.duplicateNodeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDuplicateNode();
        });
        this.emptyNodeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleEmptyNode();
        });
        this.clearCanvasBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleClearCanvas();
        });
        this.undoBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleUndo();
        });
        this.redoBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleRedo();
        });
        this.exportBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleExport();
        });
        this.saveBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleSave();
        });
        this.importBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleImport();
        });
        this.importFileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelected(file);
            }
            // Reset input so same file can be selected again
            this.importFileInput.value = '';
        });
        // Note: Back button handled by DiagramSelector.backToGallery()
        // which properly calls cancelAllLLMRequests() before cleanup
        
        // Property panel
        this.closePropBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.hidePropertyPanel();
            this.clearPropertyPanel();
        });
        
        // Property inputs - prevent event bubbling to avoid accidental diagram switches
        // Text input: Apply on Enter key (but allow Ctrl+Enter for line breaks)
        this.propText?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                // Regular Enter: apply all properties (same as clicking "应用" button)
                e.stopPropagation();
                e.preventDefault();
                this.applyAllProperties();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                // Ctrl+Enter: insert line break
                e.stopPropagation();
                e.preventDefault();
                const textarea = this.propText;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;
                
                // Insert newline at cursor position
                textarea.value = value.substring(0, start) + '\n' + value.substring(end);
                
                // Restore cursor position after the newline
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                
                // Auto-resize after inserting newline
                this.autoResizeTextarea(textarea);
            }
        });
        
        // Auto-resize textarea on input
        this.propText?.addEventListener('input', (e) => {
            this.autoResizeTextarea(e.target);
        });
        
        // Text apply button - applies text changes
        this.propTextApply?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Apply text + all style properties together (consistency with other diagrams)
            this.applyAllProperties();
        });
        
        // Reset styles button - resets to template defaults
        const resetStylesBtn = document.getElementById('reset-styles-btn');
        resetStylesBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.resetStyles();
        });
        this.propBold?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleBold();
            if (window.propertyPanelManager?.isLinkMode) {
                const fontWeight = this.propBold.classList.contains('active') ? 'bold' : 'normal';
                this.applyLinkPropertyOnly('fontWeight', fontWeight);
            } else {
                this.applyStylesRealtime();
            }
        });
        this.propItalic?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleItalic();
            if (window.propertyPanelManager?.isLinkMode) {
                const fontStyle = this.propItalic.classList.contains('active') ? 'italic' : 'normal';
                this.applyLinkPropertyOnly('fontStyle', fontStyle);
            } else {
                this.applyStylesRealtime();
            }
        });
        this.propUnderline?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleUnderline();
            if (window.propertyPanelManager?.isLinkMode) {
                this.applyLinkTextDecoration();
            } else {
                this.applyStylesRealtime();
            }
        });
        this.propStrikethrough?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleStrikethrough();
            if (window.propertyPanelManager?.isLinkMode) {
                this.applyLinkTextDecoration();
            } else {
                this.applyStylesRealtime();
            }
        });
        
        // Real-time style updates - apply ONLY the changed property
        this.propFontSize?.addEventListener('input', () => {
            if (window.propertyPanelManager?.isLinkMode) {
                this.applyLinkPropertyOnly('fontSize', this.propFontSize.value);
            } else {
                this.applyStylesRealtime();
            }
        });
        this.propFontFamily?.addEventListener('change', () => {
            if (window.propertyPanelManager?.isLinkMode) {
                this.applyLinkPropertyOnly('fontFamily', this.propFontFamily.value);
            } else {
                this.applyStylesRealtime();
            }
        });
        this.propStrokeWidth?.addEventListener('input', () => this.applyStylesRealtime());
        this.propOpacity?.addEventListener('input', () => {
            if (window.propertyPanelManager?.isLinkMode) {
                this.applyLinkPropertyOnly('opacity', this.propOpacity.value);
            } else {
                this.applyStylesRealtime();
            }
        });
        
        // Initialize shared color palette
        this.initColorPalette();
        
        // Color button click handlers
        this.btnTextColor?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColorPalette('text');
        });
        this.btnFillColor?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColorPalette('fill');
        });
        this.btnStrokeColor?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleColorPalette('stroke');
        });
        
        // Hex input for custom colors
        this.propColorHex?.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                this.applyColorFromHex(e.target.value);
            }
        });
        
        // Close palette when clicking outside
        document.addEventListener('click', (e) => {
            if (this.colorPaletteDropdown && 
                !this.colorPaletteDropdown.contains(e.target) &&
                !this.btnTextColor?.contains(e.target) &&
                !this.btnFillColor?.contains(e.target) &&
                !this.btnStrokeColor?.contains(e.target)) {
                this.closeColorPalette();
            }
            // Also close link color palette
            if (this.linkColorPaletteDropdown && 
                !this.linkColorPaletteDropdown.contains(e.target) &&
                !this.btnLinkTextColor?.contains(e.target) &&
                !this.btnLinkLineColor?.contains(e.target)) {
                this.closeLinkColorPalette();
            }
        });
        
        // Link color button click handlers
        this.btnLinkTextColor?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLinkColorPalette('link-text');
        });
        this.btnLinkLineColor?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLinkColorPalette('link-line');
        });
        
        // Link hex input for custom colors
        this.propLinkColorHex?.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                this.applyLinkColorFromHex(e.target.value);
            }
        });
        
        // Initialize link color palette
        this.initLinkColorPalette();
        
        // Sliders
        this.propStrokeWidth?.addEventListener('input', (e) => {
            this.strokeWidthValue.textContent = `${e.target.value}px`;
        });
        
        this.propOpacity?.addEventListener('input', (e) => {
            const percent = Math.round(e.target.value * 100);
            this.opacityValue.textContent = `${percent}%`;
        });
        
        // Link line width slider
        this.propLinkLineWidth?.addEventListener('input', (e) => {
            if (this.linkLineWidthValue) {
                this.linkLineWidthValue.textContent = `${e.target.value}px`;
            }
            // Apply ONLY line width in real-time (not all properties)
            this.applyLinkPropertyOnly('lineWidth', e.target.value);
        });
        
        // Listen to history state changes to update undo/redo button states
        if (window.eventBus) {
            window.eventBus.onWithOwner('history:state_changed', (data) => {
                this.updateUndoRedoButtonStates(data.canUndo, data.canRedo);
            }, this.ownerId);
            
            // Listen to file export completion events for notifications
            window.eventBus.onWithOwner('file:mg_export_completed', (data) => {
                this.showNotification(this.getNotif('diagramSaved'), 'success');
            }, this.ownerId);
            
            window.eventBus.onWithOwner('file:mg_export_error', (data) => {
                this.showNotification(this.getNotif('saveFailed'), 'error');
            }, this.ownerId);
        }
    }
    
    /**
     * Update undo/redo button enabled/disabled states
     * @param {boolean} canUndo - Whether undo is possible
     * @param {boolean} canRedo - Whether redo is possible
     */
    updateUndoRedoButtonStates(canUndo, canRedo) {
        if (this.undoBtn) {
            this.undoBtn.disabled = !canUndo;
            this.undoBtn.style.opacity = canUndo ? '1' : '0.5';
        }
        if (this.redoBtn) {
            this.redoBtn.disabled = !canRedo;
            this.redoBtn.style.opacity = canRedo ? '1' : '0.5';
        }
    }
    
    /**
     * Handle LLM model selection button click
     * EVENT BUS WRAPPER - Delegates to UIStateLLMManager
     */
    handleLLMSelection(button) {
        window.eventBus.emit('llm:model_selection_clicked', { button });
        logger.debug('ToolbarManager', 'LLM selection requested via Event Bus');
    }
    
    /**
     * Render cached LLM result
     * EVENT BUS WRAPPER - Delegates to LLMAutoCompleteManager
     */
    renderCachedLLMResult(llmModel) {
        window.eventBus.emit('autocomplete:render_cached_requested', { llmModel });
        logger.debug('ToolbarManager', `Render cached result requested for ${llmModel} via Event Bus`);
    }
    
    /**
     * Update LLM button active states
     * EVENT BUS WRAPPER - Delegates to LLMAutoCompleteManager
     */
    updateLLMButtonStates() {
        window.eventBus.emit('autocomplete:update_button_states_requested', {});
        logger.debug('ToolbarManager', 'Button states update requested via Event Bus');
    }
    
    /**
     * Listen to selection changes from editor
     * ARCHITECTURE: Uses Event Bus instead of CustomEvent
     */
    listenToSelectionChanges() {
        // Listen to Event Bus for selection changes (from InteractionHandler)
        if (window.eventBus) {
            window.eventBus.onWithOwner('interaction:selection_changed', (data) => {
                this.currentSelection = data.selectedNodes || [];
                const hasSelection = this.currentSelection.length > 0;
                
                // VERBOSE LOG: Node selection via mouse click
                if (hasSelection && this.currentSelection.length > 0) {
                    logger.info('ToolbarManager', '=== NODE SELECTED (MOUSE CLICK) ===', {
                    timestamp: new Date().toISOString(),
                    selectedNodes: this.currentSelection.map(nodeId => {
                        // nodeId is a string, need to get the actual DOM element
                        const element = document.querySelector(`[data-node-id="${nodeId}"]`);
                        if (element) {
                            return {
                                id: nodeId,
                                text: element.textContent || element.getAttribute('data-text-for') || 'no text',
                                type: element.getAttribute('data-node-type') || 'unknown',
                                tagName: element.tagName,
                                attributes: {
                                    partIndex: element.getAttribute('data-part-index'),
                                    subpartIndex: element.getAttribute('data-subpart-index'),
                                    categoryIndex: element.getAttribute('data-category-index'),
                                    leafIndex: element.getAttribute('data-leaf-index')
                                },
                                position: {
                                    x: element.getAttribute('x') || element.getAttribute('cx') || 'N/A',
                                    y: element.getAttribute('y') || element.getAttribute('cy') || 'N/A'
                                }
                            };
                        } else {
                            return {
                                id: nodeId,
                                text: 'element not found',
                                type: 'unknown',
                                tagName: 'N/A',
                                attributes: {},
                                position: { x: 'N/A', y: 'N/A' }
                            };
                        }
                    }),
                    totalSelected: this.currentSelection.length,
                    diagramType: this.editor?.diagramType
                });
            } else {
                logger.debug('ToolbarManager', 'Node selection cleared');
            }
            
            // Update toolbar button states
            this.updateToolbarState(hasSelection);
            
            const currentPanel = window.panelManager?.getCurrentPanel();
            
            // Show/hide property panel based on selection
            // NOTE: Previously blocked property panel when MindMate/ThinkGuide were open
            // This caused confusion as users couldn't edit nodes while chatting.
            // Now property panel always opens when a node is selected, which will
            // close MindMate/ThinkGuide automatically (panel manager single-panel rule).
            if (hasSelection && this.currentSelection.length > 0) {
                this.showPropertyPanel();
                this.loadNodeProperties(this.currentSelection[0]);
            } else {
                // Hide property panel when no selection (only if it's currently open)
                if (currentPanel === 'property') {
                    this.hidePropertyPanel();
                    this.clearPropertyPanel();
                }
            }
        }, this.ownerId);
        
            // Listen for link selection (concept map links)
            window.eventBus.onWithOwner('link:selected', (data) => {
                logger.info('ToolbarManager', '=== LINK SELECTED ===', {
                    timestamp: new Date().toISOString(),
                    linkId: data.linkId,
                    linkData: data.linkData,
                    diagramType: data.diagramType
                });
                
                // Clear node selection state
                this.currentSelection = [];
                
                // Show property panel for link
                this.showPropertyPanel();
                
                // Load link properties (PropertyPanelManager handles this)
                // The panel will switch to link mode automatically
            }, this.ownerId);
    }
        
        // Listen for notification requests from editor
        window.addEventListener('show-notification', (event) => {
            const { message, type } = event.detail;
            this.showNotification(message, type || 'info');
        });
        
        // Set up automatic node counter that watches for DOM changes
        this.setupNodeCounterObserver();
    }
    
    /**
     * Update toolbar button states
     */
    updateToolbarState(hasSelection) {
        if (this.deleteNodeBtn) {
            this.deleteNodeBtn.disabled = !hasSelection;
            this.deleteNodeBtn.style.opacity = hasSelection ? '1' : '0.5';
        }
        
        if (this.emptyNodeBtn) {
            this.emptyNodeBtn.disabled = !hasSelection;
            this.emptyNodeBtn.style.opacity = hasSelection ? '1' : '0.5';
        }
        
        if (this.duplicateNodeBtn) {
            this.duplicateNodeBtn.disabled = !hasSelection;
            this.duplicateNodeBtn.style.opacity = hasSelection ? '1' : '0.5';
        }
        
        // Add button state for diagrams that require selection (brace_map, double_bubble_map, flow_map, multi_flow_map)
        if (this.addNodeBtn) {
            // ARCHITECTURE: Use State Manager as source of truth for diagram type
            const diagramState = window.stateManager.getDiagramState();
            const diagramType = diagramState?.type;
            
            if (!diagramType) {
                logger.error('ToolbarManager', 'Cannot determine diagram type from State Manager');
                return;
            }
            const requiresSelection = ['brace_map', 'double_bubble_map', 'flow_map', 'multi_flow_map', 'tree_map'].includes(diagramType);
            
            if (requiresSelection) {
                this.addNodeBtn.disabled = !hasSelection;
                this.addNodeBtn.style.opacity = hasSelection ? '1' : '0.5';
            } else {
                // For other diagram types, add button is always enabled
                this.addNodeBtn.disabled = false;
                this.addNodeBtn.style.opacity = '1';
            }
        }
    }
    
    /**
     * Show property panel
     */
    showPropertyPanel() {
        if (this.propertyPanel) {
            logger.debug('ToolbarManager', 'Showing property panel');
            
            // Use centralized panel manager
            // CanvasController will handle view adjustments without resetting zoom/pan
            if (window.panelManager) {
                window.panelManager.openPanel('property');
            } else {
                // Fallback
                this.propertyPanel.style.display = 'block';
            }
            
            // Removed view reset logic - CanvasController.handlePanelChange now preserves
            // the current viewBox when panels open/close, maintaining user's zoom/pan level
        } else {
            logger.warn('ToolbarManager', 'Property panel element not found');
        }
    }
    
    /**
     * Hide property panel
     */
    hidePropertyPanel() {
        if (this.propertyPanel) {
            // Check if panel is already closed - skip if already hidden
            const isAlreadyHidden = this.propertyPanel.style.display === 'none' || 
                                   (window.panelManager && !window.panelManager.isPanelOpen('property'));
            
            if (isAlreadyHidden) {
                logger.debug('ToolbarManager', 'Property panel already hidden - skipping close');
                return;
            }
            
            // Use centralized panel manager
            if (window.panelManager) {
                window.panelManager.closePanel('property');
            } else {
                // Fallback
                this.propertyPanel.style.display = 'none';
            }
            
            // CanvasController.handlePanelChange will handle view adjustments
            // ViewManager.fitToFullCanvas will check state and skip if already fitted
            // No need to explicitly request fit here - let the panel close event handle it
        }
    }
    
    /**
     * Clear property panel inputs to default values
     * Called when switching diagrams or clearing selection
     */
    clearPropertyPanel() {
        // Clear text input
        if (this.propText) {
            this.propText.value = '';
            // Reset textarea height to minimum
            if (this.propText.tagName === 'TEXTAREA') {
                this.autoResizeTextarea(this.propText);
            }
        }
        
        // Reset font properties to defaults
        if (this.propFontSize) this.propFontSize.value = 14;
        if (this.propFontFamily) this.propFontFamily.value = "Inter, sans-serif";
        
        // Reset colors to defaults
        if (this.propTextColor) this.propTextColor.value = '#000000';
        if (this.propFillColor) this.propFillColor.value = '#2196f3';
        if (this.propStrokeColor) this.propStrokeColor.value = '#1976d2';
        
        // Reset stroke width and opacity to defaults
        if (this.propStrokeWidth) this.propStrokeWidth.value = 2;
        if (this.strokeWidthValue) this.strokeWidthValue.textContent = '2px';
        if (this.propOpacity) this.propOpacity.value = 1;
        if (this.opacityValue) this.opacityValue.textContent = '100%';
        
        // Reset toggle buttons
        if (this.propBold) this.propBold.classList.remove('active');
        if (this.propItalic) this.propItalic.classList.remove('active');
        if (this.propUnderline) this.propUnderline.classList.remove('active');
        if (this.propStrikethrough) this.propStrikethrough.classList.remove('active');
        
        // Update color button previews
        this.updateColorPreviews();
        
        // Close color palette if open
        this.closeColorPalette();
    }
    
    /**
     * Load properties from selected node
     */
    loadNodeProperties(nodeId) {
        const nodeElement = d3.select(`[data-node-id="${nodeId}"]`);
        
        if (nodeElement.empty()) return;
        
        // Get node attributes (current values)
        const fill = nodeElement.attr('fill') || '#2196f3';
        const stroke = nodeElement.attr('stroke') || '#1976d2';
        const strokeWidth = nodeElement.attr('stroke-width') || '2';
        // Use explicit null check to preserve opacity 0 (fully transparent)
        const opacityAttr = nodeElement.attr('opacity');
        const opacity = (opacityAttr !== null && opacityAttr !== undefined) ? opacityAttr : '1';
        
        // Get text element - try multiple methods to find it
        let textElement = null;
        let text = '';
        
        // Check if this is a dimension node - special handling needed
        const nodeType = nodeElement.attr('data-node-type');
        if (nodeType === 'dimension') {
            // For dimension nodes, get the actual value from data-dimension-value attribute
            const dimensionValue = nodeElement.attr('data-dimension-value') || '';
            text = dimensionValue;
            
            // Still find the text element for styling attributes
            textElement = d3.select(`[data-text-for="${nodeId}"]`);
            if (textElement.empty()) {
                // Try as child
                textElement = nodeElement.select('text');
            }
        } else {
            // Regular node handling - get display text
            // Method 1: Try finding text elements by data-node-id (for multi-line text)
            let textElements = d3.selectAll(`text[data-node-id="${nodeId}"]`);
            if (!textElements.empty()) {
                textElement = d3.select(textElements.node()); // Get first for attributes
                // Use extractTextFromSVG to handle multi-line text
                text = (typeof window.extractTextFromSVG === 'function') 
                    ? window.extractTextFromSVG(textElement) 
                    : (textElement.text() || '');
            } else {
                // Method 2: Try as child
                textElement = nodeElement.select('text');
                if (!textElement.empty()) {
                    text = (typeof window.extractTextFromSVG === 'function') 
                        ? window.extractTextFromSVG(textElement) 
                        : (textElement.text() || '');
                } else {
                    // Method 3: Try data-text-for attribute
                    textElement = d3.select(`[data-text-for="${nodeId}"]`);
                    if (!textElement.empty()) {
                        text = (typeof window.extractTextFromSVG === 'function') 
                            ? window.extractTextFromSVG(textElement) 
                            : (textElement.text() || '');
                    } else {
                        // Method 4: Try next sibling
                        const shapeNode = nodeElement.node();
                        if (shapeNode && shapeNode.nextElementSibling && shapeNode.nextElementSibling.tagName === 'text') {
                            textElement = d3.select(shapeNode.nextElementSibling);
                            text = (typeof window.extractTextFromSVG === 'function') 
                                ? window.extractTextFromSVG(textElement) 
                                : (textElement.text() || '');
                        }
                    }
                }
            }
        }
        
        // Get text attributes (with fallbacks if text element not found)
        const fontSize = textElement && !textElement.empty() ? (textElement.attr('font-size') || '14') : '14';
        const fontFamily = textElement && !textElement.empty() ? (textElement.attr('font-family') || "Inter, sans-serif") : "Inter, sans-serif";
        const textColor = textElement && !textElement.empty() ? (textElement.attr('fill') || '#000000') : '#000000';
        const fontWeight = textElement && !textElement.empty() ? (textElement.attr('font-weight') || 'normal') : 'normal';
        const fontStyle = textElement && !textElement.empty() ? (textElement.attr('font-style') || 'normal') : 'normal';
        const textDecoration = textElement && !textElement.empty() ? (textElement.attr('text-decoration') || 'none') : 'none';
        
        // Helper function to expand shorthand hex color codes (e.g., #fff -> #ffffff)
        const expandHexColor = (hex) => {
            if (!hex || !hex.startsWith('#')) return hex;
            // If it's a 3-digit hex code, expand it to 6 digits
            if (hex.length === 4) {
                return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
            }
            return hex;
        };
        
        // Expand shorthand hex codes for color inputs (HTML color inputs require 6-digit format)
        const expandedFill = expandHexColor(fill);
        const expandedStroke = expandHexColor(stroke);
        const expandedTextColor = expandHexColor(textColor);
        
        /**
         * Check if text is a default placeholder using smart pattern matching
         * This covers ALL template variations without hardcoding every possible combination
         */
        const isDefaultPlaceholder = (text) => {
            const trimmedText = text.trim();
            
            // === English Patterns ===
            const englishPatterns = [
                // "New X" patterns
                /^New (Attribute|Step|Cause|Effect|Branch|Node|Item|Category|Subitem|Concept|Context|Similarity|Part|Subpart|Left|Right)$/,
                // "X Difference" patterns (including alphanumeric like "Difference A1")
                /^(Left|Right) Difference$/,
                /^Difference [A-Z]\d+$/,
                // Topic variations
                /^(Main|Central|Root) Topic$/,
                /^Main (Concept|Event|Idea)$/,
                /^Topic [A-Z]$/,
                // Numbered patterns: "Context 1", "Attribute 5", etc.
                /^(Context|Attribute|Similarity|Cause|Effect|Item|Step|Part|Concept|Branch|Category) \d+$/,
                // Lettered patterns: "Item A", "Item B", etc.
                /^Item [A-Z]$/,
                // Hierarchical patterns: "Substep 1.1", "Subpart 2.3", "Sub-item 4.1", "Child 3.2", "Item 1.1"
                /^(Substep|Subpart|Sub-item|Child|Item) \d+\.\d+$/,
                // Flow/Process
                /^(Process Flow|Title)$/,
                // Bridge Map relating factor
                /^as$/,
                // Concept Map relationship labels (edge text)
                /^(relates to|includes|leads to)$/
            ];
            
            // === Chinese Patterns ===
            const chinesePatterns = [
                // "新X" patterns
                /^新(属性|步骤|原因|结果|分支|节点|项目|类别|子项|概念|联想|相似点|部分|子部分|左项|右项|事物[AB])$/,
                // "X不同点" patterns (including alphanumeric like "不同点A1")
                /^(左|右)不同点$/,
                /^不同点[A-Z]\d+$/,
                // Topic variations
                /^(主题|中心主题|主要概念|根主题|事件|核心概念)$/,
                /^主题[A-Z]$/,
                // Numbered patterns: "联想1", "属性5", etc.
                /^(联想|属性|相似点|原因|结果|步骤|部分|概念|分支|类别)\d+$/,
                // Bridge Map paired patterns: "事物A1", "事物B1", etc.
                /^事物[A-Z]\d+$/,
                // Hierarchical patterns: "子步骤1.1", "子部分2.3", "子项4.1", "子节点3.2", "项目1.1"
                /^(子步骤|子部分|子项|子节点|项目)\d+\.\d+$/,
                // Flow/Process
                /^(事件流程|标题)$/,
                // Bridge Map relating factor
                /^如同$/,
                // Concept Map relationship labels (edge text)
                /^(关联|包含|导致)$/
            ];
            
            // Test against all patterns
            const allPatterns = [...englishPatterns, ...chinesePatterns];
            return allPatterns.some(pattern => pattern.test(trimmedText));
        };
        
        // For dimension nodes, never treat as placeholder since we're showing the actual value
        const isPlaceholder = (nodeType === 'dimension') ? false : isDefaultPlaceholder(text);
        
        // Update property inputs
        if (this.propText) {
            if (isPlaceholder) {
                // Set as placeholder attribute (grey text that disappears on type)
                this.propText.value = '';
                this.propText.placeholder = text;
            } else {
                // Set as actual value
                this.propText.value = text;
                this.propText.placeholder = window.languageManager?.translate('nodeTextPlaceholder') || 'Node text';
            }
            // Auto-resize textarea after setting value
            if (this.propText.tagName === 'TEXTAREA') {
                this.autoResizeTextarea(this.propText);
            }
        }
        if (this.propFontSize) this.propFontSize.value = parseInt(fontSize);
        if (this.propFontFamily) this.propFontFamily.value = fontFamily;
        if (this.propTextColor) this.propTextColor.value = expandedTextColor;
        if (this.propFillColor) this.propFillColor.value = expandedFill;
        if (this.propStrokeColor) this.propStrokeColor.value = expandedStroke;
        if (this.propStrokeWidth) this.propStrokeWidth.value = parseFloat(strokeWidth);
        if (this.strokeWidthValue) this.strokeWidthValue.textContent = `${strokeWidth}px`;
        if (this.propOpacity) this.propOpacity.value = parseFloat(opacity);
        if (this.opacityValue) this.opacityValue.textContent = `${Math.round(parseFloat(opacity) * 100)}%`;
        
        // Update color button previews
        this.updateColorPreviews();
        
        // Update toggle buttons
        if (this.propBold) {
            this.propBold.classList.toggle('active', fontWeight === 'bold');
        }
        if (this.propItalic) {
            this.propItalic.classList.toggle('active', fontStyle === 'italic');
        }
        if (this.propUnderline) {
            // textDecoration can contain multiple values like 'underline line-through'
            this.propUnderline.classList.toggle('active', textDecoration.includes('underline'));
        }
        if (this.propStrikethrough) {
            this.propStrikethrough.classList.toggle('active', textDecoration.includes('line-through'));
        }
    }
    
    /**
     * Auto-resize textarea based on content
     * @param {HTMLTextAreaElement} textarea - Textarea element to resize
     */
    autoResizeTextarea(textarea) {
        if (!textarea) return;
        
        // Debounce: skip if already resizing
        if (textarea._isResizing) return;
        textarea._isResizing = true;
        
        const minHeight = 60; // Minimum height in pixels
        const maxHeight = 300; // Maximum height in pixels
        
        // Save current scroll position to prevent jump
        const scrollTop = textarea.scrollTop;
        
        // Temporarily set height to 0 to get accurate scrollHeight
        textarea.style.height = '0px';
        
        // Get the actual content height needed
        const contentHeight = textarea.scrollHeight;
        
        // Calculate new height with constraints
        const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);
        
        // Set the new height
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
        
        // Restore scroll position
        textarea.scrollTop = scrollTop;
        
        // Clear the resizing flag after a short delay
        requestAnimationFrame(() => {
            textarea._isResizing = false;
        });
    }
    
    /**
     * Initialize shared color palette
     * Creates 32 predefined color swatches in the dropdown
     */
    initColorPalette() {
        // 32 carefully selected colors (4 rows x 8 columns)
        this.paletteColors = [
            // Row 1: Grayscale + Pure colors
            '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF', '#FF0000', '#00FF00',
            // Row 2: Blues and Purples
            '#0000FF', '#1976D2', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
            // Row 3: Warm colors
            '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
            // Row 4: Pastels and earth tones
            '#673AB7', '#3F51B5', '#795548', '#607D8B', '#FFCDD2', '#C8E6C9', '#BBDEFB', '#FFE0B2'
        ];
        
        if (!this.sharedColorPalette) return;
        
        this.sharedColorPalette.innerHTML = '';
        
        this.paletteColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            
            // Add light-color class for light colors
            const rgb = this.hexToRgb(color);
            if (rgb && (rgb.r + rgb.g + rgb.b) > 600) {
                swatch.classList.add('light-color');
            }
            
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectColor(color);
            });
            
            this.sharedColorPalette.appendChild(swatch);
        });
        
        // Initialize button previews
        this.updateColorPreviews();
    }
    
    /**
     * Toggle color palette dropdown for a specific color type
     */
    toggleColorPalette(colorType) {
        if (this.activeColorType === colorType && this.colorPaletteDropdown?.classList.contains('open')) {
            this.closeColorPalette();
        } else {
            this.openColorPalette(colorType);
        }
    }
    
    /**
     * Open color palette for a specific color type
     */
    openColorPalette(colorType) {
        this.activeColorType = colorType;
        
        // Update button active states
        this.btnTextColor?.classList.toggle('active', colorType === 'text');
        this.btnFillColor?.classList.toggle('active', colorType === 'fill');
        this.btnStrokeColor?.classList.toggle('active', colorType === 'stroke');
        
        // Get current color for this type
        let currentColor = '#000000';
        if (colorType === 'text' && this.propTextColor) {
            currentColor = this.propTextColor.value;
        } else if (colorType === 'fill' && this.propFillColor) {
            currentColor = this.propFillColor.value;
        } else if (colorType === 'stroke' && this.propStrokeColor) {
            currentColor = this.propStrokeColor.value;
        }
        
        // Update hex input
        if (this.propColorHex) {
            this.propColorHex.value = currentColor.toUpperCase();
        }
        
        // Update palette selection
        this.updatePaletteSelection(currentColor);
        
        // Show dropdown
        this.colorPaletteDropdown?.classList.add('open');
    }
    
    /**
     * Close color palette dropdown
     */
    closeColorPalette() {
        this.activeColorType = null;
        this.colorPaletteDropdown?.classList.remove('open');
        this.btnTextColor?.classList.remove('active');
        this.btnFillColor?.classList.remove('active');
        this.btnStrokeColor?.classList.remove('active');
    }
    
    /**
     * Select a color from the palette
     */
    selectColor(color) {
        if (!this.activeColorType) return;
        
        const upperColor = color.toUpperCase();
        const colorType = this.activeColorType; // Save before closing palette
        
        // Update the appropriate hidden input
        if (colorType === 'text' && this.propTextColor) {
            this.propTextColor.value = color;
        } else if (colorType === 'fill' && this.propFillColor) {
            this.propFillColor.value = color;
        } else if (colorType === 'stroke' && this.propStrokeColor) {
            this.propStrokeColor.value = color;
        }
        
        // Update hex input
        if (this.propColorHex) {
            this.propColorHex.value = upperColor;
        }
        
        // Update palette selection visual
        this.updatePaletteSelection(color);
        
        // Update button previews
        this.updateColorPreviews();
        
        // Apply ONLY the selected color type directly to node (not all properties)
        this.applyColorToNode(colorType, color);
        
        // Close palette after selection
        this.closeColorPalette();
    }
    
    /**
     * Apply a specific color type directly to the selected node
     */
    applyColorToNode(colorType, color) {
        // Check for multi-select mode first (Ctrl+A)
        let selectedNodes = [];
        if (window.propertyPanelManager?.isMultiSelectMode && window.propertyPanelManager?.selectedNodeIds?.length > 0) {
            selectedNodes = window.propertyPanelManager.selectedNodeIds;
        } else {
            selectedNodes = this.currentSelection || [];
        }
        if (selectedNodes.length === 0) return;
        
        selectedNodes.forEach(nodeId => {
            const nodeElement = d3.select(`[data-node-id="${nodeId}"]`);
            if (nodeElement.empty()) return;
            
            const nodeTagName = nodeElement.node()?.tagName?.toLowerCase();
            
            if (colorType === 'text') {
                // Apply text color to text elements
                let textElements = nodeElement.selectAll('text');
                if (!textElements.empty()) {
                    textElements.attr('fill', color);
                }
                // 保存到节点数据
                this.saveColorToNodeData(nodeId, 'textColor', color);
            } else if (colorType === 'fill' || colorType === 'stroke') {
                // Find the shape element for fill/stroke
                let shapeElement = nodeElement;
                if (nodeTagName === 'g') {
                    const rectInGroup = nodeElement.select('rect');
                    if (!rectInGroup.empty()) {
                        shapeElement = rectInGroup;
                    } else {
                        const circleInGroup = nodeElement.select('circle, ellipse');
                        if (!circleInGroup.empty()) {
                            shapeElement = circleInGroup;
                        }
                    }
                }
                
                if (colorType === 'fill') {
                    shapeElement.attr('fill', color);
                    // 保存到节点数据
                    this.saveColorToNodeData(nodeId, 'fillColor', color);
                } else if (colorType === 'stroke') {
                    shapeElement.attr('stroke', color);
                    // Also update data-original-stroke so SelectionManager restores the NEW value
                    if (shapeElement.attr('data-original-stroke')) {
                        shapeElement.attr('data-original-stroke', color);
                    }
                    // 保存到节点数据
                    this.saveColorToNodeData(nodeId, 'strokeColor', color);
                }
            }
        });
    }
    
    /**
     * 保存颜色到节点数据中，以便重新渲染时保留
     */
    saveColorToNodeData(nodeId, colorProperty, color) {
        if (!window.currentGraphData || !window.currentGraphData.nodes) return;
        
        const node = window.currentGraphData.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        node[colorProperty] = color;
    }
    
    /**
     * Apply color from hex input
     */
    applyColorFromHex(color) {
        if (!this.activeColorType) return;
        
        const colorType = this.activeColorType; // Save color type
        
        // Update the appropriate hidden input
        if (colorType === 'text' && this.propTextColor) {
            this.propTextColor.value = color;
        } else if (colorType === 'fill' && this.propFillColor) {
            this.propFillColor.value = color;
        } else if (colorType === 'stroke' && this.propStrokeColor) {
            this.propStrokeColor.value = color;
        }
        
        // Update palette selection visual
        this.updatePaletteSelection(color);
        
        // Update button previews
        this.updateColorPreviews();
        
        // Apply ONLY the selected color type directly to node
        this.applyColorToNode(colorType, color);
    }
    
    /**
     * Update the selected state of the shared color palette
     */
    updatePaletteSelection(selectedColor) {
        if (!this.sharedColorPalette) return;
        
        const normalizedColor = selectedColor.toUpperCase();
        
        this.sharedColorPalette.querySelectorAll('.color-swatch').forEach(swatch => {
            if (swatch.dataset.color.toUpperCase() === normalizedColor) {
                swatch.classList.add('selected');
            } else {
                swatch.classList.remove('selected');
            }
        });
    }
    
    /**
     * Update color preview bars on buttons
     */
    updateColorPreviews() {
        if (this.previewTextColor && this.propTextColor) {
            this.previewTextColor.style.backgroundColor = this.propTextColor.value;
        }
        if (this.previewFillColor && this.propFillColor) {
            this.previewFillColor.style.backgroundColor = this.propFillColor.value;
        }
        if (this.previewStrokeColor && this.propStrokeColor) {
            this.previewStrokeColor.style.backgroundColor = this.propStrokeColor.value;
        }
    }
    
    /**
     * Convert hex color to RGB object
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    // ============================================================================
    // Link Mode Color Methods
    // ============================================================================
    
    /**
     * Initialize link color palette
     */
    initLinkColorPalette() {
        if (!this.linkSharedColorPalette) return;
        
        // Use the same colors as node palette
        const colors = this.paletteColors || [
            '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF', '#FF0000', '#00FF00',
            '#0000FF', '#1976D2', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
            '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
            '#673AB7', '#3F51B5', '#795548', '#607D8B', '#FFCDD2', '#C8E6C9', '#BBDEFB', '#FFE0B2'
        ];
        
        this.linkSharedColorPalette.innerHTML = '';
        
        colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            
            // Add light-color class for light colors
            const rgb = this.hexToRgb(color);
            if (rgb && (rgb.r + rgb.g + rgb.b) > 600) {
                swatch.classList.add('light-color');
            }
            
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectLinkColor(color);
            });
            
            this.linkSharedColorPalette.appendChild(swatch);
        });
        
        // Initialize button previews
        this.updateLinkColorPreviews();
    }
    
    /**
     * Toggle link color palette dropdown
     */
    toggleLinkColorPalette(colorType) {
        if (this.activeColorType === colorType && this.linkColorPaletteDropdown?.classList.contains('open')) {
            this.closeLinkColorPalette();
        } else {
            this.openLinkColorPalette(colorType);
        }
    }
    
    /**
     * Open link color palette
     */
    openLinkColorPalette(colorType) {
        // 确保颜色面板已初始化
        if (this.linkSharedColorPalette && this.linkSharedColorPalette.children.length === 0) {
            this.initLinkColorPalette();
        }
        
        // Close node color palette if open (MUST be before setting activeColorType!)
        // closeColorPalette() sets activeColorType to null
        this.closeColorPalette();
        
        // Set activeColorType AFTER closing node color palette
        this.activeColorType = colorType;
        
        // Update button active states
        this.btnLinkTextColor?.classList.toggle('active', colorType === 'link-text');
        this.btnLinkLineColor?.classList.toggle('active', colorType === 'link-line');
        
        // Get current color for this type
        let currentColor = '#333333';
        if (colorType === 'link-text' && this.propLinkTextColor) {
            currentColor = this.propLinkTextColor.value;
        } else if (colorType === 'link-line' && this.propLinkLineColor) {
            currentColor = this.propLinkLineColor.value;
        }
        
        // Update hex input
        if (this.propLinkColorHex) {
            this.propLinkColorHex.value = currentColor.toUpperCase();
        }
        
        // Update palette selection
        this.updateLinkPaletteSelection(currentColor);
        
        // Show dropdown
        this.linkColorPaletteDropdown?.classList.add('open');
    }
    
    /**
     * Close link color palette
     */
    closeLinkColorPalette() {
        this.activeColorType = null;
        this.linkColorPaletteDropdown?.classList.remove('open');
        this.btnLinkTextColor?.classList.remove('active');
        this.btnLinkLineColor?.classList.remove('active');
    }
    
    /**
     * Select a link color from the palette
     */
    selectLinkColor(color) {
        if (!this.activeColorType) return;
        
        const upperColor = color.toUpperCase();
        const colorType = this.activeColorType; // Save before closing palette
        
        // Update the appropriate hidden input
        if (colorType === 'link-text' && this.propLinkTextColor) {
            this.propLinkTextColor.value = color;
        } else if (colorType === 'link-line' && this.propLinkLineColor) {
            this.propLinkLineColor.value = color;
        }
        
        // Update hex input
        if (this.propLinkColorHex) {
            this.propLinkColorHex.value = upperColor;
        }
        
        // Update palette selection visual
        this.updateLinkPaletteSelection(color);
        
        // Update button previews
        this.updateLinkColorPreviews();
        
        // Apply ONLY the specific color change (not all properties)
        this.applyLinkColorOnly(colorType, color);
        
        // Close palette after selection
        this.closeLinkColorPalette();
    }
    
    /**
     * Apply link color from hex input
     */
    applyLinkColorFromHex(color) {
        if (!this.activeColorType) return;
        
        const colorType = this.activeColorType; // Save color type
        
        // Update the appropriate hidden input
        if (colorType === 'link-text' && this.propLinkTextColor) {
            this.propLinkTextColor.value = color;
        } else if (colorType === 'link-line' && this.propLinkLineColor) {
            this.propLinkLineColor.value = color;
        }
        
        // Update palette selection visual
        this.updateLinkPaletteSelection(color);
        
        // Update button previews
        this.updateLinkColorPreviews();
        
        // Apply ONLY the specific color change
        this.applyLinkColorOnly(colorType, color);
    }
    
    /**
     * Apply only a specific link color (text or line) without affecting other properties
     */
    applyLinkColorOnly(colorType, color) {
        // Check if we're in link mode
        if (!window.propertyPanelManager?.isLinkMode) return;
        
        // Build styles object with only the changed color
        const styles = {};
        if (colorType === 'link-text') {
            styles.textColor = color;
        } else if (colorType === 'link-line') {
            styles.lineColor = color;
        }
        
        // Check for multi-select mode (Ctrl+L)
        if (window.propertyPanelManager?.isMultiSelectMode && window.propertyPanelManager?.selectedLinkIds?.length > 0) {
            // Apply to all selected links
            const linkIds = window.propertyPanelManager.selectedLinkIds;
            linkIds.forEach(linkId => {
                if (typeof window.updateLinkStyle === 'function') {
                    window.updateLinkStyle(linkId, styles);
                }
            });
            return;
        }
        
        // Single link mode
        const linkId = window.propertyPanelManager?.currentLinkId;
        if (!linkId) return;
        
        if (typeof window.updateLinkStyle === 'function') {
            window.updateLinkStyle(linkId, styles);
        }
    }
    
    /**
     * Apply only a specific link property without affecting other properties
     */
    applyLinkPropertyOnly(propertyName, value) {
        // Check if we're in link mode
        if (!window.propertyPanelManager?.isLinkMode) return;
        
        // Build styles object with only the changed property
        const styles = {};
        styles[propertyName] = value;
        
        // Check for multi-select mode (Ctrl+L)
        if (window.propertyPanelManager?.isMultiSelectMode && window.propertyPanelManager?.selectedLinkIds?.length > 0) {
            // Apply to all selected links
            const linkIds = window.propertyPanelManager.selectedLinkIds;
            linkIds.forEach(linkId => {
                if (typeof window.updateLinkStyle === 'function') {
                    window.updateLinkStyle(linkId, styles);
                }
            });
            return;
        }
        
        // Single link mode
        const linkId = window.propertyPanelManager?.currentLinkId;
        if (!linkId) return;
        
        if (typeof window.updateLinkStyle === 'function') {
            window.updateLinkStyle(linkId, styles);
        }
    }
    
    /**
     * Apply text decoration (underline, strikethrough) to links
     */
    applyLinkTextDecoration() {
        const decorations = [];
        if (this.propUnderline?.classList.contains('active')) decorations.push('underline');
        if (this.propStrikethrough?.classList.contains('active')) decorations.push('line-through');
        const textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
        this.applyLinkPropertyOnly('textDecoration', textDecoration);
    }
    
    /**
     * Update link palette selection visual
     */
    updateLinkPaletteSelection(selectedColor) {
        if (!this.linkSharedColorPalette) return;
        
        const normalizedColor = selectedColor.toUpperCase();
        
        this.linkSharedColorPalette.querySelectorAll('.color-swatch').forEach(swatch => {
            if (swatch.dataset.color.toUpperCase() === normalizedColor) {
                swatch.classList.add('selected');
            } else {
                swatch.classList.remove('selected');
            }
        });
    }
    
    /**
     * Update link color preview bars on buttons
     */
    updateLinkColorPreviews() {
        if (this.previewLinkTextColor && this.propLinkTextColor) {
            this.previewLinkTextColor.style.backgroundColor = this.propLinkTextColor.value;
        }
        if (this.previewLinkLineColor && this.propLinkLineColor) {
            this.previewLinkLineColor.style.backgroundColor = this.propLinkLineColor.value;
        }
    }
    
    /**
     * Apply link styles in real-time (without notification)
     */
    applyLinkStylesRealtime() {
        // Check if we're in link mode
        if (!window.propertyPanelManager?.isLinkMode) return;
        
        // Build styles object
        const styles = {};
        
        // Text color
        if (this.propLinkTextColor) {
            styles.textColor = this.propLinkTextColor.value;
        }
        
        // Line color
        if (this.propLinkLineColor) {
            styles.lineColor = this.propLinkLineColor.value;
        }
        
        // Line width
        if (this.propLinkLineWidth) {
            styles.lineWidth = this.propLinkLineWidth.value;
        }
        
        // Opacity
        if (this.propOpacity) {
            styles.opacity = this.propOpacity.value;
        }
        
        // Font size
        if (this.propFontSize) {
            styles.fontSize = this.propFontSize.value;
        }
        
        // Font family
        if (this.propFontFamily) {
            styles.fontFamily = this.propFontFamily.value;
        }
        
        // Font weight (bold)
        if (this.propBold) {
            styles.fontWeight = this.propBold.classList.contains('active') ? 'bold' : 'normal';
        }
        
        // Font style (italic)
        if (this.propItalic) {
            styles.fontStyle = this.propItalic.classList.contains('active') ? 'italic' : 'normal';
        }
        
        // Text decoration (underline, strikethrough)
        const decorations = [];
        if (this.propUnderline?.classList.contains('active')) decorations.push('underline');
        if (this.propStrikethrough?.classList.contains('active')) decorations.push('line-through');
        styles.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none';
        
        // Check for multi-select mode (Ctrl+L)
        if (window.propertyPanelManager?.isMultiSelectMode && window.propertyPanelManager?.selectedLinkIds?.length > 0) {
            // Apply to all selected links
            const linkIds = window.propertyPanelManager.selectedLinkIds;
            linkIds.forEach(linkId => {
                if (typeof window.updateLinkStyle === 'function') {
                    window.updateLinkStyle(linkId, styles);
                }
            });
            return;
        }
        
        // Single link mode
        const linkId = window.propertyPanelManager?.currentLinkId;
        if (!linkId) return;
        
        // Apply via global function
        if (typeof window.updateLinkStyle === 'function') {
            window.updateLinkStyle(linkId, styles);
        }
    }
    
    /**
     * Apply text to selected nodes - EVENT BUS WRAPPER
     */
    applyText(silent = false) {
        // ARCHITECTURE: Event Bus pattern - emit event, let handler validate state
        // The handler (TextToolbarStateManager) will check State Manager for selection
        window.eventBus.emit('text:apply_requested', { silent });
        logger.debug('ToolbarManager', 'Apply text requested via Event Bus');
    }
    
    /**
     * Apply all properties to selected nodes - EVENT BUS WRAPPER
     */
    applyAllProperties() {
        window.eventBus.emit('properties:apply_all_requested', {});
        logger.debug('ToolbarManager', 'Apply all properties requested via Event Bus');
    }
    
    /**
     * Apply styles in real-time (without notification) - EVENT BUS WRAPPER
     */
    applyStylesRealtime() {
        window.eventBus.emit('properties:apply_realtime_requested', {});
        logger.debug('ToolbarManager', 'Apply realtime styles requested via Event Bus');
    }
    
    /**
     * Reset styles to template defaults (keep text unchanged) - EVENT BUS WRAPPER
     */
    resetStyles() {
        window.eventBus.emit('properties:reset_requested', {});
        logger.debug('ToolbarManager', 'Reset styles requested via Event Bus');
    }
    
    /**
     * Get template default styles based on diagram type
     */
    getTemplateDefaults() {
        const diagramType = this.editor?.diagramType;
        
        // Standard defaults used across all diagram types
        const standardDefaults = {
            fontSize: '14',
            fontFamily: 'Inter, sans-serif',
            textColor: '#000000',
            fillColor: '#2196f3',
            strokeColor: '#1976d2',
            strokeWidth: '2',
            opacity: '1'
        };
        
        // Diagram-specific overrides (if needed)
        const typeSpecificDefaults = {
            'double_bubble_map': {
                ...standardDefaults,
                fillColor: '#4caf50', // Green for similarities
            },
            'multi_flow_map': {
                ...standardDefaults,
                fillColor: '#ff9800', // Orange for events
            },
            'concept_map': {
                ...standardDefaults,
                fillColor: '#9c27b0', // Purple for concepts
            }
        };
        
        return typeSpecificDefaults[diagramType] || standardDefaults;
    }
    
    /**
     * Toggle bold
     */
    /**
     * Toggle bold - EVENT BUS WRAPPER
     */
    toggleBold() {
        window.eventBus.emit('properties:toggle_bold_requested', {});
    }
    
    /**
     * Toggle italic - EVENT BUS WRAPPER
     */
    toggleItalic() {
        window.eventBus.emit('properties:toggle_italic_requested', {});
    }
    
    /**
     * Toggle underline - EVENT BUS WRAPPER
     */
    toggleUnderline() {
        window.eventBus.emit('properties:toggle_underline_requested', {});
    }
    
    /**
     * Toggle strikethrough - EVENT BUS WRAPPER
     */
    toggleStrikethrough() {
        window.eventBus.emit('properties:toggle_strikethrough_requested', {});
    }
    
    /**
     * Handle add node - EVENT BUS WRAPPER
     */
    /**
     * Handle add focus question - Prompts user to enter focus question
     * For concept maps only
     */
    handleAddFocusQuestion() {
        if (this.editor?.diagramType !== 'concept_map') {
            logger.debug('ToolbarManager', 'Add focus question only available for concept maps');
            return;
        }
        
        // Prompt user for focus question
        const focusQuestion = prompt('请输入焦点问题：', '');
        if (focusQuestion && focusQuestion.trim()) {
            // Set global focus question
            window.focusQuestion = focusQuestion.trim();
            
            // Call the function to add focus question node
            if (typeof window.addFocusQuestionNode === 'function') {
                window.addFocusQuestionNode(focusQuestion.trim());
                logger.info('ToolbarManager', 'Focus question added:', focusQuestion.trim());
            } else {
                // Fallback: emit event
                window.eventBus.emit('focus_question:added', { focusQuestion: focusQuestion.trim() });
            }
        }
    }
    
    handleAddNode() {
        window.eventBus.emit('node:add_requested', {});
        logger.debug('ToolbarManager', 'Add node requested via Event Bus');
    }
    
    /**
     * Handle delete node - EVENT BUS WRAPPER
     * For concept maps, uses the dedicated delete function from concept-map-renderer.js
     */
    handleDeleteNode() {
        // Check if current diagram is concept map and use dedicated function
        if (this.editor?.diagramType === 'concept_map' && typeof window.deleteConceptSelected === 'function') {
            window.deleteConceptSelected();
            logger.debug('ToolbarManager', 'Delete node requested via concept-map-renderer');
            return;
        }
        window.eventBus.emit('node:delete_requested', {});
        logger.debug('ToolbarManager', 'Delete node requested via Event Bus');
    }
    
    /**
     * Handle empty node text (clear text but keep node) - EVENT BUS WRAPPER
     */
    handleEmptyNode() {
        window.eventBus.emit('node:empty_requested', {});
        logger.debug('ToolbarManager', 'Empty node requested via Event Bus');
    }
    
    /**
     * Handle clear canvas - Clears all content from the canvas
     * For concept maps, uses the dedicated clear function from concept-map-renderer.js
     */
    handleClearCanvas() {
        // Confirm before clearing
        const confirmMessage = window.languageManager?.translate('confirmClearCanvas') || 'Are you sure you want to clear the canvas? This action cannot be undone.';
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // Check if current diagram is concept map and use dedicated function
        if (this.editor?.diagramType === 'concept_map' && typeof window.clearConceptCanvas === 'function') {
            window.clearConceptCanvas();
            logger.debug('ToolbarManager', 'Canvas cleared via concept-map-renderer');
            return;
        }
        
        // For other diagram types, emit event (to be handled by respective operations)
        window.eventBus.emit('diagram:clear_requested', {});
        logger.debug('ToolbarManager', 'Clear canvas requested via Event Bus');
    }
    
    /**
     * Handle auto-complete diagram with AI
     * EVENT BUS WRAPPER - Delegates to LLMAutoCompleteManager
     */
    async handleAutoComplete() {
        window.eventBus.emit('autocomplete:start_requested', {});
        logger.debug('ToolbarManager', 'Auto-complete requested via Event Bus');
    }
    
    /**
     * Handle interaction button click - generate core concepts from focus question
     * Uses multi-model parallel generation (same pattern as auto-complete)
     */
    async handleInteraction() {
        // Check if we have a focus question
        const focusQuestion = window.focusQuestion;
        if (!focusQuestion || !focusQuestion.trim()) {
            if (window.showMessage) {
                window.showMessage('请先输入焦点问题', 'error');
            } else {
                alert('请先输入焦点问题');
            }
            logger.warn('ToolbarManager', 'No focus question found for interaction');
            return;
        }
        
        // Extract focus question text
        let focusText = focusQuestion.trim();
        if (focusText.startsWith('焦点问题：') || focusText.startsWith('焦点问题:')) {
            focusText = focusText.replace(/^焦点问题[：:]/, '').trim();
        }
        
        if (!focusText) {
            if (window.showMessage) {
                window.showMessage('焦点问题不能为空', 'error');
            } else {
                alert('焦点问题不能为空');
            }
            return;
        }
        
        logger.info('ToolbarManager', 'Starting multi-model core concepts generation', { focusQuestion: focusText });
        
        // Show loading state on interaction button
        if (this.interactionBtn) {
            this.interactionBtn.classList.add('loading');
            this.interactionBtn.disabled = true;
        }
        
        // Multi-model parallel generation (same pattern as LLMAutoCompleteManager.handleAutoComplete)
        const models = ['qwen', 'deepseek', 'kimi', 'hunyuan', 'doubao'];
        
        // Show loading state on all LLM buttons
        this.showNotification('正在使用5个AI模型生成核心概念...', 'info');
        if (this.editor?.modules?.llmAutoComplete?.progressRenderer) {
            this.editor.modules.llmAutoComplete.progressRenderer.setAllLLMButtonsLoading(true, models);
        }
        
        // Store results for each model
        this.coreConceptResults = {};
        this.selectedConceptModel = null;
        
        // Create parallel requests for all models
        const promises = models.map(model => this.callCoreConceptsAPI(model, focusText));
        
        try {
            // Wait for all models to complete
            await Promise.allSettled(promises);
            
            logger.info('ToolbarManager', 'All models completed core concepts generation', {
                results: Object.keys(this.coreConceptResults).map(m => ({
                    model: m,
                    success: this.coreConceptResults[m]?.success,
                    count: this.coreConceptResults[m]?.concepts?.length || 0
                }))
            });
            
            // Find first successful result and display it
            const firstSuccess = models.find(m => this.coreConceptResults[m]?.success);
            if (firstSuccess) {
                this.selectedConceptModel = firstSuccess;
                this.displayCoreConcepts(this.coreConceptResults[firstSuccess].concepts, focusText);
            } else {
                throw new Error('所有模型生成核心概念均失败');
            }
            
        } catch (error) {
            logger.error('ToolbarManager', 'Failed to generate core concepts', error);
            if (window.showMessage) {
                window.showMessage(`生成核心概念失败: ${error.message}`, 'error');
            }
        } finally {
            // Remove loading state
            if (this.interactionBtn) {
                this.interactionBtn.classList.remove('loading');
                this.interactionBtn.disabled = false;
            }
        }
    }
    
    /**
     * Call core concepts API for a single model (same pattern as LLMEngineManager.callLLMWithModel)
     */
    async callCoreConceptsAPI(model, focusText) {
        const startTime = Date.now();
        
        try {
            logger.debug('ToolbarManager', `Starting core concepts API call for ${model}`);
            
            const response = await window.auth.fetch('/api/generate_core_concepts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    focus_question: focusText,
                    language: 'zh',
                    llm: model,
                    count: 30
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            
            if (data.success && data.concepts && data.concepts.length > 0) {
                // Store successful result
                this.coreConceptResults[model] = {
                    success: true,
                    concepts: data.concepts,
                    elapsed: elapsed
                };
                
                // Update button state to ready
                if (this.editor?.modules?.llmAutoComplete?.progressRenderer) {
                    this.editor.modules.llmAutoComplete.progressRenderer.setLLMButtonState(model, 'ready');
                }
                
                logger.info('ToolbarManager', `✓ ${model} generated ${data.concepts.length} concepts in ${elapsed}s`);
                
                // If this is first success and no result displayed yet, display it
                if (!this.selectedConceptModel) {
                    this.selectedConceptModel = model;
                    this.displayCoreConcepts(data.concepts, focusText);
                    
                    // Highlight this model's button
                    if (this.editor?.modules?.llmAutoComplete?.progressRenderer) {
                        this.editor.modules.llmAutoComplete.progressRenderer.highlightSelectedModel(model);
                    }
                }
            } else {
                throw new Error(data.error || '生成失败');
            }
            
        } catch (error) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            
            // Store error result
            this.coreConceptResults[model] = {
                success: false,
                error: error.message,
                elapsed: elapsed
            };
            
            // Update button state to error
            if (this.editor?.modules?.llmAutoComplete?.progressRenderer) {
                this.editor.modules.llmAutoComplete.progressRenderer.setLLMButtonState(model, 'error');
            }
            
            logger.warn('ToolbarManager', `✗ ${model} failed: ${error.message} (${elapsed}s)`);
        }
    }
    
    /**
     * Display core concepts in left panel
     */
    displayCoreConcepts(concepts, focusQuestion) {
        // Find or create the left panel
        let leftPanel = document.getElementById('concept-map-interaction-panel');
        
        if (!leftPanel) {
            // Create left panel with blue theme (matching project colors)
            leftPanel = document.createElement('div');
            leftPanel.id = 'concept-map-interaction-panel';
            leftPanel.className = 'concept-map-interaction-panel';
            leftPanel.style.cssText = `
                position: absolute;
                left: 0;
                top: 0;
                width: 300px;
                height: 100%;
                background: linear-gradient(180deg, #e3f2fd 0%, #f4f6fb 100%);
                border-right: 3px solid #4a90e2;
                padding: 20px;
                overflow-y: auto;
                z-index: 100;
                box-shadow: 2px 0 8px rgba(74,144,226,0.15);
            `;
            
            // Insert before canvas panel
            const canvasPanel = document.querySelector('.canvas-panel');
            if (canvasPanel && canvasPanel.parentNode) {
                canvasPanel.parentNode.insertBefore(leftPanel, canvasPanel);
                // Adjust canvas panel width
                canvasPanel.style.marginLeft = '300px';
            } else {
                // Fallback: append to editor main content
                const mainContent = document.querySelector('.editor-main-content');
                if (mainContent) {
                    mainContent.insertBefore(leftPanel, mainContent.firstChild);
                }
            }
        }
        
        // Create panel content with blue theme
        leftPanel.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #1565c0; font-size: 18px; font-weight: 600;">
                    核心概念展示区
                </h3>
                <p style="margin: 0 0 15px 0; color: #546e7a; font-size: 14px;">
                    焦点问题：${this.escapeHtml(focusQuestion)}
                </p>
                <div style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.8); border-radius: 6px; border: 1px solid #90caf9;">
                    <div style="color: #546e7a; font-size: 12px;">共生成 <strong style="color: #1565c0;">${concepts.length}</strong> 个核心概念</div>
                    <div style="color: #90a4ae; font-size: 11px; margin-top: 4px;">💡 拖拽概念到画布添加节点</div>
                </div>
            </div>
            <div id="core-concepts-list" style="display: flex; flex-direction: column; gap: 8px;">
                ${concepts.map((concept, index) => `
                    <div class="core-concept-item" draggable="true" style="
                        padding: 12px;
                        background: rgba(255,255,255,0.9);
                        border-radius: 6px;
                        border: 1px solid #bbdefb;
                        cursor: grab;
                        transition: all 0.2s;
                        font-size: 14px;
                        color: #333;
                        user-select: none;
                    " 
                    data-concept="${this.escapeHtml(concept)}">
                        <span style="color: #90a4ae; margin-right: 8px;">${index + 1}.</span>
                        ${this.escapeHtml(concept)}
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #bbdefb;">
                <button id="close-interaction-panel" style="
                    width: 100%;
                    padding: 10px;
                    background: linear-gradient(135deg, #4a90e2 0%, #1565c0 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(74,144,226,0.3);
                    transition: all 0.2s;
                " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(74,144,226,0.4)';"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(74,144,226,0.3)';">关闭</button>
            </div>
        `;
        
        // Add close button event
        const closeBtn = leftPanel.querySelector('#close-interaction-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeInteractionPanel();
            });
        }
        
        // Add drag events to concept items
        const conceptItems = leftPanel.querySelectorAll('.core-concept-item');
        conceptItems.forEach(item => {
            // Drag start
            item.addEventListener('dragstart', (e) => {
                // Check if already used
                if (e.currentTarget.classList.contains('concept-used')) {
                    e.preventDefault();
                    return;
                }
                const concept = e.currentTarget.dataset.concept;
                e.dataTransfer.setData('text/plain', concept);
                e.dataTransfer.setData('application/x-concept', concept);
                e.dataTransfer.effectAllowed = 'copy';
                e.currentTarget.style.opacity = '0.5';
                e.currentTarget.style.cursor = 'grabbing';
                logger.debug('ToolbarManager', 'Drag started', { concept });
            });
            
            // Drag end
            item.addEventListener('dragend', (e) => {
                // Don't restore if already used
                if (e.currentTarget.classList.contains('concept-used')) {
                    return;
                }
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.cursor = 'grab';
            });
            
            // Hover effects
            item.addEventListener('mouseenter', (e) => {
                // Don't change style if already used
                if (e.currentTarget.classList.contains('concept-used')) {
                    return;
                }
                e.currentTarget.style.background = '#e3f2fd';
                e.currentTarget.style.borderColor = '#4a90e2';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(74,144,226,0.2)';
            });
            
            item.addEventListener('mouseleave', (e) => {
                // Don't change style if already used
                if (e.currentTarget.classList.contains('concept-used')) {
                    return;
                }
                e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
                e.currentTarget.style.borderColor = '#bbdefb';
                e.currentTarget.style.boxShadow = 'none';
            });
        });
        
        // Setup canvas drop zone
        this.setupCanvasDropZone();
    }
    
    /**
     * Close interaction panel
     */
    closeInteractionPanel() {
        const leftPanel = document.getElementById('concept-map-interaction-panel');
        if (leftPanel) {
            leftPanel.remove();
            // Restore canvas panel width
            const canvasPanel = document.querySelector('.canvas-panel');
            if (canvasPanel) {
                canvasPanel.style.marginLeft = '';
            }
        }
        // Remove canvas drop zone listeners
        this.removeCanvasDropZone();
    }
    
    /**
     * Setup canvas as drop zone for concept drag-and-drop
     */
    setupCanvasDropZone() {
        const canvas = document.querySelector('#d3-container');
        if (!canvas) {
            logger.warn('ToolbarManager', 'Canvas container not found for drop zone setup');
            return;
        }
        
        // Remove existing handlers first to prevent duplicates
        this.removeCanvasDropZone();
        
        // Store references for cleanup
        this._canvasDropHandlers = {
            dragover: (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                canvas.style.outline = '3px dashed #4a90e2';
                canvas.style.outlineOffset = '-3px';
            },
            dragleave: (e) => {
                canvas.style.outline = '';
                canvas.style.outlineOffset = '';
            },
            drop: (e) => {
                e.preventDefault();
                canvas.style.outline = '';
                canvas.style.outlineOffset = '';
                
                // Get dropped concept text
                const concept = e.dataTransfer.getData('application/x-concept') || e.dataTransfer.getData('text/plain');
                if (!concept) {
                    logger.warn('ToolbarManager', 'No concept data in drop event');
                    return;
                }
                
                // Calculate drop position relative to SVG
                const svg = canvas.querySelector('svg');
                if (!svg) {
                    logger.warn('ToolbarManager', 'SVG not found in canvas');
                    return;
                }
                
                const svgRect = svg.getBoundingClientRect();
                let dropX = e.clientX - svgRect.left;
                let dropY = e.clientY - svgRect.top;
                
                // Adjust for zoom/transform if zoom-group exists
                const zoomGroup = svg.querySelector('g.zoom-group');
                if (zoomGroup) {
                    const transform = zoomGroup.getAttribute('transform');
                    if (transform) {
                        // Parse transform: translate(x,y) scale(s)
                        const translateMatch = transform.match(/translate\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
                        const scaleMatch = transform.match(/scale\(\s*([^)]+)\s*\)/);
                        
                        let tx = 0, ty = 0, scale = 1;
                        if (translateMatch) {
                            tx = parseFloat(translateMatch[1]) || 0;
                            ty = parseFloat(translateMatch[2]) || 0;
                        }
                        if (scaleMatch) {
                            scale = parseFloat(scaleMatch[1]) || 1;
                        }
                        
                        // Transform screen coordinates to SVG coordinates
                        dropX = (dropX - tx) / scale;
                        dropY = (dropY - ty) / scale;
                    }
                }
                
                logger.info('ToolbarManager', 'Concept dropped on canvas', { concept, x: dropX, y: dropY });
                
                // Add node to canvas using concept-map-renderer function
                this.addConceptNodeToCanvas(concept, dropX, dropY);
                
                // Mark concept as used in the left panel
                this.markConceptAsUsed(concept);
            }
        };
        
        canvas.addEventListener('dragover', this._canvasDropHandlers.dragover);
        canvas.addEventListener('dragleave', this._canvasDropHandlers.dragleave);
        canvas.addEventListener('drop', this._canvasDropHandlers.drop);
        
        logger.debug('ToolbarManager', 'Canvas drop zone setup complete');
    }
    
    /**
     * Remove canvas drop zone listeners
     */
    removeCanvasDropZone() {
        const canvas = document.querySelector('#d3-container');
        if (canvas && this._canvasDropHandlers) {
            canvas.removeEventListener('dragover', this._canvasDropHandlers.dragover);
            canvas.removeEventListener('dragleave', this._canvasDropHandlers.dragleave);
            canvas.removeEventListener('drop', this._canvasDropHandlers.drop);
            this._canvasDropHandlers = null;
        }
    }
    
    /**
     * Add a concept node to canvas at specified position
     * Uses concept-map-renderer.js addNewConceptNode pattern
     */
    addConceptNodeToCanvas(conceptText, x, y) {
        // Use window.addConceptNodeAtPosition if available (from concept-map-renderer.js)
        if (typeof window.addConceptNodeAtPosition === 'function') {
            window.addConceptNodeAtPosition(conceptText, x, y);
            return;
        }
        
        // Fallback: call addNewNode and update the label
        if (typeof window.addNewConceptNode === 'function') {
            const newNode = window.addNewConceptNode();
            if (newNode) {
                // Update node position and label
                const nodeGroup = document.querySelector(`[data-node-id="${newNode.id}"]`);
                if (nodeGroup) {
                    nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);
                    const textEl = nodeGroup.querySelector('text');
                    if (textEl) {
                        textEl.textContent = conceptText;
                    }
                }
                // Update data
                if (window.currentGraphData) {
                    const node = window.currentGraphData.nodes.find(n => n.id === newNode.id);
                    if (node) {
                        node.x = x;
                        node.y = y;
                        node.label = conceptText;
                    }
                }
                this.showNotification(`已添加节点: ${conceptText}`, 'success');
            }
            return;
        }
        
        logger.error('ToolbarManager', 'No concept node creation function available');
        this.showNotification('无法添加节点', 'error');
    }
    
    /**
     * Mark a concept as used in the left panel (green color, disabled drag)
     */
    markConceptAsUsed(conceptText) {
        const leftPanel = document.getElementById('concept-map-interaction-panel');
        if (!leftPanel) return;
        
        const conceptItems = leftPanel.querySelectorAll('.core-concept-item');
        conceptItems.forEach(item => {
            if (item.dataset.concept === conceptText) {
                // Mark as used
                item.classList.add('concept-used');
                item.setAttribute('draggable', 'false');
                item.style.background = 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)';
                item.style.borderColor = '#28a745';
                item.style.color = '#155724';
                item.style.cursor = 'not-allowed';
                item.style.opacity = '0.8';
                
                // Add checkmark icon
                if (!item.querySelector('.concept-used-icon')) {
                    const icon = document.createElement('span');
                    icon.className = 'concept-used-icon';
                    icon.style.cssText = 'margin-left: auto; color: #28a745; font-weight: bold;';
                    icon.textContent = ' ✓';
                    item.appendChild(icon);
                }
                
                // Remove drag event listeners by cloning
                const newItem = item.cloneNode(true);
                item.parentNode.replaceChild(newItem, item);
                
                logger.debug('ToolbarManager', 'Concept marked as used', { conceptText });
            }
        });
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // NOTE: LLM validation methods moved to PropertyValidator (property-validator.js)
    
    // NOTE: Button state methods moved to:
    // - LLMProgressRenderer.setAllLLMButtonsLoading() (llm-progress-renderer.js)
    // - LLMProgressRenderer.setLLMButtonState() (llm-progress-renderer.js)
    // - UIStateLLMManager also has its own implementation (ui-state-llm-manager.js)
    
    /**
     * Toggle line mode (black and white, no fill) - EVENT BUS WRAPPER
     */
    toggleLineMode() {
        window.eventBus.emit('ui:toggle_line_mode', {});
        logger.debug('ToolbarManager', 'Toggle line mode requested via Event Bus');
    }
    
    /**
     * Set loading state for auto button - EVENT BUS WRAPPER
     */
    setAutoButtonLoading(isLoading) {
        window.eventBus.emit('ui:set_auto_button_loading', { isLoading });
        logger.debug('ToolbarManager', 'Set auto button loading state via Event Bus', { isLoading });
    }
    
    /**
     * Handle duplicate node - EVENT BUS WRAPPER
     */
    handleDuplicateNode() {
        window.eventBus.emit('node:duplicate_requested', {});
        logger.debug('ToolbarManager', 'Duplicate node requested via Event Bus');
    }
    
    /**
     * Handle undo - EVENT BUS WRAPPER
     * For concept maps, uses the dedicated undo function from concept-map-renderer.js
     */
    handleUndo() {
        // Check if current diagram is concept map and use dedicated function
        if (this.editor?.diagramType === 'concept_map' && typeof window.undoConceptOperation === 'function') {
            window.undoConceptOperation();
            logger.debug('ToolbarManager', 'Undo requested via concept-map-renderer');
            return;
        }
        window.eventBus.emit('history:undo_requested', {});
        logger.debug('ToolbarManager', 'Undo requested via Event Bus');
    }
    
    /**
     * Handle redo - EVENT BUS WRAPPER
     * Note: Redo button is hidden for concept maps
     */
    handleRedo() {
        window.eventBus.emit('history:redo_requested', {});
        logger.debug('ToolbarManager', 'Redo requested via Event Bus');
    }
    
    /**
     * Reset canvas to blank template - EVENT BUS WRAPPER
     */
    handleReset() {
        window.eventBus.emit('diagram:reset_requested', {});
        logger.debug('ToolbarManager', 'Reset diagram requested via Event Bus');
    }
    
    /**
     * Handle export - Export diagram as PNG (DingTalk quality - 3x)
     */
    handleExport() {
        const svg = document.querySelector('#d3-container svg');
        if (!svg) {
            this.showNotification(this.getNotif('noDiagramToExport'), 'error');
            return;
        }
        
        // Fit diagram for export (ensures full diagram is captured, not just visible area)
        // ARCHITECTURE NOTE: Direct call to fitDiagramForExport() is acceptable - this is an export-specific
        // operation that requires immediate synchronous execution. Event Bus is not suitable here.
        if (!this.editor) {
            logger.error('ToolbarManager', 'Editor reference is null - cannot fit diagram for export');
            this.performPNGExport();
            return;
        }
        
        if (typeof this.editor.fitDiagramForExport !== 'function') {
            logger.error('ToolbarManager', 'fitDiagramForExport method not found on editor', {
                editorType: this.editor.constructor?.name,
                hasModules: !!this.editor.modules,
                diagramType: this.diagramType
            });
            this.performPNGExport();
            return;
        }
        
        // Call fitDiagramForExport - it will handle ViewManager access internally
        this.editor.fitDiagramForExport();
        
        // Wait briefly for viewBox update (no transition, so shorter delay)
        setTimeout(() => {
            this.performPNGExport();
        }, 100);
    }
    
    /**
     * Perform the actual PNG export after view reset (if needed)
     * Filename format: {diagram_type}_{llm_model}_{timestamp}.png
     * Example: bubble_map_qwen_2025-10-07T12-30-45.png
     */
    performPNGExport() {
        const svg = document.querySelector('#d3-container svg');
        if (!svg) {
            this.showNotification(this.getNotif('noDiagramToExport'), 'error');
            return;
        }
        
        try {
            // STEP 1: Calculate accurate content bounds from ORIGINAL SVG (before cloning)
            // Using original SVG ensures getBBox works correctly (element is in DOM)
            let contentMinX = Infinity, contentMinY = Infinity;
            let contentMaxX = -Infinity, contentMaxY = -Infinity;
            let hasContent = false;
            
            const allElements = d3.select(svg).selectAll('g, circle, rect, ellipse, path, line, text, polygon, polyline');
            allElements.each(function() {
                try {
                    const bbox = this.getBBox();
                    if (bbox.width > 0 && bbox.height > 0) {
                        contentMinX = Math.min(contentMinX, bbox.x);
                        contentMinY = Math.min(contentMinY, bbox.y);
                        contentMaxX = Math.max(contentMaxX, bbox.x + bbox.width);
                        contentMaxY = Math.max(contentMaxY, bbox.y + bbox.height);
                        hasContent = true;
                    }
                } catch (e) {
                    // Skip elements without getBBox
                }
            });
            
            if (!hasContent) {
                logger.warn('ToolbarManager', 'No content found for PNG export');
                this.showNotification(this.getNotif('noDiagramToExport'), 'error');
                return;
            }
            
            // STEP 2: Clone SVG for export (preserve original)
            const svgClone = svg.cloneNode(true);
            
            // Remove UI-only elements that should not appear in exports
            const svgD3Clone = d3.select(svgClone);
            svgD3Clone.selectAll('.learning-sheet-answer-key').remove();
            svgD3Clone.selectAll('.selected').classed('selected', false).style('filter', null);
            svgD3Clone.selectAll('.background, .background-rect').each(function() {
                const element = d3.select(this);
                const stroke = element.attr('stroke');
                if (stroke && stroke !== 'none' && stroke !== 'transparent') {
                    element.attr('stroke', 'none');
                }
                const styleStroke = element.style('stroke');
                if (styleStroke && styleStroke !== 'none' && styleStroke !== 'transparent') {
                    element.style('stroke', 'none');
                }
            });
            
            // STEP 3: Calculate optimal viewBox with proper padding
            const padding = 30; // Fixed padding for consistent exports
            const exportViewBoxX = contentMinX - padding;
            const exportViewBoxY = contentMinY - padding;
            const exportWidth = (contentMaxX - contentMinX) + (padding * 2);
            const exportHeight = (contentMaxY - contentMinY) + (padding * 2);
            
            logger.debug('ToolbarManager', 'Export dimensions calculated', {
                contentBounds: { contentMinX, contentMinY, contentMaxX, contentMaxY },
                exportViewBox: { x: exportViewBoxX, y: exportViewBoxY, width: exportWidth, height: exportHeight }
            });
            
            // STEP 4: Normalize viewBox to start at (0, 0) for canvas compatibility
            const normalizedWidth = exportWidth;
            const normalizedHeight = exportHeight;
            
            // Wrap all content in a group with translation to normalize coordinates
            const content = Array.from(svgClone.childNodes);
            const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            contentGroup.setAttribute('transform', `translate(${-exportViewBoxX}, ${-exportViewBoxY})`);
            
            // Move all element nodes to the group
            content.forEach(child => {
                if (child.nodeType === 1) { // Element node
                    contentGroup.appendChild(child);
                }
            });
            
            // Clear SVG and rebuild with proper structure
            svgClone.innerHTML = '';
            
            // Add background rect FIRST (underneath everything)
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', '0');
            bgRect.setAttribute('y', '0');
            bgRect.setAttribute('width', normalizedWidth);
            bgRect.setAttribute('height', normalizedHeight);
            bgRect.setAttribute('fill', '#f5f5f5');
            bgRect.setAttribute('class', 'export-background');
            svgClone.appendChild(bgRect);
            
            // Add content group
            svgClone.appendChild(contentGroup);
            
            // Update viewBox and dimensions
            svgClone.setAttribute('viewBox', `0 0 ${normalizedWidth} ${normalizedHeight}`);
            svgClone.setAttribute('width', normalizedWidth);
            svgClone.setAttribute('height', normalizedHeight);
            
            // STEP 5: Add watermark (positioned in normalized coordinates)
            const svgD3 = d3.select(svgClone);
            const watermarkFontSize = Math.max(12, Math.min(20, Math.min(normalizedWidth, normalizedHeight) * 0.025));
            const wmPadding = Math.max(10, Math.min(20, Math.min(normalizedWidth, normalizedHeight) * 0.02));
            const watermarkX = normalizedWidth - wmPadding;
            const watermarkY = normalizedHeight - wmPadding;
            
            svgD3.append('text')
                .attr('x', watermarkX)
                .attr('y', watermarkY)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'alphabetic')
                .attr('fill', '#2c3e50')
                .attr('font-size', watermarkFontSize)
                .attr('font-family', 'Inter, Segoe UI, sans-serif')
                .attr('font-weight', '600')
                .attr('opacity', 0.8)
                .text('MindGraph');
            
            // STEP 6: Create high-quality canvas (3x scale for Retina displays)
            const scale = 3;
            const canvas = document.createElement('canvas');
            canvas.width = normalizedWidth * scale;
            canvas.height = normalizedHeight * scale;
            const ctx = canvas.getContext('2d');
            
            ctx.scale(scale, scale);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Fill white background (fallback in case SVG background fails)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, normalizedWidth, normalizedHeight);
            
            // STEP 7: Convert SVG to PNG
            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, normalizedWidth, normalizedHeight);
                
                canvas.toBlob((blob) => {
                    const pngUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = pngUrl;
                    
                    // Generate filename with diagram type and LLM model
                    const diagramType = window.stateManager?.getDiagramState()?.type || this.editor?.diagramType || 'diagram';
                    const llmModel = this.selectedLLM || 'qwen';
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                    link.download = `${diagramType}_${llmModel}_${timestamp}.png`;
                    
                    link.click();
                    
                    URL.revokeObjectURL(pngUrl);
                    URL.revokeObjectURL(url);
                    
                    logger.info('ToolbarManager', 'PNG export successful', {
                        dimensions: { width: normalizedWidth, height: normalizedHeight }
                    });
                    this.showNotification(this.getNotif('diagramExported'), 'success');
                }, 'image/png');
            };
            
            img.onerror = (error) => {
                logger.error('ToolbarManager', 'Error loading SVG', error);
                URL.revokeObjectURL(url);
                this.showNotification(this.getNotif('exportFailed'), 'error');
            };
            
            img.src = url;
            
        } catch (error) {
            logger.error('ToolbarManager', 'Error exporting diagram', error);
            this.showNotification(this.getNotif('exportFailed'), 'error');
        }
    }
    
    /**
     * Handle save to .mg format
     */
    handleSave() {
        if (!this.editor || !this.editor.currentSpec) {
            this.showNotification(this.getNotif('noDiagramToSave'), 'error');
            return;
        }
        
        // Emit event for ExportManager to handle
        // Notification will be shown after export completes (via event handlers)
        if (window.eventBus) {
            window.eventBus.emit('toolbar:export_requested', {
                format: 'mg',
                editor: this.editor
            });
        }
    }
    
    /**
     * Handle import button click
     */
    handleImport() {
        this.importFileInput?.click();
    }
    
    /**
     * Handle selected file for import
     * @param {File} file - Selected .mg file
     */
    async handleFileSelected(file) {
        logger.info('ToolbarManager', 'File selected for import', {
            name: file.name,
            size: file.size
        });
        
        // Warn if file is very large (> 1MB)
        if (file.size > 1024 * 1024) {
            logger.warn('ToolbarManager', 'Large file detected', { size: file.size });
        }
        
        try {
            // Validate file type before reading
            const fileName = file.name.toLowerCase();
            const isJsonFile = fileName.endsWith('.json') || fileName.endsWith('.mg');
            
            if (!isJsonFile) {
                logger.error('ToolbarManager', 'Invalid file type - expected .json or .mg file', {
                    fileName: file.name,
                    type: file.type
                });
                this.showNotification(this.getNotif('invalidFileFormat'), 'error');
                return;
            }
            
            // Read file contents
            const text = await file.text();
            
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                // JSON parse error - show specific message
                logger.error('ToolbarManager', 'JSON parse error', parseError);
                this.showNotification(this.getNotif('invalidFileFormat'), 'error');
                return;
            }
            
            // Validate and import via ExportManager
            if (window.eventBus) {
                window.eventBus.emit('toolbar:import_file', { data, filename: file.name });
            }
        } catch (error) {
            // File read error (rare)
            logger.error('ToolbarManager', 'Error reading import file', error);
            this.showNotification(this.getNotif('importFailed'), 'error');
        }
    }
    
    /**
     * Get translated notification message - EVENT BUS WRAPPER
     */
    getNotif(key, ...args) {
        if (window.languageManager && window.languageManager.getNotification) {
            return window.languageManager.getNotification(key, ...args);
        }
        return key;
    }
    
    /**
     * Show notification - EVENT BUS WRAPPER
     */
    showNotification(message, type = 'info') {
        window.eventBus.emit('notification:show', { message, type });
        logger.debug('ToolbarManager', 'Show notification via Event Bus', { message, type });
    }
    
    /**
     * Play notification sound - EVENT BUS WRAPPER
     */
    playNotificationSound() {
        window.eventBus.emit('notification:play_sound', {});
        logger.debug('ToolbarManager', 'Play notification sound via Event Bus');
    }
    
    /**
     * Set up automatic node counter using MutationObserver - EVENT BUS WRAPPER
     */
    setupNodeCounterObserver() {
        window.eventBus.emit('node_counter:setup', {});
        logger.debug('ToolbarManager', 'Setup node counter observer via Event Bus');
    }
    
    /**
     * Update node count in status bar - EVENT BUS WRAPPER
     */
    updateNodeCount() {
        window.eventBus.emit('node_counter:update', {});
        logger.debug('ToolbarManager', 'Update node count via Event Bus');
    }
    
    /**
     * Validate that this toolbar manager is still valid for the current session
     */
    validateToolbarSession(operation = 'Operation') {
        // Check if we have a session ID
        if (!this.sessionId) {
            logger.warn('ToolbarManager', `${operation} - No session ID set`);
            return false;
        }
        
        // Check if the editor's session matches our session
        if (this.editor && this.editor.sessionId !== this.sessionId) {
            logger.warn('ToolbarManager', `${operation} blocked - Session mismatch`, {
                toolbarSession: this.sessionId?.substr(-8),
                editorSession: this.editor.sessionId?.substr(-8)
            });
            return false;
        }
        
        // Check with DiagramSelector's session
        if (window.diagramSelector?.currentSession) {
            if (window.diagramSelector.currentSession.id !== this.sessionId) {
                logger.warn('ToolbarManager', `${operation} blocked - DiagramSelector session mismatch`, {
                    toolbarSession: this.sessionId?.substr(-8),
                    activeSession: window.diagramSelector.currentSession.id?.substr(-8)
                });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Validate diagram for Learning Mode - EVENT BUS WRAPPER
     */
    validateLearningMode() {
        window.eventBus.emit('learning_mode:validate', {});
        logger.debug('ToolbarManager', 'Validate learning mode via Event Bus');
    }
    
    /**
     * Handle Learning Mode button click - EVENT BUS WRAPPER
     */
    async handleLearningMode() {
        window.eventBus.emit('learning_mode:start_requested', {});
        logger.debug('ToolbarManager', 'Learning mode start requested via Event Bus');
    }
    
    /**
     * Handle Node Palette button click - EVENT BUS WRAPPER
     */
    async handleThinkingMode() {
        window.eventBus.emit('thinking_mode:toggle_requested', {});
        logger.debug('ToolbarManager', 'Node Palette toggle requested via Event Bus');
    }
    
    /**
     * Cleanup and remove all event listeners by cloning and replacing elements
     */
    destroy() {
        logger.debug('ToolbarManager', 'Destroying instance', {
            session: this.sessionId?.substr(-8)
        });
        
        // Remove all Event Bus listeners (using Listener Registry)
        if (window.eventBus && this.ownerId) {
            const removedCount = window.eventBus.removeAllListenersForOwner(this.ownerId);
            if (removedCount > 0) {
                logger.debug('ToolbarManager', `Removed ${removedCount} Event Bus listeners`);
            }
        }
        
        // CRITICAL: Cancel all in-progress LLM requests before destroying
        this.cancelAllLLMRequests();
        
        // Clone and replace buttons to remove all event listeners
        // This is the most reliable way to remove event listeners added with arrow functions
        const buttonsToClean = [
            'add-focus-btn', 'add-node-btn', 'delete-node-btn', 'duplicate-node-btn', 'empty-node-btn', 'auto-complete-btn',
            'clear-canvas-btn', 'line-mode-btn', 'learning-btn', 'thinking-btn', 'undo-btn', 'redo-btn', 'reset-btn', 
            'export-btn', 'export-image-btn', 'zoom-in-btn', 'zoom-out-btn', 'fit-diagram-btn', 'mindmate-ai-btn',
            // Note: 'back-to-gallery' is NOT included - it's managed by DiagramSelector
            // and its event listener must persist across diagram switches
            'close-properties', 'prop-text-apply', 'prop-bold',
            'prop-italic', 'prop-underline', 'reset-styles-btn'
        ];
        
        let cleanedCount = 0;
        buttonsToClean.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn && btn.parentNode) {
                const clone = btn.cloneNode(true);
                btn.parentNode.replaceChild(clone, btn);
                cleanedCount++;
            }
        });
        
        // Also clean up LLM selector buttons
        const llmButtons = document.querySelectorAll('.llm-btn');
        llmButtons.forEach(btn => {
            if (btn.parentNode) {
                const clone = btn.cloneNode(true);
                btn.parentNode.replaceChild(clone, btn);
                cleanedCount++;
            }
        });
        
        logger.debug('ToolbarManager', `Event listeners cleaned from ${cleanedCount} buttons`);
        
        // Disconnect node counter observer
        if (this.nodeCountObserver) {
            this.nodeCountObserver.disconnect();
            this.nodeCountObserver = null;
        }
        
        // Clear node count update timeout
        if (this.nodeCountUpdateTimeout) {
            clearTimeout(this.nodeCountUpdateTimeout);
            this.nodeCountUpdateTimeout = null;
        }
        
        // Unregister from global registry
        if (window.toolbarManagerRegistry) {
            window.toolbarManagerRegistry.delete(this.sessionId);
        }
        
        // Clear all references
        this.editor = null;
        this.propertyPanel = null;
        this.currentSelection = [];
        this.sessionId = null;
        this.diagramType = null;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ToolbarManager = ToolbarManager;
}

