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
    // Ensure unique filename and clean the original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all gallery items
router.get('/', async (req, res) => {
  try {
    console.log('Fetching gallery items...');
    const items = await Gallery.find().sort({ createdAt: -1 });
    console.log(`Found ${items.length} gallery items`);
    
    const backendUrl = process.env.BACKEND_URL || 'https://chetanbackend.onrender.com';
    console.log('Using backend URL:', backendUrl);
    
    const itemsWithFullUrls = items.map(item => {
      const itemObj = item.toObject();
      const imageUrl = `${backendUrl}${item.image}`;
      console.log(`Processing item ${item._id}:`, { title: item.title, imageUrl });
      return {
        ...itemObj,
        imageUrl
      };
    });
    
    console.log('Sending response with items');
    res.json(itemsWithFullUrls);
  } catch (err) {
    console.error('Error fetching gallery items:', err);
    res.status(500).json({ 
      message: 'Error fetching gallery items',
      error: err.message 
    });
  }
});

// Add new gallery item
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('Creating new gallery item:', req.body);
    const { title, description } = req.body;
    
    if (!req.file) {
      console.error('No image file provided');
      return res.status(400).json({ message: 'Image is required' });
    }
    
    const image = `/uploads/${req.file.filename}`;
    console.log('Image path:', image);
    
    const galleryItem = new Gallery({
      title,
      description,
      image,
      alt: title || 'Gallery image'
    });

    const savedItem = await galleryItem.save();
    console.log('Saved gallery item:', savedItem);
    
    const backendUrl = process.env.BACKEND_URL || 'https://chetanbackend.onrender.com';
    const itemWithUrl = {
      ...savedItem.toObject(),
      imageUrl: `${backendUrl}${savedItem.image}`
    };
    
    console.log('Sending response with new item');
    res.status(201).json(itemWithUrl);
  } catch (err) {
    console.error('Error creating gallery item:', err);
    res.status(400).json({ 
      message: 'Error creating gallery item',
      error: err.message 
    });
  }
});

// Update gallery item
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    console.log(`Updating gallery item ${req.params.id}:`, req.body);
    const { title, description } = req.body;
    const updateData = { title, description };
    
    if (req.file) {
      // Delete old image if it exists
      const oldItem = await Gallery.findById(req.params.id);
      if (oldItem && oldItem.image) {
        const oldImagePath = path.join(uploadsDir, path.basename(oldItem.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('Deleted old image:', oldImagePath);
        }
      }
      updateData.image = `/uploads/${req.file.filename}`;
      console.log('New image path:', updateData.image);
    }

    const updatedItem = await Gallery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedItem) {
      console.error('Gallery item not found:', req.params.id);
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    const backendUrl = process.env.BACKEND_URL || 'https://chetanbackend.onrender.com';
    const itemWithUrl = {
      ...updatedItem.toObject(),
      imageUrl: `${backendUrl}${updatedItem.image}`
    };
    
    console.log('Sending response with updated item');
    res.json(itemWithUrl);
  } catch (err) {
    console.error('Error updating gallery item:', err);
    res.status(400).json({ 
      message: 'Error updating gallery item',
      error: err.message 
    });
  }
});

// Delete gallery item
router.delete('/:id', async (req, res) => {
  try {
    console.log('Deleting gallery item:', req.params.id);
    const item = await Gallery.findById(req.params.id);
    
    if (!item) {
      console.error('Gallery item not found:', req.params.id);
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    // Delete the image file if it exists
    if (item.image) {
      const imagePath = path.join(uploadsDir, path.basename(item.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('Deleted image file:', imagePath);
      }
    }

    await Gallery.findByIdAndDelete(req.params.id);
    console.log('Gallery item deleted successfully');
    res.json({ message: 'Gallery item deleted successfully' });
  } catch (err) {
    console.error('Error deleting gallery item:', err);
    res.status(500).json({ 
      message: 'Error deleting gallery item',
      error: err.message 
    });
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
