const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required']
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    required: [true, 'Image path is required']
  },
  imageUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Add error handling middleware
gallerySchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('A gallery item with this title already exists'));
  } else {
    next(error);
  }
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
