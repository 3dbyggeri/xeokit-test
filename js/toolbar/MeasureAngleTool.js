import { Controller } from "./Controller.js";

/**
 * Angle Measurement Tool
 * Uses XeoKit's AngleMeasurementsPlugin for professional measurement capabilities
 */
class MeasureAngleTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active || false;

        // Import XeoKit measurement plugins dynamically
        this._initializePlugins();

        // Set up event handlers
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
                if (this._angleMeasurementsMouseControl) {
                    this._angleMeasurementsMouseControl.activate();
                }
                console.log("Angle measurement mode activated");
            } else {
                this._buttonElement.classList.remove("active");
                if (this._angleMeasurementsMouseControl) {
                    this._angleMeasurementsMouseControl.deactivate();
                }
                console.log("Angle measurement mode deactivated");
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
     * Initialize XeoKit measurement plugins
     */
    async _initializePlugins() {
        try {
            // Import XeoKit measurement plugins
            const { AngleMeasurementsPlugin, AngleMeasurementsMouseControl } = await import("https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js");

            // Create angle measurements plugin
            this._angleMeasurementsPlugin = new AngleMeasurementsPlugin(this.viewer, {});

            // Create mouse control for angle measurements
            this._angleMeasurementsMouseControl = new AngleMeasurementsMouseControl(this._angleMeasurementsPlugin, {});
            this._angleMeasurementsMouseControl.snapping = true;

            // Set up event handlers for measurements
            this._angleMeasurementsPlugin.on("mouseOver", (e) => {
                e.measurement.setHighlighted(true);
            });

            this._angleMeasurementsPlugin.on("mouseLeave", (e) => {
                e.measurement.setHighlighted(false);
            });

            console.log("Angle measurement plugins initialized");
        } catch (error) {
            console.error("Failed to initialize angle measurement plugins:", error);
        }
    }

    /**
     * Get number of active measurements
     */
    getNumMeasurements() {
        if (!this._angleMeasurementsPlugin) return 0;
        return Object.keys(this._angleMeasurementsPlugin.measurements).length;
    }

    /**
     * Set snapping enabled
     */
    setSnappingEnabled(snappingEnabled) {
        if (this._angleMeasurementsMouseControl) {
            this._angleMeasurementsMouseControl.snapping = snappingEnabled;
        }
    }

    /**
     * Get snapping enabled
     */
    getSnappingEnabled() {
        if (!this._angleMeasurementsMouseControl) return false;
        return this._angleMeasurementsMouseControl.snapping;
    }

    /**
     * Clear all measurements
     */
    clearMeasurements() {
        if (this._angleMeasurementsPlugin) {
            this._angleMeasurementsPlugin.clear();
            console.log("All angle measurements cleared");
        }
    }

    /**
     * Reset the tool
     */
    reset() {
        this.clearMeasurements();
        this.setActive(false);
    }

    /**
     * Destroy the tool
     */
    destroy() {
        this.setActive(false);
        if (this._angleMeasurementsPlugin) {
            this._angleMeasurementsPlugin.destroy();
        }
        if (this._angleMeasurementsMouseControl) {
            this._angleMeasurementsMouseControl.destroy();
        }
        super.destroy();
    }
}

export { MeasureAngleTool };
