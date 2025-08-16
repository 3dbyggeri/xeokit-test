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
                this._onPick = this.viewer.cameraControl.on("picked", (pickResult) => {
                    if (!pickResult.entity) {
                        return;
                    }
                    const entity = pickResult.entity;
                    const objectId = entity.id;
                    const isSelected = entity.selected;

                    // Toggle selection
                    entity.selected = !isSelected;
                    entity.highlighted = entity.selected;

                    console.log(`SelectionTool: Object ${objectId} ${entity.selected ? 'selected' : 'deselected'}`);

                    // Show metadata for selected object
                    if (entity.selected) {
                        this._showMetadataForObject(entity);
                    } else {
                        this._clearMetadata();
                    }
                });
            } else {
                this._buttonElement.classList.remove("active");
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
     * Reset selection tool - clear all selections
     */
    reset() {
        this._clearAllSelections();
    }

    /**
     * Show metadata for a selected object
     */
    _showMetadataForObject(entity) {
        // Access global variables from viewer.js
        if (typeof window.modelProperties === 'undefined' || typeof window.modelLegend === 'undefined') {
            console.log('Model properties or legend not available');
            this._showBasicMetadata(entity);
            return;
        }

        const metadataTable = document.querySelector('#metadataTable tbody');
        metadataTable.innerHTML = '';

        // Extract elementId from entity.id (e.g., Surface[105545] => 105545)
        const match = entity.id.match(/\[(\d+)\]/);
        const elementId = match ? match[1] : null;

        if (elementId && window.modelProperties[elementId]) {
            const props = window.modelProperties[elementId];
            console.log('Showing metadata for selected object:', entity.id);

            // Map property indices to names using legend
            Object.entries(props).forEach(([key, value]) => {
                let propName = key;
                if (window.modelLegend[key] && window.modelLegend[key].Name) {
                    propName = window.modelLegend[key].Name;
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
            this._showBasicMetadata(entity);
        }
    }

    /**
     * Show basic metadata when detailed properties aren't available
     */
    _showBasicMetadata(entity) {
        const metadataTable = document.querySelector('#metadataTable tbody');
        metadataTable.innerHTML = '';

        const idRow = document.createElement('tr');
        idRow.innerHTML = `
            <td>ID</td>
            <td>${entity.id}</td>
        `;
        metadataTable.appendChild(idRow);
    }

    /**
     * Clear metadata display
     */
    _clearMetadata() {
        const metadataTable = document.querySelector('#metadataTable tbody');
        metadataTable.innerHTML = '';
        console.log('Metadata cleared');
    }

    /**
     * Clear all selections
     */
    _clearAllSelections() {
        const scene = this.viewer.scene;
        const selectedObjectIds = scene.selectedObjectIds.slice(); // Copy array
        const highlightedObjectIds = scene.highlightedObjectIds.slice(); // Copy array

        if (selectedObjectIds.length > 0) {
            scene.setObjectsSelected(selectedObjectIds, false);
        }
        if (highlightedObjectIds.length > 0) {
            scene.setObjectsHighlighted(highlightedObjectIds, false);
        }

        console.log(`Cleared ${selectedObjectIds.length} selections and ${highlightedObjectIds.length} highlights`);

        // Clear metadata when clearing selections
        this._clearMetadata();

        this.fire("selectionsCleared", {
            selectedCount: selectedObjectIds.length,
            highlightedCount: highlightedObjectIds.length
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
