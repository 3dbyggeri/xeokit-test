const fs = require('fs');
const path = require('path');

// Read and parse config.env file
function loadConfig() {
    const configPath = path.join(__dirname, 'wwwroot', 'config.env');
    
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = {};
        
        // Parse the config file line by line
        configContent.split('\n').forEach(line => {
            line = line.trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
                return;
            }
            
            // Parse key=value pairs
            const equalIndex = line.indexOf('=');
            if (equalIndex !== -1) {
                const key = line.substring(0, equalIndex).trim();
                const value = line.substring(equalIndex + 1).trim();
                
                // Remove quotes if present
                const cleanValue = value.replace(/^["']|["']$/g, '');
                config[key] = cleanValue;
            }
        });
        
        return config;
    } catch (error) {
        console.error('Error loading config.env:', error.message);
        return {};
    }
}

const config = loadConfig();

module.exports = config; 