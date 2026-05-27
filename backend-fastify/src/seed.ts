import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureDefaultUser } from './utils/seedDefaultUser';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-zoom';

async function seed() {
  try {
    console.log('Connecting to MongoDB database to seed default user...');
    await mongoose.connect(MONGO_URI);
    await ensureDefaultUser();
    console.log('=======================================================');
    console.log('Default admin account is ready.');
    console.log('Email    : admin@fic.com');
    console.log('Password : password123');
    console.log('=======================================================');
  } catch (err: any) {
    console.error('Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
