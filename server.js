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

// Configure allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5137',
  'http://localhost:5000',
  'http://localhost:5150',
  'http://127.0.0.1:5150',
  'http://127.0.0.1:5173',
  'https://www.chethancinemas.com',
  'https://chethancinemas.com',
  'https://backendchetan.onrender.com'
];

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.error('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  console.log('Incoming request:', {
    origin: req.headers.origin,
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware
app.use((req, res, next) => {
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'same-origin');
  next();
});

// Serve static files from uploads directory - IMPORTANT: This must come before API routes
app.use('/uploads', express.static(uploadsDir, {
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
    
    // Match the same origin policy as your main CORS config
    const requestOrigin = res.req.headers.origin;
    if (allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    }
    res.setHeader('Vary', 'Origin');
    
    // Security headers
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Multer setup for file uploads
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// API routes
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/projects', require('./routes/projects'));

// Debug middleware for 404s
app.use((req, res, next) => {
  console.log('404 Not Found:', {
    method: req.method,
    path: req.path,
    url: req.url,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    exists: fs.existsSync(path.join(uploadsDir, path.basename(req.path)))
  });
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      status: 'error',
      message: 'Cross-origin request blocked',
      allowedOrigins
    });
  }

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        status: 'error',
        message: 'File too large. Max size 5MB.' 
      });
    }
    return res.status(400).json({ 
      status: 'error',
      message: `File upload error: ${err.message}` 
    });
  }

  // Generic error response
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Uploads directory:', uploadsDir);
  // List files in uploads directory
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Files in uploads directory:', files);
  } catch (err) {
    console.error('Error reading uploads directory:', err);
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});