/** Claude model pricing in USD per 1M tokens */
export const AI_MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'claude-sonnet-4-20250514': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
};

/** Default USD to BRL exchange rate (overridable via bot_config key 'usd_brl_rate') */
export const DEFAULT_USD_BRL_RATE = 5.50;

/** Calculate cost in BRL for a given token usage */
export function calculateCostBRL(
  inputTokens: number,
  outputTokens: number,
  model: string,
  usdToBrl: number = DEFAULT_USD_BRL_RATE,
): number {
  const pricing = AI_MODEL_PRICING[model];
  if (!pricing) return 0;
  const usdCost =
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return usdCost * usdToBrl;
}
