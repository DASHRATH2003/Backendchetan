// db.js
const mongoose = require('mongoose');
require('dotenv').config();

const getMongoURI = () => {
  // Try to get from environment variable first
  const envURI = process.env.MONGODB_URI;
  if (envURI) {
    return envURI;
  }

  // Fallback configuration
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
      
      const conn = await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority',
        connectTimeoutMS: 30000,
        heartbeatFrequencyMS: 2000,
        maxPoolSize: 10
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
      console.error(`❌ MongoDB connection attempt ${i + 1} failed:`, err.message);
      
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
