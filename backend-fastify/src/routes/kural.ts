import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { User } from '../models/User';
import { KuralConversation } from '../models/KuralConversation';
import { KuralMessage } from '../models/KuralMessage';
import { Story } from '../models/Story';
import { authenticate } from '../middlewares/auth';

const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || 'chat_uploads';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

const defaultWorkspaceId = 'antigraviity-hq';

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

function initials(name: string) {
  return (name || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'U';
}

function resolveUploadName(file: any, uploaded?: UploadApiResponse) {
  const explicit = String(file?.filename || '').trim();
  if (explicit) return explicit;
  const fromCloudinary = String(uploaded?.original_filename || '').trim();
  if (fromCloudinary) {
    const fmt = String(uploaded?.format || '').trim();
    return fmt ? `${fromCloudinary}.${fmt}` : fromCloudinary;
  }
  const mime = String(file?.mimetype || '').trim();
  const ext = mime.includes('/') ? mime.split('/')[1] : 'file';
  return `upload.${ext || 'file'}`;
}

async function resolveMultipartFile(request: FastifyRequest) {
  // Standard multipart flow (attachFieldsToBody disabled)
  try {
    const direct = await (request as any).file();
    if (direct) return direct as any;
  } catch {
    // When attachFieldsToBody=true, request.file() may throw if body is already consumed.
  }

  // Fallback for attachFieldsToBody=true setups
  const bodyFile = (request.body as any)?.file;
  if (bodyFile?.file) return bodyFile;
  return null;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function uploadToCloudinary(file: any) {
  const mimetype = file?.mimetype || 'application/octet-stream';
  const resourceType: 'video' | 'auto' =
    String(mimetype).startsWith('video/') ? 'video' : 'auto';
  const uploadOptions = {
    folder: cloudinaryFolder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  const payload: Buffer =
    typeof file?.toBuffer === 'function'
      ? await file.toBuffer()
      : file?.file
        ? await streamToBuffer(file.file as Readable)
        : Buffer.alloc(0);

  if (!payload.length) {
    throw new Error('Uploaded file is empty or unreadable.');
  }

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error('Cloudinary upload returned no result.'));
      resolve(uploaded);
    });
    uploadStream.end(payload);
  });
}

async function ensureDirectConversation(workspaceId: string, currentEmail: string, peerEmail: string) {
  const participants = [currentEmail, peerEmail].map(normalizeEmail).sort();
  let conversation = await KuralConversation.findOne({
    type: 'direct',
    participantEmails: { $all: participants, $size: 2 }
  });

  if (!conversation) {
    conversation = await KuralConversation.create({
      workspaceId,
      type: 'direct',
      participantEmails: participants,
      createdByEmail: currentEmail
    });
  }

  return conversation;
}

export async function channelRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const file = await resolveMultipartFile(request);
      if (!file) {
        return reply.code(400).send({ error: 'Missing file upload.' });
      }
      const result = await uploadToCloudinary(file);

      return reply.code(200).send({
        url: result.secure_url || result.url,
        type: file.mimetype || 'application/octet-stream',
        originalName: resolveUploadName(file, result),
        publicId: result.public_id,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Cloudinary upload failed.', details: err.message });
    }
  });

  fastify.get('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const currentEmail = normalizeEmail((request.query as any).email || request.user?.email);
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;

      if (!currentEmail) {
        return reply.code(400).send({ error: 'Current user email is required.' });
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
          type: conversation.type,
          displayName: member.name,
          name: member.name,
          email: member.email,
          avatar: initials(member.name),
          role: member.role || 'Member',
          workspaceId: activeWorkspaceId,
          isOnline: true,
          lastMessageContent: conversation.lastMessageContent || 'Start a secure Kural conversation',
          lastMessageTime: conversation.lastMessageTime || conversation.updatedAt
        });
      }

      const conversations = await KuralConversation.find({
        type: 'direct',
        participantEmails: currentEmail
      });

      for (const conversation of conversations) {
        if (!channelsMap.has(conversation._id.toString())) {
          const peerEmail = conversation.participantEmails.find(e => e !== currentEmail) || currentEmail;
          const peerUser = await User.findOne({ email: peerEmail }).select('name role avatarUrl');
          channelsMap.set(conversation._id.toString(), {
            _id: conversation._id,
            type: conversation.type,
            displayName: peerUser?.name || peerEmail,
            name: peerUser?.name || peerEmail,
            email: peerEmail,
            avatar: initials(peerUser?.name || peerEmail),
            role: peerUser?.role || 'Member',
            workspaceId: activeWorkspaceId,
            isOnline: true,
            lastMessageContent: conversation.lastMessageContent || 'Start a secure Kural conversation',
            lastMessageTime: conversation.lastMessageTime || conversation.updatedAt
          });
        }
      }

      const channels = Array.from(channelsMap.values()).sort((a, b) => {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      return reply.code(200).send(channels);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch Kural channels.', details: err.message });
    }
  });

  // Fetch groups
  fastify.get('/:workspaceId/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const currentEmail = normalizeEmail((request.query as any).email || request.user?.email);
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;

      const groups = await KuralConversation.find({
        workspaceId: activeWorkspaceId,
        type: 'channel',
        participantEmails: currentEmail
      }).sort({ updatedAt: -1 });

      return reply.code(200).send(groups.map(g => ({
        _id: g._id,
        type: g.type,
        name: g.name,
        displayName: g.name,
        participantEmails: g.participantEmails,
        lastMessageContent: g.lastMessageContent,
        lastMessageTime: g.lastMessageTime || g.updatedAt,
        unread: 0,
        isOnline: true
      })));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch groups.', details: err.message });
    }
  });
}

export async function kuralRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const file = await resolveMultipartFile(request);
      if (!file) {
        return reply.code(400).send({ error: 'Missing file upload.' });
      }
      const result = await uploadToCloudinary(file);

      return reply.code(200).send({
        url: result.secure_url || result.url,
        type: file.mimetype || 'application/octet-stream',
        originalName: resolveUploadName(file, result),
        publicId: result.public_id,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Cloudinary upload failed.', details: err.message });
    }
  });

  fastify.get('/:workspaceId/:channelId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, channelId } = request.params as any;
      if (!Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: 'Invalid Kural channel id.' });
      }

      const currentEmail = normalizeEmail(request.user?.email || '');
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        participantEmails: currentEmail
      });

      if (!conversation) {
        return reply.code(404).send({ error: 'Kural conversation not found.' });
      }

      const messages = await KuralMessage.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(100);

      return reply.code(200).send(messages.map((message: any) => ({
        _id: message._id,
        conversationId: message.conversationId,
        sender: message.senderEmail === currentEmail ? 'You' : message.senderName,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        originalName: message.originalName,
        timestamp: message.createdAt
      })));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch Kural messages.', details: err.message });
    }
  });

  fastify.post('/:workspaceId/:channelId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, channelId } = request.params as any;
      const body = request.body as any;
      const content = String(body.content || '').trim();
      const fileUrl = body.fileUrl || null;
      const fileType = body.fileType || null;
      const originalName = String(body.originalName || '').trim() || null;
      
      if (!Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: 'Invalid Kural channel id.' });
      }
      if (!content && !fileUrl) {
        return reply.code(400).send({ error: 'Message content or file is required.' });
      }

      const currentEmail = normalizeEmail(request.user?.email || '');
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        participantEmails: currentEmail
      });

      if (!conversation) {
        return reply.code(404).send({ error: 'Kural conversation not found.' });
      }

      const message = await KuralMessage.create({
        conversationId: conversation._id,
        workspaceId,
        senderEmail: currentEmail,
        senderName: request.user?.name || currentEmail,
        content,
        fileUrl,
        fileType,
        originalName
      });

      conversation.lastMessageContent = content || `Sent a file: ${originalName || 'Attachment'}`;
      conversation.lastMessageTime = message.createdAt;
      await conversation.save();

      return reply.code(201).send({
        _id: message._id,
        conversationId: message.conversationId,
        sender: 'You',
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
        fileUrl: message.fileUrl,
        fileType: message.fileType,
        originalName: message.originalName,
        timestamp: message.createdAt
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to send Kural message.', details: err.message });
    }
  });

  fastify.post('/start-dm', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { members = [], createdBy, workspaceId } = request.body as any;
      const currentEmail = normalizeEmail(createdBy || request.user?.email || '');
      // Fallback to currentEmail if they are chatting with themselves
      const peerEmail = normalizeEmail(members.find((email: string) => normalizeEmail(email) !== currentEmail) || members[0] || currentEmail);
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;

      if (!currentEmail || !peerEmail) {
        return reply.code(400).send({ error: 'Two participant emails are required to start a direct message.' });
      }

      const conversation = await ensureDirectConversation(activeWorkspaceId, currentEmail, peerEmail);
      return reply.code(200).send(conversation);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to start direct message.', details: err.message });
    }
  });

  fastify.post('/groups', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, members = [], workspaceId } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;

      if (!name) return reply.code(400).send({ error: 'Group name is required.' });

      const participantEmails = [...new Set([currentEmail, ...members.map(normalizeEmail)])];

      const conversation = await KuralConversation.create({
        workspaceId: activeWorkspaceId,
        type: 'channel',
        name,
        participantEmails,
        createdByEmail: currentEmail
      });

      return reply.code(201).send(conversation);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create group.', details: err.message });
    }
  });

  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email } = request.query as any;
      if (!email) return reply.code(400).send({ error: 'Email query parameter is required.' });

      const user = await User.findOne({ email: normalizeEmail(email) }).select('name email avatarUrl');
      if (!user) return reply.code(404).send({ error: 'User not found.' });

      return reply.code(200).send(user);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to search user.', details: err.message });
    }
  });

  fastify.get('/:workspaceId/stories', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      
      const stories = await Story.find({ workspaceId: activeWorkspaceId })
        .sort({ createdAt: -1 })
        .limit(50);
        
      return reply.code(200).send(stories);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch stories.', details: err.message });
    }
  });

  fastify.post('/:workspaceId/stories', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const { content } = request.body as any;
      if (!content) return reply.code(400).send({ error: 'Content is required.' });

      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;
      const currentUser = await User.findById(request.user?.id);
      
      const story = await Story.create({
        workspaceId: activeWorkspaceId,
        userId: request.user?.id,
        userEmail: normalizeEmail(request.user?.email || ''),
        userName: request.user?.name || 'User',
        userAvatar: currentUser?.avatarUrl,
        content
      });

      return reply.code(201).send(story);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to post story.', details: err.message });
    }
  });

  fastify.delete('/delete-conversation/:channelId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { channelId } = request.params as any;
      if (!Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: 'Invalid Kural channel id.' });
      }

      const currentEmail = normalizeEmail(request.user?.email || '');
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        participantEmails: currentEmail
      });

      if (!conversation) {
        return reply.code(404).send({ error: 'Kural conversation not found.' });
      }

      await KuralMessage.deleteMany({ conversationId: conversation._id });
      // Don't delete the conversation document itself: the channels listing endpoint
      // may auto-create missing direct conversations. Instead, clear history.
      conversation.lastMessageContent = 'Start a secure Kural conversation';
      conversation.lastMessageTime = undefined;
      await conversation.save();

      return reply.code(200).send({ message: 'Kural conversation cleared.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete Kural conversation.', details: err.message });
    }
  });
}
