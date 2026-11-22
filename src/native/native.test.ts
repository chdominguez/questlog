import { beforeEach, expect, test, vi } from "vitest";

const rc = vi.hoisted(() => ({
  configure: vi.fn(async () => {}), logIn: vi.fn(async () => ({})), logOut: vi.fn(async () => ({})),
  getOfferings: vi.fn(), purchasePackage: vi.fn(), restorePurchases: vi.fn(), getCustomerInfo: vi.fn(),
}));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: rc,
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: "1", PAYMENT_PENDING_ERROR: "20" },
}));
vi.mock("../platform", () => ({ platform: "android", isNative: true }));

import { linkTarget, pushHash } from "./links";
import { configure, itemOf, offerings, purchase } from "./purchases";

beforeEach(() => { vi.stubEnv("VITE_REVENUECAT_ANDROID_KEY", "goog_key"); });

test("appUrlOpen routing: magic link token, /c/<id>, everything else ignored", () => {
  expect(linkTarget("https://app.questie.app/api/auth/magic-link/verify?token=abc&callbackURL=%2F")).toEqual({ token: "abc" });
  expect(linkTarget("https://app.questie.app/api/auth/magic-link/verify")).toBeNull();
  expect(linkTarget("https://app.questie.app/c/u123-git/")).toEqual({ hash: "#/c/u123-git" });
  expect(linkTarget("https://app.questie.app/#/reset?token=x")).toBeNull();
  expect(linkTarget("not a url")).toBeNull();
  expect(pushHash("/#/c/git")).toBe("#/c/git");
  expect(pushHash(undefined)).toBeNull();
});

test("store products map to checkout items", () => {
  expect(itemOf("questie.plan.monthly")).toBe("plan");
  expect(itemOf("questie.plan.monthly:monthly")).toBe("plan");
  expect(itemOf("questie.credits.500")).toBe("pack_s");
  expect(itemOf("questie.credits.1500")).toBe("pack_l");
  expect(itemOf("other")).toBeNull();
});

test("offerings need a configured store, keep known products, and purchase maps store outcomes", async () => {
  await expect(offerings()).rejects.toThrow();
  await configure("user-1");
  await configure("user-2");
  expect(rc.configure).toHaveBeenCalledWith({ apiKey: "goog_key", appUserID: "user-1" });
  expect(rc.logIn).toHaveBeenCalledWith({ appUserID: "user-2" });

  const pkg = (identifier: string, product: string, priceString: string) => ({ identifier, product: { identifier: product, priceString } });
  rc.getOfferings.mockResolvedValue({ current: { availablePackages: [
    pkg("$rc_monthly", "questie.plan.monthly:monthly", "€11.99"),
    pkg("credits_500", "questie.credits.500", "€5.99"),
    pkg("old", "questie.legacy", "€1.00"),
  ] } });
  expect(await offerings()).toEqual([
    { id: "$rc_monthly", item: "plan", price: "€11.99" },
    { id: "credits_500", item: "pack_s", price: "€5.99" },
  ]);

  rc.purchasePackage.mockResolvedValueOnce({});
  expect(await purchase("credits_500")).toBe("ok");
  expect(rc.purchasePackage).toHaveBeenCalledWith({ aPackage: pkg("credits_500", "questie.credits.500", "€5.99") });
  rc.purchasePackage.mockRejectedValueOnce({ code: "1" });
  expect(await purchase("credits_500")).toBe("cancelled");
  rc.purchasePackage.mockRejectedValueOnce({ code: "20" });
  expect(await purchase("$rc_monthly")).toBe("pending");
  rc.purchasePackage.mockRejectedValueOnce({ code: "2" });
  await expect(purchase("$rc_monthly")).rejects.toEqual({ code: "2" });
  await expect(purchase("old")).rejects.toThrow();
});
