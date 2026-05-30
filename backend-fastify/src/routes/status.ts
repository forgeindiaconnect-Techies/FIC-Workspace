import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { Story } from '../models/Story';
import { User } from '../models/User';
import { authenticate } from '../middlewares/auth';

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

export async function statusRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  // GET /api/status/:workspaceId — list all statuses grouped by user
  fastify.get('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || 'demo';

      const statuses = await Story.find({ workspaceId: activeWorkspaceId }).sort({ createdAt: 1 });

      // Group by userEmail
      const grouped: Record<string, any> = {};
      statuses.forEach(status => {
        if (!grouped[status.userEmail]) {
          grouped[status.userEmail] = {
            userEmail: status.userEmail,
            userName: status.userName,
            avatarUrl: status.userAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(status.userName)}`,
            statuses: []
          };
        }
        grouped[status.userEmail].statuses.push({
          _id: status._id,
          mediaType: status.mediaType || 'text',
          mediaUrl: status.mediaUrl,
          content: status.content,
          bgColor: status.bgColor,
          createdAt: status.createdAt,
          privacyType: status.privacyType || 'everyone',
          mentions: status.mentions || [],
          views: status.views || [],
          reactions: status.reactions || []
        });
      });

      return reply.code(200).send(Object.values(grouped));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch statuses', details: err.message });
    }
  });

  // POST /api/status/:workspaceId — create a new status
  fastify.post('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || 'demo';
      const { mediaType, mediaUrl, content, bgColor, privacyType = 'everyone', mentions = [] } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const status = await Story.create({
        workspaceId: activeWorkspaceId,
        userId: request.user?.id,
        userEmail: currentEmail,
        userName: request.user?.name || currentEmail,
        userAvatar: request.user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(request.user?.name || currentEmail)}`,
        mediaType: mediaType || 'text',
        mediaUrl,
        content,
        bgColor,
        privacyType,
        mentions,
        views: [],
        reactions: []
      });

      return reply.code(201).send(status);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create status', details: err.message });
    }
  });

  // POST /api/status/:id/view — mark a status as viewed
  fastify.post('/:id/view', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'Invalid status id.' });
      }

      // Only add view if user hasn't viewed it yet
      const existingStatus = await Story.findById(id);
      if (!existingStatus) return reply.code(404).send({ error: 'Status not found' });

      const hasViewed = existingStatus.views.some(v => v.viewerEmail === currentEmail);
      if (!hasViewed) {
        existingStatus.views.push({ viewerEmail: currentEmail, viewedAt: new Date() });
        await existingStatus.save();
      }

      return reply.code(200).send(existingStatus);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to mark status as viewed', details: err.message });
    }
  });

  // POST /api/status/:id/reaction — add a reaction
  fastify.post('/:id/reaction', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { emoji } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ error: 'Invalid status id.' });
      }

      const status = await Story.findByIdAndUpdate(
        id,
        { $push: { reactions: { userEmail: currentEmail, emoji, addedAt: new Date() } } },
        { new: true }
      );

      if (!status) return reply.code(404).send({ error: 'Status not found' });
      return reply.code(200).send(status);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to add reaction', details: err.message });
    }
  });

  // POST /api/status/mute — Mute a user's statuses
  fastify.post('/mute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mutedUserEmail } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const { MutedUser } = require('../models/MutedUser');
      await MutedUser.findOneAndUpdate(
        { userEmail: currentEmail, mutedUserEmail: normalizeEmail(mutedUserEmail) },
        { userEmail: currentEmail, mutedUserEmail: normalizeEmail(mutedUserEmail), userId: request.user?.id },
        { upsert: true, new: true }
      );
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to mute user', details: err.message });
    }
  });

  // POST /api/status/unmute — Unmute a user's statuses
  fastify.post('/unmute', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mutedUserEmail } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const { MutedUser } = require('../models/MutedUser');
      await MutedUser.findOneAndDelete({ userEmail: currentEmail, mutedUserEmail: normalizeEmail(mutedUserEmail) });
      return reply.code(200).send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to unmute user', details: err.message });
    }
  });

  // GET /api/status/muted — Get list of muted user emails
  fastify.get('/muted', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const currentEmail = normalizeEmail(request.user?.email || '');
      const { MutedUser } = require('../models/MutedUser');
      const muted = await MutedUser.find({ userEmail: currentEmail });
      return reply.code(200).send(muted.map((m: any) => m.mutedUserEmail));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch muted users', details: err.message });
    }
  });
}
