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

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nexus-refresh-secret-key';

export async function authRoutes(fastify: FastifyInstance) {
  
  // Helper to issue tokens (aligned with Web App tenant / user schemas)
  async function issueTokens(user: any) {
    const email = user.email || user.adminEmail;
    const role = user.role || 'company-admin';
    const workspaceId = user.workspaceId || 'antigraviity-hq';

    const accessToken = jwt.sign(
      { userId: user._id, email, name: user.name, role, workspaceId },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshTokenString = jwt.sign(
      { userId: user._id },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Save refresh token to MongoDB (30 days lifespan)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

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

  // 1. SIGNUP
  fastify.post('/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, email, password, avatarUrl } = request.body as any;
      if (!name || !email || !password) {
        return reply.code(400).send({ error: 'Missing required signup fields.' });
      }

      // Check if user already exists
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return reply.code(409).send({ error: 'User with this email is already registered.' });
      }

      // Hash password using 12 rounds
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      });

      const tokenBundle = await issueTokens(user);
      return reply.code(201).send(tokenBundle);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create user account.', details: err.message });
    }
  });

  // 2. LOGIN (Incorporating Lockout & MFA Challenges)
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
          JWT_SECRET,
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
      return reply.code(500).send({ error: 'Login handler error.', details: err.message });
    }
  });

  // 3. VERIFY MFA TICKET
  fastify.post('/verify-mfa', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mfaTicket, token } = request.body as any;
      if (!mfaTicket || !token) {
        return reply.code(400).send({ error: 'MFA ticket and 6-digit passcode are required.' });
      }

      const decoded = jwt.verify(mfaTicket, JWT_SECRET) as any;
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
      return reply.code(401).send({ error: 'MFA verification failed.', details: err.message });
    }
  });

  // 4. REFRESH TOKEN ROTATION
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body as any;
      if (!refreshToken) {
        return reply.code(400).send({ error: 'Refresh token is required.' });
      }

      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
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
      return reply.code(401).send({ error: 'Token rotation failed.', details: err.message });
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
}
