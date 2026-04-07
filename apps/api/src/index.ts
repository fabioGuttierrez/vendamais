import Fastify from 'fastify';
import { env } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerAuth } from './plugins/auth.js';
import { webhookRoutes } from './routes/webhook.js';
import { healthRoutes } from './routes/health.js';
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

  // Routes
  await app.register(webhookRoutes);
  await app.register(healthRoutes);
  await app.register(contactRoutes);
  await app.register(conversationRoutes);
  await app.register(messageRoutes);
  await app.register(dealRoutes);
  await app.register(analyticsRoutes);
  await app.register(followUpRoutes);
  await app.register(botConfigRoutes);
  await app.register(productRoutes);
  await app.register(agentTestRoutes);
  await app.register(trainingRoutes);

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
