const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dqspnxe8q',
  api_key: '258645347112294',
  api_secret: 'HQDoxiGeUZDYBtuLybjdbFbJWiY'
});

// Validate configuration
const validateConfig = async () => {
  try {
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary configuration is valid:', result);
    return true;
  } catch (error) {
    console.error('❌ Cloudinary configuration error:', error);
    throw new Error('Invalid Cloudinary configuration. Please check your credentials.');
  }
};

// Run validation
validateConfig().catch(err => {
  console.error('Failed to validate Cloudinary config:', err);
  process.exit(1); // Exit if Cloudinary is not configured correctly
});

// Upload function
const uploadToCloudinary = async (file, folder = 'general') => {
  try {
    if (!file || !file.buffer) {
      throw new Error('No file provided or invalid file format');
    }

    // Convert the file buffer to base64
    const fileStr = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    // Upload to Cloudinary with transformation
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: folder,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      overwrite: true,
      transformation: [
        { quality: 'auto:best' }, // Automatic quality optimization
        { fetch_format: 'auto' }  // Automatic format optimization
      ]
    });

    console.log('✅ Successfully uploaded to Cloudinary:', {
      public_id: uploadResponse.public_id,
      url: uploadResponse.secure_url,
      format: uploadResponse.format,
      size: uploadResponse.bytes
    });

    return {
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id
    };
  } catch (err) {
    console.error('❌ Error uploading to Cloudinary:', err);
    throw new Error(`Failed to upload image to Cloudinary: ${err.message}`);
  }
};

// Delete function
const deleteFromCloudinary = async (public_id) => {
  try {
    if (!public_id) {
      throw new Error('No public_id provided');
    }

    const result = await cloudinary.uploader.destroy(public_id);
    console.log('✅ Successfully deleted from Cloudinary:', { public_id, result });
    
    return result;
  } catch (err) {
    console.error('❌ Error deleting from Cloudinary:', err);
    throw new Error(`Failed to delete image from Cloudinary: ${err.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary
};
