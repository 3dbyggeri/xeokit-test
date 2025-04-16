import { viewer } from '../main.js';

export function findClosestEntity(worldPos) {
    let closestEntity = null;
    let closestDist = Infinity;

    for (let entityID in viewer.scene.objects) {
        let entity = viewer.scene.objects[entityID];
        if (!entity.meshes || entity.meshes.length === 0) continue;

        let aabbWorld = entity.meshes[0]._aabbWorld;
        if (!aabbWorld) continue;

        if (isWithinBoundingBox(worldPos, aabbWorld)) {
            return entity;
        }
    }

    return closestEntity;
}

export function isWithinBoundingBox(worldPos, aabb) {
    return (
        worldPos[0] >= aabb[0] && worldPos[0] <= aabb[3] &&  // X-axis
        worldPos[1] >= aabb[1] && worldPos[1] <= aabb[4]     // Y-axis
    );
}

// API utility functions
export async function fetchProjects() {
    try {
        const response = await fetch(`${window.config.baseUrl}${window.config.endpoints.projects}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching projects:', error);
        return [];
    }
}

export async function fetchModels(projectId) {
    try {
        const response = await fetch(`${window.config.baseUrl}${window.config.endpoints.models}${projectId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching models:', error);
        return {};
    }
}

export function showStatus(message) {
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) {
        const newStatusElement = document.createElement('div');
        newStatusElement.id = 'statusMessage';
        newStatusElement.textContent = message;
        document.body.appendChild(newStatusElement);
    } else {
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    }
    
    // Hide after 3 seconds
    setTimeout(() => {
        const element = document.getElementById('statusMessage');
        if (element) {
            element.style.display = 'none';
        }
    }, 3000);
} 