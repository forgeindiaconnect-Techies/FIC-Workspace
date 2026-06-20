import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { Schema, Types } from 'mongoose';
import { Meeting } from '../models/Meeting';
import { Participant } from '../models/Participant';
import { Recording } from '../models/Recording';
import { User } from '../models/User';
import { Mail } from '../models/Mail';
import { Room } from '../models/Room';
import { Transcript } from '../models/Transcript';
import { authenticate } from '../middlewares/auth';
import { launchAIBot, stopAIBot } from '../services/aiBot';
import { summarizeMeeting } from '../services/summarizer';

export async function meetingRoutes(fastify: FastifyInstance) {
  
  // Helper: Generate Unique 9-Digit Join Code (e.g. 592-381-042)
  async function generate9DigitJoinCode(preferredCode?: string): Promise<string> {
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
      } = request.body as any;
      if (!title) {
        return reply.code(400).send({ error: 'Meeting title is required.' });
      }

      const joinCode = await generate9DigitJoinCode(requestedJoinCode || roomId);
      const plainPasscode = passcode ?? password;
      let passcodeHash: string | undefined;

      if (plainPasscode) {
        passcodeHash = await bcrypt.hash(String(plainPasscode), 10);
      }

      const meeting = await Meeting.create({
        title,
        hostId: new Types.ObjectId(request.user!.id),
        joinCode,
        passcodeHash,
        scheduledAt: scheduledAt || startTime ? new Date(scheduledAt || startTime) : new Date(),
        durationMinutes: durationMinutes || duration || 60,
        recordingEnabled: !!recordingEnabled,
        aiEnabled: !!aiEnabled,
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
            password: plainPasscode
          }
        })
      }).then(res => {
        console.log(` [WEBHOOK] Successfully dispatched meeting.created: Status ${res.status}`);
      }).catch(err => {
        console.error(' [WEBHOOK] dispatch failed:', err.message);
      });

      // Send AI email invitations to all team members in the workspace
      try {
        const workspaceId = request.user?.workspaceId || 'antigraviity-hq';
        const allUsers = await User.find({ workspaceId });
        const targetEmails = allUsers.map(u => u.email).filter(e => e !== request.user!.email);

        if (targetEmails.length > 0) {
          const timeStr = (scheduledAt || startTime) ? new Date(scheduledAt || startTime).toLocaleString() : 'Now';
          const reqOrigin = request.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
          const origin = reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1') ? 'https://workspace-blue-theta-87.vercel.app' : reqOrigin;
          const webLink = `${origin}/w/${workspaceId}/meet/room/${joinCode}${plainPasscode ? `?pwd=${encodeURIComponent(plainPasscode)}&intent=join` : '?intent=join'}`;
          const mobileLink = `nexus://meet/room/${joinCode}${plainPasscode ? `?pwd=${encodeURIComponent(plainPasscode)}` : ''}`;
          
          const mailBody = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
    <h2 style="color: #2563eb;">Meeting Invitation: ${meeting.title}</h2>
    <p>Hi there,</p>
    <p>You have been invited by <strong>${request.user!.name}</strong> to join a Forge India Connect meeting.</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong> ${timeStr}</p>
      <p style="margin: 0 0 10px 0;"><strong>Duration:</strong> ${meeting.durationMinutes} minutes</p>
      <p style="margin: 0 0 10px 0;"><strong>Room Code:</strong> <span style="font-family: monospace; font-size: 16px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${meeting.joinCode}</span></p>
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

          for (const email of targetEmails) {
            Mail.create({
              workspaceId,
              ownerEmail: email,
              folder: 'inbox',
              senderName: 'Forge India Connect AI',
              senderEmail: 'nexus-ai@workspace.app',
              recipientEmails: [email],
              subject: `Invitation: ${meeting.title}`,
              body: mailBody,
              attachments: [],
              isRead: false
            }).catch((e: any) => console.error('Failed to create invite email for', email, e));
          }
        }
      } catch (e) {
        console.error('Failed to fetch workspace users for invitations', e);
      }

      return reply.code(201).send(meeting);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create meeting room.', details: err.message });
    }
  });

  // 2. RESOLVE JOIN CODE -> MEETING DOC
  fastify.get('/join/:code', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (request.user?.role === 'demo') {
        return reply.code(403).send({ error: 'Demo accounts cannot join meetings.' });
      }

      const { code } = request.params as any;
      const { passcode } = request.query as any;
      
      const cleanCode = normalizeJoinCode(String(code || ''));
      let meeting = await resolveMeetingIdentifier(cleanCode);

      const persistentRoomTitles: Record<string, string> = {
        'NEXUS-BOARDROOM': ' General Boardroom',
        'NEXUS-ENG': ' Developer Sandbox',
        'NEXUS-DESIGN': ' UX Design Workshop'
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
        const hostIdStr = (meeting.hostId as any)._id?.toString?.() || meeting.hostId.toString();
        const isHost = hostIdStr === request.user!.id;
        const isParticipant = meeting.participantIds && meeting.participantIds.some(id => id.toString() === request.user!.id);
        
        if (!isHost && !isParticipant) {
          const isPasscodeValid = passcode && await bcrypt.compare(String(passcode), meeting.passcodeHash);
          if (!isPasscodeValid) {
            return reply.code(401).send({ error: 'Invalid meeting passcode.' });
          }
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
        aiEnabled: !!meeting.aiEnabled,
        participantIds: meeting.participantIds,
        activeParticipantCount,
        isHost: hostId === request.user!.id
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error resolving meeting join code.', details: err.message });
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


  // 10. GET WORKSPACE ROOMS
  fastify.get('/rooms', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const workspaceId = request.user?.workspaceId || 'antigraviity-hq';
      const rooms = await Room.find({ workspaceId }).sort({ createdAt: -1 });
      return reply.code(200).send(rooms);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch rooms', details: err.message });
    }
  });

  // 11. CREATE ROOM
  fastify.post('/rooms', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { title, tag, color } = request.body as any;
      const workspaceId = request.user?.workspaceId || 'antigraviity-hq';
      if (!title || !tag) return reply.code(400).send({ error: 'Title and Tag are required.' });

      const room = await Room.create({
        workspaceId,
        creatorId: request.user!.id,
        title,
        tag,
        color: color || '#7c3aed'
      });
      return reply.code(201).send(room);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create room', details: err.message });
    }
  });

  // 12. DELETE ROOM
  fastify.delete('/rooms/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const room = await Room.findById(id);
      if (!room) return reply.code(404).send({ error: 'Room not found.' });

      // Ensure user is creator or an admin
      if (room.creatorId.toString() !== request.user!.id && request.user!.role !== 'company-admin') {
        return reply.code(403).send({ error: 'Unauthorized to delete this room.' });
      }

      await Room.findByIdAndDelete(id);
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete room', details: err.message });
    }
  });

  // 3. FETCH SINGLE MEETING WITH PARTICIPANT COUNT
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (request.user?.role === 'demo') {
        return reply.code(403).send({ error: 'Demo accounts cannot join meetings.' });
      }

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
        console.log(` [WEBHOOK] Successfully dispatched meeting.started: Status ${res.status}`);
      }).catch(err => {
        console.error(' [WEBHOOK] dispatch failed:', err.message);
      });

      return reply.code(200).send({ success: true, status: 'live', meeting });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to boot meeting session.', details: err.message });
    }
  });

  // 5b. START AI BOT (any authenticated participant can enable)
  fastify.post('/:id/start-ai', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const meeting = await resolveMeetingIdentifier(id);
      if (!meeting) return reply.code(404).send({ error: 'Meeting room not found.' });

      // Already launched  don't double-start
      const proto = (request.headers['x-forwarded-proto'] as string)?.split(',')[0] || request.protocol || 'http';
      const host = (request.headers['x-forwarded-host'] as string)?.split(',')[0] || request.headers.host;
      const backendBaseUrl = process.env.BACKEND_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || (host ? `${proto}://${host}` : undefined);

      // Launch direct-WS bot (no browser needed) and only mark enabled once it joins.
      const result = await launchAIBot(meeting._id.toString(), meeting.joinCode, backendBaseUrl);
      meeting.aiEnabled = true;
      await meeting.save();

      return reply.code(200).send(result);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to start AI Assistant.', details: err.message });
    }
  });

  // 5c. UPLOAD AUDIO CHUNK FROM MOBILE (expo-av recording  raw binary body)
  fastify.post('/:id/audio-chunk', {
    preHandler: authenticate,
    config: { rawBody: true }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const speakerName = (request.headers['x-speaker-name'] as string) || request.user!.name || 'User';
      const userId = request.user!.id;
      const contentType = request.headers['content-type'] || 'audio/m4a';

      const rawBody = (request as any).rawBody || (request.body as Buffer);
      if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length < 512) {
        return reply.code(400).send({ error: 'No valid audio data received.' });
      }

      const ext = contentType.includes('webm') ? 'webm' : 'm4a';
      const os = await import('os');
      const fsMod = await import('fs');
      const pathMod = await import('path');
      const { transcribeChunk } = await import('../services/transcription');

      const fileName = `chunk_${id}_${userId}_${Date.now()}.${ext}`;
      const filePath = pathMod.join(os.tmpdir(), fileName);
      fsMod.writeFileSync(filePath, rawBody);

      console.log(`[AudioChunk] Saved ${rawBody.length} bytes  ${filePath}`);

      const text = await transcribeChunk(id, userId, speakerName, filePath);
      try { fsMod.unlinkSync(filePath); } catch {}

      return reply.code(200).send({ success: true, text: text || '' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to process audio chunk.', details: err.message });
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
        console.log(` [WEBHOOK] Successfully dispatched meeting.ended: Status ${res.status}`);
      }).catch(err => {
        console.error(' [WEBHOOK] dispatch failed:', err.message);
      });

      // Invalidate all lingering participants
      await Participant.updateMany(
        { meetingId: meeting._id, leftAt: { $exists: false } },
        { leftAt: new Date() }
      );

      if (meeting.aiEnabled) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await stopAIBot(meeting._id.toString());
      }

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
      if (!id || !id.trim()) {
        return reply.code(400).send({ error: 'Missing required field: meeting ID.' });
      }

      let meeting;
      try {
        meeting = await resolveMeetingIdentifier(id);
      } catch (resolveErr: any) {
        return reply.code(400).send({ error: 'Invalid meeting identifier.', details: resolveErr.message });
      }

      if (!meeting) {
        return reply.code(404).send({ error: 'Meeting room not found.' });
      }

      // Mark the participant as having left
      try {
        await Participant.findOneAndUpdate(
          {
            meetingId: meeting._id,
            userId: new Types.ObjectId(request.user!.id),
            leftAt: { $exists: false }
          },
          { leftAt: new Date() },
          { new: true }
        );
      } catch (participantErr: any) {
        console.warn('[Meeting] Failed to update participant leave status:', participantErr.message);
        // Non-fatal: continue to check active participants
      }

      const aiBotUser = await User.findOne({ email: 'ai-assistant@nexus.app' });
      const query: any = {
        meetingId: meeting._id,
        leftAt: { $exists: false }
      };
      if (aiBotUser) {
        query.userId = { $ne: aiBotUser._id };
      }

      const activeParticipantCount = await Participant.countDocuments(query);

      if (activeParticipantCount === 0) {
        // Everyone (except possibly the bot) has left — end meeting and trigger summary
        meeting.status = 'ended';
        await meeting.save();
        await new Promise((resolve) => setTimeout(resolve, 2500));
        if (meeting.aiEnabled) {
          await stopAIBot(meeting._id.toString());
        } else {
          // Only summarize if not already sent (deduplication is in summarizeMeeting)
          summarizeMeeting(meeting._id.toString()).catch((err) => {
            console.warn('[Meeting] Summary generation failed:', err.message);
          });
        }
      }

      return reply.code(200).send({ success: true, message: 'Left meeting successfully', activeParticipantCount });
    } catch (err: any) {
      console.error('[Meeting] Leave route error:', err);
      return reply.code(500).send({ error: 'Failed to leave meeting.', details: err.message || 'Unknown server error' });
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
       if (!id || !id.trim()) {
         return reply.code(400).send({ error: 'Missing required field: meeting ID.' });
       }
       if (!Types.ObjectId.isValid(id)) {
         return reply.code(400).send({ error: 'Invalid meeting ID format.' });
       }

       const meeting = await Meeting.findById(id);
       if (!meeting) {
         return reply.code(404).send({ error: 'Meeting room not found.' });
       }

       if (meeting.status !== 'ended') {
         return reply.code(400).send({ error: 'Summaries can only be generated for completed meetings. Current status: ' + meeting.status });
       }

       // If summary already generated, return it from cache
       if (meeting.aiSummary) {
         return reply.code(200).send({ summary: meeting.aiSummary });
       }

       // Check if there are any transcripts before attempting summarization
       const transcriptCount = await Transcript.countDocuments({ meetingId: meeting._id });
       if (transcriptCount === 0) {
         return reply.code(400).send({ error: 'No transcript data available for this meeting. Summary cannot be generated without transcripts.' });
       }

       const summaryHtml = await summarizeMeeting(meeting._id.toString());

       return reply.code(200).send({ summary: summaryHtml });
     } catch (err: any) {
       return reply.code(500).send({ error: 'Failed to generate AI summary.', details: err.message });
     }
   });

}
