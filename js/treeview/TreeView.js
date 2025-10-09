/**
 * Tree View Component for displaying hierarchical object structure
 */
export class TreeView {
    constructor(viewer, cfg = {}) {
        this.viewer = viewer;
        this.containerElement = cfg.containerElement;
        this.onNodeClick = cfg.onNodeClick || (() => {});
        this.onNodeContextMenu = cfg.onNodeContextMenu || (() => {});
        this.modelsManager = cfg.modelsManager || null;


        this.expandedNodes = new Set();
        this.selectedNode = null;
        this.currentTab = 'storeys';

        this._initTabs();
        this._initEventHandlers();
    }

    _initTabs() {
        const panel = document.getElementById('treeViewPanel');
        if (!panel) {
            console.warn('TreeView: treeViewPanel not found');
            return;
        }

        // Add click handlers for tab buttons
        const tabs = ['models', 'storeys'];
        tabs.forEach(tabId => {
            const tabButton = panel.querySelector(`.xeokit-${tabId}TabBtn`);
            if (tabButton) {
                tabButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchTab(tabId);
                });
            }
        });

        console.log('TreeView: Tabs initialized');
    }

    _initEventHandlers() {
        // Ensure tree view buttons are always enabled
        this._ensureButtonsEnabled();
        
        // Button event handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('xeokit-showAllStoreys')) {
                e.preventDefault();
                this.showAllStoreys();
            } else if (e.target.classList.contains('xeokit-hideAllStoreys')) {
                e.preventDefault();
                this.hideAllStoreys();
            }
        });
    }

    _ensureButtonsEnabled() {
        // Remove disabled attribute and class from all tree view buttons
        const buttonSelectors = [
            '.xeokit-showAllStoreys',
            '.xeokit-hideAllStoreys'
        ];

        buttonSelectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(button => {
                button.disabled = false;
                button.removeAttribute('disabled');
                button.classList.remove('disabled');
            });
        });
    }

    switchTab(tabId) {
        console.log('TreeView: Switching to tab:', tabId);
        this.currentTab = tabId;

        // Update tab button states
        document.querySelectorAll('.xeokit-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.xeokit-${tabId}TabBtn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update tab content visibility
        document.querySelectorAll('.xeokit-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.classList.contains(`xeokit-${tabId}Tab`)) {
                tab.classList.add('active');
            }
        });

        // Rebuild tree for current tab
        this.buildTree();

        // Ensure buttons are enabled after tab switch
        this._ensureButtonsEnabled();
    }



    clearLoadingStates() {
        // Clear any loading indicators or animations
        const allPanels = document.querySelectorAll('.xeokit-tree-panel');
        allPanels.forEach(panel => {
            panel.classList.remove('loading');
            // Remove any spinning elements
            const spinners = panel.querySelectorAll('.fa-spin, .spinner, .loading-dots');
            spinners.forEach(spinner => spinner.remove());
        });
    }

    buildTree() {
        console.log('TreeView: buildTree called, currentTab:', this.currentTab);

        const treePanel = document.querySelector(`.xeokit-${this.currentTab}Tab .xeokit-tree-panel`);
        if (!treePanel) {
            console.warn(`TreeView: Tree panel not found for tab: ${this.currentTab}`);
            console.warn(`TreeView: Looking for selector: .xeokit-${this.currentTab}Tab .xeokit-tree-panel`);
            console.warn(`TreeView: Available panels:`, document.querySelectorAll('.xeokit-tree-panel'));
            return;
        }

        console.log('TreeView: Found tree panel:', treePanel);

        // Clear any loading states
        treePanel.classList.remove('loading');
        treePanel.innerHTML = '';

        try {
            let hierarchyData;

            switch (this.currentTab) {
                case 'models':
                    if (this.modelsManager) {
                        console.log('TreeView: Calling modelsManager.buildModelsTree()');
                        hierarchyData = this.modelsManager.buildModelsTree();
                        console.log('TreeView: Got hierarchy data from modelsManager:', hierarchyData);
                    } else {
                        console.warn('TreeView: ModelsManager not available for models tab');
                        return;
                    }
                    break;
                case 'storeys':
                    // Build hierarchy from treeview data provided by loaded models
                    if (this.modelsManager && this.modelsManager.loadedModels.size > 0) {
                        hierarchyData = this.modelsManager.buildStoreysTree();
                    } else {
                        console.log('TreeView: No models loaded for storeys tab');
                        return;
                    }
                    break;
            }

            if (hierarchyData && hierarchyData.length > 0) {
                const ul = this._createTreeElement(hierarchyData);
                treePanel.appendChild(ul);
            }
        } catch (error) {
            console.error('Error building tree:', error);
        }
    }







    _createTreeElement(nodes) {
        const ul = document.createElement('ul');
        
        nodes.forEach(node => {
            const li = document.createElement('li');
            li.dataset.nodeId = node.id;
            
            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'tree-node';
            
            // Expand/collapse icon
            const expandIcon = document.createElement('span');
            expandIcon.className = 'tree-expand-icon';
            if (!node.children || node.children.length === 0) {
                expandIcon.classList.add('leaf');
            } else if (this.expandedNodes.has(node.id)) {
                expandIcon.classList.add('expanded');
            }
            
            expandIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNode(node.id);
            });
            
            // Visibility checkbox (or model load/unload checkbox for models tab)
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'tree-visibility-checkbox';

            if (this.currentTab === 'models' && node.type === 'model') {
                // For models, checkbox controls loading/unloading
                checkbox.checked = node.loaded || false;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleModelLoad(node, checkbox.checked);
                });
            } else {
                // For other tabs, checkbox controls visibility
                checkbox.checked = true;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleVisibility(node, checkbox.checked);
                    // Sync children checkboxes when parent is toggled
                    this._syncChildrenCheckboxes(node, checkbox.checked);
                });
            }
            
            // Node label
            const label = document.createElement('span');
            label.className = 'tree-node-label';
            label.textContent = node.label;
            
            // Node count (for categories)
            if (node.children && node.children.length > 0) {
                const count = document.createElement('span');
                count.className = 'tree-node-count';
                count.textContent = `(${node.children.length})`;
                label.appendChild(count);
            }
            
            nodeDiv.appendChild(expandIcon);
            nodeDiv.appendChild(checkbox);
            nodeDiv.appendChild(label);
            
            // Node click handler
            nodeDiv.addEventListener('click', (e) => {
                this.selectNode(node.id);
                this.onNodeClick(node, e);
            });
            
            // Context menu handler
            nodeDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.onNodeContextMenu(node, e);
            });
            
            li.appendChild(nodeDiv);
            
            // Add children if expanded
            if (node.children && node.children.length > 0 && this.expandedNodes.has(node.id)) {
                const childUl = this._createTreeElement(node.children);
                li.appendChild(childUl);
            }
            
            ul.appendChild(li);
        });
        
        return ul;
    }

    toggleNode(nodeId) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }
        this.buildTree();
    }

    selectNode(nodeId) {
        // Remove previous selection
        document.querySelectorAll('.tree-node.selected').forEach(node => {
            node.classList.remove('selected');
        });

        // Add selection to current node
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"] .tree-node`);
        if (nodeElement) {
            nodeElement.classList.add('selected');
            this.selectedNode = nodeId;
        }
    }



    toggleVisibility(node, visible) {
        console.log('TreeView: toggleVisibility called', node, visible);

        if (node.objectId) {
            // Single object - convert numeric ID to scene ID format
            const numericId = node.objectId;
            const sceneId = window.idUtils.numericToSceneId(numericId);
            console.log('TreeView: Converting ID:', numericId, '->', sceneId);

            if (sceneId) {
                const entity = this.viewer.scene.objects[sceneId];
                if (entity) {
                    entity.visible = visible;
                    console.log('TreeView: Set visibility for', sceneId, 'to', visible);
                } else {
                    console.warn('TreeView: Object not found:', sceneId);
                }
            } else {
                console.warn('TreeView: Could not convert numeric ID to scene ID:', numericId);
                console.log('TreeView: Available objects:', Object.keys(this.viewer.scene.objects).slice(0, 5));
            }
        } else if (node.children) {
            // Multiple objects
            console.log('TreeView: Setting visibility for children');
            this._setChildrenVisibility(node.children, visible);
        }
    }

    toggleModelLoad(node, load) {
        console.log('TreeView: toggleModelLoad called', node, load);

        if (!this.modelsManager) {
            console.warn('TreeView: ModelsManager not available');
            return;
        }

        if (node.type === 'model' && node.modelId) {
            if (load) {
                this.modelsManager.loadModel(node.modelId);
            } else {
                this.modelsManager.unloadModel(node.modelId);
            }
        }
    }

    _setChildrenVisibility(children, visible) {
        children.forEach(child => {
            if (child.objectId) {
                const numericId = child.objectId;
                const sceneId = window.idUtils.numericToSceneId(numericId);
                if (sceneId) {
                    const entity = this.viewer.scene.objects[sceneId];
                    if (entity) {
                        entity.visible = visible;
                    }
                }
            } else if (child.children) {
                this._setChildrenVisibility(child.children, visible);
            }
        });
    }

    _syncChildrenCheckboxes(node, checked) {
        if (!node.children || node.children.length === 0) {
            return;
        }

        // Update all child checkboxes in the DOM
        const updateCheckboxes = (children) => {
            children.forEach(child => {
                const checkbox = document.querySelector(`[data-node-id="${child.id}"] .tree-visibility-checkbox`);
                if (checkbox) {
                    checkbox.checked = checked;
                }
                if (child.children) {
                    updateCheckboxes(child.children);
                }
            });
        };

        updateCheckboxes(node.children);
    }

    // Button action handlers
    showAllStoreys() {
        console.log('TreeView: Show all storeys');
        this.viewer.scene.setObjectsVisible(this.viewer.scene.objectIds, true);
        this.viewer.scene.setObjectsXRayed(this.viewer.scene.xrayedObjectIds, false);
        this._updateAllCheckboxes(true);
    }

    hideAllStoreys() {
        console.log('TreeView: Hide all storeys');
        this.viewer.scene.setObjectsVisible(this.viewer.scene.visibleObjectIds, false);
        this._updateAllCheckboxes(false);
    }

    _updateAllCheckboxes(checked) {
        console.log('TreeView: Updating all checkboxes to', checked);
        document.querySelectorAll('.tree-visibility-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
        });
    }
}
