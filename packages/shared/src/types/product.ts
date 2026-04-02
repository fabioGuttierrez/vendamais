export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  ideal_for: string | null;
  capacity: string | null;
  delivery_time: string | null;
  min_price_hint: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
