import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { User } from './models/User';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-zoom';

async function seed() {
  try {
    console.log('Connecting to MongoDB database to seed default user...');
    await mongoose.connect(MONGO_URI);
    
    const email = 'admin@antigraviity.com';
    const password = 'password123';
    
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`Default user "${email}" already exists in the database.`);
    } else {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      
      await User.create({
        name: 'Nexus Administrator',
        email,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Nexus Administrator')}`,
        mfaEnabled: false
      });
      
      console.log(`=======================================================`);
      console.log(`✅ DEFAULT USER CREATED SUCCESSFULLY!`);
      console.log(`📧 Email    : ${email}`);
      console.log(`🔑 Password : ${password}`);
      console.log(`=======================================================`);
    }
  } catch (err: any) {
    console.error('Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
