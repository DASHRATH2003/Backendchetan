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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

// Enable CORS with proper configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5137',
    'http://localhost:5000',
    'https://frontendchetan.vercel.app',
    'https://backendchetan.onrender.com',
    'https://www.chethancinemas.com/'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
} else {
  console.log('Uploads directory exists:', uploadsDir);
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Uploads directory contents:', files);
  } catch (err) {
    console.error('Error reading uploads directory:', err);
  }
}

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `gallery-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Serve uploads with logging
app.use('/uploads', (req, res, next) => {
  const requestedFile = req.url;
  const filePath = path.join(uploadsDir, requestedFile);
  
  console.log('Static file request:', {
    url: requestedFile,
    fullPath: filePath,
    exists: fs.existsSync(filePath)
  });

  // List all files in uploads directory
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Current uploads directory contents:', files);
  } catch (err) {
    console.error('Error reading uploads directory:', err);
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', {
      requestedFile,
      filePath,
      uploadsDir
    });
    return res.status(404).json({ 
      error: 'File not found',
      requestedFile,
      filePath,
      uploadsDir
    });
  }

  // Log file stats
  try {
    const stats = fs.statSync(filePath);
    console.log('File stats:', {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      permissions: stats.mode
    });
  } catch (err) {
    console.error('Error getting file stats:', err);
  }
  
  next();
}, express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
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
    
    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    console.log('Set headers for file:', {
      path: filePath,
      contentType: mimeTypes[ext],
      ext: ext
    });
  }
}));

// Health check
app.get('/api/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    uploadsDir: {
      path: uploadsDir,
      exists: fs.existsSync(uploadsDir)
    }
  };
  res.json(status);
});

// API routes
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/projects', require('./routes/projects'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max size 5MB.' });
    }
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  }
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.path);
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use. Trying port 5001...`);
    app.listen(5001, () => {
      console.log('✅ Server running on port 5001');
    });
  } else {
    console.error('Server error:', err);
  }
});
