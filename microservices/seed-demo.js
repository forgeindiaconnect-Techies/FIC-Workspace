import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongo, User, Tenant } from './shared/database.js';

async function seed() {
  await connectMongo();
  console.log('Connected to DB');
  
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('password123', salt);
  
  await Tenant.deleteMany({ adminEmail: 'demo@fic.com' });
  await User.deleteMany({ email: 'demo@fic.com' });
  
  await Tenant.create({
    name: 'Demo Org',
    organisationName: 'Demo Org',
    workspaceId: 'demo-ws',
    domain: 'demo.nexus.com',
    adminEmail: 'demo@fic.com',
    password: passwordHash,
    paymentStatus: 'active',
    subscriptionTier: 'pro',
    maxUsers: 40,
    subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  
  await User.create({
    name: 'Demo User',
    email: 'demo@fic.com',
    passwordHash: passwordHash,
    workspaceId: 'demo-ws',
    role: 'company-admin',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=DemoUser',
    mfaEnabled: false
  });
  
  console.log('Seeded demo@fic.com with password123 successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
