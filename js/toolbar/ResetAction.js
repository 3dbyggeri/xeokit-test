import { Controller } from "./Controller.js";

/**
 * Reset Action - Resets camera to initial position
 * Level 1 Tool (Easiest)
 */
class ResetAction extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        const buttonElement = cfg.buttonElement;
        const camera = this.viewer.camera;

        // Store initial camera position
        this._initialCameraState = {
            eye: [1.841470, 9.417103, -5.405803],
            look: [4.400000, 3.400000, 8.800000],
            up: [-0.174, 0.985, 0.000]
        };

        this.on("enabled", (enabled) => {
            if (!enabled) {
                buttonElement.classList.add("disabled");
            } else {
                buttonElement.classList.remove("disabled");
            }
        });

        buttonElement.addEventListener("click", (event) => {
            if (this.getEnabled()) {
                this.reset();
            }
            event.preventDefault();
        });
    }

    /**
     * Reset the view to show all visible objects
     */
    reset() {
        const scene = this.viewer.scene;
        const camera = this.viewer.camera;

        // Clear any selections and highlights
        const selectedIds = scene.selectedObjectIds.slice();
        const highlightedIds = scene.highlightedObjectIds.slice();

        if (selectedIds.length > 0) {
            scene.setObjectsSelected(selectedIds, false);
        }
        if (highlightedIds.length > 0) {
            scene.setObjectsHighlighted(highlightedIds, false);
        }

        // Show all objects
        scene.setObjectsVisible(scene.objectIds, true);
        scene.setObjectsXRayed(scene.xrayedObjectIds, false);

        // Deactivate interaction tools
        if (this.parent && this.parent.deactivateInteractionTools) {
            this.parent.deactivateInteractionTools();
        }

        // Clear measurements
        if (this.parent && this.parent.measureDistanceTool) {
            this.parent.measureDistanceTool.clearMeasurements();
        }
        if (this.parent && this.parent.measureAngleTool) {
            this.parent.measureAngleTool.clearMeasurements();
        }

        // Reset camera to fit all visible objects
        const aabb = scene.getAABB(scene.visibleObjectIds);
        if (aabb) {
            this.viewer.cameraFlight.flyTo({
                aabb: aabb,
                duration: 1.0
            });
        } else {
            // Fallback to initial camera position if no objects
            this.viewer.cameraFlight.flyTo({
                eye: this._initialCameraState.eye,
                look: this._initialCameraState.look,
                up: this._initialCameraState.up,
                duration: 1.0
            });
        }

        this.fire("reset", true);
    }
}

export { ResetAction };
