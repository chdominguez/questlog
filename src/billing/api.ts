import type { CheckoutItem, FulfillResult, LedgerPage } from "../../shared/api-types";
import { call } from "../api";

const post = (body: unknown = {}): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const getLedger = (before?: string | null) => call<LedgerPage>(`/credits/ledger${before ? `?before=${encodeURIComponent(before)}` : ""}`);
export const fulfill = (sessionId: string) => call<FulfillResult>("/billing/fulfill", post({ sessionId }));
export const portal = () => call<{ url: string }>("/billing/portal", post());

const CHECKOUT = "ql.checkout";

/** Starts Stripe Checkout; the current screen is saved so BillingDone can return to it. */
export async function checkout(item: CheckoutItem) {
  const { url } = await call<{ url: string }>("/billing/checkout", post({ item }));
  try { sessionStorage.setItem(CHECKOUT, JSON.stringify({ returnTo: location.hash || "#/" })); } catch { /* storage off */ }
  location.href = url;
}

/** Where to go after checkout; read once. */
export function checkoutReturn(): string {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHECKOUT) ?? "null") as { returnTo?: string } | null;
    sessionStorage.removeItem(CHECKOUT);
    return v?.returnTo && !v.returnTo.startsWith("#/billing") ? v.returnTo : "#/";
  } catch { return "#/"; }
}
