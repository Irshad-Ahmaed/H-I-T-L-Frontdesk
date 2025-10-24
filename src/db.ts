import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in .env');
    }
    await mongoose.connect(mongoURI);
    console.log('[DB] MongoDB Connected Successfully.');
  } catch (err) {
    if (err instanceof Error) {
      console.error(`[DB] MongoDB Connection Error: ${err.message}`);
    } else {
      console.error('[DB] An unknown error occurred while connecting to MongoDB.');
    }
    process.exit(1);
  }
};