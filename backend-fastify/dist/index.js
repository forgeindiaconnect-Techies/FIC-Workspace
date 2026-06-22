"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/models/Transcript.ts
var import_mongoose10, TranscriptSchema, Transcript;
var init_Transcript = __esm({
  "src/models/Transcript.ts"() {
    "use strict";
    import_mongoose10 = require("mongoose");
    TranscriptSchema = new import_mongoose10.Schema({
      meetingId: { type: String, required: true, index: true },
      userId: { type: String, required: true },
      speakerName: { type: String, required: true },
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now }
    });
    Transcript = (0, import_mongoose10.model)("Transcript", TranscriptSchema);
  }
});

// src/services/transcription.ts
var transcription_exports = {};
__export(transcription_exports, {
  transcribeChunk: () => transcribeChunk
});
async function transcribeChunk(meetingId, userId, speakerName, filePath) {
  if (!process.env.GROQ_API_KEY || !groq) {
    console.warn("[Transcription] GROQ_API_KEY is not set or groq client is not initialized. Skipping transcription.");
    return null;
  }
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: import_fs.default.createReadStream(filePath),
      model: "whisper-large-v3",
      prompt: "Meeting conversation in Tamil and English. Transcribe accurately.",
      temperature: 0,
      response_format: "verbose_json"
    });
    const text = transcription.text.trim();
    const lowerText = text.toLowerCase();
    const cleanText = lowerText.replace(/[^a-z0-9\s]/g, "").trim();
    const segments = transcription.segments || [];
    let avgNoSpeechProb = 0;
    if (segments.length > 0) {
      avgNoSpeechProb = segments.reduce((acc, seg) => acc + (seg.no_speech_prob || 0), 0) / segments.length;
    }
    if (avgNoSpeechProb > 0.6) {
      console.log(`[Transcription] Ignored silent chunk (no_speech_prob: ${avgNoSpeechProb.toFixed(2)})`);
      return null;
    }
    const isHallucination = cleanText.includes("meeting conversation in tamil and english transcribe accurately") || cleanText.includes("meeting conversation transcribe accurately") || cleanText.includes("transcribe accurately") || cleanText.includes("tanscribe accurately") || cleanText.includes("we go on") || cleanText.includes("were going to go on") || cleanText.includes("you see were getting some different individuals") || cleanText === "thank you" || cleanText === "thanks" || cleanText === "subscribe" || cleanText === "terima kasih";
    if (text && !isHallucination && cleanText.length > 0) {
      await Transcript.create({
        meetingId,
        userId,
        speakerName,
        text,
        timestamp: /* @__PURE__ */ new Date()
      });
      return text;
    }
    return null;
  } catch (error) {
    console.error("[Transcription] Failed to transcribe chunk:", error.message);
    return null;
  }
}
var import_fs, import_groq_sdk, groq;
var init_transcription = __esm({
  "src/services/transcription.ts"() {
    "use strict";
    import_fs = __toESM(require("fs"));
    import_groq_sdk = __toESM(require("groq-sdk"));
    init_Transcript();
    groq = null;
    if (process.env.GROQ_API_KEY) {
      groq = new import_groq_sdk.default({ apiKey: process.env.GROQ_API_KEY });
    }
  }
});

// src/services/mailSockets.ts
var mailSockets_exports = {};
__export(mailSockets_exports, {
  activeMailSockets: () => activeMailSockets,
  handleMailSocket: () => handleMailSocket
});
function handleMailSocket(socket, req) {
  const logFile = import_path2.default.join(__dirname, "../../socket_debug.log");
  const log = (msg) => {
    try {
      import_fs3.default.appendFileSync(logFile, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
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
var import_fs3, import_path2, activeMailSockets;
var init_mailSockets = __esm({
  "src/services/mailSockets.ts"() {
    "use strict";
    import_fs3 = __toESM(require("fs"));
    import_path2 = __toESM(require("path"));
    activeMailSockets = /* @__PURE__ */ new Map();
  }
});

// src/models/MutedUser.ts
var MutedUser_exports = {};
__export(MutedUser_exports, {
  MutedUser: () => MutedUser
});
var import_mongoose19, MutedUserSchema, MutedUser;
var init_MutedUser = __esm({
  "src/models/MutedUser.ts"() {
    "use strict";
    import_mongoose19 = require("mongoose");
    MutedUserSchema = new import_mongoose19.Schema({
      userId: { type: String, required: true },
      userEmail: { type: String, required: true },
      mutedUserEmail: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    });
    MutedUserSchema.index({ userEmail: 1, mutedUserEmail: 1 }, { unique: true });
    MutedUser = (0, import_mongoose19.model)("MutedUser", MutedUserSchema);
  }
});

// src/index.ts
var import_fastify = __toESM(require("fastify"));
var import_cors = __toESM(require("@fastify/cors"));
var import_websocket = __toESM(require("@fastify/websocket"));
var import_dotenv2 = __toESM(require("dotenv"));
var import_fs5 = __toESM(require("fs"));
var import_path4 = __toESM(require("path"));
var import_multipart = __toESM(require("@fastify/multipart"));

// src/routes/auth.ts
var import_bcrypt = __toESM(require("bcrypt"));
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));

// src/models/User.ts
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

// src/models/Tenant.ts
var import_mongoose2 = require("mongoose");
var TenantSchema = new import_mongoose2.Schema({
  name: { type: String, required: true },
  organisationName: { type: String, required: true, unique: true },
  workspaceId: { type: String, required: true, unique: true },
  domain: { type: String, required: true, unique: true },
  adminEmail: { type: String, required: true, unique: true, index: true },
  password: { type: String },
  paymentStatus: { type: String, default: "active" },
  subscriptionTier: { type: String, default: "starter" },
  maxUsers: { type: Number, default: 20 },
  subscriptionExpiryDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
}, { collection: "tenants" });
var Tenant = (0, import_mongoose2.model)("Tenant", TenantSchema);

// src/models/RefreshToken.ts
var import_mongoose3 = require("mongoose");
var RefreshTokenSchema = new import_mongoose3.Schema({
  userId: { type: import_mongoose3.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  // Mongoose auto TTL cleanup
  createdAt: { type: Date, default: Date.now }
});
var RefreshToken = (0, import_mongoose3.model)("RefreshToken", RefreshTokenSchema);

// src/middlewares/auth.ts
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
    if (decoded.role === "demo" && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) {
      return reply.code(403).send({ error: "Demo accounts have read-only access." });
    }
  } catch (err) {
    console.error("JWT Verification failed! Error:", err.message);
    return reply.code(401).send({ error: "Unauthorized: Session authentication failed." });
  }
}

// src/utils/redis.ts
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

// src/utils/mfa.ts
var import_speakeasy = __toESM(require("speakeasy"));
var import_qrcode = __toESM(require("qrcode"));
async function generateMfaSecret(email) {
  const secret = import_speakeasy.default.generateSecret({
    name: `ForgeIndiaConnect:${email}`,
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

// src/utils/mongo.ts
var import_mongoose4 = __toESM(require("mongoose"));
var lastConnectError = null;
function validateMongoUri(uri) {
  if (!uri || !uri.startsWith("mongodb")) {
    return "MONGO_URI must start with mongodb:// or mongodb+srv://";
  }
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const atCount = (withoutScheme.match(/@/g) || []).length;
  if (atCount > 1) {
    return 'MONGO_URI looks malformed: password contains "@"  encode it as %40 (example: Dhanushcj@123  Dhanushcj%40123)';
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
      message = "MongoDB authentication failed  wrong username/password in MONGO_URI. In Atlas: Database Access  edit user  reset password (avoid @ in password), then update Render MONGO_URI.";
    }
    lastConnectError = message;
    log.error("Mongoose failed connecting to MongoDB: " + message);
    throw new Error(message);
  }
}
function isMongoConnected() {
  return import_mongoose4.default.connection.readyState === 1;
}

// src/routes/auth.ts
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
      { expiresIn: "30d" }
    );
    const refreshTokenString = import_jsonwebtoken2.default.sign(
      { userId: user._id },
      getJwtRefreshSecret(),
      { expiresIn: "180d" }
    );
    const expiresAt = /* @__PURE__ */ new Date();
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
  fastify2.post("/signup-subscription", async (request, reply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({ error: "Database is not connected." });
      }
      const { name, organisationName, email, password, subscriptionTier } = request.body;
      if (!name || !organisationName || !email || !password) {
        return reply.code(400).send({ error: "All fields are required." });
      }
      const tier = subscriptionTier || "starter";
      let maxUsers = 20;
      if (tier === "pro") maxUsers = 40;
      if (tier === "enterprise") maxUsers = 99999;
      if (password.length < 6) {
        return reply.code(400).send({ error: "Password must be at least 6 characters." });
      }
      const normEmail = email.toLowerCase().trim();
      const existingUser = await User.findOne({ email: normEmail });
      const existingTenant = await Tenant.findOne({ adminEmail: normEmail });
      if (existingUser || existingTenant) {
        return reply.code(409).send({ error: "An account with this email already exists." });
      }
      const duplicateOrg = await Tenant.findOne({ organisationName });
      if (duplicateOrg) {
        return reply.code(409).send({ error: "Organisation Name already exists." });
      }
      const generatedDomain = `${organisationName.toLowerCase().replace(/[^a-z0-9]/gi, "")}.nexus.com`;
      const salt = await import_bcrypt.default.genSalt(12);
      const passwordHash = await import_bcrypt.default.hash(password, salt);
      const workspaceId = `ws-${generatedDomain.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
      const expiryDate = /* @__PURE__ */ new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      const tenant = await Tenant.create({
        name,
        organisationName,
        workspaceId,
        domain: generatedDomain,
        adminEmail: normEmail,
        password: passwordHash,
        paymentStatus: "active",
        subscriptionTier: tier,
        maxUsers,
        subscriptionExpiryDate: expiryDate
      });
      const user = await User.create({
        name: name.trim(),
        email: normEmail,
        passwordHash,
        workspaceId,
        role: "company-admin",
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        mfaEnabled: false
      });
      const tokenBundle = await issueTokens(user);
      return reply.code(201).send(tokenBundle);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create subscription.", details: err.message });
    }
  });
  fastify2.post("/demo", async (request, reply) => {
    try {
      if (!isMongoConnected()) {
        return reply.code(503).send({ error: "Database is not connected." });
      }
      const email = "demo@nexus.app";
      const workspaceId = "demo-workspace";
      let tenant = await Tenant.findOne({ workspaceId });
      if (!tenant) {
        tenant = await Tenant.create({
          name: "Demo Workspace",
          organisationName: "Forge India Connect Demo",
          workspaceId,
          domain: "demo.nexus.app",
          adminEmail: email,
          password: await import_bcrypt.default.hash("demo_password_123!@#", 10),
          paymentStatus: "active",
          subscriptionTier: "enterprise",
          maxUsers: 99999,
          subscriptionExpiryDate: new Date(Date.now() + 1e3 * 60 * 60 * 24 * 365 * 10)
          // 10 years
        });
      }
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: "Demo User",
          email,
          passwordHash: await import_bcrypt.default.hash("demo_password_123!@#", 10),
          workspaceId,
          role: "demo",
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=DemoUser`,
          mfaEnabled: false
        });
      } else if (user.role !== "demo") {
        user.role = "demo";
        await user.save();
      }
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create or login to demo account.", details: err.message });
    }
  });
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
  fastify2.put("/update-profile", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { avatarUrl } = request.body;
      if (!avatarUrl) {
        return reply.code(400).send({ error: "Avatar URL is required." });
      }
      const user = await User.findById(request.user.id);
      if (!user) return reply.code(404).send({ error: "User not found." });
      user.avatarUrl = avatarUrl;
      await user.save();
      const tokenBundle = await issueTokens(user);
      return reply.code(200).send(tokenBundle);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update profile.", details: err.message });
    }
  });
  fastify2.put("/change-password", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body;
      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ error: "Current password and new password are required." });
      }
      if (newPassword.length < 6) {
        return reply.code(400).send({ error: "New password must be at least 6 characters." });
      }
      const user = await User.findById(request.user.id);
      if (!user) return reply.code(404).send({ error: "User not found." });
      const activeHash = user.passwordHash || user.password;
      if (!activeHash) {
        return reply.code(400).send({ error: "No password set for this account (e.g. OAuth only)." });
      }
      const isValid = await import_bcrypt.default.compare(currentPassword, activeHash);
      if (!isValid) {
        return reply.code(401).send({ error: "Invalid current password." });
      }
      const salt = await import_bcrypt.default.genSalt(12);
      const passwordHash = await import_bcrypt.default.hash(newPassword, salt);
      user.passwordHash = passwordHash;
      if (user.password) user.password = void 0;
      await user.save();
      return reply.code(200).send({ message: "Password updated successfully." });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to change password.", details: err.message });
    }
  });
}

// src/routes/meetings.ts
var import_bcrypt3 = __toESM(require("bcrypt"));
var import_mongoose11 = require("mongoose");

// src/models/Meeting.ts
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
  aiEnabled: { type: Boolean, default: false },
  aiSummary: { type: String },
  summarySent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
var Meeting = (0, import_mongoose5.model)("Meeting", MeetingSchema);

// src/models/Participant.ts
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

// src/models/Recording.ts
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

// src/models/Mail.ts
var import_mongoose8 = __toESM(require("mongoose"));
var mailSchema = new import_mongoose8.default.Schema({
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
  label: { type: String, default: null },
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
var Mail = import_mongoose8.default.model("Mail", mailSchema);

// src/models/Room.ts
var import_mongoose9 = require("mongoose");
var RoomSchema = new import_mongoose9.Schema({
  workspaceId: { type: String, required: true },
  creatorId: { type: import_mongoose9.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  tag: { type: String, required: true },
  color: { type: String, default: "#7c3aed" },
  createdAt: { type: Date, default: Date.now }
});
var Room = (0, import_mongoose9.model)("Room", RoomSchema);

// src/routes/meetings.ts
init_Transcript();

// src/services/aiBot.ts
var import_ws = __toESM(require("ws"));
var import_fs2 = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"));
var import_bcrypt2 = __toESM(require("bcrypt"));
init_transcription();

// src/services/summarizer.ts
var import_groq_sdk2 = __toESM(require("groq-sdk"));
init_Transcript();
var groq2 = null;
if (process.env.GROQ_API_KEY) {
  groq2 = new import_groq_sdk2.default({ apiKey: process.env.GROQ_API_KEY });
}
async function dispatchSummaryMail(meeting, summaryHtml) {
  try {
    const participantDocs = await Participant.find({ meetingId: meeting._id }).distinct("userId");
    const allUserIds = [.../* @__PURE__ */ new Set([...participantDocs.map((id) => id.toString()), meeting.hostId?.toString()])].filter(Boolean);
    const users = await User.find({
      _id: { $in: allUserIds },
      email: { $ne: "ai-assistant@nexus.app" }
      // exclude the bot itself
    });
    if (users.length === 0) {
      console.warn("[Summarizer] No human participants found  skipping mail dispatch.");
      return;
    }
    const recipientEmails = users.map((u) => u.email);
    const mailDoc = {
      workspaceId: "antigraviity-hq",
      senderName: "Forge India Connect AI",
      senderEmail: "ai-assistant@nexus.app",
      recipientEmails,
      subject: ` Meeting Summary: ${meeting.title}`,
      body: summaryHtml,
      isRead: false,
      isStarred: false,
      sentAt: /* @__PURE__ */ new Date()
    };
    await Mail.create({ ...mailDoc, ownerEmail: "ai-assistant@nexus.app", folder: "sent" });
    for (const email of recipientEmails) {
      await Mail.create({ ...mailDoc, ownerEmail: email, folder: "inbox" });
    }
    console.log(`[Summarizer]  Summary mail dispatched to ${recipientEmails.length} participant(s): ${recipientEmails.join(", ")}`);
  } catch (err) {
    console.error("[Summarizer] Mail dispatch failed:", err.message);
  }
}
async function summarizeMeeting(meetingId) {
  console.log(`[Summarizer] Starting summarization for meeting ${meetingId}`);
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    console.warn("[Summarizer] Meeting not found:", meetingId);
    return null;
  }
  if (meeting.aiSummary) {
    console.log("[Summarizer] Summary already exists, skipping.");
    return meeting.aiSummary;
  }
  if (meeting.summarySent) {
    console.log("[Summarizer] Summary email already sent for this meeting, skipping.");
    return meeting.aiSummary || null;
  }
  const lockResult = await Meeting.findOneAndUpdate(
    { _id: meetingId, summarySent: { $ne: true } },
    { $set: { summarySent: true } },
    { new: true }
  );
  if (!lockResult) {
    console.log("[Summarizer] Another process already claimed this summary, skipping.");
    return null;
  }
  const transcripts = await Transcript.find({ meetingId }).sort({ timestamp: 1 });
  const hasTranscripts = transcripts && transcripts.length > 0;
  let summaryHtml;
  if (!hasTranscripts || !process.env.GROQ_API_KEY || !groq2) {
    console.log(`[Summarizer] No transcripts found (or no API key/client). Sending completion notification.`);
    let duration = 0;
    if (meeting.scheduledAt) {
      duration = Math.max(1, Math.round((Date.now() - new Date(meeting.scheduledAt).getTime()) / 6e4));
    }
    summaryHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px">
  <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:24px;border-radius:8px;margin-bottom:20px">
    <h1 style="color:#fff;margin:0;font-size:22px"> Meeting Completed</h1>
    <p style="color:#bfdbfe;margin:8px 0 0">${meeting.title}</p>
  </div>
  <div style="background:#fff;padding:20px;border-radius:8px;border:1px solid #e2e8f0">
    <h2 style="color:#1e293b;margin-top:0">Meeting Details</h2>
    <ul style="color:#475569;line-height:1.8">
      <li><strong>Title:</strong> ${meeting.title}</li>
      <li><strong>Duration:</strong> ~${duration} minutes</li>
      <li><strong>Date:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</li>
      <li><strong>Status:</strong> Completed</li>
    </ul>
    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin-top:16px;border-radius:4px">
      <p style="margin:0;color:#92400e;font-size:14px">
        <strong>Note:</strong> No audio transcript was captured for this meeting. 
        To receive full AI-generated summaries, ensure your microphone is active and AI Assistant is enabled when the meeting starts.
      </p>
    </div>
  </div>
  <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px">Sent by Forge India Connect AI</p>
</div>`;
  } else {
    const fullText = transcripts.map((t) => `[${t.timestamp.toISOString()}] ${t.speakerName}: ${t.text}`).join("\n");
    console.log(`[Summarizer] Summarizing ${transcripts.length} transcript entries (${fullText.length} chars)...`);
    const prompt = `You are an expert Executive Assistant. Summarize the following meeting transcript.
The transcript may contain a mix of English and Tamil.
Your summary MUST be entirely in English.
Your response MUST be formatted in clean HTML suitable for an email body.
Do NOT use markdown. Use bold tags, lists, and headers (h2, h3).
Include the following sections exactly:
<h2>Executive Summary</h2>
(Brief 2-3 sentences overview)

<h2>Main Topics</h2>
<ul><li>Topic 1</li></ul>

<h2>Key Decisions</h2>
<ul><li>Decision 1</li></ul>

<h2>Action Items</h2>
<ul><li>[Owner Name] Task description (Deadline if any)</li></ul>

<h2>Pending Topics & Follow-ups</h2>
<ul><li>Follow-up 1</li></ul>

Here is the meeting transcript:
${fullText}`;
    try {
      const chatCompletion = await groq2.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 2e3
      });
      const rawSummary = chatCompletion.choices[0]?.message?.content || "";
      let duration = meeting.durationMinutes || 60;
      if (transcripts && transcripts.length > 0) {
        const firstTs = new Date(transcripts[0].timestamp).getTime();
        const lastTs = new Date(transcripts[transcripts.length - 1].timestamp).getTime();
        duration = Math.max(1, Math.round((lastTs - firstTs) / 6e4));
      } else if (meeting.scheduledAt) {
        duration = Math.max(1, Math.round((Date.now() - new Date(meeting.scheduledAt).getTime()) / 6e4));
      }
      const uniqueSpeakers = new Set(transcripts.map((t) => t.speakerName)).size;
      summaryHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px">
  <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:24px;border-radius:8px;margin-bottom:20px">
    <h1 style="color:#fff;margin:0;font-size:22px">Meeting Summary</h1>
    <p style="color:#bfdbfe;margin:8px 0 0">${meeting.title}</p>
  </div>
  
  <div style="background:#fff;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:20px">
    <h2 style="color:#1e293b;margin-top:0;font-size:16px;margin-bottom:12px">Meeting Details</h2>
    <ul style="color:#475569;line-height:1.8;margin:0;padding-left:20px">
      <li><strong>Date:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</li>
      <li><strong>Duration:</strong> ~${duration} minutes</li>
      <li><strong>Speakers:</strong> ${uniqueSpeakers}</li>
    </ul>
  </div>

  <div style="background:#fff;padding:24px;border-radius:8px;border:1px solid #e2e8f0;color:#1e293b;line-height:1.6">
    ${rawSummary.replace(/<h2>/g, '<h2 style="color:#1e40af;font-size:18px;margin-top:24px;margin-bottom:12px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">').replace(/<h3>/g, '<h3 style="color:#334155;font-size:16px;margin-top:20px;margin-bottom:8px">').replace(/<ul>/g, '<ul style="color:#475569;padding-left:20px;margin-bottom:16px">').replace(/<li>/g, '<li style="margin-bottom:8px">')}
  </div>
  
  <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px">Sent by Forge India Connect AI</p>
</div>`;
      console.log(`[Summarizer] AI summary generated and formatted.`);
    } catch (err) {
      console.error("[Summarizer] Groq API failed:", err.message);
      return null;
    }
  }
  if (summaryHtml) {
    await Meeting.findByIdAndUpdate(meetingId, { aiSummary: summaryHtml });
    await dispatchSummaryMail(meeting, summaryHtml);
  }
  return summaryHtml;
}

// src/services/aiBot.ts
var JWT_SECRET = process.env.JWT_SECRET || "nexus-jwt-secret-key";
var AI_BOT_EMAIL = "ai-assistant@nexus.app";
var AI_BOT_NAME = "Forge India Connect AI";
var activeBots = /* @__PURE__ */ new Map();
async function mintAIBotToken() {
  try {
    let aiUser = await User.findOne({ email: AI_BOT_EMAIL });
    if (!aiUser) {
      const passwordHash = await import_bcrypt2.default.hash("AI_SECURE_PASSWORD_123!@#", 12);
      aiUser = await User.create({
        name: AI_BOT_NAME,
        email: AI_BOT_EMAIL,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=forgeai`,
        mfaEnabled: false,
        role: "company-admin",
        workspaceId: "antigraviity-hq"
      });
    } else if (aiUser.name !== AI_BOT_NAME) {
      aiUser.name = AI_BOT_NAME;
      aiUser.avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=forgeai`;
      await aiUser.save();
      console.log(`[AIBot] Updated bot name to '${AI_BOT_NAME}' in database.`);
    }
    const token = import_jsonwebtoken3.default.sign(
      { userId: aiUser._id, email: aiUser.email, name: aiUser.name, role: "ai-bot", workspaceId: "antigraviity-hq" },
      JWT_SECRET,
      { expiresIn: "6h" }
    );
    return { token, userId: aiUser._id.toString() };
  } catch (err) {
    console.error("[AIBot] Failed to mint bot token:", err.message);
    return null;
  }
}
function toWebSocketBaseUrl(url) {
  return url.replace(/^https:/, "wss:").replace(/^http:/, "ws:").replace(/\/+$/, "");
}
async function launchAIBot(meetingId, joinCode, backendBaseUrl) {
  if (activeBots.has(meetingId)) {
    console.log(`[AIBot] Bot already active for meeting ${meetingId}`);
    return { success: true, message: "AI Assistant already active" };
  }
  console.log(`[AIBot] Launching direct-WS bot for meeting ${meetingId} (code: ${joinCode})`);
  const auth = await mintAIBotToken();
  if (!auth) {
    throw new Error("Cannot launch AI Assistant: bot user/token is unavailable.");
  }
  const renderUrl = process.env.RENDER_EXTERNAL_URL || "";
  const backendWsUrl = process.env.BACKEND_WS_URL || (backendBaseUrl ? toWebSocketBaseUrl(backendBaseUrl) : renderUrl ? toWebSocketBaseUrl(renderUrl) : `ws://localhost:${process.env.PORT || 3001}`);
  const wsUrl = `${backendWsUrl}/ws/webrtc`;
  console.log(`[AIBot] Connecting to signaling server at ${wsUrl}`);
  let ws;
  try {
    ws = new import_ws.default(wsUrl);
  } catch (err) {
    throw new Error(`Failed to create AI Assistant WebSocket: ${err.message}`);
  }
  activeBots.set(meetingId, { ws, meetingId, userId: auth.userId });
  return await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      activeBots.delete(meetingId);
      try {
        ws.close();
      } catch {
      }
      finish(() => reject(new Error("AI Assistant timed out while joining the meeting.")));
    }, 1e4);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };
    ws.on("open", () => {
      console.log(`[AIBot] WS open. Sending join for meeting ${meetingId}...`);
      ws.send(JSON.stringify({
        type: "join",
        data: {
          meetingId,
          token: auth.token
        }
      }));
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        console.log(`[AIBot] Signaling message: ${msg.type}`);
        if (msg.type === "joined") {
          console.log(`[AIBot] Successfully joined room ${meetingId} as peer ${msg.peerId}`);
          Participant.findOneAndUpdate(
            { meetingId, userId: auth.userId },
            { joinedAt: /* @__PURE__ */ new Date(), $unset: { leftAt: "" } },
            { upsert: true }
          ).catch(() => {
          });
          finish(() => resolve({ success: true, message: "AI Assistant joined the meeting" }));
        }
        if (msg.type === "error") {
          console.error(`[AIBot] Signaling error: ${msg.message}`);
          activeBots.delete(meetingId);
          try {
            ws.close();
          } catch {
          }
          finish(() => reject(new Error(msg.message || "AI Assistant failed to join signaling.")));
        }
      } catch {
      }
    });
    ws.on("close", (code) => {
      console.log(`[AIBot] WS closed for meeting ${meetingId}: code=${code}`);
      activeBots.delete(meetingId);
      finish(() => reject(new Error(`AI Assistant WebSocket closed before joining: ${code}`)));
    });
    ws.on("error", (err) => {
      console.error(`[AIBot] WS error for meeting ${meetingId}:`, err.message);
      activeBots.delete(meetingId);
      finish(() => reject(new Error(err.message)));
    });
  });
}
async function stopAIBot(meetingId) {
  const bot = activeBots.get(meetingId);
  if (bot) {
    console.log(`[AIBot] Stopping bot for meeting ${meetingId}`);
    try {
      bot.ws.send(JSON.stringify({ type: "leave", data: {} }));
      bot.ws.close();
    } catch (e) {
    }
    activeBots.delete(meetingId);
  }
  console.log(`[AIBot] Triggering summarization for ${meetingId}`);
  await summarizeMeeting(meetingId);
}
function handleAudioSocket(ws) {
  let currentMeetingId = "";
  let currentUserId = "";
  let currentSpeakerName = "";
  ws.on("message", async (message, isBinary) => {
    if (!isBinary) {
      try {
        const meta = JSON.parse(message.toString());
        if (meta.type === "metadata") {
          currentMeetingId = meta.meetingId;
          currentUserId = meta.userId;
          currentSpeakerName = meta.speakerName;
          console.log(`[AudioSocket] Registered metadata: meeting=${currentMeetingId}, speaker=${currentSpeakerName}`);
        }
      } catch (e) {
      }
    } else {
      if (!currentMeetingId || !currentUserId) {
        console.warn("[AudioSocket] Received audio chunk before metadata, ignoring.");
        return;
      }
      const tmpDir = import_os.default.tmpdir();
      const fileName = `chunk_${currentMeetingId}_${currentUserId}_${Date.now()}.webm`;
      const filePath = import_path.default.join(tmpDir, fileName);
      try {
        import_fs2.default.writeFileSync(filePath, message);
        const text = await transcribeChunk(currentMeetingId, currentUserId, currentSpeakerName, filePath);
        if (text) {
          console.log(`[AudioSocket] Transcribed: "${text.slice(0, 60)}..."`);
        }
      } catch (e) {
        console.error("[AudioSocket] Error processing chunk:", e.message);
      } finally {
        try {
          import_fs2.default.unlinkSync(filePath);
        } catch {
        }
      }
    }
  });
  ws.on("close", () => {
    console.log(`[AudioSocket] Connection closed for meeting ${currentMeetingId}`);
  });
  ws.on("error", (err) => {
    console.error("[AudioSocket] Error:", err.message);
  });
}

// src/routes/meetings.ts
async function meetingRoutes(fastify2) {
  async function generate9DigitJoinCode(preferredCode) {
    const normalizedPreferredCode = preferredCode ? normalizeJoinCode(preferredCode) : "";
    if (normalizedPreferredCode) {
      const existing = await Meeting.findOne({ joinCode: normalizedPreferredCode });
      if (!existing) {
        return normalizedPreferredCode;
      }
    }
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
  function normalizeJoinCode(code) {
    const trimmed = String(code || "").trim().toUpperCase();
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length === 9) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return trimmed;
  }
  async function resolveMeetingIdentifier(idOrCode) {
    const value = String(idOrCode || "").trim();
    if (import_mongoose11.Types.ObjectId.isValid(value)) {
      return Meeting.findById(value);
    }
    return Meeting.findOne({ joinCode: normalizeJoinCode(value) });
  }
  fastify2.post("/", { preHandler: authenticate }, async (request, reply) => {
    try {
      const {
        title,
        passcode,
        password,
        roomId,
        joinCode: requestedJoinCode,
        durationMinutes,
        duration,
        scheduledAt,
        startTime,
        recordingEnabled,
        aiEnabled,
        inviteEmails
      } = request.body;
      if (!title) {
        return reply.code(400).send({ error: "Meeting title is required." });
      }
      const joinCode = await generate9DigitJoinCode(requestedJoinCode || roomId);
      const plainPasscode = passcode ?? password;
      let passcodeHash;
      if (plainPasscode) {
        passcodeHash = await import_bcrypt3.default.hash(String(plainPasscode), 10);
      }
      const meeting = await Meeting.create({
        title,
        hostId: new import_mongoose11.Types.ObjectId(request.user.id),
        joinCode,
        passcodeHash,
        scheduledAt: scheduledAt || startTime ? new Date(scheduledAt || startTime) : /* @__PURE__ */ new Date(),
        durationMinutes: durationMinutes || duration || 60,
        recordingEnabled: !!recordingEnabled,
        aiEnabled: !!aiEnabled,
        status: "scheduled",
        participantIds: [new import_mongoose11.Types.ObjectId(request.user.id)]
      });
      await Participant.create({
        meetingId: meeting._id,
        userId: new import_mongoose11.Types.ObjectId(request.user.id),
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
            password: plainPasscode
          }
        })
      }).then((res) => {
        console.log(` [WEBHOOK] Successfully dispatched meeting.created: Status ${res.status}`);
      }).catch((err) => {
        console.error(" [WEBHOOK] dispatch failed:", err.message);
      });
      try {
        const workspaceId = request.user?.workspaceId || "antigraviity-hq";
        const allWorkspaceUsers = await User.find({ workspaceId });
        const { activeMailSockets: activeMailSockets2 } = (init_mailSockets(), __toCommonJS(mailSockets_exports));
        if (activeMailSockets2) {
          const msgStr = JSON.stringify({ type: "meeting-update" });
          allWorkspaceUsers.forEach((u) => {
            if (activeMailSockets2.has(u.email)) {
              activeMailSockets2.get(u.email)?.send(msgStr);
            }
          });
        }
      } catch (e) {
        console.error("Socket broadcast error:", e);
      }
      try {
        const workspaceId = request.user?.workspaceId || "antigraviity-hq";
        const allUsers = await User.find({ workspaceId });
        const targetEmails = allUsers.map((u) => u.email).filter((e) => e !== request.user.email);
        if (targetEmails.length > 0) {
          const timeStr = scheduledAt || startTime ? new Date(scheduledAt || startTime).toLocaleString() : "Now";
          const reqOrigin = request.headers.origin || process.env.CLIENT_URL || "http://localhost:5173";
          const origin = reqOrigin.includes("localhost") || reqOrigin.includes("127.0.0.1") ? "https://workspace-blue-theta-87.vercel.app" : reqOrigin;
          const webLink = `${origin}/w/${workspaceId}/meet/room/${joinCode}${plainPasscode ? `?pwd=${encodeURIComponent(plainPasscode)}&intent=join` : "?intent=join"}`;
          const mobileLink = `nexus://meet/room/${joinCode}${plainPasscode ? `?pwd=${encodeURIComponent(plainPasscode)}` : ""}`;
          const mailBody = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
    <h2 style="color: #2563eb;">Meeting Invitation: ${meeting.title}</h2>
    <p>Hi there,</p>
    <p>You have been invited by <strong>${request.user.name}</strong> to join a Forge India Connect meeting.</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong> ${timeStr}</p>
      <p style="margin: 0 0 10px 0;"><strong>Duration:</strong> ${meeting.durationMinutes} minutes</p>
      <p style="margin: 0 0 10px 0;"><strong>Room Code:</strong> <span style="font-family: monospace; font-size: 16px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${meeting.joinCode}</span></p>
      ${plainPasscode ? `<p style="margin: 0;"><strong>Passcode:</strong> ${plainPasscode}</p>` : ""}
    </div>

    <div style="margin: 24px 0;">
      <a href="${webLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 12px; margin-bottom: 12px;">Join on Web</a>
      <a href="${mobileLink}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Join on Mobile</a>
    </div>

    <p>You can also join by opening the <strong>Meetings</strong> app in your workspace and entering the Room Code above.</p>
    <br/>
    <p>Best regards,<br/><strong>Forge India Connect AI</strong></p>
  </div>
          `;
          for (const email of targetEmails) {
            Mail.create({
              workspaceId,
              ownerEmail: email,
              folder: "inbox",
              senderName: "Forge India Connect AI",
              senderEmail: "nexus-ai@workspace.app",
              recipientEmails: [email],
              subject: `Invitation: ${meeting.title}`,
              body: mailBody,
              attachments: [],
              isRead: false
            }).catch((e) => console.error("Failed to create invite email for", email, e));
          }
        }
      } catch (e) {
        console.error("Failed to fetch workspace users for invitations", e);
      }
      return reply.code(201).send(meeting);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create meeting room.", details: err.message });
    }
  });
  fastify2.get("/join/:code", { preHandler: authenticate }, async (request, reply) => {
    try {
      if (request.user?.role === "demo") {
        return reply.code(403).send({ error: "Demo accounts cannot join meetings." });
      }
      const { code } = request.params;
      const { passcode } = request.query;
      const cleanCode = normalizeJoinCode(String(code || ""));
      let meeting = await resolveMeetingIdentifier(cleanCode);
      const persistentRoomTitles = {
        "NEXUS-BOARDROOM": " General Boardroom",
        "NEXUS-ENG": " Developer Sandbox",
        "NEXUS-DESIGN": " UX Design Workshop"
      };
      if (!meeting && persistentRoomTitles[cleanCode]) {
        meeting = await Meeting.create({
          title: persistentRoomTitles[cleanCode],
          hostId: new import_mongoose11.Types.ObjectId(request.user.id),
          joinCode: cleanCode,
          scheduledAt: /* @__PURE__ */ new Date(),
          durationMinutes: 9999,
          // Persistent room has unlimited duration
          status: "live",
          participantIds: [new import_mongoose11.Types.ObjectId(request.user.id)]
        });
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
        const hostIdStr = meeting.hostId._id?.toString?.() || meeting.hostId.toString();
        const isHost = hostIdStr === request.user.id;
        const isParticipant = meeting.participantIds && meeting.participantIds.some((id) => id.toString() === request.user.id);
        if (!isHost && !isParticipant) {
          const isPasscodeValid = passcode && await import_bcrypt3.default.compare(String(passcode), meeting.passcodeHash);
          if (!isPasscodeValid) {
            return reply.code(401).send({ error: "Invalid meeting passcode." });
          }
        }
      }
      const userId = new import_mongoose11.Types.ObjectId(request.user.id);
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
        aiEnabled: !!meeting.aiEnabled,
        participantIds: meeting.participantIds,
        activeParticipantCount,
        isHost: hostId === request.user.id
      });
    } catch (err) {
      return reply.code(500).send({ error: "Error resolving meeting join code.", details: err.message });
    }
  });
  fastify2.get("/history", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { page = 1, limit = 10 } = request.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const userId = new import_mongoose11.Types.ObjectId(request.user.id);
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
  fastify2.get("/rooms", { preHandler: authenticate }, async (request, reply) => {
    try {
      const workspaceId = request.user?.workspaceId || "antigraviity-hq";
      const rooms2 = await Room.find({ workspaceId }).sort({ createdAt: -1 });
      return reply.code(200).send(rooms2);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch rooms", details: err.message });
    }
  });
  fastify2.post("/rooms", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { title, tag, color } = request.body;
      const workspaceId = request.user?.workspaceId || "antigraviity-hq";
      if (!title || !tag) return reply.code(400).send({ error: "Title and Tag are required." });
      const room = await Room.create({
        workspaceId,
        creatorId: request.user.id,
        title,
        tag,
        color: color || "#7c3aed"
      });
      return reply.code(201).send(room);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create room", details: err.message });
    }
  });
  fastify2.delete("/rooms/:id", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const room = await Room.findById(id);
      if (!room) return reply.code(404).send({ error: "Room not found." });
      if (room.creatorId.toString() !== request.user.id && request.user.role !== "company-admin") {
        return reply.code(403).send({ error: "Unauthorized to delete this room." });
      }
      await Room.findByIdAndDelete(id);
      return reply.code(200).send({ success: true });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete room", details: err.message });
    }
  });
  fastify2.get("/:id", { preHandler: authenticate }, async (request, reply) => {
    try {
      if (request.user?.role === "demo") {
        return reply.code(403).send({ error: "Demo accounts cannot join meetings." });
      }
      const { id } = request.params;
      if (!import_mongoose11.Types.ObjectId.isValid(id)) {
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
      if (!import_mongoose11.Types.ObjectId.isValid(id)) {
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
      try {
        const workspaceId = request.user?.workspaceId || "antigraviity-hq";
        const allWorkspaceUsers = await User.find({ workspaceId });
        const { activeMailSockets: activeMailSockets2 } = (init_mailSockets(), __toCommonJS(mailSockets_exports));
        if (activeMailSockets2) {
          const msgStr = JSON.stringify({ type: "meeting-update" });
          allWorkspaceUsers.forEach((u) => {
            if (activeMailSockets2.has(u.email)) {
              activeMailSockets2.get(u.email)?.send(msgStr);
            }
          });
        }
      } catch (e) {
        console.error("Socket broadcast error:", e);
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
        console.log(` [WEBHOOK] Successfully dispatched meeting.started: Status ${res.status}`);
      }).catch((err) => {
        console.error(" [WEBHOOK] dispatch failed:", err.message);
      });
      return reply.code(200).send({ success: true, status: "live", meeting });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to boot meeting session.", details: err.message });
    }
  });
  fastify2.post("/:id/start-ai", { preHandler: authenticate }, async (request, reply) => {
    try {
      const { id } = request.params;
      const meeting = await resolveMeetingIdentifier(id);
      if (!meeting) return reply.code(404).send({ error: "Meeting room not found." });
      const proto = request.headers["x-forwarded-proto"]?.split(",")[0] || request.protocol || "http";
      const host = request.headers["x-forwarded-host"]?.split(",")[0] || request.headers.host;
      const backendBaseUrl = process.env.BACKEND_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || (host ? `${proto}://${host}` : void 0);
      const result = await launchAIBot(meeting._id.toString(), meeting.joinCode, backendBaseUrl);
      meeting.aiEnabled = true;
      await meeting.save();
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to start AI Assistant.", details: err.message });
    }
  });
  fastify2.post("/:id/audio-chunk", {
    preHandler: authenticate,
    config: { rawBody: true }
  }, async (request, reply) => {
    try {
      const { id } = request.params;
      const speakerName = request.headers["x-speaker-name"] || request.user.name || "User";
      const userId = request.user.id;
      const contentType = request.headers["content-type"] || "audio/m4a";
      const rawBody = request.rawBody || request.body;
      if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length < 512) {
        return reply.code(400).send({ error: "No valid audio data received." });
      }
      const ext = contentType.includes("webm") ? "webm" : "m4a";
      const os2 = await import("os");
      const fsMod = await import("fs");
      const pathMod = await import("path");
      const { transcribeChunk: transcribeChunk2 } = await Promise.resolve().then(() => (init_transcription(), transcription_exports));
      const fileName = `chunk_${id}_${userId}_${Date.now()}.${ext}`;
      const filePath = pathMod.join(os2.tmpdir(), fileName);
      fsMod.writeFileSync(filePath, rawBody);
      console.log(`[AudioChunk] Saved ${rawBody.length} bytes  ${filePath}`);
      const text = await transcribeChunk2(id, userId, speakerName, filePath);
      try {
        fsMod.unlinkSync(filePath);
      } catch {
      }
      return reply.code(200).send({ success: true, text: text || "" });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to process audio chunk.", details: err.message });
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
        console.log(` [WEBHOOK] Successfully dispatched meeting.ended: Status ${res.status}`);
      }).catch((err) => {
        console.error(" [WEBHOOK] dispatch failed:", err.message);
      });
      try {
        const workspaceId = request.user?.workspaceId || "antigraviity-hq";
        const allWorkspaceUsers = await User.find({ workspaceId });
        const { activeMailSockets: activeMailSockets2 } = (init_mailSockets(), __toCommonJS(mailSockets_exports));
        if (activeMailSockets2) {
          const msgStr = JSON.stringify({ type: "meeting-update" });
          allWorkspaceUsers.forEach((u) => {
            if (activeMailSockets2.has(u.email)) {
              activeMailSockets2.get(u.email)?.send(msgStr);
            }
          });
        }
      } catch (e) {
        console.error("Socket broadcast error:", e);
      }
      await Participant.updateMany(
        { meetingId: meeting._id, leftAt: { $exists: false } },
        { leftAt: /* @__PURE__ */ new Date() }
      );
      if (meeting.aiEnabled) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await stopAIBot(meeting._id.toString());
      }
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
      if (!id || !id.trim()) {
        return reply.code(400).send({ error: "Missing required field: meeting ID." });
      }
      let meeting;
      try {
        meeting = await resolveMeetingIdentifier(id);
      } catch (resolveErr) {
        return reply.code(400).send({ error: "Invalid meeting identifier.", details: resolveErr.message });
      }
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      try {
        await Participant.findOneAndUpdate(
          {
            meetingId: meeting._id,
            userId: new import_mongoose11.Types.ObjectId(request.user.id),
            leftAt: { $exists: false }
          },
          { leftAt: /* @__PURE__ */ new Date() },
          { new: true }
        );
      } catch (participantErr) {
        console.warn("[Meeting] Failed to update participant leave status:", participantErr.message);
      }
      const aiBotUser = await User.findOne({ email: "ai-assistant@nexus.app" });
      const query = {
        meetingId: meeting._id,
        leftAt: { $exists: false }
      };
      if (aiBotUser) {
        query.userId = { $ne: aiBotUser._id };
      }
      const activeParticipantCount = await Participant.countDocuments(query);
      if (activeParticipantCount === 0) {
        meeting.status = "ended";
        await meeting.save();
        await new Promise((resolve) => setTimeout(resolve, 2500));
        if (meeting.aiEnabled) {
          await stopAIBot(meeting._id.toString());
        } else {
          summarizeMeeting(meeting._id.toString()).catch((err) => {
            console.warn("[Meeting] Summary generation failed:", err.message);
          });
        }
      }
      return reply.code(200).send({ success: true, message: "Left meeting successfully", activeParticipantCount });
    } catch (err) {
      console.error("[Meeting] Leave route error:", err);
      return reply.code(500).send({ error: "Failed to leave meeting.", details: err.message || "Unknown server error" });
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
      if (!id || !id.trim()) {
        return reply.code(400).send({ error: "Missing required field: meeting ID." });
      }
      if (!import_mongoose11.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid meeting ID format." });
      }
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: "Meeting room not found." });
      }
      if (meeting.status !== "ended") {
        return reply.code(400).send({ error: "Summaries can only be generated for completed meetings. Current status: " + meeting.status });
      }
      if (meeting.aiSummary) {
        return reply.code(200).send({ summary: meeting.aiSummary });
      }
      const transcriptCount = await Transcript.countDocuments({ meetingId: meeting._id });
      if (transcriptCount === 0) {
        return reply.code(400).send({ error: "No transcript data available for this meeting. Summary cannot be generated without transcripts." });
      }
      const summaryHtml = await summarizeMeeting(meeting._id.toString());
      return reply.code(200).send({ summary: summaryHtml });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to generate AI summary.", details: err.message });
    }
  });
}

// src/routes/mail.ts
init_mailSockets();
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
      const query = { ownerEmail };
      if (folder === "starred") {
        query.isStarred = true;
      } else if (folder !== "all") {
        query.folder = folder;
      }
      console.log(`[Mail GET] folder: ${folder}, query:`, query);
      const mails = await Mail.find(query).sort({ sentAt: -1 });
      console.log(`[Mail GET] found ${mails.length} mails`);
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
  fastify2.put("/:id/label", async (request, reply) => {
    try {
      const { label } = request.body;
      const mail = await Mail.findOneAndUpdate(
        { _id: request.params.id, ownerEmail: request.user.email },
        { label },
        { new: true }
      );
      if (!mail) return reply.code(404).send({ error: "Mail not found" });
      return reply.code(200).send(mail);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update mail label" });
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
  fastify2.post("/export-pdf", async (request, reply) => {
    try {
      const { html } = request.body;
      if (!html) {
        return reply.code(400).send({ error: "HTML content is required" });
      }
      const puppeteer = require("puppeteer");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" }
      });
      await browser.close();
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'attachment; filename="export.pdf"');
      return reply.send(pdfBuffer);
    } catch (err) {
      console.error("PDF Export Error:", err);
      return reply.code(500).send({ error: "Failed to generate PDF", details: err.message });
    }
  });
  fastify2.post("/upload-attachment", async (request, reply) => {
    try {
      const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dfou7lxtg";
      const API_KEY = process.env.CLOUDINARY_API_KEY || "323596529822668";
      const API_SECRET = process.env.CLOUDINARY_API_SECRET || "1DGzf5iYPo0OhiAN_KKQs_mVim0";
      const FOLDER = process.env.CLOUDINARY_FOLDER || "c-726de3a6883bccf114775c7a84376e";
      const { fileBase64, fileName, mimeType } = request.body;
      if (!fileBase64) return reply.code(400).send({ error: "fileBase64 is required" });
      const timestamp = Math.floor(Date.now() / 1e3);
      const crypto = await import("crypto");
      const signatureStr = `folder=${FOLDER}&timestamp=${timestamp}${API_SECRET}`;
      const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");
      const formData = new URLSearchParams();
      formData.append("file", `data:${mimeType};base64,${fileBase64}`);
      formData.append("api_key", API_KEY);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", FOLDER);
      if (fileName) formData.append("public_id", fileName.replace(/\.[^/.]+$/, ""));
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });
      const data = await res.json();
      if (!res.ok) return reply.code(500).send({ error: "Cloudinary error", details: data });
      return reply.code(200).send({ url: data.secure_url, publicId: data.public_id, bytes: data.bytes });
    } catch (err) {
      return reply.code(500).send({ error: "Upload failed", details: err.message });
    }
  });
}

// src/routes/kural.ts
var import_mongoose16 = require("mongoose");
var import_cloudinary = require("cloudinary");

// src/models/KuralConversation.ts
var import_mongoose12 = require("mongoose");
var KuralConversationSchema = new import_mongoose12.Schema({
  workspaceId: { type: String, required: true, index: true },
  type: { type: String, enum: ["direct", "channel"], default: "direct" },
  name: { type: String },
  avatarUrl: { type: String },
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
var KuralConversation = (0, import_mongoose12.model)("KuralConversation", KuralConversationSchema);

// src/models/KuralMessage.ts
var import_mongoose13 = require("mongoose");
var KuralMessageSchema = new import_mongoose13.Schema({
  conversationId: { type: import_mongoose13.Schema.Types.ObjectId, ref: "KuralConversation", required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  senderEmail: { type: String, required: true, lowercase: true, trim: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  fileUrl: { type: String },
  fileType: { type: String },
  originalName: { type: String },
  createdAt: { type: Date, default: Date.now }
});
KuralMessageSchema.index({ conversationId: 1, createdAt: 1 });
var KuralMessage = (0, import_mongoose13.model)("KuralMessage", KuralMessageSchema);

// src/models/Story.ts
var import_mongoose14 = require("mongoose");
var StorySchema = new import_mongoose14.Schema({
  workspaceId: { type: String, required: true, index: true },
  userId: { type: String },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String },
  content: { type: String },
  mediaType: { type: String, enum: ["text", "image", "video", "voice"], default: "text" },
  mediaUrl: { type: String },
  bgColor: { type: String },
  privacyType: { type: String, enum: ["everyone", "contacts", "except", "only_share"], default: "everyone" },
  mentions: [{ type: String }],
  views: [{
    viewerEmail: String,
    viewedAt: { type: Date, default: Date.now }
  }],
  reactions: [{
    userEmail: String,
    emoji: String,
    addedAt: { type: Date, default: Date.now }
  }],
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
  // Auto-delete after 24 hours
});
StorySchema.index({ workspaceId: 1, createdAt: -1 });
var Story = (0, import_mongoose14.model)("Story", StorySchema);

// src/models/CallLog.ts
var import_mongoose15 = __toESM(require("mongoose"));
var CallLogSchema = new import_mongoose15.Schema(
  {
    callerEmail: { type: String, required: true },
    calleeEmail: { type: String, required: true },
    callerName: { type: String, required: true },
    calleeName: { type: String, required: true },
    callType: { type: String, enum: ["audio", "video"], default: "audio" },
    status: { type: String, enum: ["answered", "missed", "declined"], default: "answered" },
    duration: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    deletedBy: { type: [String], default: [] }
  },
  { timestamps: true }
);
CallLogSchema.index({ callerEmail: 1, timestamp: -1 });
CallLogSchema.index({ calleeEmail: 1, timestamp: -1 });
var CallLog = import_mongoose15.default.model("CallLog", CallLogSchema);

// src/routes/kural.ts
var cloudinaryFolder = process.env.CLOUDINARY_FOLDER || "chat_uploads";
var cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
var cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || "";
var cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || "";
import_cloudinary.v2.config({
  cloud_name: cloudinaryCloudName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret
});
var defaultWorkspaceId = "antigraviity-hq";
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function initials(name) {
  return (name || "User").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}
function resolveUploadName(file, uploaded) {
  const explicit = String(file?.filename || "").trim();
  if (explicit) return explicit;
  const fromCloudinary = String(uploaded?.original_filename || "").trim();
  if (fromCloudinary) {
    const fmt = String(uploaded?.format || "").trim();
    return fmt ? `${fromCloudinary}.${fmt}` : fromCloudinary;
  }
  const mime = String(file?.mimetype || "").trim();
  const ext = mime.includes("/") ? mime.split("/")[1] : "file";
  return `upload.${ext || "file"}`;
}
async function resolveMultipartFile(request) {
  try {
    const direct = await request.file();
    if (direct) return direct;
  } catch {
  }
  const bodyFile = request.body?.file;
  if (bodyFile?.file) return bodyFile;
  return null;
}
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function uploadToCloudinary(file) {
  const missingCloudinaryVars = [
    !cloudinaryCloudName ? "CLOUDINARY_CLOUD_NAME" : "",
    !cloudinaryApiKey ? "CLOUDINARY_API_KEY" : "",
    !cloudinaryApiSecret ? "CLOUDINARY_API_SECRET" : ""
  ].filter(Boolean);
  if (missingCloudinaryVars.length > 0) {
    throw new Error(`Cloudinary config missing: ${missingCloudinaryVars.join(", ")}`);
  }
  const mimetype = file?.mimetype || "application/octet-stream";
  const resourceType = String(mimetype).startsWith("video/") ? "video" : "auto";
  const uploadOptions = {
    folder: cloudinaryFolder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false
  };
  const payload = typeof file?.toBuffer === "function" ? await file.toBuffer() : file?.file ? await streamToBuffer(file.file) : Buffer.alloc(0);
  if (!payload.length) {
    throw new Error("Uploaded file is empty or unreadable.");
  }
  return new Promise((resolve, reject) => {
    const uploadStream = import_cloudinary.v2.uploader.upload_stream(uploadOptions, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error("Cloudinary upload returned no result."));
      resolve(uploaded);
    });
    uploadStream.end(payload);
  });
}
async function ensureDirectConversation(workspaceId, currentEmail, peerEmail) {
  const participants = [currentEmail, peerEmail].map(normalizeEmail).sort();
  let conversation = await KuralConversation.findOne({
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
  fastify2.post("/upload", async (request, reply) => {
    try {
      const file = await resolveMultipartFile(request);
      if (!file) {
        return reply.code(400).send({ error: "Missing file upload." });
      }
      const result = await uploadToCloudinary(file);
      return reply.code(200).send({
        url: result.secure_url || result.url,
        type: file.mimetype || "application/octet-stream",
        originalName: resolveUploadName(file, result),
        publicId: result.public_id
      });
    } catch (err) {
      return reply.code(500).send({ error: "Cloudinary upload failed.", details: err.message });
    }
  });
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
      }).select("name email role avatarUrl workspaceId createdAt");
      const channelsMap = /* @__PURE__ */ new Map();
      const conversations = await KuralConversation.find({
        type: "direct",
        participantEmails: currentEmail
      });
      for (const conversation of conversations) {
        if (!channelsMap.has(conversation._id.toString())) {
          const peerEmail = conversation.participantEmails.find((e) => e !== currentEmail) || currentEmail;
          const peerUser = await User.findOne({ email: peerEmail }).select("name role avatarUrl");
          channelsMap.set(conversation._id.toString(), {
            _id: conversation._id,
            type: conversation.type,
            displayName: peerUser?.name || peerEmail,
            name: peerUser?.name || peerEmail,
            email: peerEmail,
            avatar: initials(peerUser?.name || peerEmail),
            role: peerUser?.role || "Member",
            workspaceId: activeWorkspaceId,
            isOnline: true,
            lastMessageContent: conversation.lastMessageContent || "Start a secure Kural conversation",
            lastMessageTime: conversation.lastMessageTime || conversation.updatedAt
          });
        }
      }
      const channels = Array.from(channelsMap.values()).sort((a, b) => {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      return reply.code(200).send(channels);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch Kural channels.", details: err.message });
    }
  });
  fastify2.get("/:workspaceId/groups", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const currentEmail = normalizeEmail(request.query.email || request.user?.email);
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      const groups = await KuralConversation.find({
        workspaceId: activeWorkspaceId,
        type: "channel",
        participantEmails: currentEmail
      }).sort({ updatedAt: -1 });
      return reply.code(200).send(groups.map((g) => ({
        _id: g._id,
        type: g.type,
        name: g.name,
        displayName: g.name,
        participantEmails: g.participantEmails,
        lastMessageContent: g.lastMessageContent,
        lastMessageTime: g.lastMessageTime || g.updatedAt,
        unread: 0,
        isOnline: true
      })));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch groups.", details: err.message });
    }
  });
}
async function kuralRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.post("/upload", async (request, reply) => {
    try {
      const file = await resolveMultipartFile(request);
      if (!file) {
        return reply.code(400).send({ error: "Missing file upload." });
      }
      const result = await uploadToCloudinary(file);
      return reply.code(200).send({
        url: result.secure_url || result.url,
        type: file.mimetype || "application/octet-stream",
        originalName: resolveUploadName(file, result),
        publicId: result.public_id
      });
    } catch (err) {
      return reply.code(500).send({ error: "Cloudinary upload failed.", details: err.message });
    }
  });
  fastify2.get("/search", async (request, reply) => {
    try {
      const { email } = request.query;
      if (!email) return reply.code(400).send({ error: "Email query parameter is required." });
      const user = await User.findOne({ email: normalizeEmail(email) }).select("name email avatarUrl");
      if (!user) return reply.code(404).send({ error: "User not found." });
      return reply.code(200).send(user);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to search user.", details: err.message });
    }
  });
  fastify2.post("/start-dm", async (request, reply) => {
    try {
      const { members = [], createdBy, workspaceId } = request.body;
      const currentEmail = normalizeEmail(createdBy || request.user?.email || "");
      const peerEmail = normalizeEmail(members.find((email) => normalizeEmail(email) !== currentEmail) || members[0] || currentEmail);
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
  fastify2.post("/groups", async (request, reply) => {
    try {
      const { name, members = [], workspaceId } = request.body;
      const currentEmail = normalizeEmail(request.user?.email || "");
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      if (!name) return reply.code(400).send({ error: "Group name is required." });
      const participantEmails = [.../* @__PURE__ */ new Set([currentEmail, ...members.map(normalizeEmail)])];
      const conversation = await KuralConversation.create({
        workspaceId: activeWorkspaceId,
        type: "channel",
        name,
        participantEmails,
        createdByEmail: currentEmail
      });
      const { activeMailSockets: activeMailSockets2 } = (init_mailSockets(), __toCommonJS(mailSockets_exports));
      if (activeMailSockets2) {
        const channelData = {
          _id: conversation._id,
          type: conversation.type,
          name: conversation.name,
          displayName: conversation.name,
          participantEmails: conversation.participantEmails,
          lastMessageContent: conversation.lastMessageContent,
          lastMessageTime: conversation.lastMessageTime || conversation.updatedAt,
          unread: 0,
          isOnline: true
        };
        const messageStr = JSON.stringify({ type: "new-channel", channel: channelData });
        participantEmails.forEach((email) => {
          if (email !== currentEmail && activeMailSockets2.has(email)) {
            activeMailSockets2.get(email)?.send(messageStr);
          }
        });
      }
      return reply.code(201).send(conversation);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create group.", details: err.message });
    }
  });
  fastify2.post("/groups/:groupId/members", async (request, reply) => {
    try {
      const { groupId } = request.params;
      const { emails = [] } = request.body;
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!import_mongoose16.Types.ObjectId.isValid(groupId)) {
        return reply.code(400).send({ error: "Invalid group ID." });
      }
      if (!Array.isArray(emails) || emails.length === 0) {
        return reply.code(400).send({ error: "At least one email is required." });
      }
      const conversation = await KuralConversation.findOne({
        _id: groupId,
        participantEmails: currentEmail
      });
      console.log("--- ADD MEMBER DEBUG ---");
      console.log("groupId:", groupId);
      console.log("emails to add:", emails);
      console.log("currentEmail:", currentEmail);
      console.log("Found conversation:", conversation ? conversation._id : "null");
      if (!conversation) {
        return reply.code(404).send({ error: "Group not found or you are not a member." });
      }
      const newEmails = emails.map(normalizeEmail).filter((e) => e && !conversation.participantEmails.includes(e));
      if (newEmails.length === 0) {
        return reply.code(200).send({ message: "All users are already members.", conversation });
      }
      conversation.participantEmails.push(...newEmails);
      await conversation.save();
      const { activeMailSockets: activeMailSockets2 } = (init_mailSockets(), __toCommonJS(mailSockets_exports));
      if (activeMailSockets2) {
        const channelData = {
          _id: conversation._id,
          type: conversation.type,
          name: conversation.name,
          displayName: conversation.name,
          participantEmails: conversation.participantEmails,
          lastMessageContent: conversation.lastMessageContent,
          lastMessageTime: conversation.lastMessageTime || conversation.updatedAt,
          unread: 0,
          isOnline: true
        };
        const messageStr = JSON.stringify({ type: "new-channel", channel: channelData });
        newEmails.forEach((email) => {
          if (activeMailSockets2.has(email)) {
            activeMailSockets2.get(email)?.send(messageStr);
          }
        });
      }
      return reply.code(200).send({ message: `${newEmails.length} member(s) added.`, conversation });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to add members.", details: err.message });
    }
  });
  fastify2.patch("/groups/:groupId/name", async (request, reply) => {
    try {
      const { groupId } = request.params;
      const { name } = request.body;
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!import_mongoose16.Types.ObjectId.isValid(groupId)) return reply.code(400).send({ error: "Invalid group ID." });
      if (!name || name.trim() === "") return reply.code(400).send({ error: "Name is required." });
      const conversation = await KuralConversation.findOne({ _id: groupId, participantEmails: currentEmail });
      if (!conversation) return reply.code(404).send({ error: "Group not found or you are not a member." });
      conversation.name = name.trim();
      await conversation.save();
      return reply.code(200).send({ message: "Group name updated.", conversation });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update group name.", details: err.message });
    }
  });
  fastify2.patch("/groups/:groupId/avatar", async (request, reply) => {
    try {
      const { groupId } = request.params;
      const { avatarUrl } = request.body;
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!import_mongoose16.Types.ObjectId.isValid(groupId)) return reply.code(400).send({ error: "Invalid group ID." });
      if (!avatarUrl) return reply.code(400).send({ error: "avatarUrl is required." });
      const conversation = await KuralConversation.findOne({ _id: groupId, participantEmails: currentEmail });
      if (!conversation) return reply.code(404).send({ error: "Group not found or you are not a member." });
      conversation.avatarUrl = avatarUrl;
      await conversation.save();
      return reply.code(200).send({ message: "Group avatar updated.", conversation });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to update group avatar.", details: err.message });
    }
  });
  fastify2.delete("/groups/:groupId", async (request, reply) => {
    try {
      const { groupId } = request.params;
      if (!import_mongoose16.Types.ObjectId.isValid(groupId)) {
        return reply.code(400).send({ error: "Invalid group id." });
      }
      const currentEmail = normalizeEmail(request.user?.email || "");
      const conversation = await KuralConversation.findOne({
        _id: groupId,
        type: "channel"
      });
      if (!conversation) {
        return reply.code(404).send({ error: "Group not found." });
      }
      if (conversation.createdByEmail !== currentEmail) {
        return reply.code(403).send({ error: "Only the group creator can delete this group." });
      }
      await KuralMessage.deleteMany({ conversationId: conversation._id });
      await KuralConversation.findByIdAndDelete(conversation._id);
      const { activeMailSockets: activeMailSockets2 } = (init_mailSockets(), __toCommonJS(mailSockets_exports));
      if (activeMailSockets2) {
        const msgStr = JSON.stringify({ type: "group-deleted", payload: { groupId: conversation._id } });
        conversation.participantEmails.forEach((email) => {
          if (activeMailSockets2.has(email)) {
            activeMailSockets2.get(email)?.send(msgStr);
          }
        });
      }
      return reply.code(200).send({ message: "Group deleted successfully." });
    } catch (err) {
      console.error("Delete group error:", err);
      return reply.code(500).send({ error: "Failed to delete group.", details: err.message });
    }
  });
  fastify2.delete("/groups/:groupId/members/:email", async (request, reply) => {
    try {
      const { groupId, email } = request.params;
      const currentEmail = normalizeEmail(request.user?.email || "");
      const emailToRemove = normalizeEmail(email);
      if (!import_mongoose16.Types.ObjectId.isValid(groupId)) return reply.code(400).send({ error: "Invalid group ID." });
      if (!emailToRemove) return reply.code(400).send({ error: "Email to remove is required." });
      const conversation = await KuralConversation.findOne({ _id: groupId, participantEmails: currentEmail });
      if (!conversation) return reply.code(404).send({ error: "Group not found or you are not a member." });
      conversation.participantEmails = conversation.participantEmails.filter((e) => e !== emailToRemove);
      await conversation.save();
      return reply.code(200).send({ message: "Member removed.", conversation });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to remove member.", details: err.message });
    }
  });
  fastify2.get("/groups/:groupId", async (request, reply) => {
    try {
      const { groupId } = request.params;
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!import_mongoose16.Types.ObjectId.isValid(groupId)) {
        return reply.code(400).send({ error: "Invalid group ID." });
      }
      const conversation = await KuralConversation.findOne({
        _id: groupId,
        participantEmails: currentEmail
      });
      if (!conversation) {
        return reply.code(404).send({ error: "Group not found." });
      }
      return reply.code(200).send(conversation);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch group details.", details: err.message });
    }
  });
  fastify2.get("/:workspaceId/:channelId", async (request, reply) => {
    try {
      const { workspaceId, channelId } = request.params;
      if (!import_mongoose16.Types.ObjectId.isValid(channelId)) {
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
      const messages = await KuralMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).limit(100);
      return reply.code(200).send(messages.map((message) => ({
        _id: message._id,
        conversationId: message.conversationId,
        sender: message.senderEmail === currentEmail ? "You" : message.senderName,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        originalName: message.originalName,
        timestamp: message.createdAt
      })));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch Kural messages.", details: err.message });
    }
  });
  fastify2.post("/:workspaceId/:channelId/messages", async (request, reply) => {
    try {
      const { workspaceId, channelId } = request.params;
      const body = request.body;
      const content = String(body.content || "").trim();
      const fileUrl = body.fileUrl || null;
      const fileType = body.fileType || null;
      const originalName = String(body.originalName || "").trim() || null;
      if (!import_mongoose16.Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: "Invalid Kural channel id." });
      }
      if (!content && !fileUrl) {
        return reply.code(400).send({ error: "Message content or file is required." });
      }
      const currentEmail = normalizeEmail(request.user?.email || "");
      const conversation = await KuralConversation.findOne({
        _id: channelId,
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
        content,
        fileUrl,
        fileType,
        originalName
      });
      conversation.lastMessageContent = content || `Sent a file: ${originalName || "Attachment"}`;
      conversation.lastMessageTime = message.createdAt;
      await conversation.save();
      return reply.code(201).send({
        _id: message._id,
        conversationId: message.conversationId,
        sender: "You",
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        originalName: message.originalName,
        timestamp: message.createdAt
      });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to send Kural message.", details: err.message });
    }
  });
  fastify2.get("/:workspaceId/stories", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      const stories = await Story.find({ workspaceId: activeWorkspaceId }).sort({ createdAt: -1 }).limit(50);
      return reply.code(200).send(stories);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch stories.", details: err.message });
    }
  });
  fastify2.post("/:workspaceId/stories", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const { content } = request.body;
      if (!content) return reply.code(400).send({ error: "Content is required." });
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      const currentUser = await User.findById(request.user?.id);
      const story = await Story.create({
        workspaceId: activeWorkspaceId,
        userId: request.user?.id,
        userEmail: normalizeEmail(request.user?.email || ""),
        userName: request.user?.name || "User",
        userAvatar: currentUser?.avatarUrl,
        content
      });
      return reply.code(201).send(story);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to post story.", details: err.message });
    }
  });
  fastify2.delete("/delete-conversation/:channelId", async (request, reply) => {
    try {
      const { channelId } = request.params;
      if (!import_mongoose16.Types.ObjectId.isValid(channelId)) {
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
      conversation.lastMessageContent = "Start a secure Kural conversation";
      conversation.lastMessageTime = void 0;
      await conversation.save();
      return reply.code(200).send({ message: "Kural conversation cleared." });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete Kural conversation.", details: err.message });
    }
  });
  fastify2.get("/call-logs", async (request, reply) => {
    try {
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!currentEmail) return reply.code(401).send({ error: "Unauthorized" });
      const logs = await CallLog.find({
        $or: [{ callerEmail: currentEmail }, { calleeEmail: currentEmail }],
        deletedBy: { $ne: currentEmail }
      }).sort({ timestamp: -1 }).limit(100);
      return reply.code(200).send(logs);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch call logs", details: err.message });
    }
  });
  fastify2.post("/call-logs", async (request, reply) => {
    try {
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!currentEmail) return reply.code(401).send({ error: "Unauthorized" });
      const { calleeEmail, callerName, calleeName, callType, status, duration } = request.body;
      if (!calleeEmail || !callType || !status) {
        return reply.code(400).send({ error: "calleeEmail, callType, and status are required" });
      }
      const log = await CallLog.create({
        callerEmail: currentEmail,
        calleeEmail: normalizeEmail(calleeEmail),
        callerName: callerName || "Unknown Caller",
        calleeName: calleeName || "Unknown Callee",
        callType,
        status,
        duration: duration || 0
      });
      return reply.code(201).send(log);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create call log", details: err.message });
    }
  });
  fastify2.delete("/call-logs/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const currentEmail = normalizeEmail(request.user?.email || "");
      if (!import_mongoose16.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid CallLog ID" });
      }
      const log = await CallLog.findById(id);
      if (!log) return reply.code(404).send({ error: "Call log not found" });
      if (log.callerEmail !== currentEmail && log.calleeEmail !== currentEmail) {
        return reply.code(403).send({ error: "Not authorized to delete this log" });
      }
      if (!log.deletedBy.includes(currentEmail)) {
        log.deletedBy.push(currentEmail);
        await log.save();
      }
      return reply.code(200).send({ message: "Call log deleted" });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete call log", details: err.message });
    }
  });
}

// src/routes/members.ts
var import_bcrypt4 = __toESM(require("bcrypt"));
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
      if (workspaceId !== defaultWorkspaceId2) {
        const tenant = await Tenant.findOne({ workspaceId });
        if (tenant && tenant.maxUsers) {
          const currentUsers = await User.countDocuments({ workspaceId });
          if (currentUsers >= tenant.maxUsers) {
            return reply.code(403).send({ error: `Subscription limit reached (${tenant.maxUsers} users). Please upgrade to add more members.` });
          }
        }
      }
      const existing = await User.findOne({ email });
      if (existing) {
        return reply.code(409).send({ error: "A user with this email already exists." });
      }
      const passwordHash = await import_bcrypt4.default.hash(password, 12);
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

// src/models/Task.ts
var import_mongoose17 = require("mongoose");
var TaskSchema = new import_mongoose17.Schema({
  workspaceId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["todo", "in-progress", "pending_approval", "done"],
    default: "todo"
  },
  feedback: { type: String },
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
var Task = (0, import_mongoose17.model)("Task", TaskSchema);

// src/routes/tasks.ts
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
      const allowedFields = ["title", "description", "status", "priority", "assigneeEmail", "assigneeName", "dueDate", "feedback"];
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

// src/models/Document.ts
var import_mongoose18 = require("mongoose");
var DocumentSchema = new import_mongoose18.Schema({
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
  content: { type: import_mongoose18.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
DocumentSchema.index({ workspaceId: 1, createdAt: -1 });
DocumentSchema.pre("save", function(next) {
  this.updatedAt = /* @__PURE__ */ new Date();
  next();
});
var WorkspaceDocument = (0, import_mongoose18.model)("WorkspaceDocument", DocumentSchema);

// src/routes/docs.ts
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
        type: (body.type || "doc").toLowerCase(),
        ownerEmail: request.user?.email || "",
        ownerName: request.user?.name || "",
        sizeBytes: body.sizeBytes || 0,
        url: body.url || "",
        content: body.content
      });
      return reply.code(201).send(doc);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create document.", details: err.message });
    }
  });
  fastify2.post("/generate", async (request, reply) => {
    try {
      const { prompt } = request.body;
      if (!prompt) return reply.code(400).send({ error: "Prompt is required" });
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return reply.code(500).send({ error: "AI API key not configured" });
      }
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are an expert document writer. The user will provide a topic or prompt. Generate a comprehensive document in HTML format. Return ONLY the HTML content, no markdown wrappers, no explanations. Use appropriate headings <h1>, <h2>, <p>, <ul>, <li>, <strong> etc. Do not include <html>, <head>, or <body> tags, just the inner content." },
            { role: "user", content: prompt }
          ],
          temperature: 0.5
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error: ${errorText}`);
      }
      const data = await response.json();
      let generatedHtml = data.choices?.[0]?.message?.content || "";
      generatedHtml = generatedHtml.replace(/^```html\n?/, "").replace(/\n?```$/, "").trim();
      return reply.code(200).send({ html: generatedHtml });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to generate document", details: err.message });
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

// src/routes/show.ts
var fs4 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var cachedExamples = "";
try {
  const examplesPath = path3.join(__dirname, "../ppt_examples.json");
  if (fs4.existsSync(examplesPath)) {
    cachedExamples = fs4.readFileSync(examplesPath, "utf8");
  }
} catch (e) {
  console.error("Failed to load ppt_examples.json", e);
}
async function showRoutes(fastify2) {
  fastify2.get("/ping", async () => ({ pong: true }));
  fastify2.post("/generate", async (request, reply) => {
    try {
      const { prompt } = request.body;
      if (!prompt) return reply.code(400).send({ error: "Prompt is required" });
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return reply.code(500).send({ error: "AI API key not configured" });
      }
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an expert presentation creator. Generate a professional presentation based on the user prompt. 
You must strictly reply with a JSON object containing two keys: "theme" and "slides".
1. "theme": Choose one from ["modern", "corporate", "playful", "dark", "elegant"] based on the topic.
2. "slides": An array of slide objects.

Each slide object MUST have:
- "layout": Choose ONE from ["title", "bullets", "split", "quote", "default"].
- "title": The slide title string.
- "subtitle": (Optional) The slide subtitle string, mostly used for "title" layout.
- "content": An array of strings representing bullet points, paragraphs, or split content. Do NOT use HTML tags.

Here are some training examples showing the PROFESSIONAL STRUCTURE and FLOW of a presentation (note: map their layouts to our supported layouts ["title", "bullets", "split", "quote", "default"]):
${cachedExamples}

Generate 5 to 7 slides with rich, professional content following the flow in the training examples. Provide the JSON object.`
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.5
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error: ${errorText}`);
      }
      const data = await response.json();
      let generatedJsonText = data.choices?.[0]?.message?.content || '{"slides":[]}';
      console.log("Raw AI Output:", generatedJsonText);
      let slides = [];
      let theme = "modern";
      try {
        const cleanedText = generatedJsonText.replace(/```json\\n?/g, "").replace(/```\\n?/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        slides = parsed.slides || [];
        theme = parsed.theme || "modern";
      } catch (parseError) {
        throw new Error(`Failed to parse AI output as JSON. Output: ${generatedJsonText}. Error: ${parseError.message}`);
      }
      return reply.code(200).send({ slides, theme });
    } catch (err) {
      console.error("AI GENERATION ERROR:", err);
      try {
        fs4.writeFileSync(path3.join(__dirname, "../groq_error_debug.log"), err.message + "\\n" + err.stack);
      } catch (e) {
      }
      return reply.code(500).send({ error: err.message || "Failed to generate presentation" });
    }
  });
}

// src/routes/superadmin.ts
async function superadminRoutes(fastify2) {
  fastify2.addHook("preHandler", authenticate);
  fastify2.addHook("preHandler", async (request, reply) => {
    if (request.user?.role !== "super-admin") {
      return reply.code(403).send({ error: "Access denied. Super Admin privileges required." });
    }
  });
  fastify2.get("/tenants", async (request, reply) => {
    try {
      const tenants = await Tenant.find({}).sort({ createdAt: -1 });
      return reply.code(200).send(tenants);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch tenants.", details: err.message });
    }
  });
}

// src/routes/status.ts
var import_mongoose20 = require("mongoose");
function normalizeEmail2(value) {
  return String(value || "").trim().toLowerCase();
}
async function statusRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.get("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || "demo";
      const statuses = await Story.find({ workspaceId: activeWorkspaceId }).sort({ createdAt: 1 });
      const grouped = {};
      statuses.forEach((status) => {
        if (!grouped[status.userEmail]) {
          grouped[status.userEmail] = {
            userEmail: status.userEmail,
            userName: status.userName,
            avatarUrl: status.userAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(status.userName)}`,
            statuses: []
          };
        }
        grouped[status.userEmail].statuses.push({
          _id: status._id,
          mediaType: status.mediaType || "text",
          mediaUrl: status.mediaUrl,
          content: status.content,
          bgColor: status.bgColor,
          createdAt: status.createdAt,
          privacyType: status.privacyType || "everyone",
          mentions: status.mentions || [],
          views: status.views || [],
          reactions: status.reactions || []
        });
      });
      return reply.code(200).send(Object.values(grouped));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch statuses", details: err.message });
    }
  });
  fastify2.post("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || "demo";
      const { mediaType, mediaUrl, content, bgColor, privacyType = "everyone", mentions = [] } = request.body;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      const status = await Story.create({
        workspaceId: activeWorkspaceId,
        userId: request.user?.id,
        userEmail: currentEmail,
        userName: request.user?.name || currentEmail,
        userAvatar: request.user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(request.user?.name || currentEmail)}`,
        mediaType: mediaType || "text",
        mediaUrl,
        content,
        bgColor,
        privacyType,
        mentions,
        views: [],
        reactions: []
      });
      return reply.code(201).send(status);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create status", details: err.message });
    }
  });
  fastify2.post("/:id/view", async (request, reply) => {
    try {
      const { id } = request.params;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      if (!import_mongoose20.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid status id." });
      }
      const existingStatus = await Story.findById(id);
      if (!existingStatus) return reply.code(404).send({ error: "Status not found" });
      const hasViewed = existingStatus.views.some((v) => v.viewerEmail === currentEmail);
      if (!hasViewed) {
        existingStatus.views.push({ viewerEmail: currentEmail, viewedAt: /* @__PURE__ */ new Date() });
        await existingStatus.save();
      }
      return reply.code(200).send(existingStatus);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to mark status as viewed", details: err.message });
    }
  });
  fastify2.post("/:id/reaction", async (request, reply) => {
    try {
      const { id } = request.params;
      const { emoji } = request.body;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      if (!import_mongoose20.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid status id." });
      }
      const status = await Story.findByIdAndUpdate(
        id,
        { $push: { reactions: { userEmail: currentEmail, emoji, addedAt: /* @__PURE__ */ new Date() } } },
        { new: true }
      );
      if (!status) return reply.code(404).send({ error: "Status not found" });
      return reply.code(200).send(status);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to add reaction", details: err.message });
    }
  });
  fastify2.post("/:id/reply", async (request, reply) => {
    try {
      const { id } = request.params;
      const { text } = request.body;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      if (!import_mongoose20.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid status id." });
      }
      const status = await Story.findById(id);
      if (!status) return reply.code(404).send({ error: "Status not found" });
      const { Channel } = require("../models/Channel");
      const { Message } = require("../models/Message");
      let dmChannel = await Channel.findOne({
        workspaceId: status.workspaceId,
        type: "direct",
        participantEmails: { $all: [currentEmail, status.userEmail], $size: 2 }
      });
      if (!dmChannel) {
        dmChannel = await Channel.create({
          workspaceId: status.workspaceId,
          name: `DM_${Date.now()}`,
          type: "direct",
          participantEmails: [currentEmail, status.userEmail],
          createdBy: currentEmail
        });
      }
      const newMessage = await Message.create({
        channelId: dmChannel._id,
        workspaceId: status.workspaceId,
        senderId: request.user?.id,
        senderEmail: currentEmail,
        senderName: request.user?.name || currentEmail,
        content: text,
        metadata: {
          type: "status_reply",
          statusId: id,
          statusContent: status.content || status.mediaUrl
        }
      });
      return reply.code(201).send(newMessage);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to reply to status", details: err.message });
    }
  });
  fastify2.post("/mute", async (request, reply) => {
    try {
      const { mutedUserEmail } = request.body;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      const { MutedUser: MutedUser2 } = (init_MutedUser(), __toCommonJS(MutedUser_exports));
      await MutedUser2.findOneAndUpdate(
        { userEmail: currentEmail, mutedUserEmail: normalizeEmail2(mutedUserEmail) },
        { userEmail: currentEmail, mutedUserEmail: normalizeEmail2(mutedUserEmail), userId: request.user?.id },
        { upsert: true, new: true }
      );
      return reply.code(200).send({ success: true });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to mute user", details: err.message });
    }
  });
  fastify2.post("/unmute", async (request, reply) => {
    try {
      const { mutedUserEmail } = request.body;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      const { MutedUser: MutedUser2 } = (init_MutedUser(), __toCommonJS(MutedUser_exports));
      await MutedUser2.findOneAndDelete({ userEmail: currentEmail, mutedUserEmail: normalizeEmail2(mutedUserEmail) });
      return reply.code(200).send({ success: true });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to unmute user", details: err.message });
    }
  });
  fastify2.get("/muted", async (request, reply) => {
    try {
      const currentEmail = normalizeEmail2(request.user?.email || "");
      const { MutedUser: MutedUser2 } = (init_MutedUser(), __toCommonJS(MutedUser_exports));
      const muted = await MutedUser2.find({ userEmail: currentEmail });
      return reply.code(200).send(muted.map((m) => m.mutedUserEmail));
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch muted users", details: err.message });
    }
  });
  fastify2.delete("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const currentEmail = normalizeEmail2(request.user?.email || "");
      if (!import_mongoose20.Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: "Invalid status id." });
      }
      const status = await Story.findById(id);
      if (!status) return reply.code(404).send({ error: "Status not found" });
      if (status.userEmail !== currentEmail) {
        return reply.code(403).send({ error: "Not authorized to delete this status" });
      }
      await Story.findByIdAndDelete(id);
      return reply.code(200).send({ success: true });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete status", details: err.message });
    }
  });
}

// src/routes/threads.ts
var import_cloudinary2 = require("cloudinary");

// src/models/ThreadPost.ts
var import_mongoose21 = require("mongoose");
var ThreadPostSchema = new import_mongoose21.Schema({
  workspaceId: { type: String, required: true, index: true },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String },
  mediaUrls: [{
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "video", "document"], required: true },
    name: { type: String }
  }],
  likes: [{ type: String }],
  visibility: { type: String, enum: ["everyone", "team", "channel", "selected"], default: "everyone" },
  visibilityData: [{ type: String }],
  isPinned: { type: Boolean, default: false },
  isReported: { type: Boolean, default: false }
}, { timestamps: true });
var ThreadPost = (0, import_mongoose21.model)("ThreadPost", ThreadPostSchema);

// src/models/ThreadComment.ts
var import_mongoose22 = require("mongoose");
var ThreadCommentSchema = new import_mongoose22.Schema({
  postId: { type: String, required: true, index: true },
  parentCommentId: { type: String, index: true },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  likes: [{ type: String }]
}, { timestamps: true });
var ThreadComment = (0, import_mongoose22.model)("ThreadComment", ThreadCommentSchema);

// src/services/threadSockets.ts
var import_fs4 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
var activeThreadSockets = /* @__PURE__ */ new Map();
function handleThreadsSocket(socket, req) {
  const logFile = import_path3.default.join(__dirname, "../../socket_debug.log");
  const log = (msg) => {
    try {
      import_fs4.default.appendFileSync(logFile, `[${(/* @__PURE__ */ new Date()).toISOString()}] [ThreadsSocket] ${msg}
`);
    } catch (e) {
    }
  };
  let workspaceId = req.query?.workspaceId;
  if (!workspaceId && req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      workspaceId = url.searchParams.get("workspaceId") || void 0;
    } catch (e) {
      log(`Failed to parse URL: ${e.message}`);
    }
  }
  if (workspaceId) {
    log(`Established Threads Socket for workspace: ${workspaceId}`);
    if (!activeThreadSockets.has(workspaceId)) {
      activeThreadSockets.set(workspaceId, /* @__PURE__ */ new Set());
    }
    activeThreadSockets.get(workspaceId)?.add(socket);
    socket.on("close", () => {
      log(`Threads Socket closed for workspace: ${workspaceId}`);
      activeThreadSockets.get(workspaceId)?.delete(socket);
      if (activeThreadSockets.get(workspaceId)?.size === 0) {
        activeThreadSockets.delete(workspaceId);
      }
    });
    socket.on("error", (err) => {
      log(`Threads Socket error for workspace ${workspaceId}: ${err.message}`);
      activeThreadSockets.get(workspaceId)?.delete(socket);
    });
  } else {
    log(`Closing socket: workspaceId missing`);
    socket.close(1008, "workspaceId required");
  }
}
function broadcastToWorkspace(workspaceId, eventType, payload) {
  const sockets = activeThreadSockets.get(workspaceId);
  if (!sockets) return;
  const message = JSON.stringify({ type: eventType, payload });
  Array.from(sockets).forEach((socket) => {
    if (socket.readyState === 1) {
      socket.send(message);
    }
  });
}

// src/routes/threads.ts
var cloudinaryFolder2 = process.env.CLOUDINARY_FOLDER || "chat_uploads";
var cloudinaryCloudName2 = process.env.CLOUDINARY_CLOUD_NAME || "";
var cloudinaryApiKey2 = process.env.CLOUDINARY_API_KEY || "";
var cloudinaryApiSecret2 = process.env.CLOUDINARY_API_SECRET || "";
import_cloudinary2.v2.config({
  cloud_name: cloudinaryCloudName2,
  api_key: cloudinaryApiKey2,
  api_secret: cloudinaryApiSecret2
});
function normalizeEmail3(value) {
  return String(value || "").trim().toLowerCase();
}
async function resolveMultipartFile2(request) {
  try {
    const direct = await request.file();
    if (direct) return direct;
  } catch {
  }
  const bodyFile = request.body?.file;
  if (bodyFile?.file) return bodyFile;
  return null;
}
async function streamToBuffer2(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function uploadToCloudinary2(file) {
  if (!cloudinaryCloudName2 || !cloudinaryApiKey2 || !cloudinaryApiSecret2) {
    throw new Error("Cloudinary config missing");
  }
  const mimetype = file?.mimetype || "application/octet-stream";
  const resourceType = String(mimetype).startsWith("video/") ? "video" : "auto";
  const uploadOptions = {
    folder: cloudinaryFolder2,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false
  };
  const payload = typeof file?.toBuffer === "function" ? await file.toBuffer() : file?.file ? await streamToBuffer2(file.file) : Buffer.alloc(0);
  if (!payload.length) throw new Error("Uploaded file is empty or unreadable.");
  return new Promise((resolve, reject) => {
    const uploadStream = import_cloudinary2.v2.uploader.upload_stream(uploadOptions, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error("Cloudinary upload returned no result."));
      resolve(uploaded);
    });
    uploadStream.end(payload);
  });
}
function resolveUploadName2(file, uploaded) {
  const explicit = String(file?.filename || "").trim();
  if (explicit) return explicit;
  const fromCloudinary = String(uploaded?.original_filename || "").trim();
  if (fromCloudinary) {
    const fmt = String(uploaded?.format || "").trim();
    return fmt ? `${fromCloudinary}.${fmt}` : fromCloudinary;
  }
  return `upload.file`;
}
async function threadsRoutes(fastify2) {
  fastify2.addHook("preValidation", authenticate);
  fastify2.post("/upload", async (request, reply) => {
    try {
      const file = await resolveMultipartFile2(request);
      if (!file) return reply.code(400).send({ error: "Missing file upload." });
      const result = await uploadToCloudinary2(file);
      const type = file.mimetype?.startsWith("video/") ? "video" : file.mimetype?.startsWith("image/") ? "image" : "document";
      return reply.code(200).send({
        url: result.secure_url || result.url,
        type,
        name: resolveUploadName2(file, result)
      });
    } catch (err) {
      return reply.code(500).send({ error: "Upload failed", details: err.message });
    }
  });
  fastify2.get("/:workspaceId", async (request, reply) => {
    try {
      const { workspaceId } = request.params;
      const { limit = 20, cursor } = request.query;
      const query = { workspaceId };
      if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
      }
      const posts = await ThreadPost.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean();
      const postIds = posts.map((p) => p._id);
      const comments = await ThreadComment.find({ postId: { $in: postIds } }).sort({ createdAt: 1 }).lean();
      const commentsByPostId = comments.reduce((acc, c) => {
        const pId = c.postId.toString();
        if (!acc[pId]) acc[pId] = [];
        acc[pId].push(c);
        return acc;
      }, {});
      const result = posts.map((post) => ({
        ...post,
        comments: commentsByPostId[post._id.toString()] || []
      }));
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to fetch feed", details: err.message });
    }
  });
  fastify2.post("/create", async (request, reply) => {
    try {
      const { workspaceId, content, mediaUrls = [], visibility = "everyone", visibilityData = [] } = request.body;
      const currentEmail = normalizeEmail3(request.user?.email || "");
      const currentName = request.user?.name || currentEmail;
      if (!workspaceId || !content) return reply.code(400).send({ error: "workspaceId and content required" });
      const post = await ThreadPost.create({
        workspaceId,
        authorEmail: currentEmail,
        authorName: currentName,
        content,
        mediaUrls,
        visibility,
        visibilityData
      });
      broadcastToWorkspace(workspaceId, "NEW_POST", post);
      return reply.code(201).send(post);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create post", details: err.message });
    }
  });
  fastify2.post("/:id/like", async (request, reply) => {
    try {
      const { id } = request.params;
      const currentEmail = normalizeEmail3(request.user?.email || "");
      const post = await ThreadPost.findById(id);
      if (!post) return reply.code(404).send({ error: "Post not found" });
      const hasLiked = post.likes.includes(currentEmail);
      if (hasLiked) {
        post.likes = post.likes.filter((e) => e !== currentEmail);
      } else {
        post.likes.push(currentEmail);
      }
      await post.save();
      broadcastToWorkspace(post.workspaceId, "POST_LIKED", { postId: id, likes: post.likes });
      return reply.code(200).send({ likes: post.likes });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to toggle like", details: err.message });
    }
  });
  fastify2.delete("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const currentEmail = normalizeEmail3(request.user?.email || "");
      const post = await ThreadPost.findById(id);
      if (!post) return reply.code(404).send({ error: "Post not found" });
      if (post.authorEmail !== currentEmail && request.user?.role !== "Admin") {
        return reply.code(403).send({ error: "Not authorized" });
      }
      await ThreadComment.deleteMany({ postId: id });
      await ThreadPost.findByIdAndDelete(id);
      broadcastToWorkspace(post.workspaceId, "POST_DELETED", { postId: id });
      return reply.code(200).send({ message: "Deleted" });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete post", details: err.message });
    }
  });
  fastify2.post("/:id/comment", async (request, reply) => {
    try {
      const { id } = request.params;
      const { content, parentCommentId } = request.body;
      const currentEmail = normalizeEmail3(request.user?.email || "");
      const currentName = request.user?.name || currentEmail;
      if (!content) return reply.code(400).send({ error: "content required" });
      const post = await ThreadPost.findById(id);
      if (!post) return reply.code(404).send({ error: "Post not found" });
      const comment = await ThreadComment.create({
        postId: id,
        parentCommentId,
        authorEmail: currentEmail,
        authorName: currentName,
        content
      });
      broadcastToWorkspace(post.workspaceId, "NEW_COMMENT", comment);
      return reply.code(201).send(comment);
    } catch (err) {
      return reply.code(500).send({ error: "Failed to create comment", details: err.message });
    }
  });
  fastify2.post("/comment/:commentId/like", async (request, reply) => {
    try {
      const { commentId } = request.params;
      const currentEmail = normalizeEmail3(request.user?.email || "");
      const comment = await ThreadComment.findById(commentId);
      if (!comment) return reply.code(404).send({ error: "Comment not found" });
      const post = await ThreadPost.findById(comment.postId);
      if (!post) return reply.code(404).send({ error: "Post not found" });
      const hasLiked = comment.likes.includes(currentEmail);
      if (hasLiked) {
        comment.likes = comment.likes.filter((e) => e !== currentEmail);
      } else {
        comment.likes.push(currentEmail);
      }
      await comment.save();
      broadcastToWorkspace(post.workspaceId, "COMMENT_LIKED", { commentId, likes: comment.likes, postId: comment.postId });
      return reply.code(200).send({ likes: comment.likes });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to toggle like", details: err.message });
    }
  });
  fastify2.delete("/comment/:commentId", async (request, reply) => {
    try {
      const { commentId } = request.params;
      const currentEmail = normalizeEmail3(request.user?.email || "");
      const comment = await ThreadComment.findById(commentId);
      if (!comment) return reply.code(404).send({ error: "Comment not found" });
      if (comment.authorEmail !== currentEmail && request.user?.role !== "Admin") {
        return reply.code(403).send({ error: "Not authorized" });
      }
      const post = await ThreadPost.findById(comment.postId);
      await ThreadComment.deleteMany({ $or: [{ _id: commentId }, { parentCommentId: commentId }] });
      if (post) broadcastToWorkspace(post.workspaceId, "COMMENT_DELETED", { commentId, postId: comment.postId });
      return reply.code(200).send({ message: "Deleted" });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to delete comment", details: err.message });
    }
  });
  fastify2.post("/poster", async (request, reply) => {
    try {
      const { prompt } = request.body;
      const geminiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "Gemini error");
      return reply.code(200).send({ svg: data.candidates?.[0]?.content?.parts?.[0]?.text || "" });
    } catch (err) {
      return reply.code(500).send({ error: "Failed to generate poster", details: err.message });
    }
  });
}

// src/services/webrtc.ts
var import_ws2 = require("ws");
var import_jsonwebtoken4 = __toESM(require("jsonwebtoken"));
var import_mongoose23 = require("mongoose");
var JWT_SECRET2 = process.env.JWT_SECRET || "nexus-jwt-secret-key";
var rooms = /* @__PURE__ */ new Map();
function send(ws, payload) {
  if (ws.readyState === import_ws2.WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}
function broadcastToRoom(meetingId, excludePeerId, payload) {
  const room = rooms.get(meetingId);
  if (!room) return;
  const raw = JSON.stringify(payload);
  for (const [pid, peer] of room.entries()) {
    if (pid !== excludePeerId && peer.socket.readyState === import_ws2.WebSocket.OPEN) {
      peer.socket.send(raw);
    }
  }
}
function handleWebRtcSignalling(ws) {
  let peerId = null;
  let meetingId = null;
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const { type, data = {} } = msg;
    if (type === "join") {
      const roomKey = data.meetingId || data.roomId;
      const { token } = data;
      if (!token || !roomKey) {
        return send(ws, { type: "error", message: "token and meetingId (or roomId) required" });
      }
      let decoded;
      try {
        decoded = import_jsonwebtoken4.default.verify(token, JWT_SECRET2);
      } catch {
        return send(ws, { type: "error", message: "Invalid token" });
      }
      const userId = decoded.userId || decoded.id;
      const user = await User.findById(userId).catch(() => null);
      if (!user) return send(ws, { type: "error", message: "User not found" });
      const baseUserId = user._id.toString();
      peerId = `${baseUserId}_${Math.random().toString(36).substring(2, 10)}`;
      meetingId = String(roomKey);
      if (!rooms.has(meetingId)) rooms.set(meetingId, /* @__PURE__ */ new Map());
      const room = rooms.get(meetingId);
      if (room.has(peerId)) {
        const oldPeer = room.get(peerId);
        try {
          oldPeer.socket.terminate();
        } catch (e) {
        }
      }
      room.set(peerId, {
        socket: ws,
        userId: baseUserId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isAlive: true,
        joinedAt: /* @__PURE__ */ new Date()
      });
      await Participant.findOneAndUpdate(
        { meetingId, userId: baseUserId },
        { joinedAt: /* @__PURE__ */ new Date(), $unset: { leftAt: "" } },
        { upsert: true }
      ).catch(() => {
      });
      const existingPeers = Array.from(room.entries()).filter(([pid]) => pid !== peerId).map(([pid, p]) => ({
        peerId: pid,
        userId: p.userId,
        name: p.name,
        avatarUrl: p.avatarUrl
      }));
      send(ws, { type: "joined", peerId, existingPeers });
      broadcastToRoom(meetingId, peerId, {
        type: "peer-joined",
        peerId,
        userId: baseUserId,
        name: user.name,
        avatarUrl: user.avatarUrl
      });
      return;
    }
    if (!peerId || !meetingId) {
      return send(ws, { type: "error", message: "Not joined. Send join first." });
    }
    if (type === "offer") {
      const { targetPeerId, sdp, isScreenShare, screenTrackId, screenMid, screenStreamId } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "offer", fromPeerId: peerId, sdp, isScreenShare, screenTrackId, screenMid, screenStreamId });
      }
      return;
    }
    if (type === "answer") {
      const { targetPeerId, sdp } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "answer", fromPeerId: peerId, sdp });
      }
      return;
    }
    if (type === "ice-candidate") {
      const { targetPeerId, candidate } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "ice-candidate", fromPeerId: peerId, candidate });
      }
      return;
    }
    if (type === "media-state") {
      const { audioEnabled, videoEnabled, isScreenSharing } = data;
      broadcastToRoom(meetingId, peerId, {
        type: "peer-media-state",
        fromPeerId: peerId,
        peerId,
        audioEnabled,
        videoEnabled,
        isScreenSharing
      });
      return;
    }
    if (type === "chat-message") {
      broadcastToRoom(meetingId, peerId, {
        type: "chat-message",
        fromPeerId: peerId,
        ...data
      });
      return;
    }
    if (type === "end-meeting-all") {
      broadcastToRoom(meetingId, peerId, { type: "meeting-ended" });
      const query = import_mongoose23.Types.ObjectId.isValid(meetingId) ? { _id: meetingId } : { joinCode: meetingId };
      Meeting.updateOne(query, { status: "ended" }).catch((err) => console.error("[WebRTC] Failed to update meeting status:", err));
      return;
    }
    if (type === "kick-peer") {
      const { targetPeerId } = data;
      const target = rooms.get(meetingId)?.get(targetPeerId);
      if (target) {
        send(target.socket, { type: "kicked" });
      }
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
      const room = rooms.get(meetingId);
      if (room && room.get(peerId)?.socket === ws) {
        await cleanupPeer(meetingId, peerId);
      }
    }
  });
  ws.on("error", () => {
    if (meetingId && peerId) {
      const room = rooms.get(meetingId);
      if (room && room.get(peerId)?.socket === ws) {
        cleanupPeer(meetingId, peerId).catch(() => {
        });
      }
    }
  });
}
async function cleanupPeer(roomId, pid) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(pid);
  if (room.size === 0) rooms.delete(roomId);
  broadcastToRoom(roomId, pid, { type: "peer-left", peerId: pid });
  const baseUserId = pid.split("_")[0];
  try {
    let meetingQuery = { _id: roomId };
    if (!import_mongoose23.Types.ObjectId.isValid(roomId)) {
      meetingQuery = { joinCode: roomId };
    }
    const meeting = await Meeting.findOne(meetingQuery);
    if (!meeting) return;
    await Participant.findOneAndUpdate(
      { meetingId: meeting._id, userId: baseUserId, leftAt: { $exists: false } },
      { leftAt: /* @__PURE__ */ new Date() }
    );
    const aiBotUser = await User.findOne({ email: "ai-assistant@nexus.app" });
    const query = {
      meetingId: meeting._id,
      leftAt: { $exists: false }
    };
    if (aiBotUser) {
      query.userId = { $ne: aiBotUser._id };
    }
    const activeParticipantCount = await Participant.countDocuments(query);
    if (activeParticipantCount === 0 && meeting.status !== "ended") {
      meeting.status = "ended";
      await meeting.save();
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (meeting.aiEnabled) {
        await stopAIBot(meeting._id.toString());
      } else {
        summarizeMeeting(meeting._id.toString()).catch((err) => {
          console.warn("[WebRTC] Summary generation failed:", err.message);
        });
      }
    }
  } catch (e) {
    console.error("[WebRTC] cleanupPeer DB update error:", e);
  }
}
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    for (const [peerId, peer] of room.entries()) {
      const ws = peer.socket;
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch (e) {
        }
        cleanupPeer(roomId, peerId);
        continue;
      }
      ws.isAlive = false;
      try {
        peer.socket.ping();
      } catch (e) {
      }
    }
  }
}, 3e4);

// src/services/callSignaling.ts
var import_ws3 = require("ws");
var import_jsonwebtoken5 = __toESM(require("jsonwebtoken"));
var JWT_SECRET3 = process.env.JWT_SECRET || "nexus-jwt-secure-key-change-in-production";
var onlineUsers = /* @__PURE__ */ new Map();
function send2(ws, payload) {
  if (ws.readyState === import_ws3.WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}
function handleCallSignaling(ws) {
  let registeredEmail = null;
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const { type, data = {} } = msg;
    if (type === "register") {
      const { token } = data;
      if (!token) return send2(ws, { type: "error", message: "token required" });
      let decoded;
      try {
        decoded = import_jsonwebtoken5.default.verify(token, JWT_SECRET3);
      } catch {
        return send2(ws, { type: "error", message: "invalid token" });
      }
      const email = (decoded.email || "").toLowerCase().trim();
      if (!email) return send2(ws, { type: "error", message: "email missing from token" });
      const existing = onlineUsers.get(email);
      if (existing && existing !== ws && existing.readyState === import_ws3.WebSocket.OPEN) {
        try {
          existing.close();
        } catch {
        }
      }
      registeredEmail = email;
      onlineUsers.set(email, ws);
      console.log(`[CallSignaling] User registered: ${email}`);
      send2(ws, { type: "registered", email });
      return;
    }
    if (!registeredEmail) {
      return send2(ws, { type: "error", message: "not registered, send register first" });
    }
    if (type === "call_user") {
      const { targetEmail, offer, callerName } = data;
      if (!targetEmail || !offer) {
        return send2(ws, { type: "error", message: "targetEmail and offer required" });
      }
      const normalizedTarget = targetEmail.toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (!targetWs || targetWs.readyState !== import_ws3.WebSocket.OPEN) {
        console.log(`[CallSignaling] Target ${normalizedTarget} is offline/unavailable`);
        return send2(ws, { type: "call_unavailable", targetEmail: normalizedTarget });
      }
      console.log(`[CallSignaling] Relaying call from ${registeredEmail} to ${normalizedTarget}`);
      send2(targetWs, {
        type: "incoming_call",
        callerEmail: registeredEmail,
        callerName: callerName || registeredEmail,
        offer
      });
      return;
    }
    if (type === "call_answer") {
      const { targetEmail, answer } = data;
      if (!targetEmail || !answer) return;
      const normalizedTarget = targetEmail.toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        console.log(`[CallSignaling] Relaying answer from ${registeredEmail} to ${normalizedTarget}`);
        send2(targetWs, {
          type: "call_answered",
          calleeEmail: registeredEmail,
          answer
        });
      }
      return;
    }
    if (type === "call_declined") {
      const { targetEmail } = data;
      const normalizedTarget = (targetEmail || "").toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        console.log(`[CallSignaling] Call declined from ${registeredEmail} to ${normalizedTarget}`);
        send2(targetWs, { type: "call_declined", calleeEmail: registeredEmail });
      }
      return;
    }
    if (type === "call_ended") {
      const { targetEmail } = data;
      const normalizedTarget = (targetEmail || "").toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        console.log(`[CallSignaling] Call ended from ${registeredEmail} to ${normalizedTarget}`);
        send2(targetWs, { type: "call_ended" });
      }
      return;
    }
    if (type === "ice_candidate") {
      const { targetEmail, candidate } = data;
      if (!targetEmail || !candidate) return;
      const normalizedTarget = targetEmail.toLowerCase().trim();
      const targetWs = onlineUsers.get(normalizedTarget);
      if (targetWs) {
        send2(targetWs, { type: "ice_candidate", fromEmail: registeredEmail, candidate });
      }
      return;
    }
  });
  ws.on("close", () => {
    if (registeredEmail) {
      if (onlineUsers.get(registeredEmail) === ws) {
        onlineUsers.delete(registeredEmail);
        console.log(`[CallSignaling] User disconnected: ${registeredEmail}`);
      }
    }
  });
  ws.on("error", () => {
    if (registeredEmail && onlineUsers.get(registeredEmail) === ws) {
      onlineUsers.delete(registeredEmail);
      console.log(`[CallSignaling] Error on connection: ${registeredEmail}`);
    }
  });
}

// src/index.ts
init_mailSockets();

// src/utils/seedDefaultUser.ts
var import_bcrypt5 = __toESM(require("bcrypt"));
var DEFAULT_EMAIL = "admin@fic.com";
var DEFAULT_PASSWORD = "password123";
async function ensureDefaultUser() {
  const salt = await import_bcrypt5.default.genSalt(12);
  const existing = await User.findOne({ email: DEFAULT_EMAIL });
  if (!existing) {
    const passwordHash = await import_bcrypt5.default.hash(DEFAULT_PASSWORD, salt);
    await User.create({
      name: "Forge India Administrator",
      email: DEFAULT_EMAIL,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent("Forge India Administrator")}`,
      mfaEnabled: false,
      role: "company-admin",
      workspaceId: "antigraviity-hq"
    });
  } else if (existing.name === "Nexus Administrator") {
    existing.name = "Forge India Administrator";
    existing.avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent("Forge India Administrator")}`;
    await existing.save();
  }
  const AI_EMAIL = "ai-assistant@nexus.app";
  const aiExisting = await User.findOne({ email: AI_EMAIL });
  if (!aiExisting) {
    const aiPasswordHash = await import_bcrypt5.default.hash("AI_SECURE_PASSWORD_123!@#", salt);
    await User.create({
      name: "Forge India Connect AI",
      email: AI_EMAIL,
      passwordHash: aiPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=forgeai`,
      mfaEnabled: false,
      role: "company-admin",
      workspaceId: "antigraviity-hq"
    });
  } else if (aiExisting.name !== "Forge India Connect AI") {
    aiExisting.name = "Forge India Connect AI";
    aiExisting.avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=forgeai`;
    await aiExisting.save();
  }
  const SUPERADMIN_EMAIL = "superadmin@fic.com";
  const superAdminExisting = await User.findOne({ email: SUPERADMIN_EMAIL });
  if (!superAdminExisting) {
    const saPasswordHash = await import_bcrypt5.default.hash("password123", salt);
    await User.create({
      name: "Super Admin",
      email: SUPERADMIN_EMAIL,
      passwordHash: saPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=SA`,
      mfaEnabled: false,
      role: "super-admin",
      workspaceId: "fic-superadmin"
    });
  }
  const DEMO_EMAIL = "demo@fic.com";
  const demoExisting = await User.findOne({ email: DEMO_EMAIL });
  if (!demoExisting) {
    const demoPasswordHash = await import_bcrypt5.default.hash("password123", salt);
    await User.create({
      name: "Demo User",
      email: DEMO_EMAIL,
      passwordHash: demoPasswordHash,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=Demo`,
      mfaEnabled: false,
      role: "Member",
      workspaceId: "demo-ws"
    });
  }
}

// src/index.ts
import_dotenv2.default.config({ path: import_path4.default.join(__dirname, "../.env") });
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
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "x-speaker-name"]
  });
  server.addHook("onRequest", async (request, reply) => {
    if (!ENABLE_SOCKET_FILE_LOGS) return;
    try {
      const logFile = import_path4.default.join(__dirname, "../../socket_debug.log");
      import_fs5.default.appendFileSync(logFile, `[${(/* @__PURE__ */ new Date()).toISOString()}] [onRequest Hook] URL: "${request.url}", Method: "${request.method}", IP: "${request.ip}", Headers: ${JSON.stringify(request.headers)}
`);
    } catch (e) {
      console.error("Failed to write to socket_debug.log inside onRequest hook:", e);
    }
  });
  server.addHook("onResponse", async (request, reply) => {
    if (!ENABLE_SOCKET_FILE_LOGS) return;
    try {
      const logFile = import_path4.default.join(__dirname, "../../socket_debug.log");
      const entry = `[${(/* @__PURE__ */ new Date()).toISOString()}] [onResponse Hook] URL: "${request.url}", Method: "${request.method}", Status: "${reply.statusCode}", ResponseTimeMs: "${reply.getResponseTime ? reply.getResponseTime() : "n/a"}"
`;
      import_fs5.default.appendFileSync(logFile, entry);
    } catch (e) {
      console.error("Failed to write to socket_debug.log inside onResponse hook:", e);
    }
  });
  await server.register(import_websocket.default);
  await server.register(import_multipart.default, {
    attachFieldsToBody: true,
    limits: {
      fileSize: 250 * 1024 * 1024,
      files: 1
    }
  });
  server.addContentTypeParser("audio/m4a", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  server.addContentTypeParser("audio/webm", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  server.addContentTypeParser("audio/mp4", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  server.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  await server.register(authRoutes, { prefix: "/api/auth" });
  await server.register(meetingRoutes, { prefix: "/api/meetings" });
  await server.register(mailRoutes, { prefix: "/api/mail" });
  await server.register(channelRoutes, { prefix: "/api/channels" });
  await server.register(kuralRoutes, { prefix: "/api/chat" });
  await server.register(memberRoutes, { prefix: "/api/members" });
  await server.register(taskRoutes, { prefix: "/api/tasks" });
  await server.register(docsRoutes, { prefix: "/api/docs" });
  await server.register(showRoutes, { prefix: "/api/show" });
  await server.register(superadminRoutes, { prefix: "/api/superadmin" });
  await server.register(statusRoutes, { prefix: "/api/status" });
  await server.register(threadsRoutes, { prefix: "/api/threads" });
  server.get("/api/meet/ice-servers", async () => {
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      {
        urls: "turn:free.expressturn.com:3478",
        username: "000000002097290800",
        credential: "XnOg5DVFwGY/30tgW+PnfhmXv0c="
      }
    ];
  });
  server.get("/ws/webrtc", { websocket: true }, (connection, req) => {
    server.log.info("New secure WebRTC client socket handshake initiated.");
    const ws = connection.socket || connection;
    handleWebRtcSignalling(ws);
  });
  server.get("/ws/mail", { websocket: true }, (connection, req) => {
    server.log.info("New secure Mail Socket connection initiated.");
    const ws = connection.socket || connection;
    handleMailSocket(ws, req);
  });
  server.get("/ws/audio", { websocket: true }, (connection, req) => {
    const ws = connection.socket || connection;
    handleAudioSocket(ws);
  });
  server.get("/ws/threads", { websocket: true }, (connection, req) => {
    const ws = connection.socket || connection;
    handleThreadsSocket(ws, req);
  });
  server.get("/ws/calls", { websocket: true }, (connection, req) => {
    server.log.info("New voice call signaling connection.");
    const ws = connection.socket || connection;
    handleCallSignaling(ws);
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
    console.log(` NEXUS ZOOM MEETINGS BACKEND SERVER RUNNING LIVE!`);
    console.log(` REST API Root : http://localhost:${PORT}/api`);
    console.log(` WebRTC Socket : ws://localhost:${PORT}/ws/webrtc`);
    console.log(` Health Status : http://localhost:${PORT}/health`);
    console.log(`======================================================
`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
bootstrap();
//# sourceMappingURL=index.js.map
