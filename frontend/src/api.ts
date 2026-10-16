// API client. Every request carries the login token; a 401 logs the user out.
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(t: string | null) {
  token = t;
}

export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("No internet. Check the connection and try again.", 0);
  }
  if (!res.ok) {
    let msg = `Something went wrong (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") msg = data.detail;
      else if (Array.isArray(data?.detail)) msg = data.detail[0]?.msg ?? msg;
    } catch {}
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(msg, res.status);
  }
  return res.json();
}

export const apiGet = (path: string) => request("GET", path);
export const apiPost = (path: string, body: unknown = {}) => request("POST", path, body);
export const apiPut = (path: string, body: unknown = {}) => request("PUT", path, body);
export const apiPatch = (path: string, body: unknown = {}) => request("PATCH", path, body);
export const apiDelete = (path: string) => request("DELETE", path);

// Upload a photo (base64 from useImageCapture); returns its storage path.
// JSON, not multipart: Expo's fetch rejects React Native's {uri,name,type} FormData parts.
export async function uploadImage(base64: string): Promise<string> {
  const data = await apiPost("/upload-base64", { image_base64: base64 });
  return data.path;
}

export function fileUrl(path?: string | null): string | undefined {
  return path ? `${API}/files/${path}` : undefined;
}

export async function fetchText(path: string): Promise<string> {
  const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(`Something went wrong (${res.status})`, res.status);
  return res.text();
}
