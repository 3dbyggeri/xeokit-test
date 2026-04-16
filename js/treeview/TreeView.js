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
        /** @type {Map<string, object>} node id -> hierarchy node (for incremental expand/collapse) */
        this._nodeIndex = new Map();
        /** @type {Map<string, boolean>} storeys tab: scoped leaf node id -> visibility intent (UI only, no scene scan) */
        this._storeyVisibilityIntent = new Map();
        /** @type {Set<string>} storeys tab: tree node ids user clicked with no matching scene entity; cleared on storeys rebuild */
        this._unresolvedStoreyNodeIds = new Set();

        this._initTabs();
        this._initEventHandlers();
    }

    _escapeNodeIdForSelector(id) {
        if (id == null) {
            return "";
        }
        const s = String(id);
        if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
            return CSS.escape(s);
        }
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    _indexNodesRecursive(nodes) {
        if (!nodes || !Array.isArray(nodes)) {
            return;
        }
        for (const node of nodes) {
            if (node && node.id != null) {
                this._nodeIndex.set(String(node.id), node);
            }
            if (node.children && node.children.length) {
                this._indexNodesRecursive(node.children);
            }
        }
    }

    _findTreeLiByNodeId(nodeId) {
        const panel = document.querySelector(`.xeokit-${this.currentTab}Tab .xeokit-tree-panel`);
        if (!panel) {
            return null;
        }
        const esc = this._escapeNodeIdForSelector(String(nodeId));
        return panel.querySelector(`li[data-node-id="${esc}"]`);
    }

    /**
     * Merge visibility intent for storeys leaves: keep prior toggles for same scoped id, default new rows to checked.
     */
    _mergeStoreyVisibilityIntent(nodes) {
        const prev = this._storeyVisibilityIntent;
        this._storeyVisibilityIntent = new Map();
        const walk = (list) => {
            if (!list || !Array.isArray(list)) {
                return;
            }
            for (const node of list) {
                if (node.objectId != null && node.objectId !== "") {
                    const id = String(node.id);
                    this._storeyVisibilityIntent.set(
                        id,
                        prev.has(id) ? prev.get(id) : true
                    );
                }
                if (node.children && node.children.length) {
                    walk(node.children);
                }
            }
        };
        walk(nodes);
    }

    /**
     * Storeys tab: checkbox state from _storeyVisibilityIntent only (no scene.objects scan).
     */
    _getStoreyCheckboxStateFromIntent(node) {
        if (!node) {
            return { checked: true, indeterminate: false };
        }
        if (node.objectId != null && node.objectId !== "") {
            const id = String(node.id);
            const checked = this._storeyVisibilityIntent.has(id)
                ? this._storeyVisibilityIntent.get(id)
                : true;
            return { checked: !!checked, indeterminate: false };
        }
        if (node.children && node.children.length) {
            const leaves = [];
            this._collectLeafObjectNodes(node, leaves);
            if (leaves.length === 0) {
                return { checked: true, indeterminate: false };
            }
            const states = leaves.map((n) => this._getStoreyCheckboxStateFromIntent(n));
            const checkedCount = states.filter((s) => s.checked).length;
            if (checkedCount === states.length) {
                return { checked: true, indeterminate: false };
            }
            if (checkedCount === 0) {
                return { checked: false, indeterminate: false };
            }
            return { checked: false, indeterminate: true };
        }
        return { checked: true, indeterminate: false };
    }

    _applyStoreyCheckboxVisuals(checkbox, node) {
        const s = this._getStoreyCheckboxStateFromIntent(node);
        checkbox.disabled = false;
        checkbox.checked = s.checked;
        checkbox.indeterminate = s.indeterminate;
        checkbox.title = "";
    }

    _setStoreyIntentForSubtree(node, checked) {
        if (node.objectId != null && node.objectId !== "") {
            this._storeyVisibilityIntent.set(String(node.id), checked);
            return;
        }
        if (node.children) {
            node.children.forEach((c) => this._setStoreyIntentForSubtree(c, checked));
        }
    }

    _onStoreyCheckboxUserChange(node, checked) {
        this._setStoreyIntentForSubtree(node, checked);
        this.toggleVisibility(node, checked);
        this._repaintStoreyCheckboxesFromIntent();
        // Grey-out only for individual rows with objectId (not category parents).
        if (node.objectId != null && node.objectId !== '') {
            this._syncUnresolvedGreyForStoreyLeaf(node);
        }
    }

    /** Update every storeys checkbox from intent map (visible rows only; cheap, no scene scan). */
    _repaintStoreyCheckboxesFromIntent() {
        if (this.currentTab !== "storeys") {
            return;
        }
        const panel = document.querySelector(".xeokit-storeysTab .xeokit-tree-panel");
        if (!panel) {
            return;
        }
        panel.querySelectorAll("li[data-node-id]").forEach((li) => {
            const id = li.dataset.nodeId;
            const treeNode = this._nodeIndex.get(String(id));
            const cb = li.querySelector(".tree-visibility-checkbox");
            if (treeNode && cb) {
                this._applyStoreyCheckboxVisuals(cb, treeNode);
            }
        });
    }

    _collectLeafObjectNodes(node, out) {
        if (node.objectId != null && node.objectId !== "") {
            out.push(node);
            return;
        }
        if (node.children) {
            node.children.forEach((c) => this._collectLeafObjectNodes(c, out));
        }
    }

    _expandNodeInDom(nodeId, node) {
        if (!node.children || node.children.length === 0) {
            return;
        }
        const li = this._findTreeLiByNodeId(nodeId);
        if (!li) {
            return;
        }
        let childUl = li.querySelector(":scope > ul");
        if (!childUl) {
            childUl = this._createTreeElement(node.children);
            li.appendChild(childUl);
        }
        const expandIcon = li.querySelector(":scope > .tree-node > .tree-expand-icon");
        if (expandIcon) {
            expandIcon.classList.add("expanded");
            expandIcon.classList.remove("leaf");
        }
    }

    _collapseNodeInDom(nodeId) {
        const li = this._findTreeLiByNodeId(nodeId);
        if (!li) {
            return;
        }
        const childUl = li.querySelector(":scope > ul");
        if (childUl) {
            childUl.remove();
        }
        const expandIcon = li.querySelector(":scope > .tree-node > .tree-expand-icon");
        if (expandIcon) {
            expandIcon.classList.remove("expanded");
        }
    }

    _initTabs() {
        const panel = document.getElementById('treeViewPanel');
        if (!panel) {
            console.warn('TreeView: treeViewPanel not found');
            return;
        }

        // When models loaded via URL (single or multiple), hide the Models tab so only Objects Tree is visible
        if (window.urlModelsMode) {
            const modelsTabBtn = panel.querySelector('.xeokit-modelsTabBtn');
            if (modelsTabBtn) modelsTabBtn.style.display = 'none';
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

        // Update Upload/Delete button visibility
        this._updateUploadDeleteButtonsVisibility();
    }

    _updateUploadDeleteButtonsVisibility() {
        const isModelsTab = this.currentTab === 'models';
        const urlModelsMode = !!window.urlModelsMode;

        if (urlModelsMode) {
            const modelsTabContent = document.querySelector('.xeokit-modelsTab .xeokit-tab-content');
            const modelsBtnGroup = modelsTabContent?.querySelector('.xeokit-btn-group');
            if (modelsBtnGroup) modelsBtnGroup.style.display = 'none';
        } else {
            const modelsTabContent = document.querySelector('.xeokit-modelsTab .xeokit-tab-content');
            const modelsBtnGroup = modelsTabContent?.querySelector('.xeokit-btn-group');
            if (modelsBtnGroup) modelsBtnGroup.style.display = '';

            const uploadBtn = document.querySelector('.xeokit-uploadModel');
            const deleteBtn = document.querySelector('.xeokit-deleteModel');
            if (uploadBtn) uploadBtn.style.display = isModelsTab ? '' : 'none';
            if (deleteBtn) deleteBtn.style.display = isModelsTab ? '' : 'none';
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
        this._nodeIndex = new Map();
        if (this.currentTab === 'storeys') {
            this._unresolvedStoreyNodeIds.clear();
        }

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
                this._indexNodesRecursive(hierarchyData);
                if (this.currentTab === "storeys") {
                    this._mergeStoreyVisibilityIntent(hierarchyData);
                }
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
            if (this.currentTab === 'storeys' && this._unresolvedStoreyNodeIds.has(node.id)) {
                nodeDiv.classList.add('tree-node-unresolved');
            }

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
                this.toggleNode(node.id, node);
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
            } else if (this.currentTab === 'storeys') {
                this._applyStoreyCheckboxVisuals(checkbox, node);
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this._onStoreyCheckboxUserChange(node, checkbox.checked);
                });
            } else {
                checkbox.checked = true;
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggleVisibility(node, checkbox.checked);
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

    toggleNode(nodeId, nodeFromClick) {
        const node = nodeFromClick || this._nodeIndex.get(String(nodeId));
        if (!node || !node.children || node.children.length === 0) {
            return;
        }

        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
            this._collapseNodeInDom(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
            this._expandNodeInDom(nodeId, node);
        }
    }

    selectNode(nodeId) {
        // Remove previous selection
        document.querySelectorAll('.tree-node.selected').forEach(node => {
            node.classList.remove('selected');
        });

        // Add selection to current node
        const esc = this._escapeNodeIdForSelector(String(nodeId));
        const nodeElement = document.querySelector(
            `.xeokit-${this.currentTab}Tab [data-node-id="${esc}"] .tree-node`
        );
        if (nodeElement) {
            nodeElement.classList.add('selected');
            this.selectedNode = nodeId;
        }
    }

    /**
     * Storeys tab: after checkbox toggles a leaf row, dim it if objectId does not resolve to a
     * scene entity; clear dim when it does. Category rows are skipped (no objectId on parent).
     * Set persists until storeys tree rebuild.
     */
    _syncUnresolvedGreyForStoreyLeaf(node) {
        if (this.currentTab !== 'storeys') {
            return;
        }
        const panel = document.querySelector('.xeokit-storeysTab .xeokit-tree-panel');
        if (!panel) {
            return;
        }
        const idUtils = window.idUtils;
        if (!idUtils || typeof idUtils.numericToSceneId !== 'function') {
            return;
        }
        const sceneId = idUtils.numericToSceneId(node.objectId);
        const entity = sceneId ? this.viewer.scene.objects[sceneId] : null;
        const esc = this._escapeNodeIdForSelector(String(node.id));
        const row = panel.querySelector(`li[data-node-id="${esc}"] .tree-node`);
        if (entity) {
            this._unresolvedStoreyNodeIds.delete(node.id);
            if (row) {
                row.classList.remove('tree-node-unresolved');
            }
        } else {
            this._unresolvedStoreyNodeIds.add(node.id);
            if (row) {
                row.classList.add('tree-node-unresolved');
            }
        }
    }



    toggleVisibility(node, visible) {
        const idUtils = window.idUtils;
        if (node.objectId) {
            const numericId = node.objectId;
            if (!idUtils || typeof idUtils.numericToSceneId !== "function") {
                console.warn("TreeView: idUtils.numericToSceneId not available");
                return;
            }
            const sceneId = idUtils.numericToSceneId(numericId);

            if (!sceneId) {
                console.warn("TreeView: Could not convert numeric ID to scene ID:", numericId);
                return;
            }
            const entity = this.viewer.scene.objects[sceneId];
            if (!entity) {
                console.warn("TreeView: Object not in scene:", sceneId);
                return;
            }
            entity.visible = visible;
        } else if (node.children) {
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
        const idUtils = window.idUtils;
        if (!idUtils || typeof idUtils.numericToSceneId !== "function") {
            console.warn("TreeView: idUtils.numericToSceneId not available");
            return;
        }
        children.forEach((child) => {
            if (child.objectId) {
                const numericId = child.objectId;
                const sceneId = idUtils.numericToSceneId(numericId);
                if (!sceneId) {
                    console.warn("TreeView: Could not convert numeric ID to scene ID:", numericId);
                    return;
                }
                const entity = this.viewer.scene.objects[sceneId];
                if (!entity) {
                    console.warn("TreeView: Object not in scene:", sceneId);
                    return;
                }
                entity.visible = visible;
            } else if (child.children) {
                this._setChildrenVisibility(child.children, visible);
            }
        });
    }

    _syncChildrenCheckboxes(node, checked) {
        if (!node.children || node.children.length === 0) {
            return;
        }

        const panel = document.querySelector(`.xeokit-${this.currentTab}Tab .xeokit-tree-panel`);
        if (!panel) {
            return;
        }

        const updateCheckboxes = (children) => {
            children.forEach(child => {
                const esc = this._escapeNodeIdForSelector(String(child.id));
                const checkbox = panel.querySelector(`li[data-node-id="${esc}"] .tree-visibility-checkbox`);
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
        for (const k of this._storeyVisibilityIntent.keys()) {
            this._storeyVisibilityIntent.set(k, true);
        }
        this.viewer.scene.setObjectsVisible(this.viewer.scene.objectIds, true);
        this.viewer.scene.setObjectsXRayed(this.viewer.scene.xrayedObjectIds, false);
        this._repaintStoreyCheckboxesFromIntent();
    }

    hideAllStoreys() {
        console.log('TreeView: Hide all storeys');
        for (const k of this._storeyVisibilityIntent.keys()) {
            this._storeyVisibilityIntent.set(k, false);
        }
        this.viewer.scene.setObjectsVisible(this.viewer.scene.visibleObjectIds, false);
        this._repaintStoreyCheckboxesFromIntent();
    }
}
