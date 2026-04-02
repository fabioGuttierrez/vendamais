export interface ObjectionLog {
  id: string;
  conversation_id: string;
  contact_id: string;
  objection_type: 'price' | 'timing' | 'need' | 'competitor' | 'trust' | 'other';
  objection_text: string;
  response_text: string;
  response_technique: 'listen' | 'acknowledge' | 'explore' | 'respond' | null;
  was_resolved: boolean | null;
  created_at: string;
}

export interface BotConfig {
  id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
