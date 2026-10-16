// New order: take a photo (AI finds the product) or type its name.
// Found → pick how many → add. Not in stock → save it as a new product, or just sell it on this bill.
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslation } from "react-i18next";

import { apiGet, apiPost, uploadImage } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useCart } from "@/src/cart-context";
import { OrderCustomerBar } from "@/src/components/order-customer";
import { CategoryPicker } from "@/src/components/category-picker";
import { useToast } from "@/src/components/toast";
import { Badge, BottomBar, Button, Field, Header, Icon, Screen, Segmented, Stepper, T, Thumb } from "@/src/components/ui";
import { formatCurrency, formatQty } from "@/src/format";
import { CaptureResult, pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";
import { colors, fonts, radius, spacing, touch } from "@/src/theme";
import type { Product } from "@/src/types";

type Stage =
  | { kind: "start" }
  | { kind: "checking" }
  | { kind: "found"; product: Product; confidence?: string }
  | { kind: "new"; name: string; botanical: string; categoryId: string | null };

export default function OrderScan() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const [stage, setStage] = useState<Stage>({ kind: "start" });
  const [photo, setPhoto] = useState<CaptureResult | null>(null);

  async function capture(source: "camera" | "gallery") {
    const out = source === "camera" ? await takePhoto() : await pickFromGallery();
    if (out.status === "denied") {
      toast.show(t("Allow camera and photos for Hara Hisaab in your phone settings"), "error");
      return;
    }
    if (out.status !== "ok") return;
    setPhoto(out.result);
    setStage({ kind: "checking" });
    try {
      const r = await apiPost("/ai/identify-plant", { image_base64: out.result.base64 });
      if (r.matched_product) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setStage({ kind: "found", product: r.matched_product, confidence: r.confidence_label });
      } else {
        setStage({ kind: "new", name: r.plant_name === "Unknown Plant" ? "" : r.plant_name, botanical: r.scientific_name || "",
          categoryId: r.suggested_category_id ?? null });
      }
    } catch (e: any) {
      toast.show(e.message, "error");
      setStage({ kind: "start" });
    }
  }

  const restart = () => {
    setPhoto(null);
    setStage({ kind: "start" });
  };
  // After adding: back to the camera for the next plant, or on to the order.
  const added = (next: "scan" | "cart") => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    restart();
    if (next === "cart") router.push("/order/cart");
    else toast.show(t("Added. Scan the next one."), "success");
  };

  if (cart.ready && !cart.customer) return <Redirect href="/order/customer" />;
  if (stage.kind === "found") {
    return <Found product={stage.product} confidence={stage.confidence} photoUri={photo?.uri} onBack={restart} onAdded={added} />;
  }
  if (stage.kind === "new") {
    return <NotInStock initial={stage} photo={photo} onBack={restart} onAdded={added} />;
  }
  return <Start checking={stage.kind === "checking"} photoUri={photo?.uri} onCapture={capture}
    onPick={(p) => setStage({ kind: "found", product: p })}
    onNew={(name) => { setPhoto(null); setStage({ kind: "new", name, botanical: "", categoryId: null }); }} />;
}

function Start({ checking, photoUri, onCapture, onPick, onNew }: {
  checking: boolean; photoUri?: string; onCapture: (s: "camera" | "gallery") => void; onPick: (p: Product) => void; onNew: (name: string) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [q, setQ] = useState("");
  const query = q.trim();
  const results = useQuery<Product[]>({
    queryKey: ["products", "search", query],
    queryFn: () => apiGet(`/products?search=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  return (
    <Screen bg={colors.surface}>
      <Header title={t("Add items")} close onBack={() => router.back()} testID="scan-close" />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 12 }}><OrderCustomerBar /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.lg }}>
        {!query && (
          <>
            <Pressable testID="scan-camera-panel" disabled={checking} onPress={() => onCapture("camera")}
              style={{ marginHorizontal: spacing.lg, height: 300, borderRadius: 26, overflow: "hidden", backgroundColor: "#1C2B24",
                alignItems: "center", justifyContent: "center" }}>
              {checking && photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />
                  <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(16,32,26,0.55)" } as any} />
                  <ActivityIndicator size="large" color={colors.white} />
                  <T v="bodyLarge" color={colors.white} style={{ marginTop: 12 }}>{t("Finding the plant…")}</T>
                </>
              ) : (
                <>
                  <View style={{ width: 190, height: 190, borderWidth: 4, borderColor: colors.white, borderRadius: 28, opacity: 0.85,
                    alignItems: "center", justifyContent: "center" }}>
                    <Icon name="leaf" size={64} color={colors.white} />
                  </View>
                  <T v="bodyLarge" color={colors.white} style={{ marginTop: 16 }}>{t("Take a photo of the plant")}</T>
                </>
              )}
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, paddingTop: 18, paddingHorizontal: 16 }}>
              <Pressable testID="scan-gallery" accessibilityLabel={t("Pick from gallery")} disabled={checking} onPress={() => onCapture("gallery")}
                style={{ width: 60, height: 60, borderRadius: 18, borderWidth: 2, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" }}>
                <Icon name="image-outline" size={28} color={colors.ink} />
              </Pressable>
              <Pressable testID="scan-take-photo" accessibilityLabel={t("Take photo")} disabled={checking} onPress={() => onCapture("camera")}
                style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center",
                  borderWidth: 6, borderColor: colors.blueTint }}>
                <Icon name="camera" size={40} color={colors.white} />
              </Pressable>
              <T v="bold" color={colors.blue} style={{ width: 60, fontSize: 14, textAlign: "center" }}>{t("Tap to scan")}</T>
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: query ? 0 : 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, paddingHorizontal: 14, borderWidth: 2,
            borderColor: query ? colors.green : colors.lineStrong, borderRadius: 16 }}>
            <Icon name="magnify" size={26} color={colors.muted} />
            <TextInput testID="scan-search" value={q} onChangeText={setQ} placeholder={t("Or type the product name")}
              placeholderTextColor={colors.muted} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, minHeight: 56 }} />
            {!!q && (
              <Pressable accessibilityLabel={t("Clear")} onPress={() => setQ("")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="close-circle" size={24} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {query.length >= 2 && results.isLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 12 }} />}
          {(results.data ?? []).map((p) => (
            <Pressable key={p.id} testID={`scan-result-${p.name}`} onPress={() => onPick(p)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, minHeight: 72, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}>
              <Thumb path={p.image_path} size={52} />
              <View style={{ flex: 1 }}>
                <T v="bold">{p.name}</T>
                <T v="small" color={p.out_of_stock ? colors.red : colors.muted}>
                  {p.out_of_stock ? t("Out of stock") : t("{{n}} in stock", { n: formatQty(p.stock) })}
                </T>
              </View>
              <T v="number">{formatCurrency(p.selling_price)}</T>
            </Pressable>
          ))}
          {query.length >= 2 && results.data && (
            <Pressable testID="scan-not-listed" onPress={() => onNew(query)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 64, borderRadius: radius.lg, borderWidth: 2,
                borderStyle: "dashed", borderColor: colors.green }}>
              <Icon name="plus-circle" size={30} color={colors.green} />
              <T v="bold" color={colors.greenDark} style={{ flex: 1 }}>
                {results.data.length ? t("Not in the list? Sell “{{q}}”", { q: query }) : t("“{{q}}” isn't in your products. Sell it anyway", { q: query })}
              </T>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <CartBar />
    </Screen>
  );
}

// "2 · View order · ₹500" at the bottom while there are items.
function CartBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const cart = useCart();
  if (!cart.count) return null;
  return (
    <BottomBar style={{ borderTopWidth: 0 }}>
      <Pressable testID="scan-view-order" onPress={() => router.push("/order/cart")}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, minHeight: touch.primary, borderRadius: radius.lg, backgroundColor: colors.green }}>
        <View style={{ minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
          <T v="number" color={colors.greenDark} style={{ fontSize: 19 }}>{formatQty(cart.count)}</T>
        </View>
        <T v="bodyLarge" color={colors.white} style={{ flex: 1 }}>{t("View order")}</T>
        <T v="title" color={colors.white} style={{ fontSize: 24 }}>{formatCurrency(cart.total)}</T>
      </Pressable>
    </BottomBar>
  );
}

function Found({ product: p, confidence, photoUri, onBack, onAdded }: {
  product: Product; confidence?: string; photoUri?: string; onBack: () => void; onAdded: (next: "scan" | "cart") => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const cart = useCart();
  const { can } = useAuth();
  const inCart = cart.items.find((i) => i.product_id === p.id)?.quantity ?? 0;
  const left = Math.max(0, p.stock - inCart);
  const [qty, setQty] = useState(1);
  const conf = confidence === "High" ? { text: t("Sure match"), tone: "green" as const }
    : confidence === "Medium" ? { text: t("Probably"), tone: "amber" as const }
    : confidence ? { text: t("Not sure, check it"), tone: "red" as const } : null;

  function add(next: "scan" | "cart", loose = false) {
    cart.addItem(loose
      ? { product_id: `loose-${Date.now().toString(36)}`, name: p.name, price: p.selling_price, quantity: qty }
      : { product_id: p.id, name: p.name, price: p.selling_price, quantity: qty, gst_percent: p.gst_percent, image_path: p.image_path, stock: p.stock });
    onAdded(next);
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={conf ? t("Plant found") : p.name} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }}>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          {photoUri ? <Image source={{ uri: photoUri }} style={{ width: 110, height: 110, borderRadius: 24 }} contentFit="cover" />
            : <Thumb path={p.image_path} size={110} />}
          <View style={{ flex: 1, gap: 4 }}>
            <T v="title" testID="found-name">{p.name}</T>
            {!!p.botanical_name && <T v="small" style={{ fontStyle: "italic" }}>{p.botanical_name}</T>}
            {conf && <Badge text={conf.text} tone={conf.tone} />}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.page }}>
            <T v="label">{t("Price")}</T>
            <T v="title">{formatCurrency(p.selling_price)}</T>
          </View>
          <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: left ? colors.page : "#FDECEC" }}>
            <T v="label">{t("In stock")}</T>
            <T v="title" color={left ? colors.ink : colors.red}>{formatQty(p.stock)}</T>
            {inCart > 0 && <T v="caption">{t("{{n}} already in this order", { n: formatQty(inCart) })}</T>}
          </View>
        </View>

        {left > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T v="bodyLarge">{t("Quantity")}</T>
            <Stepper value={qty} onChange={setQty} max={left} testID="found-qty" />
          </View>
        ) : (
          <View style={{ gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.amberTint }}>
            <T v="bold" color={colors.amberInk}>{t("Out of stock in the app")}</T>
            <T v="small" color={colors.amberInk}>{t("If you have it in hand, sell it anyway. Then fix the stock count.")}</T>
            {can("stock") && (
              <Button title={t("Add stock")} icon="package-variant-plus" variant="outline" size="md"
                onPress={() => router.push({ pathname: "/products/[id]", params: { id: p.id } })} />
            )}
          </View>
        )}

        <Pressable onPress={onBack} style={{ minHeight: 48, justifyContent: "center", alignItems: "center" }}>
          <T v="bold" color={colors.green}>{t("Wrong plant? Search instead")}</T>
        </Pressable>
      </ScrollView>
      <BottomBar>
        {left > 0 ? (
          <>
            <Button title={t("Add and scan next")} icon="camera" variant="outline" size="md" onPress={() => add("scan")} testID="found-add-next" />
            <Button title={t("Add to order · {{total}}", { total: formatCurrency(p.selling_price * qty) })} icon="cart-plus"
              onPress={() => add("cart")} testID="found-add" />
          </>
        ) : (
          <Button title={t("Sell anyway · {{total}}", { total: formatCurrency(p.selling_price * qty) })} icon="cart-plus"
            onPress={() => add("cart", true)} testID="found-sell-anyway" />
        )}
      </BottomBar>
    </Screen>
  );
}

function NotInStock({ initial, photo, onBack, onAdded }: {
  initial: { name: string; botanical: string; categoryId: string | null }; photo: CaptureResult | null;
  onBack: () => void; onAdded: (next: "scan" | "cart") => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const cart = useCart();
  const { can } = useAuth();
  const canSave = can("stock");
  const [mode, setMode] = useState<"save" | "once">(canSave ? "save" : "once");
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);


  const priceN = Number(price);
  const stockN = Number(stock);
  const priceOk = price !== "" && priceN >= 0 && Number.isFinite(priceN);
  const stockOk = mode === "once" || (Number.isFinite(stockN) && stockN >= qty);
  const ok = !!name.trim() && priceOk && stockOk;

  async function submit() {
    if (mode === "once") {
      cart.addItem({ product_id: `loose-${Date.now().toString(36)}`, name: name.trim(), price: priceN, quantity: qty });
      onAdded("cart");
      return;
    }
    setBusy(true);
    try {
      const photo_path = photo ? await uploadImage(photo.base64) : null;
      const p: Product = await apiPost("/products", { name: name.trim(), botanical_name: initial.botanical, category_id: categoryId,
        selling_price: priceN, stock: stockN, photo_path });
      qc.invalidateQueries({ queryKey: ["products"] });
      cart.addItem({ product_id: p.id, name: p.name, price: p.selling_price, quantity: qty, gst_percent: p.gst_percent, image_path: p.image_path, stock: p.stock });
      onAdded("cart");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen bg={colors.surface}>
      <Header title={name || t("Not in stock")} onBack={onBack} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 14, borderRadius: radius.lg, backgroundColor: colors.amberTint }}>
          {photo ? <Image source={{ uri: photo.uri }} style={{ width: 72, height: 72, borderRadius: 18 }} contentFit="cover" />
            : <Icon name="help-circle" size={44} color={colors.amber} />}
          <View style={{ flex: 1 }}>
            <T v="bodyLarge" color={colors.amberInk}>{t("Not in your stock yet")}</T>
            <T v="small" color={colors.amberInk}>{t("You can still sell it now.")}</T>
          </View>
        </View>

        {canSave && (
          <Segmented value={mode} onChange={setMode}
            options={[{ value: "save", label: t("Add to products") }, { value: "once", label: t("Just sell it") }]} />
        )}
        <T v="small">
          {mode === "save" ? t("Adds it to your products, then to this order.") : t("For something you don't keep in stock. Only this bill.")}
        </T>

        <Field label={t("Name")} value={name} onChangeText={setName} autoCapitalize="words" testID="new-name" />
        <Field label={t("Price ₹ (each)")} value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad"
          placeholder="0" testID="new-price" inputStyle={{ fontSize: 24 }} />
        {mode === "save" && (
          <>
            <Field label={t("Stock (with this one)")} value={stock} onChangeText={(v) => setStock(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad" testID="new-stock" error={!stockOk ? t("At least {{n}}, for this order", { n: qty }) : undefined} />
            <CategoryPicker value={categoryId} onChange={setCategoryId} />
          </>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T v="bodyLarge">{t("Quantity")}</T>
          <Stepper value={qty} onChange={setQty} testID="new-qty" />
        </View>
      </KeyboardAwareScrollView>
      <BottomBar>
        <Button title={mode === "save" ? t("Save and add to order") : t("Add to order")} icon="cart-plus" onPress={submit}
          loading={busy} disabled={!ok} testID="new-submit" />
      </BottomBar>
    </Screen>
  );
}
