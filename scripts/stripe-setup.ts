// Creates the Stripe products and prices from shared/pricing.ts. Safe to re-run: prices found by lookup key are skipped.
// Usage: STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup (once per Stripe account, test and live).
import Stripe from "stripe";
import { CURRENCY, PACKS, PLAN } from "../shared/pricing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY");
  process.exit(1);
}
const stripe = new Stripe(key);

const items = [
  { name: "Questie", credits: PLAN.credits, cents: PLAN.priceCents, lookupKey: PLAN.lookupKey, monthly: true },
  ...Object.values(PACKS).map((p) => ({ name: `${p.credits.toLocaleString("en")} credits`, credits: p.credits, cents: p.priceCents, lookupKey: p.lookupKey, monthly: false })),
];

for (const it of items) {
  const { data } = await stripe.prices.list({ lookup_keys: [it.lookupKey], limit: 1 });
  if (data[0]) {
    console.log(`${it.lookupKey}: exists (${data[0].id})`);
    continue;
  }
  const price = await stripe.prices.create({
    currency: CURRENCY, unit_amount: it.cents, tax_behavior: "inclusive", lookup_key: it.lookupKey,
    ...(it.monthly && { recurring: { interval: "month" as const } }),
    product_data: { name: it.name, tax_code: "txcd_10000000", metadata: { credits: String(it.credits) } },
  }, { idempotencyKey: `setup-${it.lookupKey}` });
  console.log(`${it.lookupKey}: created (${price.id})`);
}
