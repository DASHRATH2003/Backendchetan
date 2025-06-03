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
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Enable CORS with proper configuration
app.use(cors({
  origin: ['http://localhost:5137', 'http://localhost:5173', 'https://chetanfrontend.onrender.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists with absolute path
const uploadsDir = path.join(__dirname, 'uploads');
console.log('Uploads directory absolute path:', uploadsDir);

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
} else {
  console.log('Uploads directory exists at:', uploadsDir);
  // Log directory contents
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Uploads directory contents:', files);
  } catch (err) {
    console.error('Error reading uploads directory:', err);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory exists before saving
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    console.log('Saving file to uploads directory:', uploadsDir);
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = uniqueSuffix + ext;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    console.log('File accepted:', file.originalname);
    return cb(null, true);
  } else {
    console.log('File rejected:', file.originalname);
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Configure static file serving with detailed logging
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    // Set proper headers for image serving
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    uploadsDir: {
      path: uploadsDir,
      exists: fs.existsSync(uploadsDir),
      isWritable: fs.accessSync(uploadsDir, fs.constants.W_OK) === undefined
    }
  };
  res.json(status);
});

// Main routes
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/projects', require('./routes/projects'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max size 5MB.' });
    }
    return res.status(400).json({ message: `File upload error: ${err.message}` });
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
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/*`);
});
