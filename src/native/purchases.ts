import type { CheckoutItem } from "../../shared/api-types";

// Stub until WP10 (mobile): RevenueCat.

export async function configure(_userId: string): Promise<void> {}
export async function logOut(): Promise<void> {}
export async function offerings(): Promise<{ id: string; item: CheckoutItem; price: string }[]> { return []; }
export async function purchase(_id: string): Promise<"ok" | "cancelled" | "pending"> { return "cancelled"; }
export async function restore(): Promise<void> {}
export async function managementUrl(): Promise<string | null> { return null; }
