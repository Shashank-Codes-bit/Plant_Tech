// Shapes returned by the backend (see backend/routers/*.py).

export type Product = {
  id: string; sku: string; name: string; botanical_name: string;
  category_id: string | null; category: string; gst_percent: number;
  selling_price: number; cost_price?: number; // cost only for the owner (and workers with reports)
  stock: number; min_stock: number; low_stock: boolean; out_of_stock: boolean;
  supplier: string; notes: string; library_id: string | null;
  photo_path: string | null; image_path: string | null; image_source: "own" | "library" | null;
  created_at: string;
};

export type StockEntry = {
  id: string; change: number; new_stock: number; type: "initial" | "sale" | "adjustment" | "purchase";
  reason: string; by?: { id: string; name: string }; created_at: string;
};

export type LibraryEntry = {
  id: string; name: string; name_hi: string; botanical: string; default_category: string;
  image_path: string | null; image_status: "new" | "live" | null; source: "seed" | "shop";
};

export type Category = { id: string; name: string; gst_percent: number; product_count?: number };

export type InvoiceLine = {
  product_id: string | null; name: string; quantity: number; price: number; gst_percent: number;
  amount: number; net: number; tax: number;
};

export type Invoice = {
  id: string; invoice_number: string; items: InvoiceLine[];
  subtotal: number; discount: number; grand_total: number;
  gst_breakup: { rate: number; taxable: number; tax: number }[]; gst_total: number;
  payment_method: "Cash" | "UPI" | "Card"; customer_id: string | null; customer_name: string; customer_phone: string;
  created_by: { id: string; name: string }; created_at: string;
};

export type Customer = {
  id: string; name: string; phone: string; email: string; address: string; notes: string;
  total_purchases: number; purchase_count: number; last_purchase_at?: string; created_at: string;
};

export type Business = {
  id: string; name: string; address: string; phone: string; gst_registered: boolean; gstin: string;
  upi_id: string; logo_path: string | null; footer_note: string; onboarding_done: boolean;
};

export type Worker = {
  id: string; name: string; phone: string; active: boolean;
  permissions: { sell: boolean; stock: boolean; customers: boolean; reports: boolean }; last_login_at: string | null;
};
