import type { ApiErrorBody } from "../shared/api-types";
import { isNative, apiUrl } from "./platform";
import { getToken } from "./auth/token";
import { markSignedOut, setBalance } from "./auth/session";
import { openTopUp } from "./billing/topup";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Partial<ApiErrorBody> = {}) { super(message); }
}

/** Every client request to /api: bearer on native, balance header, 401 signs out (local progress stays). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const t = getToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(apiUrl(path), { ...init, headers, credentials: isNative ? "omit" : "same-origin" });
  const bal = res.headers.get("x-credits-balance");
  if (bal !== null && bal !== "") setBalance(Number(bal));
  if (res.status === 401) markSignedOut();
  return res;
}

/** JSON call; throws ApiError on a non-2xx. A 402 opens the top-up sheet first. */
export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
    if (res.status === 402) openTopUp({ cost: body.cost as number | undefined, balance: body.balance as number | undefined });
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Idempotency-Key for one user action; reuse it when retrying that action. */
export const newKey = () => crypto.randomUUID();
