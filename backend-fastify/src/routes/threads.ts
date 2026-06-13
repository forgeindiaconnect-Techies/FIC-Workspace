import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { ThreadPost } from '../models/ThreadPost';
import { ThreadComment } from '../models/ThreadComment';
import { User } from '../models/User';
import { authenticate } from '../middlewares/auth';
import { broadcastToWorkspace } from '../services/threadSockets';

const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || 'chat_uploads';
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';

cloudinary.config({
  cloud_name: cloudinaryCloudName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
});

function normalizeEmail(value: string) {
  return String(value || '').trim().toLowerCase();
}

async function resolveMultipartFile(request: FastifyRequest) {
  try {
    const direct = await (request as any).file();
    if (direct) return direct as any;
  } catch {}
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
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new Error('Cloudinary config missing');
  }

  const mimetype = file?.mimetype || 'application/octet-stream';
  const resourceType: 'video' | 'auto' | 'image' = String(mimetype).startsWith('video/') ? 'video' : 'auto';
  
  const uploadOptions = {
    folder: cloudinaryFolder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  const payload: Buffer = typeof file?.toBuffer === 'function' ? await file.toBuffer() : file?.file ? await streamToBuffer(file.file as Readable) : Buffer.alloc(0);

  if (!payload.length) throw new Error('Uploaded file is empty or unreadable.');

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploaded) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error('Cloudinary upload returned no result.'));
      resolve(uploaded);
    });
    uploadStream.end(payload);
  });
}

function resolveUploadName(file: any, uploaded?: UploadApiResponse) {
  const explicit = String(file?.filename || '').trim();
  if (explicit) return explicit;
  const fromCloudinary = String(uploaded?.original_filename || '').trim();
  if (fromCloudinary) {
    const fmt = String(uploaded?.format || '').trim();
    return fmt ? `${fromCloudinary}.${fmt}` : fromCloudinary;
  }
  return `upload.file`;
}

export async function threadsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preValidation', authenticate);

  // Upload Media
  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const file = await resolveMultipartFile(request);
      if (!file) return reply.code(400).send({ error: 'Missing file upload.' });
      const result = await uploadToCloudinary(file);
      
      const type = file.mimetype?.startsWith('video/') ? 'video' : file.mimetype?.startsWith('image/') ? 'image' : 'document';
      
      return reply.code(200).send({
        url: result.secure_url || result.url,
        type,
        name: resolveUploadName(file, result)
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Upload failed', details: err.message });
    }
  });

  // Fetch Feed
  fastify.get('/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId } = request.params as any;
      const { limit = 20, cursor } = request.query as any;

      const query: any = { workspaceId };
      if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
      }

      const posts = await ThreadPost.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean();
      
      // Fetch root comments for these posts
      const postIds = posts.map(p => p._id);
      const comments = await ThreadComment.find({ postId: { $in: postIds } }).sort({ createdAt: 1 }).lean();

      // Attach comments to posts (only root comments or simple nested structure)
      const commentsByPostId = comments.reduce((acc: any, c: any) => {
        const pId = c.postId.toString();
        if (!acc[pId]) acc[pId] = [];
        acc[pId].push(c);
        return acc;
      }, {});

      const result = posts.map((post: any) => ({
        ...post,
        comments: commentsByPostId[post._id.toString()] || []
      }));

      return reply.code(200).send(result);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch feed', details: err.message });
    }
  });

  // Create Post
  fastify.post('/create', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { workspaceId, content, mediaUrls = [], visibility = 'everyone', visibilityData = [] } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');
      const currentName = request.user?.name || currentEmail;

      if (!workspaceId || !content) return reply.code(400).send({ error: 'workspaceId and content required' });

      const post = await ThreadPost.create({
        workspaceId,
        authorEmail: currentEmail,
        authorName: currentName,
        content,
        mediaUrls,
        visibility,
        visibilityData
      });

      broadcastToWorkspace(workspaceId, 'NEW_POST', post);
      return reply.code(201).send(post);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create post', details: err.message });
    }
  });

  // Like/Unlike Post
  fastify.post('/:id/like', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const post = await ThreadPost.findById(id);
      if (!post) return reply.code(404).send({ error: 'Post not found' });

      const hasLiked = post.likes.includes(currentEmail);
      if (hasLiked) {
        post.likes = post.likes.filter(e => e !== currentEmail);
      } else {
        post.likes.push(currentEmail);
      }
      await post.save();

      broadcastToWorkspace(post.workspaceId, 'POST_LIKED', { postId: id, likes: post.likes });
      return reply.code(200).send({ likes: post.likes });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to toggle like', details: err.message });
    }
  });

  // Delete Post
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const post = await ThreadPost.findById(id);
      if (!post) return reply.code(404).send({ error: 'Post not found' });

      if (post.authorEmail !== currentEmail && request.user?.role !== 'Admin') {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await ThreadComment.deleteMany({ postId: id });
      await ThreadPost.findByIdAndDelete(id);

      broadcastToWorkspace(post.workspaceId, 'POST_DELETED', { postId: id });
      return reply.code(200).send({ message: 'Deleted' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete post', details: err.message });
    }
  });

  // Add Comment (Root or Reply)
  fastify.post('/:id/comment', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { content, parentCommentId } = request.body as any;
      const currentEmail = normalizeEmail(request.user?.email || '');
      const currentName = request.user?.name || currentEmail;

      if (!content) return reply.code(400).send({ error: 'content required' });

      const post = await ThreadPost.findById(id);
      if (!post) return reply.code(404).send({ error: 'Post not found' });

      const comment = await ThreadComment.create({
        postId: id,
        parentCommentId,
        authorEmail: currentEmail,
        authorName: currentName,
        content
      });

      broadcastToWorkspace(post.workspaceId, 'NEW_COMMENT', comment);
      return reply.code(201).send(comment);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create comment', details: err.message });
    }
  });
  
  // Like Comment
  fastify.post('/comment/:commentId/like', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commentId } = request.params as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const comment = await ThreadComment.findById(commentId);
      if (!comment) return reply.code(404).send({ error: 'Comment not found' });
      
      const post = await ThreadPost.findById(comment.postId);
      if (!post) return reply.code(404).send({ error: 'Post not found' });

      const hasLiked = comment.likes.includes(currentEmail);
      if (hasLiked) {
        comment.likes = comment.likes.filter(e => e !== currentEmail);
      } else {
        comment.likes.push(currentEmail);
      }
      await comment.save();

      broadcastToWorkspace(post.workspaceId, 'COMMENT_LIKED', { commentId, likes: comment.likes, postId: comment.postId });
      return reply.code(200).send({ likes: comment.likes });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to toggle like', details: err.message });
    }
  });
  
  // Delete Comment
  fastify.delete('/comment/:commentId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { commentId } = request.params as any;
      const currentEmail = normalizeEmail(request.user?.email || '');

      const comment = await ThreadComment.findById(commentId);
      if (!comment) return reply.code(404).send({ error: 'Comment not found' });

      if (comment.authorEmail !== currentEmail && request.user?.role !== 'Admin') {
        return reply.code(403).send({ error: 'Not authorized' });
      }
      
      const post = await ThreadPost.findById(comment.postId);

      // delete comment and all replies
      await ThreadComment.deleteMany({ $or: [{ _id: commentId }, { parentCommentId: commentId }] });

      if (post) broadcastToWorkspace(post.workspaceId, 'COMMENT_DELETED', { commentId, postId: comment.postId });
      return reply.code(200).send({ message: 'Deleted' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete comment', details: err.message });
    }
  });

}
