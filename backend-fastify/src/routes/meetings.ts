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

      return reply.code(201).send(meeting);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create meeting room.', details: err.message });
    }
  });

  // 2. RESOLVE JOIN CODE -> MEETING DOC
  fastify.get('/join/:code', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { code } = request.params as any;
      
      // Allow formatted (123-456-789) or clean digits (123456789)
      let normCode = code.trim();
      if (!normCode.includes('-') && normCode.length === 9) {
        normCode = `${normCode.slice(0, 3)}-${normCode.slice(3, 6)}-${normCode.slice(6)}`;
      }

      const meeting = await Meeting.findOne({ joinCode: normCode })
        .populate('hostId', 'name email avatarUrl');

      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting not found for this join code.' });
      }

      if (meeting.status === 'ended') {
        return reply.code(410).send({ error: 'This meeting has already ended.' });
      }

      return reply.code(200).send({
        meetingId: meeting._id,
        title: meeting.title,
        host: meeting.hostId,
        scheduledAt: meeting.scheduledAt,
        durationMinutes: meeting.durationMinutes,
        status: meeting.status,
        hasPasscode: !!meeting.passcodeHash
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
      
      let meetingIdStr = id;
      // If it's a joinCode, resolve it to meeting ID first!
      if (!Types.ObjectId.isValid(id)) {
        const found = await Meeting.findOne({ joinCode: id });
        if (found) {
          meetingIdStr = found._id.toString();
        } else {
          return reply.code(404).send({ error: 'Meeting not found.' });
        }
      }

      const participants = await Participant.find({
        meetingId: new Types.ObjectId(meetingIdStr),
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
