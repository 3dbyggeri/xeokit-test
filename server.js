const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Initialize mongoose if MongoDB URI is available
let mongoose, Project, Model;
if (process.env.MONGODB_URI) {
  mongoose = require('mongoose');
  
  // MongoDB connection
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.warn('MongoDB connection error:', err.message));

  // Define MongoDB schemas and models
  const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    createdAt: { type: Date, default: Date.now }
  });

  const modelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    description: String,
    xktUrl: String,
    metadataUrl: String,
    createdAt: { type: Date, default: Date.now }
  });

  Project = mongoose.model('Project', projectSchema);
  Model = mongoose.model('Model', modelSchema);
} else {
  console.warn('MongoDB URI not provided. Database functionality will be limited.');
}

// Initialize S3 if credentials are available
let s3, bucketName, multer, upload;
if (process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
  const AWS = require('aws-sdk');
  const fs = require('fs');
  
  // Configure AWS S3 (Scaleway Object Storage compatible)
  s3 = new AWS.S3({
    endpoint: process.env.S3_ENDPOINT || 'https://s3.fr-par.scw.cloud',
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    s3ForcePathStyle: true, // Needed for Scaleway compatibility
    signatureVersion: 'v4'
  });

  bucketName = process.env.S3_BUCKET || 'xeokit-models';

  // Configure Multer for file uploads
  multer = require('multer');
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadPath = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });

  upload = multer({ storage: storage });
} else {
  console.warn('S3 credentials not provided. File upload functionality will be limited.');
}

// API Routes

// Get all projects
app.get('/api/modeldata/projects', async (req, res) => {
  try {
    if (!mongoose) {
      // Return a default project if MongoDB is not available
      return res.json([
        { id: 'default', name: 'Default Project', description: 'Default project for demo purposes' }
      ]);
    }
    
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    console.error('Error getting projects:', err);
    res.status(500).json({ error: 'Error fetching projects' });
  }
});

// Get models for a project
app.get('/api/modeldata/models/:projectId', async (req, res) => {
  try {
    if (!mongoose) {
      // Return a default model if MongoDB is not available
      return res.json({
        'default': {
          id: 'default',
          name: 'Default Model',
          xktUrl: "https://dl.dropboxusercontent.com/scl/fi/yc7ocuwkle8dfemonlen0/rac_basic_sample_project_3D.xkt?rlkey=sauugwt3nerz3v426y2fchlge&dl=1",
          metadataUrl: "https://dl.dropboxusercontent.com/scl/fi/n44yrra5d6115k6nxorus/rac_basic_sample_project_3D_modelData.json?rlkey=brpdy19qijadvg2zqidsilw2q&dl=1"
        }
      });
    }
    
    const models = await Model.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    
    // Format response to match expected format in client
    const formattedModels = {};
    models.forEach(model => {
      formattedModels[model._id] = {
        id: model._id,
        name: model.name,
        xktUrl: model.xktUrl,
        metadataUrl: model.metadataUrl
      };
    });
    
    res.json(formattedModels);
  } catch (err) {
    console.error('Error getting models:', err);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

// Create a new project
app.post('/api/modeldata/projects', async (req, res) => {
  try {
    if (!mongoose) {
      return res.status(503).json({ error: 'Database functionality is not available' });
    }
    
    const project = new Project({
      name: req.body.name,
      description: req.body.description
    });
    
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Error creating project' });
  }
});

// Upload XKT model and metadata
app.post('/api/modeldata/upload', async (req, res) => {
  try {
    if (!s3 || !upload) {
      return res.status(503).json({ error: 'File upload functionality is not available' });
    }
    
    // Use upload middleware
    upload.fields([
      { name: 'xktFile', maxCount: 1 },
      { name: 'metadataFile', maxCount: 1 }
    ])(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      try {
        if (!req.files || !req.files.xktFile || !req.files.metadataFile) {
          return res.status(400).json({ error: 'Please upload both XKT and metadata files' });
        }
        
        const xktFile = req.files.xktFile[0];
        const metadataFile = req.files.metadataFile[0];
        
        // Upload XKT file to S3
        const xktUploadParams = {
          Bucket: bucketName,
          Key: `models/${xktFile.filename}`,
          Body: require('fs').createReadStream(xktFile.path),
          ContentType: 'application/octet-stream'
        };
        
        const xktResult = await s3.upload(xktUploadParams).promise();
        
        // Upload metadata file to S3
        const metadataUploadParams = {
          Bucket: bucketName,
          Key: `metadata/${metadataFile.filename}`,
          Body: require('fs').createReadStream(metadataFile.path),
          ContentType: 'application/json'
        };
        
        const metadataResult = await s3.upload(metadataUploadParams).promise();
        
        // Create new model in MongoDB
        const model = new Model({
          name: req.body.name,
          projectId: req.body.projectId,
          description: req.body.description,
          xktUrl: xktResult.Location,
          metadataUrl: metadataResult.Location
        });
        
        await model.save();
        
        // Clean up temporary files
        require('fs').unlinkSync(xktFile.path);
        require('fs').unlinkSync(metadataFile.path);
        
        res.status(201).json({
          message: 'Model uploaded successfully',
          model: model
        });
      } catch (err) {
        console.error('Error in file upload:', err);
        res.status(500).json({ error: 'Error uploading files' });
      }
    });
  } catch (err) {
    console.error('Error setting up upload:', err);
    res.status(500).json({ error: 'Error setting up file upload' });
  }
});

// Update a model
app.put('/api/modeldata/models/:modelId', async (req, res) => {
  try {
    if (!mongoose) {
      return res.status(503).json({ error: 'Database functionality is not available' });
    }
    
    const model = await Model.findByIdAndUpdate(
      req.params.modelId,
      {
        name: req.body.name,
        description: req.body.description
      },
      { new: true }
    );
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json(model);
  } catch (err) {
    console.error('Error updating model:', err);
    res.status(500).json({ error: 'Error updating model' });
  }
});

// Delete a model
app.delete('/api/modeldata/models/:modelId', async (req, res) => {
  try {
    if (!mongoose || !s3) {
      return res.status(503).json({ error: 'Database or storage functionality is not available' });
    }
    
    const model = await Model.findById(req.params.modelId);
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Extract keys from URLs
    const xktKey = model.xktUrl.split('/').pop();
    const metadataKey = model.metadataUrl.split('/').pop();
    
    // Delete files from S3
    await s3.deleteObject({ Bucket: bucketName, Key: `models/${xktKey}` }).promise();
    await s3.deleteObject({ Bucket: bucketName, Key: `metadata/${metadataKey}` }).promise();
    
    // Delete model from MongoDB
    await Model.findByIdAndDelete(req.params.modelId);
    
    res.json({ message: 'Model deleted successfully' });
  } catch (err) {
    console.error('Error deleting model:', err);
    res.status(500).json({ error: 'Error deleting model' });
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
}); 