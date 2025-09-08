// Basic XKT Viewer
import { Viewer, XKTLoaderPlugin, NavCubePlugin } from "https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js";
import { Toolbar } from "./toolbar/Toolbar.js";
import { TreeView } from "./treeview/TreeView.js";
import { ObjectContextMenu, CanvasContextMenu } from "./contextmenu/ContextMenu.js";

// Initialize viewer
const viewer = new Viewer({
    canvasId: "myCanvas",
    transparent: true
});

// Add XKT loader
const xktLoader = new XKTLoaderPlugin(viewer);

// Initialize Navigation Cube
const navCube = new NavCubePlugin(viewer, {
    canvasElement: document.getElementById("myNavCubeCanvas"),
    fitVisible: true,
    color: "#CFCFCF"
});

// Configure camera control: disable right-click pan, enable middle-click pan
viewer.cameraControl.panRightClick = false;

// Get DOM elements
const projectSelect = document.getElementById('projectSelect');
const modelSelect = document.getElementById('modelSelect');
const toolbarElement = document.getElementById('myToolbar');

// Create state for storing loaded model
let loadedModel = null;

// Store loaded properties and legend
let modelProperties = null;
let modelLegend = null;

// Make properties available globally for toolbar tools
window.modelProperties = null;
window.modelLegend = null;

// Track last selected and highlighted entity IDs
let lastSelectedId = null;
let lastHighlightedId = null;

// Store current model name
let currentModelName = null;

// Store tree view and context menus for global access
let treeView = null;
let objectContextMenu = null;
let canvasContextMenu = null;

// Initialize toolbar
const toolbar = new Toolbar(viewer, {
    toolbarElement: toolbarElement
});

// Initialize tree view after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    treeView = new TreeView(viewer, {
        containerElement: document.getElementById('treeViewPanel'),
        onNodeClick: (node, event) => {
            // Only handle checkbox toggling - no metadata display
            console.log('Tree node clicked:', node);
        },
        onNodeContextMenu: (node, event) => {
            console.log('Tree node context menu:', node);
            // Handle tree node context menu
        }
    });
});

// Initialize context menus
objectContextMenu = new ObjectContextMenu(viewer, {
    hideOnAction: true,
    parentNode: document.body
});

canvasContextMenu = new CanvasContextMenu(viewer, {
    hideOnAction: true,
    parentNode: document.body
});

// Add context menu event handlers
viewer.scene.canvas.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const hit = viewer.scene.pick({
        canvasPos: [event.offsetX, event.offsetY]
    });

    if (hit && hit.entity.isObject) {
        // Show object context menu
        objectContextMenu.setContext({
            viewer: viewer,
            entity: hit.entity,
            showProperties: (objectId) => {
                showObjectMetadata(objectId);
            },
            showInExplorer: (objectId) => {
                showInTreeView(objectId);
            }
        });
        objectContextMenu.show(event.pageX, event.pageY);
    } else {
        // Show canvas context menu
        canvasContextMenu.setContext({
            viewer: viewer
        });
        canvasContextMenu.show(event.pageX, event.pageY);
    }
});

// Function to create sample tree data for testing
function createSampleTreeData() {
    return {
        "[Main] testserverProject2.rvt": {
            "Levels": {
                "Level 0": {
                    "Doors": {
                        "319024": {
                            "Family and Type": "Doors_ExtDbl_Flush: 1810x2110mm"
                        },
                        "319084": {
                            "Family and Type": "Doors_ExtDbl_Flush: 1810x2110mm"
                        }
                    },
                    "Walls": {
                        "318889": {
                            "Family and Type": "Basic Wall: Wall-Ext_102Bwk-75Ins-100LBlk-12P"
                        },
                        "318890": {
                            "Family and Type": "Basic Wall: Wall-Int_100LBlk-12P"
                        }
                    },
                    "Windows": {
                        "319100": {
                            "Family and Type": "Windows_Sgl_Plain: 600x1200mm"
                        },
                        "319101": {
                            "Family and Type": "Windows_Sgl_Plain: 800x1200mm"
                        }
                    }
                },
                "Level 1": {
                    "Doors": {
                        "320024": {
                            "Family and Type": "Doors_Sgl_Flush: 810x2110mm"
                        }
                    },
                    "Walls": {
                        "320889": {
                            "Family and Type": "Basic Wall: Wall-Int_100LBlk-12P"
                        }
                    }
                },
                "zeroLevel": {
                    "Levels": {
                        "311": {
                            "Family and Type": "Level: Circle Head - Project Datum"
                        },
                        "694": {
                            "Family and Type": "Level: Circle Head - Project Datum"
                        }
                    }
                }
            }
        }
    };
}

// Function to show object metadata
function showObjectMetadata(objectId) {
    // Expand metadata window if collapsed
    const metadataBox = document.getElementById('metadataBox');
    if (metadataBox && metadataBox.classList.contains('collapsed')) {
        metadataBox.classList.remove('collapsed');
    }

    const metadataTable = document.querySelector('#metadataTable tbody');
    metadataTable.innerHTML = '';

    // Extract elementId from objectId (e.g., Surface[105545] => 105545)
    const match = objectId.match(/\[(\d+)\]/);
    const elementId = match ? match[1] : null;

    if (elementId && window.modelProperties && window.modelProperties[elementId]) {
        const props = window.modelProperties[elementId];

        // Map property indices to names using legend
        Object.entries(props).forEach(([key, value]) => {
            let propName = key;
            if (window.modelLegend && window.modelLegend[key] && window.modelLegend[key].Name) {
                propName = window.modelLegend[key].Name;
            }
            let displayValue;
            if (value !== null && typeof value === 'object') {
                displayValue = JSON.stringify(value);
            } else {
                displayValue = value;
            }
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${propName}</td>
                <td>${displayValue}</td>
            `;
            metadataTable.appendChild(row);
        });
    } else {
        // Show object ID if no properties found
        const idRow = document.createElement('tr');
        idRow.innerHTML = `
            <td>ID</td>
            <td>${objectId}</td>
        `;
        metadataTable.appendChild(idRow);
    }
}

// Function to show object in tree view
function showInTreeView(objectId) {
    if (!treeView) {
        console.warn('TreeView not available');
        return;
    }

    // Make sure explorer panel is visible
    const explorerPanel = document.getElementById('treeViewPanel');
    if (explorerPanel && explorerPanel.style.display === 'none') {
        explorerPanel.style.display = 'block';

        // Update toggle button state
        const toggleButton = document.querySelector('.xeokit-toggle-explorer');
        if (toggleButton) {
            toggleButton.classList.add('active');
        }
    }

    // Extract elementId from objectId (e.g., Surface[105545] => 105545)
    const match = objectId.match(/\[(\d+)\]/);
    const elementId = match ? match[1] : null;

    if (elementId) {
        // Try to find and select the node in tree view
        treeView.selectNodeById(elementId);
        console.log('Showing object in tree view:', elementId);
    } else {
        console.warn('Could not extract element ID from object ID:', objectId);
    }
}

// Initialize projects
function initializeProjects() {
    // Set single project option
    projectSelect.innerHTML = '<option value="xeokit-storage-2">xeokit-storage-2</option>';
    
    // Load models for the default project
    loadModelsForProject();
}

// Load models for selected project
async function loadModelsForProject() {
    try {
        // Show loading indicator
        modelSelect.innerHTML = '<option value="">Loading models...</option>';

        // Fetch models from API
        const response = await fetch('/api/modeldata/xkt-files');
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const s3Objects = await response.json();
        
        // Transform S3 objects into model list
        const models = s3Objects
            .filter(obj => obj.Key.endsWith('.xkt'))
            .map(obj => ({
                id: obj.ETag.replace(/"/g, ''),
                name: obj.name || obj.Key.split('/').pop().replace(/\.xkt$/i, ''), // Use 'name' from backend if available
                url: `/api/modeldata/xkt/${encodeURIComponent(obj.Key)}`
            }));

        // Populate models dropdown
        modelSelect.innerHTML = models.map(model =>
            `<option value="${model.url}">${model.name}</option>`
        ).join('');

        // Load first model if available
        if (models.length > 0) {
            loadModel(models[0].url);
        } else {
            // Disable toolbar when no models available
            toolbar.onModelUnloaded();
        }

    } catch (error) {
        console.error('Error loading models:', error);
        modelSelect.innerHTML = '<option value="">Error loading models</option>';
    }
}

// Load selected model
async function loadModel(src) {
    try {
        // Clear any existing models
        if (loadedModel) {
            loadedModel.destroy();
            loadedModel = null;
        }

        // Extract and decode model name from URL, removing /xktmodel/ part
        const fileName = decodeURIComponent(src.split('/').pop()); // Get the last part of URL and decode it
        currentModelName = fileName.split('/').pop().replace('.xkt', '.rvt'); // Get last part after any remaining / and replace extension
        
        // Load new model
        loadedModel = await xktLoader.load({
            id: "model",
            src: src,
            edges: true
        });

        // Reset object states
        viewer.scene.setObjectsVisible(viewer.scene.objectIds, true);
        viewer.scene.setObjectsXRayed(viewer.scene.xrayedObjectIds, false);
        viewer.scene.setObjectsSelected(viewer.scene.selectedObjectIds, false);

        // Reset and rebuild tree view for the newly loaded model
        if (treeView) {
            treeView.setTreeData(null);
            // Clear panel DOM
            const panels = document.querySelectorAll('.xeokit-tree-panel');
            panels.forEach(p => p.innerHTML = "");
        }

        // Auto fit view to the entire model - wait longer for model to be fully loaded
        setTimeout(() => {
            const scene = viewer.scene;
            const aabb = scene.getAABB(scene.visibleObjectIds);
            if (aabb && aabb.length === 6) {
                // Add padding to the bounding box to avoid too tight fit
                const padding = 0.3; // 30% padding
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

                viewer.cameraFlight.flyTo({
                    aabb: paddedAABB,
                    duration: 1.0,
                    fitFOV: 45 // Wider field of view for less tight fit
                });

                // Set pivot point to center of model
                const center = [
                    (aabb[0] + aabb[3]) / 2,
                    (aabb[1] + aabb[4]) / 2,
                    (aabb[2] + aabb[5]) / 2
                ];
                viewer.cameraControl.pivotPos = center;

                console.log("Auto view fit applied to loaded model with padding", paddedAABB);
            } else {
                console.log("No valid AABB found for auto view fit");
            }
        }, 500); // Longer delay to ensure model is fully loaded

        // Enable toolbar tools when model is loaded
        toolbar.onModelLoaded();

        // Trigger manual fit action as backup
        setTimeout(() => {
            if (toolbar.fitAction && toolbar.fitAction.getEnabled()) {
                toolbar.fitAction.fit();
                console.log("Manual fit action triggered");
            } else {
                // Direct fallback approach with padding
                const scene = viewer.scene;
                const aabb = scene.getAABB(scene.visibleObjectIds);
                if (aabb && aabb.length === 6) {
                    // Add padding to avoid too tight fit
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

                    viewer.cameraFlight.flyTo({
                        aabb: paddedAABB,
                        duration: 1.0,
                        fitFOV: 45
                    });
                    console.log("Direct view fit fallback triggered with padding");
                } else {
                    console.log("Fit action not available and no valid AABB for fallback");
                }
            }
        }, 800);

        if (currentModelName) {
            // Fetch properties and legend from backend using model name
            const propRes = await fetch(`/api/modeldata/properties/${encodeURIComponent(currentModelName)}`);
            if (propRes.ok) {
                const propData = await propRes.json();
                modelProperties = propData.properties;
                modelLegend = propData.legend;

                // Update global references for toolbar tools
                window.modelProperties = modelProperties;
                window.modelLegend = modelLegend;

                // Load tree view data if available
                if (propData.treeView && treeView) {
                    console.log('Setting tree data:', propData.treeView);
                    treeView.setTreeData(propData.treeView);

                    // Force rebuild after a short delay
                    setTimeout(() => {
                        console.log('Force rebuilding tree...');
                        treeView.buildTree();
                    }, 1000);
                } else if (treeView) {
                    // No tree data for this model – clear any previous tree
                    treeView.setTreeData({});
                }

                console.log('Loaded properties for model:', currentModelName);
            } else {
                console.warn('Failed to load properties for model:', currentModelName);
                modelProperties = null;
                modelLegend = null;
                window.modelProperties = null;
                window.modelLegend = null;
            }
        } else {
            console.warn('Could not extract model name from URL');
            modelProperties = null;
            modelLegend = null;
            window.modelProperties = null;
            window.modelLegend = null;
        }

    } catch (error) {
        console.error('Error loading model:', error);
        modelProperties = null;
        modelLegend = null;
        window.modelProperties = null;
        window.modelLegend = null;
        // Disable toolbar on error
        toolbar.onModelUnloaded();
    }
}

// Event listeners
modelSelect.addEventListener('change', (event) => {
    const selectedUrl = event.target.value;
    if (selectedUrl) {
        loadModel(selectedUrl);
    }
});

// Restore highlighting and add collapse functionality
document.addEventListener('DOMContentLoaded', () => {
    // Collapse panel functionality using header
    const metadataHeader = document.getElementById('metadataHeader');
    const metadataBox = document.getElementById('metadataBox');
    if (metadataHeader && metadataBox) {
        metadataHeader.addEventListener('click', () => {
            metadataBox.classList.toggle('collapsed');
        });
    }
});

// Initialize object click handling for metadata display
// This will be the default behavior when no toolbar tools are active
function handleDefaultClick(coords) {
    // Only handle clicks if no toolbar interaction tools are active
    if (toolbar.selectionTool && toolbar.selectionTool.getActive()) {
        return; // Let selection tool handle the click
    }
    if (toolbar.hideTool && toolbar.hideTool.getActive()) {
        return; // Let hide tool handle the click
    }

    const hit = viewer.scene.pick({
        canvasPos: coords
    });

    const metadataTable = document.querySelector('#metadataTable tbody');
    metadataTable.innerHTML = '';

    // In default mode, we only show metadata - NO selection/highlighting
    if (hit && modelProperties && modelLegend) {
        const entity = hit.entity;
        console.log('Showing metadata for entity:', entity.id);

        // Extract elementId from entity.id (e.g., Surface[105545] => 105545)
        const match = entity.id.match(/\[(\d+)\]/);
        const elementId = match ? match[1] : null;
        if (elementId && modelProperties[elementId]) {
            const props = modelProperties[elementId];
            console.log('Properties found for entity:', entity.id);

            // Map property indices to names using legend
            Object.entries(props).forEach(([key, value]) => {
                let propName = key;
                if (modelLegend[key] && modelLegend[key].Name) {
                    propName = modelLegend[key].Name;
                }
                let displayValue;
                if (value !== null && typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                } else {
                    displayValue = value;
                }
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${propName}</td>
                    <td>${displayValue}</td>
                `;
                metadataTable.appendChild(row);
            });
        } else {
            // Show entity ID if no properties found
            const idRow = document.createElement('tr');
            idRow.innerHTML = `
                <td>ID</td>
                <td>${entity.id}</td>
            `;
            metadataTable.appendChild(idRow);
        }
    } else if (hit) {
        // Show entity ID if no properties loaded
        const entity = hit.entity;
        console.log('Showing basic info for entity:', entity.id);
        const idRow = document.createElement('tr');
        idRow.innerHTML = `
            <td>ID</td>
            <td>${entity.id}</td>
        `;
        metadataTable.appendChild(idRow);
    } else {
        console.log('Clicked empty space - metadata cleared');
    }
}

// Set up default metadata display when no tools are active
viewer.cameraControl.on("picked", (pickResult) => {
    // Only show metadata if no interaction tools are active
    if (toolbar.selectionTool && toolbar.selectionTool.getActive()) {
        return; // Let selection tool handle it
    }
    if (toolbar.hideTool && toolbar.hideTool.getActive()) {
        return; // Let hide tool handle it
    }

    // Show metadata for picked object
    if (pickResult && pickResult.entity) {
        const entity = pickResult.entity;
        console.log('Showing metadata for entity:', entity.id);

        const metadataTable = document.querySelector('#metadataTable tbody');
        metadataTable.innerHTML = '';

        // Extract elementId from entity.id (e.g., Surface[105545] => 105545)
        const match = entity.id.match(/\[(\d+)\]/);
        const elementId = match ? match[1] : null;

        if (elementId && window.modelProperties && window.modelProperties[elementId]) {
            const props = window.modelProperties[elementId];

            // Map property indices to names using legend
            Object.entries(props).forEach(([key, value]) => {
                let propName = key;
                if (window.modelLegend && window.modelLegend[key] && window.modelLegend[key].Name) {
                    propName = window.modelLegend[key].Name;
                }
                let displayValue;
                if (value !== null && typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                } else {
                    displayValue = value;
                }
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${propName}</td>
                    <td>${displayValue}</td>
                `;
                metadataTable.appendChild(row);
            });
        } else {
            // Show entity ID if no properties found
            const idRow = document.createElement('tr');
            idRow.innerHTML = `
                <td>ID</td>
                <td>${entity.id}</td>
            `;
            metadataTable.appendChild(idRow);
        }
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Only handle shortcuts when not typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') {
        return;
    }

    switch(event.key.toLowerCase()) {
        case 'r':
            // Reset view
            if (toolbar.resetAction) {
                toolbar.resetAction.reset();
            }
            break;
        case 'f':
            // Fit view
            if (toolbar.fitAction) {
                toolbar.fitAction.fit();
            }
            break;
        case 's':
            // Toggle selection tool
            if (toolbar.selectionTool) {
                toolbar.selectionTool.setActive(!toolbar.selectionTool.getActive());
            }
            break;
        case 'h':
            // Toggle hide tool
            if (toolbar.hideTool) {
                toolbar.hideTool.setActive(!toolbar.hideTool.getActive());
            }
            break;
        case 'a':
            // Show all objects
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                toolbar._showAllObjects();
            }
            break;
        case 'escape':
            // Deactivate all interaction tools
            toolbar.deactivateInteractionTools();
            break;
    }
});

// Global test function for debugging
window.testTreeView = function() {
    if (treeView) {
        console.log('TreeView instance:', treeView);
        console.log('TreeView data:', treeView.treeData);
        console.log('Current tab:', treeView.currentTab);
        treeView.buildTree();
    } else {
        console.log('TreeView not initialized');
    }
};

// Global ID conversion utilities
window.idUtils = {
    // Convert from numeric ID to scene object ID format (e.g., "319024" -> "Wall-Ext_102-wk-/Sims-100LBlk-12P[319024]")
    numericToSceneId: function(numericId) {
        const sceneObjects = viewer.scene.objects;
        for (const sceneId in sceneObjects) {
            if (sceneId.includes(`[${numericId}]`)) {
                return sceneId;
            }
        }
        return null;
    },

    // Convert from scene object ID to numeric ID (e.g., "Wall-Ext_102-wk-/Sims-100LBlk-12P[319024]" -> "319024")
    sceneToNumericId: function(sceneId) {
        const match = sceneId.match(/\[(\d+)\]$/);
        return match ? match[1] : null;
    },

    // Get scene object by numeric ID
    getObjectByNumericId: function(numericId) {
        const sceneId = this.numericToSceneId(numericId);
        return sceneId ? viewer.scene.objects[sceneId] : null;
    }
};

// Global test function for checking objects
window.testObjects = function() {
    console.log('Available scene objects:', Object.keys(viewer.scene.objects));
    console.log('First 10 objects:', Object.keys(viewer.scene.objects).slice(0, 10));

    // Test ID conversion
    const firstObjectId = Object.keys(viewer.scene.objects)[0];
    const numericId = window.idUtils.sceneToNumericId(firstObjectId);
    const backToSceneId = window.idUtils.numericToSceneId(numericId);
    console.log('ID conversion test:', firstObjectId, '->', numericId, '->', backToSceneId);
};

// Global test function for tree view selection
window.testTreeSelection = function(numericId) {
    if (!numericId) {
        // Use first available object
        const firstObjectId = Object.keys(viewer.scene.objects)[0];
        numericId = window.idUtils.sceneToNumericId(firstObjectId);
    }
    console.log('Testing tree selection for numeric ID:', numericId);
    if (treeView) {
        treeView.selectNodeById(numericId);
    } else {
        console.log('TreeView not available');
    }
};

// Global test function for section tool
window.testSectionTool = function() {
    if (toolbar && toolbar.sectionTool) {
        const sectionTool = toolbar.sectionTool;
        console.log('Section Tool status:');
        console.log('- Enabled:', sectionTool.getEnabled());
        console.log('- Active:', sectionTool.getActive());
        console.log('- Number of sections:', sectionTool.getNumSections());
        console.log('- Has active sections:', sectionTool.hasActiveSections());
        console.log('- Active section count:', sectionTool.getActiveSectionCount());

        if (!sectionTool.getActive()) {
            console.log('To test: Click the section tool button (cut icon) to activate, then click on objects to create section planes');
        }
    } else {
        console.log('Section Tool not available');
    }
};

// Global function to clear any persistent loading states
window.clearLoadingStates = function() {
    if (treeView) {
        treeView.clearLoadingStates();
        console.log('Cleared loading states from tree view');
    }

    // Clear all possible loading indicators
    const loadingSelectors = [
        '.loading', '.fa-spin', '.spinner', '.loading-dots',
        '[class*="loading"]', '[class*="spinner"]', '[class*="spin"]',
        '.xeokit-busy-modal', '.busy-modal'
    ];

    loadingSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            console.log('Found loading element:', el, 'with classes:', el.className);
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.classList.remove('loading', 'fa-spin', 'spinner', 'spinning');
            if (el.classList.contains('loading-dots') || el.classList.contains('spinner')) {
                el.remove();
            }
        });
    });

    // Also check for any CSS animations and stop them
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const computedStyle = window.getComputedStyle(el);
        if (computedStyle.animationName !== 'none' && computedStyle.animationName !== '') {
            console.log('Stopping animation on element:', el, 'animation:', computedStyle.animationName);
            el.style.animation = 'none';
            el.style.webkitAnimation = 'none';
        }
    });

    // Specifically look for any xeokit loading indicators
    const xeokitElements = document.querySelectorAll('[class*="xeokit"]');
    xeokitElements.forEach(el => {
        if (el.style.animation || el.style.webkitAnimation) {
            console.log('Clearing xeokit animation on:', el);
            el.style.animation = 'none';
            el.style.webkitAnimation = 'none';
        }
    });

    console.log('Cleared all loading indicators and animations');
};

// Global function to test section tool dropdown
window.testSectionDropdown = function() {
    if (toolbar && toolbar.sectionTool) {
        const sectionTool = toolbar.sectionTool;
        console.log('Section Tool Dropdown Test:');
        console.log('- Number of sections:', sectionTool.getNumSections());
        console.log('- Section planes:', Object.keys(sectionTool._sectionPlanesPlugin.sectionPlanes));
        console.log('- Context menu:', sectionTool._contextMenu);
        console.log('- Menu button element:', sectionTool._menuButtonElement);

        if (sectionTool.getNumSections() === 0) {
            console.log('To test dropdown: First create some section planes by:');
            console.log('1. Click the section tool (cut icon) to activate');
            console.log('2. Click on 3D objects to create section planes');
            console.log('3. Then click the dropdown arrow to see individual slice options');
        } else {
            console.log('Section planes exist! Click the dropdown arrow next to the section tool to see the menu');
        }
    } else {
        console.log('Section Tool not available');
    }
};

// Global function to manually trigger section dropdown
window.showSectionDropdown = function() {
    if (toolbar && toolbar.sectionTool && toolbar.sectionTool._menuButtonElement) {
        const button = toolbar.sectionTool._menuButtonElement;
        const rect = button.getBoundingClientRect();
        console.log('Manually triggering section dropdown at:', rect.left, rect.bottom + 5);

        // Trigger the context menu manually
        toolbar.sectionTool._contextMenu.setContext({
            viewer: viewer,
            sectionPlanesPlugin: toolbar.sectionTool._sectionPlanesPlugin
        });
        toolbar.sectionTool._contextMenu.show(rect.left, rect.bottom + 5);
    } else {
        console.log('Section tool or menu button not available');
    }
};

// Global function to debug context menu visibility
window.debugContextMenu = function() {
    if (toolbar && toolbar.sectionTool && toolbar.sectionTool._contextMenu) {
        const menu = toolbar.sectionTool._contextMenu;
        console.log('Context Menu Debug:');
        console.log('- Menu element:', menu.menuElement);
        console.log('- Menu visible:', menu.visible);
        console.log('- Menu display:', menu.menuElement ? menu.menuElement.style.display : 'N/A');
        console.log('- Menu position:', menu.menuElement ? {
            left: menu.menuElement.style.left,
            top: menu.menuElement.style.top,
            zIndex: menu.menuElement.style.zIndex
        } : 'N/A');
        console.log('- Menu parent:', menu.menuElement ? menu.menuElement.parentNode : 'N/A');
        console.log('- Menu items:', menu.items ? menu.items.length : 'N/A');

        // Check if menu element exists in DOM
        if (menu.menuElement) {
            const rect = menu.menuElement.getBoundingClientRect();
            console.log('- Menu rect:', rect);
            console.log('- Menu computed style:', window.getComputedStyle(menu.menuElement));
        }
    } else {
        console.log('Context menu not available');
    }
};

// Initialize
initializeProjects();

// Export viewer for use in other modules
export { viewer }; 