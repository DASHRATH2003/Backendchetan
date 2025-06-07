// const mongoose = require('mongoose');

// const gallerySchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: [true, 'Title is required']
//   },
//   description: {
//     type: String,
//     default: ''
//   },
//   image: {
//     type: String,
//     required: [true, 'Image path is required']
//   },
//   imageUrl: {
//     type: String,
//     required: [true, 'Image URL is required']
//   },
//   cloudinaryUrl: {
//     type: String,
//     required: [true, 'Cloudinary URL is required']
//   },
//   category: {
//     type: String,
//     default: 'Regular'
//   },
//   section: {
//     type: String,
//     default: 'Regular'
//   },
//   completed: {
//     type: Boolean,
//     default: false
//   },
//   year: {
//     type: String,
//     default: new Date().getFullYear().toString()
//   }
// }, {
//   timestamps: true
// });

// // Add error handling middleware
// gallerySchema.post('save', function(error, doc, next) {
//   if (error.name === 'MongoServerError' && error.code === 11000) {
//     next(new Error('A gallery item with this title already exists'));
//   } else {
//     next(error);
//   }
// });

// // Ensure indexes
// gallerySchema.index({ title: 1 });
// gallerySchema.index({ createdAt: -1 });

// const Gallery = mongoose.model('Gallery', gallerySchema);

// // Create indexes
// Gallery.createIndexes().catch(err => {
//   console.error('Error creating indexes:', err);
// });

// module.exports = Gallery;




const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  cloudinaryUrl: {
    type: String,
    required: [true, 'Cloudinary URL is required']
  },
  cloudinaryPublicId: {
    type: String,
    required: [true, 'Cloudinary Public ID is required']
  },
  category: {
    type: String,
    default: 'Regular',
    trim: true
  },
  section: {
    type: String,
    default: 'Regular',
    trim: true
  },
  year: {
    type: String,
    default: new Date().getFullYear().toString(),
    trim: true
  },
  format: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    required: true
  },
  height: {
    type: Number,
    required: true
  },
  bytes: {
    type: Number,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for frontend URL
gallerySchema.virtual('imageUrl').get(function() {
  return this.cloudinaryUrl;
});

// Indexes
gallerySchema.index({ title: 'text', description: 'text' });
gallerySchema.index({ createdAt: -1 });
gallerySchema.index({ category: 1 });
gallerySchema.index({ section: 1 });
gallerySchema.index({ year: 1 });

// Pre-save hook for validation
gallerySchema.pre('save', function(next) {
  if (!this.cloudinaryUrl || !this.cloudinaryPublicId) {
    throw new Error('Cloudinary URL and Public ID are required');
  }
  next();
});

const Gallery = mongoose.model('Gallery', gallerySchema);

module.exports = Gallery;