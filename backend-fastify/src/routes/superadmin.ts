import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Tenant } from '../models/Tenant';
import { authenticate } from '../middlewares/auth';

export async function superadminRoutes(fastify: FastifyInstance) {
  // Ensure route is protected and only super-admins can access
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== 'super-admin') {
      return reply.code(403).send({ error: 'Access denied. Super Admin privileges required.' });
    }
  });

  fastify.get('/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenants = await Tenant.find({}).sort({ createdAt: -1 });
      return reply.code(200).send(tenants);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch tenants.', details: err.message });
    }
  });
}
