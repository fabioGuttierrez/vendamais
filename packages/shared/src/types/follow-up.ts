export type FollowUpStatus = 'pending' | 'sent' | 'cancelled' | 'completed';

export interface FollowUp {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  deal_id: string | null;
  scheduled_for: string;
  message_template: string;
  status: FollowUpStatus;
  sent_at: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
