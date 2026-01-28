/**
 * UploadTool - Handles file upload with access code validation
 */
export class UploadTool {
    constructor(modelsManager) {
        this.modelsManager = modelsManager;
        this.accessCode = null; // Will be loaded from server
        this._initModal();
        this._loadAccessCode();
    }

    async _loadAccessCode() {
        try {
            const response = await fetch('/api/modeldata/access-code');
            if (response.ok) {
                const data = await response.json();
                this.accessCode = data.accessCode;
                console.log('Access code loaded from server');
            } else {
                console.error('Failed to load access code from server');
                // Fallback to empty string to prevent access
                this.accessCode = '';
            }
        } catch (error) {
            console.error('Error loading access code:', error);
            // Fallback to empty string to prevent access
            this.accessCode = '';
        }
    }

    _initModal() {
        // Set up modal event handlers
        const submitBtn = document.getElementById('accessCodeSubmit');
        const input = document.getElementById('accessCodeInput');
        const modal = document.getElementById('accessCodeModal');
        const errorDiv = document.getElementById('accessCodeError');

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.validateAndProceed();
            });
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.validateAndProceed();
                }
            });
        }

        // Clear error when modal is shown
        if (modal) {
            $(modal).on('show.bs.modal', () => {
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                    errorDiv.textContent = '';
                }
                if (input) {
                    input.value = '';
                }
            });
        }
    }

    openModal(callback) {
        const modal = document.getElementById('accessCodeModal');
        if (modal) {
            // Store callback for when access is granted
            this.pendingCallback = callback;
            $(modal).modal('show');
        }
    }

    async validateAndProceed() {
        const input = document.getElementById('accessCodeInput');
        const errorDiv = document.getElementById('accessCodeError');
        const modal = document.getElementById('accessCodeModal');

        if (!input || !errorDiv || !modal) {
            console.error('Modal elements not found');
            return;
        }

        // Ensure access code is loaded
        if (this.accessCode === null) {
            errorDiv.textContent = 'Loading access code...';
            errorDiv.style.display = 'block';
            await this._loadAccessCode();
            errorDiv.style.display = 'none';
        }

        const enteredCode = input.value.trim();

        if (!this.accessCode) {
            errorDiv.textContent = 'Access code not configured. Please contact administrator.';
            errorDiv.style.display = 'block';
            return;
        }

        if (enteredCode === this.accessCode) {
            // Access granted - close modal
            $(modal).modal('hide');
            
            // Execute callback if provided, otherwise default to file picker
            if (this.pendingCallback) {
                this.pendingCallback();
                this.pendingCallback = null;
            } else {
                this.openFilePicker();
            }
        } else {
            // Access denied - show error
            errorDiv.textContent = 'Access denied';
            errorDiv.style.display = 'block';
        }
    }

    openFilePicker() {
        // Create a hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.accept = '*/*'; // Accept any file type

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadFile(file);
            }
            // Clean up
            document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        fileInput.click();
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Show loading indicator
            this.showMessage('Uploading file...', 'info');

            const response = await fetch('/api/modeldata/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage(`File "${file.name}" uploaded successfully!`, 'success');
                
                // Refresh models list
                if (this.modelsManager) {
                    await this.modelsManager.fetchModels();
                    const treeView = window.treeView;
                    if (treeView && treeView.currentTab === 'models') {
                        treeView.buildTree();
                    }
                }
            } else {
                this.showMessage(`Upload failed: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            this.showMessage('Error uploading file. Please try again.', 'error');
        }
    }

    showMessage(message, type) {
        // Simple alert for now - could be enhanced with a toast notification
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else if (type === 'success') {
            alert(`Success: ${message}`);
        } else {
            console.log(message);
        }
    }
}
