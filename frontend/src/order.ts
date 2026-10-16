// Turning the cart into a bill. Used by the Pay and UPI screens.
import { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { apiPost } from "@/src/api";
import { isLoose, useCart } from "@/src/cart-context";
import { useToast } from "@/src/components/toast";
import type { Invoice } from "@/src/types";

export type PaymentMethod = Invoice["payment_method"];

// The customer typed on the Pay screen, handed to the UPI screen (kept out of the address bar).
let payer = { phone: "", name: "" };
export const setPayer = (p: typeof payer) => {
  payer = p;
};
export const getPayer = () => payer;

export function useCreateBill() {
  const cart = useCart();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function create(method: PaymentMethod, phone10: string, name: string) {
    if (busy || !cart.items.length) return;
    setBusy(true);
    try {
      const inv: Invoice = await apiPost("/invoices", {
        items: cart.items.map((i) => ({ product_id: isLoose(i.product_id) ? null : i.product_id, name: i.name, quantity: i.quantity, price: i.price })),
        customer_name: name.trim(),
        customer_phone: phone10 ? `+91${phone10}` : "",
        discount: cart.discount,
        payment_method: method,
      });
      cart.clear();
      qc.invalidateQueries();
      // Close the order screens; the bill opens on top of Home.
      router.dismissTo("/(tabs)");
      router.push({ pathname: "/bill/[id]", params: { id: inv.id, done: "1" } });
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return { create, busy };
}
