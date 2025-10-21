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
                            <div class="glasshouse-form-group">
                                <label for="glasshouse-parameter">Match Parameter:</label>
                                <select id="glasshouse-parameter">
                                    <option value="GlassHouseJournalGUID">GlassHouseJournalGUID</option>
                                    <option value="id">Object ID</option>
                                    <option value="type">Object Type</option>
                                    <option value="name">Object Name</option>
                                    <option value="UniqueIdPara">UniqueIdPara</option>
                                </select>
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
            const parameter = dialog.querySelector('#glasshouse-parameter').value;

            this._parameterName = parameter;
            
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
            if (guids.length > 0) {
                this._selectObjectsByParameter(guids);
            }
        } catch (error) {
            console.error('Error handling SelectEntries:', error);
        }
    }

    _handleIsolateEntries(data) {
        console.log('Received IsolateEntries event:', data);

        // Show activity indicator
        this._showMessageActivity();

        try {
            const guids = this._extractGuids(data);
            if (guids.length > 0) {
                this._isolateObjectsByParameter(guids);
            }
        } catch (error) {
            console.error('Error handling IsolateEntries:', error);
        }
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
            
            console.log(`Selected ${matchingObjects.length} objects by ${this._parameterName}`);
        } else {
            console.warn(`No objects found with ${this._parameterName} values:`, parameterValues);
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
            
            console.log(`Isolated ${matchingObjects.length} objects by ${this._parameterName}`);
        } else {
            console.warn(`No objects found with ${this._parameterName} values:`, parameterValues);
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
                    objectValue = this._getMetadataProperty(object, "GlasHouseJournalGUID");
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
