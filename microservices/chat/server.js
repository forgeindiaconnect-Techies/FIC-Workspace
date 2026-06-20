import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { connectMongo, User, KuralConversation, KuralMessage, KuralStatus, Task, Doc, ThreadPost, ThreadComment, Project } from '../shared/database.js';
import { authenticate } from '../shared/auth.js';
import { uploadToCloudinary, resolveUploadName } from '../shared/cloudinary.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedExamples = '';
try {
  const examplesPath = path.join(__dirname, 'ppt_examples.json');
  if (fs.existsSync(examplesPath)) {
    cachedExamples = fs.readFileSync(examplesPath, 'utf8');
  }
} catch (e) {
  console.error("Failed to load ppt_examples.json", e);
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
      
      const lastMsg = await KuralMessage.findOne({ conversationId: conversation._id }).sort({ sentAt: -1 });
      const hasMessages = !!lastMsg;

      channelsMap.set(conversation._id.toString(), {
        _id: conversation._id,
        isGroup: false,
        type: 'dm',
        members: conversation.members,
        displayName: member.name,
        name: member.name,
        email: member.email,
        avatar: initials(member.name),
        role: member.role || 'Member',
        workspaceId: activeWorkspaceId,
        isOnline: true,
        lastMessageContent: lastMsg ? lastMsg.content : 'Start a secure Kural conversation',
        lastMessage: lastMsg ? lastMsg.sentAt : conversation.createdAt,
        hasMessages: hasMessages
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

    const groupsWithMessages = await Promise.all(groups.map(async (g) => {
      const lastMsg = await KuralMessage.findOne({ conversationId: g._id }).sort({ sentAt: -1 });
      
      return {
        _id: g._id,
        isGroup: true,
        type: 'group',
        name: g.name,
        displayName: g.name,
        members: g.members,
        lastMessageContent: lastMsg ? lastMsg.content : 'Start a group discussion',
        lastMessage: lastMsg ? lastMsg.sentAt : g.createdAt,
        hasMessages: !!lastMsg,
        unread: 0,
        isOnline: true
      };
    }));

    res.json(groupsWithMessages);
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

// Add members to an existing group
app.post('/api/chat/group/:channelId/members', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { members = [] } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ error: 'Invalid group ID.' });
    }
    
    if (!members || members.length === 0) {
      return res.status(400).json({ error: 'No members provided to add.' });
    }

    const currentEmail = normalizeEmail(req.user.email);
    
    // Find the group and ensure the user is part of it
    const group = await KuralConversation.findOne({
      _id: channelId,
      isGroup: true,
      members: currentEmail
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found or you are not a member.' });
    }

    const newMemberEmails = members.map(normalizeEmail);
    
    // Add new members, avoiding duplicates
    group.members = [...new Set([...group.members, ...newMemberEmails])];
    await group.save();

    res.status(200).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add members to group.', details: err.message });
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
      { returnDocument: 'after' }
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
    }, { returnDocument: 'after' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// ─── DOCUMENTS ROUTER ───
app.get('/api/docs/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const docs = await Doc.find({ 
      workspaceId,
      $or: [
        { createdBy: req.user.email },
        { isPublic: true }
      ]
    }).sort({ updatedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

app.post('/api/docs/create', async (req, res) => {
  try {
    const { title, content, type, workspaceId } = req.body;
    const doc = await Doc.create({
      workspaceId: workspaceId || req.user.workspaceId,
      title: title || 'Untitled Document',
      type: type || 'Doc',
      content: content || {},
      createdBy: req.user.email,
      updatedBy: req.user.email,
      isPublic: false
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create document.', details: err.message });
  }
});

app.patch('/api/docs/:id', async (req, res) => {
  try {
    const { title, content, isPublic } = req.body;
    const updateData = { updatedBy: req.user.email, updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const doc = await Doc.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.email }, // Only creator can update
      updateData, 
      { returnDocument: 'after' }
    );
    if (!doc) {
      return res.status(403).json({ error: 'Not authorized to edit this document or document not found.' });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update document.' });
  }
});

app.post('/api/docs/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ error: 'AI API key not configured' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${groqKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are an expert document writer. The user will provide a topic or prompt. Generate a comprehensive document in HTML format. Return ONLY the HTML content, no markdown wrappers, no explanations. Use appropriate headings <h1>, <h2>, <p>, <ul>, <li>, <strong> etc. Do not include <html>, <head>, or <body> tags, just the inner content.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${errorText}`);
    }

    const data = await response.json();
    let generatedHtml = data.choices?.[0]?.message?.content || '';
    generatedHtml = generatedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();

    res.json({ html: generatedHtml });
  } catch (err) {
    res.status(500).json({ error: `Failed to generate document: ${err.message}` });
  }
});

app.post('/api/show/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ error: 'AI API key not configured' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${groqKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert presentation creator. Generate a presentation based on the user prompt. 
You must strictly reply with a JSON object. Do not include any markdown wrappers, code blocks, or surrounding text.

The JSON schema must be exactly:
{
  "theme": "modern", // Options: modern, corporate, playful, dark, elegant
  "slides": [
    {
      "layout": "title", // Options: title, bullets, split, quote, default
      "title": "Slide Title",
      "subtitle": "Subtitle or author (only for title layout)",
      "content": ["Point 1", "Point 2"] // Array of strings (for bullets/split), or a single string for quote
    }
  ]
}

IMPORTANT RULES:
1. Output ONLY VALID JSON. Keys and string values MUST be enclosed in double quotes.
2. If you need to use quotes inside your text, use single quotes (e.g., "quote": "To be or 'not' to be").
3. Output 5 to 7 beautifully structured slides.

Here are some high-quality examples of presentation structures, layouts, and themes to learn from:
${cachedExamples}
` 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${errorText}`);
    }

    const data = await response.json();
    let generatedJsonText = data.choices?.[0]?.message?.content || '{}';
    
    let presentationData = { theme: 'modern', slides: [] };
    try {
      const cleanedText = generatedJsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      presentationData = JSON.parse(cleanedText);
    } catch (parseError) {
      throw new Error(`Failed to parse AI output as JSON. Output: ${generatedJsonText}`);
    }

    // Default formatting if AI failed to strictly follow structure
    if (Array.isArray(presentationData)) {
      presentationData = { theme: 'modern', slides: presentationData };
    }

    res.json(presentationData);
  } catch (err) {
    console.error("SHOW GENERATE ERRROR:", err);
    res.status(500).json({ error: `Show failed: ${err.message}` });
  }
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'chat-collaboration-service' });
});


// ─── THREADS / SOCIAL FEED ───
app.get('/api/threads/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { limit = 20, cursor } = req.query;

    const query = { workspaceId };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const posts = await ThreadPost.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    
    // Fetch comments for these posts
    const postIds = posts.map(p => p._id);
    const comments = await ThreadComment.find({ postId: { $in: postIds } }).sort({ createdAt: 1 }).lean();

    const commentsByPostId = comments.reduce((acc, c) => {
      const pId = c.postId.toString();
      if (!acc[pId]) acc[pId] = [];
      acc[pId].push(c);
      return acc;
    }, {});

    const result = posts.map(post => ({
      ...post,
      comments: commentsByPostId[post._id.toString()] || []
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch threads', details: err.message });
  }
});

app.post('/api/threads/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file upload.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    const originalName = resolveUploadName(req.file, result);
    
    const type = req.file.mimetype?.startsWith('video/') ? 'video' : req.file.mimetype?.startsWith('image/') ? 'image' : 'document';

    res.json({
      url: result.secure_url || result.url,
      type,
      name: originalName
    });
  } catch (err) {
    res.status(500).json({ error: 'File upload failed.', details: err.message });
  }
});

app.post('/api/threads/poster', async (req, res) => {
  try {
    const { prompt } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:8081',
        'Referer': 'http://localhost:8081/'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });
    
    const data = await response.json();
    if (data.error) {
      console.error('[Gemini API Error]:', data.error);
      throw new Error(data.error.message || 'Gemini error');
    }
    
    let svgCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract only the SVG part, ignoring conversational text
    const svgMatch = svgCode.match(/<svg[\s\S]*?<\/svg>/i);
    if (svgMatch) {
      svgCode = svgMatch[0];
    } else {
      svgCode = svgCode.replace(/^\`\`\`xml/, '').replace(/^\`\`\`svg/, '').replace(/^\`\`\`html/, '').replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }
    
    // [FIX]: Browsers block external images inside an SVG loaded via a Data URI (which <Image> uses).
    // We must fetch external images on the server and inject them as Base64 Data URIs directly into the SVG!
    const urlMatches = [...svgCode.matchAll(/(?:xlink:)?href="([^"]+)"/g)];
    for (const match of urlMatches) {
      const url = match[1];
      if (url.startsWith('http')) {
        try {
          const cleanUrl = url.replace(/&amp;/g, '&'); // Unescape URLs
          const imgRes = await fetch(cleanUrl);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
            const base64Url = `data:${mimeType};base64,${buffer.toString('base64')}`;
            // Replace the URL with the base64 string in the SVG code
            svgCode = svgCode.split(url).join(base64Url);
          }
        } catch (e) {
          console.error('[Base64 Image Fetch Error]:', url, e.message);
        }
      }
    }
    
    res.status(200).json({ svg: svgCode });
  } catch (err) {
    console.error('[Poster Generation Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate poster', details: err.message });
  }
});

app.post('/api/threads/create', async (req, res) => {
  try {
    const { workspaceId, content, mediaUrls = [], visibility = 'everyone', visibilityData = [] } = req.body;
    console.log('Incoming POST /api/threads/create:', { workspaceId, content, mediaUrlsLength: mediaUrls?.length });
    const currentEmail = normalizeEmail(req.user.email);
    const currentName = req.user.name || currentEmail;

    if (!workspaceId || (!content && (!mediaUrls || mediaUrls.length === 0))) {
      console.log('Failing 400 due to validation:', { workspaceId, content, mediaUrlsLength: mediaUrls?.length });
      return res.status(400).json({ error: 'workspaceId and either content or mediaUrls are required' });
    }
    
    // Ensure content is at least an empty string if not provided
    const safeContent = content || '';

    const post = await ThreadPost.create({
      workspaceId,
      authorEmail: currentEmail,
      authorName: currentName,
      content: safeContent,
      mediaUrls,
      visibility,
      visibilityData
    });

    try {
      fetch('http://localhost:3105/internal/threads-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, eventType: 'NEW_POST', payload: post })
      }).catch(() => {});
    } catch(e) {}

    res.status(201).json(post);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'Failed to create post', details: err.message });
  }
});

app.post('/api/threads/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const currentEmail = normalizeEmail(req.user.email);

    const post = await ThreadPost.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const hasLiked = post.likes.includes(currentEmail);
    if (hasLiked) {
      post.likes = post.likes.filter(e => e !== currentEmail);
    } else {
      post.likes.push(currentEmail);
    }
    await post.save();

    try {
      fetch('http://localhost:3105/internal/threads-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: post.workspaceId, eventType: 'POST_LIKED', payload: { postId: id, likes: post.likes } })
      }).catch(() => {});
    } catch(e) {}

    res.status(200).json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like', details: err.message });
  }
});

app.delete('/api/threads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentEmail = normalizeEmail(req.user.email);

    const post = await ThreadPost.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.authorEmail !== currentEmail && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await ThreadComment.deleteMany({ postId: id });
    await ThreadPost.findByIdAndDelete(id);

    try {
      fetch('http://localhost:3105/internal/threads-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: post.workspaceId, eventType: 'POST_DELETED', payload: { postId: id } })
      }).catch(() => {});
    } catch(e) {}

    res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post', details: err.message });
  }
});

app.post('/api/threads/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentCommentId } = req.body;
    const currentEmail = normalizeEmail(req.user.email);
    const currentName = req.user.name || currentEmail;

    if (!content) return res.status(400).json({ error: 'content required' });

    const post = await ThreadPost.findById(id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = await ThreadComment.create({
      postId: id,
      parentCommentId: parentCommentId || null,
      authorEmail: currentEmail,
      authorName: currentName,
      content
    });

    try {
      fetch('http://localhost:3105/internal/threads-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: post.workspaceId, eventType: 'NEW_COMMENT', payload: comment })
      }).catch(() => {});
    } catch(e) {}

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create comment', details: err.message });
  }
});

app.post('/api/threads/comment/:commentId/like', async (req, res) => {
  try {
    const { commentId } = req.params;
    const currentEmail = normalizeEmail(req.user.email);

    const comment = await ThreadComment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    
    const post = await ThreadPost.findById(comment.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const hasLiked = comment.likes.includes(currentEmail);
    if (hasLiked) {
      comment.likes = comment.likes.filter(e => e !== currentEmail);
    } else {
      comment.likes.push(currentEmail);
    }
    await comment.save();

    try {
      fetch('http://localhost:3105/internal/threads-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: post.workspaceId, eventType: 'COMMENT_LIKED', payload: { commentId, likes: comment.likes, postId: comment.postId } })
      }).catch(() => {});
    } catch(e) {}

    res.status(200).json({ likes: comment.likes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like', details: err.message });
  }
});

app.delete('/api/threads/comment/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const currentEmail = normalizeEmail(req.user.email);

    const comment = await ThreadComment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.authorEmail !== currentEmail && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const post = await ThreadPost.findById(comment.postId);

    await ThreadComment.deleteMany({ $or: [{ _id: commentId }, { parentCommentId: commentId }] });

    if (post) {
      try {
        fetch('http://localhost:3105/internal/threads-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: post.workspaceId, eventType: 'COMMENT_DELETED', payload: { commentId, postId: comment.postId } })
        }).catch(() => {});
      } catch(e) {}
    }
    res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment', details: err.message });
  }
});

// ─── PROJECTS / FILES HUB ───
app.get('/api/projects/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { status } = req.query;
    const query = { workspaceId };
    if (status && status !== 'all') query.status = status;
    const projects = await Project.find(query).sort({ updatedAt: -1 });
    // Strip credential values for listing
    const safe = projects.map(p => {
      const obj = p.toObject();
      obj.credentials = (obj.credentials || []).map(c => ({ ...c, value: '••••••••' }));
      return obj;
    });
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
  }
});

app.get('/api/projects/:workspaceId/:projectId', async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project', details: err.message });
  }
});

app.post('/api/projects/create', async (req, res) => {
  try {
    const { workspaceId, name, description, icon, color, tags } = req.body;
    const project = await Project.create({
      workspaceId,
      name,
      description: description || '',
      icon: icon || '📁',
      color: color || '#2170E4',
      tags: tags || [],
      createdBy: req.user.email,
      createdByName: req.user.name
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project', details: err.message });
  }
});

app.put('/api/projects/:projectId', async (req, res) => {
  try {
    const { name, description, icon, color, status, tags } = req.body;
    const update = { updatedAt: new Date() };
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (icon !== undefined) update.icon = icon;
    if (color !== undefined) update.color = color;
    if (status !== undefined) update.status = status;
    if (tags !== undefined) update.tags = tags;
    const project = await Project.findByIdAndUpdate(req.params.projectId, update, { new: true });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project', details: err.message });
  }
});

app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.projectId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project', details: err.message });
  }
});

// Sub-resource add/remove (generic pattern)
const subResources = ['gitRepos', 'deployments', 'documentation', 'workflows', 'credentials'];
subResources.forEach(resource => {
  // Add item
  app.post(`/api/projects/:projectId/${resource}`, async (req, res) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const item = { ...req.body, addedBy: req.user.email, addedAt: new Date() };
      project[resource].push(item);
      project.updatedAt = new Date();
      await project.save();
      res.status(201).json(project);
    } catch (err) {
      res.status(500).json({ error: `Failed to add ${resource}`, details: err.message });
    }
  });

  // Remove item
  app.delete(`/api/projects/:projectId/${resource}/:itemId`, async (req, res) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      project[resource] = project[resource].filter(i => i._id.toString() !== req.params.itemId);
      project.updatedAt = new Date();
      await project.save();
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: `Failed to remove ${resource} item`, details: err.message });
    }
  });
});

const PORT = 3104;
app.listen(PORT, () => {
  console.log(`💬 [Chat/Coll. Service] Running on http://localhost:${PORT}`);
});
