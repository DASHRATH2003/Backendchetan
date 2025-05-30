// db.js
const mongoose = require('mongoose');
require('dotenv').config();

const connectWithRetry = async (retries = 5, delay = 5000) => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://dashrath2003:HSXgM4gZPMwiNirG@cluster0.n2ehu92.mongodb.net/myDatabase?retryWrites=true&w=majority&authSource=admin';
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log('Attempting to connect to MongoDB...');
      
      const conn = await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000, // Increased timeout
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        connectTimeoutMS: 30000, // Increased timeout
        heartbeatFrequencyMS: 2000,
        authSource: 'admin',
        maxPoolSize: 10, // Updated from poolSize to maxPoolSize
        family: 4 // Force IPv4
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      
      // Handle disconnection
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected! Attempting to reconnect...');
        setTimeout(() => connectWithRetry(), delay);
      });

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        if (err.name === 'MongoNetworkError') {
          console.log('Network error detected, attempting to reconnect...');
          setTimeout(() => connectWithRetry(), delay);
        }
      });

      // Handle successful reconnection
      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected!');
      });

      return conn;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i + 1} failed`);
      
      if (err.name === 'MongoServerSelectionError') {
        console.error('Could not connect to MongoDB servers. Please check:');
        console.error('1. Your IP address is whitelisted in MongoDB Atlas');
        console.error('2. Your MongoDB Atlas username and password are correct');
        console.error('3. Your network connection is stable');
        console.error(`Error message: ${err.message}`);
      } else {
        console.error('Error details:', err);
      }
      
      if (i === retries - 1) {
        console.error('Failed to connect to MongoDB after all retries');
        throw new Error(`Failed to connect to MongoDB after ${retries} attempts`);
      }
      
      console.log(`Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectWithRetry;
