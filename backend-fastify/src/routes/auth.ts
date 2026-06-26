import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { RefreshToken } from '../models/RefreshToken';
import { authenticate } from '../middlewares/auth';
import { 
  getLockoutTimeRemaining, 
  registerFailedAttempt, 
  resetFailedAttempts 
} from '../utils/redis';
import { generateMfaSecret, verifyMfaToken } from '../utils/mfa';
import { isMongoConnected } from '../utils/mongo';
import { loadSecurityConfig, validatePasswordStrength } from '../utils/securityConfig';

// SECURITY: No fallback values — securityConfig crashes on startup if missing
const getJwtSecret = () => loadSecurityConfig().jwtSecret;
const getJwtRefreshSecret = () => loadSecurityConfig().jwtRefreshSecret;
const isProduction = () => loadSecurityConfig().isProduction;

// ── JSON Schema for request validation ───────────────────────────────────────
const signupSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      avatarUrl: { type: 'string', maxLength: 2048 },
    },
    additionalProperties: false,
  }
};

const loginSchema = {
  body: {
    type: 'object' as const,
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
    additionalProperties: false,
  }
};

const subscriptionSignupSchema = {
  body: {
    type: 'object' as const,
    required: ['name', 'organisationName', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      organisationName: { type: 'string', minLength: 2, maxLength: 200 },
      email: { type: 'string', format: 'email', maxLength: 254 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      subscriptionTier: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
    },
    additionalProperties: false,
  }
};

export async function authRoutes(fastify: FastifyInstance) {
  
  // Helper to issue tokens (aligned with Web App tenant / user schemas)
  async function issueTokens(user: any) {
    const email = user.email || user.adminEmail;
    const role = user.role || 'company-admin';
    const workspaceId = user.workspaceId || 'forge-india-connect';

    // SECURITY: Short-lived access token (15 min instead of 30 days)
    const accessToken = jwt.sign(
      { userId: user._id, email, name: user.name, role, workspaceId },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    // SECURITY: Reasonable refresh token lifetime (7 days instead of 180)
    const refreshTokenString = jwt.sign(
      { userId: user._id },
      getJwtRefreshSecret(),
      { expiresIn: '7d' }
    );

    // Save refresh token to MongoDB for long-lived signed-in sessions.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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

  // 1A. SIGNUP SUBSCRIPTION
  fastify.post('/signup-subscription', { schema: subscriptionSignupSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({ error: 'Database is not connected.' });
      }

      const { name, organisationName, email, password, subscriptionTier } = request.body as any;
      if (!name || !organisationName || !email || !password) {
        return reply.code(400).send({ error: 'All fields are required.' });
      }

      // Determine max users based on tier
      const tier = subscriptionTier || 'starter';
      let maxUsers = 20;
      if (tier === 'pro') maxUsers = 40;
      if (tier === 'enterprise') maxUsers = 99999;

      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return reply.code(400).send({ error: passwordError });
      }

      const normEmail = email.toLowerCase().trim();
      
      const existingUser = await User.findOne({ email: normEmail });
      const existingTenant = await Tenant.findOne({ adminEmail: normEmail });
      if (existingUser || existingTenant) {
        return reply.code(409).send({ error: 'An account with this email already exists.' });
      }

      const duplicateOrg = await Tenant.findOne({ organisationName });
      if (duplicateOrg) {
        return reply.code(409).send({ error: 'Organisation Name already exists.' });
      }

      const generatedDomain = `${organisationName.toLowerCase().replace(/[^a-z0-9]/gi, '')}.nexus.com`;

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      const workspaceId = `ws-${generatedDomain.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // Create Tenant (which represents the subscription)
      const tenant = await Tenant.create({
        name,
        organisationName,
        workspaceId,
        domain: generatedDomain,
        adminEmail: normEmail,
        password: passwordHash,
        paymentStatus: 'active',
        subscriptionTier: tier,
        maxUsers: maxUsers,
        subscriptionExpiryDate: expiryDate
      });

      // Also create the user to allow standard login
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
      return reply.code(201).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create subscription.', ...(isProduction() ? {} : { details: err.message }) });
    }
  });
  // 1B. START DEMO ACCOUNT
  fastify.post('/demo', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({ error: 'Database is not connected.' });
      }

      const email = 'demo@nexus.app';
      const workspaceId = 'demo-workspace';

      // Ensure demo-workspace Tenant exists
      let tenant = await Tenant.findOne({ workspaceId });
      if (!tenant) {
        tenant = await Tenant.create({
          name: 'Demo Workspace',
          organisationName: 'Forge India Connect Demo',
          workspaceId,
          domain: 'demo.nexus.app',
          adminEmail: email,
          password: await bcrypt.hash('demo_password_123!@#', 10),
          paymentStatus: 'active',
          subscriptionTier: 'enterprise',
          maxUsers: 99999,
          subscriptionExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10) // 10 years
        });
      }

      // Ensure demo user exists
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: 'Demo User',
          email,
          passwordHash: await bcrypt.hash('demo_password_123!@#', 10),
          workspaceId,
          role: 'demo',
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=DemoUser`,
          mfaEnabled: false,
        });
      } else if (user.role !== 'demo') {
        user.role = 'demo';
        await user.save();
      }

      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create or login to demo account.', details: err.message });
    }
  });

  // 1. SIGNUP
  fastify.post('/signup', { schema: signupSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({
          error: 'Database is not connected. Cannot create account right now.',
        });
      }

      const { name, email, password, avatarUrl } = request.body as any;
      if (!name || !email || !password) {
        return reply.code(400).send({ error: 'Name, email, and password are required.' });
      }

      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return reply.code(400).send({ error: passwordError });
      }

      const normEmail = email.toLowerCase().trim();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail);
      if (!emailValid) {
        return reply.code(400).send({ error: 'Please enter a valid email address.' });
      }

      // Check if user already exists
      const existing = await User.findOne({ email: normEmail });
      if (existing) {
        return reply.code(409).send({ error: 'An account with this email already exists. Please sign in.' });
      }

      const tenantExists = await Tenant.findOne({ adminEmail: normEmail });
      if (tenantExists) {
        return reply.code(409).send({ error: 'An account with this email already exists. Please sign in.' });
      }

      // Hash password using 12 rounds
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
      return reply.code(201).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create user account.', ...(isProduction() ? {} : { details: err.message }) });
    }
  });

  // 2. LOGIN (Incorporating Lockout & MFA Challenges)
  fastify.post('/login', { schema: loginSchema }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({
          error: 'Database is not connected. Set MONGO_URI on the server (encode @ in password as %40).',
        });
      }

      const { email, password } = request.body as any;
      if (!email || !password) {
        return reply.code(400).send({ error: 'Email and password are required.' });
      }

      const normEmail = email.toLowerCase();

      // Check Redis Lockout
      const minutesLeft = await getLockoutTimeRemaining(normEmail);
      if (minutesLeft > 0) {
        return reply.code(423).send({ 
          error: `Account is temporarily locked due to repeated failures. Please try again in ${minutesLeft} minutes.` 
        });
      }

      // 1. Check Tenant Collection (Workspace Owners)
      const tenant = await Tenant.findOne({ adminEmail: normEmail });
      if (tenant) {
        const activeHash = tenant.password!;
        const isValid = await bcrypt.compare(password, activeHash);
        if (!isValid) {
          const isLockedNow = await registerFailedAttempt(normEmail);
          if (isLockedNow) {
            return reply.code(423).send({ 
              error: 'Account locked: 5 failed attempts triggered. Please wait 15 minutes.' 
            });
          }
          return reply.code(401).send({ error: 'Invalid login credentials.' });
        }

        // Clear lockouts
        await resetFailedAttempts(normEmail);

        // Direct Login tokens bundle
        const tokenBundle = await issueTokens(tenant);
        return reply.code(200).send(tokenBundle);
      }

      // 2. Check User Collection (Workspace Members & Super Admins)
      const user = await User.findOne({ email: normEmail });
      if (!user || (!user.passwordHash && !user.password)) {
        await registerFailedAttempt(normEmail);
        return reply.code(401).send({ error: 'Invalid login credentials.' });
      }

      // Verify Password hash (using either passwordHash or password fallback)
      const activeHash = user.passwordHash || user.password!;
      const isValid = await bcrypt.compare(password, activeHash);
      if (!isValid) {
        const isLockedNow = await registerFailedAttempt(normEmail);
        if (isLockedNow) {
          return reply.code(423).send({ 
            error: 'Account locked: 5 failed attempts triggered. Please wait 15 minutes.' 
          });
        }
        return reply.code(401).send({ error: 'Invalid login credentials.' });
      }

      // Clear lockouts
      await resetFailedAttempts(normEmail);

      // Check if MFA is active
      if (user.mfaEnabled) {
        // Issue a short-lived ticket to complete MFA validation
        const mfaTicket = jwt.sign(
          { userId: user._id, type: 'mfa_pending' },
          getJwtSecret(),
          { expiresIn: '3m' }
        );
        return reply.code(200).send({
          mfaRequired: true,
          mfaTicket
        });
      }

      // Direct Login tokens bundle
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Login handler error.', ...(isProduction() ? {} : { details: err.message }) });
    }
  });

  // 3. VERIFY MFA TICKET
  fastify.post('/verify-mfa', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mfaTicket, token } = request.body as any;
      if (!mfaTicket || !token) {
        return reply.code(400).send({ error: 'MFA ticket and 6-digit passcode are required.' });
      }

      const decoded = jwt.verify(mfaTicket, getJwtSecret()) as any;
      if (!decoded || decoded.type !== 'mfa_pending') {
        return reply.code(401).send({ error: 'Invalid or expired MFA ticket.' });
      }

      const user = await User.findById(decoded.userId);
      if (!user || !user.mfaSecret) {
        return reply.code(404).send({ error: 'User MFA configuration not found.' });
      }

      // Verify Speakeasy token
      const isOtpValid = verifyMfaToken(user.mfaSecret, token);
      if (!isOtpValid) {
        return reply.code(401).send({ error: 'Invalid MFA verification code.' });
      }

      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err: any) {
      return reply.code(401).send({ error: 'MFA verification failed.' });
    }
  });

  // 4. REFRESH TOKEN ROTATION
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body as any;
      if (!refreshToken) {
        return reply.code(400).send({ error: 'Refresh token is required.' });
      }

      const decoded = jwt.verify(refreshToken, getJwtRefreshSecret()) as any;
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ error: 'Invalid refresh token.' });
      }

      // Look up and remove the old token (strict rotation policy)
      const stored = await RefreshToken.findOneAndDelete({ token: refreshToken });
      if (!stored) {
        return reply.code(401).send({ error: 'Token has been revoked or rotated.' });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return reply.code(404).send({ error: 'User session no longer active.' });
      }

      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err: any) {
      return reply.code(401).send({ error: 'Token rotation failed.' });
    }
  });

  // 5. MFA SETUP (Generate parameters)
  fastify.post('/mfa/setup', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await User.findById(request.user!.id);
      if (!user) {
        return reply.code(404).send({ error: 'User profile not found.' });
      }

      const mfaBundle = await generateMfaSecret(user.email);
      
      // Save secret pending activation verification
      user.mfaSecret = mfaBundle.secret;
      await user.save();

      return reply.code(200).send(mfaBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to initialize MFA secrets.', details: err.message });
    }
  });

  // 6. MFA ENABLE (Activate MFA profile)
  fastify.post('/mfa/enable', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.body as any;
      if (!token) {
        return reply.code(400).send({ error: 'TOTP activation code is required.' });
      }

      const user = await User.findById(request.user!.id);
      if (!user || !user.mfaSecret) {
        return reply.code(400).send({ error: 'MFA setup must be initiated first.' });
      }

      const isValid = verifyMfaToken(user.mfaSecret, token);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid token code. MFA setup aborted.' });
      }

      user.mfaEnabled = true;
      await user.save();

      return reply.code(200).send({ success: true, message: 'TOTP Multi-Factor Authentication successfully enabled.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to verify OTP.', details: err.message });
    }
  });

  // 7. GOOGLE & APPLE OAUTH AUTHENTICATION EXCHANGE
  fastify.post('/oauth/exchange', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { provider, oauthId, email, name, avatarUrl } = request.body as any;
      if (!provider || !oauthId || !email || !name) {
        return reply.code(400).send({ error: 'Missing mandatory OAuth parameters.' });
      }

      let user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Link OAuth profile if not linked
        if (provider === 'google' && !user.googleId) {
          user.googleId = oauthId;
          await user.save();
        } else if (provider === 'apple' && !user.appleId) {
          user.appleId = oauthId;
          await user.save();
        }
      } else {
        // Create user from OAuth claims
        user = await User.create({
          name,
          email: email.toLowerCase(),
          googleId: provider === 'google' ? oauthId : undefined,
          appleId: provider === 'apple' ? oauthId : undefined,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
          mfaEnabled: false
        });
      }

      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'OAuth exchange process failed.', details: err.message });
    }
  });

  // 8. UPDATE PROFILE (Avatar URL)
  fastify.put('/update-profile', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { avatarUrl } = request.body as any;
      if (!avatarUrl) {
        return reply.code(400).send({ error: 'Avatar URL is required.' });
      }

      const user = await User.findById(request.user!.id);
      if (!user) return reply.code(404).send({ error: 'User not found.' });

      user.avatarUrl = avatarUrl;
      await user.save();

      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update profile.', details: err.message });
    }
  });

  // 9. CHANGE PASSWORD
  fastify.put('/change-password', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { currentPassword, newPassword } = request.body as any;
      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ error: 'Current password and new password are required.' });
      }
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) {
        return reply.code(400).send({ error: passwordError });
      }

      const user = await User.findById(request.user!.id);
      if (!user) return reply.code(404).send({ error: 'User not found.' });

      // Verify current password
      const activeHash = user.passwordHash || user.password;
      if (!activeHash) {
        return reply.code(400).send({ error: 'No password set for this account (e.g. OAuth only).' });
      }

      const isValid = await bcrypt.compare(currentPassword, activeHash);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid current password.' });
      }

      // Hash and save new password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      user.passwordHash = passwordHash;
      if (user.password) user.password = undefined; // clear legacy fallback if exists
      await user.save();

      return reply.code(200).send({ message: 'Password updated successfully.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to change password.', details: err.message });
    }
  });

  // 10. REGISTER PUSH TOKEN
  fastify.post('/push-token', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.body as any;
      if (!token) {
        return reply.code(400).send({ error: 'Push token is required.' });
      }

      const user = await User.findById(request.user!.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found.' });
      }

      user.expoPushToken = token;
      await user.save();

      console.log(`[Auth] Registered push token for user ${user.email}`);
      return reply.code(200).send({ success: true, message: 'Push token registered successfully.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to register push token.', details: err.message });
    }
  });

  // 11. GET VAPID PUBLIC KEY
  fastify.get('/web-push/public-key', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getVapidPublicKey } = require('../services/webPush');
      return reply.code(200).send({ publicKey: getVapidPublicKey() });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch VAPID public key.', details: err.message });
    }
  });

  // 12. REGISTER WEB PUSH SUBSCRIPTION
  fastify.post('/web-push/subscribe', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { subscription } = request.body as any;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return reply.code(400).send({ error: 'Subscription object with endpoint and keys is required.' });
      }

      const user = await User.findById(request.user!.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found.' });
      }

      if (!user.webPushSubscriptions) {
        user.webPushSubscriptions = [];
      }

      const exists = user.webPushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
      if (!exists) {
        user.webPushSubscriptions.push({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        });
        await user.save();
        console.log(`[WebPush] Subscribed endpoint for user ${user.email}`);
      }

      return reply.code(200).send({ success: true, message: 'Web push subscription registered successfully.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to register web push subscription.', details: err.message });
    }
  });

  // 13. UNREGISTER WEB PUSH SUBSCRIPTION
  fastify.post('/web-push/unsubscribe', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { endpoint } = request.body as any;
      if (!endpoint) {
        return reply.code(400).send({ error: 'Subscription endpoint is required.' });
      }

      const user = await User.findById(request.user!.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found.' });
      }

      if (user.webPushSubscriptions) {
        const originalLength = user.webPushSubscriptions.length;
        user.webPushSubscriptions = user.webPushSubscriptions.filter(sub => sub.endpoint !== endpoint);
        
        if (user.webPushSubscriptions.length < originalLength) {
          await user.save();
          console.log(`[WebPush] Unsubscribed endpoint for user ${user.email}`);
        }
      }

      return reply.code(200).send({ success: true, message: 'Web push subscription removed successfully.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to remove web push subscription.', details: err.message });
    }
  });
}
