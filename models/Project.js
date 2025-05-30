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
    required: true
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full image URL
projectSchema.virtual('imageUrl').get(function() {
  if (!this.image) return null;
  return `${process.env.BACKEND_URL || 'https://chetanbackend.onrender.com'}${this.image}`;
});

module.exports = mongoose.model('Project', projectSchema);
