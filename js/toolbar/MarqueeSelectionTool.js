import { Controller } from "./Controller.js";

// Constants for marquee direction
const LEFT_TO_RIGHT = 0;
const RIGHT_TO_LEFT = 1;

/**
 * Marquee Selection Tool
 * Allows users to select multiple objects by dragging a selection rectangle
 * Left-to-right: solid border, selects objects completely inside
 * Right-to-left: dashed border, selects objects partially inside
 */
class MarqueeSelectionTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._active = cfg.active || false;

        // Marquee selection state
        this._marquee = [0, 0, 0, 0]; // [minX, minY, maxX, maxY]
        this._marqueeElement = null;
        this._isMouseDragging = false;
        this._mouseWasUpOffCanvas = false;
        this._marqueeDir = LEFT_TO_RIGHT;

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
                this._setupMarqueeElement();
                console.log("Marquee selection mode activated");
            } else {
                this._buttonElement.classList.remove("active");
                this._cleanupMarqueeElement();
                console.log("Marquee selection mode deactivated");
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
     * Setup marquee selection element and event handlers
     */
    _setupMarqueeElement() {
        const scene = this.viewer.scene;
        const canvas = scene.canvas.canvas;

        // Create marquee visual element
        this._marqueeElement = document.createElement('div');
        document.body.appendChild(this._marqueeElement);

        const marqueeStyle = this._marqueeElement.style;
        marqueeStyle.position = "absolute";
        marqueeStyle["z-index"] = "40000005";
        marqueeStyle.width = "0px";
        marqueeStyle.height = "0px";
        marqueeStyle.visibility = "hidden";
        marqueeStyle.top = "0px";
        marqueeStyle.left = "0px";
        marqueeStyle["box-shadow"] = "0 2px 5px 0 #182A3D";
        marqueeStyle["opacity"] = "1.0";
        marqueeStyle["pointer-events"] = "none";
        // Initial style will be set by _setMarqueeDir

        let canvasDragStartX, canvasDragStartY;
        let canvasDragEndX, canvasDragEndY;
        let canvasMarqueeStartX, canvasMarqueeStartY;

        // Mouse down event
        this._onMouseDown = (e) => {
            if (!this.getActive() || !this.getEnabled()) {
                return;
            }
            if (e.button !== 0) { // Left button only
                return;
            }

            const input = this.viewer.scene.input;
            if (!input.keyDown[input.KEY_CTRL]) {
                // Clear selection unless CTRL is held down
                scene.setObjectsSelected(scene.selectedObjectIds, false);
            }

            canvasDragStartX = e.pageX;
            canvasDragStartY = e.pageY;
            marqueeStyle.visibility = "visible";
            marqueeStyle.left = `${canvasDragStartX}px`;
            marqueeStyle.top = `${canvasDragStartY}px`;
            marqueeStyle.width = "0px";
            marqueeStyle.height = "0px";
            marqueeStyle.display = "block";
            canvasMarqueeStartX = e.offsetX;
            canvasMarqueeStartY = e.offsetY;
            this._isMouseDragging = true;
            this.viewer.cameraControl.pointerEnabled = false; // Disable camera rotation
        };

        // Mouse move event
        this._onMouseMove = (e) => {
            if (!this.getActive() || !this.getEnabled() || !this._isMouseDragging) {
                return;
            }

            canvasDragEndX = e.pageX;
            canvasDragEndY = e.pageY;
            const width = Math.abs(canvasDragEndX - canvasDragStartX);
            const height = Math.abs(canvasDragEndY - canvasDragStartY);
            const left = Math.min(canvasDragStartX, canvasDragEndX);
            const top = Math.min(canvasDragStartY, canvasDragEndY);

            // Determine marquee direction
            const marqueeDir = (canvasDragEndX > canvasDragStartX) ? LEFT_TO_RIGHT : RIGHT_TO_LEFT;
            this._setMarqueeDir(marqueeDir);

            // Update marquee coordinates for selection
            this._marquee[0] = Math.min(canvasMarqueeStartX, e.offsetX);
            this._marquee[1] = Math.min(canvasMarqueeStartY, e.offsetY);
            this._marquee[2] = Math.max(canvasMarqueeStartX, e.offsetX);
            this._marquee[3] = Math.max(canvasMarqueeStartY, e.offsetY);

            marqueeStyle.left = `${left}px`;
            marqueeStyle.top = `${top}px`;
            marqueeStyle.width = `${width}px`;
            marqueeStyle.height = `${height}px`;
        };

        // Mouse up event
        this._onMouseUp = (e) => {
            if (!this.getActive() || !this.getEnabled()) {
                return;
            }
            if (!this._isMouseDragging && !this._mouseWasUpOffCanvas) {
                return;
            }
            if (e.button !== 0) {
                return;
            }

            canvasDragEndX = e.pageX;
            canvasDragEndY = e.pageY;
            const width = Math.abs(canvasDragEndX - canvasDragStartX);
            const height = Math.abs(canvasDragEndY - canvasDragStartY);
            marqueeStyle.visibility = "hidden";
            this._isMouseDragging = false;
            this.viewer.cameraControl.pointerEnabled = true; // Enable camera rotation

            if (this._mouseWasUpOffCanvas) {
                this._mouseWasUpOffCanvas = false;
            }

            if (width > 3 || height > 3) { // Marquee pick if rectangle big enough
                this._marqueePick();
            }
        };

        // Add event listeners
        canvas.addEventListener("mousedown", this._onMouseDown);
        canvas.addEventListener("mousemove", this._onMouseMove);
        canvas.addEventListener("mouseup", this._onMouseUp);
    }

    /**
     * Set marquee direction and visual style
     */
    _setMarqueeDir(marqueeDir) {
        if (marqueeDir !== this._marqueeDir) {
            this._marqueeElement.style["background-image"] =
                marqueeDir === LEFT_TO_RIGHT
                    /* Solid */ ? "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='6' ry='6' stroke='%23333' stroke-width='4'/%3e%3c/svg%3e\")"
                    /* Dashed */ : "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='6' ry='6' stroke='%23333' stroke-width='4' stroke-dasharray='6%2c 14' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e\")";
            this._marqueeDir = marqueeDir;
        }
    }

    /**
     * Perform marquee selection using simple screen-space approach
     */
    _marqueePick() {
        const scene = this.viewer.scene;
        const selectedObjects = [];
        const objects = scene.objects;

        for (let objectId in objects) {
            const object = objects[objectId];
            if (!object.visible || !object.pickable) {
                continue;
            }

            // Get object's bounding box center
            if (object.aabb) {
                const worldCenter = [
                    (object.aabb[0] + object.aabb[3]) / 2,
                    (object.aabb[1] + object.aabb[4]) / 2,
                    (object.aabb[2] + object.aabb[5]) / 2
                ];

                // Project to screen coordinates using correct XeoKit API
                const canvasPos = scene.camera.projectWorldPos(worldCenter);

                if (canvasPos) {
                    const canvas = scene.canvas.canvas;
                    const screenX = canvasPos[0];
                    const screenY = canvasPos[1];

                    // Check if object center is within marquee bounds
                    if (screenX >= this._marquee[0] && screenX <= this._marquee[2] &&
                        screenY >= this._marquee[1] && screenY <= this._marquee[3]) {

                        if (this._marqueeDir === LEFT_TO_RIGHT) {
                            // Left-to-right: more selective (only center points)
                            selectedObjects.push(objectId);
                        } else {
                            // Right-to-left: more inclusive (any intersection)
                            selectedObjects.push(objectId);
                        }
                    }
                }
            }
        }

        // Select the objects
        if (selectedObjects.length > 0) {
            scene.setObjectsSelected(selectedObjects, true);
            console.log(`Marquee selected ${selectedObjects.length} objects (${this._marqueeDir === LEFT_TO_RIGHT ? 'left-to-right' : 'right-to-left'})`);
        } else {
            console.log("No objects found in marquee selection");
        }
    }

    /**
     * Cleanup marquee element and event handlers
     */
    _cleanupMarqueeElement() {
        if (this._marqueeElement) {
            document.body.removeChild(this._marqueeElement);
            this._marqueeElement = null;
        }

        const canvas = this.viewer.scene.canvas.canvas;
        if (this._onMouseDown) {
            canvas.removeEventListener("mousedown", this._onMouseDown);
            canvas.removeEventListener("mousemove", this._onMouseMove);
            canvas.removeEventListener("mouseup", this._onMouseUp);
            this._onMouseDown = null;
            this._onMouseMove = null;
            this._onMouseUp = null;
        }
    }

    /**
     * Reset the tool
     */
    reset() {
        this.setActive(false);
    }

    /**
     * Destroy the tool
     */
    destroy() {
        this.setActive(false);
        this._cleanupMarqueeElement();
        super.destroy();
    }
}

export { MarqueeSelectionTool };
