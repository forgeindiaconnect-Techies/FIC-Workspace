require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    // We don't have the User model, so we just use the raw collection
    const usersCollection = mongoose.connection.collection('users');
    
    const existing = await usersCollection.findOne({ email: 'ai-assistant@nexus.app' });
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('AI_SECURE_PASSWORD_123!@#', salt);
    
    if (!existing) {
      console.log('Creating ai-assistant user...');
      await usersCollection.insertOne({
        name: 'Nexus AI Assistant',
        email: 'ai-assistant@nexus.app',
        passwordHash: passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=ai-assistant`,
        role: 'ai-bot',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created!');
    } else {
      console.log('Updating existing ai-assistant password...');
      await usersCollection.updateOne(
        { email: 'ai-assistant@nexus.app' },
        { $set: { passwordHash: passwordHash } }
      );
      console.log('Updated!');
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
