import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

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
    // Token is validated by Supabase on the dashboard side
    // API trusts service_role for data operations
  });
}
