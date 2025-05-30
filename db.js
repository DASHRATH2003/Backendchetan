// db.js
const mongoose = require('mongoose');
require('dotenv').config();

const getMongoURI = () => {
  // Try to get from environment variable first
  const envURI = process.env.MONGODB_URI;
  if (envURI) {
    console.log('Using MongoDB URI from environment variable');
    return envURI;
  }

  // Fallback configuration
  console.log('Using fallback MongoDB configuration');
  const username = process.env.MONGO_USER || 'dashrath2003';
  const password = process.env.MONGO_PASSWORD || 'HSXgM4gZPMwiNirG';
  const cluster = process.env.MONGO_CLUSTER || 'cluster0.n2ehu92';
  const dbName = process.env.MONGO_DB || 'myDatabase';

  return `mongodb+srv://${username}:${password}@${cluster}.mongodb.net/${dbName}?retryWrites=true&w=majority`;
};

const connectWithRetry = async (retries = 5, delay = 5000) => {
  const mongoURI = getMongoURI();
  console.log('Attempting to connect to MongoDB...');
  console.log('Using database:', mongoURI.split('@')[1]); // Log only the non-sensitive part
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Connection attempt ${i + 1}/${retries}`);
      
      // Close any existing connections before attempting to connect
      if (mongoose.connection.readyState !== 0) {
        console.log('Closing existing MongoDB connection...');
        await mongoose.connection.close();
      }
      
      const conn = await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        connectTimeoutMS: 30000,
        heartbeatFrequencyMS: 2000,
        maxPoolSize: 10,
        autoIndex: true, // Build indexes
        minPoolSize: 2 // Maintain at least 2 connections
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log('Connection state:', mongoose.connection.readyState);
      console.log('Database name:', mongoose.connection.name);
      
      // Handle disconnection
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected! Attempting to reconnect...');
        setTimeout(() => connectWithRetry(retries, delay), delay);
      });

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
          console.log('Network/Timeout error detected, attempting to reconnect...');
          setTimeout(() => connectWithRetry(retries, delay), delay);
        }
      });

      // Handle successful reconnection
      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected successfully!');
        console.log('New connection state:', mongoose.connection.readyState);
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        try {
          await mongoose.connection.close();
          console.log('MongoDB connection closed through app termination');
          process.exit(0);
        } catch (err) {
          console.error('Error during MongoDB shutdown:', err);
          process.exit(1);
        }
      });

      return conn;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, err.message);
      console.error('Error details:', {
        name: err.name,
        code: err.code,
        stack: err.stack
      });
      
      if (i === retries - 1) {
        console.error('Failed to connect to MongoDB after all retries');
        throw err;
      }
      
      console.log(`Retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectWithRetry;
