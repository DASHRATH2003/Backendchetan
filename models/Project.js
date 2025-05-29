const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: ''
  },
  section: {
    type: String,
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
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
