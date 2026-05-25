import express from 'express';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import fs from 'fs';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import Groq from "groq-sdk";
import { Tenant, User, Mail, Document, Message, Channel, Meeting, ChatUser, Story, CallLog } from './models/schemas.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'antigraviity_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(compression());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- MULTER CONFIGURATION ---
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for general uploads
});

const aiUpload = multer({
  dest: '/tmp/',
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm', 'audio/ogg', 'audio/flac', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|mp4|wav|webm|ogg|flac|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload an audio or video file.'));
    }
  }
});

// --- GROQ INITIALIZATION ---
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

if (!process.env.GROQ_API_KEY) {
  console.log('⚠️ [WARN] GROQ_API_KEY is missing.');
} else {
  console.log('✅ [INFO] Groq AI is configured.');
}

// --- GEMINI INITIALIZATION ---
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const fileManager = process.env.GEMINI_API_KEY ? new GoogleAIFileManager(process.env.GEMINI_API_KEY) : null;

if (!process.env.GEMINI_API_KEY) {
  console.log('⚠️ [WARN] GEMINI_API_KEY is missing.');
} else {
  console.log('✅ [INFO] Gemini AI is configured.');
}



// --- MONGODB CONNECTION ---
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Failed:', err.message));
}

// --- REAL-TIME SIGNALING ---
const roomPasswords = new Map();
const activeUsers = new Map(); // email -> socket.id

io.on('connection', socket => {
    socket.on("user-online", async ({ mobile }) => {
        socket.mobile = mobile;
        await ChatUser.findOneAndUpdate({ mobile }, { isOnline: true });
        io.emit("presence-update", { mobile, isOnline: true });
    });

    socket.on("join room", async (rawRoomID, password, intent, userData) => {
        const roomID = rawRoomID.trim().replace(/-/g, '').toUpperCase();
        const meeting = await Meeting.findOne({ 
            roomId: roomID, 
            status: { $ne: 'Ended' } 
        }).sort({ createdAt: -1 });
        
        if (!meeting) {
            console.log(`❌ [SECURITY] Unauthorized attempt to ${intent} room ${roomID}`);
            return socket.emit("password status", { success: false, error: 'invalid-room' });
        }

        // Verify Hashed Password (if exists)
        const correctPassword = meeting ? meeting.password : password;
        const isPasswordMatch = meeting?.password?.startsWith('$2b$') 
            ? await bcrypt.compare(password, meeting.password)
            : (password === correctPassword || !correctPassword);

        if (isPasswordMatch) {
            // Check Room Lock
            if (meeting?.isLocked && intent !== 'create') {
                return socket.emit("password status", { success: false, error: 'room-locked' });
            }

            // Check Waiting Room
            if (meeting?.waitingRoomEnabled && intent !== 'create') {
                // Check if host is already in room
                const clients = io.sockets.adapter.rooms.get(roomID);
                const hasHost = clients && clients.size > 0; // Simple check for now
                
                if (hasHost) {
                   socket.emit("password status", { success: true, waiting: true });
                   return io.to(roomID).emit("waiting-user", { 
                      id: socket.id, 
                      name: userData?.name || 'Guest',
                      email: userData?.email
                   });
                }
            }

            socket.join(roomID);
            const clients = io.sockets.adapter.rooms.get(roomID);
            // Robust host check: if intent is 'create', they are the host regardless of order
            const isFirst = intent === 'create' || !clients || clients.size === 1;
            
            socket.emit("password status", { success: true, isFirst });
            console.log(`📡 [${isFirst ? 'HOST' : 'GUEST'}] User ${socket.id} joined ${roomID} (Intent: ${intent})`);
        } else {
            console.log(`❌ [AUTH] Password mismatch for ${socket.id} in ${roomID}`);
            socket.emit("password status", { success: false, error: 'Incorrect meeting password' });
        }
    });

    socket.on("admit-user", ({ roomID, userId }) => {
       const waitingSocket = io.sockets.sockets.get(userId);
       if (waitingSocket) {
          waitingSocket.join(roomID);
          waitingSocket.emit("admitted");
          console.log(`✅ [ADMIT] User ${userId} admitted to ${roomID}`);
       }
    });

    socket.on("toggle-lock", async ({ roomID, isLocked }) => {
       await Meeting.findOneAndUpdate({ roomId: roomID }, { isLocked });
       io.in(roomID).emit("room-security-update", { isLocked });
    });

    socket.on("request users", rawRoomID => {
        const roomID = rawRoomID.trim().replace(/-/g, '').toUpperCase();
        const clients = io.sockets.adapter.rooms.get(roomID);
        if (clients) {
            const otherUsers = Array.from(clients).filter(id => id !== socket.id);
            socket.emit("all users", otherUsers);
        }
    });

    socket.on("sending signal", payload => {
        io.to(payload.userToSignal).emit('user joined', { 
            signal: payload.signal, 
            callerID: payload.callerID,
            name: payload.name 
        });
    });

    socket.on("returning signal", payload => {
        io.to(payload.callerID).emit('receiving returned signal', { 
            signal: payload.signal, 
            id: socket.id,
            name: payload.name
        });
    });

    socket.on("ice-candidate", payload => {
        io.to(payload.to).emit("ice-candidate", { candidate: payload.candidate, from: socket.id });
    });

    socket.on("send room message", async ({ roomID, workspaceId, senderEmail, message }) => {
        try {
            // Save to database for persistence
            const newMessage = new Message({
                workspaceId,
                channelId: roomID,
                sender: message.user,
                senderEmail,
                content: message.text
            });
            await newMessage.save();
            
            // Broadcast to everyone in the room
            io.in(roomID).emit("room message", message);
        } catch (err) {
            console.error('Failed to save room message:', err);
            // Still broadcast even if save fails to maintain real-time feel
            io.in(roomID).emit("room message", message);
        }
    });

    socket.on("join chat", channelId => {
        socket.join(channelId);
    });

    socket.on("send message", async (msgData) => {
        try {
            const { workspaceId, channelId, sender, senderEmail, content, fileUrl, fileType, parentMessageId } = msgData;
            const message = new Message({ 
                workspaceId, channelId, sender, senderEmail, content, fileUrl, fileType, parentMessageId 
            });
            await message.save();

            if (parentMessageId) {
                await Message.findByIdAndUpdate(parentMessageId, { $inc: { replyCount: 1 } });
            }

            io.to(channelId).emit("new message", message);
        } catch (err) {
            console.error('Failed to save message:', err);
        }
    });

    socket.on("add-reaction", async ({ messageId, emoji, userEmail, channelId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            let reaction = message.reactions.find(r => r.emoji === emoji);
            if (reaction) {
                if (!reaction.users.includes(userEmail)) {
                    reaction.users.push(userEmail);
                }
            } else {
                message.reactions.push({ emoji, users: [userEmail] });
            }

            await message.save();
            io.to(channelId).emit("reaction-updated", { messageId, reactions: message.reactions });
        } catch (err) {
            console.error('Failed to add reaction:', err);
        }
    });

    socket.on("remove-reaction", async ({ messageId, emoji, userEmail, channelId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            let reaction = message.reactions.find(r => r.emoji === emoji);
            if (reaction) {
                reaction.users = reaction.users.filter(u => u !== userEmail);
                if (reaction.users.length === 0) {
                    message.reactions = message.reactions.filter(r => r.emoji !== emoji);
                }
            }

            await message.save();
            io.to(channelId).emit("reaction-updated", { messageId, reactions: message.reactions });
        } catch (err) {
            console.error('Failed to remove reaction:', err);
        }
    });

    socket.on('disconnecting', async () => {
        if (socket.mobile) {
            const lastSeen = new Date();
            await ChatUser.findOneAndUpdate({ mobile: socket.mobile }, { isOnline: false, lastSeen });
            io.emit("presence-update", { mobile: socket.mobile, isOnline: false, lastSeen });
        }
        socket.rooms.forEach(async room => {
            if (room !== socket.id) {
                socket.to(room).emit('user left', socket.id);
                
                const clients = io.sockets.adapter.rooms.get(room);
                // If only this user was left in the room (clients.size is 1)
                if (clients && clients.size <= 1) {
                    roomPasswords.delete(room);
                    
                    // Mark meeting as Ended if it's currently Live
                    try {
                        await Meeting.findOneAndUpdate(
                            { roomId: room, status: 'Live' },
                            { status: 'Ended' }
                        );
                        console.log(`🏁 [DB] Meeting ${room} automatically marked as Ended`);
                    } catch (e) {
                        console.error("Auto-close failed:", e);
                    }
                }
            }
        });
    });

    socket.on("typing", ({ channelId, user }) => {
        socket.to(channelId).emit("user typing", { user });
    });

    socket.on("stop typing", ({ channelId, user }) => {
        socket.to(channelId).emit("user stop typing", { user });
    });

    socket.on("message read", async ({ messageId, channelId }) => {
        try {
            await Message.findByIdAndUpdate(messageId, { status: 'read' });
            socket.to(channelId).emit("message status update", { messageId, status: 'read' });
        } catch (err) {
            console.error('Failed to update message status:', err);
        }
    });

    socket.on('disconnect', () => {
        if (socket.email) {
            activeUsers.delete(socket.email);
            console.log(`[WebRTC] Unregistered user ${socket.email}`);
        }
        console.log('🔌 User disconnected:', socket.id);
    });

    // --- WebRTC Signaling ---
    socket.on("register-user", ({ email, mobile }) => {
        if (email) {
            activeUsers.set(email, socket.id);
            socket.email = email;
            console.log(`[WebRTC] Registered ${email} -> ${socket.id}`);
        }
        if (mobile) {
            activeUsers.set(mobile, socket.id);
            socket.mobile = mobile;
            console.log(`[WebRTC] Registered ${mobile} -> ${socket.id}`);
        }
    });

    socket.on("call-user", ({ userToCall, signalData, from, name, isVideo }) => {
        const targetSocket = activeUsers.get(userToCall);
        if (targetSocket) {
            io.to(targetSocket).emit("call-incoming", { signal: signalData, from, name, isVideo });
        } else {
            socket.emit("call-error", { message: "User is currently offline or unavailable" });
            // Log as missed call
            const log = new CallLog({
                from: from,
                to: userToCall,
                type: isVideo ? 'video' : 'voice',
                status: 'missed'
            });
            log.save().catch(e => console.error("Failed to log missed call:", e));
        }
    });

    socket.on("answer-call", ({ to, signal }) => {
        const targetSocket = activeUsers.get(to);
        if (targetSocket) {
            io.to(targetSocket).emit("call-accepted", signal);
        }
    });

    socket.on("end-call", ({ to }) => {
        const targetSocket = activeUsers.get(to);
        if (targetSocket) {
            io.to(targetSocket).emit("call-ended");
        }
    });

    socket.on("disconnect", () => {
        if (socket.email) activeUsers.delete(socket.email);
        if (socket.mobile) activeUsers.delete(socket.mobile);
        console.log(`[WebRTC] Unregistered user ${socket.id}`);
    });
});

// --- API ROUTES ---

app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ joined: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register-tenant', async (req, res) => {
  try {
    const { name, workspaceId, domain, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const tenant = new Tenant({ name, workspaceId, domain, adminEmail: email, password: hashedPassword });
    await tenant.save();
    res.status(201).json({ message: 'Tenant registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (mongoose.connection.readyState !== 1) {
       return res.status(503).json({ error: 'Database connection is not ready.' });
    }

    // 1. Check Tenant Collection (Workspace Owners)
    const tenant = await Tenant.findOne({ adminEmail: email });
    if (tenant) {
      if (await bcrypt.compare(password, tenant.password)) {
        const token = jwt.sign({ id: tenant._id, role: 'company-admin', workspaceId: tenant.workspaceId }, JWT_SECRET);
        return res.json({ token, user: tenant.name, role: 'company-admin', workspaceId: tenant.workspaceId, email });
      }
      // If found as tenant but password fails, DO NOT fall through to User check
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Check User Collection (Workspace Members & Super Admins)
    const user = await User.findOne({ email });
    if (user) {
      if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user._id, role: user.role, workspaceId: user.workspaceId }, JWT_SECRET);
        return res.json({ token, user: user.name, role: user.role, workspaceId: user.workspaceId, email });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INDEPENDENT CHAT AUTH (MOBILE + OTP) ---

const tempOtps = new Map(); // In-memory OTP storage for demo purposes

app.post('/api/auth/chat/request-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    console.log(`[AUTH-DEBUG] OTP Request for: ${mobile}`);

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // Generate a simple 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    tempOtps.set(mobile, { otp, expires: Date.now() + 300000 }); // 5 min expiry

    console.log(`📱 [OTP] For ${mobile}: ${otp}`);
    res.json({ success: true, message: 'OTP sent successfully', otp }); 
  } catch (err) {
    console.error('[CRITICAL] request-otp failed:', err);
    res.status(500).json({ 
      error: 'Failed to generate OTP', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
});

app.post('/api/auth/chat/verify-otp', async (req, res) => {
  try {
    const { mobile, otp, mode } = req.body;
    const stored = tempOtps.get(mobile);

    if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    tempOtps.delete(mobile);

    // Check user status
    let chatUser = await ChatUser.findOne({ mobile });
    let isNew = false;

    if (mode === 'signup') {
      if (chatUser && chatUser.name && chatUser.username) {
        return res.status(400).json({ error: 'Account already exists. Please log in.' });
      }
      if (!chatUser) {
        chatUser = new ChatUser({ mobile });
        await chatUser.save();
      }
      isNew = true;
    } else {
      // Login mode
      if (!chatUser || (!chatUser.name && !chatUser.username)) {
        return res.status(404).json({ error: 'Account not found. Please sign up.' });
      }
    }

    const token = jwt.sign({ id: chatUser._id, mobile: chatUser.mobile, type: 'chat-user' }, JWT_SECRET);
    res.json({ 
      token, 
      user: chatUser.name || 'New User', 
      username: chatUser.username,
      profilePicture: chatUser.profilePicture,
      isNew,
      chatUser 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/chat/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    const existing = await ChatUser.findOne({ username: username.toLowerCase() });
    res.json({ available: !existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/chat/setup-profile', upload.single('profilePicture'), async (req, res) => {
  try {
    const { mobile, name, username } = req.body;
    let profilePicture = '';
    
    if (req.file) {
      profilePicture = `/uploads/${req.file.filename}`;
    }

    const chatUser = await ChatUser.findOneAndUpdate(
      { mobile },
      { name, username: username.toLowerCase(), profilePicture },
      { new: true }
    );

    if (!chatUser) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Profile updated successfully', chatUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/search-users', async (req, res) => {
  try {
    const { query, currentUserId } = req.query;
    if (!query) return res.json([]);

    const users = await ChatUser.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: currentUserId }
    }).limit(10);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Story / Status Endpoints
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stories', upload.single('image'), async (req, res) => {
  try {
    const { userEmail, userName, userPhoto, content } = req.body;
    const storyData = {
      userEmail,
      userName,
      userPhoto,
      content,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    };
    const story = new Story(storyData);
    await story.save();
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Call History Endpoints
app.get('/api/calls/:email', async (req, res) => {
  try {
    const calls = await CallLog.find({
      $or: [{ from: req.params.email }, { to: req.params.email }]
    }).sort({ timestamp: -1 });
    res.json(calls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/calls', async (req, res) => {
  try {
    const call = new CallLog(req.body);
    await call.save();
    res.status(201).json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Profile Update Endpoint
app.post('/api/chat/profile/update', upload.single('profilePicture'), async (req, res) => {
  try {
    const { mobile, name, username } = req.body;
    const updateData = { name, username };
    if (req.file) {
      updateData.profilePicture = `/uploads/${req.file.filename}`;
    }
    const user = await ChatUser.findOneAndUpdate({ mobile }, updateData, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/start-dm', async (req, res) => {
  try {
    const { members, createdBy } = req.body; // members is array of mobile numbers or identifiers
    
    // Check if DM already exists
    let channel = await Channel.findOne({
      type: 'dm',
      members: { $all: members, $size: 2 }
    });

    if (!channel) {
      channel = new Channel({
        workspaceId: 'independent',
        name: 'Direct Message',
        type: 'dm',
        members,
        createdBy
      });
      await channel.save();
    }

    res.json(channel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat/delete-conversation/:id', async (req, res) => {
  try {
    const channelId = req.params.id;
    console.log(`🗑️ [DELETE] Attempting to delete conversation: ${channelId}`);
    
    const deletedChannel = await Channel.findByIdAndDelete(channelId);
    if (!deletedChannel) {
      console.warn(`⚠️ [DELETE] Channel not found: ${channelId}`);
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messagesDeleted = await Message.deleteMany({ channelId });
    console.log(`✅ [DELETE] Successfully deleted conversation ${channelId} and ${messagesDeleted.deletedCount} messages`);
    
    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (err) {
    console.error(`❌ [DELETE] Failed to delete conversation ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mail/:workspaceId', async (req, res) => {
  try {
    const { email, q } = req.query;
    const filter = { 
      workspaceId: req.params.workspaceId,
      $or: [{ recipient: email }, { senderEmail: email }]
    };

    if (q) {
      filter.$text = { $search: q };
    }

    const mails = await Mail.find(filter).sort(q ? { score: { $meta: "textScore" } } : { timestamp: -1 });
    res.json(mails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mail/send', async (req, res) => {
  try {
    const mail = new Mail(req.body);
    await mail.save();
    
    // Real-time notification via Socket.io
    io.emit('new-email', {
      workspaceId: mail.workspaceId,
      recipient: mail.recipient,
      mail: mail
    });

    res.status(201).json(mail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/mail/:id', async (req, res) => {
  try {
    const mail = await Mail.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(mail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/mail/summarize', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  const prompt = `Summarize this email in 3 bullet points. Be concise.
  Email: ${content}`;

  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
      });
      const summary = completion.choices[0]?.message?.content || "";
      return res.json({ summary: summary.split('\n').filter(l => l.trim()) });
    } catch (err) {
      console.warn('Groq summarization failed:', err.message);
    }
  }
  
  // Fallback to Gemini if Groq fails or is not configured
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const summary = result.response.text() || "";
      return res.json({ summary: summary.split('\n').filter(l => l.trim()) });
    } catch (err) {
      console.warn('Gemini summarization failed:', err.message);
    }
  }
  res.status(503).json({ error: 'AI service unavailable' });
});

app.post('/api/mail/smart-reply', async (req, res) => {
  const { content, sender } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  const prompt = `Based on this email from ${sender}, suggest 3 short, professional one-click replies.
  Email: ${content}
  Output MUST be valid JSON: { "replies": ["reply 1", "reply 2", "reply 3"] }`;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await model.generateContent(prompt);
      return res.json(JSON.parse(result.response.text()));
    } catch (err) {
      console.error('Gemini smart reply failed', err.message);
    }
  }
  res.status(503).json({ error: 'AI service unavailable' });
});

app.post('/api/mail/smart-compose', async (req, res) => {
  const { context, currentText } = req.body;
  if (!currentText) return res.json({ suggestion: '' });

  const prompt = `Acting as a professional email assistant, suggest the next 3-5 words for this email.
  Context: ${context}
  Email so far: ${currentText}
  Only return the suggestion, nothing else.`;

  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        max_tokens: 10
      });
      return res.json({ suggestion: completion.choices[0]?.message?.content.trim() });
    } catch (err) {
      console.warn('Groq smart compose failed:', err.message);
    }
  }

  // Fallback to Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      return res.json({ suggestion: result.response.text().trim() });
    } catch (err) {
      console.warn('Gemini smart compose failed:', err.message);
    }
  }
  res.json({ suggestion: '' });
});

app.get('/api/docs/:workspaceId', async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { workspaceId: req.params.workspaceId };
    if (type) filter.type = type;
    const docs = await Document.find(filter).sort({ lastModified: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/docs/create', async (req, res) => {
  try {
    const doc = new Document(req.body);
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/docs/:id', async (req, res) => {
  try {
    const doc = await Document.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/chat/:workspaceId/:channelId', async (req, res) => {
  try {
    const messages = await Message.find({ 
      workspaceId: req.params.workspaceId,
      channelId: req.params.channelId,
      parentMessageId: null
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/thread/:messageId', async (req, res) => {
  try {
    const replies = await Message.find({ 
      parentMessageId: req.params.messageId 
    }).sort({ timestamp: 1 });
    res.json(replies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/members/:workspaceId', async (req, res) => {
  try {
    const users = await User.find({ workspaceId: req.params.workspaceId }).sort({ joined: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CHANNEL ROUTES ---

app.get('/api/channels/:workspaceId', async (req, res) => {
  try {
    const { email } = req.query;
    // Find channels where user is a member
    const channels = await Channel.find({ 
      workspaceId: req.params.workspaceId,
      members: email 
    }).sort({ lastMessage: -1 }).lean();

    // Enrich channels with last message and DM info
    const enrichedChannels = await Promise.all(channels.map(async (ch) => {
      const lastMsg = await Message.findOne({ channelId: ch._id }).sort({ timestamp: -1 });
      let enriched = { 
        ...ch, 
        lastMessageContent: lastMsg?.content || '', 
        lastMessageTime: lastMsg?.timestamp || ch.lastMessage,
        displayName: ch.name 
      };

      if (ch.type === 'dm') {
        const otherMemberMobile = ch.members.find(m => m !== email);
        if (otherMemberMobile) {
          const otherUser = await ChatUser.findOne({ mobile: otherMemberMobile });
          if (otherUser) {
            enriched.displayName = otherUser.name;
            enriched.displayUsername = otherUser.username;
            enriched.displayPicture = otherUser.profilePicture;
            enriched.isOnline = otherUser.isOnline;
            enriched.lastSeen = otherUser.lastSeen;
          }
        }
      }
      return enriched;
    }));

    res.json(enrichedChannels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels/create', async (req, res) => {
  try {
    const { workspaceId, name, type, members, createdBy } = req.body;
    
    // For DMs, check if a channel already exists between these members
    if (type === 'dm' && members.length === 2) {
      const existing = await Channel.findOne({
        workspaceId,
        type: 'dm',
        members: { $all: members, $size: 2 }
      });
      if (existing) return res.json(existing);
    }

    const channel = new Channel({ workspaceId, name, type, members, createdBy });
    await channel.save();
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/channels/:channelId/add-member', async (req, res) => {
  try {
    const { email } = req.body;
    const channel = await Channel.findByIdAndUpdate(
      req.params.channelId,
      { $addToSet: { members: email } },
      { new: true }
    );
    res.json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/members/add', async (req, res) => {
  try {
    const { workspaceId, name, email, password, role, mobile, personalEmail } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ workspaceId, name, email, password: hashedPassword, role, mobile, personalEmail });
    await user.save();
    await Tenant.findOneAndUpdate({ workspaceId }, { $inc: { users: 1 } });
    res.status(201).json({ message: 'Member added successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- MEETING ROUTES ---

// --- CONSOLIDATED MEETING ROUTES MOVED BELOW ---

app.get('/api/meet/ice-servers', (req, res) => {
  const domain = process.env.METERED_DOMAIN || 'meetspace.metered.live';
  const apiKey = process.env.METERED_SECRET_KEY;
  
  if (!apiKey) {
    console.log('⚠️ Metered API Key missing, falling back to static TURN');
    return res.json([
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "9f091677e1d3082375fdfe63",
        credential: "7AsjPX9jmD2X4E0R",
      }
    ]);
  }

  const url = `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`;
  
  https.get(url, (response) => {
    let data = '';
    response.on('data', (chunk) => data += chunk);
    response.on('end', () => {
      try {
        const iceServers = JSON.parse(data);
        if (iceServers.error) {
           console.error('❌ Metered API returned error:', iceServers.error);
           // Fallback to static if API returns error
           return res.json([
             { urls: "stun:stun.relay.metered.ca:80" },
             {
               urls: "turn:global.relay.metered.ca:80",
               username: "9f091677e1d3082375fdfe63",
               credential: "7AsjPX9jmD2X4E0R",
             }
           ]);
        }
        res.json(iceServers);
      } catch (e) {
        console.error('❌ Failed to parse ICE servers:', e.message);
        res.status(500).json({ error: 'Failed to parse ICE servers' });
      }
    });
  }).on('error', (err) => {
    console.error('❌ Metered API network error:', err.message);
    res.status(500).json({ error: err.message });
  });
});

// --- AI MEETING SUMMARIZER ---

// Generic Chat Upload
app.post('/api/chat/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, originalName: req.file.originalname, type: req.file.mimetype });
});

// GET /api/meetings/validate — Verify if a meeting exists and password is correct

// GET /api/meeting-logic/validate — Validate a meeting code before joining
app.get('/api/meeting-logic/validate', async (req, res) => {
  try {
    const { workspaceId, roomId, password } = req.query;
    const cleanRoomId = roomId?.trim().replace(/-/g, '').toUpperCase();
    console.log(`🔍 [VALIDATE] Req: workspace=${workspaceId}, roomId=${roomId} -> ${cleanRoomId}`);
    
    const meetingQuery = { roomId: cleanRoomId };
    if (workspaceId && workspaceId !== 'undefined' && workspaceId !== 'null') {
       meetingQuery.workspaceId = workspaceId;
    }

    let meeting = await Meeting.findOne(meetingQuery).sort({ createdAt: -1 });

    // Fallback: If not found in specific workspace, try finding it anywhere
    if (!meeting) {
       console.log(`📡 [VALIDATE] Meeting ${cleanRoomId} not found in ${workspaceId}, trying global search...`);
       meeting = await Meeting.findOne({ roomId: cleanRoomId }).sort({ createdAt: -1 });
    }

    if (!meeting) {
       console.log(`❌ [VALIDATE] Meeting not found for ${cleanRoomId} globally`);
       return res.json({ valid: false, error: 'Invalid meeting code' });
    }
    console.log(`✅ [VALIDATE] Found meeting: ${meeting.title}, Status: ${meeting.status}`);
    
    // Support both hashed and legacy plain text passwords
    const isPasswordMatch = meeting.password?.startsWith('$2b$') 
        ? await bcrypt.compare(password || '', meeting.password)
        : (meeting.password === password || !meeting.password);

    if (!isPasswordMatch) {
       return res.json({ valid: false, error: 'Incorrect meeting password' });
    }
    
    res.json({ valid: true, meeting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meetings/register — Register a new meeting in the DB
app.post('/api/meetings/register', async (req, res) => {
  try {
    const { workspaceId, title, host, hostEmail, roomId, startTime, password } = req.body;
    const cleanRoomId = roomId.trim().replace(/-/g, '').toUpperCase();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    
    // Ensure we don't have duplicates for Live meetings
    let meeting = await Meeting.findOne({ roomId: cleanRoomId, status: 'Live' });
    
    if (!meeting) {
      meeting = new Meeting({
        workspaceId: workspaceId || 'default',
        title: title || 'Quick Meeting',
        host,
        hostEmail,
        roomId: cleanRoomId,
        password: hashedPassword,
        startTime: startTime || new Date(),
        status: 'Live'
      });
      await meeting.save();
    }
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meetings/create — Create a scheduled meeting
app.post('/api/meetings/create', async (req, res) => {
  try {
    const { workspaceId, title, host, hostEmail, roomId, startTime, duration, password } = req.body;
    const cleanRoomId = roomId.trim().replace(/-/g, '').toUpperCase();
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const meeting = new Meeting({
      workspaceId: workspaceId || 'default',
      title,
      host,
      hostEmail,
      roomId: cleanRoomId,
      password: hashedPassword,
      startTime: new Date(startTime),
      duration: duration || 60,
      status: 'Scheduled'
    });
    await meeting.save();
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meetings — Fetch meeting history for a workspace
app.get('/api/meetings', async (req, res) => {
  const { workspaceId } = req.query;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

  try {
    const meetings = await Meeting.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meetings/:roomId/messages — Fetch chat history
app.get('/api/meetings/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const cleanRoomId = roomId.trim().replace(/-/g, '').toUpperCase();
    const messages = await Message.find({ channelId: cleanRoomId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meet/transcribe — Primary: Groq Whisper | Fallback: Gemini
app.post('/api/meet/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' });
  const filePath = req.file.path;

  // Try Groq First (Free and Fast)
  let groqError = null;
  if (groq) {
    // 1. Prepare file with proper extension for Groq
    const ext = path.extname(req.file.originalname) || '.mp3';
    const groqFilePath = `${filePath}${ext}`;
    
    try {
      fs.renameSync(filePath, groqFilePath);
      console.log(`📂 [GROQ] Transcribing: ${req.file.originalname}`);
      
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(groqFilePath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
      });
      console.log(`✅ [GROQ] Transcription successful.`);
      
      // Cleanup groq temp file
      fs.unlink(groqFilePath, () => {});
      return res.json({ transcript: transcription.text, segments: [] });
    } catch (err) {
      console.warn(`⚠️ [GROQ] failed:`, err.message);
      groqError = err.message;
      // If rename failed or transcribe failed, ensure original path is restored for Gemini fallback
      if (fs.existsSync(groqFilePath) && !fs.existsSync(filePath)) {
        fs.renameSync(groqFilePath, filePath);
      }
    }
  }

  // Fallback to Gemini
  if (genAI && fileManager) {
    try {
      console.log(`📂 [GEMINI] Uploading: ${req.file.originalname}`);
      const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: req.file.mimetype,
        displayName: req.file.originalname,
      });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1beta' });
      const result = await model.generateContent([
        { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
        "Transcribe this file accurately. Output only the transcript text."
      ]);

      const transcript = result.response.text();
      console.log(`✅ [GEMINI] Transcription successful.`);
      return res.json({ transcript, segments: [] });
    } catch (err) {
      console.error(`❌ [GEMINI] fallback failed:`, err.message);
      return res.status(500).json({ 
        error: `Transcription Failed. [Groq: ${groqError || 'Not Configured'}] [Gemini: ${err.message}]`
      });
    } finally {
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
  }

  res.status(503).json({ error: 'No AI transcription service configured.' });
});

// POST /api/meet/summarize — Primary: Groq Llama 3 | Fallback: Gemini
app.post('/api/meet/summarize', async (req, res) => {
  const { transcript, meetingTitle } = req.body;
  if (!transcript) return res.status(400).json({ error: 'No transcript provided.' });

  const prompt = `Analyze this meeting transcript and generate a structured summary in English.
  Output MUST be valid JSON:
  {
    "meetingTitle": "English Title",
    "summary": "2-3 sentence paragraph",
    "keyPoints": ["point 1", ...],
    "decisions": ["decision 1", ...],
    "actionItems": [{ "task": "task", "owner": "name", "deadline": "date" }],
    "risks": ["risk 1", ...],
    "followUps": ["followup 1", ...]
  }
  Transcript: ${transcript}`;

  // Try Groq First
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant", // Using a faster, more stable model
        response_format: { type: "json_object" },
      });
      
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from Groq");
      
      const parsedData = JSON.parse(content);
      return res.json(parsedData);
    } catch (err) {
      console.warn(`⚠️ [GROQ] Summarization failed, falling back to Gemini...`, err.message);
    }
  }

  // Fallback to Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      }, { apiVersion: 'v1beta' });
      const result = await model.generateContent(prompt);
      return res.json(JSON.parse(result.response.text()));
    } catch (err) {
      console.error('❌ Gemini summarization failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  res.status(503).json({ error: 'No AI summarization service configured.' });
});

// POST /api/meet/auto-process — Automatic background processing for ended meetings
app.post('/api/meet/auto-process', upload.single('audio'), async (req, res) => {
  const { roomId } = req.body;
  if (!req.file || !roomId) return res.status(400).json({ error: 'Missing file or roomId' });

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname) || '.mp3';
  const groqFilePath = `${filePath}${ext}`;

  res.json({ message: 'Processing started in background' }); // Return early to browser

  try {
    // 1. Rename for Groq
    fs.renameSync(filePath, groqFilePath);

    // 2. Transcribe
    let transcript = "";
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(groqFilePath),
        model: "whisper-large-v3",
      });
      transcript = transcription.text;
    } catch (e) {
      console.error("Auto-Transcribe failed:", e.message);
      // Fallback to Gemini if needed...
    }

    if (!transcript) throw new Error("No transcript generated");

    // 3. Summarize
    const prompt = `Analyze this meeting transcript and generate a structured summary in English.
    Output MUST be valid JSON:
    {
      "meetingTitle": "English Title",
      "summary": "2-3 sentence paragraph",
      "keyPoints": ["point 1", ...],
      "decisions": ["decision 1", ...],
      "actionItems": [{ "task": "task", "owner": "name", "deadline": "date" }],
      "risks": ["risk 1", ...],
      "followUps": ["followup 1", ...]
    }
    Transcript: ${transcript}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    });
    const summary = JSON.parse(completion.choices[0].message.content);

    // 4. Update Database
    const recordingUrl = `/recordings/${roomId}_${Date.now()}.mp3`;
    const permanentPath = path.join(__dirname, 'recordings', path.basename(recordingUrl));
    
    // Move file to permanent storage
    if (fs.existsSync(groqFilePath)) {
      fs.copyFileSync(groqFilePath, permanentPath);
    } else if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, permanentPath);
    }

    await Meeting.findOneAndUpdate(
      { roomId: roomId, status: { $ne: 'Ended' } }, 
      { 
        status: 'Ended',
        transcript: transcript,
        summary: summary,
        recordingUrl: recordingUrl
      },
      { sort: { createdAt: -1 } }
    );

    console.log(`✅ Auto-processed and stored recording for room: ${roomId}`);
  } catch (err) {
    console.error(`❌ Auto-process failed for ${roomId}:`, err.message);
  } finally {
    if (fs.existsSync(groqFilePath)) fs.unlink(groqFilePath, () => {});
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }
});
app.use('/recordings', express.static(path.join(__dirname, 'recordings')));
app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
export { app };
