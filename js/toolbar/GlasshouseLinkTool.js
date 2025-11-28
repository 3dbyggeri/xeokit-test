import { Controller } from "./Controller.js";

/**
 * Glasshouse Link Tool - Connects to Glasshouse BIM for live object selection and isolation
 * Based on the Revit Live Connection feature
 */
export class GlasshouseLinkTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._counterElement = cfg.counterElement;
        
        // Connection state
        this._connected = false;
        this._pusher = null;
        this._channel = null;
        this._apiKey = null;
        this._channelName = null;
        
        // Configuration
        this._glasshouseServer = 'app.glasshousebim.com';
        this._pusherConfig = null;
        
        // Object matching configuration
        //this._parameterName = 'GlassHouseJournalGUID'; // Default parameter to match
        this._parameterName = 'UniqueIdPara'; // Default parameter to match

        // Pagination support for multi-page messages
        this._pendingSelectObjectGuids = [];
        this._pendingIsolateObjectGuids = [];
        this._pendingSelectEntryGuids = [];
        this._pendingIsolateEntryGuids = [];
        this._pendingSelectObjectTotal = 0;
        this._pendingIsolateObjectTotal = 0;
        this._pendingSelectEntryTotal = 0;
        this._pendingIsolateEntryTotal = 0;
        this._selectObjectTimeout = null;
        this._isolateObjectTimeout = null;
        this._selectEntryTimeout = null;
        this._isolateEntryTimeout = null;
        this._paginationTimeoutMs = 30000; // 30 second timeout for waiting for all pages

        this._initEvents();
        this._loadPusherConfig();
        this._updateStatusDot(); // Initialize status dot

        console.log("GlasshouseLinkTool initialized");
    }

    _initEvents() {
        // Main button click handler
        this._buttonElement.addEventListener("click", (e) => {
            if (!this.getEnabled()) {
                return;
            }

            if (this._connected) {
                this._disconnect();
            } else {
                this._showLoginDialog();
            }
            e.preventDefault();
        });

        // Update button appearance based on connection state
        this.on("connected", (connected) => {
            if (connected) {
                this._buttonElement.classList.add("connected");
                this._buttonElement.setAttribute('data-tippy-content', 'Glasshouse Link - Connected (click to disconnect)');
                this._buttonElement.setAttribute('title', 'Glasshouse Link - Connected');
                console.log("GlasshouseLinkTool: Connected to Glasshouse");
            } else {
                this._buttonElement.classList.remove("connected", "active");
                this._buttonElement.setAttribute('data-tippy-content', 'Glasshouse Link - Click to connect');
                this._buttonElement.setAttribute('title', 'Glasshouse Link');
                console.log("GlasshouseLinkTool: Disconnected from Glasshouse");
            }
            this._updateStatusDot();
        });

        // Update button appearance based on enabled state
        this.on("enabled", (enabled) => {
            if (!enabled) {
                this._buttonElement.classList.add("disabled");
                this.setActive(false);
            } else {
                this._buttonElement.classList.remove("disabled");
            }
        });
    }

    async _loadPusherConfig() {
        try {
            const response = await fetch('/api/glasshouse/config');
            this._pusherConfig = await response.json();
            console.log("Pusher config loaded");
        } catch (error) {
            console.error("Failed to load Pusher config:", error);
        }
    }

    _showLoginDialog() {
        // Create login dialog
        const dialog = document.createElement('div');
        dialog.className = 'glasshouse-login-dialog';
        dialog.innerHTML = `
            <div class="glasshouse-login-overlay">
                <div class="glasshouse-login-modal">
                    <div class="glasshouse-login-header">
                        <h3>Connect to Glasshouse BIM</h3>
                        <button class="glasshouse-login-close">&times;</button>
                    </div>
                    <div class="glasshouse-login-content">
                        <form class="glasshouse-login-form">
                            <div class="glasshouse-form-group">
                                <label for="glasshouse-email">Email:</label>
                                <input type="email" id="glasshouse-email" required placeholder="user@email.com">
                            </div>
                            <div class="glasshouse-form-group">
                                <label for="glasshouse-password">Password:</label>
                                <input type="password" id="glasshouse-password" required placeholder="Enter password">
                            </div>
                            <div class="glasshouse-form-group">
                                <label for="glasshouse-server">Server:</label>
                                <input type="text" id="glasshouse-server" value="app.glasshousebim.com" placeholder="app.glasshousebim.com">
                            </div>

                            <div class="glasshouse-form-actions">
                                <button type="button" class="glasshouse-btn-cancel">Cancel</button>
                                <button type="submit" class="glasshouse-btn-connect">Connect</button>
                            </div>
                        </form>
                        <div class="glasshouse-login-status" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        const closeBtn = dialog.querySelector('.glasshouse-login-close');
        const cancelBtn = dialog.querySelector('.glasshouse-btn-cancel');
        const form = dialog.querySelector('.glasshouse-login-form');
        const statusDiv = dialog.querySelector('.glasshouse-login-status');

        const closeDialog = () => {
            document.body.removeChild(dialog);
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = dialog.querySelector('#glasshouse-email').value;
            const password = dialog.querySelector('#glasshouse-password').value;
            const server = dialog.querySelector('#glasshouse-server').value;
            
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = 'Connecting...';
            statusDiv.className = 'glasshouse-login-status glasshouse-status-info';

            try {
                await this._authenticate(email, password, server);
                statusDiv.innerHTML = 'Connected successfully!';
                statusDiv.className = 'glasshouse-login-status glasshouse-status-success';
                
                setTimeout(() => {
                    closeDialog();
                }, 1000);
            } catch (error) {
                statusDiv.innerHTML = `Connection failed: ${error.message}`;
                statusDiv.className = 'glasshouse-login-status glasshouse-status-error';
            }
        });
    }

    async _authenticate(email, password, server) {
        try {
            // Step 1: Login to Glasshouse
            const loginResponse = await fetch('/api/glasshouse/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, server })
            });

            if (!loginResponse.ok) {
                throw new Error('Authentication failed');
            }

            const loginData = await loginResponse.json();
            this._apiKey = loginData.apiKey;
            this._glasshouseServer = server;

            // Step 2: Get user info and channel name
            const userInfoResponse = await fetch(`/api/glasshouse/user-info?apiKey=${encodeURIComponent(this._apiKey)}&server=${encodeURIComponent(server)}`);
            
            if (!userInfoResponse.ok) {
                throw new Error('Failed to get user info');
            }

            const userInfoData = await userInfoResponse.json();
            this._channelName = userInfoData.channelName;

            if (!this._channelName) {
                throw new Error('No Pusher channel found for user');
            }

            // Step 3: Connect to Pusher
            await this._connectToPusher();
            
            this._connected = true;
            this.fire("connected", true);

        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async _connectToPusher() {
        if (!this._pusherConfig) {
            throw new Error('Pusher configuration not loaded');
        }

        // Load Pusher library if not already loaded
        if (typeof Pusher === 'undefined') {
            await this._loadPusherLibrary();
        }

        // Initialize Pusher
        this._pusher = new Pusher(this._pusherConfig.pusherKey, {
            cluster: this._pusherConfig.pusherCluster
        });

        // Handle connection errors
        this._pusher.connection.bind('error', (error) => {
            console.error('Pusher connection error:', error);
        });

        // Subscribe to channel
        this._channel = this._pusher.subscribe(this._channelName);
        
        // Bind to events
        this._channel.bind('SelectEntries', (data) => {
            this._handleSelectEntries(data);
        });        

        this._channel.bind('IsolateEntries', (data) => {
            this._handleIsolateEntries(data);
        });        

        this._channel.bind('IsolateObjects', (data) => {
            this._handleIsolateObjects(data);
        });
        
        this._channel.bind('SelectObjects', (data) => {
            this._handleSelectObjects(data);
        });
        console.log(`Subscribed to Pusher channel: ${this._channelName}`);
    }

    async _loadPusherLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.pusher.com/8.2.0/pusher.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    _handleSelectEntries(data) {
        console.log('Received SelectEntries event:', data);

        // Show activity indicator
        this._showMessageActivity();

        try {
            const guids = this._extractGuids(data);
            const messageNo = data.message_no || 1;
            const totalMessages = data.total_messages || 1;

            console.log(`SelectEntries: page ${messageNo} of ${totalMessages}, received ${guids.length} guids`);

            // If single message (no pagination), execute immediately
            if (totalMessages === 1) {
                if (guids.length > 0) {
                    const originalParameterName = this._parameterName;
                    this._parameterName = 'GlassHouseJournalGUID';
                    this._selectObjectsByParameter(guids);
                    this._parameterName = originalParameterName;
                } else {
                    console.warn('No objects found to select');
                }
                return;
            }

            // Multi-page message handling
            if (messageNo === 1) {
                // First page - reset accumulator and start timeout
                this._pendingSelectEntryGuids = [];
                this._pendingSelectEntryTotal = totalMessages;

                if (this._selectEntryTimeout) {
                    clearTimeout(this._selectEntryTimeout);
                }

                this._selectEntryTimeout = setTimeout(() => {
                    console.warn('SelectEntries pagination timeout - executing with partial data');
                    this._executeSelectEntries();
                }, this._paginationTimeoutMs);
            }

            // Accumulate GUIDs from this page
            this._pendingSelectEntryGuids.push(...guids);
            console.log(`SelectEntries: accumulated ${this._pendingSelectEntryGuids.length} guids so far`);

            // Check if this is the last page
            if (messageNo === totalMessages) {
                console.log(`SelectEntries: received all ${totalMessages} pages, executing...`);
                if (this._selectEntryTimeout) {
                    clearTimeout(this._selectEntryTimeout);
                    this._selectEntryTimeout = null;
                }
                this._executeSelectEntries();
            }
        } catch (error) {
            console.error('Error handling SelectEntries:', error);
        }
    }

    _executeSelectEntries() {
        const guids = this._pendingSelectEntryGuids;
        this._pendingSelectEntryGuids = [];
        this._pendingSelectEntryTotal = 0;

        if (guids.length > 0) {
            const originalParameterName = this._parameterName;
            this._parameterName = 'GlassHouseJournalGUID';
            this._selectObjectsByParameter(guids);
            this._parameterName = originalParameterName;
        } else {
            console.warn('No objects found to select');
        }
    }

    _handleIsolateEntries(data) {
        console.log('Received IsolateEntries event:', data);

        // Show activity indicator
        this._showMessageActivity();

        try {
            const guids = this._extractGuids(data);
            const messageNo = data.message_no || 1;
            const totalMessages = data.total_messages || 1;

            console.log(`IsolateEntries: page ${messageNo} of ${totalMessages}, received ${guids.length} guids`);

            // If single message (no pagination), execute immediately
            if (totalMessages === 1) {
                if (guids.length > 0) {
                    const originalParameterName = this._parameterName;
                    this._parameterName = 'GlassHouseJournalGUID';
                    this._isolateObjectsByParameter(guids);
                    this._parameterName = originalParameterName;
                } else {
                    console.warn('No objects found to isolate');
                }
                return;
            }

            // Multi-page message handling
            if (messageNo === 1) {
                // First page - reset accumulator and start timeout
                this._pendingIsolateEntryGuids = [];
                this._pendingIsolateEntryTotal = totalMessages;

                if (this._isolateEntryTimeout) {
                    clearTimeout(this._isolateEntryTimeout);
                }

                this._isolateEntryTimeout = setTimeout(() => {
                    console.warn('IsolateEntries pagination timeout - executing with partial data');
                    this._executeIsolateEntries();
                }, this._paginationTimeoutMs);
            }

            // Accumulate GUIDs from this page
            this._pendingIsolateEntryGuids.push(...guids);
            console.log(`IsolateEntries: accumulated ${this._pendingIsolateEntryGuids.length} guids so far`);

            // Check if this is the last page
            if (messageNo === totalMessages) {
                console.log(`IsolateEntries: received all ${totalMessages} pages, executing...`);
                if (this._isolateEntryTimeout) {
                    clearTimeout(this._isolateEntryTimeout);
                    this._isolateEntryTimeout = null;
                }
                this._executeIsolateEntries();
            }
        } catch (error) {
            console.error('Error handling IsolateEntries:', error);
        }
    }

    _executeIsolateEntries() {
        const guids = this._pendingIsolateEntryGuids;
        this._pendingIsolateEntryGuids = [];
        this._pendingIsolateEntryTotal = 0;

        if (guids.length > 0) {
            const originalParameterName = this._parameterName;
            this._parameterName = 'GlassHouseJournalGUID';
            this._isolateObjectsByParameter(guids);
            this._parameterName = originalParameterName;
        } else {
            console.warn('No objects found to isolate');
        }
    }

    _handleSelectObjects(data) {
        console.log('Received SelectObjects event:', data);

        // Show activity indicator
        this._showMessageActivity();

        try {
            const guids = this._extracObjectGuids(data);
            const messageNo = data.message_no || 1;
            const totalMessages = data.total_messages || 1;

            console.log(`SelectObjects: page ${messageNo} of ${totalMessages}, received ${guids.length} guids`);

            // If single message (no pagination), execute immediately
            if (totalMessages === 1) {
                if (guids.length > 0) {
                    const originalParameterName = this._parameterName;
                    this._parameterName = 'UniqueIdPara';
                    this._selectObjectsByParameter(guids);
                    this._parameterName = originalParameterName;
                } else {
                    console.warn('No objects found to select');
                }
                return;
            }

            // Multi-page message handling
            if (messageNo === 1) {
                // First page - reset accumulator and start timeout
                this._pendingSelectObjectGuids = [];
                this._pendingSelectObjectTotal = totalMessages;

                if (this._selectObjectTimeout) {
                    clearTimeout(this._selectObjectTimeout);
                }

                this._selectObjectTimeout = setTimeout(() => {
                    console.warn('SelectObjects pagination timeout - executing with partial data');
                    this._executeSelectObjects();
                }, this._paginationTimeoutMs);
            }

            // Accumulate GUIDs from this page
            this._pendingSelectObjectGuids.push(...guids);
            console.log(`SelectObjects: accumulated ${this._pendingSelectObjectGuids.length} guids so far`);

            // Check if this is the last page
            if (messageNo === totalMessages) {
                console.log(`SelectObjects: received all ${totalMessages} pages, executing...`);
                if (this._selectObjectTimeout) {
                    clearTimeout(this._selectObjectTimeout);
                    this._selectObjectTimeout = null;
                }
                this._executeSelectObjects();
            }
        } catch (error) {
            console.error('Error handling SelectObjects:', error);
        }
    }

    _executeSelectObjects() {
        const guids = this._pendingSelectObjectGuids;
        this._pendingSelectObjectGuids = [];
        this._pendingSelectObjectTotal = 0;

        if (guids.length > 0) {
            const originalParameterName = this._parameterName;
            this._parameterName = 'UniqueIdPara';
            this._selectObjectsByParameter(guids);
            this._parameterName = originalParameterName;
        } else {
            console.warn('No objects found to select');
        }
    }

    _handleIsolateObjects(data) {
        console.log('Received IsolateObjects event:', data);

        // Show activity indicator
        this._showMessageActivity();

        try {
            const guids = this._extracObjectGuids(data);
            const messageNo = data.message_no || 1;
            const totalMessages = data.total_messages || 1;

            console.log(`IsolateObjects: page ${messageNo} of ${totalMessages}, received ${guids.length} guids`);

            // If single message (no pagination), execute immediately
            if (totalMessages === 1) {
                if (guids.length > 0) {
                    const originalParameterName = this._parameterName;
                    this._parameterName = 'UniqueIdPara';
                    this._isolateObjectsByParameter(guids);
                    this._parameterName = originalParameterName;
                } else {
                    console.warn('No objects found to isolate');
                }
                return;
            }

            // Multi-page message handling
            if (messageNo === 1) {
                // First page - reset accumulator and start timeout
                this._pendingIsolateObjectGuids = [];
                this._pendingIsolateObjectTotal = totalMessages;

                if (this._isolateObjectTimeout) {
                    clearTimeout(this._isolateObjectTimeout);
                }

                this._isolateObjectTimeout = setTimeout(() => {
                    console.warn('IsolateObjects pagination timeout - executing with partial data');
                    this._executeIsolateObjects();
                }, this._paginationTimeoutMs);
            }

            // Accumulate GUIDs from this page
            this._pendingIsolateObjectGuids.push(...guids);
            console.log(`IsolateObjects: accumulated ${this._pendingIsolateObjectGuids.length} guids so far`);

            // Check if this is the last page
            if (messageNo === totalMessages) {
                console.log(`IsolateObjects: received all ${totalMessages} pages, executing...`);
                if (this._isolateObjectTimeout) {
                    clearTimeout(this._isolateObjectTimeout);
                    this._isolateObjectTimeout = null;
                }
                this._executeIsolateObjects();
            }
        } catch (error) {
            console.error('Error handling IsolateObjects:', error);
        }
    }

    _executeIsolateObjects() {
        const guids = this._pendingIsolateObjectGuids;
        this._pendingIsolateObjectGuids = [];
        this._pendingIsolateObjectTotal = 0;

        if (guids.length > 0) {
            const originalParameterName = this._parameterName;
            this._parameterName = 'UniqueIdPara';
            this._isolateObjectsByParameter(guids);
            this._parameterName = originalParameterName;
        } else {
            console.warn('No objects found to isolate');
        }
    }

    _extracObjectGuids(data) {
        // Extract GUIDs from the Pusher event data
        // This should match the format used in the Revit plugin
        const guids = [];
        
        if (data && data.object_guids) {
            try {
                    if (data.object_guids && Array.isArray(data.object_guids)) {
                        guids.push(...data.object_guids);
                    }
            } catch (error) {
                console.error('Error parsing event data:', error);
            }
        }
        
        return guids;
    }


    _extractGuids(data) {
        // Extract GUIDs from the Pusher event data
        // This should match the format used in the Revit plugin
        const guids = [];
        
        if (data && data.entry_guids) {
            try {
                    if (data.entry_guids && Array.isArray(data.entry_guids)) {
                        guids.push(...data.entry_guids);
                    }
            } catch (error) {
                console.error('Error parsing event data:', error);
            }
        }
        
        return guids;
    }

    _selectObjectsByParameter(parameterValues) {
        const matchingObjects = this._findObjectsByParameter(parameterValues);
        
        if (matchingObjects.length > 0) {
            // Clear current selection
            this.viewer.scene.setObjectsSelected(this.viewer.scene.selectedObjectIds, false);
            
            // Select matching objects
            this.viewer.scene.setObjectsSelected(matchingObjects, true);
            this.viewer.scene.setObjectsHighlighted(matchingObjects, true);
            
            // Update metadata panel to show properties for selected objects
            // Show metadata for the first selected object (or all if single selection)
            if (matchingObjects.length === 1) {
                const objectId = matchingObjects[0];
                const entity = this.viewer.scene.objects[objectId];
                if (entity) {
                    this._showMetadataForObject(entity);
                }
            } else if (matchingObjects.length > 1) {
                // For multiple objects, show metadata for the first one
                const objectId = matchingObjects[0];
                const entity = this.viewer.scene.objects[objectId];
                if (entity) {
                    this._showMetadataForObject(entity);
                }
            }
            
            console.log(`Selected ${matchingObjects.length} objects by ${this._parameterName}`);
        } else {
            console.warn(`No objects found with ${this._parameterName} values:`, parameterValues);
            // Clear metadata when no objects are found
            this._clearMetadata();
        }
    }

    _isolateObjectsByParameter(parameterValues) {
        const matchingObjects = this._findObjectsByParameter(parameterValues);
        
        if (matchingObjects.length > 0) {
            // Hide all objects first
            const allObjectIds = Object.keys(this.viewer.scene.objects);
            this.viewer.scene.setObjectsVisible(allObjectIds, false);
            
            // Show only matching objects
            this.viewer.scene.setObjectsVisible(matchingObjects, true);
            this.viewer.scene.setObjectsSelected(matchingObjects, true);
            this.viewer.scene.setObjectsHighlighted(matchingObjects, true);
            
            // Update metadata panel to show properties for isolated objects
            // Show metadata for the first isolated object (or all if single selection)
            if (matchingObjects.length === 1) {
                const objectId = matchingObjects[0];
                const entity = this.viewer.scene.objects[objectId];
                if (entity) {
                    this._showMetadataForObject(entity);
                }
            } else if (matchingObjects.length > 1) {
                // For multiple objects, show metadata for the first one
                const objectId = matchingObjects[0];
                const entity = this.viewer.scene.objects[objectId];
                if (entity) {
                    this._showMetadataForObject(entity);
                }
            }
            
            console.log(`Isolated ${matchingObjects.length} objects by ${this._parameterName}`);
        } else {
            console.warn(`No objects found with ${this._parameterName} values:`, parameterValues);
            // Clear metadata when no objects are found
            this._clearMetadata();
        }
    }

    _findObjectsByParameter(parameterValues) {
        const matchingObjects = [];
        const scene = this.viewer.scene;
        
        // Search through all objects in the scene
        for (const objectId in scene.objects) {
            const object = scene.objects[objectId];
            
            // Check if object has the parameter we're looking for
            let objectValue = null;

            switch (this._parameterName) {
                case 'GlassHouseJournalGUID':
                    // handle GlassHouseJournalGUID vs GlasHouseJournalGUID
                    objectValue = this._getMetadataProperty(object, "GlassHouseJournalGUID");
                    if (!objectValue)
                    {
                        objectValue = this._getMetadataProperty(object, "GlasHouseJournalGUID");
                    }

                    break;
                case 'id':
                    objectValue = object.id;
                    break;
                case 'type':
                    objectValue = object.type;
                    break;
                case 'name':
                    objectValue = object.name;
                    break;
                default:
                    // Custom parameter - look in metadata
                    objectValue = this._getMetadataProperty(object, this._parameterName);
                    break;
            }
            
            // Check if this object's parameter value matches any of the target values
            if (objectValue && parameterValues.includes(objectValue.toString())) {
                matchingObjects.push(objectId);
            }
        }
        
        return matchingObjects;
    }

    _getMetadataProperty(object, propertyName) {
        // Extract elementId from objectId (e.g., Surface[105545] => 105545)
        const match = object.id.match(/\[(\d+)\]/);
        const elementId = match ? match[1] : null;

        if (!elementId) {
            console.warn('Could not extract element ID from object ID:', object.id);
            return null;
        }

        // Check if metadata is loaded
        if (!window.modelProperties || !window.modelProperties[elementId]) {
            console.warn('No metadata found for element ID:', elementId);
            return null;
        }

        const props = window.modelProperties[elementId];

        // First try direct property name match
        if (props[propertyName] !== undefined) {
            //console.log(`Found property '${propertyName}' = '${props[propertyName]}' for element ${elementId}`);
            return props[propertyName];
        }

        // If not found, try to find by legend name (reverse lookup)
        if (window.modelLegend) {
            for (const [key, legendInfo] of Object.entries(window.modelLegend)) {
                if (legendInfo.Name === propertyName && props[key] !== undefined) {
                    //console.log(`Found property '${propertyName}' via legend key '${key}' = '${props[key]}' for element ${elementId}`);
                    return props[key];
                }
            }
        }

        // Property not found
        console.warn(`Property '${propertyName}' not found for element ID: ${elementId}`);
        return null;
    }

    /**
     * Show metadata for a selected object
     */
    _showMetadataForObject(entity) {
        // Expand metadata window if collapsed
        const metadataBox = document.getElementById('metadataBox');
        if (metadataBox && metadataBox.classList.contains('collapsed')) {
            metadataBox.classList.remove('collapsed');
        }

        // Access global variables from viewer.js
        if (typeof window.modelProperties === 'undefined' || typeof window.modelLegend === 'undefined') {
            console.log('Model properties or legend not available');
            this._showBasicMetadata(entity);
            return;
        }

        const metadataTable = document.querySelector('#metadataTable tbody');
        if (!metadataTable) {
            console.warn('Metadata table not found');
            return;
        }
        metadataTable.innerHTML = '';

        // Extract elementId from entity.id (e.g., Surface[105545] => 105545)
        const match = entity.id.match(/\[(\d+)\]/);
        const elementId = match ? match[1] : null;

        if (elementId && window.modelProperties[elementId]) {
            const props = window.modelProperties[elementId];
            console.log('Showing metadata for selected object:', entity.id);

            // Map property indices to names using legend
            Object.entries(props).forEach(([key, value]) => {
                let propName = key;
                if (window.modelLegend[key] && window.modelLegend[key].Name) {
                    propName = window.modelLegend[key].Name;
                }
                let displayValue;
                if (value !== null && typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                } else {
                    displayValue = value;
                }
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${propName}</td>
                    <td>${displayValue}</td>
                `;
                metadataTable.appendChild(row);
            });
        } else {
            this._showBasicMetadata(entity);
        }
    }

    /**
     * Show basic metadata when detailed properties aren't available
     */
    _showBasicMetadata(entity) {
        const metadataTable = document.querySelector('#metadataTable tbody');
        if (!metadataTable) {
            console.warn('Metadata table not found');
            return;
        }
        metadataTable.innerHTML = '';

        const idRow = document.createElement('tr');
        idRow.innerHTML = `
            <td>ID</td>
            <td>${entity.id}</td>
        `;
        metadataTable.appendChild(idRow);
    }

    /**
     * Clear metadata display
     */
    _clearMetadata() {
        const metadataTable = document.querySelector('#metadataTable tbody');
        if (metadataTable) {
            metadataTable.innerHTML = '';
            console.log('Metadata cleared');
        }
    }

    _disconnect() {
        if (this._channel) {
            this._channel.unbind_all();
            this._pusher.unsubscribe(this._channelName);
        }
        
        if (this._pusher) {
            this._pusher.disconnect();
        }
        
        this._connected = false;
        this._pusher = null;
        this._channel = null;
        this._apiKey = null;
        this._channelName = null;
        
        this.fire("connected", false);
    }

    _updateStatusDot() {
        if (this._counterElement) {
            // Always show the status dot
            this._counterElement.style.display = 'block';
            this._counterElement.innerText = ''; // Remove any text content

            // The CSS will handle the color based on connected/active classes
            console.log(`Status dot updated - Connected: ${this._connected}, Active: ${this._buttonElement.classList.contains('active')}`);
        }
    }

    // Method to temporarily show active state when receiving messages
    _showMessageActivity() {
        if (this._connected) {
            this._buttonElement.classList.add('active');

            // Remove active class after animation duration
            setTimeout(() => {
                this._buttonElement.classList.remove('active');
            }, 3000); // 3 seconds of blinking
        }
    }

    // Public API methods
    isConnected() {
        return this._connected;
    }

    getParameterName() {
        return this._parameterName;
    }

    setParameterName(parameterName) {
        this._parameterName = parameterName;
        console.log(`Parameter name changed to: ${parameterName}`);
    }

    // Test method to simulate receiving messages
    testSelectEntries(guids) {
        if (!Array.isArray(guids)) {
            guids = [guids];
        }
        
        const mockData = {
            data: JSON.stringify({ guids: guids })
        };
        
        this._handleSelectEntries(mockData);
    }

    testIsolateEntries(guids) {
        if (!Array.isArray(guids)) {
            guids = [guids];
        }
        
        const mockData = {
            data: JSON.stringify({ guids: guids })
        };
        
        this._handleIsolateEntries(mockData);
    }

    destroy() {
        this._disconnect();
        super.destroy();
    }
}
