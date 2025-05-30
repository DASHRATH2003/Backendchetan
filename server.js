// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const connectDB = require('./db');
require('dotenv').config();
const mongoose = require('mongoose');

const app = express();

console.log('Starting server...');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Connect to MongoDB with enhanced logging
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');

// Add global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

connectDB().then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('MongoDB Status:', mongoose.connection.readyState);
  
  // Log MongoDB connection details
  const db = mongoose.connection;
  console.log('Database name:', db.name);
  console.log('Host:', db.host);
  console.log('Port:', db.port);
  
  // Log the available collections
  mongoose.connection.db.listCollections().toArray((err, collections) => {
    if (err) {
      console.error('Error listing collections:', err);
    } else {
      console.log('Available collections:', collections.map(c => c.name));
    }
  });
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  console.error('Full error:', err);
  console.error('Stack trace:', err.stack);
});

// Monitor MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error event:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Middleware
const allowedOrigins = [
  'http://localhost:5137',  // Vite dev server
  'http://localhost:5173',  // Alternative Vite port
  'https://silly-zuccutto-6e18a6.netlify.app',  // Production
  'https://chetanbackend.onrender.com'  // Backend URL
];

// Log all requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`${req.method} ${req.path} from origin:`, origin);
  console.log('Request headers:', req.headers);
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('Origin not allowed:', origin);
      console.log('Allowed origins:', allowedOrigins);
    } else {
      console.log('Origin allowed:', origin);
    }
    
    callback(null, true); // Allow all origins in production
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure static file serving with detailed logging
app.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadsDir, req.path);
  console.log('Attempting to serve file:', {
    requestPath: req.path,
    fullPath: filePath,
    exists: fs.existsSync(filePath)
  });
  next();
}, express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Ensure unique filename and preserve extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Health check
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  };
  res.json(status);
});

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uploadsPath: uploadsDir,
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Debug routes - MUST be before the main routes
app.get('/api/debug/projects', async (req, res) => {
  try {
    const Project = require('./models/Project');
    const projects = await Project.find({}).lean();
    console.log('Debug - Found projects:', projects);
    res.json({
      count: projects.length,
      projects: projects,
      mongoStatus: mongoose.connection.readyState
    });
  } catch (err) {
    console.error('Debug - Error fetching projects:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/gallery', async (req, res) => {
  try {
    const Gallery = require('./models/Gallery');
    const gallery = await Gallery.find({}).lean();
    console.log('Debug - Found gallery items:', gallery);
    res.json({
      count: gallery.length,
      gallery: gallery,
      mongoStatus: mongoose.connection.readyState
    });
  } catch (err) {
    console.error('Debug - Error fetching gallery:', err);
    res.status(500).json({ error: err.message });
  }
});

// Main routes
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/projects', require('./routes/projects'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Max size 5MB.' });
  }
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler - MUST be last
app.use((req, res) => {
  console.log('404 Not Found:', req.path);
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

// Use port 5000 by default
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/*`);
});
