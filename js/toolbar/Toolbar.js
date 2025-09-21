import { Controller } from "./Controller.js";
import { ResetAction } from "./ResetAction.js";
import { FitAction } from "./FitAction.js";
import { ThreeDMode } from "./ThreeDMode.js";
import { OrthoMode } from "./OrthoMode.js";
import { FirstPersonMode } from "./FirstPersonMode.js";
import { ShowSpacesMode } from "./ShowSpacesMode.js";
import { SelectionTool } from "./SelectionTool.js";
import { HideTool } from "./HideTool.js";
import { MarqueeSelectionTool } from "./MarqueeSelectionTool.js";
import { XRayTool } from "./XRayTool.js";
import { MeasureDistanceTool } from "./MeasureDistanceTool.js";
import { MeasureAngleTool } from "./MeasureAngleTool.js";
import { SectionTool } from "./SectionTool.js";

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

        // Initialize Level 4 tools (Advanced)
        this._initializeLevel4Tools(toolbarElement);

        // Initialize Level 5 tools (Most Complex)
        this._initializeLevel5Tools(toolbarElement);

        // Enable all tools initially
        console.log('Toolbar: Enabling all tools initially');
        this._enableAllTools();
    }

    /**
     * Create the toolbar HTML structure
     */
    _createToolbarHTML(toolbarElement) {
        const toolbarTemplate = `
            <div class="xeokit-toolbar">
                <!-- Toggle Explorer button -->
                <div class="xeokit-btn-group">
                    <button type="button" class="xeokit-toggle-explorer xeokit-btn fa fa-sitemap fa-2x"
                            data-tippy-content="Toggle Explorer" title="Toggle Explorer"></button>
                </div>

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
                    <!-- Marquee selection tool -->
                    <button type="button" class="xeokit-marquee xeokit-btn fa fa-object-group fa-2x"
                            data-tippy-content="Marquee select objects" title="Marquee select objects"></button>
                    <!-- Hide tool -->
                    <button type="button" class="xeokit-hide xeokit-btn fa fa-eye-slash fa-2x"
                            data-tippy-content="Hide objects" title="Hide objects"></button>
                    <!-- Show all button -->
                    <button type="button" class="xeokit-showAll xeokit-btn fa fa-eye fa-2x"
                            data-tippy-content="Show all objects" title="Show all objects"></button>
                    <!-- X-ray toggle tool -->
                    <button type="button" class="xeokit-xray xeokit-btn fa fa-times fa-2x"
                            data-tippy-content="Toggle X-ray mode" title="Toggle X-ray mode"></button>
                </div>

                <!-- Measurement tools -->
                <div class="xeokit-btn-group" role="group">
                    <!-- Distance measurement tool -->
                    <button type="button" class="xeokit-measure-distance xeokit-btn fa fa-ruler fa-2x"
                            data-tippy-content="Measure distance" title="Measure distance"></button>
                    <!-- Angle measurement tool -->
                    <button type="button" class="xeokit-measure-angle xeokit-btn fa fa-angle-left fa-2x"
                            data-tippy-content="Measure angle" title="Measure angle"></button>
                </div>

                <!-- Section tools -->
                <div class="xeokit-btn-group" role="group">
                    <!-- Section tool -->
                    <button type="button" class="xeokit-section xeokit-btn fa fa-cut fa-2x"
                            data-tippy-content="Section Tool - Click objects to create cross-sections" title="Section Tool">
                        <span class="xeokit-section-counter">0</span>
                    </button>
                    <!-- Section menu button -->
                    <button type="button" class="xeokit-section-menu xeokit-btn fa fa-caret-down fa-2x"
                            data-tippy-content="Section options" title="Section options"></button>
                </div>
            </div>
        `;

        toolbarElement.innerHTML = toolbarTemplate;
    }

    /**
     * Initialize Level 1 tools (Reset and Fit)
     */
    _initializeLevel1Tools(toolbarElement) {
        // Toggle Explorer button
        const toggleExplorerButton = toolbarElement.querySelector(".xeokit-toggle-explorer");
        if (toggleExplorerButton) {
            toggleExplorerButton.addEventListener("click", (event) => {
                this._toggleExplorer();
                event.preventDefault();
            });
        }

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
            active: false // Start inactive like sample
        });

        // Marquee Selection Tool
        this.marqueeSelectionTool = new MarqueeSelectionTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-marquee"),
            active: false
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

        // X-Ray Tool (dropdown)
        this.xrayTool = new XRayTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-xray")
        });

        // Note: Mutual exclusion will be set up after Level 4 tools are initialized
    }

    /**
     * Initialize Level 4 tools (Advanced measurement tools)
     */
    _initializeLevel4Tools(toolbarElement) {
        // Distance Measurement Tool
        this.measureDistanceTool = new MeasureDistanceTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-measure-distance"),
            active: false
        });

        // Angle Measurement Tool
        this.measureAngleTool = new MeasureAngleTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-measure-angle"),
            active: false
        });

        console.log("Level 4 tools (Advanced) initialized");
    }

    /**
     * Initialize Level 5 tools (Most Complex - Section Tool)
     */
    _initializeLevel5Tools(toolbarElement) {
        // Section Tool
        this.sectionTool = new SectionTool(this, {
            buttonElement: toolbarElement.querySelector(".xeokit-section"),
            menuButtonElement: toolbarElement.querySelector(".xeokit-section-menu"),
            counterElement: toolbarElement.querySelector(".xeokit-section-counter"),
            active: false
        });

        // Set up mutual exclusion for all interaction tools (including section tool)
        this._mutexActivation([
            this.selectionTool,
            this.marqueeSelectionTool,
            this.hideTool,
            this.measureDistanceTool,
            this.measureAngleTool,
            this.sectionTool
        ]);

        console.log("Level 5 tools (Most Complex) initialized");
    }

    /**
     * Enable all tools
     */
    _enableAllTools() {
        console.log('Toolbar: _enableAllTools called');
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
        this.marqueeSelectionTool.setEnabled(true);
        this.hideTool.setEnabled(true);
        this.xrayTool.setEnabled(true);

        // Level 4 tools
        this.measureDistanceTool.setEnabled(true);
        this.measureAngleTool.setEnabled(true);

        // Level 5 tools
        this.sectionTool.setEnabled(true);
    }

    /**
     * Disable all tools
     */
    _disableAllTools() {
        console.log('Toolbar: _disableAllTools called');
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
        this.marqueeSelectionTool.setEnabled(false);
        this.hideTool.setEnabled(false);
        this.xrayTool.setEnabled(false);

        // Level 4 tools
        this.measureDistanceTool.setEnabled(false);
        this.measureAngleTool.setEnabled(false);

        // Level 5 tools
        this.sectionTool.setEnabled(false);
    }

    /**
     * Set up mutual exclusion between tools (from sample)
     */
    _mutexActivation(tools) {
        for (let i = 0, len = tools.length; i < len; i++) {
            const tool = tools[i];
            if (!tool) {
                continue;
            }
            tool.on("active", (active) => {
                if (!active) {
                    return;
                }
                for (let j = 0, lenj = tools.length; j < lenj; j++) {
                    const tool2 = tools[j];
                    if (!tool2 || tool2 === tool) {
                        continue;
                    }
                    if (tool2.getActive()) {
                        tool2.setActive(false);
                    }
                }
            });
        }
    }

    /**
     * Enable tools when model is loaded
     */
    onModelLoaded() {
        this._enableAllTools();

        // Activate selection tool by default for better UX
        if (this.selectionTool && !this.selectionTool.getActive()) {
            this.selectionTool.setActive(true);
            console.log("Selection tool activated by default on model load");
        }
    }

    /**
     * Disable tools when no model is loaded
     */
    onModelUnloaded() {
        console.log('Toolbar: onModelUnloaded called, disabling all tools');
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
     * Toggle the Explorer panel visibility
     */
    _toggleExplorer() {
        const explorerPanel = document.getElementById('treeViewPanel');
        if (explorerPanel) {
            const isVisible = explorerPanel.style.display !== 'none' && explorerPanel.style.display !== '';
            explorerPanel.style.display = isVisible ? 'none' : 'block';

            // Update button state
            const toggleButton = document.querySelector('.xeokit-toggle-explorer');
            if (toggleButton) {
                if (isVisible) {
                    toggleButton.classList.remove('active');
                } else {
                    toggleButton.classList.add('active');
                }
            }

            console.log(`Explorer panel ${isVisible ? 'hidden' : 'shown'}`);
        } else {
            console.warn('TreeView panel not found');
        }
    }

    /**
     * Deactivate all interaction tools
     */
    deactivateInteractionTools() {
        if (this.selectionTool) {
            this.selectionTool.setActive(false);
        }
        if (this.hideTool) {
            this.hideTool.setActive(false);
        }
        if (this.measureDistanceTool) {
            this.measureDistanceTool.setActive(false);
        }
        if (this.measureAngleTool) {
            this.measureAngleTool.setActive(false);
        }
        console.log("All interaction tools deactivated");
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

        // Level 4 tools
        if (this.measureDistanceTool) {
            this.measureDistanceTool.destroy();
        }
        if (this.measureAngleTool) {
            this.measureAngleTool.destroy();
        }

        super.destroy();
    }
}

export { Toolbar };
