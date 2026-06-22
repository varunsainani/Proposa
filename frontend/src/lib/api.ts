import { ApiError } from "./types";

// Same-origin: the Next.js rewrite proxies /api/* to the Node backend.
const BASE = "/api";

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken() {
  return accessToken;
}

function currentLocale(): string {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "en";
}

interface RequestOpts {
  auth?: boolean;
  retry?: boolean;
  raw?: boolean; // return the Response (for blobs like PDF)
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "X-Locale": currentLocale() },
        });
        if (!res.ok) return false;
        const data = await res.json();
        accessToken = data.accessToken ?? null;
        return !!accessToken;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  const { auth = true, retry = true, raw = false } = opts;
  const headers: Record<string, string> = { "X-Locale": currentLocale() };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Network error");
  }

  if (res.status === 401 && auth && retry) {
    const ok = await tryRefresh();
    if (ok) return request<T>(method, path, body, { ...opts, retry: false });
  }

  if (raw) {
    if (!res.ok) throw new ApiError(res.status, "INTERNAL", res.statusText);
    return res as unknown as T;
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "INTERNAL",
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOpts) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("POST", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("PATCH", path, body, opts),
  del: <T>(path: string, opts?: RequestOpts) => request<T>("DELETE", path, undefined, opts),
  refresh: tryRefresh,
};
