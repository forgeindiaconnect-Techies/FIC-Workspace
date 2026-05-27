import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { authenticate } from '../middlewares/auth';

const defaultWorkspaceId = 'antigraviity-hq';

function publicUser(user: any) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'Member',
    workspaceId: user.workspaceId || defaultWorkspaceId,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt
  };
}

export async function memberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  fastify.get('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const users = await User.find({ workspaceId: workspaceId || defaultWorkspaceId })
        .sort({ createdAt: -1 })
        .select('-password -passwordHash -mfaSecret');

      return reply.code(200).send(users.map(publicUser));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch workspace members.', details: err.message });
    }
  });

  fastify.post('/add', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const role = String(body.role || 'Member').trim();
      const workspaceId = String(body.workspaceId || request.user?.workspaceId || defaultWorkspaceId).trim();

      if (!name || !email || !password) {
        return reply.code(400).send({ error: 'Name, email, and password are required.' });
      }

      // Check max users limit if workspace is tied to a tenant
      if (workspaceId !== defaultWorkspaceId) {
        const tenant = await Tenant.findOne({ workspaceId });
        if (tenant && tenant.maxUsers) {
          const currentUsers = await User.countDocuments({ workspaceId });
          if (currentUsers >= tenant.maxUsers) {
            return reply.code(403).send({ error: `Subscription limit reached (${tenant.maxUsers} users). Please upgrade to add more members.` });
          }
        }
      }

      const existing = await User.findOne({ email });
      if (existing) {
        return reply.code(409).send({ error: 'A user with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const avatarUrl = body.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

      const user = await User.create({
        name,
        email,
        passwordHash,
        role,
        workspaceId,
        avatarUrl,
        mfaEnabled: false
      });

      return reply.code(201).send(publicUser(user));
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to add workspace user.', details: err.message });
    }
  });
}
