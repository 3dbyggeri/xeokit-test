import { Controller } from "./Controller.js";

/**
 * Hide Tool - Click to hide objects
 * Level 3 Tool (More Complex)
 */
class HideTool extends Controller {
    constructor(parent, cfg) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active === true; // Default to false
        this._clickHandler = null;
        this._hiddenObjectIds = new Set(); // Track hidden objects

        this.on("enabled", (enabled) => {
            if (!enabled) {
                this._buttonElement.classList.add("disabled");
            } else {
                this._buttonElement.classList.remove("disabled");
            }
        });

        this.on("active", (active) => {
            if (active) {
                this._buttonElement.classList.add("active");
                this.viewer.cameraControl.doublePickFlyTo = false;
                this._onPick = this.viewer.cameraControl.on("picked", (pickResult) => {
                    if (!pickResult.entity) {
                        return;
                    }
                    const entity = pickResult.entity;
                    const objectId = entity.id;

                    if (entity.visible) {
                        entity.visible = false;
                        this._hiddenObjectIds.add(objectId);
                        console.log(`HideTool: Object ${objectId} hidden`);
                    }
                });
            } else {
                this._buttonElement.classList.remove("active");
                this.viewer.cameraControl.doublePickFlyTo = true;
                if (this._onPick !== undefined) {
                    this.viewer.cameraControl.off(this._onPick);
                    this._onPick = undefined;
                }
            }
        });

        this._buttonElement.addEventListener("click", (event) => {
            if (this.getEnabled()) {
                const active = this.getActive();
                this.setActive(!active);
            }
            event.preventDefault();
        });

        // Set initial state
        this.setActive(this._active);
    }

    /**
     * Hide objects by IDs
     */
    hideObjects(objectIds) {
        const scene = this.viewer.scene;
        scene.setObjectsVisible(objectIds, false);
        
        // Track hidden objects
        objectIds.forEach(id => this._hiddenObjectIds.add(id));
        
        console.log(`Hidden ${objectIds.length} objects`);
        
        this.fire("objectsHidden", {
            objectIds: objectIds,
            count: objectIds.length
        });
    }

    /**
     * Show objects by IDs
     */
    showObjects(objectIds) {
        const scene = this.viewer.scene;
        scene.setObjectsVisible(objectIds, true);
        
        // Remove from hidden tracking
        objectIds.forEach(id => this._hiddenObjectIds.delete(id));
        
        console.log(`Shown ${objectIds.length} objects`);
        
        this.fire("objectsShown", {
            objectIds: objectIds,
            count: objectIds.length
        });
    }

    /**
     * Show all hidden objects
     */
    showAllObjects() {
        const hiddenIds = Array.from(this._hiddenObjectIds);
        if (hiddenIds.length > 0) {
            this.showObjects(hiddenIds);
        }
    }

    /**
     * Hide selected objects
     */
    hideSelectedObjects() {
        const scene = this.viewer.scene;
        const selectedIds = scene.selectedObjectIds.slice();
        
        if (selectedIds.length > 0) {
            this.hideObjects(selectedIds);
            // Clear selections since objects are now hidden
            scene.setObjectsSelected(selectedIds, false);
        }
    }

    /**
     * Get hidden object IDs
     */
    getHiddenObjectIds() {
        return Array.from(this._hiddenObjectIds);
    }

    /**
     * Get count of hidden objects
     */
    getHiddenCount() {
        return this._hiddenObjectIds.size;
    }

    /**
     * Check if hide mode is active
     */
    isHideMode() {
        return this.getActive();
    }

    /**
     * Reset - show all hidden objects
     */
    reset() {
        this.showAllObjects();
    }

    /**
     * Destroy the hide tool
     */
    destroy() {
        this._deactivateHideMode();
        super.destroy();
    }
}

export { HideTool };
