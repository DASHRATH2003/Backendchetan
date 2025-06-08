// middleware/validation.js
const Joi = require('joi');

const galleryItemSchema = Joi.object({
  title: Joi.string().required().max(100).messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 100 characters'
  }),
  description: Joi.string().allow('').max(500).messages({
    'string.max': 'Description cannot exceed 500 characters'
  }),
  category: Joi.string().valid(
    'events', 
    'movies', 
    'celebrations', 
    'awards', 
    'behind-the-scenes',
    'other'
  ).required().messages({
    'any.required': 'Category is required',
    'any.only': 'Category must be one of: events, movies, celebrations, awards, behind-the-scenes, other'
  }),
  section: Joi.string().valid(
    'home', 
    'gallery', 
    'about', 
    'events'
  ).default('gallery').messages({
    'any.only': 'Section must be one of: home, gallery, about, events'
  }),
  year: Joi.number().integer().min(2000).max(new Date().getFullYear()).messages({
    'number.base': 'Year must be a number',
    'number.integer': 'Year must be a whole number',
    'number.min': 'Year must be after 2000',
    'number.max': `Year cannot be in the future`
  })
});

const validateGalleryItem = (req, res, next) => {
  try {
    const { error } = galleryItemSchema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true // Remove unknown fields
    });
    
    if (error) {
      const messages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. ')
      });
    }

    // Log validated data
    console.log('Validated gallery item data:', req.body);
    
    next();
  } catch (err) {
    console.error('Validation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during validation'
    });
  }
};

module.exports = {
  validateGalleryItem
};