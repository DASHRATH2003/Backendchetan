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
  console.log('Created uploads directory:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Get the absolute path to the uploads directory
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    // Ensure directory exists before saving
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Created uploads directory at:', uploadsDir);
    }
    
    // Log directory contents before saving
    try {
      const files = fs.readdirSync(uploadsDir);
      console.log('Current uploads directory contents:', files);
    } catch (err) {
      console.error('Error reading uploads directory:', err);
    }
    
    console.log('Saving file to:', uploadsDir);
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with original extension
    const timestamp = Date.now();
    const originalExt = path.extname(file.originalname);
    const filename = `gallery-${timestamp}${originalExt}`;
    console.log('Generated filename:', filename);
    
    // Log the complete file path that will be used
    const fullPath = path.join(__dirname, '..', 'uploads', filename);
    console.log('Full file path will be:', fullPath);
    
    cb(null, filename);
  }
});

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

// Get all gallery items
router.get('/', async (req, res) => {
  try {
    console.log('Fetching gallery items...');
    const items = await Gallery.find().sort({ createdAt: -1 });
    console.log(`Found ${items.length} gallery items`);

    // Add full URLs to the items
    const itemsWithUrls = items.map(item => {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
      const host = process.env.NODE_ENV === 'production' 
        ? 'backendchetan.onrender.com'
        : req.get('host');
      const fullUrl = `${protocol}://${host}${item.image}`;
      
      return {
        ...item.toObject(),
        imageUrl: fullUrl
      };
    });

    res.json(itemsWithUrls);
  } catch (err) {
    console.error('Error fetching gallery items:', err);
    res.status(500).json({ message: err.message });
  }
});

// Add file existence check middleware
const checkFileExists = (req, res, next) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
  console.log('Checking if file exists at:', filePath);
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found after upload:', filePath);
    return res.status(500).json({ message: 'File upload failed - file not found after save' });
  }

  console.log('File exists at:', filePath);
  next();
};

// Add new gallery item
router.post('/', upload.single('image'), checkFileExists, async (req, res) => {
  try {
    console.log('Processing gallery item creation');
    console.log('Request body:', req.body);
    console.log('File details:', req.file);

    const { title, description } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ message: 'Title is required' });
    }

    // Construct the image path and URL
    const image = `/uploads/${req.file.filename}`;
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = process.env.NODE_ENV === 'production' 
      ? 'backendchetan.onrender.com'
      : req.get('host');
    const imageUrl = `${protocol}://${host}${image}`;
    
    console.log('Image path:', image);
    console.log('Full image URL:', imageUrl);

    const galleryItem = new Gallery({
      title,
      description: description || '',
      image,
      imageUrl
    });

    const savedItem = await galleryItem.save();
    console.log('Gallery item saved successfully:', savedItem);

    res.status(201).json(savedItem);
  } catch (err) {
    console.error('Error in gallery item creation:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update gallery item
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    console.log('Updating gallery item:', req.params.id);
    console.log('Update data:', req.body);
    console.log('File:', req.file);

    const existingItem = await Gallery.findById(req.params.id);
    if (!existingItem) {
      console.error('Gallery item not found:', req.params.id);
      return res.status(404).json({ message: 'Gallery item not found' });
    }

    const updateData = {
      title: req.body.title || existingItem.title,
      description: req.body.description || existingItem.description
    };

    if (req.file) {
      // Delete old image if it exists
      if (existingItem.image) {
        const oldImagePath = path.join(uploadsDir, path.basename(existingItem.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('Deleted old image:', oldImagePath);
        }
      }

      // Verify new file was saved
      const newFilePath = path.join(uploadsDir, req.file.filename);
      if (!fs.existsSync(newFilePath)) {
        console.error('New file was not saved:', newFilePath);
        return res.status(500).json({ message: 'File upload failed - file not found after save' });
      }
      console.log('New file saved successfully at:', newFilePath);

      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedItem = await Gallery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Return the full item data including the complete image URL
    const fullItem = {
      ...updatedItem.toObject(),
      imageUrl: `${req.protocol}://${req.get('host')}${updatedItem.image}`
    };

    console.log('Gallery item updated successfully:', fullItem);
    res.json(fullItem);
  } catch (err) {
    console.error('Error updating gallery item:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete gallery item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) {
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
    console.log('Gallery item deleted successfully:', req.params.id);
    res.json({ message: 'Gallery item deleted successfully' });
  } catch (err) {
    console.error('Error deleting gallery item:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete all gallery items
router.delete('/', async (req, res) => {
  try {
    // Get all items to get their image paths
    const items = await Gallery.find();
    
    // Delete all image files
    for (const item of items) {
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
