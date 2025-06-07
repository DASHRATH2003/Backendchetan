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




// const mongoose = require('mongoose');

// const gallerySchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: [true, 'Title is required'],
//     trim: true
//   },
//   description: {
//     type: String,
//     default: '',
//     trim: true
//   },
//   cloudinaryUrl: {
//     type: String,
//     required: [true, 'Cloudinary URL is required']
//   },
//   cloudinaryPublicId: {
//     type: String,
//     required: [true, 'Cloudinary Public ID is required']
//   },
//   category: {
//     type: String,
//     default: 'Regular',
//     trim: true
//   },
//   section: {
//     type: String,
//     default: 'Regular',
//     trim: true
//   },
//   year: {
//     type: String,
//     default: new Date().getFullYear().toString(),
//     trim: true
//   },
//   format: {
//     type: String,
//     required: true
//   },
//   width: {
//     type: Number,
//     required: true
//   },
//   height: {
//     type: Number,
//     required: true
//   },
//   bytes: {
//     type: Number,
//     required: true
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// // Virtual for frontend URL
// gallerySchema.virtual('imageUrl').get(function() {
//   return this.cloudinaryUrl;
// });

// // Indexes
// gallerySchema.index({ title: 'text', description: 'text' });
// gallerySchema.index({ createdAt: -1 });
// gallerySchema.index({ category: 1 });
// gallerySchema.index({ section: 1 });
// gallerySchema.index({ year: 1 });

// // Pre-save hook for validation
// gallerySchema.pre('save', function(next) {
//   if (!this.cloudinaryUrl || !this.cloudinaryPublicId) {
//     throw new Error('Cloudinary URL and Public ID are required');
//   }
//   next();
// });

// const Gallery = mongoose.model('Gallery', gallerySchema);

// module.exports = Gallery;

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  cloudinaryUrl: {
    type: String,
    required: [true, 'Cloudinary URL is required'],
    validate: {
      validator: function(v) {
        return /^https?:\/\//.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  cloudinaryPublicId: {
    type: String,
    required: [true, 'Cloudinary Public ID is required']
  },
  category: {
    type: String,
    default: 'Regular',
    trim: true,
    enum: {
      values: ['Regular', 'Featured', 'Special', 'Event'],
      message: '{VALUE} is not a valid category'
    }
  },
  section: {
    type: String,
    default: 'Regular',
    trim: true,
    enum: {
      values: ['Regular', 'Promotions', 'BehindTheScenes', 'Events'],
      message: '{VALUE} is not a valid section'
    }
  },
  year: {
    type: String,
    default: new Date().getFullYear().toString(),
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{4}$/.test(v);
      },
      message: props => `${props.value} is not a valid year!`
    }
  },
  format: {
    type: String,
    required: true,
    enum: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  },
  width: {
    type: Number,
    required: true,
    min: [1, 'Width must be at least 1']
  },
  height: {
    type: Number,
    required: true,
    min: [1, 'Height must be at least 1']
  },
  bytes: {
    type: Number,
    required: true,
    min: [1, 'File size must be at least 1 byte']
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.updatedAt;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual for frontend URL
gallerySchema.virtual('imageUrl').get(function() {
  return this.cloudinaryUrl;
});

// Text search index
gallerySchema.index({ title: 'text', description: 'text' });

// Query performance indexes
gallerySchema.index({ createdAt: -1 });
gallerySchema.index({ category: 1 });
gallerySchema.index({ section: 1 });
gallerySchema.index({ year: 1 });
gallerySchema.index({ cloudinaryPublicId: 1 }, { unique: true });

// Error handling middleware
gallerySchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Duplicate key error: This item already exists'));
  } else {
    next(error);
  }
});

// Add pagination plugin
gallerySchema.plugin(mongoosePaginate);

const Gallery = mongoose.model('Gallery', gallerySchema);

// Create indexes in background
Gallery.createIndexes()
  .then(() => console.log('Gallery indexes created'))
  .catch(err => console.error('Error creating gallery indexes:', err));

module.exports = Gallery;