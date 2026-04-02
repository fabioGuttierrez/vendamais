export const PIPELINE_STAGES = [
  { key: 'new_lead', label: 'Novo Lead', color: '#6366f1', probability: 10 },
  { key: 'contacted', label: 'Contactado', color: '#8b5cf6', probability: 20 },
  { key: 'qualified', label: 'Qualificado', color: '#3b82f6', probability: 40 },
  { key: 'proposal_sent', label: 'Proposta Enviada', color: '#f59e0b', probability: 60 },
  { key: 'negotiation', label: 'Negociação', color: '#f97316', probability: 80 },
  { key: 'won', label: 'Ganho', color: '#22c55e', probability: 100 },
  { key: 'lost', label: 'Perdido', color: '#ef4444', probability: 0 },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]['key'];
