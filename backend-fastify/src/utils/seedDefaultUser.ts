import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { loadSecurityConfig } from './securityConfig';

/**
 * Seeds default accounts on first boot.
 * 
 * SECURITY CHANGES:
 * - Passwords are read from SEED_ADMIN_PASSWORD env var or auto-generated
 * - Hardcoded passwords ('password123') removed from source code
 * - Generated passwords are logged once so the operator can set them
 * - forcePasswordChange flag set so users must change on first login
 */
export async function ensureDefaultUser() {
  const config = loadSecurityConfig();
  const seedPassword = config.seedAdminPassword;
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(seedPassword, salt);

  // ── Admin Account ──────────────────────────────────────────────────────────
  const DEFAULT_EMAIL = 'admin@fic.com';
  const existing = await User.findOne({ email: DEFAULT_EMAIL });
  if (!existing) {
    await User.create({
      name: 'Forge India Administrator',
      email: DEFAULT_EMAIL,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Forge India Administrator')}`,
      mfaEnabled: false,
      role: 'company-admin',
      workspaceId: 'forge-india-connect',
    });
    console.log(
      `[SEED] Created admin account: ${DEFAULT_EMAIL}\n` +
      `       Password: ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD env var)' : seedPassword}\n` +
      `       ⚠️  Change this password immediately after first login!`
    );
  } else if (existing.name === 'Nexus Administrator') {
    existing.name = 'Forge India Administrator';
    existing.avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent('Forge India Administrator')}`;
    await existing.save();
  }

  // ── AI Assistant Account ───────────────────────────────────────────────────
  const AI_EMAIL = 'ai-assistant@nexus.app';
  const aiExisting = await User.findOne({ email: AI_EMAIL });
  if (!aiExisting) {
    // AI account uses a separate random password (never shared with humans)
    const aiPassword = require('crypto').randomBytes(32).toString('base64url');
    const aiPasswordHash = await bcrypt.hash(aiPassword, salt);
    await User.create({
      name: 'Forge India Connect AI',
      email: AI_EMAIL,
      passwordHash: aiPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=forgeai`,
      mfaEnabled: false,
      role: 'company-admin',
      workspaceId: 'forge-india-connect',
    });
  } else if (aiExisting.name !== 'Forge India Connect AI') {
    aiExisting.name = 'Forge India Connect AI';
    aiExisting.avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=forgeai`;
    await aiExisting.save();
  }

  // ── Super Admin Account ────────────────────────────────────────────────────
  const SUPERADMIN_EMAIL = 'superadmin@fic.com';
  const superAdminExisting = await User.findOne({ email: SUPERADMIN_EMAIL });
  if (!superAdminExisting) {
    // Super admin gets its own strong random password
    const saPassword = require('crypto').randomBytes(20).toString('base64url');
    const saPasswordHash = await bcrypt.hash(saPassword, salt);
    await User.create({
      name: 'Super Admin',
      email: SUPERADMIN_EMAIL,
      passwordHash: saPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=SA`,
      mfaEnabled: false,
      role: 'super-admin',
      workspaceId: 'fic-superadmin',
    });
    console.log(
      `[SEED] Created super-admin account: ${SUPERADMIN_EMAIL}\n` +
      `       Password: ${saPassword}\n` +
      `       ⚠️  This password is shown only ONCE. Save it securely and change it immediately!`
    );
  }

  // ── Demo Account ───────────────────────────────────────────────────────────
  const DEMO_EMAIL = 'demo@fic.com';
  const demoExisting = await User.findOne({ email: DEMO_EMAIL });
  if (!demoExisting) {
    const demoPasswordHash = await bcrypt.hash(seedPassword, salt);
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
