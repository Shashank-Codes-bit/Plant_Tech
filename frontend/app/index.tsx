// Where the app opens: Welcome (logged out), the setup wizard (owner, shop not set up), or Home.
import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";
import { LoadingView, Screen } from "@/src/components/ui";

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/welcome" />;
  if (user.role === "owner" && !user.business?.onboarding_done) return <Redirect href="/setup/shop" />;
  return <Redirect href="/(tabs)" />;
}
