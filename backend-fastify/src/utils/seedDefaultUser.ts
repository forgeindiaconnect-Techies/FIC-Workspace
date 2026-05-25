import bcrypt from 'bcrypt';
import { User } from '../models/User';

const DEFAULT_EMAIL = 'admin@antigraviity.com';
const DEFAULT_PASSWORD = 'password123';

export async function ensureDefaultUser() {
  const existing = await User.findOne({ email: DEFAULT_EMAIL });
  if (existing) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
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
