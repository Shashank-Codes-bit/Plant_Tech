const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? "";
const AUTH = { "X-App-Key": APP_KEY };

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
  const res = await fetch(`${API}${path}`, { headers: AUTH });
  return handle(res);
}

export async function apiPost(path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiPut(path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiDelete(path: string) {
  const res = await fetch(`${API}${path}`, { method: "DELETE", headers: AUTH });
  return handle(res);
}

// Upload a photo (base64 from useImageCapture) and return its storage path.
// JSON, not multipart: Expo's fetch rejects React Native's {uri, name, type} FormData parts,
// so multipart uploads never left the phone on Android.
export async function uploadImage(base64: string): Promise<string> {
  const data = await apiPost("/upload-base64", { image_base64: base64 });
  return data.path;
}

export function fileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return `${API}/files/${path}`;
}
