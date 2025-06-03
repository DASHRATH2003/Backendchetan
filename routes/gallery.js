const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Gallery = require('../models/Gallery');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

// Get all gallery items
router.get('/', async (req, res) => {
  try {
    const items = await Gallery.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Error fetching gallery items:', error);
    res.status(500).json({ message: 'Error fetching gallery items', error: error.message });
  }
});

// Add new gallery item
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Upload to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
      folder: 'gallery',
      resource_type: 'auto'
    });

    // Create new gallery item
    const galleryItem = new Gallery({
      title,
      description,
      image: cloudinaryResponse.secure_url,
      cloudinary_id: cloudinaryResponse.public_id,
      alt: title
    });

    const savedItem = await galleryItem.save();
    res.status(201).json(savedItem);

  } catch (error) {
    console.error('Error creating gallery item:', error);
    res.status(500).json({ message: 'Error creating gallery item', error: error.message });
  }
});

// Update gallery item
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const galleryItem = await Gallery.findById(id);
    if (!galleryItem) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    const updateData = {
      title: title || galleryItem.title,
      description: description || galleryItem.description
    };

    // If new image is uploaded
    if (req.file) {
      // Delete old image from Cloudinary
      if (galleryItem.cloudinary_id) {
        await cloudinary.uploader.destroy(galleryItem.cloudinary_id);
      }

      // Upload new image
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      
      const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'gallery',
        resource_type: 'auto'
      });

      updateData.image = cloudinaryResponse.secure_url;
      updateData.cloudinary_id = cloudinaryResponse.public_id;
    }

    const updatedItem = await Gallery.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating gallery item:', error);
    res.status(500).json({ message: 'Error updating gallery item', error: error.message });
  }
});

// Delete gallery item
router.delete('/:id', async (req, res) => {
  try {
    const galleryItem = await Gallery.findById(req.params.id);
    if (!galleryItem) {
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    // Delete image from Cloudinary
    if (galleryItem.cloudinary_id) {
      await cloudinary.uploader.destroy(galleryItem.cloudinary_id);
    }

    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ message: 'Gallery item deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery item:', error);
    res.status(500).json({ message: 'Error deleting gallery item', error: error.message });
  }
});

// Delete all gallery items
router.delete('/', async (req, res) => {
  try {
    // Get all gallery items to get their image paths
    const items = await Gallery.find();
    
    // Delete all image files
    for (const item of items) {
      if (item.image) {
        await cloudinary.uploader.destroy(item.cloudinary_id);
      }
    }

    // Delete all items from database
    await Gallery.deleteMany({});
    
    res.json({ message: 'All gallery items deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cleanup endpoint to remove entries with missing files
router.post('/cleanup', async (req, res) => {
  try {
    const galleries = await Gallery.find();
    const removedCount = { total: 0 };

    for (const gallery of galleries) {
      if (gallery.image) {
        await cloudinary.uploader.destroy(gallery.cloudinary_id);
        removedCount.total++;
      }
    }

    // Delete all items from database
    await Gallery.deleteMany({});
    
    res.json({ 
      message: 'Cleanup completed successfully', 
      removedEntries: removedCount.total 
    });
  } catch (err) {
    console.error('Error during cleanup:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
