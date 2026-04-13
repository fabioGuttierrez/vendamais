export interface TrainingConversation {
  id: string;
  title: string;
  outcome: 'positive' | 'negative';
  raw_text: string;
  parsed_messages: ParsedMessage[];
  message_count: number;
  insights: TrainingInsights | null;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedMessage {
  sender: string;
  content: string;
  timestamp?: string;
}

export interface TrainingInsights {
  techniques: string[];
  success_patterns: string[];
  red_flags: string[];
  objection_handling: string[];
  key_phrases: string[];
  summary: string;
}
