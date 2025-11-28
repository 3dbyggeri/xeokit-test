# Glasshouse API Tests

This document explains how to run the unit tests for the Glasshouse API endpoints that mirror the Revit plugin functionality.

## Overview

The API endpoints have been updated to exactly match the URLs and parameters used in the Revit plugin:

### GetProjectChanges Endpoint
- **URL Pattern**: `/audit_log/bim_object_changes/{projectId}`
- **With Date Filters**: `/audit_log/bim_object_changes/{projectId}?from={dateTimeFrom} UTC&to={dateTimeTo} UTC`
- **Matches**: `GlassHouseClientServiceClient.GetProjectChanges()` method

### GetBimObjectLinks Endpoint  
- **URL Pattern**: `/{projectId}/new_journal/entries/connected_bimobjects?model-containing={modelId}&exclude_entries_without_objects={exclude}`
- **Matches**: `GlassHouseClientServiceClient.GetBimObjectLinks()` method

## Running the Tests

### 1. Setup Credentials

Edit `test-glasshouse-api.js` and fill in your credentials:

```javascript
const TEST_CONFIG = {
    // Your Glasshouse credentials
    email: 'your-email@example.com',
    password: 'your-password',
    
    // Test project and model IDs (get these from your Glasshouse account)
    projectId: 'your-project-id',
    modelId: 'your-model-id',
    
    // Server URL
    serverUrl: 'http://localhost:8080'
};
```

### 2. Start the Server

```bash
node server.js
```

### 3. Run the Tests

```bash
node test-glasshouse-api.js
```

## Test Coverage

The tests verify:

1. **Authentication** - Login and API key retrieval
2. **Get Projects** - List all available projects
3. **Get Models** - List models for a specific project
4. **Get Project Changes** - Test both with and without date filters
5. **Get BIM Object Links** - Test both with and without model filters

## Expected Output

```
🚀 Starting Glasshouse API Tests
============================================================

🧪 Running test: Get Projects
==================================================
🔐 Logging in to get API key...
✅ Login successful, API key obtained
📋 Projects response status: 200
📋 Number of projects: 5
✅ PASSED: Get Projects

🧪 Running test: Get Models
==================================================
🏗️ Models response status: 200
🏗️ Number of models: 3
✅ PASSED: Get Models

🧪 Running test: Get Project Changes
==================================================
📅 Testing GetProjectChanges without date filters...
📅 Project changes response status: 200
📅 Response data preview: {"changes":[{"id":123,"name":"Wall change"...

📅 Testing GetProjectChanges with date filters...
📅 Filtered project changes response status: 200
✅ PASSED: Get Project Changes

🧪 Running test: Get BIM Object Links
==================================================
🔗 Testing GetBimObjectLinks without model filter...
🔗 BIM objects response status: 200
🔗 Response data preview: {"entries":[{"id":456,"guid":"abc123"...

🔗 Testing GetBimObjectLinks with model filter...
🔗 Filtered BIM objects response status: 200
✅ PASSED: Get BIM Object Links

============================================================
📊 TEST SUMMARY
============================================================
✅ Passed: 4
❌ Failed: 0
📊 Total:  4

🎉 All tests passed! The API endpoints are working correctly.
```

## Troubleshooting

### Common Issues

1. **"Please fill in your credentials"**
   - Make sure you've updated the `TEST_CONFIG` object with your actual credentials

2. **"Login failed"**
   - Verify your email and password are correct
   - Check that the Glasshouse server is accessible

3. **"Project ID not found"**
   - Make sure the `projectId` exists in your Glasshouse account
   - You can get project IDs from the "Get Projects" test output

4. **"Model ID not found"**
   - Make sure the `modelId` exists in the specified project
   - You can get model IDs from the "Get Models" test output

### Getting Project and Model IDs

1. Run the test with any dummy project/model IDs first
2. The "Get Projects" test will show you available project IDs
3. The "Get Models" test will show you available model IDs for your project
4. Update the `TEST_CONFIG` with the correct IDs and run again

## API Endpoint Details

### Request Headers
All endpoints require:
```
access-token: YOUR_API_KEY
Content-Type: application/json
```

### Request Bodies

**Project Changes:**
```json
{
    "projectId": "your-project-id",
    "dateTimeFrom": "2024-01-01 00:00:00",  // optional
    "dateTimeTo": "2024-12-31 23:59:59"     // optional
}
```

**BIM Objects:**
```json
{
    "projectId": "your-project-id",
    "modelId": "your-model-id",              // optional
    "excludeEntriesWithoutObjects": false    // optional
}
```

## Integration with Frontend

The frontend Import tool automatically uses these endpoints when you:
1. Click Import button → "Set Project & Model"
2. Select a project and model
3. Click "Import Project Changes" or "Import BIM Objects"

The XML content will be logged to the browser console for inspection.
