import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Task } from '../models/Task';
import { authenticate } from '../middlewares/auth';

const defaultWorkspaceId = 'antigraviity-hq';

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  // 1. GET all tasks for a workspace (optionally filter by status)
  fastify.get('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const { status } = request.query as any;
      const activeWorkspaceId = workspaceId || request.user?.workspaceId || defaultWorkspaceId;

      const filter: any = { workspaceId: activeWorkspaceId };
      if (status) filter.status = status;

      const tasks = await Task.find(filter).sort({ createdAt: -1 });
      return reply.code(200).send(tasks);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch tasks.', details: err.message });
    }
  });

  // 2. CREATE a new task
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const title = String(body.title || '').trim();
      if (!title) {
        return reply.code(400).send({ error: 'Task title is required.' });
      }

      const workspaceId = String(
        body.workspaceId || request.user?.workspaceId || defaultWorkspaceId
      ).trim();

      const task = await Task.create({
        workspaceId,
        title,
        description: body.description || '',
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        assigneeEmail: body.assigneeEmail || '',
        assigneeName: body.assigneeName || '',
        createdByEmail: request.user?.email || '',
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      });

      return reply.code(201).send(task);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create task.', details: err.message });
    }
  });

  // 3. UPDATE a task (status, title, priority, assignee, etc.)
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;

      const allowedFields = ['title', 'description', 'status', 'priority', 'assigneeEmail', 'assigneeName', 'dueDate'];
      const update: any = { updatedAt: new Date() };

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          update[field] = field === 'dueDate' ? new Date(body[field]) : body[field];
        }
      }

      const task = await Task.findByIdAndUpdate(id, update, { new: true });
      if (!task) {
        return reply.code(404).send({ error: 'Task not found.' });
      }

      return reply.code(200).send(task);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to update task.', details: err.message });
    }
  });

  // 4. DELETE a task
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const task = await Task.findByIdAndDelete(id);
      if (!task) {
        return reply.code(404).send({ error: 'Task not found.' });
      }
      return reply.code(200).send({ message: 'Task deleted successfully.' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete task.', details: err.message });
    }
  });
}
