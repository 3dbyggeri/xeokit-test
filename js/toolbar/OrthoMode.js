import { Controller } from "./Controller.js";

/**
 * Orthographic Mode Toggle - Switches between perspective and orthographic projection
 * Level 2 Tool (Medium Difficulty)
 */
class OrthoMode extends Controller {
    constructor(parent, cfg) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active === true; // Default to false (perspective mode)

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
                this._enableOrthoMode();
            } else {
                this._buttonElement.classList.remove("active");
                this._enablePerspectiveMode();
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
     * Enable orthographic projection
     */
    _enableOrthoMode() {
        const camera = this.viewer.camera;
        camera.projection = "ortho";
        
        // Adjust ortho scale to fit current view
        const scene = this.viewer.scene;
        const aabb = scene.getAABB(scene.visibleObjectIds);
        if (aabb) {
            const diag = Math.sqrt(
                Math.pow(aabb[3] - aabb[0], 2) +
                Math.pow(aabb[4] - aabb[1], 2) +
                Math.pow(aabb[5] - aabb[2], 2)
            );
            camera.ortho.scale = diag * 1.3;
        }
        
        console.log("Orthographic mode enabled");
    }

    /**
     * Enable perspective projection
     */
    _enablePerspectiveMode() {
        const camera = this.viewer.camera;
        camera.projection = "perspective";
        
        console.log("Perspective mode enabled");
    }

    /**
     * Check if currently in orthographic mode
     */
    isOrtho() {
        return this.getActive();
    }

    /**
     * Check if currently in perspective mode
     */
    isPerspective() {
        return !this.getActive();
    }
}

export { OrthoMode };
