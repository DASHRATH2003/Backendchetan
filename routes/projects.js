const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');

// Get the uploads directory path
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    const projectsWithUrls = projects.map(project => ({
      ...project.toObject(),
      imageUrl: `${process.env.BACKEND_URL || 'https://chetanbackend.onrender.com'}${project.image}`
    }));
    res.json(projectsWithUrls);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

// Add new project
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, section, completed, year } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }
    
    const image = `/uploads/${req.file.filename}`;
    
    const project = new Project({
      title,
      description,
      image,
      category,
      section: section || 'Banner',
      completed: completed === 'true',
      year: year || new Date().getFullYear().toString()
    });

    const savedProject = await project.save();
    const projectWithUrl = {
      ...savedProject.toObject(),
      imageUrl: `${process.env.BACKEND_URL || 'https://chetanbackend.onrender.com'}${savedProject.image}`
    };
    res.status(201).json(projectWithUrl);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(400).json({ message: 'Error creating project' });
  }
});

// Update project
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, section, completed, year } = req.body;
    
    const existingProject = await Project.findById(req.params.id);
    if (!existingProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const updateData = {
      title: title || existingProject.title,
      description: description || existingProject.description,
      category: category || existingProject.category,
      section: section || existingProject.section,
      completed: completed === 'true',
      year: year || existingProject.year
    };
    
    if (req.file) {
      // Delete old image if it exists
      if (existingProject.image) {
        const oldImagePath = path.join(uploadsDir, path.basename(existingProject.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    const projectWithUrl = {
      ...updatedProject.toObject(),
      imageUrl: `${process.env.BACKEND_URL || 'https://chetanbackend.onrender.com'}${updatedProject.image}`
    };
    res.json(projectWithUrl);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(400).json({ message: 'Error updating project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Delete the image file if it exists
    if (project.image) {
      const imagePath = path.join(uploadsDir, path.basename(project.image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ message: 'Error deleting project' });
  }
});

// Delete all projects and their images
router.delete('/all', async (req, res) => {
  try {
    // Get all projects to get their image paths
    const projects = await Project.find();
    
    // Delete all image files
    for (const project of projects) {
      if (project.image) {
        const imagePath = path.join(uploadsDir, path.basename(project.image));
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }

    // Delete all projects from database
    await Project.deleteMany({});
    
    res.json({ message: 'All projects deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;