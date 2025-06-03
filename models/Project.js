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
    required: [true, 'Image path is required'],
    validate: {
      validator: function(v) {
        return v.startsWith('/uploads/');
      },
      message: 'Image path must start with /uploads/'
    }
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required'],
    validate: {
      validator: function(v) {
        return v.startsWith('http://') || v.startsWith('https://');
      },
      message: 'Image URL must be a valid HTTP/HTTPS URL'
    }
  },
  category: {
    type: String,
    trim: true,
    default: ''
  },
  section: {
    type: String,
    enum: ['Banner', 'Featured', 'Regular'],
    default: 'Banner'
  },
  completed: {
    type: Boolean,
    default: false
  },
  year: {
    type: String,
    default: () => new Date().getFullYear().toString()
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

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
