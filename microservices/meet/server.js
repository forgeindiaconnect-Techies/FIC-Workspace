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
      meetingId: joinCode,
      title,
      hostId: req.user.id,
      hostName: req.user.name || 'Host',
      hostEmail: req.user.email || 'host@nexus.com',
      workspaceId: req.user.workspaceId || req.body.workspaceId || 'default',
      joinCode,
      passcodeHash,
      scheduledAt: scheduledAt || startTime ? new Date(scheduledAt || startTime) : new Date(),
      durationMinutes: durationMinutes || duration || 60,
      recordingEnabled: !!recordingEnabled,
      status: 'scheduled',
      aiEnabled: req.body.aiEnabled || false,
      participants: [{
        userId: req.user.id,
        name: req.user.name || 'Host',
        email: req.user.email || 'host@nexus.com',
        joinedAt: new Date()
      }],
      participantIds: [new mongoose.Types.ObjectId(req.user.id)]
    });

    // --- AI Assistant Notification Feature ---
    if (req.user.workspaceId) {
      // Fetch team members in the same workspace (excluding the host)
      const teamMembers = await User.find({
        workspaceId: req.user.workspaceId,
        _id: { $ne: new mongoose.Types.ObjectId(req.user.id) }
      });

      if (teamMembers.length > 0) {
        const meetingTime = new Date(meeting.scheduledAt).toLocaleString();
        const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
        const webLink = `${origin}/w/${req.user.workspaceId || 'default'}/meet/room/${joinCode}${plainPasscode ? `?pwd=${encodeURIComponent(plainPasscode)}&intent=join` : '?intent=join'}`;
        const mobileLink = `nexus-workspace://meet/room/${joinCode}${plainPasscode ? `?pwd=${encodeURIComponent(plainPasscode)}` : ''}`;
        
        const mailBody = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
    <h2 style="color: #2563eb;">Meeting Invitation: ${title}</h2>
    <p>Hi there,</p>
    <p>You have been invited by <strong>${req.user.name}</strong> to join a Forge India Connect meeting.</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong> ${meetingTime}</p>
      <p style="margin: 0 0 10px 0;"><strong>Duration:</strong> ${meeting.durationMinutes} minutes</p>
      <p style="margin: 0 0 10px 0;"><strong>Room Code:</strong> <span style="font-family: monospace; font-size: 16px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${joinCode}</span></p>
      ${plainPasscode ? `<p style="margin: 0;"><strong>Passcode:</strong> ${plainPasscode}</p>` : ''}
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

        const mailPromises = teamMembers.map(member => {
          return Mail.create({
            workspaceId: req.user.workspaceId,
            ownerEmail: member.email,
            folder: 'inbox',
            senderName: 'Forge India Connect AI',
            senderEmail: 'nexus-ai@workspace.app',
            recipientEmails: [member.email],
            subject: `Invitation: ${title}`,
            body: mailBody,
            isRead: false
          });
        });

        await Promise.allSettled(mailPromises);
        console.log(`[Meetings Service] AI Assistant sent ${teamMembers.length} meeting HTML notifications.`);
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
      const isHost = meeting.hostId.toString() === req.user.id;
      const isParticipant = meeting.participantIds && meeting.participantIds.some(id => id.toString() === req.user.id);
      
      if (!isHost && !isParticipant) {
        const isPasscodeValid = passcode && await bcrypt.compare(String(passcode), meeting.passcodeHash);
        if (!isPasscodeValid) {
          return res.status(401).json({ error: 'Invalid meeting passcode.' });
        }
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
      aiEnabled: !!meeting.aiEnabled,
      participantIds: meeting.participantIds,
      isHost: meeting.hostId.toString() === req.user.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Error resolving meeting join code.', details: err.message });
  }
});

// 3. MEETING HISTORY
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

// 4. FETCH SINGLE MEETING WITH DETAILS
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

// START AI BOT
app.post('/api/meetings/:id/start-ai', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (meeting) {
      meeting.aiEnabled = true;
      await meeting.save();
    }
    // Return success so frontend sets aiAssistantActive = true
    res.json({ success: true, message: 'AI Assistant started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start AI', details: err.message });
  }
});

// ICE SERVERS (TURN/STUN)
app.get('/api/meet/ice-servers', (req, res) => {
  res.json([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]);
});

// SUMMARIZE MEETING
app.post('/api/meetings/:id/summarize', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    
    let participants = await User.find({ _id: { $in: meeting.participantIds } });
    if (participants.length === 0) {
      const fallbackUser = await User.findById(req.user.id || meeting.hostId);
      if (fallbackUser) participants = [fallbackUser];
    }
    
    if (participants.length === 0) return res.status(400).json({ error: 'No participants found to send summary.' });

    // ── Read actual transcripts from the database ──
    const TranscriptModel = mongoose.models.Transcript || mongoose.model('Transcript', new mongoose.Schema({
      meetingId: String,
      userId: String,
      speakerName: String,
      text: String,
      timestamp: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now }
    }));

    const transcripts = await TranscriptModel.find({ meetingId: id }).sort({ timestamp: 1 });
    const hasTranscripts = transcripts && transcripts.length > 0;

    let summaryHtml;

    if (hasTranscripts && process.env.GROQ_API_KEY) {
      // ── Build transcript text from real data ──
      const fullText = transcripts.map(t => `[${t.speakerName}]: ${t.text}`).join('\n');
      console.log(`[Summarizer] Summarizing ${transcripts.length} transcript chunks (${fullText.length} chars) for meeting "${meeting.title}"...`);

      // ── Call Groq AI for real summarization ──
      const { default: Groq } = await import('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      const prompt = `You are an expert Executive Assistant. Summarize the following meeting transcript.
Your response MUST be formatted in clean HTML suitable for an email body.
Do NOT use markdown. Use bold tags, lists, and headers (h2, h3).
Include the following sections exactly:

<h2>Executive Summary</h2>
(Brief 2-3 sentences overview of what was discussed)

<h2>Main Topics Discussed</h2>
<ul><li>Topic 1</li></ul>

<h2>Key Decisions Made</h2>
<ul><li>Decision 1</li></ul>

<h2>Action Items</h2>
<ul><li><strong>[Owner Name]</strong> Task description (Deadline if any)</li></ul>

<h2>Follow-ups & Next Steps</h2>
<ul><li>Follow-up 1</li></ul>

Meeting Title: ${meeting.title}
Participants: ${participants.map(p => p.name).join(', ')}

Here is the meeting transcript:
${fullText}`;

      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          max_tokens: 2500,
        });

        const aiSummaryContent = chatCompletion.choices[0]?.message?.content || '';
        console.log(`[Summarizer] AI summary generated (${aiSummaryContent.length} chars).`);

        summaryHtml = `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
            <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 24px 28px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">📋 Meeting Summary</h1>
              <p style="color: #bfdbfe; margin: 6px 0 0; font-size: 14px;">${meeting.title}</p>
            </div>
            <div style="background: #fff; padding: 24px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>Participants:</strong> ${participants.map(p => p.name).join(', ')}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;"><strong>Transcribed Segments:</strong> ${transcripts.length}</p>
              </div>
              ${aiSummaryContent}
            </div>
            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">Sent by Forge India Connect AI · This summary was AI-generated from the live meeting audio.</p>
          </div>`;
      } catch (aiErr) {
        console.error('[Summarizer] Groq AI failed:', aiErr.message);
        // Fall through to the no-transcript path
        summaryHtml = null;
      }
    }

    if (!summaryHtml) {
      // ── Fallback: No transcripts captured or AI failed ──
      const duration = meeting.scheduledAt
        ? Math.round((Date.now() - new Date(meeting.scheduledAt).getTime()) / 60000)
        : (meeting.durationMinutes || 0);

      summaryHtml = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <div style="background: linear-gradient(135deg, #1e40af, #7c3aed); padding: 24px 28px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">✅ Meeting Completed</h1>
            <p style="color: #bfdbfe; margin: 6px 0 0; font-size: 14px;">${meeting.title}</p>
          </div>
          <div style="background: #fff; padding: 24px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">Meeting Details</h2>
            <ul style="color: #475569; line-height: 1.8;">
              <li><strong>Title:</strong> ${meeting.title}</li>
              <li><strong>Duration:</strong> ~${duration} minutes</li>
              <li><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
              <li><strong>Participants:</strong> ${participants.map(p => p.name).join(', ')}</li>
              <li><strong>Status:</strong> Completed</li>
            </ul>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 16px; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">
                <strong>Note:</strong> No audio transcript was captured for this meeting. 
                To receive full AI-generated summaries with key decisions and action items, ensure your microphone is active and unmuted during the meeting.
              </p>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">Sent by Forge India Connect AI</p>
        </div>`;
    }

    // Send email to all participants
    for (const participant of participants) {
      await Mail.create({
        workspaceId: meeting.workspaceId || 'antigraviity-hq',
        ownerEmail: participant.email,
        folder: 'inbox',
        senderName: 'Forge India Connect AI',
        senderEmail: 'ai-assistant@nexus.app',
        recipientEmails: [participant.email],
        subject: `📋 Meeting Summary: ${meeting.title}`,
        body: summaryHtml,
        isRead: false
      });
      
      try {
        fetch('http://localhost:3105/internal/new-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientEmail: participant.email, mail: {} })
        }).catch(() => {});
      } catch (e) {}
    }

    res.json({ success: true, message: 'Summary email sent to all participants.' });
  } catch (err) {
    console.error('[Summarizer] Error:', err.message);
    res.status(500).json({ error: 'Failed to summarize', details: err.message });
  }
});

// END MEETING (Host only)
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
