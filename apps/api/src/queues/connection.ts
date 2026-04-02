import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

let _messageQueue: Queue | null = null;
let _followUpQueue: Queue | null = null;

export function getMessageQueue(): Queue {
  if (!_messageQueue) {
    try {
      _messageQueue = new Queue('inbound-messages', {
        connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
      });
    } catch {
      logger.warn('Failed to create message queue (Redis offline)');
      throw new Error('Redis unavailable');
    }
  }
  return _messageQueue;
}

export function getFollowUpQueue(): Queue {
  if (!_followUpQueue) {
    try {
      _followUpQueue = new Queue('follow-ups', {
        connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
      });
    } catch {
      logger.warn('Failed to create follow-up queue (Redis offline)');
      throw new Error('Redis unavailable');
    }
  }
  return _followUpQueue;
}

// Backward-compat exports
export const messageQueue = { add: (...args: any[]) => getMessageQueue().add(args[0], args[1], args[2]) } as Queue;
export const followUpQueue = { add: (...args: any[]) => getFollowUpQueue().add(args[0], args[1], args[2]) } as Queue;
