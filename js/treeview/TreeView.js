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

        this.treeData = null;
        this.expandedNodes = new Set();
        this.selectedNode = null;
        this.currentTab = 'objects';

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
        const tabs = ['models', 'objects', 'classes', 'storeys'];
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
            if (e.target.classList.contains('xeokit-showAllObjects')) {
                e.preventDefault();
                this.showAllObjects();
            } else if (e.target.classList.contains('xeokit-hideAllObjects')) {
                e.preventDefault();
                this.hideAllObjects();
            } else if (e.target.classList.contains('xeokit-showAllClasses')) {
                e.preventDefault();
                this.showAllClasses();
            } else if (e.target.classList.contains('xeokit-hideAllClasses')) {
                e.preventDefault();
                this.hideAllClasses();
            } else if (e.target.classList.contains('xeokit-showAllStoreys')) {
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
            '.xeokit-showAllObjects',
            '.xeokit-hideAllObjects', 
            '.xeokit-showAllClasses',
            '.xeokit-hideAllClasses',
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

    setTreeData(treeData) {
        console.log('TreeView: Setting tree data:', treeData);
        this.treeData = treeData;
        this.clearLoadingStates();
        
        // Ensure DOM is ready before building tree
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.buildTree());
        } else {
            this.buildTree();
        }
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
        
        // For models tab, we don't need treeData - we get data from ModelsManager
        if (this.currentTab !== 'models' && !this.treeData) {
            console.log('TreeView: No tree data available');
            return;
        }

        if (this.currentTab !== 'models') {
            console.log('TreeView: Tree data available:', typeof this.treeData, this.treeData);
        }

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
                case 'objects':
                case 'classes':
                case 'storeys':
                    // Check if we have loaded models
                    if (this.modelsManager && this.modelsManager.loadedModels.size > 0) {
                        // Build hierarchy from loaded models directly
                        hierarchyData = this._buildLoadedModelsHierarchy(this.currentTab);
                    } else {
                        console.log('TreeView: No models loaded');
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

    _buildObjectsHierarchy(levels) {
        const hierarchy = [];
        
        Object.entries(levels).forEach(([levelName, levelData]) => {
            const levelNode = {
                id: `level_${levelName}`,
                label: levelName,
                type: 'level',
                children: []
            };

            Object.entries(levelData).forEach(([categoryName, categoryData]) => {
                if (categoryName === 'Levels') return; // Skip nested levels for now
                
                const categoryNode = {
                    id: `category_${levelName}_${categoryName}`,
                    label: categoryName,
                    type: 'category',
                    children: []
                };

                Object.entries(categoryData).forEach(([objectId, objectData]) => {
                    const objectNode = {
                        id: objectId,
                        label: objectData['Family and Type'] || objectId,
                        type: 'object',
                        objectId: objectId
                    };
                    categoryNode.children.push(objectNode);
                });

                if (categoryNode.children.length > 0) {
                    levelNode.children.push(categoryNode);
                }
            });

            if (levelNode.children.length > 0) {
                hierarchy.push(levelNode);
            }
        });

        return hierarchy;
    }

    _buildClassesHierarchy(levels) {
        const classMap = new Map();
        
        // Collect all objects by their class (Family and Type)
        Object.entries(levels).forEach(([, levelData]) => {
            Object.entries(levelData).forEach(([categoryName, categoryData]) => {
                if (categoryName === 'Levels') return;
                
                Object.entries(categoryData).forEach(([objectId, objectData]) => {
                    const className = objectData['Family and Type'] || 'Unknown';
                    if (!classMap.has(className)) {
                        classMap.set(className, []);
                    }
                    classMap.get(className).push({
                        id: objectId,
                        label: objectId,
                        type: 'object',
                        objectId: objectId
                    });
                });
            });
        });

        // Convert to hierarchy
        const hierarchy = [];
        classMap.forEach((objects, className) => {
            hierarchy.push({
                id: `class_${className}`,
                label: `${className} (${objects.length})`,
                type: 'class',
                children: objects
            });
        });

        return hierarchy;
    }

    _buildStoreysHierarchy(levels) {
        const hierarchy = [];
        
        Object.entries(levels).forEach(([levelName, levelData]) => {
            const levelNode = {
                id: `storey_${levelName}`,
                label: levelName,
                type: 'storey',
                children: []
            };

            // Group by category within each level
            Object.entries(levelData).forEach(([categoryName, categoryData]) => {
                if (categoryName === 'Levels') return;
                
                const categoryNode = {
                    id: `storey_category_${levelName}_${categoryName}`,
                    label: categoryName,
                    type: 'category',
                    children: []
                };

                Object.entries(categoryData).forEach(([objectId, objectData]) => {
                    const objectNode = {
                        id: objectId,
                        label: objectData['Family and Type'] || objectId,
                        type: 'object',
                        objectId: objectId
                    };
                    categoryNode.children.push(objectNode);
                });

                if (categoryNode.children.length > 0) {
                    levelNode.children.push(categoryNode);
                }
            });

            if (levelNode.children.length > 0) {
                hierarchy.push(levelNode);
            }
        });

        return hierarchy;
    }

    _buildLoadedModelsHierarchy(tabType) {
        console.log('TreeView: Building hierarchy for loaded models, tab:', tabType);
        const hierarchy = [];

        // Get all loaded models from the viewer scene
        this.modelsManager.loadedModels.forEach(modelId => {
            const model = this.viewer.scene.models[modelId];
            if (model) {
                console.log('TreeView: Processing model:', modelId, model);

                // Get model name from modelsManager
                const modelInfo = this.modelsManager.modelsData.find(m => m.id === modelId);
                const modelName = modelInfo ? modelInfo.name : modelId;

                // Build hierarchy from model objects
                const modelHierarchy = this._buildModelObjectsHierarchy(model, tabType);

                if (modelHierarchy.length > 0) {
                    const modelNode = {
                        id: `model_${modelId}`,
                        label: modelName,
                        type: 'model',
                        children: modelHierarchy
                    };
                    hierarchy.push(modelNode);
                }
            }
        });

        console.log('TreeView: Built loaded models hierarchy:', hierarchy);
        return hierarchy;
    }

    _buildModelObjectsHierarchy(model, tabType) {
        const hierarchy = [];
        const objects = model.objects;

        if (!objects || Object.keys(objects).length === 0) {
            console.log('TreeView: No objects found in model');
            return hierarchy;
        }

        console.log('TreeView: Found', Object.keys(objects).length, 'objects in model');

        // Group objects by type for simple hierarchy
        const typeGroups = {};

        Object.values(objects).forEach(object => {
            if (object.visible !== false) { // Only include visible objects
                const type = object.type || 'Unknown';
                if (!typeGroups[type]) {
                    typeGroups[type] = [];
                }
                typeGroups[type].push(object);
            }
        });

        // Create hierarchy nodes
        Object.entries(typeGroups).forEach(([type, objectList]) => {
            const typeNode = {
                id: `type_${type}`,
                label: `${type} (${objectList.length})`,
                type: 'category',
                children: objectList.map(obj => ({
                    id: obj.id,
                    label: obj.id,
                    type: 'object',
                    objectId: obj.id
                }))
            };
            hierarchy.push(typeNode);
        });

        return hierarchy;
    }

    _buildMultiModelHierarchy(tabType) {
        console.log('TreeView: Building multi-model hierarchy for tab:', tabType);
        const hierarchy = [];

        if (!this.modelsManager || !this.treeData) {
            console.log('TreeView: No models manager or tree data available');
            return hierarchy;
        }

        // Get loaded model information
        const loadedModelIds = Array.from(this.modelsManager.loadedModels);
        console.log('TreeView: Loaded model IDs:', loadedModelIds);

        // For each loaded model, create a top-level node
        loadedModelIds.forEach(modelId => {
            const modelInfo = this.modelsManager.modelsInfo[modelId];
            const modelName = modelInfo ? modelInfo.name : `Model ${modelId}`;

            console.log('TreeView: Processing model:', modelId, modelName);

            // Find the tree data for this model
            const modelTreeData = this._findModelTreeData(modelId);
            if (!modelTreeData || !modelTreeData.Levels) {
                console.log('TreeView: No tree data found for model:', modelId);
                return;
            }

            // Build hierarchy for this model
            let modelHierarchy = [];
            switch (tabType) {
                case 'objects':
                    modelHierarchy = this._buildObjectsHierarchy(modelTreeData.Levels);
                    break;
                case 'classes':
                    modelHierarchy = this._buildClassesHierarchy(modelTreeData.Levels);
                    break;
                case 'storeys':
                    modelHierarchy = this._buildStoreysHierarchy(modelTreeData.Levels);
                    break;
            }

            // Create model node with its hierarchy as children
            if (modelHierarchy.length > 0) {
                const modelNode = {
                    id: `model_${modelId}`,
                    label: modelName,
                    type: 'model',
                    children: modelHierarchy
                };
                hierarchy.push(modelNode);
            }
        });

        console.log('TreeView: Built multi-model hierarchy:', hierarchy);
        return hierarchy;
    }

    _findModelTreeData(modelId) {
        // Try to find tree data for the specific model
        // This might need to be adjusted based on how tree data is structured
        if (this.treeData && typeof this.treeData === 'object') {
            // If treeData is keyed by model ID
            if (this.treeData[modelId]) {
                return this.treeData[modelId];
            }

            // If treeData has a single project, use that
            const projectData = Object.values(this.treeData)[0];
            if (projectData) {
                return projectData;
            }
        }
        return null;
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

    selectNodeById(elementId) {
        if (!this.treeData) {
            console.warn('TreeView: No tree data available for selection');
            return false;
        }

        console.log('TreeView: Looking for element ID:', elementId);

        // Find the node with matching elementId in the current hierarchy
        const findNode = (nodes, targetId) => {
            if (!nodes || !Array.isArray(nodes)) return null;

            for (const node of nodes) {
                // Check if this node matches (handle both string and number IDs)
                if (node.objectId == targetId || node.id == targetId) {
                    console.log('TreeView: Found matching node:', node);
                    return node;
                }

                // Search in children
                if (node.children && node.children.length > 0) {
                    const found = findNode(node.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        // Get current hierarchy data based on active tab
        let hierarchyData;
        try {
            const projectData = Object.values(this.treeData)[0]; // Get first project
            if (!projectData || !projectData.Levels) {
                console.warn('TreeView: No project data available');
                return false;
            }

            switch (this.currentTab) {
                case 'objects':
                    hierarchyData = this._buildObjectsHierarchy(projectData.Levels);
                    break;
                case 'classes':
                    hierarchyData = this._buildClassesHierarchy(projectData.Levels);
                    break;
                case 'storeys':
                    hierarchyData = this._buildStoreysHierarchy(projectData.Levels);
                    break;
                default:
                    hierarchyData = this._buildObjectsHierarchy(projectData.Levels);
            }
        } catch (e) {
            console.error('TreeView: Error building hierarchy data for selection:', e);
            return false;
        }

        const targetNode = findNode(hierarchyData, elementId);
        if (!targetNode) {
            console.warn('TreeView: Node not found for element ID:', elementId);
            console.log('TreeView: Available nodes:', hierarchyData.slice(0, 3));
            return false;
        }

        // Expand all parent nodes to make the target visible
        const expandParents = (nodes, targetId, parentPath = []) => {
            if (!nodes || !Array.isArray(nodes)) return false;

            for (const node of nodes) {
                const currentPath = [...parentPath, node.id];

                if (node.objectId == targetId || node.id == targetId) {
                    // Found target, expand all parents in the path
                    parentPath.forEach(parentId => {
                        this.expandedNodes.add(parentId);
                        console.log('TreeView: Expanding parent node:', parentId);
                    });
                    return true;
                }

                if (node.children && node.children.length > 0) {
                    if (expandParents(node.children, targetId, currentPath)) {
                        return true;
                    }
                }
            }
            return false;
        };

        // Expand parent nodes
        expandParents(hierarchyData, elementId);

        // Rebuild tree to show expanded nodes
        this.buildTree();

        // Select the node after a short delay to ensure DOM is updated
        setTimeout(() => {
            this.selectNode(targetNode.id);

            // Scroll the selected node into view
            const nodeElement = document.querySelector(`[data-node-id="${targetNode.id}"] .tree-node`);
            if (nodeElement) {
                nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);

        return true;
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
    showAllObjects() {
        console.log('TreeView: Show all objects');
        this.viewer.scene.setObjectsVisible(this.viewer.scene.objectIds, true);
        this.viewer.scene.setObjectsXRayed(this.viewer.scene.xrayedObjectIds, false);
        this._updateAllCheckboxes(true);
    }

    hideAllObjects() {
        console.log('TreeView: Hide all objects');
        this.viewer.scene.setObjectsVisible(this.viewer.scene.visibleObjectIds, false);
        this._updateAllCheckboxes(false);
    }

    showAllClasses() {
        this.showAllObjects();
    }

    hideAllClasses() {
        this.hideAllObjects();
    }

    showAllStoreys() {
        this.showAllObjects();
    }

    hideAllStoreys() {
        this.hideAllObjects();
    }

    _updateAllCheckboxes(checked) {
        console.log('TreeView: Updating all checkboxes to', checked);
        document.querySelectorAll('.tree-visibility-checkbox').forEach(checkbox => {
            checkbox.checked = checked;
        });
    }
}
