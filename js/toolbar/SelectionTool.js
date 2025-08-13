import { Controller } from "./Controller.js";

/**
 * Selection Tool - Click to select objects
 * Level 3 Tool (More Complex)
 */
class SelectionTool extends Controller {
    constructor(parent, cfg) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active === true; // Default to false
        this._clickHandler = null;

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
                this._activateSelectionMode();
            } else {
                this._buttonElement.classList.remove("active");
                this._deactivateSelectionMode();
            }
        });

        this._buttonElement.addEventListener("click", (event) => {
            if (this.getEnabled()) {
                this.setActive(!this.getActive());
            }
            event.preventDefault();
        });

        // Set initial state
        this.setActive(this._active);
    }

    /**
     * Activate selection mode
     */
    _activateSelectionMode() {
        const scene = this.viewer.scene;
        const input = scene.input;

        // Remove existing click handler if any
        if (this._clickHandler) {
            input.off("mouseclicked", this._clickHandler);
        }

        // Add new click handler for selection
        this._clickHandler = (coords) => {
            const hit = scene.pick({
                canvasPos: coords
            });

            if (hit && hit.entity) {
                const entity = hit.entity;
                const isSelected = entity.selected;
                
                // Toggle selection
                entity.selected = !isSelected;
                
                // Also highlight selected objects
                entity.highlighted = entity.selected;
                
                console.log(`Object ${entity.id} ${entity.selected ? 'selected' : 'deselected'}`);
                
                // Fire selection event
                this.fire("objectSelected", {
                    entity: entity,
                    selected: entity.selected
                });
            } else {
                // Clear all selections when clicking empty space
                this._clearAllSelections();
            }
        };

        input.on("mouseclicked", this._clickHandler);
        
        // Change cursor to indicate selection mode
        this.viewer.canvas.style.cursor = "crosshair";
        
        console.log("Selection mode activated");
    }

    /**
     * Deactivate selection mode
     */
    _deactivateSelectionMode() {
        const scene = this.viewer.scene;
        const input = scene.input;

        // Remove click handler
        if (this._clickHandler) {
            input.off("mouseclicked", this._clickHandler);
            this._clickHandler = null;
        }

        // Restore default cursor
        this.viewer.canvas.style.cursor = "default";
        
        console.log("Selection mode deactivated");
    }

    /**
     * Clear all selections
     */
    _clearAllSelections() {
        const scene = this.viewer.scene;
        const selectedObjectIds = scene.selectedObjectIds.slice(); // Copy array
        
        scene.setObjectsSelected(selectedObjectIds, false);
        scene.setObjectsHighlighted(selectedObjectIds, false);
        
        console.log(`Cleared ${selectedObjectIds.length} selections`);
        
        this.fire("selectionsCleared", {
            count: selectedObjectIds.length
        });
    }

    /**
     * Select objects by IDs
     */
    selectObjects(objectIds, selected = true) {
        const scene = this.viewer.scene;
        scene.setObjectsSelected(objectIds, selected);
        scene.setObjectsHighlighted(objectIds, selected);
        
        console.log(`${selected ? 'Selected' : 'Deselected'} ${objectIds.length} objects`);
    }

    /**
     * Get currently selected object IDs
     */
    getSelectedObjectIds() {
        return this.viewer.scene.selectedObjectIds.slice();
    }

    /**
     * Get count of selected objects
     */
    getSelectedCount() {
        return this.viewer.scene.selectedObjectIds.length;
    }

    /**
     * Check if selection mode is active
     */
    isSelectionMode() {
        return this.getActive();
    }

    /**
     * Destroy the selection tool
     */
    destroy() {
        this._deactivateSelectionMode();
        super.destroy();
    }
}

export { SelectionTool };
