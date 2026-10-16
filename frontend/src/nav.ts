// Start a fresh screen history at `href` (after log in, setup or log out), so the phone's
// back button can't return to Welcome / Login / the setup wizard.
import type { Href, useRouter } from "expo-router";

export function resetTo(router: ReturnType<typeof useRouter>, href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
