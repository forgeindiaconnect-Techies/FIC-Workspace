import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { connectMongo, User, KuralConversation, KuralMessage, KuralStatus, Task, Doc } from '../shared/database.js';
import { authenticate } from '../shared/auth.js';
import { uploadToCloudinary, resolveUploadName } from '../shared/cloudinary.js';

const app = express();
app.use(express.json());

// Multer middleware — stores file in memory buffer for Cloudinary upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max

// Database connection check middleware
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database service unavailable' });
  }
});

// Enforce authentication on all routes
app.use(authenticate);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function initials(name) {
  return (name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'U';
}

async function ensureDirectConversation(workspaceId, currentEmail, peerEmail) {
  const participants = [currentEmail, peerEmail].map(normalizeEmail).sort();
  let conversation = await KuralConversation.findOne({
    workspaceId,
    isGroup: false,
    members: { $all: participants, $size: 2 }
  });

  if (!conversation) {
    conversation = await KuralConversation.create({
      workspaceId,
      isGroup: false,
      members: participants,
      createdBy: currentEmail
    });
  }

  return conversation;
}

// ─── FILE UPLOAD TO CLOUDINARY ───
app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file upload.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    const originalName = resolveUploadName(req.file, result);

    res.json({
      url: result.secure_url || result.url,
      type: req.file.mimetype || 'application/octet-stream',
      originalName,
      publicId: result.public_id,
      size: req.file.size
    });
  } catch (err) {
    console.error('[Chat Upload Error]:', err.message);
    res.status(500).json({ error: 'File upload failed.', details: err.message });
  }
});

// ─── CHANNELS / DM ROUTER ───
app.get('/api/channels/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const currentEmail = normalizeEmail(req.query.email || req.user.email);
    const activeWorkspaceId = workspaceId || req.user.workspaceId;

    if (!currentEmail) {
      return res.status(400).json({ error: 'Current user email is required.' });
    }

    const members = await User.find({
      workspaceId: activeWorkspaceId,
      email: { $ne: currentEmail }
    }).select('name email role avatarUrl workspaceId createdAt');

    const channelsMap = new Map();

    for (const member of members) {
      const conversation = await ensureDirectConversation(activeWorkspaceId, currentEmail, member.email);
      channelsMap.set(conversation._id.toString(), {
        _id: conversation._id,
        isGroup: false,
        displayName: member.name,
        name: member.name,
        email: member.email,
        avatar: initials(member.name),
        role: member.role || 'Member',
        workspaceId: activeWorkspaceId,
        isOnline: true,
        lastMessageContent: 'Start a secure Kural conversation',
        lastMessageTime: conversation.createdAt
      });
    }

    const channels = Array.from(channelsMap.values());
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Kural channels.', details: err.message });
  }
});

// Groups List
app.get('/api/channels/:workspaceId/groups', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const currentEmail = normalizeEmail(req.query.email || req.user.email);
    const activeWorkspaceId = workspaceId || req.user.workspaceId;

    const groups = await KuralConversation.find({
      workspaceId: activeWorkspaceId,
      isGroup: true,
      members: currentEmail
    }).sort({ createdAt: -1 });

    res.json(groups.map(g => ({
      _id: g._id,
      isGroup: true,
      name: g.name,
      displayName: g.name,
      members: g.members,
      lastMessageContent: 'Start a group discussion',
      lastMessageTime: g.createdAt,
      unread: 0,
      isOnline: true
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups.', details: err.message });
  }
});

// ─── CHAT MESSAGES ───
app.get('/api/chat/:workspaceId/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid Kural channel id.' });
    }

    const currentEmail = normalizeEmail(req.user.email);
    const conversation = await KuralConversation.findOne({
      _id: channelId,
      members: currentEmail
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Kural conversation not found.' });
    }

    const messages = await KuralMessage.find({ conversationId: conversation._id })
      .sort({ sentAt: 1 })
      .limit(100);

    res.json(messages.map((message) => ({
      _id: message._id,
      conversationId: message.conversationId,
      sender: message.senderEmail === currentEmail ? 'You' : message.senderName,
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      content: message.content,
      fileUrl: message.fileUrl || null,
      fileType: message.fileType || null,
      originalName: message.originalName || null,
      timestamp: message.sentAt
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Kural messages.', details: err.message });
  }
});

// Send Message (with optional file attachment data)
app.post('/api/chat/:workspaceId/:channelId/messages', async (req, res) => {
  try {
    const { workspaceId, channelId } = req.params;
    const { content, fileUrl, fileType, originalName } = req.body;
    const cleanContent = String(content || '').trim();

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid Kural channel id.' });
    }
    if (!cleanContent && !fileUrl) {
      return res.status(400).json({ error: 'Message content or file is required.' });
    }

    const currentEmail = normalizeEmail(req.user.email);
    const conversation = await KuralConversation.findOne({
      _id: channelId,
      members: currentEmail
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Kural conversation not found.' });
    }

    const message = await KuralMessage.create({
      conversationId: conversation._id,
      senderEmail: currentEmail,
      senderName: req.user.name || currentEmail,
      content: cleanContent || (originalName ? `Sent a file: ${originalName}` : ''),
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      originalName: originalName || null
    });

    // Notify WebSocket gateway of new chat message
    try {
      fetch('http://localhost:3105/internal/chat-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: channelId, senderEmail: currentEmail, message })
      }).catch(() => {});
    } catch (e) {
      // Suppress network errors
    }

    res.status(201).json({
      _id: message._id,
      conversationId: message.conversationId,
      sender: 'You',
      senderName: message.senderName,
      senderEmail: message.senderEmail,
      content: message.content,
      fileUrl: message.fileUrl || null,
      fileType: message.fileType || null,
      originalName: message.originalName || null,
      timestamp: message.sentAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send Kural message.', details: err.message });
  }
});

// Start direct message conversation
app.post('/api/chat/start-dm', async (req, res) => {
  try {
    const { members = [], createdBy, workspaceId } = req.body;
    const currentEmail = normalizeEmail(createdBy || req.user.email);
    const peerEmail = normalizeEmail(members.find((email) => normalizeEmail(email) !== currentEmail) || members[0] || currentEmail);
    const activeWorkspaceId = workspaceId || req.user.workspaceId;

    if (!currentEmail || !peerEmail) {
      return res.status(400).json({ error: 'Two participant emails are required to start a DM.' });
    }

    const conversation = await ensureDirectConversation(activeWorkspaceId, currentEmail, peerEmail);
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start direct message.', details: err.message });
  }
});

// Create Group channel
app.post('/api/chat/groups', async (req, res) => {
  try {
    const { name, members = [], workspaceId } = req.body;
    const currentEmail = normalizeEmail(req.user.email);
    const activeWorkspaceId = workspaceId || req.user.workspaceId;

    if (!name) return res.status(400).json({ error: 'Group name is required.' });

    const participantEmails = [...new Set([currentEmail, ...members.map(normalizeEmail)])];

    const conversation = await KuralConversation.create({
      workspaceId: activeWorkspaceId,
      isGroup: true,
      name,
      members: participantEmails,
      createdBy: currentEmail
    });

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group.', details: err.message });
  }
});

// Delete conversation history
app.delete('/api/chat/delete-conversation/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID.' });
    }

    const currentEmail = normalizeEmail(req.user.email);
    const conversation = await KuralConversation.findOne({
      _id: channelId,
      members: currentEmail
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await KuralMessage.deleteMany({ conversationId: conversation._id });
    res.json({ message: 'Kural conversation history cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete Kural conversation.', details: err.message });
  }
});

// ─── STATUS (DISAPPEARING STORIES) ROUTER ───
app.get('/api/status/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const activeWorkspaceId = workspaceId || req.user.workspaceId;

    // Fetch all active statuses (TTL auto-deletes >24h)
    const statuses = await KuralStatus.find({ workspaceId: activeWorkspaceId }).sort({ createdAt: 1 });
    
    // Group by userEmail
    const grouped = {};
    statuses.forEach(status => {
      if (!grouped[status.userEmail]) {
        grouped[status.userEmail] = {
          userEmail: status.userEmail,
          userName: status.userName,
          avatarUrl: status.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(status.userName)}`,
          statuses: []
        };
      }
      grouped[status.userEmail].statuses.push({
        _id: status._id,
        mediaType: status.mediaType,
        mediaUrl: status.mediaUrl,
        content: status.content,
        bgColor: status.bgColor,
        createdAt: status.createdAt,
        views: status.views || []
      });
    });

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statuses', details: err.message });
  }
});

app.post('/api/status/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const activeWorkspaceId = workspaceId || req.user.workspaceId;
    const { mediaType, mediaUrl, content, bgColor } = req.body;
    const currentEmail = normalizeEmail(req.user.email);

    const status = await KuralStatus.create({
      workspaceId: activeWorkspaceId,
      userEmail: currentEmail,
      userName: req.user.name || currentEmail,
      avatarUrl: req.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(req.user.name || currentEmail)}`,
      mediaType: mediaType || 'text',
      mediaUrl,
      content,
      bgColor,
      views: []
    });

    res.status(201).json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create status', details: err.message });
  }
});

app.post('/api/status/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const currentEmail = normalizeEmail(req.user.email);

    const status = await KuralStatus.findByIdAndUpdate(
      id,
      { $addToSet: { views: currentEmail } },
      { new: true }
    );

    if (!status) return res.status(404).json({ error: 'Status not found' });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark status as viewed', details: err.message });
  }
});

// ─── TEAM MEMBERS ROUTER ───
app.get('/api/members/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const members = await User.find({ workspaceId }).select('name email role avatarUrl');
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team members.' });
  }
});

app.post('/api/members/add', async (req, res) => {
  try {
    const { name, email, role, workspaceId } = req.body;
    const normEmail = normalizeEmail(email);
    
    let user = await User.findOne({ email: normEmail });
    if (user) {
      user.workspaceId = workspaceId;
      await user.save();
    } else {
      user = await User.create({
        name,
        email: normEmail,
        workspaceId,
        role: role || 'Member',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      });
    }
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member.', details: err.message });
  }
});

// ─── TASKS ROUTER ───
app.get('/api/tasks', async (req, res) => {
  try {
    const workspaceId = req.user.workspaceId;
    const tasks = await Task.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

app.post('/api/tasks/create', async (req, res) => {
  try {
    const { title, description, assignee, dueDate } = req.body;
    const task = await Task.create({
      workspaceId: req.user.workspaceId,
      title,
      description,
      assignee,
      dueDate: dueDate ? new Date(dueDate) : undefined
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { title, description, status, assignee, dueDate } = req.body;
    const task = await Task.findByIdAndUpdate(req.params.id, {
      title, description, status, assignee, dueDate
    }, { new: true });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// ─── DOCUMENTS ROUTER ───
app.get('/api/docs/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const docs = await Doc.find({ workspaceId }).sort({ updatedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

app.post('/api/docs/create', async (req, res) => {
  try {
    const { title, content, workspaceId } = req.body;
    const doc = await Doc.create({
      workspaceId: workspaceId || req.user.workspaceId,
      title: title || 'Untitled Document',
      content: content || '',
      createdBy: req.user.email,
      updatedBy: req.user.email
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create document.' });
  }
});

app.patch('/api/docs/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    const doc = await Doc.findByIdAndUpdate(req.params.id, {
      title, content, updatedBy: req.user.email, updatedAt: new Date()
    }, { new: true });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update document.' });
  }
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'chat-collaboration-service' });
});

const PORT = 3104;
app.listen(PORT, () => {
  console.log(`💬 [Chat/Coll. Service] Running on http://localhost:${PORT}`);
});
