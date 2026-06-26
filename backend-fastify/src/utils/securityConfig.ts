/**
 * Centralized Security Configuration
 * 
 * Validates that all required security-sensitive environment variables are set
 * at server startup. The server will refuse to start if critical secrets are
 * missing or using known-insecure defaults.
 */
import crypto from 'crypto';

// ── Known insecure defaults that MUST be changed ────────────────────────────
const INSECURE_JWT_SECRETS = new Set([
  'nexus-jwt-secret-key',
  'nexus-refresh-secret-key',
  'your_jwt_secret_here',
  'CHANGE_ME_generate_with_node_e_require_crypto_randomBytes_64_toString_hex',
  'CHANGE_ME_generate_a_different_64_byte_hex_string',
  'secret',
  'jwt-secret',
  'changeme',
]);

const INSECURE_PASSWORDS = new Set([
  'password123',
  'password',
  'admin',
  '123456',
  'demo_password_123!@#',
  'AI_SECURE_PASSWORD_123!@#',
]);

// ── Configuration Interface ──────────────────────────────────────────────────
export interface SecurityConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  mongoUri: string;
  turnServerUrl: string;
  turnUsername: string;
  turnCredential: string;
  seedAdminPassword: string;
  isProduction: boolean;
  corsAllowedOrigins: string[];
}

// ── Validators ───────────────────────────────────────────────────────────────

function assertEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(
      `[SECURITY] Missing required environment variable: ${name}. ` +
      `Set it in your .env file or deployment platform.`
    );
  }
  return value || '';
}

function assertSecureSecret(name: string, value: string, minLength: number = 32): void {
  if (INSECURE_JWT_SECRETS.has(value)) {
    throw new Error(
      `[SECURITY] ${name} is using a known insecure default value. ` +
      `Generate a secure secret with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
  if (value.length < minLength) {
    throw new Error(
      `[SECURITY] ${name} must be at least ${minLength} characters long. ` +
      `Current length: ${value.length}. Generate a longer secret.`
    );
  }
}

// ── Generate a random password for seed accounts ─────────────────────────────
function generateRandomPassword(): string {
  return crypto.randomBytes(16).toString('base64url') + '!A1';
}

// ── Load & Validate Configuration ────────────────────────────────────────────

let cachedConfig: SecurityConfig | null = null;

export function loadSecurityConfig(log?: { 
  info: (m: string) => void; 
  warn: (m: string) => void; 
  error: (m: string) => void 
}): SecurityConfig {
  if (cachedConfig) return cachedConfig;

  const logger = log || {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
  };

  const isRenderHost = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME);
  const isProduction = process.env.NODE_ENV === 'production' || isRenderHost;

  // ── JWT Secrets (ALWAYS required) ──
  const jwtSecret = assertEnvVar('JWT_SECRET');
  const jwtRefreshSecret = assertEnvVar('JWT_REFRESH_SECRET', isProduction);

  // In production, enforce strong secrets
  if (isProduction) {
    assertSecureSecret('JWT_SECRET', jwtSecret, 32);
    if (jwtRefreshSecret) {
      assertSecureSecret('JWT_REFRESH_SECRET', jwtRefreshSecret, 32);
    }
  } else {
    // In development, warn but don't crash for refresh secret
    if (INSECURE_JWT_SECRETS.has(jwtSecret)) {
      logger.warn(
        '[SECURITY] JWT_SECRET is using a known insecure default. ' +
        'This is tolerated in development but MUST be changed before deployment.'
      );
    }
  }

  // Use a derived key for refresh if not explicitly set (dev convenience)
  const effectiveRefreshSecret = jwtRefreshSecret || 
    crypto.createHmac('sha256', jwtSecret).update('refresh-token-derivation').digest('hex');

  // ── MongoDB URI ──
  const mongoUri = assertEnvVar('MONGO_URI');

  // ── TURN Server (optional, use env vars or fallback to public STUN only) ──
  const turnServerUrl = process.env.TURN_SERVER_URL || '';
  const turnUsername = process.env.TURN_USERNAME || '';
  const turnCredential = process.env.TURN_CREDENTIAL || '';

  if (!turnServerUrl && isProduction) {
    logger.warn(
      '[SECURITY] No TURN_SERVER_URL configured. ' +
      'WebRTC calls may fail behind symmetric NATs without a TURN relay.'
    );
  }

  // ── Seed Admin Password ──
  let seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || '';
  if (!seedAdminPassword) {
    seedAdminPassword = generateRandomPassword();
    logger.info(
      `[SECURITY] No SEED_ADMIN_PASSWORD set. Generated random password for seed accounts. ` +
      `Check server logs on first boot for the generated credentials.`
    );
  }

  if (isProduction && INSECURE_PASSWORDS.has(seedAdminPassword)) {
    throw new Error(
      '[SECURITY] SEED_ADMIN_PASSWORD is using a known insecure value. ' +
      'Set a strong password in environment variables.'
    );
  }

  // ── CORS Origins ──
  const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  
  if (isProduction && corsOrigins.length === 0) {
    logger.warn(
      '[SECURITY] No CORS_ORIGINS configured. ' +
      'Set CORS_ORIGINS to a comma-separated list of allowed frontend domains. ' +
      'Example: CORS_ORIGINS="https://your-app.vercel.app,https://your-domain.com"'
    );
  }

  cachedConfig = {
    jwtSecret,
    jwtRefreshSecret: effectiveRefreshSecret,
    mongoUri,
    turnServerUrl,
    turnUsername,
    turnCredential,
    seedAdminPassword,
    isProduction,
    corsAllowedOrigins: corsOrigins,
  };

  logger.info('[SECURITY] Security configuration validated successfully.');
  return cachedConfig;
}

/**
 * Returns the ICE server configuration for WebRTC.
 * Uses TURN from env vars if configured, otherwise falls back to public STUN servers.
 */
export function getIceServers(): Array<{ urls: string; username?: string; credential?: string }> {
  const config = cachedConfig || loadSecurityConfig();
  
  const servers: Array<{ urls: string; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (config.turnServerUrl) {
    servers.push({
      urls: config.turnServerUrl,
      username: config.turnUsername,
      credential: config.turnCredential,
    });
  }

  return servers;
}

/**
 * Validates a password against the security policy.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must not exceed 128 characters.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  if (INSECURE_PASSWORDS.has(password)) {
    return 'This password is too common. Please choose a stronger password.';
  }
  return null;
}
