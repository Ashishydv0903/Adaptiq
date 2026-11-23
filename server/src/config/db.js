import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let isConnected = false;

/**
 * Connect to MongoDB with graceful error handling and retry logic
 * @returns {Promise<typeof mongoose>}
 */
export const connectDB = async () => {
  if (isConnected) {
    return mongoose;
  }

  const uri = env.NODE_ENV === 'test' ? env.MONGO_TEST_URI : env.MONGO_URI;

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    isConnected = conn.connections[0].readyState === 1;
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Reconnecting...');
      isConnected = false;
    });

    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);
    // If not in test mode, we might want to log warning or let app continue if offline
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Disconnect from MongoDB (useful for test teardown)
 */
export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected cleanly');
  }
};

export default connectDB;
