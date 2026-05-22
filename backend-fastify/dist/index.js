"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// backend-fastify/src/index.ts
var import_fastify = __toESM(require("fastify"));
var import_cors = __toESM(require("@fastify/cors"));
var import_websocket = __toESM(require("@fastify/websocket"));
var import_dotenv2 = __toESM(require("dotenv"));
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));

// backend-fastify/src/routes/auth.ts
var import_bcrypt = __toESM(require("bcrypt"));
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));

// backend-fastify/src/models/User.ts
var import_mongoose = require("mongoose");
var UserSchema = new import_mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  password: { type: String },
  // Fallback for web application compatibility
  workspaceId: { type: String },
  role: { type: String, default: "Member" },
  avatarUrl: { type: String },
  googleId: { type: String },
  appleId: { type: String },
  mfaSecret: { type: String },
  mfaEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
var User = (0, import_mongoose.model)("User", UserSchema);

// backend-fastify/src/models/Tenant.ts
var import_mongoose2 = require("mongoose");
var TenantSchema = new import_mongoose2.Schema({
  name: { type: String, required: true },
  workspaceId: { type: String, required: true, unique: true },
  domain: { type: String, required: true },
  adminEmail: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { collection: "tenants" });
var Tenant = (0, import_mongoose2.model)("Tenant", TenantSchema);

// backend-fastify/src/models/RefreshToken.ts
var import_mongoose3 = require("mongoose");
var RefreshTokenSchema = new import_mongoose3.Schema({
  userId: { type: import_mongoose3.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  // Mongoose auto TTL cleanup
  createdAt: { type: Date, default: Date.now }
});
var RefreshToken = (0, import_mongoose3.model)("RefreshToken", RefreshTokenSchema);

// backend-fastify/src/middlewares/auth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var getJwtSecret = () => process.env.JWT_SECRET || "nexus-jwt-secret-key";
async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized: Missing or invalid token format." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = import_jsonwebtoken.default.verify(token, getJwtSecret());
    if (!decoded || !decoded.userId) {
      return reply.code(401).send({ error: "Unauthorized: Access token is invalid or expired." });
    }
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      workspaceId: decoded.workspaceId
    };
  } catch (err) {
    console.error("JWT Verification failed! Error:", err.message);
    return reply.code(401).send({ error: "Unauthorized: Session authentication failed." });
  }
}

// backend-fastify/src/utils/redis.ts
var import_ioredis = __toESM(require("ioredis"));
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
var redisClient;
var isRedisAvailable = false;
var memoryStore = {};
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    redisClient = new import_ioredis.default(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: 1,
      connectTimeout: 2e3,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null
    });
    redisClient.on("connect", () => {
      console.log("Redis connected successfully.");
      isRedisAvailable = true;
    });
    redisClient.on("error", (err) => {
      console.warn("Redis error occurred, reverting to fallback memory store:", err.message);
      isRedisAvailable = false;
    });
    redisClient.connect().catch((err) => {
      console.warn("Redis unavailable, utilizing local memory cache:", err.message);
      isRedisAvailable = false;
    });
  } catch (e) {
    console.warn("Could not launch Redis instance, utilizing local memory cache.");
  }
} else {
  console.log("No REDIS_URL provided, utilizing local memory cache.");
}
async function getLockoutTimeRemaining(email) {
  const key = `lockout:${email.toLowerCase()}`;
  if (isRedisAvailable) {
    const attempts = await redisClient.get(key);
    if (attempts && parseInt(attempts) >= 5) {
      const ttl = await redisClient.ttl(key);
      return ttl > 0 ? Math.ceil(ttl / 60) : 15;
    }
  } else {
    const item = memoryStore[key];
    if (item && item.count >= 5) {
      const remainingMs = item.expiresAt - Date.now();
      if (remainingMs > 0) {
        return Math.ceil(remainingMs / 1e3 / 60);
      } else {
        delete memoryStore[key];
      }
    }
  }
  return 0;
}
async function registerFailedAttempt(email) {
  const key = `lockout:${email.toLowerCase()}`;
  const maxAttempts = 5;
  const lockoutTimeSeconds = 15 * 60;
  if (isRedisAvailable) {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, lockoutTimeSeconds);
    }
    return current >= maxAttempts;
  } else {
    const now = Date.now();
    if (!memoryStore[key] || memoryStore[key].expiresAt < now) {
      memoryStore[key] = { count: 1, expiresAt: now + lockoutTimeSeconds * 1e3 };
    } else {
      memoryStore[key].count += 1;
    }
    return memoryStore[key].count >= maxAttempts;
  }
}
async function resetFailedAttempts(email) {
  const key = `lockout:${email.toLowerCase()}`;
  if (isRedisAvailable) {
    await redisClient.del(key);
  } else {
    delete memoryStore[key];
  }
}

// backend-fastify/src/utils/mfa.ts
var import_speakeasy = __toESM(require("speakeasy"));
var import_qrcode = __toESM(require("qrcode"));
async function generateMfaSecret(email) {
  const secret = import_speakeasy.default.generateSecret({
    name: `NexusZoom:${email}`,
    length: 20
  });
  const otpauthUrl = secret.otpauth_url || "";
  const qrCodeBase64 = await import_qrcode.default.toDataURL(otpauthUrl);
  return {
    secret: secret.base32,
    otpauthUrl,
    qrCodeBase64
  };
}
function verifyMfaToken(secret, token) {
  return import_speakeasy.default.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2
    // Allow 1 step grace before/after to accommodate slight system clock drifts
  });
}

// backend-fastify/src/utils/mongo.ts
var import_mongoose4 = __toESM(require("mongoose"));
var lastConnectError = null;
function validateMongoUri(uri) {
  if (!uri || !uri.startsWith("mongodb")) {
    return "MONGO_URI must start with mongodb:// or mongodb+srv://";
  }
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const atCount = (withoutScheme.match(/@/g) || []).length;
  if (atCount > 1) {
    return 'MONGO_URI looks malformed: password contains "@" \u2014 encode it as %40 (example: Dhanushcj@123 \u2192 Dhanushcj%40123)';
  }
  return null;
}
function getLastMongoError() {
  return lastConnectError;
}
async function connectMongo(uri, log) {
  const uriError = validateMongoUri(uri);
  if (uriError) {
    lastConnectError = uriError;
    log.error(uriError);
    throw new Error(uriError);
  }
  import_mongoose4.default.set("strictQuery", true);
  try {
    await import_mongoose4.default.connect(uri, {
      serverSelectionTimeoutMS: 1e4,
      connectTimeoutMS: 1e4
    });
    lastConnectError = null;
    log.info("Mongoose successfully established MongoDB connection.");
    return true;
  } catch (err) {
    let message = err.message;
    if (message.includes("bad auth")) {
      message = "MongoDB authentication failed \u2014 wrong username/password in MONGO_URI. In Atlas: Database Access \u2192 edit user \u2192 reset password (avoid @ in password), then update Render MONGO_URI.";
    }
    lastConnectError = message;
    log.error("Mongoose failed connecting to MongoDB: " + message);
    throw new Error(message);
  }
}
function isMongoConnected() {
  return import_mongoose4.default.connection.readyState === 1;
}

// backend-fastify/src/routes/auth.ts
var getJwtSecret2 = () => process.env.JWT_SECRET || "nexus-jwt-secret-key";
var getJwtRefreshSecret = () => process.env.JWT_REFRESH_SECRET || "nexus-refresh-secret-key";
async function authRoutes(fastify2) {
  async function issueTokens(user) {
    const email = user.email || user.adminEmail;
    const role = user.role || "company-admin";
    const workspaceId = user.workspaceId || "antigraviity-hq";
    const accessToken = import_jsonwebtoken2.default.sign(
      { userId: user._id, email, name: user.name, role, workspaceId },
      getJwtSecret2(),
      { expiresIn: "15m" }
    );
    const refreshTokenString = import_jsonwebtoken2.default.sign(
      { userId: user._id },
      getJwtRefreshSecret(),
      { expiresIn: "30d" }
    );
    const expiresAt = /* @__PURE__ */ new Date();
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
  fastify2.post("/signup", async (request, reply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({
          error: "Database is not connected. Cannot create account right now."
        });
      }
      const { name, email, password, avatarUrl } = request.body;
      if (!name || !email || !password) {
        return reply.code(400).send({ error: "Name, email, and password are required." });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: "Password must be at least 6 characters." });
      }
      const normEmail = email.toLowerCase().trim();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail);
      if (!emailValid) {
        return reply.code(400).send({ error: "Please enter a valid email address." });
      }
      const existing = await User.findOne({ email: normEmail });
      if (existing) {
        return reply.code(409).send({ error: "An account with this email already exists. Please sign in." });
      }
      const tenantExists = await Tenant.findOne({ adminEmail: normEmail });
      if (tenantExists) {
        return reply.code(409).send({ error: "An account with this email already exists. Please sign in." });
      }
      const salt = await import_bcrypt.default.genSalt(12);
      const passwordHash = await import_bcrypt.default.hash(password, salt);
      const workspaceId = `ws-${normEmail.split("@")[0].replace(/[^a-z0-9]/gi, "-")}`;
      const user = await User.create({
        name: name.trim(),
        email: normEmail,
        passwordHash,
        workspaceId,
        role: "Member",
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        mfaEnabled: false
      });
      const tokenBundle = await issueTokens(user);
      return reply.code(201).send(tokenBundle);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create user account.", details: err.message });
    }
  });
  fastify2.post("/login", async (request, reply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({
          error: "Database is not connected. Set MONGO_URI on the server (encode @ in password as %40)."
        });
      }
      const { email, password } = request.body;
      if (!email || !password) {
        return reply.code(400).send({ error: "Email and password are required." });
      }
      const normEmail = email.toLowerCase();
      const minutesLeft = await getLockoutTimeRemaining(normEmail);
      if (minutesLeft > 0) {
        return reply.code(423).send({
          error: `Account is temporarily locked due to repeated failures. Please try again in ${minutesLeft} minutes.`
        });
      }
      const tenant = await Tenant.findOne({ adminEmail: normEmail });
      if (tenant) {
        const activeHash2 = tenant.password;
        const isValid2 = await import_bcrypt.default.compare(password, activeHash2);
        if (!isValid2) {
          const isLockedNow = await registerFailedAttempt(normEmail);
          if (isLockedNow) {
            return reply.code(423).send({
              error: "Account locked: 5 failed attempts triggered. Please wait 15 minutes."
            });
          }
          return reply.code(401).send({ error: "Invalid login credentials." });
        }
        await resetFailedAttempts(normEmail);
        const tokenBundle2 = await issueTokens(tenant);
        return reply.code(200).send(tokenBundle2);
      }
      const user = await User.findOne({ email: normEmail });
      if (!user || !user.passwordHash && !user.password) {
        await registerFailedAttempt(normEmail);
        return reply.code(401).send({ error: "Invalid login credentials." });
      }
      const activeHash = user.passwordHash || user.password;
      const isValid = await import_bcrypt.default.compare(password, activeHash);
      if (!isValid) {
        const isLockedNow = await registerFailedAttempt(normEmail);
        if (isLockedNow) {
          return reply.code(423).send({
            error: "Account locked: 5 failed attempts triggered. Please wait 15 minutes."
          });
        }
        return reply.code(401).send({ error: "Invalid login credentials." });
      }
      await resetFailedAttempts(normEmail);
      if (user.mfaEnabled) {
        const mfaTicket = import_jsonwebtoken2.default.sign(
          { userId: user._id, type: "mfa_pending" },
          getJwtSecret2(),
          { expiresIn: "3m" }
        );
        return reply.code(200).send({
          mfaRequired: true,
          mfaTicket
        });
      }
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err) {
      return reply.code(500).send({ error: "Login handler error.", details: err.message });
    }
  });
  fastify2.post("/verify-mfa", async (request, reply) => {
    try {
      const { mfaTicket, token } = request.body;
      if (!mfaTicket || !token) {
        return reply.code(400).send({ error: "MFA ticket and 6-digit passcode are required." });
      }
      const decoded = import_jsonwebtoken2.default.verify(mfaTicket, getJwtSecret2());
      if (!decoded || decoded.type !== "mfa_pending") {
        return reply.code(401).send({ error: "Invalid or expired MFA ticket." });
      }
      const user = await User.findById(decoded.userId);
      if (!user || !user.mfaSecret) {
        return reply.code(404).send({ error: "User MFA configuration not found." });
      }
      const isOtpValid = verifyMfaToken(user.mfaSecret, token);
      if (!isOtpValid) {
        return reply.code(401).send({ error: "Invalid MFA verification code." });
      }
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err) {
      return reply.code(401).send({ error: "MFA verification failed.", details: err.message });
    }
  });
  fastify2.post("/refresh", async (request, reply) => {
    try {
      const { refreshToken } = request.body;
      if (!refreshToken) {
        return reply.code(400).send({ error: "Refresh token is required." });
      }
      const decoded = import_jsonwebtoken2.default.verify(refreshToken, getJwtRefreshSecret());
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ error: "Invalid refresh token." });
      }
      const stored = await RefreshToken.findOneAndDelete({ token: refreshToken });
      if (!stored) {
        return reply.code(401).send({ error: "Token has been revoked or rotated." });
      }
      const user = await User.findById(decoded.userId);
      if (!user) {
        return reply.code(404).send({ error: "User session no longer active." });
      }
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err) {
      return reply.code(401).send({ error: "Token rotation failed.", details: err.message });
    }
  });
  fastify2.post("/mfa/setup", { preHandler: authenticate }, async (request, reply) => {
    try {
      const user = await User.findById(request.user.id);
      if (!user) {
        return reply.code(404).send({ error: "User profile not found." });
      }
      const mfaBundle = await generateMfaSecret(user.email);
      user.mfaSecret = mfaBundle.secret;
      await user.save();
      return reply.code(200).send(mfaBundle);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to initialize MFA secrets.", details: err.message });
    }
  });
  fastify2.post("/mfa/enable", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { token } = request.body;
      if (!token) {
        return reply.code(400).send({ error: "TOTP activation code is required." });
      }
      const user = await User.findById(request.user.id);
      if (!user || !user.mfaSecret) {
        return reply.code(400).send({ error: "MFA setup must be initiated first." });
      }
      const isValid = verifyMfaToken(user.mfaSecret, token);
      if (!isValid) {
        return reply.code(401).send({ error: "Invalid token code. MFA setup aborted." });
      }
      user.mfaEnabled = true;
      await user.save();
      return reply.code(200).send({ success: true, message: "TOTP Multi-Factor Authentication successfully enabled." });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to verify OTP.", details: err.message });
    }
  });
  fastify2.post("/oauth/exchange", async (request, reply) => {
    try {
      const { provider, oauthId, email, name, avatarUrl } = request.body;
      if (!provider || !oauthId || !email || !name) {
        return reply.code(400).send({ error: "Missing mandatory OAuth parameters." });
      }
      let user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        if (provider === "google" && !user.googleId) {
          user.googleId = oauthId;
          await user.save();
        } else if (provider === "apple" && !user.appleId) {
          user.appleId = oauthId;
          await user.save();
        }
      } else {
        user = await User.create({
          name,
          email: email.toLowerCase(),
          googleId: provider === "google" ? oauthId : void 0,
          appleId: provider === "apple" ? oauthId : void 0,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
          mfaEnabled: false
        });
      }
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err) {
      return reply.code(500).send({ error: "OAuth exchange process failed.", details: err.message });
    }
  });
}

// backend-fastify/src/routes/meetings.ts
var import_bcrypt2 = __toESM(require("bcrypt"));
var import_mongoose8 = require("mongoose");

// backend-fastify/src/models/Meeting.ts
var import_mongoose5 = require("mongoose");
var MeetingSchema = new import_mongoose5.Schema({
  title: { type: String, required: true },
  hostId: { type: import_mongoose5.Schema.Types.ObjectId, ref: "User", required: true },
  joinCode: { type: String, required: true, unique: true, index: true },
  passcodeHash: { type: String },
  scheduledAt: { type: Date, default: Date.now },
  durationMinutes: { type: Number, default: 60 },
  status: { type: String, enum: ["scheduled", "live", "ended"], default: "scheduled" },
  recordingEnabled: { type: Boolean, default: false },
  participantIds: [{ type: import_mongoose5.Schema.Types.ObjectId, ref: "User" }],
  aiSummary: { type: String },
  createdAt: { type: Date, default: Date.now }
});
var Meeting = (0, import_mongoose5.model)("Meeting", MeetingSchema);

// backend-fastify/src/models/Participant.ts
var import_mongoose6 = require("mongoose");
var ParticipantSchema = new import_mongoose6.Schema({
  meetingId: { type: import_mongoose6.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
  userId: { type: import_mongoose6.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["host", "co-host", "attendee"], default: "attendee" },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  audioMuted: { type: Boolean, default: false },
  videoMuted: { type: Boolean, default: false }
});
var Participant = (0, import_mongoose6.model)("Participant", ParticipantSchema);

// backend-fastify/src/models/Recording.ts
var import_mongoose7 = require("mongoose");
var RecordingSchema = new import_mongoose7.Schema({
  meetingId: { type: import_mongoose7.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
  r2Key: { type: String, required: true },
  durationSeconds: { type: Number, default: 0 },
  sizeBytes: { type: Number, default: 0 },
  status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
  transcriptUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});
var Recording = (0, import_mongoose7.model)("Recording", RecordingSchema);

// backend-fastify/src/routes/meetings.ts
async function meetingRoutes(fastify2) {
  async function generate9DigitJoinCode() {
    let attempts = 0;
    while (attempts < 10) {
      const code = Math.floor(1e8 + Math.random() * 9e8).toString();
      const formatted = `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6)}`;
      const existing = await Meeting.findOne({ joinCode: formatted });
      if (!existing) {
        return formatted;
      }
      attempts++;
    }
    return Math.floor(1e8 + Math.random() * 9e8).toString();
  }
  function normalizeJoinCode2(code) {
    const trimmed = String(code || "").trim().toUpperCase();
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length === 9) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return trimmed;
  }
  async function resolveMeetingIdentifier(idOrCode) {
    const value = String(idOrCode || "").trim();
    if (import_mongoose8.Types.ObjectId.isValid(value)) {
      const meeting = await Meeting.findById(value);
      if (meeting?.joinCode) {
        const canonical = await Meeting.findOne({ joinCode: normalizeJoinCode2(meeting.joinCode) }).sort({ createdAt: 1, _id: 1 });
        return canonical || meeting;
      }
      return meeting;
    }
    return Meeting.findOne({ joinCode: normalizeJoinCode2(value) }).sort({ createdAt: 1, _id: 1 });
  }
  fastify2.post("/", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { title, passcode, durationMinutes, scheduledAt, recordingEnabled } = request.body;
      if (!title) {
        return reply.code(400).send({ error: "Meeting title is required." });
      }
      const joinCode = await generate9DigitJoinCode();
      let passcodeHash;
      if (passcode) {
        passcodeHash = await import_bcrypt2.default.hash(passcode, 10);
      }
      const meeting = await Meeting.create({
        title,
        hostId: new import_mongoose8.Types.ObjectId(request.user.id),
        joinCode,
        passcodeHash,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : /* @__PURE__ */ new Date(),
        durationMinutes: durationMinutes || 60,
        recordingEnabled: !!recordingEnabled,
        status: "scheduled",
        participantIds: [new import_mongoose8.Types.ObjectId(request.user.id)]
      });
      await Participant.create({
        meetingId: meeting._id,
        userId: new import_mongoose8.Types.ObjectId(request.user.id),
        role: "host",
        joinedAt: /* @__PURE__ */ new Date(),
        audioMuted: false,
        videoMuted: false
      });
      const webhookUrl = `${process.env.WEB_APP_URL || "http://localhost:3000"}/api/webhooks/meetings`;
      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET || "nexus_webhook_secure_secret_123"
        },
        body: JSON.stringify({
          event: "meeting.created",
          data: {
            workspaceId: "antigraviity-hq",
            title: meeting.title,
            host: request.user.name || "Host User",
            hostEmail: request.user.email || "host@antigraviity.com",
            roomId: meeting.joinCode.replace(/-/g, ""),
            startTime: meeting.scheduledAt,
            duration: meeting.durationMinutes,
            password: passcode
          }
        })
      }).then((res) => {
        console.log(`\u{1FA9D} [WEBHOOK] Successfully dispatched meeting.created: Status ${res.status}`);
      }).catch((err) => {
        console.error("\u{1FA9D} [WEBHOOK] dispatch failed:", err.message);
      });
      return reply.code(201).send(meeting);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create meeting room.", details: err.message });
    }
  });
  fastify2.get("/join/:code", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { code } = request.params;
      const { passcode } = request.query;
      const cleanCode = normalizeJoinCode2(String(code || ""));
      let meeting = await resolveMeetingIdentifier(cleanCode);
      const persistentRoomTitles = {
        "NEXUS-BOARDROOM": "\u{1F30C} General Boardroom",
        "NEXUS-ENG": "\u{1F4BB} Developer Sandbox",
        "NEXUS-DESIGN": "\u{1F3A8} UX Design Workshop"
      };
      if (!meeting && persistentRoomTitles[cleanCode]) {
        meeting = await Meeting.findOneAndUpdate(
          { joinCode: cleanCode },
          {
            $setOnInsert: {
              title: persistentRoomTitles[cleanCode],
              hostId: new import_mongoose8.Types.ObjectId(request.user.id),
              joinCode: cleanCode,
              scheduledAt: /* @__PURE__ */ new Date(),
              durationMinutes: 9999,
              recordingEnabled: false,
              participantIds: [new import_mongoose8.Types.ObjectId(request.user.id)]
            },
            $set: { status: "live" }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting not found for this join code." });
      }
      if (!meeting.populated("hostId")) {
        await meeting.populate("hostId", "name email avatarUrl");
      }
      if (meeting.status === "ended") {
        return reply.code(410).send({ error: "This meeting has already ended." });
      }
      if (meeting.passcodeHash) {
        const isPasscodeValid = passcode && await import_bcrypt2.default.compare(String(passcode), meeting.passcodeHash);
        if (!isPasscodeValid) {
          return reply.code(401).send({ error: "Invalid meeting passcode." });
        }
      }
      const userId = new import_mongoose8.Types.ObjectId(request.user.id);
      const hostId = meeting.hostId._id?.toString?.() || meeting.hostId.toString();
      await Participant.findOneAndUpdate(
        { meetingId: meeting._id, userId },
        {
          $set: {
            meetingId: meeting._id,
            userId,
            role: hostId === request.user.id ? "host" : "attendee",
            joinedAt: /* @__PURE__ */ new Date()
          },
          $unset: { leftAt: "" }
        },
        { upsert: true, new: true }
      );
      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $addToSet: { participantIds: userId },
          ...meeting.status === "scheduled" ? { $set: { status: "live" } } : {}
        }
      );
      const activeParticipantCount = await Participant.countDocuments({
        meetingId: meeting._id,
        leftAt: { $exists: false }
      });
      return reply.code(200).send({
        _id: meeting._id,
        meetingId: meeting._id,
        joinCode: meeting.joinCode,
        roomId: meeting.joinCode,
        title: meeting.title,
        host: meeting.hostId,
        scheduledAt: meeting.scheduledAt,
        durationMinutes: meeting.durationMinutes,
        status: meeting.status === "scheduled" ? "live" : meeting.status,
        hasPasscode: !!meeting.passcodeHash,
        participantIds: meeting.participantIds,
        activeParticipantCount,
        isHost: hostId === request.user.id
      });
    } catch (err) {
      return reply.code(500).send({ error: "Error resolving meeting join code.", details: err.message });
    }
  });
  fastify2.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      if (!import_mongoose8.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid meeting ID format." });
      }
      const meeting = await Meeting.findById(id).populate("hostId", "name email avatarUrl");
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      const activeCount = await Participant.countDocuments({
        meetingId: meeting._id,
        leftAt: { $exists: false }
      });
      return reply.code(200).send({
        meeting,
        activeParticipantCount: activeCount
      });
    } catch (err) {
      return reply.code(500).send({ error: "Error fetching meeting properties.", details: err.message });
    }
  });
  fastify2.patch("/:id", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { title, scheduledAt, durationMinutes, recordingEnabled } = request.body;
      if (!import_mongoose8.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid meeting ID." });
      }
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting not found." });
      }
      if (meeting.hostId.toString() !== request.user.id) {
        return reply.code(403).send({ error: "Forbidden: Only the room host can update meeting settings." });
      }
      if (title !== void 0) meeting.title = title;
      if (scheduledAt !== void 0) meeting.scheduledAt = new Date(scheduledAt);
      if (durationMinutes !== void 0) meeting.durationMinutes = durationMinutes;
      if (recordingEnabled !== void 0) meeting.recordingEnabled = !!recordingEnabled;
      await meeting.save();
      return reply.code(200).send(meeting);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update meeting configs.", details: err.message });
    }
  });
  fastify2.post("/:id/start", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      if (meeting.hostId.toString() !== request.user.id) {
        return reply.code(403).send({ error: "Forbidden: Only the host can launch this session." });
      }
      if (meeting.status === "ended") {
        return reply.code(400).send({ error: "Cannot start a session that has already finished." });
      }
      meeting.status = "live";
      await meeting.save();
      if (fastify2.websocketServer) {
        fastify2.websocketServer.clients.forEach((client) => {
          client.send(JSON.stringify({
            event: "meeting-started",
            data: { meetingId: meeting._id, title: meeting.title }
          }));
        });
      }
      const webhookUrl = `${process.env.WEB_APP_URL || "http://localhost:3000"}/api/webhooks/meetings`;
      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET || "nexus_webhook_secure_secret_123"
        },
        body: JSON.stringify({
          event: "meeting.started",
          data: {
            roomId: meeting.joinCode.replace(/-/g, ""),
            status: "Live"
          }
        })
      }).then((res) => {
        console.log(`\u{1FA9D} [WEBHOOK] Successfully dispatched meeting.started: Status ${res.status}`);
      }).catch((err) => {
        console.error("\u{1FA9D} [WEBHOOK] dispatch failed:", err.message);
      });
      return reply.code(200).send({ success: true, status: "live", meeting });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to boot meeting session.", details: err.message });
    }
  });
  fastify2.post("/:id/end", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      if (meeting.hostId.toString() !== request.user.id) {
        return reply.code(403).send({ error: "Forbidden: Only the host can terminate this session." });
      }
      meeting.status = "ended";
      await meeting.save();
      const webhookUrl = `${process.env.WEB_APP_URL || "http://localhost:3000"}/api/webhooks/meetings`;
      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET || "nexus_webhook_secure_secret_123"
        },
        body: JSON.stringify({
          event: "meeting.ended",
          data: {
            roomId: meeting.joinCode.replace(/-/g, ""),
            status: "Ended"
          }
        })
      }).then((res) => {
        console.log(`\u{1FA9D} [WEBHOOK] Successfully dispatched meeting.ended: Status ${res.status}`);
      }).catch((err) => {
        console.error("\u{1FA9D} [WEBHOOK] dispatch failed:", err.message);
      });
      await Participant.updateMany(
        { meetingId: meeting._id, leftAt: { $exists: false } },
        { leftAt: /* @__PURE__ */ new Date() }
      );
      let recordingDoc = null;
      if (meeting.recordingEnabled) {
        const durationSeconds = Math.floor((Date.now() - meeting.scheduledAt.getTime()) / 1e3);
        recordingDoc = await Recording.create({
          meetingId: meeting._id,
          r2Key: `recordings/${meeting._id}_stream.mp4`,
          durationSeconds: Math.max(60, durationSeconds),
          sizeBytes: Math.floor(Math.random() * 2e7) + 5e6,
          // 5MB to 25MB mock
          status: "processing"
        });
      }
      return reply.code(200).send({
        success: true,
        status: "ended",
        recordingTriggered: meeting.recordingEnabled,
        recording: recordingDoc
      });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to end meeting properly.", details: err.message });
    }
  });
  fastify2.post("/:id/leave", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const meeting = await resolveMeetingIdentifier(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      await Participant.findOneAndUpdate(
        {
          meetingId: meeting._id,
          userId: new import_mongoose8.Types.ObjectId(request.user.id),
          leftAt: { $exists: false }
        },
        { leftAt: /* @__PURE__ */ new Date() },
        { new: true }
      );
      const activeParticipantCount = await Participant.countDocuments({
        meetingId: meeting._id,
        leftAt: { $exists: false }
      });
      return reply.code(200).send({
        success: true,
        meetingId: meeting._id,
        activeParticipantCount
      });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to leave meeting.", details: err.message });
    }
  });
  fastify2.get("/history", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { page = 1, limit = 10 } = request.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const userId = new import_mongoose8.Types.ObjectId(request.user.id);
      const meetings = await Meeting.find({
        $or: [
          { hostId: userId },
          { participantIds: userId }
        ]
      }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate("hostId", "name email avatarUrl");
      const total = await Meeting.countDocuments({
        $or: [
          { hostId: userId },
          { participantIds: userId }
        ]
      });
      return reply.code(200).send({
        meetings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to retrieve history logs.", details: err.message });
    }
  });
  fastify2.get("/:id/participants", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const meeting = await resolveMeetingIdentifier(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting not found." });
      }
      const participants = await Participant.find({
        meetingId: meeting._id,
        leftAt: { $exists: false }
      }).populate("userId", "name email avatarUrl");
      const mapped = participants.map((p) => {
        const userObj = p.userId || {};
        return {
          id: p._id.toString(),
          userId: userObj._id?.toString() || p.userId?.toString() || "unknown",
          name: userObj.name || "Anonymous Peer",
          email: userObj.email || "",
          avatar: (userObj.name || "AP").slice(0, 2).toUpperCase(),
          role: p.role,
          audioMuted: p.audioMuted,
          videoMuted: p.videoMuted,
          joinedAt: p.joinedAt
        };
      });
      return reply.code(200).send(mapped);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to retrieve active participants.", details: err.message });
    }
  });
  fastify2.post("/:id/summarize", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      if (!import_mongoose8.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid meeting ID format." });
      }
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      if (meeting.status !== "ended") {
        return reply.code(400).send({ error: "Summaries can only be generated for completed meetings." });
      }
      if (meeting.aiSummary) {
        return reply.code(200).send({ summary: meeting.aiSummary });
      }
      const simulatedTranscript = `
        Host: Welcome everyone to the Q3 planning sync. We need to finalize the roadmap.
        Sarah: I've prepared the front-end milestones. We'll be migrating the dashboard to React Native next week.
        Host: Excellent. What's the timeline on the backend API alignment?
        Michael: I'll have the Fastify endpoints ready by Thursday. We're prioritizing WebSockets.
        Host: Great. Let's make sure Sarah and Michael sync up on the WebSocket payload structures.
        Sarah: Will do. I'll schedule a brief 15-minute sync with Michael tomorrow.
        Host: Perfect. That wraps up our primary agenda. Thanks everyone.
      `;
      const prompt = `
        Analyze the following meeting transcript and generate a highly professional, beautifully formatted markdown Executive Summary.
        Include:
        - A brief 2-sentence Executive Overview.
        - Key Decisions Made (bullet points).
        - Action Items (with assigned owners).
        
        Transcript:
        ${simulatedTranscript}
      `;
      let generatedSummary = "";
      const groqKey = process.env.GROQ_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      if (groqKey) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }]
          })
        });
        const data = await response.json();
        generatedSummary = data.choices?.[0]?.message?.content || "";
      } else if (geminiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        const data = await response.json();
        generatedSummary = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        generatedSummary = `### \u{1F4DD} Executive Overview
The team convened for the Q3 planning sync to finalize the product roadmap. The primary focus was on aligning front-end migration milestones with backend API deliverables to ensure a seamless transition.

### \u{1F3AF} Key Decisions Made
* **Frontend Migration:** The dashboard will be migrated to React Native starting next week.
* **Backend Priorities:** Fastify API endpoints, with a specific focus on WebSockets, will be completed by Thursday.

### \u{1F680} Action Items
* **[Sarah]** - Execute the dashboard React Native migration.
* **[Michael]** - Deliver the Fastify API endpoints (WebSockets) by Thursday.
* **[Sarah & Michael]** - Conduct a 15-minute sync tomorrow to finalize WebSocket payload structures.`;
      }
      meeting.aiSummary = generatedSummary;
      await meeting.save();
      return reply.code(200).send({ summary: meeting.aiSummary });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to generate AI summary.", details: err.message });
    }
  });
}

// backend-fastify/src/models/Mail.ts
var import_mongoose9 = __toESM(require("mongoose"));
var mailSchema = new import_mongoose9.default.Schema({
  workspaceId: { type: String, required: true, default: "antigraviity-hq" },
  ownerEmail: { type: String, required: true },
  // The user who owns this specific copy of the email
  folder: { type: String, enum: ["inbox", "sent", "drafts", "trash", "archive"], default: "inbox" },
  senderName: { type: String, required: true },
  senderEmail: { type: String, required: true },
  recipientEmails: [{ type: String, required: true }],
  subject: { type: String, default: "(No Subject)" },
  body: { type: String, default: "" },
  isRead: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  attachments: [{
    name: String,
    url: String,
    size: Number,
    type: String
  }],
  sentAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
mailSchema.pre("save", function(next) {
  this.updatedAt = /* @__PURE__ */ new Date();
  next();
});
var Mail = import_mongoose9.default.model("Mail", mailSchema);

// backend-fastify/src/services/mailSockets.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var activeMailSockets = /* @__PURE__ */ new Map();
function handleMailSocket(socket, req) {
  const logFile = import_path.default.join(__dirname, "../../socket_debug.log");
  const log = (msg) => {
    try {
      import_fs.default.appendFileSync(logFile, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
`);
    } catch (e) {
    }
  };
  log(`New connection attempt. req.url: "${req.url}", req.query: ${JSON.stringify(req.query)}`);
  let email = req.query?.email;
  if (!email && req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      email = url.searchParams.get("email") || void 0;
      log(`Parsed email from URL: "${email}"`);
    } catch (e) {
      log(`Failed to parse URL: ${e.message}`);
    }
  }
  if (email) {
    log(`Successfully established Mail Socket for user: ${email}`);
    activeMailSockets.set(email, socket);
    socket.on("close", (code, reason) => {
      log(`Mail Socket closed for user: ${email}. Code: ${code}, Reason: "${reason ? reason.toString() : ""}"`);
      activeMailSockets.delete(email);
    });
    socket.on("error", (err) => {
      log(`Mail Socket error for user ${email}: ${err.message}`);
      activeMailSockets.delete(email);
    });
  } else {
    log(`Closing socket: Email identifier missing or empty.`);
    socket.close(1008, "Email identifier required");
  }
}

// backend-fastify/src/routes/mail.ts
async function fetchJsonWithTimeout(url, options, timeoutMs = 1e4) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
function buildLocalEmailDraft(prompt, subject, context) {
  const cleanPrompt = String(prompt || "").trim();
  const cleanSubject = String(subject || "").trim();
  const cleanContext = String(context || "").trim();
  const subjectLine = cleanSubject ? ` regarding "${cleanSubject}"` : "";
  const contextLine = cleanContext ? "I have reviewed the previous context and will keep the response aligned with it." : "I wanted to follow up with a clear update.";
  return [
    "Hi,",
    "",
    `${contextLine} ${cleanPrompt || `Please find my response${subjectLine} below.`}`,
    "",
    "Please let me know if you would like me to adjust the timeline or add any further details.",
    "",
    "Best regards,"
  ].join("\n");
}
async function mailRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/", async (request, reply) => {
    try {
      const folder = request.query.folder || "inbox";
      const ownerEmail = request.user.email;
      const mails = await Mail.find({ ownerEmail, folder }).sort({ sentAt: -1 });
      return reply.code(200).send(mails);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch mail" });
    }
  });
  fastify2.get("/:id", async (request, reply) => {
    try {
      const mail = await Mail.findOne({ _id: request.params.id, ownerEmail: request.user.email });
      if (!mail) return reply.code(404).send({ error: "Mail not found" });
      return reply.code(200).send(mail);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch mail" });
    }
  });
  fastify2.post("/send", async (request, reply) => {
    try {
      const { to, subject, body, attachments } = request.body;
      const senderName = request.user.name || request.user.email.split("@")[0];
      const senderEmail = request.user.email;
      const workspaceId = request.user.workspaceId || "antigraviity-hq";
      const recipientList = Array.isArray(to) ? to : [to].filter(Boolean);
      if (recipientList.length === 0) {
        return reply.code(400).send({ error: "At least one recipient is required" });
      }
      const sentMail = await Mail.create({
        workspaceId,
        ownerEmail: senderEmail,
        folder: "sent",
        senderName,
        senderEmail,
        recipientEmails: recipientList,
        subject,
        body,
        attachments: attachments || [],
        isRead: true
      });
      for (const recipientEmail of recipientList) {
        const inboxMail = await Mail.create({
          workspaceId,
          ownerEmail: recipientEmail,
          folder: "inbox",
          senderName,
          senderEmail,
          recipientEmails: recipientList,
          subject,
          body,
          attachments: attachments || [],
          isRead: false
        });
        if (activeMailSockets.has(recipientEmail)) {
          const ws = activeMailSockets.get(recipientEmail);
          if (ws?.readyState === 1) {
            ws.send(JSON.stringify({ type: "NEW_MAIL", mail: inboxMail }));
          }
        }
      }
      return reply.code(201).send(sentMail);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to send mail", details: err.message });
    }
  });
  fastify2.put("/:id/read", async (request, reply) => {
    try {
      const mail = await Mail.findOneAndUpdate(
        { _id: request.params.id, ownerEmail: request.user.email },
        { isRead: true },
        { new: true }
      );
      return reply.code(200).send(mail);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update mail" });
    }
  });
  fastify2.put("/:id/star", async (request, reply) => {
    try {
      const mail = await Mail.findOne({ _id: request.params.id, ownerEmail: request.user.email });
      if (!mail) return reply.code(404).send({ error: "Mail not found" });
      mail.isStarred = !mail.isStarred;
      await mail.save();
      return reply.code(200).send(mail);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update mail" });
    }
  });
  fastify2.put("/:id/move", async (request, reply) => {
    try {
      const { folder } = request.body;
      const mail = await Mail.findOneAndUpdate(
        { _id: request.params.id, ownerEmail: request.user.email },
        { folder },
        { new: true }
      );
      return reply.code(200).send(mail);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to move mail" });
    }
  });
  fastify2.delete("/:id", async (request, reply) => {
    try {
      await Mail.findOneAndDelete({ _id: request.params.id, ownerEmail: request.user.email });
      return reply.code(200).send({ message: "Mail permanently deleted" });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete mail" });
    }
  });
  fastify2.post("/smart-reply", async (request, reply) => {
    try {
      const { prompt, subject, context } = request.body;
      const groqKey = process.env.GROQ_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;
      const aiPrompt = `You are a highly professional AI email assistant. Your task is to draft or complete an email based on the following context.
Context/Previous Email: ${context || "None"}
Subject: ${subject || "None"}
User Prompt / Draft: ${prompt}

Important: Provide ONLY the final generated email body text. Do not include introductory conversational text like "Here is the email:" or quotes.`;
      let generatedText = "";
      let provider = "local-fallback";
      try {
        if (groqKey) {
          console.log("Routing smart-reply query to Groq...");
          const data = await fetchJsonWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant",
              messages: [{ role: "user", content: aiPrompt }]
            })
          });
          if (data.error) {
            console.error("Groq API Error Response:", JSON.stringify(data.error));
            throw new Error(data.error.message || "Groq error");
          }
          generatedText = data.choices?.[0]?.message?.content || "";
          provider = "groq";
        } else if (geminiKey) {
          console.log("Routing smart-reply query to Gemini...");
          const data = await fetchJsonWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] })
          });
          if (data.error) {
            console.error("Gemini API Error Response:", JSON.stringify(data.error));
            throw new Error(data.error.message || "Gemini error");
          }
          generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          provider = "gemini";
        }
      } catch (aiErr) {
        console.warn("AI Provider connection failed. Detail:", aiErr.message);
      }
      if (!generatedText) {
        console.log("Defaulting to high-fidelity local email draft fallback...");
        generatedText = buildLocalEmailDraft(prompt, subject, context);
      }
      return reply.code(200).send({ suggestion: generatedText.trim(), provider });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to generate suggestion", details: err.message });
    }
  });
}

// backend-fastify/src/routes/kural.ts
var import_mongoose12 = require("mongoose");

// backend-fastify/src/models/KuralConversation.ts
var import_mongoose10 = require("mongoose");
var KuralConversationSchema = new import_mongoose10.Schema({
  workspaceId: { type: String, required: true, index: true },
  type: { type: String, enum: ["direct", "channel"], default: "direct" },
  name: { type: String },
  participantEmails: [{ type: String, required: true, lowercase: true, trim: true }],
  createdByEmail: { type: String, required: true, lowercase: true, trim: true },
  lastMessageContent: { type: String },
  lastMessageTime: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
KuralConversationSchema.index({ workspaceId: 1, participantEmails: 1 });
KuralConversationSchema.index({ workspaceId: 1, updatedAt: -1 });
KuralConversationSchema.pre("save", function(next) {
  this.updatedAt = /* @__PURE__ */ new Date();
  next();
});
var KuralConversation = (0, import_mongoose10.model)("KuralConversation", KuralConversationSchema);

// backend-fastify/src/models/KuralMessage.ts
var import_mongoose11 = require("mongoose");
var KuralMessageSchema = new import_mongoose11.Schema({
  conversationId: { type: import_mongoose11.Schema.Types.ObjectId, ref: "KuralConversation", required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  senderEmail: { type: String, required: true, lowercase: true, trim: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
KuralMessageSchema.index({ conversationId: 1, createdAt: 1 });
var KuralMessage = (0, import_mongoose11.model)("KuralMessage", KuralMessageSchema);

// backend-fastify/src/routes/kural.ts
var defaultWorkspaceId = "antigraviity-hq";
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function initials(name) {
  return (name || "User").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}
async function ensureDirectConversation(workspaceId, currentEmail, peerEmail) {
  const participants = [currentEmail, peerEmail].map(normalizeEmail).sort();
  let conversation = await KuralConversation.findOne({
    workspaceId,
    type: "direct",
    participantEmails: { $all: participants, $size: 2 }
  });
  if (!conversation) {
    conversation = await KuralConversation.create({
      workspaceId,
      type: "direct",
      participantEmails: participants,
      createdByEmail: currentEmail
    });
  }
  return conversation;
}
async function channelRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const currentEmail = normalizeEmail(request.query.email || request.user?.email);
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      if (!currentEmail) {
        return reply.code(400).send({ error: "Current user email is required." });
      }
      const members = await User.find({
        workspaceId: activeWorkspaceId,
        email: { $ne: currentEmail }
      }).sort({ name: 1 }).select("name email role avatarUrl workspaceId createdAt");
      const channels = [];
      for (const member of members) {
        const conversation = await ensureDirectConversation(activeWorkspaceId, currentEmail, member.email);
        channels.push({
          _id: conversation._id,
          type: conversation.type,
          displayName: member.name,
          name: member.name,
          email: member.email,
          avatar: initials(member.name),
          role: member.role || "Member",
          workspaceId: activeWorkspaceId,
          isOnline: true,
          lastMessageContent: conversation.lastMessageContent || "Start a secure Kural conversation",
          lastMessageTime: conversation.lastMessageTime || conversation.updatedAt
        });
      }
      return reply.code(200).send(channels);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch Kural channels.", details: err.message });
    }
  });
}
async function kuralRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/:workspaceId/:channelId", async (request, reply) => {
    try {
      const { workspaceId, channelId } = request.params;
      if (!import_mongoose12.Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: "Invalid Kural channel id." });
      }
      const currentEmail = normalizeEmail(request.user?.email || "");
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        workspaceId,
        participantEmails: currentEmail
      });
      if (!conversation) {
        return reply.code(404).send({ error: "Kural conversation not found." });
      }
      const messages = await KuralMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).limit(100);
      return reply.code(200).send(messages.map((message) => ({
        _id: message._id,
        conversationId: message.conversationId,
        sender: message.senderEmail === currentEmail ? "You" : message.senderName,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
        timestamp: message.createdAt
      })));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch Kural messages.", details: err.message });
    }
  });
  fastify2.post("/:workspaceId/:channelId/messages", async (request, reply) => {
    try {
      const { workspaceId, channelId } = request.params;
      const content = String(request.body.content || "").trim();
      if (!import_mongoose12.Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: "Invalid Kural channel id." });
      }
      if (!content) {
        return reply.code(400).send({ error: "Message content is required." });
      }
      const currentEmail = normalizeEmail(request.user?.email || "");
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        workspaceId,
        participantEmails: currentEmail
      });
      if (!conversation) {
        return reply.code(404).send({ error: "Kural conversation not found." });
      }
      const message = await KuralMessage.create({
        conversationId: conversation._id,
        workspaceId,
        senderEmail: currentEmail,
        senderName: request.user?.name || currentEmail,
        content
      });
      conversation.lastMessageContent = content;
      conversation.lastMessageTime = message.createdAt;
      await conversation.save();
      return reply.code(201).send({
        _id: message._id,
        conversationId: message.conversationId,
        sender: "You",
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
        timestamp: message.createdAt
      });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to send Kural message.", details: err.message });
    }
  });
  fastify2.post("/start-dm", async (request, reply) => {
    try {
      const { members = [], createdBy, workspaceId } = request.body;
      const currentEmail = normalizeEmail(createdBy || request.user?.email || "");
      const peerEmail = normalizeEmail(members.find((email) => normalizeEmail(email) !== currentEmail));
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      if (!currentEmail || !peerEmail) {
        return reply.code(400).send({ error: "Two participant emails are required to start a direct message." });
      }
      const conversation = await ensureDirectConversation(activeWorkspaceId, currentEmail, peerEmail);
      return reply.code(200).send(conversation);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to start direct message.", details: err.message });
    }
  });
  fastify2.delete("/delete-conversation/:channelId", async (request, reply) => {
    try {
      const { channelId } = request.params;
      if (!import_mongoose12.Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: "Invalid Kural channel id." });
      }
      const currentEmail = normalizeEmail(request.user?.email || "");
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        participantEmails: currentEmail
      });
      if (!conversation) {
        return reply.code(404).send({ error: "Kural conversation not found." });
      }
      await KuralMessage.deleteMany({ conversationId: conversation._id });
      await conversation.deleteOne();
      return reply.code(200).send({ message: "Kural conversation deleted." });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete Kural conversation.", details: err.message });
    }
  });
}

// backend-fastify/src/routes/members.ts
var import_bcrypt3 = __toESM(require("bcrypt"));
var defaultWorkspaceId2 = "antigraviity-hq";
function publicUser(user) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || "Member",
    workspaceId: user.workspaceId || defaultWorkspaceId2,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt
  };
}
async function memberRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const users = await User.find({ workspaceId: workspaceId || defaultWorkspaceId2 }).sort({ createdAt: -1 }).select("-password -passwordHash -mfaSecret");
      return reply.code(200).send(users.map(publicUser));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch workspace members.", details: err.message });
    }
  });
  fastify2.post("/add", async (request, reply) => {
    try {
      const body = request.body;
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "").trim();
      const role = String(body.role || "Member").trim();
      const workspaceId = String(body.workspaceId || request.user?.workspaceId || defaultWorkspaceId2).trim();
      if (!name || !email || !password) {
        return reply.code(400).send({ error: "Name, email, and password are required." });
      }
      const existing = await User.findOne({ email });
      if (existing) {
        return reply.code(409).send({ error: "A user with this email already exists." });
      }
      const passwordHash = await import_bcrypt3.default.hash(password, 12);
      const avatarUrl = body.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
      const user = await User.create({
        name,
        email,
        passwordHash,
        role,
        workspaceId,
        avatarUrl,
        mfaEnabled: false
      });
      return reply.code(201).send(publicUser(user));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to add workspace user.", details: err.message });
    }
  });
}

// backend-fastify/src/models/Task.ts
var import_mongoose13 = require("mongoose");
var TaskSchema = new import_mongoose13.Schema({
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["todo", "in-progress", "done"],
    default: "todo"
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  assigneeEmail: { type: String, lowercase: true, trim: true },
  assigneeName: { type: String },
  createdByEmail: { type: String, required: true, lowercase: true, trim: true },
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
TaskSchema.index({ workspaceId: 1, status: 1 });
TaskSchema.index({ workspaceId: 1, createdAt: -1 });
TaskSchema.pre("save", function(next) {
  this.updatedAt = /* @__PURE__ */ new Date();
  next();
});
var Task = (0, import_mongoose13.model)("Task", TaskSchema);

// backend-fastify/src/routes/tasks.ts
var defaultWorkspaceId3 = "antigraviity-hq";
async function taskRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const { status } = request.query;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId3;
      const filter = { workspaceId: activeWorkspaceId };
      if (status) filter.status = status;
      const tasks = await Task.find(filter).sort({ createdAt: -1 });
      return reply.code(200).send(tasks);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch tasks.", details: err.message });
    }
  });
  fastify2.post("/", async (request, reply) => {
    try {
      const body = request.body;
      const title = String(body.title || "").trim();
      if (!title) {
        return reply.code(400).send({ error: "Task title is required." });
      }
      const workspaceId = String(
        body.workspaceId || request.user?.workspaceId || defaultWorkspaceId3
      ).trim();
      const task = await Task.create({
        workspaceId,
        title,
        description: body.description || "",
        status: body.status || "todo",
        priority: body.priority || "medium",
        assigneeEmail: body.assigneeEmail || "",
        assigneeName: body.assigneeName || "",
        createdByEmail: request.user?.email || "",
        dueDate: body.dueDate ? new Date(body.dueDate) : void 0
      });
      return reply.code(201).send(task);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create task.", details: err.message });
    }
  });
  fastify2.patch("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const allowedFields = ["title", "description", "status", "priority", "assigneeEmail", "assigneeName", "dueDate"];
      const update = { updatedAt: /* @__PURE__ */ new Date() };
      for (const field of allowedFields) {
        if (body[field] !== void 0) {
          update[field] = field === "dueDate" ? new Date(body[field]) : body[field];
        }
      }
      const task = await Task.findByIdAndUpdate(id, update, { new: true });
      if (!task) {
        return reply.code(404).send({ error: "Task not found." });
      }
      return reply.code(200).send(task);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update task.", details: err.message });
    }
  });
  fastify2.delete("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const task = await Task.findByIdAndDelete(id);
      if (!task) {
        return reply.code(404).send({ error: "Task not found." });
      }
      return reply.code(200).send({ message: "Task deleted successfully." });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete task.", details: err.message });
    }
  });
}

// backend-fastify/src/models/Document.ts
var import_mongoose14 = require("mongoose");
var DocumentSchema = new import_mongoose14.Schema({
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  type: {
    type: String,
    enum: ["doc", "sheet", "pdf", "folder", "other"],
    default: "doc"
  },
  ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  ownerName: { type: String },
  sizeBytes: { type: Number, default: 0 },
  url: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
DocumentSchema.index({ workspaceId: 1, createdAt: -1 });
DocumentSchema.pre("save", function(next) {
  this.updatedAt = /* @__PURE__ */ new Date();
  next();
});
var WorkspaceDocument = (0, import_mongoose14.model)("WorkspaceDocument", DocumentSchema);

// backend-fastify/src/routes/docs.ts
var defaultWorkspaceId4 = "antigraviity-hq";
async function docsRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const { type } = request.query;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId4;
      const filter = { workspaceId: activeWorkspaceId };
      if (type) filter.type = type;
      const docs = await WorkspaceDocument.find(filter).sort({ createdAt: -1 });
      return reply.code(200).send(docs);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch documents.", details: err.message });
    }
  });
  fastify2.post("/create", async (request, reply) => {
    try {
      const body = request.body;
      const title = String(body.title || "").trim();
      if (!title) {
        return reply.code(400).send({ error: "Document title is required." });
      }
      const workspaceId = String(
        body.workspaceId || request.user?.workspaceId || defaultWorkspaceId4
      ).trim();
      const doc = await WorkspaceDocument.create({
        workspaceId,
        title,
        type: body.type || "doc",
        ownerEmail: request.user?.email || "",
        ownerName: request.user?.name || "",
        sizeBytes: body.sizeBytes || 0,
        url: body.url || ""
      });
      return reply.code(201).send(doc);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create document.", details: err.message });
    }
  });
  fastify2.patch("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const doc = await WorkspaceDocument.findByIdAndUpdate(
        id,
        { ...body, updatedAt: /* @__PURE__ */ new Date() },
        { new: true }
      );
      if (!doc) {
        return reply.code(404).send({ error: "Document not found." });
      }
      return reply.code(200).send(doc);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update document.", details: err.message });
    }
  });
  fastify2.delete("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const doc = await WorkspaceDocument.findByIdAndDelete(id);
      if (!doc) {
        return reply.code(404).send({ error: "Document not found." });
      }
      return reply.code(200).send({ message: "Document deleted." });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete document.", details: err.message });
    }
  });
}

// backend-fastify/src/services/webrtc.ts
var import_ws = require("ws");
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"));
var import_mongoose15 = require("mongoose");
var import_crypto = require("crypto");
var JWT_SECRET = process.env.JWT_SECRET || "nexus-jwt-secret-key";
var rooms = /* @__PURE__ */ new Map();
function normalizeJoinCode(code) {
  const trimmed = String(code || "").trim().toUpperCase();
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 9) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  return trimmed;
}
async function resolveCanonicalMeetingId(idOrCode) {
  const value = String(idOrCode || "").trim();
  if (!value) return null;
  if (import_mongoose15.Types.ObjectId.isValid(value)) {
    const meeting2 = await Meeting.findById(value).select("_id").lean();
    if (meeting2?._id) return meeting2._id.toString();
  }
  const meeting = await Meeting.findOne({ joinCode: normalizeJoinCode(value) }).sort({ createdAt: 1, _id: 1 }).select("_id").lean();
  return meeting?._id?.toString() || null;
}
async function resolveCanonicalMeetingRoom(idOrCode, publicCode) {
  const normalizedPublicCode = publicCode ? normalizeJoinCode(publicCode) : "";
  if (normalizedPublicCode) {
    const meeting = await Meeting.findOne({ joinCode: normalizedPublicCode }).sort({ createdAt: 1, _id: 1 }).select("_id").lean();
    if (meeting?._id) return meeting._id.toString();
  }
  const value = String(idOrCode || "").trim();
  if (!value) return null;
  if (import_mongoose15.Types.ObjectId.isValid(value)) {
    const meeting = await Meeting.findById(value).select("_id joinCode").lean();
    if (!meeting?._id) return null;
    if (meeting.joinCode) {
      const canonicalByCode = await resolveCanonicalMeetingId(meeting.joinCode);
      if (canonicalByCode) return canonicalByCode;
    }
    return meeting._id.toString();
  }
  return resolveCanonicalMeetingId(value);
}
function send(ws, payload) {
  if (ws.readyState === import_ws.WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}
function broadcastToRoom(meetingId, excludePeerId, payload) {
  const room = rooms.get(meetingId);
  if (!room) return;
  const raw = JSON.stringify(payload);
  for (const [pid, peer] of room.entries()) {
    if (pid !== excludePeerId && peer.socket.readyState === import_ws.WebSocket.OPEN) {
      peer.socket.send(raw);
    }
  }
}
function broadcastRoomPeers(meetingId) {
  const room = rooms.get(meetingId);
  if (!room) return;
  const peerList = Array.from(room.entries()).map(([pid, p]) => ({
    peerId: pid,
    userId: p.userId,
    name: p.name,
    avatarUrl: p.avatarUrl
  }));
  for (const peer of room.values()) {
    send(peer.socket, { type: "room-peers", peers: peerList });
  }
}
function handleWebRtcSignalling(ws) {
  let peerId = null;
  let meetingId = null;
  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const { type, data = {} } = msg;
    if (type === "join") {
      const { token, meetingId: mid, roomId, joinCode } = data;
      const resolvedMeetingId = mid || roomId || joinCode;
      if (!token || !resolvedMeetingId) {
        return send(ws, { type: "error", message: "token and meetingId required" });
      }
      let decoded;
      try {
        decoded = import_jsonwebtoken3.default.verify(token, JWT_SECRET);
      } catch {
        return send(ws, { type: "error", message: "Invalid token" });
      }
      const user = await User.findById(decoded.userId).catch(() => null);
      if (!user) return send(ws, { type: "error", message: "User not found" });
      const canonicalMeetingId = await resolveCanonicalMeetingRoom(resolvedMeetingId, joinCode || roomId);
      if (!canonicalMeetingId) {
        return send(ws, { type: "error", message: "Meeting not found" });
      }
      const userId = user._id.toString();
      peerId = (0, import_crypto.randomUUID)();
      meetingId = canonicalMeetingId;
      console.log(`[Signaling] User ${user.name} (${userId}) joining room: ${meetingId} as peer ${peerId}`);
      if (!rooms.has(meetingId)) rooms.set(meetingId, /* @__PURE__ */ new Map());
      const room = rooms.get(meetingId);
      room.set(peerId, {
        socket: ws,
        userId,
        name: user.name,
        avatarUrl: user.avatarUrl
      });
      try {
        await Participant.findOneAndUpdate(
          { meetingId: new import_mongoose15.Types.ObjectId(meetingId), userId: new import_mongoose15.Types.ObjectId(userId) },
          { joinedAt: /* @__PURE__ */ new Date(), $unset: { leftAt: "" } },
          { upsert: true }
        );
      } catch (err) {
        console.error("[Signaling] Failed to update participant join in DB:", err);
      }
      const existingPeers = Array.from(room.entries()).filter(([pid]) => pid !== peerId).map(([pid, p]) => ({ peerId: pid, userId: p.userId, name: p.name, avatarUrl: p.avatarUrl }));
      send(ws, { type: "joined", peerId, userId, existingPeers });
      broadcastToRoom(meetingId, peerId, {
        type: "peer-joined",
        peerId,
        userId,
        name: user.name,
        avatarUrl: user.avatarUrl
      });
      broadcastRoomPeers(meetingId);
      return;
    }
    if (!peerId || !meetingId) {
      return send(ws, { type: "error", message: "Not joined. Send join first." });
    }
    if (type === "offer") {
      const { targetPeerId, sdp } = data;
      const room = rooms.get(meetingId);
      const target = room?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "offer", fromPeerId: peerId, sdp });
      }
      return;
    }
    if (type === "answer") {
      const { targetPeerId, sdp } = data;
      const room = rooms.get(meetingId);
      const target = room?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "answer", fromPeerId: peerId, sdp });
      }
      return;
    }
    if (type === "ice-candidate") {
      const { targetPeerId, candidate } = data;
      const room = rooms.get(meetingId);
      const target = room?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "ice-candidate", fromPeerId: peerId, candidate });
      }
      return;
    }
    if (type === "media-state") {
      const { audioEnabled, videoEnabled } = data;
      broadcastToRoom(meetingId, peerId, {
        type: "peer-media-state",
        peerId,
        audioEnabled,
        videoEnabled
      });
      return;
    }
    if (type === "leave") {
      await cleanupPeer(meetingId, peerId);
      peerId = null;
      meetingId = null;
      return;
    }
  });
  ws.on("close", async () => {
    if (meetingId && peerId) {
      await cleanupPeer(meetingId, peerId);
    }
  });
  ws.on("error", () => {
    if (meetingId && peerId) {
      cleanupPeer(meetingId, peerId).catch(() => {
      });
    }
  });
}
async function cleanupPeer(roomId, pid) {
  const room = rooms.get(roomId);
  if (!room) return;
  const peer = room.get(pid);
  room.delete(pid);
  if (room.size === 0) rooms.delete(roomId);
  broadcastToRoom(roomId, pid, { type: "peer-left", peerId: pid, userId: peer?.userId });
  broadcastRoomPeers(roomId);
  try {
    if (!peer?.userId) return;
    const sameUserStillConnected = Array.from(room.values()).some((activePeer) => activePeer.userId === peer.userId);
    if (sameUserStillConnected) return;
    await Participant.findOneAndUpdate(
      { meetingId: new import_mongoose15.Types.ObjectId(roomId), userId: new import_mongoose15.Types.ObjectId(peer.userId) },
      { leftAt: /* @__PURE__ */ new Date() }
    );
  } catch (err) {
    console.error("[Signaling] Failed to update participant cleanup in DB:", err);
  }
}

// backend-fastify/src/utils/seedDefaultUser.ts
var import_bcrypt4 = __toESM(require("bcrypt"));
var DEFAULT_EMAIL = "admin@antigraviity.com";
var DEFAULT_PASSWORD = "password123";
async function ensureDefaultUser() {
  const existing = await User.findOne({ email: DEFAULT_EMAIL });
  if (existing) {
    return;
  }
  const salt = await import_bcrypt4.default.genSalt(12);
  const passwordHash = await import_bcrypt4.default.hash(DEFAULT_PASSWORD, salt);
  await User.create({
    name: "Nexus Administrator",
    email: DEFAULT_EMAIL,
    passwordHash,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent("Nexus Administrator")}`,
    mfaEnabled: false,
    role: "company-admin",
    workspaceId: "antigraviity-hq"
  });
}

// backend-fastify/src/index.ts
import_dotenv2.default.config({ path: import_path2.default.join(__dirname, "../.env") });
import_dotenv2.default.config();
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
var MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nexus-zoom";
var ENABLE_SOCKET_FILE_LOGS = process.env.ENABLE_SOCKET_FILE_LOGS === "true";
var isRenderHost = !!(process.env.RENDER || process.env.RENDER_SERVICE_NAME);
var isProduction = process.env.NODE_ENV === "production" || isRenderHost;
var isDefaultLocalUri = !process.env.MONGO_URI || MONGO_URI.includes("127.0.0.1");
var server = (0, import_fastify.default)({
  logger: isProduction ? { level: "info" } : {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z"
      }
    }
  }
});
async function connectDatabase() {
  if (isRenderHost && isDefaultLocalUri) {
    const msg = "MONGO_URI is not set on Render. Add your MongoDB Atlas connection string in Environment variables.";
    server.log.error(msg);
    throw new Error(msg);
  }
  const uriCheck = validateMongoUri(MONGO_URI);
  if (uriCheck) {
    server.log.error(uriCheck);
    throw new Error(uriCheck);
  }
  const maxAttempts = isProduction ? 5 : 1;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connectMongo(MONGO_URI, server.log);
      await ensureDefaultUser();
      server.log.info("Default admin account is ready.");
      return;
    } catch (err) {
      lastErr = err;
      server.log.warn(`MongoDB connect attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 3e3 * attempt));
      }
    }
  }
  server.log.error(
    "Server starting WITHOUT MongoDB. Login/sign-up disabled until MONGO_URI is fixed. Atlas: reset DB password (no @), allow 0.0.0.0/0, update Render MONGO_URI."
  );
  if (lastErr) {
    server.log.error(lastErr.message);
  }
}
async function bootstrap() {
  await server.register(import_cors.default, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  server.addHook("onRequest", async (request, reply) => {
    if (!ENABLE_SOCKET_FILE_LOGS) return;
    try {
      const logFile = import_path2.default.join(__dirname, "../../socket_debug.log");
      import_fs2.default.appendFileSync(logFile, `[${(/* @__PURE__ */ new Date()).toISOString()}] [onRequest Hook] URL: "${request.url}", Method: "${request.method}", IP: "${request.ip}", Headers: ${JSON.stringify(request.headers)}
`);
    } catch (e) {
      console.error("Failed to write to socket_debug.log inside onRequest hook:", e);
    }
  });
  server.addHook("onResponse", async (request, reply) => {
    if (!ENABLE_SOCKET_FILE_LOGS) return;
    try {
      const logFile = import_path2.default.join(__dirname, "../../socket_debug.log");
      const entry = `[${(/* @__PURE__ */ new Date()).toISOString()}] [onResponse Hook] URL: "${request.url}", Method: "${request.method}", Status: "${reply.statusCode}", ResponseTimeMs: "${reply.getResponseTime ? reply.getResponseTime() : "n/a"}"
`;
      import_fs2.default.appendFileSync(logFile, entry);
    } catch (e) {
      console.error("Failed to write to socket_debug.log inside onResponse hook:", e);
    }
  });
  await server.register(import_websocket.default);
  await server.register(authRoutes, { prefix: "/api/auth" });
  await server.register(meetingRoutes, { prefix: "/api/meetings" });
  await server.register(mailRoutes, { prefix: "/api/mail" });
  await server.register(channelRoutes, { prefix: "/api/channels" });
  await server.register(kuralRoutes, { prefix: "/api/chat" });
  await server.register(memberRoutes, { prefix: "/api/members" });
  await server.register(taskRoutes, { prefix: "/api/tasks" });
  await server.register(docsRoutes, { prefix: "/api/docs" });
  server.get("/ws/webrtc", { websocket: true }, (connection, req) => {
    server.log.info("New secure WebRTC client socket handshake initiated.");
    const socket = connection?.socket || connection;
    if (!socket?.on) {
      server.log.error("WebRTC websocket upgrade did not provide a valid socket.");
      return;
    }
    handleWebRtcSignalling(socket);
  });
  server.get("/ws/mail", { websocket: true }, (connection, req) => {
    server.log.info("New secure Mail Socket connection initiated.");
    const socket = connection?.socket || connection;
    if (!socket?.on) {
      server.log.error("Mail websocket upgrade did not provide a valid socket.");
      return;
    }
    handleMailSocket(socket, req);
  });
  server.get("/health", async () => {
    const connected = isMongoConnected();
    return {
      status: connected ? "healthy" : "degraded",
      database: connected ? "connected" : "disconnected",
      mongoConfigured: !isDefaultLocalUri,
      mongoError: connected ? void 0 : getLastMongoError(),
      hint: connected ? void 0 : isDefaultLocalUri ? "Add MONGO_URI in Render Environment (MongoDB Atlas connection string)." : "Atlas: allow 0.0.0.0/0 in Network Access; reset DB password; encode @ as %40 in MONGO_URI."
    };
  });
  await connectDatabase();
  try {
    await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`
======================================================`);
    console.log(`\u{1F680} NEXUS ZOOM MEETINGS BACKEND SERVER RUNNING LIVE!`);
    console.log(`\u{1F517} REST API Root : http://localhost:${PORT}/api`);
    console.log(`\u{1F50C} WebRTC Socket : ws://localhost:${PORT}/ws/webrtc`);
    console.log(`\u{1F3E5} Health Status : http://localhost:${PORT}/health`);
    console.log(`======================================================
`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
bootstrap();
//# sourceMappingURL=index.js.map
