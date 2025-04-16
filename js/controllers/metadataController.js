import { metadataStore, legendMap, cameraInfo } from '../state/metadataState.js';

// Update metadata panel with given object properties
export function updateMetadataPanel(properties) {
    const metadataTable = document.querySelector('#metadataTable tbody');
    metadataTable.innerHTML = '';
    
    if (!properties || Object.keys(properties).length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="2">No properties available</td>
        `;
        metadataTable.appendChild(row);
        return;
    }
    
    // Add each property to the table
    Object.entries(properties).forEach(([key, value]) => {
        // Skip null or undefined values
        if (value === null || value === undefined) return;
        
        // Format the value for display
        let displayValue = value;
        
        // Format arrays
        if (Array.isArray(value)) {
            displayValue = value.join(', ');
        }
        // Format objects
        else if (typeof value === 'object') {
            displayValue = JSON.stringify(value);
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key}</td>
            <td>${displayValue}</td>
        `;
        metadataTable.appendChild(row);
    });
}

export async function loadMetadata(metadataURL) {
    try {
        const response = await fetch(metadataURL);
        if (!response.ok) {
            throw new Error(`Failed to load metadata: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Loaded metadata:', data);
        
        Object.assign(metadataStore, data.Properties || {});
        Object.assign(legendMap, data.Legend || {});
        Object.assign(cameraInfo, data.Camera || {});
        
        if (data.ProjectInfo) {
            metadataStore.ProjectInfo = data.ProjectInfo;
        }
        
        return data;
    } catch (error) {
        console.error('Error loading metadata:', error);
        return null;
    }
}

// Toggle metadata panel visibility
export function setupMetadataPanel() {
    const metadataHeader = document.getElementById('metadataHeader');
    const metadataBox = document.getElementById('metadataBox');
    
    if (metadataHeader && metadataBox) {
        metadataHeader.addEventListener('click', () => {
            metadataBox.classList.toggle('collapsed');
        });
    }
}

// Display metadata for the selected entity
export function displayEntityMetadata(entity) {
    if (!entity) {
        updateMetadataPanel({});
        return;
    }
    
    // Basic entity properties
    const properties = {
        ID: entity.id,
        Type: entity.type || 'Unknown'
    };
    
    // Add user data if available
    if (entity.userData) {
        Object.assign(properties, entity.userData);
    }
    
    // Add IFC properties if available
    if (entity.metadata && entity.metadata.props) {
        Object.assign(properties, entity.metadata.props);
    }
    
    updateMetadataPanel(properties);
} 