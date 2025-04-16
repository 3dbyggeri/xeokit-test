import { cameraInfo } from '../state/metadataState.js';
import { viewer } from '../main.js';

export function initializeCamera() {
    if (!cameraInfo || Object.keys(cameraInfo).length === 0) {
        console.warn('No camera info available, using default view');
        // Set a default camera position
        viewer.scene.camera.eye = [100, 100, 100];
        viewer.scene.camera.look = [0, 0, 0];
        viewer.scene.camera.up = [0, 1, 0];
        return;
    }

    try {
        let { Position, Target, UpVector, FieldOfView, Scale } = cameraInfo;

        // Ensure all required properties exist
        if (!Position || !Target || !UpVector) {
            console.warn('Missing required camera properties, using default view');
            viewer.scene.camera.eye = [100, 100, 100];
            viewer.scene.camera.look = [0, 0, 0];
            viewer.scene.camera.up = [0, 1, 0];
            return;
        }

        // Ensure Scale has a valid value
        Scale = Scale || 1.0;

        // Set camera position
        viewer.scene.camera.eye = Position;
        viewer.scene.camera.look = Target;
        viewer.scene.camera.up = UpVector;
        
        // Set field of view if available
        if (FieldOfView) {
            viewer.scene.camera.perspective.fov = FieldOfView;
        }
        
        console.log('Camera initialized successfully');
    } catch (error) {
        console.error('Error initializing camera:', error);
        // Set default view on error
        viewer.scene.camera.eye = [100, 100, 100];
        viewer.scene.camera.look = [0, 0, 0];
        viewer.scene.camera.up = [0, 1, 0];
    }
}

// Function to reset camera to default view
export function resetCamera() {
    viewer.scene.camera.eye = [100, 100, 100];
    viewer.scene.camera.look = [0, 0, 0];
    viewer.scene.camera.up = [0, 1, 0];
}

// Function to fit view to model
export function fitToModel() {
    const scene = viewer.scene;
    const aabb = scene.getAABB(scene.visibleObjectIds);
    
    viewer.cameraFlight.flyTo({
        aabb: aabb,
        duration: 0.5
    });
} 