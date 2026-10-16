import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function SetupLayout() {
  const { ready, user } = useAuth();
  if (ready && !user) return <Redirect href="/welcome" />;
  if (ready && user?.role !== "owner") return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}
