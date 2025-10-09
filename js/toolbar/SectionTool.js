import { Controller } from "./Controller.js";
import { SectionPlanesPlugin } from "https://unpkg.com/@xeokit/xeokit-sdk@2.6.75/dist/xeokit-sdk.es.js";
import { SectionToolContextMenu } from "./SectionToolContextMenu.js";

/**
 * Section Tool - Creates cross-section planes by clicking on objects
 * This is the most complex Level 5 tool
 */
export class SectionTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._menuButtonElement = cfg.menuButtonElement;
        this._counterElement = cfg.counterElement;

        // Initialize SectionPlanesPlugin
        this._sectionPlanesPlugin = new SectionPlanesPlugin(this.viewer, {});

        // Initialize context menu
        this._contextMenu = new SectionToolContextMenu({
            sectionPlanesPlugin: this._sectionPlanesPlugin
        });

        // Track active state
        this._active = cfg.active || false;
        
        this._initEvents();
        this._initSectionMode();
        
        console.log("SectionTool initialized");
    }

    _initEvents() {
        // Main button click handler
        this._buttonElement.addEventListener("click", (e) => {
            if (!this.getEnabled()) {
                return;
            }

            // Toggle active state
            const active = this.getActive();
            this.setActive(!active);
            e.preventDefault();
        });

        // Menu button click handler
        if (this._menuButtonElement) {
            console.log("SectionTool: Menu button element found, adding click listener");
            this._menuButtonElement.addEventListener("click", (e) => {
                console.log("SectionTool: Menu button clicked, enabled:", this.getEnabled());
                console.log("SectionTool: Menu button element:", this._menuButtonElement);

                // Prevent event from bubbling up and triggering document click handler
                e.preventDefault();
                e.stopPropagation();

                if (!this.getEnabled()) {
                    console.log("SectionTool: Menu button disabled, ignoring click");
                    console.log("SectionTool: Enabling tool...");
                    this.setEnabled(true);
                }

                // Show context menu with a small delay to avoid immediate hiding
                setTimeout(() => {
                    console.log("SectionTool: Showing context menu");
                    this._contextMenu.setContext({
                        viewer: this.viewer,
                        sectionPlanesPlugin: this._sectionPlanesPlugin
                    });
                    const rect = this._menuButtonElement.getBoundingClientRect();
                    this._contextMenu.show(rect.left, rect.bottom + 5);
                    console.log("SectionTool: Context menu shown, sections:", this.getNumSections());
                }, 10);
            });
        } else {
            console.warn("SectionTool: Menu button element not found!");
        }

        // Update button appearance based on active state
        this.on("active", (active) => {
            if (active) {
                this._buttonElement.classList.add("active");
                console.log("SectionTool: Activated - Click on objects to create section planes");
            } else {
                this._buttonElement.classList.remove("active");                
                this._sectionPlanesPlugin.hideControl();
                console.log("SectionTool: Deactivated");
            }
        });

        // Update button appearance based on enabled state
        this.on("enabled", (enabled) => {
            console.log("SectionTool: Enabled state changed:", enabled);
            if (!enabled) {
                this._buttonElement.classList.add("disabled");
                if (this._menuButtonElement) {
                    this._menuButtonElement.classList.add("disabled");
                }
                this.setActive(false);
            } else {
                this._buttonElement.classList.remove("disabled");
                if (this._menuButtonElement) {
                    this._menuButtonElement.classList.remove("disabled");
                }
            }
        });

        // Listen for section plane creation/destruction to update counter
        this.viewer.scene.on("sectionPlaneCreated", () => {
            this._updateSectionPlanesCount();
        });

        this.viewer.scene.on("sectionPlaneDestroyed", () => {
            this._updateSectionPlanesCount();
        });
    }

    _initSectionMode() {
        // Listen for mouse clicks to create section planes
        this.viewer.scene.canvas.canvas.addEventListener('mouseup', (e) => {
            if (e.which !== 1) { // Only left mouse button
                return;
            }

            if (!this.getActive() || !this.getEnabled()) {
                return;
            }

            // Get mouse coordinates relative to canvas
            const rect = this.viewer.scene.canvas.canvas.getBoundingClientRect();
            const coords = [
                e.clientX - rect.left,
                e.clientY - rect.top
            ];

            // Pick the surface at the mouse position
            const pickResult = this.viewer.scene.pick({
                canvasPos: coords,
                pickSurface: true // This finds the intersection point on the entity
            });

            if (pickResult && pickResult.entity && pickResult.entity.isObject) {
                // Only create section planes on model objects, not UI helpers
                this._createSectionPlane(pickResult);
            }
        });

        this._updateSectionPlanesCount();
    }

    _createSectionPlane(pickResult) {
        try {
            // Create section plane at picked position with inverted normal
            const sectionPlane = this._sectionPlanesPlugin.createSectionPlane({
                pos: pickResult.worldPos,
                dir: this._invertVector(pickResult.worldNormal)
            });

            // Show the interactive control for the section plane
            this._sectionPlanesPlugin.showControl(sectionPlane.id);
            
            console.log("SectionTool: Created section plane at", pickResult.worldPos);
            
        } catch (error) {
            console.error("SectionTool: Error creating section plane:", error);
        }
    }

    _invertVector(vec) {
        return [-vec[0], -vec[1], -vec[2]];
    }

    _updateSectionPlanesCount() {
        const count = this.getNumSections();
        if (this._counterElement) {
            this._counterElement.innerText = "" + count;

            // Show/hide counter based on count
            if (count > 0) {
                this._counterElement.classList.add('visible');
            } else {
                this._counterElement.classList.remove('visible');
            }
        }

        // Update button tooltip to show count
        const tooltip = count > 0 ?
            `Section Tool (${count} active)` :
            "Section Tool - Click objects to create cross-sections";
        this._buttonElement.setAttribute('data-tippy-content', tooltip);
        this._buttonElement.setAttribute('title', tooltip);
    }

    // Public API methods
    getNumSections() {
        return Object.keys(this.viewer.scene.sectionPlanes).length;
    }

    clearSections() {
        this._sectionPlanesPlugin.clear();
        this._updateSectionPlanesCount();
        console.log("SectionTool: Cleared all section planes");
    }

    flipSections() {
        this._sectionPlanesPlugin.flipSectionPlanes();
        console.log("SectionTool: Flipped all section planes");
    }

    enableSections() {
        const sectionPlanes = this.viewer.scene.sectionPlanes;
        for (let id in sectionPlanes) {
            const sectionPlane = sectionPlanes[id];
            sectionPlane.active = true;
        }
        console.log("SectionTool: Enabled all section planes");
    }

    disableSections() {
        const sectionPlanes = this.viewer.scene.sectionPlanes;
        for (let id in sectionPlanes) {
            const sectionPlane = sectionPlanes[id];
            sectionPlane.active = false;
        }
        console.log("SectionTool: Disabled all section planes");
    }

    // Additional utility methods
    hasActiveSections() {
        const sectionPlanes = this.viewer.scene.sectionPlanes;
        for (let id in sectionPlanes) {
            if (sectionPlanes[id].active) {
                return true;
            }
        }
        return false;
    }

    getActiveSectionCount() {
        const sectionPlanes = this.viewer.scene.sectionPlanes;
        let count = 0;
        for (let id in sectionPlanes) {
            if (sectionPlanes[id].active) {
                count++;
            }
        }
        return count;
    }

    // Global access methods for testing
    getSectionPlanesPlugin() {
        return this._sectionPlanesPlugin;
    }

    destroy() {
        if (this._contextMenu) {
            this._contextMenu.destroy();
        }
        if (this._sectionPlanesPlugin) {
            this._sectionPlanesPlugin.destroy();
        }
        super.destroy();
    }
}
