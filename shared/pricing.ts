/** Every tunable price and limit; imported by the server, the app and the site. No secrets. */
export const CURRENCY = "eur";
export const PLAN = { credits: 1000, priceCents: 1199, lookupKey: "questie_plan_monthly_1199", rcProducts: ["questie.plan.monthly", "questie.plan.monthly:monthly"] } as const;
export const PACKS = {
  pack_s: { credits: 500, priceCents: 599, lookupKey: "questie_pack_500_599", rcProducts: ["questie.credits.500"] },
  pack_l: { credits: 1500, priceCents: 1499, lookupKey: "questie_pack_1500_1499", rcProducts: ["questie.credits.1500"] },
} as const;
export const COSTS = { course_topic: 100, course_files: 150, course_web: 200, grade: 2, improve: 3, mock: 20, narration: 10 } as const;
export const FREE_COURSES = 1; // topic mode only
export const CONFIRM_AT = 100; // client confirms spends >= this
export const LOW_BALANCE = 100; // one warning per period
export const PLAN_GRACE_DAYS = 1; // plan credits live until period end + grace
export const BUILD = {
  uploadMaxFiles: 10, uploadMaxBytes: 20 * 1024 * 1024, textMaxBytes: 500 * 1024, urlsMax: 3,
  topicMin: 3, topicMax: 200, instructionsMax: 2000,
  webMaxSearches: 8, fetchMaxUses: 10, minSources: 3, fixAttempts: 3, writeConcurrency: 3,
} as const;
