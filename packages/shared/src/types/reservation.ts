export type ReservationStatus = 'pending' | 'in_analysis' | 'confirmed' | 'cancelled';

export interface Reservation {
  id: string;
  product_id: string;
  contact_id: string | null;
  deal_id: string | null;
  group_id: string | null;
  event_date: string;
  status: ReservationStatus;
  notes: string | null;
  created_by: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
