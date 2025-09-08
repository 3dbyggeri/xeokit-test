import { ContextMenu } from "../contextmenu/ContextMenu.js";

/**
 * Context Menu for Section Tool - Provides section plane management options
 * Based on the sample implementation from xeokit-bim-viewer
 */
export class SectionToolContextMenu extends ContextMenu {
    constructor(cfg = {}) {
        super(cfg);

        if (!cfg.sectionPlanesPlugin) {
            throw "Missing config: sectionPlanesPlugin";
        }

        this._sectionPlanesPlugin = cfg.sectionPlanesPlugin;
        this._viewer = this._sectionPlanesPlugin.viewer;

        // Listen for section plane events to rebuild menu
        this._onSceneSectionPlaneCreated = this._viewer.scene.on("sectionPlaneCreated", () => {
            this._buildMenu();
        });

        this._onSceneSectionPlaneDestroyed = this._viewer.scene.on("sectionPlaneDestroyed", () => {
            this._buildMenu();
        });

        this._buildMenu();
    }

    _buildMenu() {
        const sectionPlanesPlugin = this._sectionPlanesPlugin;
        const sectionPlanes = Object.values(sectionPlanesPlugin.sectionPlanes);

        const sectionPlanesMenuItems = [];

        // Create menu items for each individual section plane
        for (let i = 0, len = sectionPlanes.length; i < len; i++) {
            const sectionPlane = sectionPlanes[i];

            sectionPlanesMenuItems.push({
                getTitle: (context) => {
                    return `Slice #${i + 1}`;
                },

                doHoverEnter: (context) => {
                    sectionPlanesPlugin.hideControl();
                    sectionPlanesPlugin.showControl(sectionPlane.id);
                },

                doHoverLeave: (context) => {
                    sectionPlanesPlugin.hideControl();
                },

                items: [ // Submenu for individual slice actions
                    [
                        {
                            getTitle: (context) => {
                                return sectionPlane.active ? "Disable" : "Enable";
                            },
                            doAction: (context) => {
                                sectionPlane.active = !sectionPlane.active;
                            }
                        },
                        {
                            getTitle: (context) => "Edit",
                            getEnabled: () => sectionPlane.active,
                            doAction: (context) => {
                                sectionPlanesPlugin.hideControl();
                                sectionPlanesPlugin.showControl(sectionPlane.id);

                                // Fly camera to section plane
                                const sectionPlanePos = sectionPlane.pos;
                                const aabb = this._viewer.scene.aabb;
                                const center = [
                                    (aabb[0] + aabb[3]) / 2,
                                    (aabb[1] + aabb[4]) / 2,
                                    (aabb[2] + aabb[5]) / 2
                                ];

                                const targetAABB = [
                                    aabb[0] + sectionPlanePos[0] - center[0],
                                    aabb[1] + sectionPlanePos[1] - center[1],
                                    aabb[2] + sectionPlanePos[2] - center[2],
                                    aabb[3] + sectionPlanePos[0] - center[0],
                                    aabb[4] + sectionPlanePos[1] - center[1],
                                    aabb[5] + sectionPlanePos[2] - center[2]
                                ];

                                this._viewer.cameraFlight.flyTo({
                                    aabb: targetAABB,
                                    fitFOV: 65
                                });
                            }
                        },
                        {
                            getTitle: (context) => "Flip",
                            doAction: (context) => {
                                sectionPlane.flipDir();
                            }
                        },
                        {
                            getTitle: (context) => "Delete",
                            doAction: (context) => {
                                sectionPlanesPlugin.destroySectionPlane(sectionPlane.id);
                            }
                        }
                    ]
                ]
            });
        }

        // Set the complete menu structure
        this.items = [
            [
                {
                    getTitle: (context) => "Clear Slices",
                    getEnabled: (context) => sectionPlanes.length > 0,
                    doAction: (context) => {
                        sectionPlanesPlugin.clear();
                    }
                },
                {
                    getTitle: (context) => "Flip Slices",
                    getEnabled: (context) => sectionPlanes.length > 0,
                    doAction: (context) => {
                        sectionPlanesPlugin.flipSectionPlanes();
                    }
                }
            ],
            [
                {
                    getTitle: (context) => "Disable all Slices",
                    getEnabled: (context) => sectionPlanes.length > 0,
                    doAction: (context) => {
                        sectionPlanes.forEach(plane => plane.active = false);
                    }
                },
                {
                    getTitle: (context) => "Enable all Slices",
                    getEnabled: (context) => sectionPlanes.length > 0,
                    doAction: (context) => {
                        sectionPlanes.forEach(plane => plane.active = true);
                    }
                }
            ],
            sectionPlanesMenuItems // Individual slice items
        ];
    }

    destroy() {
        if (this._onSceneSectionPlaneCreated) {
            this._viewer.scene.off(this._onSceneSectionPlaneCreated);
        }
        if (this._onSceneSectionPlaneDestroyed) {
            this._viewer.scene.off(this._onSceneSectionPlaneDestroyed);
        }
        super.destroy();
    }
}
