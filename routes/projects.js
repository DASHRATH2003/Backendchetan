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
  console.log('Created uploads directory:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory exists before saving
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    console.log('Saving file to:', uploadsDir);
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}${ext}`;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

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

// Get all projects
router.get('/', async (req, res) => {
  try {
    console.log('Fetching projects...');
    const projects = await Project.find().sort({ createdAt: -1 });
    console.log(`Found ${projects.length} projects`);

    // Add full URLs to the projects
    const projectsWithUrls = projects.map(project => {
      const fullUrl = `${req.protocol}://${req.get('host')}${project.image}`;
      return {
        ...project.toObject(),
        imageUrl: fullUrl
      };
    });

    res.json(projectsWithUrls);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ message: err.message });
  }
});

// Add new project
router.post('/', upload.single('image'), async (req, res) => {
  let uploadedFilePath = null;
  
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

    // Store the uploaded file path for potential cleanup
    uploadedFilePath = path.join(uploadsDir, req.file.filename);
    
    // Verify file was saved
    console.log('Checking if file exists at:', uploadedFilePath);
    if (!fs.existsSync(uploadedFilePath)) {
      console.error('File was not saved:', uploadedFilePath);
      return res.status(500).json({ message: 'File upload failed - file not found after save' });
    }
    
    // Verify file is readable
    try {
      await fs.promises.access(uploadedFilePath, fs.constants.R_OK);
      console.log('File is readable:', uploadedFilePath);
    } catch (err) {
      console.error('File is not readable:', err);
      return res.status(500).json({ message: 'File upload failed - file not readable' });
    }

    // Get file stats
    const stats = await fs.promises.stat(uploadedFilePath);
    console.log('File stats:', {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    });

    // Construct the image path and URL
    const image = `/uploads/${req.file.filename}`;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://chetanbackend.onrender.com' 
      : `${protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}${image}`;
    
    console.log('Image path:', image);
    console.log('Base URL:', baseUrl);
    console.log('Full image URL:', imageUrl);

    // Create project with all required fields
    const projectData = {
      title,
      description: description || '',
      image,
      imageUrl,
      category: category || '',
      section: section || 'Banner',
      completed: completed === 'true',
      year: year || new Date().getFullYear().toString()
    };

    console.log('Creating project with data:', projectData);

    const project = new Project(projectData);
    console.log('Project model created:', project);

    const savedProject = await project.save();
    console.log('Project saved successfully:', savedProject);
    
    return res.status(201).json(savedProject);

  } catch (err) {
    console.error('Error in project creation:', err);

    // Clean up uploaded file if it exists and there was an error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
        console.log('Cleaned up uploaded file after error');
      } catch (cleanupErr) {
        console.error('Error cleaning up file:', cleanupErr);
      }
    }

    // Send appropriate error response
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.keys(err.errors).reduce((acc, key) => {
          acc[key] = err.errors[key].message;
          return acc;
        }, {})
      });
    }

    return res.status(500).json({ 
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
      // Delete old image if it exists
      if (existingProject.image) {
        const oldImagePath = path.join(uploadsDir, path.basename(existingProject.image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('Deleted old image:', oldImagePath);
        }
      }

      // Verify new file was saved
      const newFilePath = path.join(uploadsDir, req.file.filename);
      if (!fs.existsSync(newFilePath)) {
        console.error('New file was not saved:', newFilePath);
        return res.status(500).json({ message: 'File upload failed - file not found after save' });
      }
      console.log('New file saved successfully at:', newFilePath);

      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Return the full item data including the complete image URL
    const fullItem = {
      ...updatedProject.toObject(),
      imageUrl: `${req.protocol}://${req.get('host')}${updatedProject.image}`
    };

    console.log('Project updated successfully:', fullItem);
    res.json(fullItem);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ message: err.message });
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
        console.log('Deleted image file:', imagePath);
      }
    }

    await Project.findByIdAndDelete(req.params.id);
    console.log('Project deleted successfully:', req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete all projects
router.delete('/', async (req, res) => {
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

module.exports = router;