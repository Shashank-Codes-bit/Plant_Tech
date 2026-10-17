// Start a fresh screen history at `href` (after log in, setup or log out), so the phone's
// back button can't return to Welcome / Login / the setup wizard.
// `then` opens one more screen on top once the tabs are showing (e.g. Products → Add product);
// the tabs layout picks it up with takePendingOpen(), so it never lands on a screen that redirects away.
import type { Href, useRouter } from "expo-router";

let pendingOpen: Href | null = null;

export function resetTo(router: ReturnType<typeof useRouter>, href: Href, then?: Href) {
  pendingOpen = then ?? null;
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

export function takePendingOpen(): Href | null {
  const next = pendingOpen;
  pendingOpen = null;
  return next;
}
