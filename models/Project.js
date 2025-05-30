const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
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
      const baseUrl = 'https://chetanbackend.onrender.com';
      return `${baseUrl}${image}`;
    }
  },
  category: {
    type: String,
    default: '',
    trim: true
  },
  section: {
    type: String,
    default: 'Banner',
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  year: {
    type: String,
    default: () => new Date().getFullYear().toString(),
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Virtual for full image URL
projectSchema.virtual('imageUrl').get(function() {
  if (!this.image) return null;
  return `${process.env.BACKEND_URL || 'https://chetanbackend.onrender.com'}${this.image}`;
});

module.exports = mongoose.model('Project', projectSchema);
