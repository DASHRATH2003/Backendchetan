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
    required: [true, 'Image is required']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
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

// Add a pre-save middleware to clean up image paths and set imageUrl
gallerySchema.pre('save', function(next) {
  if (this.image) {
    // If it's already a full URL, leave it as is
    if (this.image.startsWith('http')) {
      this.imageUrl = this.image;
      next();
      return;
    }
    
    // Clean up the path and ensure it starts with /uploads/
    const cleanPath = this.image.replace(/^\/+/, '').replace(/^uploads\//, '');
    this.image = `/uploads/${cleanPath}`;
    
    // Set the imageUrl based on environment
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://chetanbackend.onrender.com' 
      : 'http://localhost:5000';
    this.imageUrl = `${baseUrl}${this.image}`;
  }
  next();
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
