import { afterEach, expect, test, vi } from "vitest";
import type { Credits, LedgerRow } from "../../shared/api-types";
import { COSTS } from "../../shared/pricing";
import { call } from "../api";
import { costOf, lines, signed } from "./format";
import { closeTopUp, getTopUp, openTopUp } from "./topup";

const credits = { plan: 0, topup: 40, total: 40, planExpiresAt: null, freeCourses: 1, subscription: null, costs: { ...COSTS }, confirmAt: 100, lowAt: 100 } satisfies Credits;

test("cost button label: cost, Free, plain when billing is off; confirm at confirmAt", () => {
  expect(costOf(credits, "grade")).toEqual({ text: "2", cost: 2, confirm: false });
  expect(costOf(credits, "course_files")).toEqual({ text: "150", cost: 150, confirm: true });
  expect(costOf(credits, "course_topic", true)).toEqual({ text: "Free", cost: 0, confirm: false });
  expect(costOf(null, "course_web")).toEqual({ text: null, cost: 0, confirm: false });
});

const row = (id: string, kind: LedgerRow["kind"], delta: number, action: LedgerRow["action"] = null, at = "2026-11-21T10:00:00.000Z", label: string | null = null): LedgerRow =>
  ({ id, kind, delta, action, ref: null, label, createdAt: at });

test("ledger lines: labels per kind, same-day grades grouped, signs", () => {
  const ls = lines([
    row("1", "spend", -150, "course_files", "2026-11-22T10:00:00.000Z", "Rust ownership"),
    row("2", "refund", 150, "course_files", "2026-11-22T09:00:00.000Z"),
    row("3", "spend", -2, "grade"), row("4", "spend", -2, "grade"), row("5", "spend", -2, "grade"),
    row("6", "spend", -3, "improve"),
    row("7", "spend", -2, "grade", "2026-11-20T10:00:00.000Z"),
    row("8", "free_course", 0, "course_topic"),
    row("9", "plan_grant", 1000), row("10", "plan_expire", -140), row("11", "pack", 500), row("12", "store_refund", -500),
    row("13", "spend", -20, "mock", undefined, "HTTP basics"), row("14", "spend", -10, "narration", undefined, "Status codes"),
  ]);
  expect(ls.map((l) => [l.label, signed(l)])).toEqual([
    ["Course: Rust ownership", "−150"], ["Refund: build failed", "+150"], ["Grade × 3", "−6"], ["Stronger answer", "−3"], ["Grade", "−2"],
    ["Course build", "Free"], ["Monthly credits", "+1,000"], ["Plan reset", "−140"], ["Top-up", "+500"], ["Purchase reversed", "−500"],
    ["Mock exam: HTTP basics", "−20"], ["Narration: Status codes", "−10"],
  ]);
});

afterEach(() => { vi.unstubAllGlobals(); closeTopUp(); });

test("a 402 opens the top-up sheet once with cost and balance, then throws", async () => {
  const body = { error: "Not enough credits", code: "insufficient_credits", cost: 150, balance: 40 };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 402, headers: { "content-type": "application/json" } })));
  await expect(call("/builder/jobs", { method: "POST" })).rejects.toMatchObject({ status: 402 });
  expect(getTopUp()).toEqual({ open: true, cost: 150, balance: 40 });
  await expect(call("/grade", { method: "POST" })).rejects.toMatchObject({ status: 402 });
  openTopUp({ cost: 2, balance: 0 });
  expect(getTopUp()).toEqual({ open: true, cost: 150, balance: 40 }); // first opener wins until closed
});
