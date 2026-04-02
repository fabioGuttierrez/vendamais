export interface Contact {
  id: string;
  phone: string;
  phone_normalized: string;
  name: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  event_type: string | null;
  event_date: string | null;
  estimated_guests: number | null;
  budget_range: string | null;
  source: string;
  tags: string[];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
export type ContactUpdate = Partial<ContactInsert>;
