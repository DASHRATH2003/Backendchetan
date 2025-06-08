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
    // Test basic connectivity
    const pingResult = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection test successful');

    // Test API key validity
    try {
      const accountInfo = await cloudinary.api.usage();
      console.log('✅ API credentials verified successfully');
    } catch (apiError) {
      console.error('❌ API credentials verification failed:', apiError);
      throw new Error('Invalid API credentials');
    }

    return true;
  } catch (error) {
    console.error('❌ Cloudinary configuration error:', error);
    if (error.error && error.error.message) {
      console.error('Detailed error:', error.error.message);
    }
    throw new Error('Invalid Cloudinary configuration. Please check your credentials.');
  }
};

// Run validation
validateConfig().catch(err => {
  console.error('Failed to validate Cloudinary config:', err);
  process.exit(1); // Exit if Cloudinary is not configured correctly
});

// Upload function
const uploadToCloudinary = async (file, folder = 'gallery') => {
  try {
    if (!file || !file.buffer) {
      throw new Error('No file provided or invalid file format');
    }

    console.log('📤 Starting upload to Cloudinary...', {
      fileType: file.mimetype,
      fileSize: file.buffer.length,
      folder: folder
    });

    // Convert the file buffer to base64
    const fileStr = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    // Upload directly with specific parameters
    try {
      console.log('☁️ Uploading to Cloudinary...');
      const uploadResponse = await cloudinary.uploader.upload(fileStr, {
        folder: folder,
        resource_type: 'auto',
        transformation: [
          { quality: 'auto:best' },
          { fetch_format: 'auto' }
        ],
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        format: 'webp', // Convert all images to WebP for better performance
        overwrite: true,
        invalidate: true,
        use_filename: false,
        unique_filename: true
      });

      console.log('✅ Upload successful:', {
        public_id: uploadResponse.public_id,
        url: uploadResponse.secure_url,
        format: uploadResponse.format,
        resource_type: uploadResponse.resource_type,
        created_at: uploadResponse.created_at,
        bytes: uploadResponse.bytes,
        width: uploadResponse.width,
        height: uploadResponse.height
      });

      // Verify the image is accessible
      try {
        const result = await cloudinary.api.resource(uploadResponse.public_id);
        console.log('✅ Image verified as accessible:', {
          public_id: result.public_id,
          url: result.secure_url,
          format: result.format,
          resource_type: result.resource_type
        });
      } catch (verifyError) {
        console.error('❌ Warning: Image verification failed:', verifyError);
      }

      return {
        url: uploadResponse.secure_url,
        public_id: uploadResponse.public_id
      };

    } catch (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      throw uploadError;
    }
  } catch (err) {
    console.error('❌ Error in uploadToCloudinary:', err);
    if (err.http_code) {
      console.error('HTTP Status:', err.http_code);
    }
    if (err.error) {
      console.error('Cloudinary Error:', err.error);
    }
    throw new Error(`Failed to upload image: ${err.message}`);
  }
};

// Delete function
const deleteFromCloudinary = async (public_id) => {
  try {
    if (!public_id) {
      throw new Error('No public_id provided');
    }

    console.log('🗑️ Attempting to delete from Cloudinary:', public_id);

    const result = await cloudinary.uploader.destroy(public_id, {
      invalidate: true,
      resource_type: 'image'
    });
    
    if (result.result !== 'ok') {
      throw new Error(`Failed to delete image: ${result.result}`);
    }
    
    console.log('✅ Successfully deleted from Cloudinary:', { public_id, result });
    return result;
  } catch (err) {
    console.error('❌ Error deleting from Cloudinary:', err);
    if (err.http_code) {
      console.error('HTTP Status:', err.http_code);
    }
    if (err.error) {
      console.error('Cloudinary Error:', err.error);
    }
    throw new Error(`Failed to delete image: ${err.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary
};
