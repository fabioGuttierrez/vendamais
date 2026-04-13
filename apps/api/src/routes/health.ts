import type { FastifyInstance } from 'fastify';
import IORedis from 'ioredis';
import { getConnectionState } from '../services/evolution-api.js';
import { getMonitorStatus } from '../services/evolution-monitor.js';
import { getSupabase } from '../config/supabase.js';
import { env } from '../config/env.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async () => {
    let whatsappState = 'unknown';
    try {
      whatsappState = await getConnectionState();
    } catch {
      whatsappState = 'error';
    }

    const monitor = getMonitorStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      whatsapp: {
        state: whatsappState,
        monitor: {
          active: monitor.isMonitoring,
          consecutiveFailures: monitor.consecutiveFailures,
          lastReconnectAttempt: monitor.lastReconnectAttempt,
        },
      },
    };
  });
}

/** Debug endpoint — registered inside auth-protected scope */
export async function healthDebugRoutes(app: FastifyInstance) {
  app.get('/api/v1/health/debug', async () => {
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    };

    // 1. Test Redis
    try {
      const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, connectTimeout: 5000 });
      await redis.connect();
      await redis.ping();

      // Check queue sizes
      const waiting = await redis.llen('bull:inbound-messages:wait');
      const active = await redis.llen('bull:inbound-messages:active');
      const delayed = await redis.zcard('bull:inbound-messages:delayed');
      const failed = await redis.zcard('bull:inbound-messages:failed');
      const completed = await redis.zcard('bull:inbound-messages:completed');

      results.redis = {
        status: 'connected',
        queue: { waiting, active, delayed, failed, completed },
      };

      // Get last failed jobs for debugging
      if (failed > 0) {
        const failedJobIds = await redis.zrange('bull:inbound-messages:failed', 0, 4);
        const failedDetails: unknown[] = [];
        for (const jobId of failedJobIds) {
          const jobData = await redis.hgetall(`bull:inbound-messages:${jobId}`);
          failedDetails.push({
            id: jobId,
            failedReason: jobData.failedReason || '(none)',
            finishedOn: jobData.finishedOn,
            attemptsMade: jobData.attemptsMade,
          });
        }
        results.failedJobs = failedDetails;
      }

      await redis.quit();
    } catch (err: any) {
      results.redis = { status: 'error', message: err.message };
    }

    // 2. Test Supabase
    try {
      const sb = getSupabase();
      const { count, error } = await sb.from('contacts').select('*', { count: 'exact', head: true });
      if (error) throw error;
      results.supabase = { status: 'connected', contactCount: count };
    } catch (err: any) {
      results.supabase = { status: 'error', message: err.message };
    }

    // 3. WhatsApp
    try {
      const state = await getConnectionState();
      results.whatsapp = { status: state };
    } catch (err: any) {
      results.whatsapp = { status: 'error', message: err.message };
    }

    return results;
  });
}
