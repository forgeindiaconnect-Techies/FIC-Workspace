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
        type: (body.type || 'doc').toLowerCase(),
        ownerEmail: request.user?.email || '',
        ownerName: request.user?.name || '',
        sizeBytes: body.sizeBytes || 0,
        url: body.url || '',
        content: body.content,
      });

      return reply.code(201).send(doc);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create document.', details: err.message });
    }
  });

  // 2.5 GENERATE AI Document
  fastify.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { prompt } = request.body as any;
      if (!prompt) return reply.code(400).send({ error: 'Prompt is required' });
      
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        return reply.code(500).send({ error: 'AI API key not configured' });
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${groqKey}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are an expert document writer. The user will provide a topic or prompt. Generate a comprehensive document in HTML format. Return ONLY the HTML content, no markdown wrappers, no explanations. Use appropriate headings <h1>, <h2>, <p>, <ul>, <li>, <strong> etc. Do not include <html>, <head>, or <body> tags, just the inner content.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error: ${errorText}`);
      }

      const data = await response.json();
      let generatedHtml = data.choices?.[0]?.message?.content || '';
      generatedHtml = generatedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();

      return reply.code(200).send({ html: generatedHtml });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to generate document', details: err.message });
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
