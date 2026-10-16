// Yes/No question that works on phones and on the web preview.
import { Alert, Platform } from "react-native";
import i18n from "i18next";

export function confirm(title: string, message: string, yes: string, destructive = false): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: i18n.t("Cancel"), style: "cancel", onPress: () => resolve(false) },
      { text: yes, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
