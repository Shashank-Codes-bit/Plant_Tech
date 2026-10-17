import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { apiGet, apiPut, uploadImage } from "@/src/api";
import { SetupFrame } from "@/src/components/setup-frame";
import { useToast } from "@/src/components/toast";
import { Button, Field, Icon, LoadingView, Screen, T, Thumb } from "@/src/components/ui";
import { pickFromGallery, takePhoto } from "@/src/hooks/useImageCapture";
import { colors, radius } from "@/src/theme";
import type { Business } from "@/src/types";

export default function SetupShop() {
  const biz = useQuery<Business>({ queryKey: ["business"], queryFn: () => apiGet("/business") });
  if (!biz.data) return <Screen bg={colors.surface}><LoadingView /></Screen>;
  return <ShopStep biz={biz.data} />;
}

function ShopStep({ biz }: { biz: Business }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(biz.name || "");
  const [logo, setLogo] = useState<string | null>(biz.logo_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addPhoto(source: "camera" | "gallery") {
    const LOGO = { hint: t("Drag the corners to fit your logo") };
    const outcome = source === "camera" ? await takePhoto(LOGO) : await pickFromGallery(LOGO);
    if (outcome.status !== "ok") return;
    setUploading(true);
    try {
      setLogo(await uploadImage(outcome.result.base64));
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setUploading(false);
    }
  }

  async function next() {
    setBusy(true);
    try {
      await apiPut("/business", { name: name.trim(), logo_path: logo });
      router.push("/setup/address");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupFrame step={1} title={t("What is your shop called?")} onNext={next} nextDisabled={!name.trim() || uploading} busy={busy}>
      <Field label={t("Shop name (printed on every bill)")} value={name} onChangeText={setName} autoCapitalize="words"
        placeholder="Green Leaf Nursery" testID="setup-shop-name" inputStyle={{ fontSize: 23, borderColor: colors.green }} />
      <View style={{ gap: 10 }}>
        <T v="label">{t("Shop logo or photo (optional)")}</T>
        <Pressable onPress={() => addPhoto("gallery")}
          style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: radius.lg, borderWidth: 2,
            borderStyle: "dashed", borderColor: "#9DB5A6", backgroundColor: colors.page }}>
          {logo ? <Thumb path={logo} size={80} /> : (
            <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
              <Icon name="camera-plus" size={40} color={colors.green} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <T v="bodyLarge">{logo ? t("Change photo") : t("Add photo")}</T>
            <T v="small">{uploading ? t("Uploading") : t("Choose from your gallery, or take a photo below")}</T>
          </View>
        </Pressable>
        <Button title={t("Take photo")} icon="camera" variant="outline" size="md" onPress={() => addPhoto("camera")} />
      </View>
    </SetupFrame>
  );
}
