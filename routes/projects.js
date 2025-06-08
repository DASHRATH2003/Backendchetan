const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Get the uploads directory path
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log('Processing file upload:', file.originalname);
    const allowedTypes = /jpeg|jpg|png|gif|webp/i;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      console.log('File accepted:', file.originalname, 'Mimetype:', file.mimetype);
      return cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, 'Mimetype:', file.mimetype);
      cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Helper function to generate full image URL
const getImageUrl = (req, imagePath) => {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const host = process.env.NODE_ENV === 'production' 
    ? 'backendchetan.onrender.com'
    : req.get('host');
  return `${protocol}://${host}${imagePath}`;
};

// Get all projects
router.get('/', async (req, res) => {
  try {
    console.log('Fetching projects...');
    const projects = await Project.find().sort({ createdAt: -1 });
    console.log(`Found ${projects.length} projects`);
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ message: err.message });
  }
});

// Add new project
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('Received project creation request');
    console.log('Request body:', req.body);
    console.log('File details:', req.file);

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ message: 'Image is required' });
    }

    const { title, description, category, section, completed, year } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!category) {
      console.error('Category is missing');
      return res.status(400).json({ message: 'Category is required' });
    }

    // Upload image to Cloudinary
    console.log('Uploading image to Cloudinary...');
    const cloudinaryResult = await uploadToCloudinary(req.file, 'projects');
    console.log('Cloudinary upload result:', cloudinaryResult);

    // Create project with Cloudinary URL
    const projectData = {
      title,
      description: description || '',
      image: cloudinaryResult.url,
      cloudinary_id: cloudinaryResult.public_id,
      category,
      section: section || 'Featured',
      completed: completed === 'true',
      year: year || new Date().getFullYear().toString()
    };

    console.log('Creating project with data:', projectData);

    const project = new Project(projectData);
    console.log('Project model created:', project);

    const savedProject = await project.save();
    console.log('Project saved successfully:', savedProject);
    
    return res.status(201).json({
      success: true,
      data: savedProject,
      message: 'Project created successfully'
    });

  } catch (err) {
    console.error('Error in project creation:', err);

    // Send appropriate error response
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error', 
        errors: Object.keys(err.errors).reduce((acc, key) => {
          acc[key] = err.errors[key].message;
          return acc;
        }, {})
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Update project
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    console.log('Updating project:', req.params.id);
    console.log('Update data:', req.body);
    console.log('File:', req.file);

    const existingProject = await Project.findById(req.params.id);
    if (!existingProject) {
      console.error('Project not found:', req.params.id);
      return res.status(404).json({ message: 'Project not found' });
    }

    const updateData = {
      title: req.body.title || existingProject.title,
      description: req.body.description || existingProject.description,
      category: req.body.category || existingProject.category,
      section: req.body.section || existingProject.section,
      completed: req.body.completed === 'true',
      year: req.body.year || existingProject.year
    };

    if (req.file) {
      // Delete old image from Cloudinary
      if (existingProject.cloudinary_id) {
        await deleteFromCloudinary(existingProject.cloudinary_id);
        console.log('Deleted old image from Cloudinary:', existingProject.cloudinary_id);
      }

      // Upload new image to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(req.file, 'projects');
      console.log('Uploaded new image to Cloudinary:', cloudinaryResult);

      updateData.image = cloudinaryResult.url;
      updateData.cloudinary_id = cloudinaryResult.public_id;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedProject);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    console.log('Attempting to delete project:', req.params.id);

    const project = await Project.findById(req.params.id);
    if (!project) {
      console.log('Project not found:', req.params.id);
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log('Found project to delete:', {
      id: project._id,
      title: project.title,
      cloudinary_id: project.cloudinary_id
    });

    // Delete image from Cloudinary
    if (project.cloudinary_id) {
      await deleteFromCloudinary(project.cloudinary_id);
      console.log('Successfully deleted image from Cloudinary');
    }

    // Delete the project from database
    console.log('Deleting project from database...');
    const deleteResult = await Project.deleteOne({ _id: req.params.id });
    console.log('Delete result:', deleteResult);

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or already deleted'
      });
    }

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error while deleting project'
    });
  }
});

// Delete all projects
router.delete('/', async (req, res) => {
  try {
    // Get all projects to delete their Cloudinary images
    const projects = await Project.find();
    
    // Delete all images from Cloudinary
    for (const project of projects) {
      if (project.cloudinary_id) {
        await deleteFromCloudinary(project.cloudinary_id);
      }
    }

    // Delete all projects from database
    await Project.deleteMany({});
    
    res.json({ message: 'All projects deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cleanup endpoint to remove entries with missing files
router.post('/cleanup', async (req, res) => {
  try {
    const projects = await Project.find();
    const removedCount = { total: 0 };

    for (const project of projects) {
      if (project.image) {
        const imagePath = path.join(uploadsDir, path.basename(project.image));
        if (!fs.existsSync(imagePath)) {
          console.log('Removing project entry with missing file:', project.image);
          await Project.findByIdAndDelete(project._id);
          removedCount.total++;
        }
      }
    }

    res.json({ 
      message: 'Cleanup completed successfully', 
      removedEntries: removedCount.total 
    });
  } catch (err) {
    console.error('Error during cleanup:', err);
    res.status(500).json({ message: err.message });
  }
});

// Add Same To Same project
router.post('/same-to-same', async (req, res) => {
  try {
    // Read the image file
    const imagePath = path.join(__dirname, '..', 'uploads', 'project-clothnearya.jpeg');
    const imageBuffer = await fs.promises.readFile(imagePath);

    // Create a unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const filename = `project-${timestamp}-${randomString}.jpeg`;
    const newImagePath = path.join(__dirname, '..', 'uploads', filename);

    // Save the image
    await fs.promises.writeFile(newImagePath, imageBuffer);

    // Create project data
    const projectData = {
      title: 'Same To Same',
      description: 'Same To Same - A captivating advertisement for Clothnearya',
      image: `/uploads/${filename}`,
      imageUrl: `http://localhost:5000/uploads/${filename}`,
      category: 'Advertisement',
      section: 'Featured',
      completed: true,
      year: new Date().getFullYear().toString()
    };

    // Create and save the project
    const project = new Project(projectData);
    const savedProject = await project.save();

    res.status(201).json({
      success: true,
      data: savedProject,
      message: 'Same To Same project created successfully'
    });
  } catch (err) {
    console.error('Error creating Same To Same project:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create Same To Same project',
      error: err.message
    });
  }
});

module.exports = router;