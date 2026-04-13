/** Claude model pricing in USD per 1M tokens */
export const AI_MODEL_PRICING: Record<string, {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheWritePerMillion: number;
}> = {
  'claude-sonnet-4-20250514': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheReadPerMillion: 0.30,   // 90% discount on cached input
    cacheWritePerMillion: 3.75,  // 25% surcharge on first write
  },
};

/** Default USD to BRL exchange rate (overridable via bot_config key 'usd_brl_rate') */
export const DEFAULT_USD_BRL_RATE = 5.50;

/** Calculate cost in BRL for a given token usage (with prompt caching support) */
export function calculateCostBRL(
  inputTokens: number,
  outputTokens: number,
  model: string,
  usdToBrl: number = DEFAULT_USD_BRL_RATE,
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0,
): number {
  const pricing = AI_MODEL_PRICING[model];
  if (!pricing) return 0;
  // Non-cached input = total input minus tokens served from cache
  const regularInput = Math.max(0, inputTokens - cacheReadTokens - cacheCreationTokens);
  const usdCost =
    (regularInput / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion +
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheCreationTokens / 1_000_000) * pricing.cacheWritePerMillion;
  return usdCost * usdToBrl;
}
