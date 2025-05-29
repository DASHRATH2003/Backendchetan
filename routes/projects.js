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
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Get all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new project
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, section, completed, year } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    
    if (!title) {
      throw new Error('Title is required');
    }

    if (!req.file) {
      throw new Error('Image is required');
    }
    
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
    res.status(201).json(savedProject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update project
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, section, completed, year } = req.body;
    
    // Get the existing project
    const existingProject = await Project.findById(req.params.id);
    
    if (!existingProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Prepare update data
    const updateData = {
      title: title || existingProject.title,
      description: description || existingProject.description,
      category: category || existingProject.category,
      section: section || existingProject.section,
      completed: completed === 'true',
      year: year || existingProject.year
    };
    
    // If there's a new image
    if (req.file) {
      // Delete the old image if it exists
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

    res.json(updatedProject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    // Get the project first to get the image path
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

    // Delete the project from the database
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
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