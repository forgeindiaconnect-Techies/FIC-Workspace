import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { KuralConversation } from '../models/KuralConversation';
import { KuralMessage } from '../models/KuralMessage';
import { authenticate } from '../middlewares/auth';

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

async function ensureDirectConversation(workspaceId: string, currentEmail: string, peerEmail: string) {
  const participants = [currentEmail, peerEmail].map(normalizeEmail).sort();
  let conversation = await KuralConversation.findOne({
    workspaceId,
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
      })
        .sort({ name: 1 })
        .select('name email role avatarUrl workspaceId createdAt');

      const channels = [];
      for (const member of members) {
        const conversation = await ensureDirectConversation(activeWorkspaceId, currentEmail, member.email);
        channels.push({
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

      return reply.code(200).send(channels);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch Kural channels.', details: err.message });
    }
  });
}

export async function kuralRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/:workspaceId/:channelId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, channelId } = request.params as any;
      if (!Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: 'Invalid Kural channel id.' });
      }

      const currentEmail = normalizeEmail(request.user?.email || '');
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        workspaceId,
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
        timestamp: message.createdAt
      })));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch Kural messages.', details: err.message });
    }
  });

  fastify.post('/:workspaceId/:channelId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, channelId } = request.params as any;
      const content = String((request.body as any).content || '').trim();
      if (!Types.ObjectId.isValid(channelId)) {
        return reply.code(400).send({ error: 'Invalid Kural channel id.' });
      }
      if (!content) {
        return reply.code(400).send({ error: 'Message content is required.' });
      }

      const currentEmail = normalizeEmail(request.user?.email || '');
      const conversation = await KuralConversation.findOne({
        _id: channelId,
        workspaceId,
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
        content
      });

      conversation.lastMessageContent = content;
      conversation.lastMessageTime = message.createdAt;
      await conversation.save();

      return reply.code(201).send({
        _id: message._id,
        conversationId: message.conversationId,
        sender: 'You',
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        content: message.content,
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
      const peerEmail = normalizeEmail(members.find((email: string) => normalizeEmail(email) !== currentEmail));
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
      await conversation.deleteOne();

      return reply.code(200).send({ message: 'Kural conversation deleted.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete Kural conversation.', details: err.message });
    }
  });
}
