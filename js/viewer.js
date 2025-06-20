// Basic XKT Viewer
import { Viewer, XKTLoaderPlugin } from "https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js";

// Initialize viewer
const viewer = new Viewer({
    canvasId: "myCanvas",
    transparent: true
});

// Add XKT loader
const xktLoader = new XKTLoaderPlugin(viewer);

// Get DOM elements
const projectSelect = document.getElementById('projectSelect');
const modelSelect = document.getElementById('modelSelect');

// Create state for storing loaded model
let loadedModel = null;

// Store loaded properties and legend
let modelProperties = null;
let modelLegend = null;

// Track last selected and highlighted entity IDs
let lastSelectedId = null;
let lastHighlightedId = null;

// Store current model name
let currentModelName = null;

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

        viewer.scene.setObjectsVisible(true);
        viewer.scene.setObjectsXRayed(false);
        viewer.cameraFlight.flyTo(loadedModel);

        if (currentModelName) {
            // Fetch properties and legend from backend using model name
            const propRes = await fetch(`/api/modeldata/properties/${encodeURIComponent(currentModelName)}`);
            if (propRes.ok) {
                const propData = await propRes.json();
                modelProperties = propData.properties;
                modelLegend = propData.legend;
                console.log('Loaded properties for model:', currentModelName);
            } else {
                console.warn('Failed to load properties for model:', currentModelName);
                modelProperties = null;
                modelLegend = null;
            }
        } else {
            console.warn('Could not extract model name from URL');
            modelProperties = null;
            modelLegend = null;
        }

    } catch (error) {
        console.error('Error loading model:', error);
        modelProperties = null;
        modelLegend = null;
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

// Initialize object click handling
viewer.scene.input.on("mouseclicked", (coords) => {
    const hit = viewer.scene.pick({
        canvasPos: coords
    });
    
    const metadataTable = document.querySelector('#metadataTable tbody');
    metadataTable.innerHTML = '';

    // Deselect and unhighlight previous
    if (lastSelectedId) {
        viewer.scene.setObjectsSelected([lastSelectedId], false);
    }
    if (lastHighlightedId) {
        viewer.scene.setObjectsHighlighted({ [lastHighlightedId]: false });
    }
    lastSelectedId = null;
    lastHighlightedId = null;

    if (hit && modelProperties && modelLegend) {
        const entity = hit.entity;
        // Set new selection and highlight
        viewer.scene.setObjectsSelected([entity.id], true);
        viewer.scene.setObjectsHighlighted({ [entity.id]: true });
        lastSelectedId = entity.id;
        lastHighlightedId = entity.id;
        console.log('Highlighting and selecting entity:', entity.id);
        // Extract elementId from entity.id (e.g., Surface[105545] => 105545)
        const match = entity.id.match(/\[(\d+)\]/);
        const elementId = match ? match[1] : null;
        if (elementId && modelProperties[elementId]) {
            const props = modelProperties[elementId];
            // Log selection
            console.log('Entity selected:', entity.id);
            console.log('Properties:', props);
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
        // Set new selection and highlight even if no properties loaded
        const entity = hit.entity;
        viewer.scene.setObjectsSelected([entity.id], true);
        viewer.scene.setObjectsHighlighted({ [entity.id]: true });
        lastSelectedId = entity.id;
        lastHighlightedId = entity.id;
        console.log('Highlighting and selecting entity:', entity.id);
        // Show entity ID if no properties loaded
        const idRow = document.createElement('tr');
        idRow.innerHTML = `
            <td>ID</td>
            <td>${entity.id}</td>
        `;
        metadataTable.appendChild(idRow);
    } else {
        // Clear highlighting and selection when clicking empty space
        if (lastSelectedId) {
            viewer.scene.setObjectsSelected([lastSelectedId], false);
        }
        if (lastHighlightedId) {
            viewer.scene.setObjectsHighlighted({ [lastHighlightedId]: false });
        }
        lastSelectedId = null;
        lastHighlightedId = null;
        console.log('Highlights and selection cleared');
    }
});

// Initialize
initializeProjects();

// Export viewer for use in other modules
export { viewer }; 