import { COSTS, PACKS, PLAN } from "../../../shared/pricing.ts";

/** Prices and credit counts as the site shows them, from the one pricing config. */
export const eur = (cents: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
export const num = (n: number) => n.toLocaleString("en-US");

export const plan = { price: eur(PLAN.priceCents), credits: num(PLAN.credits) };
export const packs = Object.values(PACKS).map((p) => ({ price: eur(p.priceCents), credits: num(p.credits) }));

/** What each AI action costs and how many the plan's monthly credits buy. */
export const costs = ([
  ["Course from a topic", COSTS.course_topic, "/ai/topic/"],
  ["Course from files, notes, a URL or a repo", COSTS.course_files, "/ai/files/"],
  ["Course from web research, with citations", COSTS.course_web, "/ai/research/"],
  ["Grade a written answer", COSTS.grade, "/learn/written/"],
  ["Stronger answer and corrections", COSTS.improve, "/learn/written/"],
  ["Mock exam session", COSTS.mock, "/learn/mock/"],
  ["Narrated lesson, once per lesson and voice", COSTS.narration, "/learn/narration/"],
] as const).map(([action, credits, href]) => ({ action, credits, href, perMonth: num(Math.floor(PLAN.credits / credits)) }));
