/**
 * Context Menu Component
 */
export class ContextMenu {
    constructor(cfg = {}) {
        this.items = cfg.items || [];
        this.hideOnAction = cfg.hideOnAction !== false;
        this.parentNode = cfg.parentNode || document.body;
        
        this.menuElement = null;
        this.context = null;
        this.visible = false;
        
        this._createMenuElement();
        this._initEventHandlers();
    }

    _createMenuElement() {
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'xeokit-context-menu';
        this.menuElement.style.display = 'none';
        this.menuElement.style.position = 'fixed';
        this.menuElement.style.zIndex = '10000';
        this.parentNode.appendChild(this.menuElement);
    }

    _initEventHandlers() {
        // Hide menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.visible && !this.menuElement.contains(e.target)) {
                this.hide();
            }
        });

        // Hide menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.visible) {
                this.hide();
            }
        });
    }

    show(x, y) {
        if (!this.context) {
            console.warn('ContextMenu: No context set, cannot show menu');
            return;
        }

        console.log('ContextMenu: Building menu...');
        this._buildMenu();

        // First position to get dimensions
        this.menuElement.style.left = x + 'px';
        this.menuElement.style.top = y + 'px';
        this.menuElement.style.display = 'block';
        this.menuElement.style.visibility = 'visible';

        console.log('ContextMenu: Menu positioned at', x, y);
        console.log('ContextMenu: Menu element:', this.menuElement);
        console.log('ContextMenu: Menu items count:', this.items.length);

        // Get menu dimensions
        const rect = this.menuElement.getBoundingClientRect();
        const menuHeight = rect.height;

        // Position menu so its left-middle point is at the mouse position
        this.menuElement.style.left = x + 'px';
        this.menuElement.style.top = (y - menuHeight / 2) + 'px';

        this.visible = true;

        // Adjust position if menu goes off screen
        const newRect = this.menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (newRect.right > viewportWidth) {
            this.menuElement.style.left = (x - newRect.width) + 'px';
        }

        if (newRect.bottom > viewportHeight) {
            this.menuElement.style.top = (y - newRect.height) + 'px';
        }

        if (newRect.top < 0) {
            this.menuElement.style.top = '10px';
        }
    }

    hide() {
        this.menuElement.style.display = 'none';
        this.visible = false;
    }

    _buildMenu() {
        this.menuElement.innerHTML = '';
        
        const ul = document.createElement('ul');
        
        this.items.forEach((itemGroup, groupIndex) => {
            if (groupIndex > 0) {
                // Add separator between groups
                const separator = document.createElement('li');
                separator.className = 'separator';
                separator.style.borderTop = '1px solid #555';
                separator.style.margin = '0';
                separator.style.height = '1px';
                separator.style.padding = '0';
                separator.style.cursor = 'default';
                separator.style.pointerEvents = 'none';
                ul.appendChild(separator);
            }

            itemGroup.forEach(item => {
                const li = document.createElement('li');

                // Check if item should be shown
                if (item.getShown && !item.getShown(this.context)) {
                    return;
                }

                // Get title
                const title = typeof item.getTitle === 'function'
                    ? item.getTitle(this.context)
                    : item.title || 'Menu Item';

                li.textContent = title;

                // Check if item has submenu
                if (item.items && Array.isArray(item.items)) {
                    // This is a submenu item
                    li.classList.add('has-submenu');
                    li.innerHTML = title + ' <span class="submenu-arrow">▶</span>';

                    // Create submenu
                    const submenu = this._createSubmenu(item.items);
                    li.appendChild(submenu);

                    // Handle hover events for submenu
                    li.addEventListener('mouseenter', (e) => {
                        if (item.doHoverEnter) {
                            item.doHoverEnter(this.context);
                        }
                        submenu.style.display = 'block';
                    });

                    li.addEventListener('mouseleave', (e) => {
                        if (item.doHoverLeave) {
                            item.doHoverLeave(this.context);
                        }
                        submenu.style.display = 'none';
                    });
                } else {
                    // Regular menu item
                    // Check if item is enabled
                    const enabled = item.getEnabled ? item.getEnabled(this.context) : true;
                    if (!enabled) {
                        li.classList.add('disabled');
                    } else {
                        li.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (item.doAction) {
                                item.doAction(this.context);
                            }
                            if (this.hideOnAction) {
                                this.hide();
                            }
                        });
                    }
                }

                ul.appendChild(li);
            });
        });

        this.menuElement.appendChild(ul);
    }

    _createSubmenu(submenuItems) {
        const submenu = document.createElement('div');
        submenu.className = 'xeokit-context-submenu';
        submenu.style.display = 'none';

        const ul = document.createElement('ul');

        submenuItems.forEach((itemGroup, groupIndex) => {
            if (groupIndex > 0) {
                // Add separator between groups
                const separator = document.createElement('li');
                separator.className = 'separator';
                separator.style.borderTop = '1px solid #555';
                separator.style.margin = '0';
                separator.style.height = '1px';
                separator.style.padding = '0';
                separator.style.cursor = 'default';
                separator.style.pointerEvents = 'none';
                ul.appendChild(separator);
            }

            itemGroup.forEach(item => {
                const li = document.createElement('li');

                // Check if item should be shown
                if (item.getShown && !item.getShown(this.context)) {
                    return;
                }

                // Get title
                const title = typeof item.getTitle === 'function'
                    ? item.getTitle(this.context)
                    : item.title || 'Menu Item';

                li.textContent = title;

                // Check if item is enabled
                const enabled = item.getEnabled ? item.getEnabled(this.context) : true;
                if (!enabled) {
                    li.classList.add('disabled');
                } else {
                    li.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (item.doAction) {
                            item.doAction(this.context);
                        }
                        if (this.hideOnAction) {
                            this.hide();
                        }
                    });
                }

                ul.appendChild(li);
            });
        });

        submenu.appendChild(ul);
        return submenu;
    }

    setContext(context) {
        this.context = context;
    }
}

/**
 * Object Context Menu - shown when right-clicking on objects
 */
export class ObjectContextMenu extends ContextMenu {
    constructor(viewer, cfg = {}) {
        const items = [
            [
                {
                    getTitle: () => "Inspect Properties",
                    doAction: (context) => {
                        if (context.showProperties) {
                            context.showProperties(context.entity.id);
                        }
                    }
                },
                {
                    getTitle: () => "Show in Explorer",
                    doAction: (context) => {
                        if (context.showInExplorer) {
                            context.showInExplorer(context.entity.id);
                        }
                    }
                }
            ],
            [
                {
                    getTitle: () => "View Fit",
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const aabb = scene.getAABB([context.entity.id]);
                        context.viewer.cameraFlight.flyTo({
                            aabb: aabb,
                            duration: 0.5
                        });
                    }
                },
                {
                    getTitle: () => "View Fit Selected",
                    getEnabled: (context) => {
                        return context.viewer.scene.numSelectedObjects > 0;
                    },
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const aabb = scene.getAABB(scene.selectedObjectIds);
                        context.viewer.cameraFlight.flyTo({
                            aabb: aabb,
                            duration: 0.5
                        });
                    }
                },
                {
                    getTitle: () => "View Fit All",
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const aabb = scene.getAABB(scene.visibleObjectIds);
                        context.viewer.cameraFlight.flyTo({
                            aabb: aabb,
                            duration: 0.5
                        });
                    }
                }
            ],
            [
                {
                    getTitle: () => "Hide",
                    doAction: (context) => {
                        context.entity.visible = false;
                    }
                },
                {
                    getTitle: () => "Hide Others",
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        scene.setObjectsVisible(scene.objectIds, false);
                        context.entity.visible = true;
                    }
                },
                {
                    getTitle: () => "Hide All",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsVisible(context.viewer.scene.objectIds, false);
                    }
                },
                {
                    getTitle: () => "Show All",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsVisible(context.viewer.scene.objectIds, true);
                    }
                }
            ],
            [
                {
                    getTitle: () => "X-Ray",
                    doAction: (context) => {
                        context.entity.xrayed = true;
                        context.entity.visible = true;
                    }
                },
                {
                    getTitle: () => "X-Ray Others",
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        scene.setObjectsXRayed(scene.objectIds, true);
                        context.entity.xrayed = false;
                    }
                },
                {
                    getTitle: () => "X-Ray All",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsXRayed(context.viewer.scene.objectIds, true);
                    }
                },
                {
                    getTitle: () => "X-Ray None",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsXRayed(context.viewer.scene.xrayedObjectIds, false);
                    }
                }
            ],
            [
                {
                    getTitle: () => "Select",
                    doAction: (context) => {
                        context.entity.selected = true;
                    }
                },
                {
                    getTitle: () => "Undo Select",
                    getEnabled: (context) => {
                        return context.entity.selected;
                    },
                    doAction: (context) => {
                        context.entity.selected = false;
                        context.entity.highlighted = false;
                    }
                },
                {
                    getTitle: () => "Select None",
                    getEnabled: (context) => {
                        return context.viewer.scene.numSelectedObjects > 0;
                    },
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const selectedIds = scene.selectedObjectIds.slice();
                        const highlightedIds = scene.highlightedObjectIds.slice();

                        scene.setObjectsSelected(selectedIds, false);
                        scene.setObjectsHighlighted(highlightedIds, false);
                    }
                }
            ]
        ];

        super({ ...cfg, items });
        this.viewer = viewer;
    }
}

/**
 * Canvas Context Menu - shown when right-clicking on empty space
 */
export class CanvasContextMenu extends ContextMenu {
    constructor(viewer, cfg = {}) {
        const items = [
            [
                {
                    getTitle: () => "View Fit All",
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const aabb = scene.getAABB(scene.visibleObjectIds);
                        context.viewer.cameraFlight.flyTo({
                            aabb: aabb,
                            duration: 0.5
                        });
                    }
                },
                {
                    getTitle: () => "View Fit Selected",
                    getEnabled: (context) => {
                        return context.viewer.scene.numSelectedObjects > 0;
                    },
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const aabb = scene.getAABB(scene.selectedObjectIds);
                        context.viewer.cameraFlight.flyTo({
                            aabb: aabb,
                            duration: 0.5
                        });
                    }
                }
            ],
            [
                {
                    getTitle: () => "Hide All",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsVisible(context.viewer.scene.objectIds, false);
                    }
                },
                {
                    getTitle: () => "Show All",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsVisible(context.viewer.scene.objectIds, true);
                    }
                }
            ],
            [
                {
                    getTitle: () => "X-Ray All",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsXRayed(context.viewer.scene.objectIds, true);
                    }
                },
                {
                    getTitle: () => "X-Ray None",
                    doAction: (context) => {
                        context.viewer.scene.setObjectsXRayed(context.viewer.scene.xrayedObjectIds, false);
                    }
                }
            ],
            [
                {
                    getTitle: () => "Select None",
                    getEnabled: (context) => {
                        return context.viewer.scene.numSelectedObjects > 0;
                    },
                    doAction: (context) => {
                        const scene = context.viewer.scene;
                        const selectedIds = scene.selectedObjectIds.slice();
                        const highlightedIds = scene.highlightedObjectIds.slice();

                        scene.setObjectsSelected(selectedIds, false);
                        scene.setObjectsHighlighted(highlightedIds, false);
                    }
                }
            ],
            [
                {
                    getTitle: () => "Reset View",
                    doAction: (context) => {
                        context.viewer.cameraFlight.flyTo(context.viewer.scene.getAABB());
                    }
                }
            ]
        ];

        super({ ...cfg, items });
        this.viewer = viewer;
    }
}
