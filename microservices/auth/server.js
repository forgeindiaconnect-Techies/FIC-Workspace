import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectMongo, User, Tenant, RefreshToken } from '../shared/database.js';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nexus-refresh-secret-key';

// Database connectivity check middleware
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database service unavailable' });
  }
});

// Helper to issue JWT tokens
async function issueTokens(user) {
  const email = user.email || user.adminEmail;
  const role = user.role || 'company-admin';
  const workspaceId = user.workspaceId || 'demo';

  const accessToken = jwt.sign(
    { userId: user._id, email, name: user.name, role, workspaceId },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  const refreshTokenString = jwt.sign(
    { userId: user._id },
    JWT_REFRESH_SECRET,
    { expiresIn: '180d' }
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 180);

  await RefreshToken.create({
    userId: user._id,
    token: refreshTokenString,
    expiresAt
  });

  return {
    accessToken,
    refreshToken: refreshTokenString,
    user: {
      id: user._id,
      email,
      name: user.name,
      avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
      mfaEnabled: !!user.mfaEnabled,
      role,
      workspaceId
    }
  };
}

// ─── LOGIN ROUTE ───
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normEmail = email.toLowerCase().trim();

  try {
    // 1. Try Tenant (Workspace Owners)
    const tenant = await Tenant.findOne({ adminEmail: normEmail });
    if (tenant) {
      const isValid = await bcrypt.compare(password, tenant.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid login credentials.' });
      }
      const tokenBundle = await issueTokens(tenant);
      return res.json(tokenBundle);
    }

    // 2. Try User (Workspace Members)
    const user = await User.findOne({ email: normEmail });
    if (!user || (!user.passwordHash && !user.password)) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    const activeHash = user.passwordHash || user.password;
    const isValid = await bcrypt.compare(password, activeHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    if (user.mfaEnabled) {
      const mfaTicket = jwt.sign(
        { userId: user._id, type: 'mfa_pending' },
        JWT_SECRET,
        { expiresIn: '3m' }
      );
      return res.json({ mfaRequired: true, mfaTicket });
    }

    const tokenBundle = await issueTokens(user);
    res.json(tokenBundle);
  } catch (err) {
    res.status(500).json({ error: 'Login service error.', details: err.message });
  }
});

// ─── SIGNUP SUBSCRIBER ROUTE ───
app.post('/api/auth/signup-subscription', async (req, res) => {
  const { name, organisationName, email, password, subscriptionTier } = req.body;
  if (!name || !organisationName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const normEmail = email.toLowerCase().trim();

  try {
    const existingUser = await User.findOne({ email: normEmail });
    const existingTenant = await Tenant.findOne({ adminEmail: normEmail });
    if (existingUser || existingTenant) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const duplicateOrg = await Tenant.findOne({ organisationName });
    if (duplicateOrg) {
      return res.status(409).json({ error: 'Organisation Name already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const workspaceId = `ws-${organisationName.toLowerCase().replace(/[^a-z0-9]/gi, '-')}`;
    const generatedDomain = `${organisationName.toLowerCase().replace(/[^a-z0-9]/gi, '')}.nexus.com`;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const tenant = await Tenant.create({
      name,
      organisationName,
      workspaceId,
      domain: generatedDomain,
      adminEmail: normEmail,
      password: passwordHash,
      paymentStatus: 'active',
      subscriptionTier: subscriptionTier || 'starter',
      maxUsers: subscriptionTier === 'pro' ? 40 : subscriptionTier === 'enterprise' ? 99999 : 20,
      subscriptionExpiryDate: expiryDate
    });

    const user = await User.create({
      name: name.trim(),
      email: normEmail,
      passwordHash,
      workspaceId,
      role: 'company-admin',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      mfaEnabled: false,
    });

    const tokenBundle = await issueTokens(user);
    res.status(201).json(tokenBundle);
  } catch (err) {
    res.status(500).json({ error: 'Subscription signup failed.', details: err.message });
  }
});

// ─── COMPATIBILITY SIGNUP FOR TENANTS ───
app.post('/api/auth/register-tenant', async (req, res) => {
  const { name, email, password, workspaceId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const normEmail = email.toLowerCase().trim();
  const actualWorkspaceId = workspaceId || `ws-${name.toLowerCase().replace(/[^a-z0-9]/gi, '-')}`;

  try {
    const existingUser = await User.findOne({ email: normEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const tenant = await Tenant.create({
      name,
      organisationName: name,
      workspaceId: actualWorkspaceId,
      domain: `${actualWorkspaceId}.nexus.com`,
      adminEmail: normEmail,
      password: passwordHash,
      paymentStatus: 'active',
      subscriptionTier: 'starter',
      maxUsers: 20
    });

    const user = await User.create({
      name: name.trim(),
      email: normEmail,
      passwordHash,
      workspaceId: actualWorkspaceId,
      role: 'company-admin',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      mfaEnabled: false,
    });

    const tokenBundle = await issueTokens(user);
    res.status(201).json(tokenBundle);
  } catch (err) {
    res.status(500).json({ error: 'Tenant registration failed.', details: err.message });
  }
});

// ─── USER SIGNUP ROUTE ───
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, avatarUrl } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const normEmail = email.toLowerCase().trim();

  try {
    const existing = await User.findOne({ email: normEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const workspaceId = `ws-${normEmail.split('@')[0].replace(/[^a-z0-9]/gi, '-')}`;

    const user = await User.create({
      name: name.trim(),
      email: normEmail,
      passwordHash,
      workspaceId,
      role: 'Member',
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      mfaEnabled: false,
    });

    const tokenBundle = await issueTokens(user);
    res.status(201).json(tokenBundle);
  } catch (err) {
    res.status(500).json({ error: 'Signup service failed.', details: err.message });
  }
});

// ─── SILENT REFRESH ROTATION ROUTE ───
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    const stored = await RefreshToken.findOneAndDelete({ token: refreshToken });
    if (!stored) {
      return res.status(401).json({ error: 'Token has been revoked or rotated.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User session no longer active.' });
    }

    const tokenBundle = await issueTokens(user);
    res.json(tokenBundle);
  } catch (err) {
    res.status(401).json({ error: 'Token rotation failed.', details: err.message });
  }
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service' });
});

const PORT = 3101;
app.listen(PORT, () => {
  console.log(`🔒 [Auth Service] Running on http://localhost:${PORT}`);
});
