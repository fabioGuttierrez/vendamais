import type { FastifyInstance } from 'fastify';
import { getConnectionState } from '../services/evolution-api.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async () => {
    let whatsappState = 'unknown';
    try {
      whatsappState = await getConnectionState();
    } catch {
      whatsappState = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      whatsapp: whatsappState,
    };
  });
}
