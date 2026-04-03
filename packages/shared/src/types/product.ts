export interface ProductFaq {
  question: string;
  answer: string;
}

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
  video_url: string | null;
  pricing_info: string | null;
  technical_specs: Record<string, string> | null;
  faq: ProductFaq[] | null;
  coverage_area: string | null;
  min_notice_hours: number | null;
  package_includes: string | null;
  restrictions: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
