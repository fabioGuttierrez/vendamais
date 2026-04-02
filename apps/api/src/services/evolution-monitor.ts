import { logger } from '../utils/logger.js';
import { getConnectionState } from '../services/evolution-api.js';
import { getSupabase } from '../config/supabase.js';
import { getEvolutionConfig } from '../config/evolution-config.js';

const CHECK_INTERVAL = 60_000; // 1 minute
const RECONNECT_COOLDOWN = 300_000; // 5 minutes between reconnect attempts

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastState = 'unknown';
let lastReconnectAttempt = 0;
let consecutiveFailures = 0;

async function checkAndRecover(): Promise<void> {
  try {
    const state = await getConnectionState();

    if (state === 'open') {
      if (lastState !== 'open') {
        logger.info('Evolution API: WhatsApp reconnected successfully');
        await logEvent('connected', 'WhatsApp connection restored');
      }
      consecutiveFailures = 0;
      lastState = state;
      return;
    }

    // State is not 'open' — connection issue
    consecutiveFailures++;
    logger.warn({ state, consecutiveFailures }, 'Evolution API: WhatsApp not connected');

    if (state === 'close' || state === 'offline') {
      await attemptReconnect();
    }

    lastState = state;
  } catch (error) {
    consecutiveFailures++;
    logger.error({ error, consecutiveFailures }, 'Evolution API: Health check failed');
    lastState = 'error';

    // If Evolution server itself is down, try to restart instance after cooldown
    if (consecutiveFailures >= 3) {
      await attemptReconnect();
    }
  }
}

async function attemptReconnect(): Promise<void> {
  const now = Date.now();
  if (now - lastReconnectAttempt < RECONNECT_COOLDOWN) {
    logger.info('Evolution API: Reconnect cooldown active, skipping');
    return;
  }

  lastReconnectAttempt = now;
  logger.info('Evolution API: Attempting to reconnect instance...');

  try {
    const config = await getEvolutionConfig();

    // 1. Try to restart the instance connection
    const restartRes = await fetch(
      `${config.apiUrl}/instance/restart/${config.instanceName}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', apikey: config.apiKey },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (restartRes.ok) {
      logger.info('Evolution API: Restart command sent successfully');
      await logEvent('reconnect_attempt', 'Instance restart command sent');
      return;
    }

    // 2. If restart fails, try connect
    const connectRes = await fetch(
      `${config.apiUrl}/instance/connect/${config.instanceName}`,
      {
        method: 'GET',
        headers: { apikey: config.apiKey },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (connectRes.ok) {
      logger.info('Evolution API: Connect command sent, may need QR scan');
      await logEvent('reconnect_attempt', 'Connect command sent — may need QR code scan');
    } else {
      logger.error({ status: connectRes.status }, 'Evolution API: Connect command failed');
      await logEvent('reconnect_failed', `Connect failed with status ${connectRes.status}`);
    }
  } catch (error) {
    logger.error({ error }, 'Evolution API: Reconnect attempt failed (server may be down)');
    await logEvent('reconnect_failed', 'Server unreachable');
  }
}

async function logEvent(event: string, details: string): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('bot_config').upsert(
      {
        key: 'evolution_status',
        value: { state: lastState, event, details, timestamp: new Date().toISOString(), consecutiveFailures },
      },
      { onConflict: 'key' },
    );
  } catch {
    // Don't let logging failures break the monitor
  }
}

export function startEvolutionMonitor(): void {
  if (monitorInterval) return;

  logger.info({ interval: CHECK_INTERVAL / 1000 + 's' }, 'Evolution API monitor started');

  // Initial check after 10s (let server fully start)
  setTimeout(() => {
    checkAndRecover();
    monitorInterval = setInterval(checkAndRecover, CHECK_INTERVAL);
  }, 10_000);
}

export function stopEvolutionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('Evolution API monitor stopped');
  }
}

export function getMonitorStatus() {
  return {
    lastState,
    consecutiveFailures,
    lastReconnectAttempt: lastReconnectAttempt ? new Date(lastReconnectAttempt).toISOString() : null,
    isMonitoring: monitorInterval !== null,
  };
}
