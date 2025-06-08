// models/Gallery.js
const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  image: {
    type: String,
    required: [true, 'Image URL is required'],
    validate: {
      validator: function(v) {
        return v && v.startsWith('http');
      },
      message: 'Image URL must be a valid URL'
    }
  },
  cloudinary_id: {
    type: String,
    required: [true, 'Cloudinary ID is required']
  },
  category: {
    type: String,
    trim: true,
    required: [true, 'Category is required']
  },
  createdBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Add error handling middleware
gallerySchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('A gallery item with this title already exists'));
  } else {
    next(error);
  }
});

// Add pre-remove middleware to clean up Cloudinary images
gallerySchema.pre('remove', async function(next) {
  try {
    if (this.cloudinary_id) {
      const { deleteFromCloudinary } = require('../config/cloudinary');
      await deleteFromCloudinary(this.cloudinary_id);
      console.log('Successfully deleted image from Cloudinary:', this.cloudinary_id);
    }
    next();
  } catch (err) {
    console.error('Error deleting image from Cloudinary:', err);
    next(err);
  }
});

const Gallery = mongoose.model('Gallery', gallerySchema);

module.exports = Gallery;