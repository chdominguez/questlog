import type { Action, Credits, LedgerRow } from "../../shared/api-types";

/** An active or past-due plan on any provider. */
export const live = (c: Credits) => c.subscription?.status === "active" || c.subscription?.status === "past_due";

export const num = (n: number) => n.toLocaleString("en");
export const price = (cents: number) => `€${(cents / 100).toFixed(2)}`;
export const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
export const month = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** What a cost button shows after its label: the cost, "Free", or nothing when billing is off. */
export function costOf(c: Credits | null | undefined, action: Action, free?: boolean): { text: string | null; cost: number; confirm: boolean } {
  if (!c) return { text: null, cost: 0, confirm: false };
  if (free) return { text: "Free", cost: 0, confirm: false };
  const cost = c.costs[action];
  return { text: String(cost), cost, confirm: cost >= c.confirmAt };
}

const COURSE = new Set<Action | null>(["course_topic", "course_files", "course_web"]);
const REFUND: Record<Action, string> = {
  course_topic: "Refund: build failed", course_files: "Refund: build failed", course_web: "Refund: build failed",
  grade: "Refund: grading failed", improve: "Refund: grading failed", narration: "Refund: audio failed", mock: "Refund: mock exam failed",
};

function labelOf(r: LedgerRow): string {
  switch (r.kind) {
    case "plan_grant": return "Monthly credits";
    case "plan_expire": return "Plan reset";
    case "pack": return "Top-up";
    case "store_refund": case "stripe_refund": return "Purchase reversed";
    case "free_refund": return "Free course restored";
    case "refund": return r.action ? REFUND[r.action] : "Refund";
    case "adjust": return "Adjustment";
  }
  if (COURSE.has(r.action)) return r.label ? `Course: ${r.label}` : "Course build";
  if (r.action === "grade") return "Grade";
  if (r.action === "improve") return "Stronger answer";
  if (r.action === "mock") return r.label ? `Mock exam: ${r.label}` : "Mock exam";
  return r.label ? `Narration: ${r.label}` : "Narration";
}

export interface Line { key: string; at: string; label: string; delta: number; free: boolean }

/** Ledger rows as display lines; same-day grade and stronger-answer spends collapse into "Grade × 6". */
export function lines(rows: LedgerRow[]): Line[] {
  const out: (Line & { group?: string; n: number })[] = [];
  for (const r of rows) {
    const group = r.kind === "spend" && (r.action === "grade" || r.action === "improve") ? `${r.action}:${r.createdAt.slice(0, 10)}` : undefined;
    const prev = out[out.length - 1];
    if (group && prev?.group === group) {
      prev.n++;
      prev.delta += r.delta;
      prev.label = `${labelOf(r)} × ${prev.n}`;
      continue;
    }
    out.push({ key: r.id, at: r.createdAt, label: labelOf(r), delta: r.delta, free: r.kind === "free_course", group, n: 1 });
  }
  return out.map(({ key, at, label, delta, free }) => ({ key, at, label, delta, free }));
}

/** "+500", "−150" (minus sign), "Free". */
export const signed = (l: Pick<Line, "delta" | "free">) => (l.free ? "Free" : l.delta > 0 ? `+${num(l.delta)}` : l.delta < 0 ? `−${num(-l.delta)}` : "0");
