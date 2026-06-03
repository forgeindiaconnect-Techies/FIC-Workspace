import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectMongo, Meeting, User, Mail } from '../shared/database.js';
import { authenticate } from '../shared/auth.js';

const app = express();
app.use(express.json());

// Database connection check middleware
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database service unavailable' });
  }
});

// Helper: Generate Unique 9-Digit Join Code (e.g. 592-381-042)
async function generate9DigitJoinCode(preferredCode) {
  const normalizedPreferredCode = preferredCode ? normalizeJoinCode(preferredCode) : '';
  if (normalizedPreferredCode) {
    const existing = await Meeting.findOne({ joinCode: normalizedPreferredCode });
    if (!existing) {
      return normalizedPreferredCode;
    }
  }

  let attempts = 0;
  while (attempts < 10) {
    const code = Math.floor(100000000 + Math.random() * 900000000).toString();
    const formatted = `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6)}`;
    
    const existing = await Meeting.findOne({ joinCode: formatted });
    if (!existing) {
      return formatted;
    }
    attempts++;
  }
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function normalizeJoinCode(code) {
  const trimmed = String(code || '').trim().toUpperCase();
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 9) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  return trimmed;
}

// 1. CREATE MEETING
app.post('/api/meetings', authenticate, async (req, res) => {
  try {
    const { title, passcode, password, roomId, joinCode: requestedJoinCode, durationMinutes, duration, scheduledAt, startTime, recordingEnabled } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Meeting title is required.' });
    }

    const joinCode = await generate9DigitJoinCode(requestedJoinCode || roomId);
    const plainPasscode = passcode ?? password;
    let passcodeHash;

    if (plainPasscode) {
      passcodeHash = await bcrypt.hash(String(plainPasscode), 10);
    }

    const meeting = await Meeting.create({
      title,
      hostId: new mongoose.Types.ObjectId(req.user.id),
      joinCode,
      passcodeHash,
      scheduledAt: scheduledAt || startTime ? new Date(scheduledAt || startTime) : new Date(),
      durationMinutes: durationMinutes || duration || 60,
      recordingEnabled: !!recordingEnabled,
      status: 'scheduled',
      participantIds: [new mongoose.Types.ObjectId(req.user.id)]
    });

    // --- AI Assistant Notification Feature ---
    if (req.user.role && req.user.role.toLowerCase() === 'admin' && req.user.workspaceId) {
      // Fetch team members in the same workspace (excluding the admin)
      const teamMembers = await User.find({
        workspaceId: req.user.workspaceId,
        _id: { $ne: new mongoose.Types.ObjectId(req.user.id) }
      });

      if (teamMembers.length > 0) {
        const meetingTime = new Date(meeting.scheduledAt).toLocaleString();
        
        const mailPromises = teamMembers.map(member => {
          return Mail.create({
            workspaceId: req.user.workspaceId,
            ownerEmail: member.email,
            folder: 'inbox',
            senderName: 'Nexus AI Assistant',
            senderEmail: 'ai@nexus.com',
            recipientEmails: [member.email],
            subject: `New Meeting Scheduled: ${title}`,
            body: `Hello ${member.name},\n\nA new meeting "${title}" has been scheduled by ${req.user.name} for ${meetingTime}.\n\nMeeting Join Code: ${joinCode}\n\nPlease be prepared to join at the scheduled time.\n\nBest,\nNexus AI Assistant`,
            isRead: false
          });
        });

        await Promise.allSettled(mailPromises);
        console.log(`[Meetings Service] AI Assistant sent ${teamMembers.length} meeting notifications.`);
      }
    }
    // ------------------------------------------

    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create meeting room.', details: err.message });
  }
});

// 2. RESOLVE JOIN CODE -> MEETING DOC
app.get('/api/meetings/join/:code', authenticate, async (req, res) => {
  try {
    const { code } = req.params;
    const { passcode } = req.query;
    
    const cleanCode = normalizeJoinCode(String(code || ''));
    let meeting = await Meeting.findOne({ joinCode: cleanCode });

    const persistentRoomTitles = {
      'NEXUS-BOARDROOM': '🌌 General Boardroom',
      'NEXUS-ENG': '💻 Developer Sandbox',
      'NEXUS-DESIGN': '🎨 UX Design Workshop'
    };

    if (!meeting && persistentRoomTitles[cleanCode]) {
      meeting = await Meeting.create({
        title: persistentRoomTitles[cleanCode],
        hostId: new mongoose.Types.ObjectId(req.user.id),
        joinCode: cleanCode,
        scheduledAt: new Date(),
        durationMinutes: 9999,
        status: 'live',
        participantIds: [new mongoose.Types.ObjectId(req.user.id)]
      });
    }

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found for this join code.' });
    }

    if (meeting.status === 'ended') {
      return res.status(410).json({ error: 'This meeting has already ended.' });
    }

    if (meeting.passcodeHash) {
      const isPasscodeValid = passcode && await bcrypt.compare(String(passcode), meeting.passcodeHash);
      if (!isPasscodeValid) {
        return res.status(401).json({ error: 'Invalid meeting passcode.' });
      }
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);
    
    await Meeting.updateOne(
      { _id: meeting._id },
      {
        $addToSet: { participantIds: userId },
        $set: { status: 'live' }
      }
    );

    res.json({
      _id: meeting._id,
      meetingId: meeting._id,
      joinCode: meeting.joinCode,
      roomId: meeting.joinCode,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      durationMinutes: meeting.durationMinutes,
      status: 'live',
      hasPasscode: !!meeting.passcodeHash,
      participantIds: meeting.participantIds,
      isHost: meeting.hostId.toString() === req.user.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Error resolving meeting join code.', details: err.message });
  }
});

// 3. FETCH SINGLE MEETING WITH DETAILS
app.get('/api/meetings/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid meeting ID format.' });
    }

    const meeting = await Meeting.findById(id).populate('hostId', 'name email avatarUrl');
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting room not found.' });
    }

    res.json({
      meeting,
      activeParticipantCount: meeting.participantIds.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching meeting properties.', details: err.message });
  }
});

// 4. MEETING HISTORY
app.get('/api/meetings/history', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const meetings = await Meeting.find({
      $or: [
        { hostId: userId },
        { participantIds: userId }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Meeting.countDocuments({
      $or: [
        { hostId: userId },
        { participantIds: userId }
      ]
    });

    res.json({
      meetings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve history logs.', details: err.message });
  }
});

// 5. END MEETING (Host only)
app.post('/api/meetings/:id/end', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting room not found.' });
    }

    if (meeting.hostId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only the host can terminate this session.' });
    }

    meeting.status = 'ended';
    await meeting.save();

    res.json({ success: true, status: 'ended', meeting });
  } catch (err) {
    res.status(500).json({ error: 'Failed to end meeting properly.', details: err.message });
  }
});

// 6. LEAVE MEETING
app.post('/api/meetings/:id/leave', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    res.json({ success: true, message: 'Left meeting successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave meeting.', details: err.message });
  }
});

// 7. GET ACTIVE PARTICIPANTS
app.get('/api/meetings/:id/participants', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id).populate('participantIds', 'name email avatarUrl');
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const mapped = meeting.participantIds.map((u) => ({
      userId: u._id.toString(),
      name: u.name,
      email: u.email,
      avatar: u.name.slice(0, 2).toUpperCase()
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve active participants.', details: err.message });
  }
});

// Health Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'meetings-service' });
});

const PORT = 3103;
app.listen(PORT, () => {
  console.log(`📹 [Meetings Service] Running on http://localhost:${PORT}`);
});
