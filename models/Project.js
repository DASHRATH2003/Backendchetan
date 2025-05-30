const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
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
    maxlength: [1000, 'Description cannot be more than 1000 characters']
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
  category: {
    type: String,
    default: '',
    trim: true,
    maxlength: [50, 'Category cannot be more than 50 characters']
  },
  section: {
    type: String,
    default: 'Banner',
    trim: true,
    enum: {
      values: ['Banner', 'Featured', 'Regular'],
      message: '{VALUE} is not a valid section'
    }
  },
  completed: {
    type: Boolean,
    default: false
  },
  year: {
    type: String,
    default: () => new Date().getFullYear().toString(),
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{4}$/.test(v);
      },
      message: 'Year must be a 4-digit number'
    }
  }
}, {
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Add error handling middleware
projectSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('A project with this title already exists'));
  } else {
    next(error);
  }
});

// Virtual for full image URL
projectSchema.virtual('imageUrl').get(function() {
  if (!this.image) return null;
  const baseUrl = process.env.BACKEND_URL || 'https://chetanbackend.onrender.com';
  return this.image.startsWith('http') ? this.image : `${baseUrl}${this.image}`;
});

// Ensure indexes
projectSchema.index({ title: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ section: 1 });
projectSchema.index({ year: 1 });

const Project = mongoose.model('Project', projectSchema);

// Create indexes
Project.createIndexes().catch(err => {
  console.error('Error creating indexes:', err);
});

module.exports = Project;
