import { Purchases, PURCHASES_ERROR_CODE, type PurchasesPackage } from "@revenuecat/purchases-capacitor";
import type { CheckoutItem } from "../../shared/api-types";
import { PACKS, PLAN } from "../../shared/pricing";
import { platform } from "../platform";

// RevenueCat. App User ID = Better Auth user id, so the webhook credits the right ledger.

const apiKey = (): string | undefined => platform === "ios" ? import.meta.env.VITE_REVENUECAT_IOS_KEY : import.meta.env.VITE_REVENUECAT_ANDROID_KEY;

/** Checkout item for a store product id (shared/pricing.ts rcProducts). */
export function itemOf(productId: string): CheckoutItem | null {
  if ((PLAN.rcProducts as readonly string[]).includes(productId)) return "plan";
  for (const [item, p] of Object.entries(PACKS)) if ((p.rcProducts as readonly string[]).includes(productId)) return item as CheckoutItem;
  return null;
}

let configured = false;
let packages = new Map<string, PurchasesPackage>();

/** On sign-in. The first call configures the SDK, later ones switch user. */
export async function configure(userId: string): Promise<void> {
  const key = apiKey();
  if (!key) return;
  if (configured) { await Purchases.logIn({ appUserID: userId }); return; }
  await Purchases.configure({ apiKey: key, appUserID: userId });
  configured = true;
}

/** On sign-out. */
export async function logOut(): Promise<void> {
  if (configured) await Purchases.logOut().catch(() => {}); // throws when already anonymous
}

/** Current offering's packages we sell, with store price strings. Throws when the store is not available. */
export async function offerings(): Promise<{ id: string; item: CheckoutItem; price: string }[]> {
  if (!configured) throw new Error("Store unavailable");
  const { current } = await Purchases.getOfferings();
  packages = new Map();
  const out: { id: string; item: CheckoutItem; price: string }[] = [];
  for (const p of current?.availablePackages ?? []) {
    const item = itemOf(p.product.identifier);
    if (!item) continue;
    packages.set(p.identifier, p);
    out.push({ id: p.identifier, item, price: p.product.priceString });
  }
  return out;
}

/** Buys a package from the last offerings() call. Store errors other than cancel and pending throw. */
export async function purchase(id: string): Promise<"ok" | "cancelled" | "pending"> {
  const aPackage = packages.get(id);
  if (!aPackage) throw new Error(`Unknown package ${id}`);
  try {
    await Purchases.purchasePackage({ aPackage });
    return "ok";
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "cancelled";
    if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return "pending";
    throw e;
  }
}

/** True when the store had purchases to restore. */
export async function restore(): Promise<boolean> {
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo.allPurchasedProductIdentifiers.length > 0;
}

/** Store subscription page for a store subscriber, else null. */
export async function managementUrl(): Promise<string | null> {
  if (!configured) return null;
  return (await Purchases.getCustomerInfo()).customerInfo.managementURL;
}
