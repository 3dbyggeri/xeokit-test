const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 8081; // Use different port to avoid conflicts

// MongoDB connection string from config
const MONGODB_URI = "mongodb://xeokitdev:z6072l8iYneFHNsDm_QBFRoNuryQ5Qo6McSNapNp2lxoRUPpVX1gMlFVm8Xb05_n@7a661fba-987e-481e-91d2-b3f19320c39b.xeokit-4078.mongo.b.osc-fr1.scalingo-dbs.com:30524/xeokit-4078?replicaSet=xeokit-4078-rs0&tls=true&tlsCAFile=C%3A%5Ctemp%5Cca.pem";

console.log('Starting simple server test...');

// Simple health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        mongooseState: mongoose.connection.readyState 
    });
});

// Simple MongoDB test endpoint
app.get('/test-mongo', async (req, res) => {
    try {
        console.log('Testing MongoDB connection...');
        
        // Check connection state
        const connectionState = mongoose.connection.readyState;
        console.log('Mongoose connection state:', connectionState);
        
        if (connectionState !== 1) {
            return res.status(500).json({ 
                error: 'MongoDB not connected', 
                connectionState: connectionState 
            });
        }
        
        // Simple query with timeout
        const ModelData = mongoose.model('ModelData', new mongoose.Schema({}, { strict: false }), 'modeldata');
        
        console.log('Executing count query...');
        const count = await ModelData.countDocuments().maxTimeMS(5000); // 5 second timeout
        
        console.log('Query completed, count:', count);
        res.json({ 
            success: true, 
            documentCount: count,
            connectionState: connectionState
        });
        
    } catch (error) {
        console.error('MongoDB test error:', error);
        res.status(500).json({ 
            error: 'MongoDB test failed', 
            message: error.message,
            name: error.name
        });
    }
});

// Connect to MongoDB with timeout
console.log('Connecting to MongoDB...');
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // 10 second timeout
    socketTimeoutMS: 45000, // 45 second socket timeout
    maxPoolSize: 5 // Limit connection pool
})
.then(() => {
    console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Simple test server running on http://localhost:${PORT}`);
    console.log(`Test endpoints:`);
    console.log(`  - Health: http://localhost:${PORT}/health`);
    console.log(`  - MongoDB: http://localhost:${PORT}/test-mongo`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});
