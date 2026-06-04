import bcrypt from 'bcrypt';
import { User } from '../models/User';

const DEFAULT_EMAIL = 'admin@fic.com';
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
      name: 'Forge India Connect AI',
      email: AI_EMAIL,
      passwordHash: aiPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=nexusai`,
      mfaEnabled: false,
      role: 'company-admin',
      workspaceId: 'antigraviity-hq',
    });
  }

  // Super Admin Seeder
  const SUPERADMIN_EMAIL = 'superadmin@fic.com';
  const superAdminExisting = await User.findOne({ email: SUPERADMIN_EMAIL });
  if (!superAdminExisting) {
    const saPasswordHash = await bcrypt.hash('password123', salt);
    await User.create({
      name: 'Super Admin',
      email: SUPERADMIN_EMAIL,
      passwordHash: saPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=SA`,
      mfaEnabled: false,
      role: 'super-admin',
      workspaceId: 'fic-superadmin',
    });
  }

  // Demo User Seeder
  const DEMO_EMAIL = 'demo@fic.com';
  const demoExisting = await User.findOne({ email: DEMO_EMAIL });
  if (!demoExisting) {
    const demoPasswordHash = await bcrypt.hash('password123', salt);
    await User.create({
      name: 'Demo User',
      email: DEMO_EMAIL,
      passwordHash: demoPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=Demo`,
      mfaEnabled: false,
      role: 'Member',
      workspaceId: 'demo-ws',
    });
  }
}
