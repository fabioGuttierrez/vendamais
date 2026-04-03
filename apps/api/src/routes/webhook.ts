import type { FastifyInstance } from 'fastify';
import { fromRemoteJid, normalizePhone } from '@vendamais/shared';
import { env } from '../config/env.js';
import { messageQueue } from '../queues/connection.js';
import { logger } from '../utils/logger.js';
import type { InboundMessageJob } from '../queues/message.worker.js';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/v1/webhook/evolution', async (request, reply) => {
    // Verify webhook secret
    const apiKey = (request.headers['apikey'] as string) || (request.headers['x-webhook-secret'] as string);
    if (apiKey !== env.WEBHOOK_SECRET) {
      logger.warn({ receivedKey: apiKey ?? '(none)', headers: Object.keys(request.headers) }, 'Webhook auth failed');
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const payload = request.body as any;
    const event = payload?.event;

    if (event !== 'messages.upsert') {
      return reply.status(200).send({ status: 'ignored', event });
    }

    const data = payload?.data;
    if (!data || data.key?.fromMe) {
      return reply.status(200).send({ status: 'ignored', reason: 'own message' });
    }

    // Extract message content
    const message = data.message;
    let content = '';
    let messageType = data.messageType || 'conversation';
    let mediaUrl: string | undefined;

    if (message?.conversation) {
      content = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      content = message.extendedTextMessage.text;
    } else if (message?.imageMessage) {
      content = message.imageMessage.caption || '[Imagem]';
      mediaUrl = message.imageMessage.url;
      messageType = 'image';
    } else if (message?.audioMessage) {
      content = '[Áudio]';
      mediaUrl = message.audioMessage.url;
      messageType = 'audio';
    } else if (message?.videoMessage) {
      content = message.videoMessage.caption || '[Vídeo]';
      mediaUrl = message.videoMessage.url;
      messageType = 'video';
    } else if (message?.documentMessage) {
      content = message.documentMessage.fileName || '[Documento]';
      mediaUrl = message.documentMessage.url;
      messageType = 'document';
    } else {
      content = '[Mensagem não suportada]';
    }

    const phone = fromRemoteJid(data.key.remoteJid);
    const phoneNormalized = normalizePhone(phone);

    const job: InboundMessageJob = {
      phone,
      phoneNormalized,
      pushName: data.pushName || '',
      content,
      messageType,
      mediaUrl,
      evolutionMessageId: data.key.id,
      timestamp: data.messageTimestamp || Date.now(),
    };

    // Enqueue for async processing with short delay for message batching
    await messageQueue.add('process-message', job, {
      delay: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    logger.info({ phone: phoneNormalized, messageType }, 'Message enqueued');
    return reply.status(200).send({ status: 'queued' });
  });
}
