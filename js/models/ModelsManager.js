/**
 * ModelsManager - Handles model loading/unloading and display in the Models tab
 */
export class ModelsManager {
    constructor(viewer, cfg = {}) {
        this.viewer = viewer;
        this.xktLoader = cfg.xktLoader;
        this.containerElement = cfg.containerElement;
        
        this.modelsInfo = {};
        this.loadedModels = new Set();
        this.modelsData = [];
        this.projectName = 'xeokit-storage-2'; // S3 bucket name

        // Event handlers
        this.onModelLoaded = null;
        this.onModelUnloaded = null;

        this._initEventHandlers();
    }

    _initEventHandlers() {
        // Button event handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('xeokit-loadAllModels')) {
                e.preventDefault();
                this.loadAllModels();
            } else if (e.target.classList.contains('xeokit-unloadAllModels')) {
                e.preventDefault();
                this.unloadAllModels();
            }
        });
    }

    async fetchModels() {
        try {
            console.log('ModelsManager: Fetching models from API');
            const response = await fetch('/api/modeldata/xkt-files');

            if (!response.ok) {
                const errorText = await response.text();
                console.error('ModelsManager: API error response:', response.status, errorText);

                // If S3 is not configured, provide fallback empty data
                if (response.status === 500) {
                    console.warn('ModelsManager: S3 not configured, using empty model list');
                    this.modelsData = [];
                    return this.modelsData;
                }

                throw new Error(`Failed to fetch models: ${response.status} - ${errorText}`);
            }

            const s3Objects = await response.json();
            console.log('ModelsManager: Raw API response:', s3Objects);

            // Handle empty response
            if (!Array.isArray(s3Objects) || s3Objects.length === 0) {
                console.log('ModelsManager: No models found in S3');
                this.modelsData = [];
                return this.modelsData;
            }

            // Transform S3 objects into model list
            this.modelsData = s3Objects
                .filter(obj => obj.Key && obj.Key.endsWith('.xkt'))
                .map(obj => {
                    // Extract and decode model name from URL, removing /xktmodel/ part
                    const fileName = decodeURIComponent(obj.Key.split('/').pop()); // Get the last part of URL and decode it
                    const modelName = fileName.split('/').pop().replace('.xkt', '.rvt'); // Get last part after any remaining / and replace extension

                    return {
                        id: obj.ETag ? obj.ETag.replace(/"/g, '') : `model_${Date.now()}`,
                        name: obj.name || modelName,
                        url: `/api/modeldata/xkt/${encodeURIComponent(obj.Key)}`,
                        key: obj.Key
                    };
                });

            console.log('ModelsManager: Processed models:', this.modelsData);
            return this.modelsData;

        } catch (error) {
            console.error('ModelsManager: Error fetching models:', error);
            this.modelsData = [];
            return [];
        }
    }

    buildModelsTree() {
        console.log('ModelsManager: Building models tree');
        console.log('ModelsManager: modelsData:', this.modelsData);
        console.log('ModelsManager: modelsData length:', this.modelsData ? this.modelsData.length : 'undefined');

        if (!this.modelsData || this.modelsData.length === 0) {
            console.log('ModelsManager: No models data available, creating empty project node');
            // Return empty project node when no models are available
            return [{
                id: 'project_default',
                label: `${this.projectName} (No models available)`,
                type: 'project',
                children: []
            }];
        }

        // Create tree structure with project as root and models as children
        const projectNode = {
            id: 'project_default',
            label: this.projectName,
            type: 'project',
            children: this.modelsData.map(model => ({
                id: model.id,
                label: model.name,
                type: 'model',
                modelId: model.id,
                modelUrl: model.url,
                modelKey: model.key,
                loaded: this.loadedModels.has(model.id)
            }))
        };

        return [projectNode];
    }

    async loadModel(modelId) {
        console.log('ModelsManager: Loading model:', modelId);
        
        const modelInfo = this.modelsData.find(m => m.id === modelId);
        if (!modelInfo) {
            console.error('ModelsManager: Model not found:', modelId);
            return false;
        }

        if (this.loadedModels.has(modelId)) {
            console.log('ModelsManager: Model already loaded:', modelId);
            return true;
        }

        try {
            // Load the model using XKTLoader
            const model = await this.xktLoader.load({
                id: modelId,
                src: modelInfo.url,
                edges: true
            });

            this.loadedModels.add(modelId);
            console.log('ModelsManager: Model loaded successfully:', modelId);

            // Fetch properties and tree view data from backend
            try {
                // Try to reconstruct the model name as expected by the backend
                let modelName;
                if (modelInfo.key) {
                    // S3 key, e.g. "models/rac_basic_sample_project_3D.xkt"
                    const fileName = decodeURIComponent(modelInfo.key.split('/').pop());
                    modelName = fileName.replace('.xkt', '.rvt');
                } else if (modelInfo.url) {
                    // fallback: try to extract from url
                    const fileName = decodeURIComponent(modelInfo.url.split('/').pop());
                    modelName = fileName.replace('.xkt', '.rvt');
                } else {
                    modelName = modelInfo.name; // fallback, may not work
                }
                
                if (modelName && window.treeView) {
                    const propRes = await fetch(`/api/modeldata/properties/${encodeURIComponent(modelName)}`);
                    if (propRes.ok) {
                        const propData = await propRes.json();
                        window.modelProperties = propData.properties;
                        window.modelLegend = propData.legend;

                        // Load tree view data if available
                        if (propData.treeView) {
                            console.log('Setting tree data:', propData.treeView);
                            window.treeView.setTreeData(propData.treeView);
                            setTimeout(() => {
                                console.log('Force rebuilding tree...');
                                window.treeView.buildTree();
                            }, 1000);
                        } else {
                            window.treeView.setTreeData({});
                        }
                        console.log('Loaded properties for model:', modelName);
                    } else {
                        console.warn('Failed to load properties for model:', modelName);
                        window.modelProperties = null;
                        window.modelLegend = null;
                    }
                }
            } catch (error) {
                console.error('Error loading model metadata:', error);
                window.modelProperties = null;
                window.modelLegend = null;
            }

            // Update checkbox state
            this._updateModelCheckbox(modelId, true);

            // Auto fit view if this is the first model loaded
            if (this.loadedModels.size === 1) {
                this._autoFitView();
            }

            // Note: Metadata fetching removed - endpoint doesn't exist

            // Fire event
            this._fireEvent('modelLoaded', { modelId, model });

            return true;

        } catch (error) {
            console.error('ModelsManager: Error loading model:', modelId, error);
            return false;
        }
    }

    unloadModel(modelId) {
        console.log('ModelsManager: Unloading model:', modelId);
        
        if (!this.loadedModels.has(modelId)) {
            console.log('ModelsManager: Model not loaded:', modelId);
            return true;
        }

        try {
            const model = this.viewer.scene.models[modelId];
            if (model) {
                model.destroy();
            }

            this.loadedModels.delete(modelId);
            console.log('ModelsManager: Model unloaded successfully:', modelId);

            // Update checkbox state
            this._updateModelCheckbox(modelId, false);

            // Fire event
            this._fireEvent('modelUnloaded', { modelId });

            return true;

        } catch (error) {
            console.error('ModelsManager: Error unloading model:', modelId, error);
            return false;
        }
    }

    async loadAllModels() {
        console.log('ModelsManager: Loading all models');
        
        for (const model of this.modelsData) {
            if (!this.loadedModels.has(model.id)) {
                await this.loadModel(model.id);
            }
        }
    }

    unloadAllModels() {
        console.log('ModelsManager: Unloading all models');
        
        const loadedModelIds = Array.from(this.loadedModels);
        for (const modelId of loadedModelIds) {
            this.unloadModel(modelId);
        }
    }

    // Removed _fetchModelMetadata - endpoint doesn't exist

    _updateModelCheckbox(modelId, checked) {
        const checkbox = document.querySelector(`[data-node-id="${modelId}"] .tree-visibility-checkbox`);
        if (checkbox) {
            checkbox.checked = checked;
        }
    }

    _autoFitView() {
        setTimeout(() => {
            const scene = this.viewer.scene;
            const aabb = scene.getAABB(scene.visibleObjectIds);
            if (aabb && aabb.length === 6) {
                // Add padding to the bounding box
                const padding = 0.3;
                const width = aabb[3] - aabb[0];
                const height = aabb[4] - aabb[1];
                const depth = aabb[5] - aabb[2];
                const maxDim = Math.max(width, height, depth);
                const paddingAmount = maxDim * padding;

                const paddedAABB = [
                    aabb[0] - paddingAmount,
                    aabb[1] - paddingAmount,
                    aabb[2] - paddingAmount,
                    aabb[3] + paddingAmount,
                    aabb[4] + paddingAmount,
                    aabb[5] + paddingAmount
                ];

                this.viewer.cameraFlight.flyTo({
                    aabb: paddedAABB,
                    duration: 1.0,
                    fitFOV: 45
                });

                // Set pivot point to center of model
                const center = [
                    (aabb[0] + aabb[3]) / 2,
                    (aabb[1] + aabb[4]) / 2,
                    (aabb[2] + aabb[5]) / 2
                ];
                this.viewer.cameraControl.pivotPos = center;

                console.log('ModelsManager: Auto view fit applied');
            }
        }, 500);
    }

    _fireEvent(eventName, data) {
        // Simple event firing - could be enhanced with proper event system
        if (this.onModelLoaded && eventName === 'modelLoaded') {
            this.onModelLoaded(data);
        } else if (this.onModelUnloaded && eventName === 'modelUnloaded') {
            this.onModelUnloaded(data);
        }
    }

    getLoadedModelIds() {
        return Array.from(this.loadedModels);
    }

    isModelLoaded(modelId) {
        return this.loadedModels.has(modelId);
    }

    getNumModelsLoaded() {
        return this.loadedModels.size;
    }

    getModelsData() {
        return this.modelsData;
    }
}
