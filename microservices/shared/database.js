import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexus-zoom';

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[Database] Connected successfully to MongoDB:', MONGO_URI.split('@').pop());
  } catch (err) {
    console.error('[Database] MongoDB connection error:', err);
    throw err;
  }
}

// ─── USER SCHEMA ───
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  password: { type: String }, // compatibility fallback
  workspaceId: { type: String },
  role: { type: String, default: 'Member' },
  avatarUrl: { type: String },
  googleId: { type: String },
  appleId: { type: String },
  mfaSecret: { type: String },
  mfaEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ─── TENANT SCHEMA ───
const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  organisationName: { type: String, unique: true },
  workspaceId: { type: String, required: true, unique: true, index: true },
  domain: { type: String, required: true, unique: true },
  adminEmail: { type: String, required: true },
  password: { type: String },
  subscriptionTier: { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' },
  maxUsers: { type: Number, default: 20 },
  paymentStatus: { type: String, enum: ['active', 'past_due', 'canceled'], default: 'active' },
  subscriptionExpiryDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
export const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);

// ─── REFRESH TOKEN ───
const RefreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  token: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});
export const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);

// ─── MAIL SCHEMA ───
const MailSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, default: 'demo' },
  ownerEmail: { type: String, required: true },
  folder: { type: String, enum: ['inbox', 'sent', 'drafts', 'trash', 'archive'], default: 'inbox' },
  senderName: { type: String, required: true },
  senderEmail: { type: String, required: true },
  recipientEmails: [{ type: String, required: true }],
  subject: { type: String, default: '(No Subject)' },
  body: { type: String, default: '' },
  attachments: [{
    name: { type: String },
    url: { type: String },
    size: { type: Number },
    fileType: { type: String }
  }],
  isRead: { type: Boolean, default: false },
  isStarred: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
export const Mail = mongoose.models.Mail || mongoose.model('Mail', MailSchema);

// ─── MEETING SCHEMA ───
const MeetingSchema = new mongoose.Schema({
  meetingId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  hostId: { type: String, required: true },
  hostName: { type: String, required: true },
  hostEmail: { type: String, required: true },
  workspaceId: { type: String, required: true },
  passcode: { type: String },
  durationMinutes: { type: Number, default: 60 },
  scheduledAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['scheduled', 'live', 'completed'], default: 'scheduled' },
  recordingEnabled: { type: Boolean, default: true },
  participants: [{
    userId: String,
    name: String,
    email: String,
    joinedAt: Date,
    leftAt: Date
  }],
  aiSummary: {
    keyPoints: [String],
    actionItems: [String],
    sentiment: String,
    summaryMarkdown: String,
    createdAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});
export const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema);

// ─── CHAT CONVERSATION SCHEMA ───
const KuralConversationSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  name: { type: String }, // Optional channel name
  isGroup: { type: Boolean, default: false },
  members: [{ type: String }], // email addresses
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});
export const KuralConversation = mongoose.models.KuralConversation || mongoose.model('KuralConversation', KuralConversationSchema);

// ─── CHAT MESSAGE SCHEMA ───
const KuralMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'KuralConversation' },
  senderEmail: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String },
  fileUrl: { type: String },
  fileType: { type: String },
  originalName: { type: String },
  sentAt: { type: Date, default: Date.now }
});
export const KuralMessage = mongoose.models.KuralMessage || mongoose.model('KuralMessage', KuralMessageSchema);

// ─── STATUS SCHEMA (DISAPPEARING STORIES) ───
const KuralStatusSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  avatarUrl: { type: String },
  mediaType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  mediaUrl: { type: String },
  content: { type: String }, // Caption for media or text for text-status
  bgColor: { type: String }, // Used for text status background
  views: [{ type: String }], // Array of emails who viewed it
  createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL 24 hours
});
export const KuralStatus = mongoose.models.KuralStatus || mongoose.model('KuralStatus', KuralStatusSchema);


// ─── TASK SCHEMA ───
const TaskSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  assignee: { type: String }, // Email
  dueDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
export const Task = mongoose.models.Task || mongoose.model('Task', TaskSchema);

// ─── DOC SCHEMA ───
const DocSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  title: { type: String, required: true, default: 'Untitled Document' },
  content: { type: String, default: '' },
  createdBy: { type: String }, // Email
  updatedBy: { type: String }, // Email
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
export const Doc = mongoose.models.Doc || mongoose.model('Doc', DocSchema);
