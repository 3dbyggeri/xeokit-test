import { Controller } from "./Controller.js";

/**
 * Show/Hide Spaces Mode - Toggles IFC space visibility
 * Level 2 Tool (Medium Difficulty)
 */
class ShowSpacesMode extends Controller {
    constructor(parent, cfg) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active === true; // Default to false (spaces hidden)

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
                this._showSpaces();
            } else {
                this._buttonElement.classList.remove("active");
                this._hideSpaces();
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
     * Show IFC spaces
     */
    _showSpaces() {
        const scene = this.viewer.scene;
        const spaceObjectIds = this._getSpaceObjectIds();
        
        if (spaceObjectIds.length > 0) {
            scene.setObjectsVisible(spaceObjectIds, true);
            console.log(`Showing ${spaceObjectIds.length} space objects`);
        } else {
            console.log("No space objects found");
        }
    }

    /**
     * Hide IFC spaces
     */
    _hideSpaces() {
        const scene = this.viewer.scene;
        const spaceObjectIds = this._getSpaceObjectIds();
        
        if (spaceObjectIds.length > 0) {
            scene.setObjectsVisible(spaceObjectIds, false);
            console.log(`Hiding ${spaceObjectIds.length} space objects`);
        } else {
            console.log("No space objects found");
        }
    }

    /**
     * Get all space object IDs in the scene
     */
    _getSpaceObjectIds() {
        const scene = this.viewer.scene;
        const metaScene = this.viewer.metaScene;
        const spaceObjectIds = [];

        // Look for objects with IFC space types
        const spaceTypes = [
            "IfcSpace",
            "IfcSpatialZone",
            "IfcSpatialElement"
        ];

        // Iterate through all objects and find spaces
        scene.objectIds.forEach(objectId => {
            const metaObject = metaScene.metaObjects[objectId];
            if (metaObject && metaObject.type) {
                if (spaceTypes.includes(metaObject.type)) {
                    spaceObjectIds.push(objectId);
                }
            }
        });

        // Alternative approach: look for objects with "Space" in their name or ID
        if (spaceObjectIds.length === 0) {
            scene.objectIds.forEach(objectId => {
                const metaObject = metaScene.metaObjects[objectId];
                if (metaObject && metaObject.name && 
                    metaObject.name.toLowerCase().includes("space")) {
                    spaceObjectIds.push(objectId);
                }
            });
        }

        return spaceObjectIds;
    }

    /**
     * Check if spaces are currently visible
     */
    areSpacesVisible() {
        return this.getActive();
    }

    /**
     * Get count of space objects
     */
    getSpaceCount() {
        return this._getSpaceObjectIds().length;
    }
}

export { ShowSpacesMode };
