import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { ParsedMessage } from '../utils/whatsapp-parser.js';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface TrainingInsights {
  summary: string;
  techniques_that_worked: string[];
  objection_handling: { objection: string; response: string; effective: boolean }[];
  improvement_points: string[];
  success_patterns: string[];
  red_flags: string[];
  key_phrases: string[];
}

export async function analyzeConversation(
  messages: ParsedMessage[],
  outcome: 'positive' | 'negative',
): Promise<TrainingInsights> {
  const conversationText = messages
    .map((m) => `[${m.timestamp}] ${m.sender}: ${m.content}`)
    .join('\n');

  const outcomeLabel = outcome === 'positive'
    ? 'POSITIVO (venda fechada com sucesso)'
    : 'NEGATIVO (venda perdida / cliente desistiu)';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `Você é um analista especialista em vendas consultivas para o mercado de eventos.
Analise conversas de vendas e extraia insights acionáveis em formato JSON.
Responda SOMENTE com o JSON, sem markdown, sem explicações.`,
    messages: [
      {
        role: 'user',
        content: `Analise esta conversa de vendas. Resultado: ${outcomeLabel}

CONVERSA:
${conversationText}

Extraia um JSON com esta estrutura exata:
{
  "summary": "resumo de 2-3 linhas da conversa",
  "techniques_that_worked": ["tecnica 1", "tecnica 2"],
  "objection_handling": [{"objection": "objecao do cliente", "response": "como o vendedor respondeu", "effective": true/false}],
  "improvement_points": ["ponto de melhoria 1"],
  "success_patterns": ["padrao que contribuiu para o resultado"],
  "red_flags": ["sinal de alerta que deveria ter sido notado"],
  "key_phrases": ["frase especifica que teve impacto positivo ou negativo"]
}

IMPORTANTE:
- Avalie do ponto de vista de vendas consultivas para eventos
- Identifique técnicas de fechamento usadas (ou que deveriam ter sido usadas)
- Destaque como objeções foram tratadas (ou mal tratadas)
- Para resultado NEGATIVO, foque em o que poderia ter sido diferente
- Para resultado POSITIVO, foque em o que funcionou para replicar`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const rawText = textBlock?.text || '{}';

  try {
    // Clean any markdown wrapping
    const jsonText = rawText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(jsonText) as TrainingInsights;

    // Validate required fields
    return {
      summary: insights.summary || '',
      techniques_that_worked: insights.techniques_that_worked || [],
      objection_handling: insights.objection_handling || [],
      improvement_points: insights.improvement_points || [],
      success_patterns: insights.success_patterns || [],
      red_flags: insights.red_flags || [],
      key_phrases: insights.key_phrases || [],
    };
  } catch (error) {
    logger.error({ error, rawText }, 'Failed to parse training analysis JSON');
    throw new Error('Failed to parse AI analysis response');
  }
}

export function buildTrainingInsightsPrompt(
  allInsights: { insights: TrainingInsights; outcome: string }[],
): string {
  if (allInsights.length === 0) return '';

  const positive = allInsights.filter((i) => i.outcome === 'positive');
  const negative = allInsights.filter((i) => i.outcome === 'negative');

  const lines: string[] = [
    `## INSIGHTS DE TREINAMENTO (baseado em ${allInsights.length} conversas reais)`,
    '',
  ];

  // What works
  const techniques = [...new Set(positive.flatMap((i) => i.insights.techniques_that_worked))];
  const patterns = [...new Set(positive.flatMap((i) => i.insights.success_patterns))];
  const goodPhrases = [...new Set(positive.flatMap((i) => i.insights.key_phrases))];

  if (techniques.length > 0 || patterns.length > 0) {
    lines.push('### O que funciona (comprovado em vendas reais):');
    techniques.slice(0, 8).forEach((t) => lines.push(`- ${t}`));
    patterns.slice(0, 5).forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }

  // What to avoid
  const redFlags = [...new Set(negative.flatMap((i) => i.insights.red_flags))];
  const improvements = [...new Set(negative.flatMap((i) => i.insights.improvement_points))];

  if (redFlags.length > 0 || improvements.length > 0) {
    lines.push('### O que evitar (causou perda de vendas):');
    redFlags.slice(0, 5).forEach((r) => lines.push(`- ${r}`));
    improvements.slice(0, 5).forEach((im) => lines.push(`- ${im}`));
    lines.push('');
  }

  // Effective phrases
  if (goodPhrases.length > 0) {
    lines.push('### Frases eficazes (usadas em vendas bem-sucedidas):');
    goodPhrases.slice(0, 6).forEach((p) => lines.push(`- "${p}"`));
    lines.push('');
  }

  // Proven objection handling
  const effectiveHandling = positive
    .flatMap((i) => i.insights.objection_handling)
    .filter((o) => o.effective);

  if (effectiveHandling.length > 0) {
    lines.push('### Tratamento de objeções comprovado:');
    effectiveHandling.slice(0, 5).forEach((o) => {
      lines.push(`- Objeção "${o.objection}": Resposta que funcionou: "${o.response}"`);
    });
    lines.push('');
  }

  const result = lines.join('\n');
  // Limit to ~2000 tokens (~8000 chars)
  return result.length > 8000 ? result.slice(0, 8000) + '\n...(insights truncados)' : result;
}
