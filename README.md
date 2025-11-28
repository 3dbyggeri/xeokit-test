# XeoKit Test - BIM Viewer

A simple BIM viewer application using XeoKit SDK with MongoDB and Scaleway Object Storage (S3-compatible) integration.

## Features

- 3D BIM model viewer using XeoKit SDK
- Project and model organization
- Metadata viewing for model elements
- MongoDB integration for project and model data storage
- Scaleway Object Storage (S3-compatible) for XKT and metadata file storage

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud-based)
- Scaleway Object Storage account (or any S3-compatible storage)

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/your-username/xeokit-test.git
   cd xeokit-test
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` template:
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your MongoDB and Scaleway credentials.

5. Create an `uploads` directory for temporary file storage:
   ```
   mkdir uploads
   ```

## Running the Application

### Development Mode

```
npm run dev
```

This will start the server with nodemon, which will automatically restart when you make changes.

### Production Mode

```
npm start
```

The application will be available at http://localhost:8080 (or the PORT specified in your .env file).

## Deployment to Scalingo

1. Create a Scalingo application.

2. Set up environment variables in Scalingo dashboard:
   - MONGODB_URI (Scalingo will provide this)
   - S3_ENDPOINT
   - S3_ACCESS_KEY
   - S3_SECRET_KEY
   - S3_BUCKET
   - NODE_ENV=production

3. Deploy using git:
   ```
   git remote add scalingo git@ssh.osc-fr1.scalingo.com:your-app-name.git
   git push scalingo main
   ```

## API Endpoints

### Projects & Models

- `GET /api/modeldata/projects` - Get all projects
- `GET /api/modeldata/models/:projectId` - Get models for a project
- `DELETE /api/modeldata/models/:modelId` - Delete a model
- `GET /api/modeldata/xkt-files` - List all XKT files in S3 bucket
- `GET /api/modeldata/xkt/:key` - Proxy endpoint for XKT files from S3
- `GET /api/modeldata/properties/:modelName` - Get model properties from MongoDB
- `GET /api/modeldata/S3properties/:modelName` - Get model properties from S3

### Glasshouse Integration

- `POST /api/glasshouse/login` - Login to Glasshouse
- `GET /api/glasshouse/projects` - Get Glasshouse projects
- `GET /api/glasshouse/projects/:projectId/models` - Get models for a Glasshouse project
- `POST /api/glasshouse/import/project-changes` - Import project changes from Glasshouse
- `POST /api/glasshouse/import/bim-objects` - Import BIM objects from Glasshouse

### Diagnostic Endpoints (for testing)

- `GET /api/modeldata/diagnostic/list-models` - List all models in MongoDB
- `GET /api/modeldata/diagnostic/search/:modelName` - Search for a specific model
- `POST /api/modeldata/diagnostic/upload-test-data` - Upload test data
- `DELETE /api/modeldata/diagnostic/delete-test-data/:modelName` - Delete test data

## License

This project is licensed under the MIT License. 