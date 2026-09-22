import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;

async function handle(res: Response) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`);
  return handle(res);
}

export async function apiPost(path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiPut(path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  return handle(res);
}

// Upload an image (from a local uri) as multipart. Works on native + web.
export async function uploadImage(uri: string): Promise<string> {
  const name = `photo-${Date.now()}.jpg`;
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type: "image/jpeg" } as any);
  }
  const res = await fetch(`${API}/upload`, { method: "POST", body: form });
  const data = await handle(res);
  return data.path;
}

export function fileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return `${API}/files/${path}`;
}
