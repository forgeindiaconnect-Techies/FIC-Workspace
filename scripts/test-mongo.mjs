/**
 * Test MongoDB connection. Run: node scripts/test-mongo.mjs
 * Set MONGO_URI in backend-fastify/.env first.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, 'backend-fastify', '.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('No MONGO_URI found in backend-fastify/.env');
  process.exit(1);
}

console.log('Testing MongoDB connection...');
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('SUCCESS: Connected to MongoDB');
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('FAILED:', err.message);
  process.exit(1);
}
