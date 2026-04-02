export type DealStage =
  | 'new_lead'
  | 'contacted'
  | 'qualified'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Deal {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  title: string;
  stage: DealStage;
  product_id: string | null;
  event_date: string | null;
  event_type: string | null;
  estimated_value: number | null;
  actual_value: number | null;
  probability: number;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
