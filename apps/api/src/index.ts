import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerAuth } from './plugins/auth.js';
import { webhookRoutes } from './routes/webhook.js';
import { healthRoutes, healthDebugRoutes } from './routes/health.js';
import { contactRoutes } from './routes/contacts.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';
import { dealRoutes } from './routes/deals.js';
import { analyticsRoutes } from './routes/analytics.js';
import { followUpRoutes } from './routes/follow-ups.js';
import { botConfigRoutes } from './routes/bot-config.js';
import { productRoutes } from './routes/products.js';
import { agentTestRoutes } from './routes/agent-test.js';
import { trainingRoutes } from './routes/training.js';
import { reservationRoutes } from './routes/reservations.js';
import { startMessageWorker, stopMessageWorker } from './queues/message.worker.js';
import { startFollowUpWorker, stopFollowUpWorker } from './queues/follow-up.worker.js';
import { startEvolutionMonitor, stopEvolutionMonitor } from './services/evolution-monitor.js';
import { logger } from './utils/logger.js';

async function main() {
  const app = Fastify({ logger: false });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url, method: request.method }, 'Request error');
    const statusCode = (error as any).statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : (error as Error).message,
    });
  });

  // Plugins
  await registerCors(app);
  await registerAuth(app);
  await app.register(import('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024 } });

  // Global rate limit (per IP)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Public routes (no auth required)
  await app.register(webhookRoutes);
  await app.register(healthRoutes);

  // Dashboard routes (JWT auth required)
  await app.register(async function dashboardRoutes(scoped) {
    scoped.addHook('onRequest', (scoped as any).verifyDashboard);

    await scoped.register(healthDebugRoutes);
    await scoped.register(contactRoutes);
    await scoped.register(conversationRoutes);
    await scoped.register(messageRoutes);
    await scoped.register(dealRoutes);
    await scoped.register(analyticsRoutes);
    await scoped.register(followUpRoutes);
    await scoped.register(botConfigRoutes);
    await scoped.register(productRoutes);
    await scoped.register(agentTestRoutes);
    await scoped.register(trainingRoutes);
    await scoped.register(reservationRoutes);
  });

  // Start workers (only if Redis is available)
  try {
    const IORedis = (await import('ioredis')).default;
    const testConn = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
    await testConn.connect();
    await testConn.quit();
    startMessageWorker();
    startFollowUpWorker();
    logger.info('Queue workers started (Redis connected)');
  } catch {
    logger.warn('Redis not available — queue workers disabled. API routes still work.');
  }

  // Start Evolution API monitor
  startEvolutionMonitor();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    stopEvolutionMonitor();
    await stopMessageWorker();
    await stopFollowUpWorker();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info(`API server running on port ${env.API_PORT}`);
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
