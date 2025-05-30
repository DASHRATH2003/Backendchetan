const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  image: {
    type: String,
    required: true,
    get: function(image) {
      // If it's already a full URL, return as is
      if (image && image.startsWith('http')) {
        return image;
      }
      // If it's a relative path, ensure it starts with /uploads/
      if (image && !image.startsWith('/uploads/')) {
        image = '/uploads/' + image.replace(/^\/+/, '');
      }
      // Return the full URL
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      return `${baseUrl}${image}`;
    }
  },
  alt: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Virtual for full image URL
gallerySchema.virtual('imageUrl').get(function() {
  if (!this.image) return null;
  return `${process.env.BACKEND_URL || 'https://chetanbackend.onrender.com'}${this.image}`;
});

module.exports = mongoose.model('Gallery', gallerySchema);
