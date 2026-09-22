import * as ImagePicker from "expo-image-picker";

export type CaptureResult = { uri: string; base64: string };
export type CaptureOutcome =
  | { status: "ok"; result: CaptureResult }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "cancelled" };

const OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.6,
  base64: true,
  allowsEditing: true,
};

export async function takePhoto(): Promise<CaptureOutcome> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: "denied", canAskAgain: perm.canAskAgain };
  const res = await ImagePicker.launchCameraAsync(OPTS);
  if (res.canceled || !res.assets?.[0]?.base64) return { status: "cancelled" };
  const a = res.assets[0];
  return { status: "ok", result: { uri: a.uri, base64: a.base64! } };
}

export async function pickFromGallery(): Promise<CaptureOutcome> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: "denied", canAskAgain: perm.canAskAgain };
  const res = await ImagePicker.launchImageLibraryAsync(OPTS);
  if (res.canceled || !res.assets?.[0]?.base64) return { status: "cancelled" };
  const a = res.assets[0];
  return { status: "ok", result: { uri: a.uri, base64: a.base64! } };
}
