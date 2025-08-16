// Basic XKT Viewer
import { Viewer, XKTLoaderPlugin, NavCubePlugin } from "https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js";
import { Toolbar } from "./toolbar/Toolbar.js";

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

// Initialize toolbar
const toolbar = new Toolbar(viewer, {
    toolbarElement: toolbarElement
});

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

// Initialize
initializeProjects();

// Export viewer for use in other modules
export { viewer }; 