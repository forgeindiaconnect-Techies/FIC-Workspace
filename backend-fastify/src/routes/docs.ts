import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WorkspaceDocument } from '../models/Document';
import { authenticate } from '../middlewares/auth';

const defaultWorkspaceId = 'antigraviity-hq';

export async function docsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  // 1. GET all documents for a workspace
  fastify.get('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const { type } = request.query as any;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;

      const filter: any = { workspaceId: activeWorkspaceId };
      if (type) filter.type = type;

      const docs = await WorkspaceDocument.find(filter).sort({ createdAt: -1 });
      return reply.code(200).send(docs);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch documents.', details: err.message });
    }
  });

  // 2. CREATE a document record
  fastify.post('/create', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const title = String(body.title || '').trim();
      if (!title) {
        return reply.code(400).send({ error: 'Document title is required.' });
      }

      const workspaceId = String(
        body.workspaceId || request.user?.workspaceId || defaultWorkspaceId
      ).trim();

      const doc = await WorkspaceDocument.create({
        workspaceId,
        title,
        type: body.type || 'doc',
        ownerEmail: request.user?.email || '',
        ownerName: request.user?.name || '',
        sizeBytes: body.sizeBytes || 0,
        url: body.url || '',
      });

      return reply.code(201).send(doc);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create document.', details: err.message });
    }
  });

  // 3. UPDATE a document
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;

      const doc = await WorkspaceDocument.findByIdAndUpdate(
        id,
        { ...body, updatedAt: new Date() },
        { new: true }
      );

      if (!doc) {
        return reply.code(404).send({ error: 'Document not found.' });
      }

      return reply.code(200).send(doc);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update document.', details: err.message });
    }
  });

  // 4. DELETE a document
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const doc = await WorkspaceDocument.findByIdAndDelete(id);
      if (!doc) {
        return reply.code(404).send({ error: 'Document not found.' });
      }
      return reply.code(200).send({ message: 'Document deleted.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete document.', details: err.message });
    }
  });
}
