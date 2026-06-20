import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const getJwtSecret = () => process.env.JWT_SECRET || 'nexus-jwt-secret-key';

// Extend FastifyRequest type interface to hold user model info
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      role?: string;
      workspaceId?: string;
      avatarUrl?: string;
    };
  }
}

/**
 * Rigid middleware that enforces access tokens and attaches request.user.
 * Rejects requests with 401 on failure.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized: Missing or invalid token format.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret()) as any;

    if (!decoded || !decoded.userId) {
      return reply.code(401).send({ error: 'Unauthorized: Access token is invalid or expired.' });
    }

    // Attach minimal active user credentials
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      workspaceId: decoded.workspaceId
    };

    // Block write/edit operations for Demo Account
    if (decoded.role === 'demo' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
      return reply.code(403).send({ error: 'Demo accounts have read-only access.' });
    }
  } catch (err: any) {
    console.error('JWT Verification failed! Error:', err.message);
    return reply.code(401).send({ error: 'Unauthorized: Session authentication failed.' });
  }
}

/**
 * Optional middleware that attempts to load request.user if token is present,
 * but allows the request to pass through if unauthenticated.
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, getJwtSecret()) as any;
      if (decoded && decoded.userId) {
        request.user = {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role,
          workspaceId: decoded.workspaceId
        };
      }
    }
  } catch (err) {
    // Gracefully ignore validation failures for optional endpoints
  }
}
