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
                name: obj.Key.split('/').pop(),
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
            viewer.scene.removeModel(loadedModel.id);
            loadedModel = null;
        }

        // Load new model
        loadedModel = await xktLoader.load({
            id: "model",
            src: src
        });

        viewer.scene.setObjectsVisible(true);
        viewer.scene.setObjectsXRayed(false);
        viewer.cameraFlight.flyTo(loadedModel);

    } catch (error) {
        console.error('Error loading model:', error);
    }
}

// Event listeners
modelSelect.addEventListener('change', (event) => {
    const selectedUrl = event.target.value;
    if (selectedUrl) {
        loadModel(selectedUrl);
    }
});

// Initialize object click handling
viewer.scene.input.on("mouseclicked", (coords) => {
    const hit = viewer.scene.pick({
        canvasPos: coords
    });
    
    if (hit) {
        const entity = hit.entity;
        console.log("Entity clicked:", entity.id);
        
        // Highlight the clicked entity
        viewer.scene.setObjectsHighlighted({[entity.id]: true});
        
        // Show entity properties in metadata panel
        const metadataTable = document.querySelector('#metadataTable tbody');
        metadataTable.innerHTML = '';
        
        // Show entity ID
        const idRow = document.createElement('tr');
        idRow.innerHTML = `
            <td>ID</td>
            <td>${entity.id}</td>
        `;
        metadataTable.appendChild(idRow);
        
        // Get entity properties if available
        const props = entity.userData || {};
        Object.entries(props).forEach(([key, value]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${key}</td>
                <td>${value}</td>
            `;
            metadataTable.appendChild(row);
        });
    } else {
        // Clear highlighting when clicking empty space
        viewer.scene.setObjectsHighlighted({});
    }
});

// Initialize
initializeProjects();

// Export viewer for use in other modules
export { viewer }; 