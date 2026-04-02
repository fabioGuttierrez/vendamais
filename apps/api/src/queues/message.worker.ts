import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { processInboundMessage } from '../services/conversation-engine.js';

export interface InboundMessageJob {
  phone: string;
  phoneNormalized: string;
  pushName: string;
  content: string;
  messageType: string;
  mediaUrl?: string;
  evolutionMessageId: string;
  timestamp: number;
}

let worker: Worker | null = null;

export function startMessageWorker() {
  try {
    worker = new Worker<InboundMessageJob>(
      'inbound-messages',
      async (job: Job<InboundMessageJob>) => {
        logger.info({ phone: job.data.phoneNormalized, jobId: job.id }, 'Processing inbound message');

        try {
          await processInboundMessage(job.data);
        } catch (error) {
          logger.error({ error, jobId: job.id }, 'Failed to process message');
          throw error;
        }
      },
      {
        connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
        concurrency: 5,
        limiter: { max: 1, duration: 1000 },
      },
    );

    worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Message processed');
    });

    worker.on('failed', (job, error) => {
      logger.error({ jobId: job?.id, error: error.message }, 'Message processing failed');
    });

    worker.on('error', (error) => {
      logger.warn({ error: error.message }, 'Message worker connection error (Redis may be offline)');
    });

    logger.info('Message worker started');
  } catch (error) {
    logger.warn('Message worker failed to start (Redis may be offline). Server continues without queue processing.');
  }
  return worker;
}

export function stopMessageWorker() {
  return worker?.close();
}
