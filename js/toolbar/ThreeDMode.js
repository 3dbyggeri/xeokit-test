import { Controller } from "./Controller.js";

/**
 * 3D Mode Toggle - Switches between 3D and orthographic projection
 * Level 2 Tool (Medium Difficulty)
 */
class ThreeDMode extends Controller {
    constructor(parent, cfg) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active !== false; // Default to true (3D mode)

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
                this._enable3DMode();
            } else {
                this._buttonElement.classList.remove("active");
                this._enable2DMode();
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
     * Enable 3D mode (perspective projection)
     */
    _enable3DMode() {
        const camera = this.viewer.camera;
        camera.projection = "perspective";
        
        // Enable camera controls for 3D navigation
        this.viewer.cameraControl.navMode = "orbit";
        this.viewer.cameraControl.followPointer = true;
        
        console.log("3D mode enabled");
    }

    /**
     * Enable 2D mode (orthographic projection with constrained navigation)
     */
    _enable2DMode() {
        const camera = this.viewer.camera;
        camera.projection = "ortho";
        
        // Constrain camera controls for 2D-like navigation
        this.viewer.cameraControl.navMode = "planView";
        this.viewer.cameraControl.followPointer = false;
        
        console.log("2D mode enabled");
    }

    /**
     * Check if currently in 3D mode
     */
    is3D() {
        return this.getActive();
    }

    /**
     * Check if currently in 2D mode
     */
    is2D() {
        return !this.getActive();
    }
}

export { ThreeDMode };
