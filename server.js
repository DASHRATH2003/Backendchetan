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

// Connect to MongoDB
connectDB().then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('Creating uploads directory:', uploadsDir);
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Middleware
app.use(cors({
  origin: [
    'https://silly-zuccutto-6e18a6.netlify.app',
    'http://localhost:3000',  // For local development
    'http://localhost:5173'   // For Vite dev server
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - MongoDB Status: ${mongoose.connection.readyState}`);
  next();
});

// Configure static file serving with custom logging
app.use('/uploads', (req, res, next) => {
  console.log('Attempting to serve file:', req.url);
  console.log('Full path:', path.join(uploadsDir, req.url));
  next();
}, express.static(uploadsDir));

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

// Use port 5001 to avoid EADDRINUSE error
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
