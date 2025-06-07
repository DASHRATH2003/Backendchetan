// routes/gallery.js
const express = require('express');
const router = express.Router();
const Gallery = require('../models/Gallery');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|avif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP, AVIF) are allowed!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Helper function to verify file exists
const verifyFile = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    console.error('Error verifying file:', err);
    return false;
  }
};

// Helper function to get production URL
const getProductionUrl = (req) => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://backendchetan.onrender.com';
  }
  return `${req.protocol}://${req.get('host')}`;
};

// Get all gallery items
router.get('/', async (req, res) => {
  try {
    const gallery = await Gallery.find().sort({ createdAt: -1 });

    // Verify each image file exists and add image URLs
    const verifiedGallery = gallery.map(item => {
      const fullPath = path.join(__dirname, '..', item.image);
      const fileExists = verifyFile(fullPath);
      
      if (!fileExists) {
        console.warn(`Image file not found: ${fullPath}`);
      }

      // Add the full URL to each item using production URL
      const baseUrl = getProductionUrl(req);
      const imageUrl = `${baseUrl}${item.image}`;

      return {
        ...item.toObject(),
        imageUrl,
        fileExists
      };
    });

    res.json({
      success: true,
      message: 'Gallery items retrieved successfully',
      data: verifiedGallery
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// Upload endpoint (moved to root POST)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { title, description, category, section, year } = req.body;

    // Save only the relative path
    const imagePath = `/uploads/${req.file.filename}`;

    // Generate the full URL
    const baseUrl = 'http://www.chethancinemas.com';
    const imageUrl = `${baseUrl}${imagePath}`;

    // Verify the file was saved
    const fullPath = path.join(__dirname, '..', imagePath);
    if (!verifyFile(fullPath)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save image file'
      });
    }

    const newGalleryItem = new Gallery({
      title,
      description,
      image: imagePath,
      imageUrl: imageUrl,
      category: category || 'Regular',
      section: section || 'Regular',
      year: year || new Date().getFullYear().toString()
    });

    const savedItem = await newGalleryItem.save();

    // Log the saved item for debugging
    console.log('Saved gallery item:', {
      id: savedItem._id,
      title: savedItem.title,
      image: savedItem.image,
      imageUrl: savedItem.imageUrl
    });

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: savedItem
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// Delete all gallery items
router.delete('/all', auth, async (req, res) => {
  try {
    // Get all gallery items to delete their files
    const gallery = await Gallery.find();
    
    // Delete all image files
    for (const item of gallery) {
      const imagePath = path.join(__dirname, '..', item.image);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
          console.log('Deleted file:', imagePath);
        } catch (err) {
          console.error('Error deleting file:', imagePath, err);
        }
      }
    }

    // Delete all records from database
    await Gallery.deleteMany({});

    res.json({
      success: true,
      message: 'All gallery items deleted successfully'
    });
  } catch (error) {
    console.error('Delete all error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// Delete single gallery item
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }

    // Delete the image file
    const imagePath = path.join(__dirname, '..', item.image);
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        console.log('Deleted file:', imagePath);
      } catch (err) {
        console.error('Error deleting file:', imagePath, err);
      }
    }

    // Delete the database record
    await item.deleteOne();

    res.json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;
