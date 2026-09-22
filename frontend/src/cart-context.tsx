import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  photo_path?: string | null;
  botanical_name?: string;
  stock?: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  setQuantity: (product_id: string, qty: number) => void;
  setPrice: (product_id: string, price: number) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | null>(null);
const STORAGE_KEY = "nursery_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
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

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id ? { ...i, quantity: i.quantity + item.quantity } : i,
        );
      }
      return [...prev, item];
    });
  };

  const setQuantity = (product_id: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== product_id)
        : prev.map((i) => (i.product_id === product_id ? { ...i, quantity: qty } : i)),
    );
  };

  const setPrice = (product_id: string, price: number) => {
    setItems((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, price } : i)));
  };

  const removeItem = (product_id: string) =>
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, setQuantity, setPrice, removeItem, clear, count, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
