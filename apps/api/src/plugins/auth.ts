import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Dedicated client for JWT verification (uses service_role to call auth.getUser)
let authClient: ReturnType<typeof createClient> | null = null;
function getAuthClient() {
  if (!authClient) {
    authClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
}

export async function registerAuth(app: FastifyInstance) {
  app.decorate('verifyWebhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['apikey'] || request.headers['x-webhook-secret'];
    if (apiKey !== env.WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Invalid webhook secret' });
    }
  });

  app.decorate('verifyDashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);
    const { data, error } = await getAuthClient().auth.getUser(token);

    if (error || !data.user) {
      logger.warn({ error: error?.message }, 'Dashboard auth failed');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Attach user to request for downstream use
    (request as any).user = data.user;
  });
}
