import { Controller } from "./Controller.js";

/**
 * First Person Mode - Changes camera control behavior for first-person navigation
 * Level 2 Tool (Medium Difficulty)
 */
class FirstPersonMode extends Controller {
    constructor(parent, cfg) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active === true; // Default to false
        this._savedNavMode = null;

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
                this._enableFirstPersonMode();
            } else {
                this._buttonElement.classList.remove("active");
                this._disableFirstPersonMode();
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
     * Enable first person navigation mode
     */
    _enableFirstPersonMode() {
        const cameraControl = this.viewer.cameraControl;
        
        // Save current navigation mode
        this._savedNavMode = cameraControl.navMode;
        
        // Set first person navigation
        cameraControl.navMode = "firstPerson";
        cameraControl.followPointer = true;
        
        // Adjust first person settings
        cameraControl.firstPersonModeSpeed = 1.0;
        cameraControl.smartPivot = false;
        
        // Ensure perspective projection for first person
        this.viewer.camera.projection = "perspective";
        
        console.log("First person mode enabled");
    }

    /**
     * Disable first person navigation mode
     */
    _disableFirstPersonMode() {
        const cameraControl = this.viewer.cameraControl;
        
        // Restore previous navigation mode or default to orbit
        cameraControl.navMode = this._savedNavMode || "orbit";
        cameraControl.followPointer = true;
        cameraControl.smartPivot = true;
        
        console.log("First person mode disabled");
    }

    /**
     * Set first person movement speed
     */
    setSpeed(speed) {
        this.viewer.cameraControl.firstPersonModeSpeed = speed;
    }

    /**
     * Get first person movement speed
     */
    getSpeed() {
        return this.viewer.cameraControl.firstPersonModeSpeed;
    }

    /**
     * Check if currently in first person mode
     */
    isFirstPerson() {
        return this.getActive();
    }
}

export { FirstPersonMode };
