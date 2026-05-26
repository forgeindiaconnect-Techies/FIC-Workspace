import bcrypt from 'bcrypt';
import { User } from '../models/User';

const DEFAULT_EMAIL = 'admin@antigraviity.com';
const DEFAULT_PASSWORD = 'password123';

export async function ensureDefaultUser() {
  const salt = await bcrypt.genSalt(12);

  const existing = await User.findOne({ email: DEFAULT_EMAIL });
  if (!existing) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
    await User.create({
      name: 'Nexus Administrator',
      email: DEFAULT_EMAIL,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Nexus Administrator')}`,
      mfaEnabled: false,
      role: 'company-admin',
      workspaceId: 'antigraviity-hq',
    });
  }

  const AI_EMAIL = 'ai-assistant@nexus.app';
  const aiExisting = await User.findOne({ email: AI_EMAIL });
  if (!aiExisting) {
    const aiPasswordHash = await bcrypt.hash('AI_SECURE_PASSWORD_123!@#', salt);
    await User.create({
      name: 'Nexus AI Assistant',
      email: AI_EMAIL,
      passwordHash: aiPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=nexusai`,
      mfaEnabled: false,
      role: 'company-admin',
      workspaceId: 'antigraviity-hq',
    });
  }
}
