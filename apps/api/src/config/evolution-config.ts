import { env } from '../config/env.js';
import { getSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

let configCache: EvolutionConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get Evolution API config from bot_config table, falling back to env vars.
 * Cached for 1 minute to avoid DB calls on every message.
 */
export async function getEvolutionConfig(): Promise<EvolutionConfig> {
  const now = Date.now();
  if (configCache && now < cacheExpiry) {
    return configCache;
  }

  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    const dbConfig = Object.fromEntries((data || []).map((c) => [c.key, c.value]));

    configCache = {
      apiUrl: (dbConfig.evolution_api_url as string) || env.EVOLUTION_API_URL,
      apiKey: (dbConfig.evolution_api_key as string) || env.EVOLUTION_API_KEY,
      instanceName: (dbConfig.evolution_instance_name as string) || env.EVOLUTION_INSTANCE_NAME,
    };

    cacheExpiry = now + CACHE_TTL;
    return configCache;
  } catch (error) {
    logger.warn({ error }, 'Failed to load Evolution config from DB, using env vars');
    return {
      apiUrl: env.EVOLUTION_API_URL,
      apiKey: env.EVOLUTION_API_KEY,
      instanceName: env.EVOLUTION_INSTANCE_NAME,
    };
  }
}

/** Force config cache to refresh on next call */
export function invalidateEvolutionConfigCache(): void {
  configCache = null;
  cacheExpiry = 0;
}
