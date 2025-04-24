// Basic XKT Viewer
import { Viewer, XKTLoaderPlugin } from "https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js";

// Initialize viewer
const viewer = new Viewer({
    canvasId: "myCanvas",
    transparent: true
});

// Initialize XKT loader
const xktLoader = new XKTLoaderPlugin(viewer);

// Initialize model selectors
const projectSelect = document.getElementById('projectSelect');
const modelSelect = document.getElementById('modelSelect');

// Create state for storing loaded model
let loadedModel = null;

// Function to load and display a model
async function loadModel(xktUrl) {
    try {
        // Show loading status
        console.log(`Loading model from ${xktUrl}`);
        
        // Clear any existing model
        if (loadedModel) {
            loadedModel.destroy();
            loadedModel = null;
        }
        
        // Load new model
        loadedModel = await xktLoader.load({
            id: "model",
            src: xktUrl,
            edges: true
        });
        
        // Fit model to view
        viewer.cameraFlight.flyTo({
            aabb: loadedModel.aabb,
            duration: 1
        });
        
        console.log("Model loaded successfully");
    } catch (error) {
        console.error("Error loading model:", error);
        alert("Failed to load model. Please try another model.");
    }
}

// Initialize projects dropdown
function initializeProjects() {
    // Add single project option
    projectSelect.innerHTML = '<option value="default">Default Project</option>';
    
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
        
        const models = await response.json();
        
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

// Event listeners
projectSelect.addEventListener('change', loadModelsForProject);

modelSelect.addEventListener('change', () => {
    const selectedUrl = modelSelect.value;
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

// Start the application
document.addEventListener('DOMContentLoaded', initializeProjects);

// Export viewer for use in other modules
export { viewer }; 