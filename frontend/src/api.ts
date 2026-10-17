// API client. Every request carries the login token; a 401 logs the user out.
// Server messages are shown in the app's language: `key` + `params` when the server sends them
// (messages with numbers or names), else the English `detail` is itself the translation key.
import i18n from "i18next";

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
  constructor(message: string, public status: number, public code = "", public params: Record<string, unknown> = {}) {
    super(message);
  }
}

const failed = (status: number) => i18n.t("Something went wrong. Please try again. (Error {{status}})", { status });

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  const sent = token; // a reply to a request sent before the saved login came back must not log out
  if (sent) headers.Authorization = `Bearer ${sent}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(i18n.t("No internet connection. Please check your connection and try again."), 0);
  }
  if (!res.ok) {
    let msg = failed(res.status);
    let code = "";
    let params: Record<string, unknown> = {};
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") {
        code = data.code ?? "";
        params = data.params ?? {};
        msg = i18n.t(data.key ?? data.detail, params);
      } else if (Array.isArray(data?.detail)) {
        msg = i18n.t("Please check the details and try again.");
      }
    } catch {}
    if (res.status === 401 && sent && sent === token && onUnauthorized) onUnauthorized();
    throw new ApiError(msg, res.status, code, params);
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
  if (!res.ok) throw new ApiError(failed(res.status), res.status);
  return res.text();
}
