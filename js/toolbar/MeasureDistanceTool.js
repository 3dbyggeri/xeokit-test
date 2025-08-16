import { Controller } from "./Controller.js";

/**
 * Distance Measurement Tool
 * Uses XeoKit's DistanceMeasurementsPlugin for professional measurement capabilities
 */
class MeasureDistanceTool extends Controller {
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
                if (this._distanceMeasurementsMouseControl) {
                    this._distanceMeasurementsMouseControl.activate();
                }
                console.log("Distance measurement mode activated");
            } else {
                this._buttonElement.classList.remove("active");
                if (this._distanceMeasurementsMouseControl) {
                    this._distanceMeasurementsMouseControl.deactivate();
                }
                console.log("Distance measurement mode deactivated");
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
            const { DistanceMeasurementsPlugin, DistanceMeasurementsMouseControl } = await import("https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js");

            // Create distance measurements plugin
            this._distanceMeasurementsPlugin = new DistanceMeasurementsPlugin(this.viewer, {
                defaultAxisVisible: false,
                defaultLabelsOnWires: true
            });

            // Create mouse control for distance measurements
            this._distanceMeasurementsMouseControl = new DistanceMeasurementsMouseControl(this._distanceMeasurementsPlugin, {});
            this._distanceMeasurementsMouseControl.snapping = true;

            // Set up event handlers for measurements
            this._distanceMeasurementsPlugin.on("mouseOver", (e) => {
                e.measurement.setHighlighted(true);
            });

            this._distanceMeasurementsPlugin.on("mouseLeave", (e) => {
                e.measurement.setHighlighted(false);
            });

            console.log("Distance measurement plugins initialized");
        } catch (error) {
            console.error("Failed to initialize distance measurement plugins:", error);
        }
    }

    /**
     * Get number of active measurements
     */
    getNumMeasurements() {
        if (!this._distanceMeasurementsPlugin) return 0;
        return Object.keys(this._distanceMeasurementsPlugin.measurements).length;
    }

    /**
     * Set measurements axis visibility
     */
    setMeasurementsAxisVisible(axisVisible) {
        if (this._distanceMeasurementsPlugin) {
            this._distanceMeasurementsPlugin.setAxisVisible(axisVisible);
        }
    }

    /**
     * Get measurements axis visibility
     */
    getMeasurementsAxisVisible() {
        if (!this._distanceMeasurementsPlugin) return false;
        return this._distanceMeasurementsPlugin.getAxisVisible();
    }

    /**
     * Set snapping enabled
     */
    setSnappingEnabled(snappingEnabled) {
        if (this._distanceMeasurementsMouseControl) {
            this._distanceMeasurementsMouseControl.snapping = snappingEnabled;
        }
    }

    /**
     * Get snapping enabled
     */
    getSnappingEnabled() {
        if (!this._distanceMeasurementsMouseControl) return false;
        return this._distanceMeasurementsMouseControl.snapping;
    }

    /**
     * Clear all measurements
     */
    clearMeasurements() {
        if (this._distanceMeasurementsPlugin) {
            this._distanceMeasurementsPlugin.clear();
            console.log("All distance measurements cleared");
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
        if (this._distanceMeasurementsPlugin) {
            this._distanceMeasurementsPlugin.destroy();
        }
        if (this._distanceMeasurementsMouseControl) {
            this._distanceMeasurementsMouseControl.destroy();
        }
        super.destroy();
    }
}

export { MeasureDistanceTool };
