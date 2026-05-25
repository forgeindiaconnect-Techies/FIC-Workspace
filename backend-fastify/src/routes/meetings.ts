import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { Schema, Types } from 'mongoose';
import { Meeting } from '../models/Meeting';
import { Participant } from '../models/Participant';
import { Recording } from '../models/Recording';
import { authenticate } from '../middlewares/auth';

export async function meetingRoutes(fastify: FastifyInstance) {
  
  // Helper: Generate Unique 9-Digit Join Code (e.g. 592-381-042)
  async function generate9DigitJoinCode(): Promise<string> {
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

  function normalizeJoinCode(code: string): string {
    const trimmed = String(code || '').trim().toUpperCase();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 9) {
      return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return trimmed;
  }

  async function resolveMeetingIdentifier(idOrCode: string) {
    const value = String(idOrCode || '').trim();
    if (Types.ObjectId.isValid(value)) {
      return Meeting.findById(value);
    }

    return Meeting.findOne({ joinCode: normalizeJoinCode(value) });
  }

  // 1. CREATE MEETING
  fastify.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { title, passcode, durationMinutes, scheduledAt, recordingEnabled } = request.body as any;
      if (!title) {
        return reply.code(400).send({ error: 'Meeting title is required.' });
      }

      const joinCode = await generate9DigitJoinCode();
      let passcodeHash: string | undefined;

      if (passcode) {
        passcodeHash = await bcrypt.hash(passcode, 10);
      }

      const meeting = await Meeting.create({
        title,
        hostId: new Types.ObjectId(request.user!.id),
        joinCode,
        passcodeHash,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        durationMinutes: durationMinutes || 60,
        recordingEnabled: !!recordingEnabled,
        status: 'scheduled',
        participantIds: [new Types.ObjectId(request.user!.id)]
      });

      // Register host as participant
      await Participant.create({
        meetingId: meeting._id,
        userId: new Types.ObjectId(request.user!.id),
        role: 'host',
        joinedAt: new Date(),
        audioMuted: false,
        videoMuted: false
      });

      // Fire Webhook event to the web application
      const webhookUrl = `${process.env.WEB_APP_URL || 'http://localhost:3000'}/api/webhooks/meetings`;
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET || 'nexus_webhook_secure_secret_123'
        },
        body: JSON.stringify({
          event: 'meeting.created',
          data: {
            workspaceId: 'antigraviity-hq',
            title: meeting.title,
            host: request.user!.name || 'Host User',
            hostEmail: request.user!.email || 'host@antigraviity.com',
            roomId: meeting.joinCode.replace(/-/g, ''),
            startTime: meeting.scheduledAt,
            duration: meeting.durationMinutes,
            password: passcode
          }
        })
      }).then(res => {
        console.log(`🪝 [WEBHOOK] Successfully dispatched meeting.created: Status ${res.status}`);
      }).catch(err => {
        console.error('🪝 [WEBHOOK] dispatch failed:', err.message);
      });

      return reply.code(201).send(meeting);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create meeting room.', details: err.message });
    }
  });

  // 2. RESOLVE JOIN CODE -> MEETING DOC
  fastify.get('/join/:code', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code } = request.params as any;
      const { passcode } = request.query as any;
      
      const cleanCode = normalizeJoinCode(String(code || ''));
      let meeting = await resolveMeetingIdentifier(cleanCode);

      const persistentRoomTitles: Record<string, string> = {
        'NEXUS-BOARDROOM': '🌌 General Boardroom',
        'NEXUS-ENG': '💻 Developer Sandbox',
        'NEXUS-DESIGN': '🎨 UX Design Workshop'
      };

      if (!meeting && persistentRoomTitles[cleanCode]) {
        // Automatically spin up the persistent meeting room document in MongoDB
        meeting = await Meeting.create({
          title: persistentRoomTitles[cleanCode],
          hostId: new Types.ObjectId(request.user!.id),
          joinCode: cleanCode,
          scheduledAt: new Date(),
          durationMinutes: 9999, // Persistent room has unlimited duration
          status: 'live',
          participantIds: [new Types.ObjectId(request.user!.id)]
        });
      }

      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting not found for this join code.' });
      }

      if (!meeting.populated('hostId')) {
        await meeting.populate('hostId', 'name email avatarUrl');
      }

      if (meeting.status === 'ended') {
        return reply.code(410).send({ error: 'This meeting has already ended.' });
      }

      if (meeting.passcodeHash) {
        const isPasscodeValid = passcode && await bcrypt.compare(String(passcode), meeting.passcodeHash);
        if (!isPasscodeValid) {
          return reply.code(401).send({ error: 'Invalid meeting passcode.' });
        }
      }

      const userId = new Types.ObjectId(request.user!.id);
      const hostId = (meeting.hostId as any)._id?.toString?.() || meeting.hostId.toString();
      await Participant.findOneAndUpdate(
        { meetingId: meeting._id, userId },
        {
          $set: {
            meetingId: meeting._id,
            userId,
            role: hostId === request.user!.id ? 'host' : 'attendee',
            joinedAt: new Date()
          },
          $unset: { leftAt: '' }
        },
        { upsert: true, new: true }
      );

      await Meeting.updateOne(
        { _id: meeting._id },
        {
          $addToSet: { participantIds: userId },
          ...(meeting.status === 'scheduled' ? { $set: { status: 'live' } } : {})
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
        status: meeting.status === 'scheduled' ? 'live' : meeting.status,
        hasPasscode: !!meeting.passcodeHash,
        participantIds: meeting.participantIds,
        activeParticipantCount,
        isHost: hostId === request.user!.id
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error resolving meeting join code.', details: err.message });
    }
  });

  // 3. FETCH SINGLE MEETING WITH PARTICIPANT COUNT
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'Invalid meeting ID format.' });
      }

      const meeting = await Meeting.findById(id).populate('hostId', 'name email avatarUrl');
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting room not found.' });
      }

      const activeCount = await Participant.countDocuments({
        meetingId: meeting._id,
        leftAt: { $exists: false }
      });

      return reply.code(200).send({
        meeting,
        activeParticipantCount: activeCount
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error fetching meeting properties.', details: err.message });
    }
  });

  // 4. UPDATE MEETING (Host only)
  fastify.patch('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { title, scheduledAt, durationMinutes, recordingEnabled } = request.body as any;

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'Invalid meeting ID.' });
      }

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting not found.' });
      }

      // Authorize host
      if (meeting.hostId.toString() !== request.user!.id) {
        return reply.code(403).send({ error: 'Forbidden: Only the room host can update meeting settings.' });
      }

      if (title !== undefined) meeting.title = title;
      if (scheduledAt !== undefined) meeting.scheduledAt = new Date(scheduledAt);
      if (durationMinutes !== undefined) meeting.durationMinutes = durationMinutes;
      if (recordingEnabled !== undefined) meeting.recordingEnabled = !!recordingEnabled;

      await meeting.save();
      return reply.code(200).send(meeting);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update meeting configs.', details: err.message });
    }
  });

  // 5. START MEETING (Host only)
  fastify.post('/:id/start', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting room not found.' });
      }

      if (meeting.hostId.toString() !== request.user!.id) {
        return reply.code(403).send({ error: 'Forbidden: Only the host can launch this session.' });
      }

      if (meeting.status === 'ended') {
        return reply.code(400).send({ error: 'Cannot start a session that has already finished.' });
      }

      meeting.status = 'live';
      await meeting.save();

      // Trigger WebSockets alert through Fastify instance if socket system is attached
      if ((fastify as any).websocketServer) {
        (fastify as any).websocketServer.clients.forEach((client: any) => {
          client.send(JSON.stringify({
            event: 'meeting-started',
            data: { meetingId: meeting._id, title: meeting.title }
          }));
        });
      }

      // Fire Webhook event to the web application
      const webhookUrl = `${process.env.WEB_APP_URL || 'http://localhost:3000'}/api/webhooks/meetings`;
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET || 'nexus_webhook_secure_secret_123'
        },
        body: JSON.stringify({
          event: 'meeting.started',
          data: {
            roomId: meeting.joinCode.replace(/-/g, ''),
            status: 'Live'
          }
        })
      }).then(res => {
        console.log(`🪝 [WEBHOOK] Successfully dispatched meeting.started: Status ${res.status}`);
      }).catch(err => {
        console.error('🪝 [WEBHOOK] dispatch failed:', err.message);
      });

      return reply.code(200).send({ success: true, status: 'live', meeting });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to boot meeting session.', details: err.message });
    }
  });

  // 6. END MEETING & TRIGGER RECORDING
  fastify.post('/:id/end', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting room not found.' });
      }

      if (meeting.hostId.toString() !== request.user!.id) {
        return reply.code(403).send({ error: 'Forbidden: Only the host can terminate this session.' });
      }

      meeting.status = 'ended';
      await meeting.save();

      // Fire Webhook event to the web application
      const webhookUrl = `${process.env.WEB_APP_URL || 'http://localhost:3000'}/api/webhooks/meetings`;
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET || 'nexus_webhook_secure_secret_123'
        },
        body: JSON.stringify({
          event: 'meeting.ended',
          data: {
            roomId: meeting.joinCode.replace(/-/g, ''),
            status: 'Ended'
          }
        })
      }).then(res => {
        console.log(`🪝 [WEBHOOK] Successfully dispatched meeting.ended: Status ${res.status}`);
      }).catch(err => {
        console.error('🪝 [WEBHOOK] dispatch failed:', err.message);
      });

      // Invalidate all lingering participants
      await Participant.updateMany(
        { meetingId: meeting._id, leftAt: { $exists: false } },
        { leftAt: new Date() }
      );

      // Trigger Cloudflare R2 Recording finalizing if enabled
      let recordingDoc = null;
      if (meeting.recordingEnabled) {
        const durationSeconds = Math.floor((Date.now() - meeting.scheduledAt.getTime()) / 1000);
        recordingDoc = await Recording.create({
          meetingId: meeting._id,
          r2Key: `recordings/${meeting._id}_stream.mp4`,
          durationSeconds: Math.max(60, durationSeconds),
          sizeBytes: Math.floor(Math.random() * 20000000) + 5000000, // 5MB to 25MB mock
          status: 'processing'
        });
      }

      return reply.code(200).send({ 
        success: true, 
        status: 'ended', 
        recordingTriggered: meeting.recordingEnabled, 
        recording: recordingDoc 
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to end meeting properly.', details: err.message });
    }
  });

  // 6b. LEAVE MEETING WITHOUT ENDING THE SHARED ROOM
  fastify.post('/:id/leave', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const meeting = await resolveMeetingIdentifier(id);
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting room not found.' });
      }

      await Participant.findOneAndUpdate(
        {
          meetingId: meeting._id,
          userId: new Types.ObjectId(request.user!.id),
          leftAt: { $exists: false }
        },
        { leftAt: new Date() },
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
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to leave meeting.', details: err.message });
    }
  });

  // 7. MEETING HISTORY (Paginated list of hosted or attended meetings)
  fastify.get('/history', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 10 } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const userId = new Types.ObjectId(request.user!.id);

      // Find all meetings where the user was either the host or registered as participant
      const meetings = await Meeting.find({
        $or: [
          { hostId: userId },
          { participantIds: userId }
        ]
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('hostId', 'name email avatarUrl');

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
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to retrieve history logs.', details: err.message });
    }
  });

  // 8. GET ACTIVE PARTICIPANTS
  fastify.get('/:id/participants', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      
      const meeting = await resolveMeetingIdentifier(id);
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting not found.' });
      }

      const participants = await Participant.find({
        meetingId: meeting._id,
        leftAt: { $exists: false }
      }).populate('userId', 'name email avatarUrl');

      // Map DB schema participants into clean view-ready objects
      const mapped = participants.map((p: any) => {
        const userObj = p.userId || {};
        return {
          id: p._id.toString(),
          userId: userObj._id?.toString() || p.userId?.toString() || 'unknown',
          name: userObj.name || 'Anonymous Peer',
          email: userObj.email || '',
          avatar: (userObj.name || 'AP').slice(0, 2).toUpperCase(),
          role: p.role,
          audioMuted: p.audioMuted,
          videoMuted: p.videoMuted,
          joinedAt: p.joinedAt
        };
      });

      return reply.code(200).send(mapped);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to retrieve active participants.', details: err.message });
    }
  });

  // 9. GENERATE AI SUMMARY (Groq / Gemini Integration)
  fastify.post('/:id/summarize', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'Invalid meeting ID format.' });
      }

      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting room not found.' });
      }

      if (meeting.status !== 'ended') {
        return reply.code(400).send({ error: 'Summaries can only be generated for completed meetings.' });
      }

      // If summary already generated, return it from cache
      if (meeting.aiSummary) {
        return reply.code(200).send({ summary: meeting.aiSummary });
      }

      // 1. Simulate Audio to Text transcription pipeline
      // In production, this would use deepgram or whisper on the stored meeting.recordingEnabled Cloudflare R2 file.
      const simulatedTranscript = `
        Host: Welcome everyone to the Q3 planning sync. We need to finalize the roadmap.
        Sarah: I've prepared the front-end milestones. We'll be migrating the dashboard to React Native next week.
        Host: Excellent. What's the timeline on the backend API alignment?
        Michael: I'll have the Fastify endpoints ready by Thursday. We're prioritizing WebSockets.
        Host: Great. Let's make sure Sarah and Michael sync up on the WebSocket payload structures.
        Sarah: Will do. I'll schedule a brief 15-minute sync with Michael tomorrow.
        Host: Perfect. That wraps up our primary agenda. Thanks everyone.
      `;

      // 2. AI Prompt Formulation
      const prompt = `
        Analyze the following meeting transcript and generate a highly professional, beautifully formatted markdown Executive Summary.
        Include:
        - A brief 2-sentence Executive Overview.
        - Key Decisions Made (bullet points).
        - Action Items (with assigned owners).
        
        Transcript:
        ${simulatedTranscript}
      `;

      let generatedSummary = '';

      // 3. Fallback to Local/Mock Generation if API keys are missing to ensure robust demo continuity
      const groqKey = process.env.GROQ_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;

      if (groqKey) {
        // Groq Fast Inference API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await response.json() as any;
        generatedSummary = data.choices?.[0]?.message?.content || '';
      } else if (geminiKey) {
        // Gemini API integration
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        const data = await response.json() as any;
        generatedSummary = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // High-Fidelity Fallback Markdown if no API keys provided
        generatedSummary = `### 📝 Executive Overview
The team convened for the Q3 planning sync to finalize the product roadmap. The primary focus was on aligning front-end migration milestones with backend API deliverables to ensure a seamless transition.

### 🎯 Key Decisions Made
* **Frontend Migration:** The dashboard will be migrated to React Native starting next week.
* **Backend Priorities:** Fastify API endpoints, with a specific focus on WebSockets, will be completed by Thursday.

### 🚀 Action Items
* **[Sarah]** - Execute the dashboard React Native migration.
* **[Michael]** - Deliver the Fastify API endpoints (WebSockets) by Thursday.
* **[Sarah & Michael]** - Conduct a 15-minute sync tomorrow to finalize WebSocket payload structures.`;
      }

      // 4. Save to DB and Return
      meeting.aiSummary = generatedSummary;
      await meeting.save();

      return reply.code(200).send({ summary: meeting.aiSummary });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to generate AI summary.', details: err.message });
    }
  });
}
