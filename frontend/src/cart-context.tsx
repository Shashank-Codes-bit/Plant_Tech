// The order being built: its customer (a must), items and discount. It is the person's draft order:
// saved on the server (one per person) so it survives closing the app or changing phones, and kept on the
// phone too for a quick start. Making the bill or discarding it removes the draft.
// product_id "loose-…" = a line billed without stock; the server gets product_id null for it.
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

import { apiDelete, apiGet, apiPut } from "@/src/api";
import { useAuth } from "@/src/auth";
import { storage } from "@/src/utils/storage";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  gst_percent?: number;
  image_path?: string | null;
  stock?: number | null;
};

export type OrderCustomer = { id: string; name: string; phone: string; purchase_count?: number };

type Draft = { customer: OrderCustomer | null; items: CartItem[]; discount: number };

type CartContextType = {
  customer: OrderCustomer | null;
  setCustomer: (c: OrderCustomer | null) => void;
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
  hasDraft: boolean;
  ready: boolean; // this person's draft has been loaded
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "nurserypos_cart_v4";
const EMPTY: Draft = { customer: null, items: [], discount: 0 };

export const isLoose = (id: string) => id.startsWith("loose-");

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, can } = useAuth();
  const uid = user?.id ?? null;
  const sells = can("sell");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const onServer = useRef(false);

  // Load this person's draft: the server's copy wins; the phone's copy is the fallback when offline.
  useEffect(() => {
    let live = true;
    (async () => {
      let d: Draft = EMPTY;
      if (uid) {
        const saved = await storage.getItem<any>(STORAGE_KEY, null);
        if (saved?.uid === uid) d = { customer: saved.customer ?? null, items: saved.items ?? [], discount: saved.discount ?? 0 };
        if (sells) {
          try {
            const server = await apiGet("/orders/draft");
            d = server ? { customer: server.customer, items: server.items ?? [], discount: server.discount ?? 0 } : EMPTY;
            onServer.current = !!server;
          } catch {
            // offline: keep the phone's copy; it is sent when it next changes
          }
        }
      }
      if (!live) return;
      setDraft(d);
      setLoadedFor(uid);
    })();
    return () => {
      live = false;
    };
  }, [uid, sells]);

  // Save every change: on the phone at once, on the server a moment later.
  useEffect(() => {
    if (!uid || loadedFor !== uid) return;
    storage.setItem(STORAGE_KEY, { uid, ...draft } as any);
    if (!sells) return;
    const empty = !draft.customer && !draft.items.length;
    const id = setTimeout(() => {
      if (empty) {
        if (onServer.current) apiDelete("/orders/draft").catch(() => {});
        onServer.current = false;
      } else {
        apiPut("/orders/draft", {
          customer_id: draft.customer?.id ?? null, discount: draft.discount,
          items: draft.items.map((i) => ({ ...i, gst_percent: i.gst_percent ?? 0, image_path: i.image_path ?? null, stock: i.stock ?? null })),
        }).then(() => { onServer.current = true; }).catch(() => {});
      }
    }, empty ? 0 : 600);
    return () => clearTimeout(id);
  }, [draft, uid, loadedFor, sells]);

  const setItems = (fn: (prev: CartItem[]) => CartItem[]) => setDraft((d) => ({ ...d, items: fn(d.items) }));
  const addItem = (item: CartItem) =>
    setItems((prev) =>
      prev.some((i) => i.product_id === item.product_id)
        ? prev.map((i) => (i.product_id === item.product_id ? { ...i, quantity: i.quantity + item.quantity } : i))
        : [...prev, item],
    );
  const setQuantity = (id: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.product_id !== id) : prev.map((i) => (i.product_id === id ? { ...i, quantity: qty } : i))));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.product_id !== id));

  const { items, customer } = draft;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const d = Math.min(draft.discount, subtotal);
  const factor = subtotal ? (subtotal - d) / subtotal : 1;
  // prices include GST: the tax inside a line is amount * rate / (100 + rate)
  const gstIncluded = items.reduce((s, i) => {
    const r = i.gst_percent || 0;
    return s + (r ? (i.price * i.quantity * factor * r) / (100 + r) : 0);
  }, 0);

  return (
    <CartContext.Provider value={{
      customer, setCustomer: (c) => setDraft((x) => ({ ...x, customer: c })),
      items, addItem, setQuantity, removeItem, clear: () => setDraft(EMPTY),
      discount: d, setDiscount: (v) => setDraft((x) => ({ ...x, discount: v })),
      count: items.reduce((s, i) => s + i.quantity, 0), total: subtotal - d, gstIncluded,
      hasDraft: !!customer || items.length > 0,
      ready: !!uid && loadedFor === uid,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
