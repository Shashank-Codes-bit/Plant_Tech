// Hands a just-taken photo from one screen to the next (e.g. Scan → Add new plant)
// without putting megabytes of base64 into route params. Read once, then cleared.
export type PendingPhoto = { uri: string; base64: string };

let pending: PendingPhoto | null = null;

export function setPendingPhoto(photo: PendingPhoto | null) {
  pending = photo;
}

export function takePendingPhoto(): PendingPhoto | null {
  const photo = pending;
  pending = null;
  return photo;
}
