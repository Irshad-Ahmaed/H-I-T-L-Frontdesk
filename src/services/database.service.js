import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI is not defined in .env file');
    }

    await mongoose.connect(mongoURI);
    console.log('[Backend-DB] MongoDB Connected Successfully.');
  } catch (err) {
    console.error(`[Backend-DB] Connection Error: ${err.message}`);
    process.exit(1);
  }
};