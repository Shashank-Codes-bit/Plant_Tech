// The order being built: items (kept on the phone across restarts) and the discount.
// product_id "loose-…" = a line billed without stock; the server gets product_id null for it.
import React, { createContext, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  gst_percent?: number;
  image_path?: string | null;
  stock?: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  setQuantity: (product_id: string, qty: number) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
  discount: number;
  setDiscount: (d: number) => void;
  count: number;
  total: number;
  gstIncluded: number;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "nurserypos_cart_v2";

export const isLoose = (id: string) => id.startsWith("loose-");

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<any>(STORAGE_KEY, []);
      if (Array.isArray(saved)) setItems(saved);
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (hydrated) storage.setItem(STORAGE_KEY, items as any);
  }, [items, hydrated]);

  const addItem = (item: CartItem) =>
    setItems((prev) =>
      prev.some((i) => i.product_id === item.product_id)
        ? prev.map((i) => (i.product_id === item.product_id ? { ...i, quantity: i.quantity + item.quantity } : i))
        : [...prev, item],
    );
  const setQuantity = (id: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.product_id !== id) : prev.map((i) => (i.product_id === id ? { ...i, quantity: qty } : i))));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.product_id !== id));
  const clear = () => {
    setItems([]);
    setDiscount(0);
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const d = Math.min(discount, subtotal);
  const factor = subtotal ? (subtotal - d) / subtotal : 1;
  // prices include GST: the tax inside a line is amount * rate / (100 + rate)
  const gstIncluded = items.reduce((s, i) => {
    const r = i.gst_percent || 0;
    return s + (r ? (i.price * i.quantity * factor * r) / (100 + r) : 0);
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, setQuantity, removeItem, clear, discount: d, setDiscount,
      count: items.reduce((s, i) => s + i.quantity, 0), total: subtotal - d, gstIncluded }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
