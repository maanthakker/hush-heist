import mongoose from 'mongoose';

const STATES = ['offline', 'connected', 'connecting', 'disconnecting'];

export async function connectDb(uri) {
  if (!uri) {
    console.warn('[db] MONGODB_URI is not set. Running without a database; runs will not be saved.');
    return;
  }
  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || 'hush-heist',
      serverSelectionTimeoutMS: 8000,
    });
    console.log('[db] MongoDB connected');
  } catch (err) {
    console.error(`[db] MongoDB connection failed: ${err.message}. Retrying in 15s.`);
    setTimeout(() => connectDb(uri), 15000);
  }
}

export const dbState = () => STATES[mongoose.connection.readyState] || 'offline';
export const dbReady = () => mongoose.connection.readyState === 1;
