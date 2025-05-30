const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  image: {
    type: String,
    required: [true, 'Image is required'],
    validate: {
      validator: function(v) {
        return v && (v.startsWith('http') || v.startsWith('/uploads/'));
      },
      message: 'Invalid image path format'
    },
    get: function(image) {
      if (!image) return null;

      // If it's already a full URL, return as is
      if (image.startsWith('http')) {
        return image;
      }

      // Ensure the path starts with /uploads/
      if (!image.startsWith('/uploads/')) {
        image = '/uploads/' + image.replace(/^\/+/, '');
      }

      // Use the production URL for deployed version
      const baseUrl = process.env.BACKEND_URL || 'https://chetanbackend.onrender.com';
      return `${baseUrl}${image}`;
    }
  },
  alt: {
    type: String,
    trim: true,
    default: function() {
      return this.title || 'Gallery image';
    }
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

// Virtual for full image URL
gallerySchema.virtual('imageUrl').get(function() {
  if (!this.image) return null;
  const baseUrl = process.env.BACKEND_URL || 'https://chetanbackend.onrender.com';
  return this.image.startsWith('http') ? this.image : `${baseUrl}${this.image}`;
});

// Ensure indexes
gallerySchema.index({ title: 1 });
gallerySchema.index({ createdAt: -1 });

const Gallery = mongoose.model('Gallery', gallerySchema);

// Create indexes
Gallery.createIndexes().catch(err => {
  console.error('Error creating indexes:', err);
});

module.exports = Gallery;
