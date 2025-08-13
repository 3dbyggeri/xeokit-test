import { Controller } from "./Controller.js";
import { ResetAction } from "./ResetAction.js";
import { FitAction } from "./FitAction.js";
import { ThreeDMode } from "./ThreeDMode.js";
import { OrthoMode } from "./OrthoMode.js";
import { FirstPersonMode } from "./FirstPersonMode.js";
import { ShowSpacesMode } from "./ShowSpacesMode.js";
import { SelectionTool } from "./SelectionTool.js";
import { HideTool } from "./HideTool.js";

/**
 * Toolbar Manager - Coordinates all toolbar tools
 */
class Toolbar extends Controller {
    constructor(viewer, cfg = {}) {
        super(null, cfg);
        
        this.viewer = viewer;
        
        if (!cfg.toolbarElement) {
            throw "Missing config: toolbarElement";
        }

        const toolbarElement = cfg.toolbarElement;
        
        // Create toolbar HTML
        this._createToolbarHTML(toolbarElement);

        // Initialize Level 1 tools (Easiest)
        this._initializeLevel1Tools(toolbarElement);

        // Initialize Level 2 tools (Medium)
        this._initializeLevel2Tools(toolbarElement);

        // Initialize Level 3 tools (More Complex)
        this._initializeLevel3Tools(toolbarElement);

        // Enable all tools initially
        this._enableAllTools();
    }

    /**
     * Create the toolbar HTML structure
     */
    _createToolbarHTML(toolbarElement) {
        const toolbarTemplate = `
            <div class="xeokit-toolbar">
                <!-- Reset button -->
                <div class="xeokit-btn-group">
                    <button type="button" class="xeokit-reset xeokit-btn fa fa-home fa-2x"
                            data-tippy-content="Reset view" title="Reset view"></button>
                </div>

                <!-- View controls -->
                <div class="xeokit-btn-group" role="group">
                    <!-- 3D Mode button -->
                    <button type="button" class="xeokit-threeD xeokit-btn fa fa-cube fa-2x"
                            data-tippy-content="Toggle 2D/3D" title="Toggle 2D/3D"></button>
                    <!-- Perspective/Ortho Mode button -->
                    <button type="button" class="xeokit-ortho xeokit-btn fa fa-th fa-2x"
                            data-tippy-content="Toggle Perspective/Ortho" title="Toggle Perspective/Ortho"></button>
                    <!-- Fit button -->
                    <button type="button" class="xeokit-fit xeokit-btn fa fa-crop fa-2x"
                            data-tippy-content="Fit view" title="Fit view"></button>
                    <!-- First Person mode button -->
                    <button type="button" class="xeokit-firstPerson xeokit-btn fa fa-male fa-2x"
                            data-tippy-content="Toggle first-person mode" title="Toggle first-person mode"></button>
                    <!-- Show/hide IFCSpaces -->
                    <button type="button" class="xeokit-showSpaces xeokit-btn fa fa-th-large fa-2x"
                            data-tippy-content="Show/hide spaces" title="Show/hide spaces"></button>
                </div>

                <!-- Interaction tools -->
                <div class="xeokit-btn-group" role="group">
                    <!-- Selection tool -->
                    <button type="button" class="xeokit-select xeokit-btn fa fa-mouse-pointer fa-2x"
                            data-tippy-content="Select objects" title="Select objects"></button>
                    <!-- Hide tool -->
                    <button type="button" class="xeokit-hide xeokit-btn fa fa-eye-slash fa-2x"
                            data-tippy-content="Hide objects" title="Hide objects"></button>
                    <!-- Show all button -->
                    <button type="button" class="xeokit-showAll xeokit-btn fa fa-eye fa-2x"
                            data-tippy-content="Show all objects" title="Show all objects"></button>
                </div>
            </div>
        `;

        toolbarElement.innerHTML = toolbarTemplate;
    }

    /**
     * Initialize Level 1 tools (Reset and Fit)
     */
    _initializeLevel1Tools(toolbarElement) {
        // Reset Action
        this.resetAction = new ResetAction(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-reset")
        });

        // Fit Action
        this.fitAction = new FitAction(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-fit")
        });
    }

    /**
     * Initialize Level 2 tools (View modes)
     */
    _initializeLevel2Tools(toolbarElement) {
        // 3D Mode Toggle
        this.threeDMode = new ThreeDMode(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-threeD"),
            active: true // Start in 3D mode
        });

        // Orthographic Mode Toggle
        this.orthoMode = new OrthoMode(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-ortho"),
            active: false // Start in perspective mode
        });

        // First Person Mode
        this.firstPersonMode = new FirstPersonMode(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-firstPerson"),
            active: false // Start in orbit mode
        });

        // Show Spaces Mode
        this.showSpacesMode = new ShowSpacesMode(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-showSpaces"),
            active: false // Start with spaces hidden
        });
    }

    /**
     * Initialize Level 3 tools (Interaction tools)
     */
    _initializeLevel3Tools(toolbarElement) {
        // Selection Tool
        this.selectionTool = new SelectionTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-select"),
            active: false // Start inactive
        });

        // Hide Tool
        this.hideTool = new HideTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-hide"),
            active: false // Start inactive
        });

        // Show All button
        const showAllButton = toolbarElement.querySelector(".xeokit-showAll");
        showAllButton.addEventListener("click", (event) => {
            this._showAllObjects();
            event.preventDefault();
        });

        // Set up tool interactions - only one interaction tool active at a time
        this.selectionTool.on("active", (active) => {
            if (active && this.hideTool.getActive()) {
                this.hideTool.setActive(false);
            }
        });

        this.hideTool.on("active", (active) => {
            if (active && this.selectionTool.getActive()) {
                this.selectionTool.setActive(false);
            }
        });
    }

    /**
     * Enable all tools
     */
    _enableAllTools() {
        // Level 1 tools
        this.resetAction.setEnabled(true);
        this.fitAction.setEnabled(true);

        // Level 2 tools
        this.threeDMode.setEnabled(true);
        this.orthoMode.setEnabled(true);
        this.firstPersonMode.setEnabled(true);
        this.showSpacesMode.setEnabled(true);

        // Level 3 tools
        this.selectionTool.setEnabled(true);
        this.hideTool.setEnabled(true);
    }

    /**
     * Disable all tools
     */
    _disableAllTools() {
        // Level 1 tools
        this.resetAction.setEnabled(false);
        this.fitAction.setEnabled(false);

        // Level 2 tools
        this.threeDMode.setEnabled(false);
        this.orthoMode.setEnabled(false);
        this.firstPersonMode.setEnabled(false);
        this.showSpacesMode.setEnabled(false);

        // Level 3 tools
        this.selectionTool.setEnabled(false);
        this.hideTool.setEnabled(false);
    }

    /**
     * Enable tools when model is loaded
     */
    onModelLoaded() {
        this._enableAllTools();
    }

    /**
     * Disable tools when no model is loaded
     */
    onModelUnloaded() {
        this._disableAllTools();
    }

    /**
     * Show all hidden objects
     */
    _showAllObjects() {
        const scene = this.viewer.scene;

        // Show all objects
        scene.setObjectsVisible(scene.objectIds, true);

        // Reset hide tool tracking
        if (this.hideTool) {
            this.hideTool.reset();
        }

        console.log("All objects shown");
    }

    /**
     * Destroy the toolbar
     */
    destroy() {
        // Level 1 tools
        if (this.resetAction) {
            this.resetAction.destroy();
        }
        if (this.fitAction) {
            this.fitAction.destroy();
        }

        // Level 2 tools
        if (this.threeDMode) {
            this.threeDMode.destroy();
        }
        if (this.orthoMode) {
            this.orthoMode.destroy();
        }
        if (this.firstPersonMode) {
            this.firstPersonMode.destroy();
        }
        if (this.showSpacesMode) {
            this.showSpacesMode.destroy();
        }

        // Level 3 tools
        if (this.selectionTool) {
            this.selectionTool.destroy();
        }
        if (this.hideTool) {
            this.hideTool.destroy();
        }

        super.destroy();
    }
}

export { Toolbar };
