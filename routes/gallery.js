// const express = require('express');
// const router = express.Router();
// const Gallery = require('../models/Gallery');
// const multer = require('multer');
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const auth = require('../middleware/auth');

// // Cloudinary Config
// cloudinary.config({
//   cloud_name: 'Root',
//   api_key: '454217581167662',
//   api_secret: 'MahFoEMfadEXCVMfKS0xgcxF1z8'
// });

// // Cloudinary Storage
// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'gallery',
//     allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
//     format: 'jpg',
//     transformation: [{ quality: 'auto' }],
//     public_id: (req, file) => {
//       const timestamp = Date.now();
//       return `project-${timestamp}`;
//     },
//   },
// });

// const upload = multer({ storage });

// // Get all gallery items
// router.get('/', async (req, res) => {
//   try {
//     const gallery = await Gallery.find().sort({ createdAt: -1 });
//     res.json({ success: true, data: gallery });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Upload new image to Cloudinary
// router.post('/', auth, upload.single('image'), async (req, res) => {
//   try {
//     const { title, description, category, section, year } = req.body;

//     if (!req.file) {
//       return res.status(400).json({ success: false, message: 'Image upload failed' });
//     }

//     // Get the timestamp and create URLs
//     const timestamp = Date.now();
//     const imagePath = `/uploads/project-${timestamp}.jpg`;
//     const imageUrl = `http://www.chethancinemas.com${imagePath}`;

//     const newGalleryItem = new Gallery({
//       title,
//       description,
//       image: req.file.path, // Use Cloudinary URL for image field
//       imageUrl: imageUrl, // Keep the chethancinemas.com URL format
//       cloudinaryUrl: req.file.path, // Store Cloudinary URL
//       category: category || 'Regular',
//       section: section || 'Regular',
//       completed: false,
//       year: year || new Date().getFullYear().toString(),
//     });

//     const savedItem = await newGalleryItem.save();
//     console.log('Saved gallery item:', savedItem);
//     res.status(201).json({ success: true, message: 'Image uploaded', data: savedItem });

//   } catch (error) {
//     console.error('Upload error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Delete one
// router.delete('/:id', auth, async (req, res) => {
//   try {
//     const item = await Gallery.findById(req.params.id);
//     if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

//     if (item.cloudinaryUrl) {
//       const publicId = `gallery/${item.cloudinaryUrl.split('/').pop().split('.')[0]}`;
//       await cloudinary.uploader.destroy(publicId);
//     }

//     await item.deleteOne();
//     res.json({ success: true, message: 'Item deleted' });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // Delete all
// router.delete('/all', auth, async (req, res) => {
//   try {
//     const all = await Gallery.find();
//     for (const item of all) {
//       if (item.cloudinaryUrl) {
//         const publicId = `gallery/${item.cloudinaryUrl.split('/').pop().split('.')[0]}`;
//         await cloudinary.uploader.destroy(publicId);
//       }
//     }
//     await Gallery.deleteMany();
//     res.json({ success: true, message: 'All items deleted' });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();
const Gallery = require('../models/Gallery');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const auth = require('../middleware/auth');
const sanitize = require('../middleware/sanitize');
// routes/gallery.js
// const sanitize = require('../middleware/sanitize');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'chetan-cinemas/gallery',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [
        { width: 1920, height: 1080, crop: 'limit', quality: 'auto' }
      ],
      public_id: `gallery-${Date.now()}`,
      resource_type: 'auto'
    };
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Error handling middleware for multer
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' 
        ? 'File size too large. Max 5MB allowed.' 
        : 'File upload error'
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }
  next();
};

// Get all gallery items with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, section, year, search } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (section) query.section = section;
    if (year) query.year = year;
    if (search) {
      query.$text = { $search: search };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      lean: true
    };

    const result = await Gallery.paginate(query, options);

    res.json({
      success: true,
      data: result.docs,
      total: result.totalDocs,
      pages: result.totalPages,
      page: result.page
    });
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching gallery items'
    });
  }
});

// Upload new image to Cloudinary and save to MongoDB
router.post(
  '/',
  auth,
  sanitize,
  upload.single('image'),
  handleUploadErrors,
  async (req, res) => {
    try {
      const { title, description, category, section, year } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded or upload failed'
        });
      }

      // Create new gallery item with Cloudinary details
      const newGalleryItem = new Gallery({
        title,
        description,
        cloudinaryUrl: req.file.path,
        cloudinaryPublicId: req.file.filename,
        category: category || 'Regular',
        section: section || 'Regular',
        year: year || new Date().getFullYear().toString(),
        format: req.file.format,
        width: req.file.width,
        height: req.file.height,
        bytes: req.file.size
      });

      const savedItem = await newGalleryItem.save();

      res.status(201).json({
        success: true,
        message: 'Image uploaded successfully',
        data: savedItem
      });
    } catch (error) {
      console.error('Upload error:', error);
      
      // If MongoDB save failed, delete the uploaded image from Cloudinary
      if (req.file && req.file.filename) {
        try {
          await cloudinary.uploader.destroy(req.file.filename);
        } catch (cloudinaryErr) {
          console.error('Error cleaning up Cloudinary upload:', cloudinaryErr);
        }
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to save gallery item'
      });
    }
  }
);

// Update gallery item metadata
router.put('/:id', auth, sanitize, async (req, res) => {
  try {
    const { title, description, category, section, year } = req.body;
    
    const updatedItem = await Gallery.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        category,
        section,
        year
      },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }

    res.json({
      success: true,
      message: 'Gallery item updated',
      data: updatedItem
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update gallery item'
    });
  }
});

// Delete gallery item
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }

    // First delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(item.cloudinaryPublicId);
    } catch (cloudinaryErr) {
      console.error('Cloudinary deletion error:', cloudinaryErr);
      // Continue with MongoDB deletion even if Cloudinary fails
    }

    // Then delete from MongoDB
    await item.deleteOne();

    res.json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
  } catch (error) {
    console.error('Deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete gallery item'
    });
  }
});

module.exports = router;