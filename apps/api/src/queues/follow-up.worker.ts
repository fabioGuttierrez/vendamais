import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getSupabase } from '../config/supabase.js';
import { sendText } from '../services/evolution-api.js';

export interface FollowUpJob {
  followUpId: string;
  contactPhone: string;
  contactName: string | null;
  messageTemplate: string;
}

let worker: Worker | null = null;

export function startFollowUpWorker() {
  try {
    worker = new Worker<FollowUpJob>(
      'follow-ups',
      async (job: Job<FollowUpJob>) => {
        const { followUpId, contactPhone, contactName, messageTemplate } = job.data;
        const supabase = getSupabase();

        // Check if follow-up is still pending
        const { data: followUp } = await supabase
          .from('follow_ups')
          .select('status')
          .eq('id', followUpId)
          .single();

        if (!followUp || followUp.status !== 'pending') {
          logger.info({ followUpId }, 'Follow-up cancelled or already sent');
          return;
        }

        // Replace placeholders in template
        const message = messageTemplate.replace(/\{\{name\}\}/g, contactName || 'cliente');

        // Send the message
        await sendText(contactPhone, message);

        // Update follow-up status
        await supabase
          .from('follow_ups')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', followUpId);

        logger.info({ followUpId, contactPhone }, 'Follow-up sent');
      },
      {
        connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
        concurrency: 3,
      },
    );

    worker.on('failed', (job, error) => {
      logger.error({ jobId: job?.id, error: error.message }, 'Follow-up failed');
    });

    worker.on('error', (error) => {
      logger.warn({ error: error.message }, 'Follow-up worker connection error (Redis may be offline)');
    });

    logger.info('Follow-up worker started');
  } catch (error) {
    logger.warn('Follow-up worker failed to start (Redis may be offline). Server continues without follow-up processing.');
  }
  return worker;
}

export function stopFollowUpWorker() {
  return worker?.close();
}
