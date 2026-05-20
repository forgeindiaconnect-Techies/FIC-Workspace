import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environmental parameters immediately before module evaluation
dotenv.config();

// Resilient Redis initialization with automatic offline fallback
let redisClient: any;
let isRedisAvailable = false;

const memoryStore: Record<string, { count: number; expiresAt: number }> = {};

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000
    });
    
    redisClient.on('connect', () => {
      console.log('Redis connected successfully.');
      isRedisAvailable = true;
    });

    redisClient.on('error', (err: any) => {
      console.warn('Redis error occurred, reverting to fallback memory store:', err.message);
      isRedisAvailable = false;
    });
  } catch (e) {
    console.warn('Could not launch Redis instance, utilizing local memory cache.');
  }
} else {
  console.log('No REDIS_URL provided, utilizing local memory cache.');
}

export const getRedisClient = () => redisClient;

/**
 * Checks if a user is currently locked out of logging in
 * Returns minutes remaining, or 0 if not locked out
 */
export async function getLockoutTimeRemaining(email: string): Promise<number> {
  const key = `lockout:${email.toLowerCase()}`;
  if (isRedisAvailable) {
    const attempts = await redisClient.get(key);
    if (attempts && parseInt(attempts) >= 5) {
      const ttl = await redisClient.ttl(key);
      return ttl > 0 ? Math.ceil(ttl / 60) : 15;
    }
  } else {
    const item = memoryStore[key];
    if (item && item.count >= 5) {
      const remainingMs = item.expiresAt - Date.now();
      if (remainingMs > 0) {
        return Math.ceil(remainingMs / 1000 / 60);
      } else {
        delete memoryStore[key];
      }
    }
  }
  return 0;
}

/**
 * Registers a failed login attempt
 * Returns true if this attempt triggered a new lockout
 */
export async function registerFailedAttempt(email: string): Promise<boolean> {
  const key = `lockout:${email.toLowerCase()}`;
  const maxAttempts = 5;
  const lockoutTimeSeconds = 15 * 60; // 15 minutes

  if (isRedisAvailable) {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, lockoutTimeSeconds);
    }
    return current >= maxAttempts;
  } else {
    const now = Date.now();
    if (!memoryStore[key] || memoryStore[key].expiresAt < now) {
      memoryStore[key] = { count: 1, expiresAt: now + lockoutTimeSeconds * 1000 };
    } else {
      memoryStore[key].count += 1;
    }
    return memoryStore[key].count >= maxAttempts;
  }
}

/**
 * Resets failed login attempts on successful login
 */
export async function resetFailedAttempts(email: string): Promise<void> {
  const key = `lockout:${email.toLowerCase()}`;
  if (isRedisAvailable) {
    await redisClient.del(key);
  } else {
    delete memoryStore[key];
  }
}

// Presence syncing helpers
export async function syncRoomState(meetingId: string, routerId: string, peers: string[]): Promise<void> {
  const key = `room:${meetingId}`;
  if (isRedisAvailable) {
    await redisClient.hset(key, 'routerId', routerId);
    await redisClient.hset(key, 'peers', JSON.stringify(peers));
  } else {
    memoryStore[key] = { count: 0, expiresAt: Date.now() + 86400 * 1000 }; // mock store
  }
}
