// Basic XKT Viewer - To be manually edited from the template provided

import { Viewer, XKTLoaderPlugin } from "https://cdn.jsdelivr.net/npm/@xeokit/xeokit-sdk@latest/dist/xeokit-sdk.es.min.js";
import { config } from './config.js';

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
async function loadModel(xktUrl, metadataUrl) {
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
        
        // Load metadata if available
        if (metadataUrl) {
            loadMetadata(metadataUrl);
        }
        
        console.log("Model loaded successfully");
    } catch (error) {
        console.error("Error loading model:", error);
    }
}

// Function to load metadata
async function loadMetadata(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load metadata: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Loaded metadata:', data);
        
        // Clear metadata table
        const tbody = document.querySelector('#metadataTable tbody');
        tbody.innerHTML = '';
        
        // Display model properties in metadata panel
        if (data.properties) {
            Object.entries(data.properties).forEach(([key, value]) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${key}</td>
                    <td>${value}</td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading metadata:', error);
    }
}

// Initialize projects dropdown
async function loadProjects() {
    try {
        let projects = [];
        
        try {
            // Try to fetch projects from API
            const response = await fetch(`${config.baseUrl}${config.endpoints.projects}`);
            if (response.ok) {
                projects = await response.json();
            }
        } catch (error) {
            console.warn('Could not fetch projects from API, using default model');
        }
        
        // If no projects from API, add a default option
        if (projects.length === 0) {
            projects = [{ id: 'default', name: 'Default Project' }];
        }
        
        // Populate projects dropdown
        projectSelect.innerHTML = '';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
        
        // Trigger change event to load models for first project
        projectSelect.dispatchEvent(new Event('change'));
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Load models for selected project
async function loadModelsForProject(projectId) {
    try {
        let models = [];
        
        try {
            // Try to fetch models from API
            const response = await fetch(`${config.baseUrl}${config.endpoints.models}${projectId}`);
            if (response.ok) {
                models = await response.json();
            }
        } catch (error) {
            console.warn('Could not fetch models from API, using default model');
        }
        
        // If no models from API, add a default option
        if (Object.keys(models).length === 0) {
            models = {
                'default': {
                    id: 'default',
                    name: 'Default Model',
                    xktUrl: config.defaultModel.xktUrl,
                    metadataUrl: config.defaultModel.metadataUrl
                }
            };
        }
        
        // Populate models dropdown
        modelSelect.innerHTML = '';
        Object.values(models).forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.dataset.xktUrl = model.xktUrl || '';
            option.dataset.metadataUrl = model.metadataUrl || '';
            modelSelect.appendChild(option);
        });
        
        // Trigger change event to load first model
        modelSelect.dispatchEvent(new Event('change'));
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

// Event listeners
projectSelect.addEventListener('change', () => {
    const projectId = projectSelect.value;
    if (projectId) {
        loadModelsForProject(projectId);
    }
});

modelSelect.addEventListener('change', () => {
    const selectedOption = modelSelect.options[modelSelect.selectedIndex];
    if (selectedOption) {
        const xktUrl = selectedOption.dataset.xktUrl || config.defaultModel.xktUrl;
        const metadataUrl = selectedOption.dataset.metadataUrl || config.defaultModel.metadataUrl;
        loadModel(xktUrl, metadataUrl);
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
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    
    // If API fails, load default model
    if (config.defaultModel && config.defaultModel.xktUrl) {
        loadModel(config.defaultModel.xktUrl, config.defaultModel.metadataUrl);
    }
});

// Export viewer for use in other modules
export { viewer };
