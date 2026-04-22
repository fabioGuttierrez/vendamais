import type { FastifyInstance } from 'fastify';
import { fromRemoteJid, normalizePhone } from '@vendamais/shared';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { messageQueue } from '../queues/connection.js';
import { logger } from '../utils/logger.js';
import type { InboundMessageJob } from '../queues/message.worker.js';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/v1/webhook/evolution', async (request, reply) => {
    // Verify webhook secret (header only — never accept via query string)
    const apiKey =
      (request.headers['apikey'] as string) ||
      (request.headers['x-webhook-secret'] as string) ||
      '';
    if (!apiKey || !safeCompare(apiKey, env.WEBHOOK_SECRET)) {
      logger.warn('Webhook auth failed');
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

    // Ignore group messages, newsletters, and status broadcasts
    const remoteJid = data.key?.remoteJid || '';
    if (!remoteJid.endsWith('@s.whatsapp.net')) {
      return reply.status(200).send({ status: 'ignored', reason: 'not a private chat' });
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

    // Enqueue for async processing — jobId deduplicates by message ID (prevents double processing)
    await messageQueue.add('process-message', job, {
      jobId: `msg:${job.evolutionMessageId || job.phoneNormalized + ':' + job.timestamp}`,
      delay: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    logger.info({ phone: phoneNormalized, messageType }, 'Message enqueued');
    return reply.status(200).send({ status: 'queued' });
  });
}
