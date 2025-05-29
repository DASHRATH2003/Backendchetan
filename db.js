// db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(
      'mongodb+srv://dashrath2003:HSXgM4gZPMwiNirG@cluster0.n2ehu92.mongodb.net/myDatabase?retryWrites=true&w=majority'
    );
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
