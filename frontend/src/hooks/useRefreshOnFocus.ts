// Refetch when the user comes back to a screen (tabs stay mounted, so data would go stale).
import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

export function useRefreshOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}
