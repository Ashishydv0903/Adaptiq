/**
 * @file In-Memory MongoDB Test Setup Helper (mongodb-memory-server)
 * Allows integration and route tests to run completely self-contained in CI without external MongoDB services.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

let mongod = null;

export async function connectMongoMemory() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    logger.info(`[Test DB] Connected to in-memory MongoDB at ${uri}`);
  } catch (err) {
    logger.warn(`[Test DB] Memory MongoDB startup warning: ${err.message}`);
  }
}

export async function disconnectMongoMemory() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
      mongod = null;
    }
  } catch (err) {
    logger.warn(`[Test DB] Memory MongoDB shutdown warning: ${err.message}`);
  }
}

export async function clearMongoMemory() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({}).catch(() => {});
    }
  }
}
