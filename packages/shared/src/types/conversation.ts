export type ConversationState =
  | 'greeting'
  | 'qualification'
  | 'presentation'
  | 'objection_handling'
  | 'closing'
  | 'follow_up'
  | 'human_takeover'
  | 'completed'
  | 'lost';

export interface QualificationData {
  event_type?: string;
  event_date?: string;
  estimated_guests?: number;
  budget_range?: string;
  city?: string;
  customer_name?: string;
}

export interface Conversation {
  id: string;
  contact_id: string;
  state: ConversationState;
  is_bot_active: boolean;
  human_agent_id: string | null;
  qualification_data: QualificationData;
  ai_context: Record<string, unknown>;
  last_message_at: string | null;
  message_count: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}
