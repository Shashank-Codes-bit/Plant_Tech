// Photos are prepared on the phone: turned upright once (so the crop screen and the file agree on
// every pixel), cut to the frame the user chose, and shrunk to at most 1568 px before upload.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_EDGE = 1568; // the largest side Claude uses; bigger photos only cost upload time
const WORK_EDGE = 2000; // what the crop screen works on

export type Picked = { uri: string; width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number }; // in image pixels

export async function normalize(uri: string): Promise<Picked> {
  const first = await ImageManipulator.manipulate(uri).renderAsync();
  const long = Math.max(first.width, first.height);
  const ref = long > WORK_EDGE
    ? await ImageManipulator.manipulate(uri)
      .resize(first.width >= first.height ? { width: WORK_EDGE } : { height: WORK_EDGE })
      .renderAsync()
    : first;
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export async function cropAndShrink(image: Picked, rect: Rect): Promise<{ uri: string; base64: string }> {
  const x = Math.max(0, Math.min(Math.round(rect.x), image.width - 1));
  const y = Math.max(0, Math.min(Math.round(rect.y), image.height - 1));
  const width = Math.max(1, Math.min(Math.round(rect.width), image.width - x));
  const height = Math.max(1, Math.min(Math.round(rect.height), image.height - y));
  let ctx = ImageManipulator.manipulate(image.uri).crop({ originX: x, originY: y, width, height });
  if (Math.max(width, height) > MAX_EDGE) ctx = ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { uri: out.uri, base64: out.base64 ?? "" };
}
