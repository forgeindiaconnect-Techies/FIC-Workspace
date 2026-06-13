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
  joinCode: { type: String, index: true },
  passcode: { type: String },
  passcodeHash: { type: String },
  durationMinutes: { type: Number, default: 60 },
  scheduledAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['scheduled', 'live', 'completed', 'ended'], default: 'scheduled' },
  recordingEnabled: { type: Boolean, default: true },
  aiEnabled: { type: Boolean, default: false },
  participants: [{
    userId: String,
    name: String,
    email: String,
    joinedAt: Date,
    leftAt: Date
  }],
  participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
  type: { type: String, default: 'Doc' },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: String }, // Email
  updatedBy: { type: String }, // Email
  isPublic: { type: Boolean, default: false }, // Access control
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
export const Doc = mongoose.models.Doc || mongoose.model('Doc', DocSchema);

// ─── TRANSCRIPT SCHEMA ───
const TranscriptSchema = new mongoose.Schema({
  meetingId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  speakerName: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
export const Transcript = mongoose.models.Transcript || mongoose.model('Transcript', TranscriptSchema);

// ─── THREAD POST SCHEMA ───
const ThreadPostSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  mediaUrls: [{
    url: String,
    type: { type: String, enum: ['image', 'video', 'document'] },
    name: String
  }],
  visibility: { type: String, enum: ['everyone', 'specific', 'channels'], default: 'everyone' },
  visibilityData: [String],
  likes: [{ type: String }], // Array of emails who liked it
  createdAt: { type: Date, default: Date.now }
});
export const ThreadPost = mongoose.models.ThreadPost || mongoose.model('ThreadPost', ThreadPostSchema);

// ─── THREAD COMMENT SCHEMA ───
const ThreadCommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ThreadPost' },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ThreadComment', default: null },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  likes: [{ type: String }], // Array of emails who liked it
  createdAt: { type: Date, default: Date.now }
});
export const ThreadComment = mongoose.models.ThreadComment || mongoose.model('ThreadComment', ThreadCommentSchema);

// ─── PROJECT SCHEMA ───
const ProjectSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '📁' },
  color: { type: String, default: '#2170E4' },
  status: { type: String, enum: ['active', 'archived', 'completed', 'on_hold'], default: 'active' },
  createdBy: { type: String, required: true },
  createdByName: { type: String },
  tags: [{ type: String }],
  gitRepos: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    branch: { type: String, default: 'main' },
    provider: { type: String, enum: ['github', 'gitlab', 'bitbucket', 'other'], default: 'github' },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  deployments: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    environment: { type: String, enum: ['production', 'staging', 'development', 'preview'], default: 'production' },
    provider: { type: String, default: '' },
    status: { type: String, enum: ['live', 'down', 'deploying', 'unknown'], default: 'live' },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  documentation: [{
    title: { type: String, required: true },
    url: { type: String },
    content: { type: String },
    type: { type: String, enum: ['link', 'markdown', 'file'], default: 'link' },
    fileUrl: { type: String },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  workflows: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    steps: [{ type: String }],
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  credentials: [{
    label: { type: String, required: true },
    username: { type: String, default: '' },
    value: { type: String, required: true },
    environment: { type: String, enum: ['production', 'staging', 'development', 'shared'], default: 'shared' },
    notes: { type: String, default: '' },
    addedBy: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
export const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
