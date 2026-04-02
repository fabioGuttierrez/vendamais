import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Download audio from Evolution API using base64 endpoint
 */
async function downloadAudioFromEvolution(messageId: string): Promise<Buffer | null> {
  try {
    const url = `${env.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${env.EVOLUTION_INSTANCE_NAME}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify({ message: { key: { id: messageId } } }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'Failed to get base64 from Evolution');
      return null;
    }

    const data = (await res.json()) as { base64?: string };
    if (!data.base64) {
      logger.warn('Evolution returned no base64 data');
      return null;
    }

    return Buffer.from(data.base64, 'base64');
  } catch (error) {
    logger.error({ error }, 'Failed to download audio from Evolution');
    return null;
  }
}

/**
 * Download audio directly from URL
 */
async function downloadAudioFromUrl(audioUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Transcribe audio using Groq Whisper
 */
export async function transcribeAudio(messageId: string, mediaUrl?: string): Promise<string | null> {
  if (!env.GROQ_API_KEY) {
    logger.warn('GROQ_API_KEY not set — audio transcription disabled');
    return null;
  }

  try {
    // 1. Download audio (try Evolution base64 first, then direct URL)
    let audioBuffer = await downloadAudioFromEvolution(messageId);
    if (!audioBuffer && mediaUrl) {
      audioBuffer = await downloadAudioFromUrl(mediaUrl);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      logger.error('Could not download audio from any source');
      return null;
    }

    logger.info({ size: audioBuffer.length }, 'Audio downloaded, sending to Groq Whisper');

    // 2. Send to Groq Whisper
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
    const formData = new FormData();
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');

    const transcriptionRes = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!transcriptionRes.ok) {
      const error = await transcriptionRes.text();
      logger.error({ status: transcriptionRes.status, error }, 'Groq transcription failed');
      return null;
    }

    const result = (await transcriptionRes.json()) as { text?: string };
    const transcription = result.text?.trim();

    if (!transcription) {
      logger.warn('Groq returned empty transcription');
      return null;
    }

    logger.info({ chars: transcription.length }, 'Audio transcribed successfully');
    return transcription;
  } catch (error) {
    logger.error({ error }, 'Audio transcription error');
    return null;
  }
}
