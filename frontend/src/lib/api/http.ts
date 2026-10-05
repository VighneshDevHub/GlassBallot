export interface Envelope<T> {
  data: T;
  request_id?: string;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: string;
}

type FetchOptions = Omit<RequestInit, "headers" | "body"> & {
  headers?: Record<string, string>;
  body?: any;
};

const API_BASE = "/api";

export async function http<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`;

  const headers: Record<string, string> = {
    "X-Requested-With": "glassballot",
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body !== "string" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
    body:
      options.body && !(options.body instanceof FormData) && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });

  let data: unknown = {};
  try {
    data = await resp.json();
  } catch {
    /* non-JSON error page */
  }

  if (!resp.ok) {
    const err = (data as ErrorResponse)?.error || `Request failed (${resp.status})`;
    throw new Error(err);
  }

  const env = data as Envelope<T>;
  if (env && typeof env === "object" && "data" in env) {
    return env.data as T;
  }
  return data as T;
}

export function httpGet<T>(path: string, params?: Record<string, string | number | undefined>) {
  let url = path;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url = `${path}${path.includes("?") ? "&" : "?"}${s}`;
  }
  return http<T>(url, { method: "GET" });
}

export function httpPost<T>(path: string, body?: unknown) {
  return http<T>(path, { method: "POST", body });
}

export function httpPut<T>(path: string, body?: unknown) {
  return http<T>(path, { method: "PUT", body });
}

export function httpPatch<T>(path: string, body?: unknown) {
  return http<T>(path, { method: "PATCH", body });
}

export function httpDelete<T>(path: string) {
  return http<T>(path, { method: "DELETE" });
}
