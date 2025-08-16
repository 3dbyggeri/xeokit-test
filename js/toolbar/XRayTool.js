import { Controller } from "./Controller.js";

/**
 * X-Ray Tool
 * Simple toggle for X-ray mode: enabled = X-ray all, disabled = X-ray none
 */
class XRayTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._xrayEnabled = false;

        // Set up event handlers
        this.on("enabled", (enabled) => {
            if (!enabled) {
                this._buttonElement.classList.add("disabled");
            } else {
                this._buttonElement.classList.remove("disabled");
            }
        });

        // Button click handler
        this._buttonElement.addEventListener("click", (event) => {
            if (this.getEnabled()) {
                this._toggleXRay();
            }
            event.preventDefault();
        });
    }

    /**
     * Toggle X-ray mode
     */
    _toggleXRay() {
        this._xrayEnabled = !this._xrayEnabled;

        if (this._xrayEnabled) {
            this._xrayAll();
            this._buttonElement.classList.add('active');
        } else {
            this._xrayNone();
            this._buttonElement.classList.remove('active');
        }
    }

    /**
     * X-ray all objects
     */
    _xrayAll() {
        const scene = this.viewer.scene;
        scene.setObjectsVisible(scene.objectIds, true);
        scene.setObjectsXRayed(scene.objectIds, true);
        console.log("X-ray enabled: All objects X-rayed");
    }

    /**
     * Remove X-ray from all objects
     */
    _xrayNone() {
        const scene = this.viewer.scene;
        scene.setObjectsXRayed(scene.xrayedObjectIds, false);
        console.log("X-ray disabled: X-ray removed from all objects");
    }

    /**
     * Reset the tool
     */
    reset() {
        if (this._xrayEnabled) {
            this._toggleXRay(); // Turn off X-ray if enabled
        }
    }

    /**
     * Destroy the tool
     */
    destroy() {
        this.reset();
        super.destroy();
    }
}

export { XRayTool };
