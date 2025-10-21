import { Controller } from "./Controller.js";

/**
 * Glasshouse Import Tool - Imports BIM data from Glasshouse server
 * Requires active Glasshouse Link connection
 */
export class GlasshouseImportTool extends Controller {
    constructor(parent, cfg = {}) {
        super(parent, cfg);

        if (!cfg.buttonElement) {
            throw "Missing config: buttonElement";
        }

        this._buttonElement = cfg.buttonElement;
        this._glasshouseLinkTool = cfg.glasshouseLinkTool; // Reference to GlasshouseLinkTool
        
        // Import state
        this._selectedProject = null;
        this._selectedModel = null;

        // Load global selection on initialization
        this._loadGlobalSelection();
        this._importType = 'objects'; // 'changes' or 'objects'
        
        this._initEvents();
        this._updateButtonState();
        
        console.log("GlasshouseImportTool initialized");
    }

    _initEvents() {
        // Button click handler
        this._buttonElement.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            if (!this._glasshouseLinkTool._connected) {
                alert('Please connect to Glasshouse Link first');
                return;
            }
            
            this._showImportOptions();
        });

        // Listen for connection state changes
        if (this._glasshouseLinkTool) {
            this._glasshouseLinkTool.on("connected", (connected) => {
                this._updateButtonState();
            });
        }
    }

    _updateButtonState() {
        const connected = this._glasshouseLinkTool && this._glasshouseLinkTool._connected;

        if (connected) {
            this._buttonElement.classList.remove('disabled');
        } else {
            this._buttonElement.classList.add('disabled');
        }

        // Update tooltip based on selected project/model
        this._updateTooltip();
    }

    _updateTooltip() {
        let tooltip = 'Import from Glasshouse';

        if (this._selectedProject && this._selectedModel) {
            tooltip = `Import from: ${this._selectedProject.name} / ${this._selectedModel.name}`;
        } else if (this._selectedProject) {
            tooltip = `Import from: ${this._selectedProject.name}`;
        }

        const connected = this._glasshouseLinkTool && this._glasshouseLinkTool._connected;
        if (!connected) {
            tooltip += ' (requires connection)';
        }

        this._buttonElement.setAttribute('data-tippy-content', tooltip);
        this._buttonElement.setAttribute('title', tooltip);
    }

    async _loadGlobalSelection() {
        try {
            const response = await fetch('/api/glasshouse/global-selection');
            const data = await response.json();

            if (data.success && data.selection) {
                const selection = data.selection;

                // Only load if we have valid selection data
                if (selection.projectId && selection.projectName && selection.modelId && selection.modelName) {
                    this._selectedProject = {
                        id: selection.projectId,
                        name: selection.projectName
                    };
                    this._selectedModel = {
                        id: selection.modelId,
                        name: selection.modelName
                    };

                    console.log('Loaded global selection:', this._selectedProject, this._selectedModel);
                    this._updateTooltip();

                    // Update button state since we now have a selection
                    this._updateButtonState();
                }
            }
        } catch (error) {
            console.warn('Failed to load global selection:', error);
            // Don't throw error - just continue without global selection
        }
    }

    async _saveGlobalSelection() {
        try {
            if (!this._selectedProject || !this._selectedModel) {
                console.warn('Cannot save global selection: missing project or model');
                return;
            }

            const requestBody = {
                projectId: this._selectedProject.id,
                projectName: this._selectedProject.name,
                modelId: this._selectedModel.id,
                modelName: this._selectedModel.name
            };

            const response = await fetch('/api/glasshouse/global-selection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.success) {
                console.log('Global selection saved successfully');
            } else {
                console.error('Failed to save global selection:', data.error);
            }

        } catch (error) {
            console.error('Error saving global selection:', error);
        }
    }

    _showImportOptions() {
        // Create dropdown menu for import options (matching section tool style)
        const menu = document.createElement('div');
        menu.className = 'xeokit-context-menu';
        menu.style.display = 'none';
        menu.style.position = 'fixed';
        menu.style.zIndex = '10000';
        menu.style.backgroundColor = '#2c3e50';
        menu.style.border = '1px solid #34495e';
        menu.style.borderRadius = '4px';
        menu.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        menu.style.minWidth = '180px';
        menu.style.padding = '0';
        menu.style.margin = '0';

        // Create menu list
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.margin = '0';
        ul.style.padding = '0';

        // Menu items data
        const hasProjectAndModel = this._selectedProject && this._selectedModel;
        const projectMenuTitle = hasProjectAndModel ? 'Change Project & Model' : 'Set Project & Model';
        const menuItems = [
            { action: 'set-project', title: projectMenuTitle },
            { separator: true },
            //{ action: 'import-changes', title: 'Import Project Changes', disabled: !hasProjectAndModel },
            { action: 'import-objects', title: 'Sync Entry Links with Glasshouse', disabled: !hasProjectAndModel }
        ];

        menuItems.forEach((item, index) => {
            const li = document.createElement('li');

            if (item.separator) {
                li.className = 'separator';
                li.style.borderTop = '1px solid #555';
                li.style.margin = '0';
                li.style.height = '1px';
                li.style.padding = '0';
                li.style.cursor = 'default';
                li.style.pointerEvents = 'none';
            } else {
                li.textContent = item.title;
                li.style.padding = '8px 16px';
                li.style.fontSize = '13px';
                li.style.borderBottom = index < menuItems.length - 1 && !menuItems[index + 1].separator ? '1px solid #34495e' : 'none';

                if (item.disabled) {
                    // Disabled state
                    li.style.cursor = 'not-allowed';
                    li.style.color = '#6c757d';
                    li.style.opacity = '0.5';
                } else {
                    // Enabled state
                    li.style.cursor = 'pointer';
                    li.style.color = '#ecf0f1';

                    // Hover effects
                    li.addEventListener('mouseenter', () => {
                        li.style.backgroundColor = '#3498db';
                    });

                    li.addEventListener('mouseleave', () => {
                        li.style.backgroundColor = 'transparent';
                    });

                    // Click handler
                    li.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this._handleMenuAction(item.action);
                        this._hideMenu(menu);
                    });
                }
            }

            ul.appendChild(li);
        });

        menu.appendChild(ul);

        // Position menu
        const rect = this._buttonElement.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.display = 'block';

        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !this._buttonElement.contains(e.target)) {
                this._hideMenu(menu);
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => document.addEventListener('click', closeMenu), 100);
    }

    _hideMenu(menu) {
        if (menu && menu.parentNode) {
            menu.parentNode.removeChild(menu);
        }
    }

    _handleMenuAction(action) {
        switch (action) {
            case 'set-project':
                this._showProjectSelector();
                break;
            case 'import-changes':
                this._importProjectChanges();
                break;
            case 'import-objects':
                this._importBimObjects();
                break;
        }
    }

    async _showProjectSelector() {
        try {
            // Get projects from server
            const projects = await this._getProjects();
            
            if (!projects || projects.length === 0) {
                alert('No projects found');
                return;
            }
            
            this._showProjectDialog(projects);
            
        } catch (error) {
            console.error('Error loading projects:', error);
            alert('Failed to load projects: ' + error.message);
        }
    }

    async _getProjects() {
        const response = await fetch('/api/glasshouse/projects', {
            method: 'GET',
            headers: {
                'access-token': this._glasshouseLinkTool._apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.projects;
    }

    async _getModels(projectId) {
        const response = await fetch(`/api/glasshouse/projects/${projectId}/models`, {
            method: 'GET',
            headers: {
                'access-token': this._glasshouseLinkTool._apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.models;
    }

    _showProjectDialog(projects) {
        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'xeokit-modal-backdrop';
        modal.innerHTML = `
            <div class="xeokit-modal xeokit-glasshouse-project-dialog">
                <div class="xeokit-modal-header">
                    <h3>Select Project & Model</h3>
                    <button class="xeokit-modal-close">&times;</button>
                </div>
                <div class="xeokit-modal-body">
                    <div class="form-group">
                        <label>Project:</label>
                        <select id="project-select" class="form-control">
                            <option value="">Select a project...</option>
                            ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Model:</label>
                        <select id="model-select" class="form-control" disabled>
                            <option value="">Select a project first...</option>
                        </select>
                    </div>
                </div>
                <div class="xeokit-modal-footer">
                    <button class="xeokit-button xeokit-button-cancel">Cancel</button>
                    <button class="xeokit-button xeokit-button-primary" id="select-project-btn" disabled>Select</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event handlers
        const projectSelect = modal.querySelector('#project-select');
        const modelSelect = modal.querySelector('#model-select');
        const selectBtn = modal.querySelector('#select-project-btn');
        
        projectSelect.addEventListener('change', async (e) => {
            const projectId = e.target.value;
            if (projectId) {
                try {
                    modelSelect.disabled = true;
                    modelSelect.innerHTML = '<option value="">Loading models...</option>';
                    
                    const models = await this._getModels(projectId);
                    modelSelect.innerHTML = `
                        <option value="">Select a model...</option>
                        ${models.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                    `;
                    modelSelect.disabled = false;

                    // Auto-select current model if one is already selected and matches this project
                    if (this._selectedModel && this._selectedProject && this._selectedProject.id === projectId) {
                        modelSelect.value = this._selectedModel.id;
                        this._updateSelectButton();
                    }
                } catch (error) {
                    console.error('Error loading models:', error);
                    modelSelect.innerHTML = '<option value="">Error loading models</option>';
                }
            } else {
                modelSelect.innerHTML = '<option value="">Select a project first...</option>';
                modelSelect.disabled = true;
            }
            this._updateSelectButton();
        });
        
        modelSelect.addEventListener('change', () => {
            this._updateSelectButton();
        });
        
        const updateSelectButton = () => {
            selectBtn.disabled = !projectSelect.value || !modelSelect.value;
        };
        this._updateSelectButton = updateSelectButton;
        
        // Close handlers
        modal.querySelector('.xeokit-modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.xeokit-button-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        selectBtn.addEventListener('click', () => {
            const selectedProject = projects.find(p => p.id === projectSelect.value);
            const selectedModelId = modelSelect.value;
            const selectedModelName = modelSelect.options[modelSelect.selectedIndex].text;
            
            this._selectedProject = selectedProject;
            this._selectedModel = {
                id: selectedModelId,
                name: selectedModelName
            };
            
            console.log('Selected project:', this._selectedProject);
            console.log('Selected model:', this._selectedModel);

            // Update tooltip to reflect selection
            this._updateTooltip();

            // Save global selection to server
            this._saveGlobalSelection();

            alert(`Selected: ${selectedProject.name} - ${selectedModelName}`);
            document.body.removeChild(modal);
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Auto-select current project if one is already selected (after event listeners are attached)
        if (this._selectedProject) {
            projectSelect.value = this._selectedProject.id;
            // Trigger change event to load models
            projectSelect.dispatchEvent(new Event('change'));
        }
    }

    async _importProjectChanges() {
        if (!this._selectedProject || !this._selectedModel) {
            alert('Please select a project and model first');
            return;
        }

        const progressDialog = this._showProgressDialog('Importing Project Changes');

        try {
            this._updateProgress(progressDialog, 30, 'Retrieving project changes from Glasshouse...');
            console.log('Importing project changes...');
            const xmlContent = await this._getXMLContent(false); // fromObjectLinks = false
            console.log('Project changes XML content:', xmlContent);

            this._updateProgress(progressDialog, 100, 'Import completed successfully!');

            // Close progress dialog after a short delay
            setTimeout(() => {
                this._hideProgressDialog(progressDialog);
                alert('Project changes imported successfully! Check console for XML content.');
            }, 1000);

        } catch (error) {
            console.error('Error importing project changes:', error);
            this._hideProgressDialog(progressDialog);
            alert('Failed to import project changes: ' + error.message);
        }
    }

    async _importBimObjects() {
        if (!this._selectedProject || !this._selectedModel) {
            alert('Please select a project and model first');
            return;
        }

        const progressDialog = this._showProgressDialog('Importing BIM Objects');

        try {
            // Step 1: Retrieve XML content
            this._updateProgress(progressDialog, 20, 'Retrieving data from Glasshouse...');
            console.log('Importing BIM objects...');
            const xmlContent = await this._getXMLContent(true); // fromObjectLinks = true
            console.log('BIM objects XML content:', xmlContent);

            // Step 2: Parse XML and apply to properties
            this._updateProgress(progressDialog, 60, 'Parsing XML content...');
            const importedCount = this._parseAndApplyXMLContent(xmlContent, progressDialog);

            // Step 3: Complete
            this._updateProgress(progressDialog, 100, 'Import completed successfully!');

            // Close progress dialog after a short delay
            setTimeout(() => {
                this._hideProgressDialog(progressDialog);
                alert(`BIM objects imported successfully! ${importedCount} objects updated with GlashouseJournalGUID.`);
            }, 1000);

        } catch (error) {
            console.error('Error importing BIM objects:', error);
            this._hideProgressDialog(progressDialog);
            alert('Failed to import BIM objects: ' + error.message);
        }
    }

    async _getXMLContent(fromObjectLinks = false) {
        const endpoint = fromObjectLinks ? 'bim-objects' : 'project-changes';

        // Prepare request body with endpoint-specific parameters
        let requestBody = {
            projectId: this._selectedProject.id,
            modelId: this._selectedModel.id
        };

        if (fromObjectLinks) {
            // For GetBimObjectLinks - add exclude option
            requestBody.excludeEntriesWithoutObjects = false; // Set to true to exclude entries without objects
        } else {
            // For GetProjectChanges - add optional date filters
            // Uncomment and modify these dates as needed:
            // requestBody.dateTimeFrom = '2024-01-01 00:00:00';
            // requestBody.dateTimeTo = '2024-12-31 23:59:59';
        }

        const response = await fetch(`/api/glasshouse/import/${endpoint}`, {
            method: 'POST',
            headers: {
                'access-token': this._glasshouseLinkTool._apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.xmlContent;
    }

    _parseAndApplyXMLContent(xmlContent, progressDialog = null) {
        try {
            console.log('Parsing XML content...');

            // Parse XML string
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing failed: ' + parseError.textContent);
            }

            // Extract journal entries
            const journalEntries = xmlDoc.querySelectorAll('JournalEntry');
            console.log(`Found ${journalEntries.length} journal entries`);

            let updatedCount = 0;
            let totalElements = 0;

            // First pass: count total elements for progress calculation
            journalEntries.forEach(entry => {
                const elements = entry.querySelectorAll('element');
                totalElements += elements.length;
            });

            let processedElements = 0;

            // Process each journal entry
            journalEntries.forEach(entry => {
                const glassHouseJournalGUID = entry.getAttribute('GlashouseJournalGUID');
                if (!glassHouseJournalGUID) {
                    console.warn('Journal entry missing GlashouseJournalGUID');
                    return;
                }

                // Get all element IDs for this journal entry
                const elements = entry.querySelectorAll('element');
                elements.forEach(element => {
                    const elementId = element.getAttribute('id');
                    if (elementId) {
                        // Apply the GlashouseJournalGUID to objects with matching UniqueIdPara
                        const applied = this._applyGlashouseJournalGUID(elementId, glassHouseJournalGUID);
                        if (applied) {
                            updatedCount++;
                        }
                    }

                    processedElements++;

                    // Update progress (60% to 95% range for processing)
                    if (progressDialog && totalElements > 0) {
                        const progressPercent = 60 + (processedElements / totalElements) * 35;
                        this._updateProgress(progressDialog, progressPercent,
                            `Processing elements... ${processedElements}/${totalElements} (${updatedCount} updated)`);
                    }
                });
            });

            console.log(`Successfully updated ${updatedCount} objects with GlashouseJournalGUID`);
            return updatedCount;

        } catch (error) {
            console.error('Error parsing XML content:', error);
            throw error;
        }
    }

    _applyGlashouseJournalGUID(elementId, glassHouseJournalGUID) {
        try {
            // Simplified approach: directly search window.modelProperties for matching UniqueIdPara
            if (!window.modelProperties) {
                console.warn('No model properties loaded');
                return false;
            }

            let appliedCount = 0;

            // Iterate through all elements in modelProperties to find matching UniqueIdPara
            for (const [elementKey, props] of Object.entries(window.modelProperties)) {
                const uniqueIdPara = this._getPropertyValue(props, 'UniqueIdPara');

                if (uniqueIdPara === elementId) {
                    // Found matching element, apply GlashouseJournalGUID
                    this._setPropertyValue(props, 'GlashouseJournalGUID', glassHouseJournalGUID);
                    appliedCount++;
                    console.log(`Applied GlashouseJournalGUID ${glassHouseJournalGUID} to element ${elementKey} with UniqueIdPara ${elementId}`);
                }
            }

            if (appliedCount > 0) {
                console.log(`Successfully applied GlashouseJournalGUID to ${appliedCount} elements with UniqueIdPara: ${elementId}`);
                return true;
            } else {
                console.warn(`No elements found with UniqueIdPara: ${elementId}`);
                return false;
            }

        } catch (error) {
            console.error('Error applying GlashouseJournalGUID:', error);
            return false;
        }
    }

    _getPropertyValue(props, propertyName) {
        // First try direct property name match
        if (props[propertyName] !== undefined) {
            return props[propertyName];
        }

        // If not found, try to find by legend name (reverse lookup) - same as GlasshouseLinkTool
        if (window.modelLegend) {
            for (const [key, legendInfo] of Object.entries(window.modelLegend)) {
                if (legendInfo.Name === propertyName && props[key] !== undefined) {
                    //console.log(`Found property '${propertyName}' via legend key '${key}' = '${props[key]}'`);
                    return props[key];
                }
            }
        }

        return null;
    }

    _setPropertyValue(props, propertyName, propertyValue) {
        // First try to find existing property by name
        if (props[propertyName] !== undefined) {
            props[propertyName] = propertyValue;
            return;
        }

        // If not found, try to find by legend name and set via legend key
        if (window.modelLegend) {
            for (const [key, legendInfo] of Object.entries(window.modelLegend)) {
                if (legendInfo.Name === propertyName) {
                    props[key] = propertyValue;
                    console.log(`Set property '${propertyName}' via legend key '${key}' = '${propertyValue}'`);
                    return;
                }
            }
        }

        // If no legend mapping found, set directly by name
        props[propertyName] = propertyValue;
        console.log(`Set property '${propertyName}' directly = '${propertyValue}'`);
    }

    _showProgressDialog(title) {
        const progressDialog = document.createElement('div');
        progressDialog.className = 'xeokit-import-progress';
        progressDialog.innerHTML = `
            <h4>${title}</h4>
            <div class="xeokit-import-progress-bar">
                <div class="xeokit-import-progress-fill"></div>
            </div>
            <div class="xeokit-import-progress-text">
                <span class="xeokit-import-spinner"></span>
                <span class="progress-message">Initializing...</span>
            </div>
        `;

        document.body.appendChild(progressDialog);
        return progressDialog;
    }

    _updateProgress(progressDialog, percentage, message) {
        if (!progressDialog) return;

        const progressFill = progressDialog.querySelector('.xeokit-import-progress-fill');
        const progressMessage = progressDialog.querySelector('.progress-message');

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (progressMessage) {
            progressMessage.textContent = message;
        }
    }

    _hideProgressDialog(progressDialog) {
        if (progressDialog && progressDialog.parentNode) {
            progressDialog.parentNode.removeChild(progressDialog);
        }
    }

    destroy() {
        super.destroy();
    }
}
