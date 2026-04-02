import { env } from '../config/env.js';
import { getEvolutionConfig } from '../config/evolution-config.js';
import { logger } from '../utils/logger.js';
import type { EvolutionSendTextPayload } from '@vendamais/shared';

const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

async function fetchWithRetry(url: string, options: RequestInit, retries = RETRY_DELAYS): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (error) {
    if (retries.length === 0) throw error;
    const [delay, ...remaining] = retries;
    logger.warn({ url, delay, retriesLeft: remaining.length }, 'Evolution API request failed, retrying...');
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, options, remaining);
  }
}

export async function sendText(phone: string, text: string): Promise<void> {
  const config = await getEvolutionConfig();
  const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
  const body: EvolutionSendTextPayload = { number: phone, text };

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    logger.error({ phone, error, status: res.status }, 'Failed to send WhatsApp message');
    throw new Error(`Evolution API error: ${res.status} ${error}`);
  }

  logger.info({ phone }, 'WhatsApp message sent');
}

export async function sendMedia(
  phone: string,
  mediatype: 'image' | 'video' | 'audio' | 'document',
  media: string,
  caption?: string,
  fileName?: string,
): Promise<void> {
  const config = await getEvolutionConfig();
  const url = `${config.apiUrl}/message/sendMedia/${config.instanceName}`;
  const body = { number: phone, mediatype, media, caption, fileName };

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    logger.error({ phone, mediatype }, 'Failed to send media');
    throw new Error(`Evolution API media error: ${res.status}`);
  }
}

export async function getConnectionState(): Promise<string> {
  try {
    const config = await getEvolutionConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = `${config.apiUrl}/instance/connectionState/${config.instanceName}`;
    const res = await fetch(url, { headers: { apikey: config.apiKey }, signal: controller.signal });
    clearTimeout(timeout);
    const data = (await res.json()) as { instance?: { state?: string } };
    return data?.instance?.state ?? 'unknown';
  } catch {
    return 'offline';
  }
}
