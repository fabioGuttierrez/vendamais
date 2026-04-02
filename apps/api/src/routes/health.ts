import type { FastifyInstance } from 'fastify';
import { getConnectionState } from '../services/evolution-api.js';
import { getMonitorStatus } from '../services/evolution-monitor.js';

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
