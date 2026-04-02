export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'customer' | 'bot' | 'human';

export interface Message {
  id: string;
  conversation_id: string;
  contact_id: string;
  direction: MessageDirection;
  sender_type: MessageSenderType;
  content: string;
  media_type: string | null;
  media_url: string | null;
  evolution_message_id: string | null;
  ai_model: string | null;
  ai_tokens_used: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
