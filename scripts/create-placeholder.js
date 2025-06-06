const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create a 300x300 gray placeholder image
sharp({
  create: {
    width: 300,
    height: 300,
    channels: 4,
    background: { r: 200, g: 200, b: 200, alpha: 1 }
  }
})
.webp()
.toFile(path.join(uploadsDir, 'placeholder.webp'))
.then(() => console.log('Placeholder image created successfully'))
.catch(err => console.error('Error creating placeholder:', err)); 