// routes/gallery.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Gallery = require('../models/Gallery');
const auth = require('../middleware/auth');
const { validateGalleryItem } = require('../middleware/validation');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log('Processing file upload:', file.originalname);
    const allowedTypes = /jpeg|jpg|png|gif|webp/i;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      console.log('File accepted:', file.originalname, 'Mimetype:', file.mimetype);
      return cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, 'Mimetype:', file.mimetype);
      cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Get all gallery items with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query based on filters
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.section) query.section = req.query.section;
    if (req.query.year) query.year = req.query.year;
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      Gallery.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Gallery.countDocuments(query)
    ]);

    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: items,
      page,
      limit,
      total,
      pages
    });
  } catch (err) {
    console.error('Error fetching gallery:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching gallery'
    });
  }
});

// Add new gallery item
router.post('/', auth, upload.single('image'), validateGalleryItem, async (req, res) => {
  try {
    console.log('Received gallery item creation request');
    console.log('Request body:', req.body);
    console.log('File details:', req.file);

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ message: 'Image is required' });
    }

    const { title, description, category, section, year } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!category) {
      console.error('Category is missing');
      return res.status(400).json({ message: 'Category is required' });
    }

    // Validate category
    const validCategories = ['events', 'movies', 'celebrations', 'awards', 'behind-the-scenes', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Validate section
    const validSections = ['home', 'gallery', 'about', 'events'];
    if (section && !validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section. Must be one of: ${validSections.join(', ')}`
      });
    }

    // Upload image to Cloudinary
    console.log('Uploading image to Cloudinary...');
    const cloudinaryResult = await uploadToCloudinary(req.file, 'gallery');
    console.log('Cloudinary upload result:', cloudinaryResult);

    // Create gallery item with Cloudinary URL
    const itemData = {
      title,
      description: description || '',
      image: cloudinaryResult.url,
      cloudinary_id: cloudinaryResult.public_id,
      category,
      section: section || 'gallery',
      year: year || new Date().getFullYear()
    };

    console.log('Creating gallery item with data:', itemData);

    const item = new Gallery(itemData);
    console.log('Gallery model created:', item);

    const savedItem = await item.save();
    console.log('Gallery item saved successfully:', savedItem);
    
    return res.status(201).json({
      success: true,
      data: savedItem,
      message: 'Gallery item created successfully'
    });

  } catch (err) {
    console.error('Error in gallery item creation:', err);

    // Send appropriate error response
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: Object.keys(err.errors).reduce((acc, key) => {
          acc[key] = err.errors[key].message;
          return acc;
        }, {})
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Update gallery item
router.put('/:id', auth, upload.single('image'), validateGalleryItem, async (req, res) => {
  try {
    console.log('Updating gallery item:', req.params.id);
    console.log('Update data:', req.body);
    console.log('File:', req.file);

    const existingItem = await Gallery.findById(req.params.id);
    if (!existingItem) {
      console.error('Gallery item not found:', req.params.id);
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    // Check if user is authorized to update
    if (existingItem.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this item'
      });
    }

    const updateData = {
      title: req.body.title || existingItem.title,
      description: req.body.description || existingItem.description,
      category: req.body.category || existingItem.category,
      section: req.body.section || existingItem.section,
      year: req.body.year || existingItem.year
    };

    if (req.file) {
      // Delete old image from Cloudinary
      if (existingItem.cloudinary_id) {
        await deleteFromCloudinary(existingItem.cloudinary_id);
        console.log('Deleted old image from Cloudinary:', existingItem.cloudinary_id);
      }

      // Upload new image to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(req.file, 'gallery');
      console.log('Uploaded new image to Cloudinary:', cloudinaryResult);

      updateData.image = cloudinaryResult.url;
      updateData.cloudinary_id = cloudinaryResult.public_id;
    }

    const updatedItem = await Gallery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedItem);
  } catch (err) {
    console.error('Error updating gallery item:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete gallery item
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log('Attempting to delete gallery item:', req.params.id);

    const item = await Gallery.findById(req.params.id);
    if (!item) {
      console.log('Gallery item not found:', req.params.id);
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    console.log('Found gallery item to delete:', {
      id: item._id,
      title: item.title,
      cloudinary_id: item.cloudinary_id
    });

    // Delete image from Cloudinary
    if (item.cloudinary_id) {
      await deleteFromCloudinary(item.cloudinary_id);
      console.log('Successfully deleted image from Cloudinary');
    }

    // Delete the item from database
    console.log('Deleting gallery item from database...');
    const deleteResult = await Gallery.deleteOne({ _id: req.params.id });
    console.log('Delete result:', deleteResult);

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found or already deleted'
      });
    }

    res.json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting gallery item:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error while deleting gallery item'
    });
  }
});

// Delete all gallery items
router.delete('/', async (req, res) => {
  try {
    // Get all items to delete their Cloudinary images
    const items = await Gallery.find();
    
    // Delete all images from Cloudinary
    for (const item of items) {
      if (item.cloudinary_id) {
        await deleteFromCloudinary(item.cloudinary_id);
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