import { Controller } from "./Controller.js";

/**
 * Fit Action - Fits all visible objects in view
 * Level 1 Tool (Easiest)
 */
class FitAction extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        const buttonElement = cfg.buttonElement;

        this.on("enabled", (enabled) => {
            if (!enabled) {
                buttonElement.classList.add("disabled");
            } else {
                buttonElement.classList.remove("disabled");
            }
        });

        this.on("active", (active) => {
            if (active) {
                buttonElement.classList.add("active");
            } else {
                buttonElement.classList.remove("active");
            }
        });

        buttonElement.addEventListener("click", (event) => {
            if (this.getEnabled()) {
                this.fit();
            }
            event.preventDefault();
        });
    }

    /**
     * Fit all visible objects in view
     */
    fit() {
        const scene = this.viewer.scene;
        const aabb = scene.getAABB(scene.visibleObjectIds);
        
        if (aabb) {
            this.viewer.cameraFlight.flyTo({
                aabb: aabb,
                duration: 0.5
            });
            
            // Set pivot point to center of visible objects
            const center = [
                (aabb[0] + aabb[3]) / 2,
                (aabb[1] + aabb[4]) / 2,
                (aabb[2] + aabb[5]) / 2
            ];
            this.viewer.cameraControl.pivotPos = center;
        }

        this.fire("fit", true);
    }

    /**
     * Set field of view for fitting
     */
    set fov(fov) {
        this.viewer.scene.cameraFlight.fitFOV = fov;
    }

    /**
     * Get field of view for fitting
     */
    get fov() {
        return this.viewer.scene.cameraFlight.fitFOV;
    }

    /**
     * Set animation duration
     */
    set duration(duration) {
        this.viewer.scene.cameraFlight.duration = duration;
    }

    /**
     * Get animation duration
     */
    get duration() {
        return this.viewer.scene.cameraFlight.duration;
    }
}

export { FitAction };
