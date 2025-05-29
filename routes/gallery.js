const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Gallery = require('../models/Gallery');

// Get the uploads directory path
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Get all gallery items
router.get('/', async (req, res) => {
  try {
    const items = await Gallery.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new gallery item
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { caption } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    
    const galleryItem = new Gallery({
      caption,
      image
    });

    const savedItem = await galleryItem.save();
    res.status(201).json(savedItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update gallery item
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { caption } = req.body;
    const updateData = { caption };
    
    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedItem = await Gallery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    res.json(updatedItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete gallery item
router.delete('/:id', async (req, res) => {
  try {
    // Get the item first to get the image path
    const item = await Gallery.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    // Delete the image file if it exists
    if (item.image) {
      const imagePath = path.join(uploadsDir, path.basename(item.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the item from the database
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ message: 'Gallery item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete all gallery items and their images
router.delete('/all', async (req, res) => {
  try {
    // Get all gallery items to get their image paths
    const galleryItems = await Gallery.find();
    
    // Delete all image files
    for (const item of galleryItems) {
      if (item.image) {
        const imagePath = path.join(uploadsDir, path.basename(item.image));
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }

    // Delete all items from database
    await Gallery.deleteMany({});
    
    res.json({ message: 'All gallery items deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
