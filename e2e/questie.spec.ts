import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readdirSync } from "node:fs";

// The product flow end to end, in order, against server/e2e.ts. Screenshots land in e2e/screenshots.
test.describe.configure({ mode: "serial" });

const USER = { name: "Ada", email: "ada@e2e.test", password: "correct-horse-1" };
const ADMIN = { name: "Admin", email: "admin@e2e.test", password: "correct-horse-2" };
// A one-page PDF; the builder sends it to the (fake) Files API, so only the magic bytes matter.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

let page: Page;
let shot = 0;
const snap = (p: Page, name: string) => p.screenshot({ path: `e2e/screenshots/${String(++shot).padStart(2, "0")}-${name}.png`, fullPage: true, animations: "disabled" });

/** The link in the last mail sent to this address (Resend fake). */
async function mailLink(request: APIRequestContext, to: string) {
  const res = await request.get(`/__e2e/mail?to=${encodeURIComponent(to)}`);
  expect(res.ok()).toBe(true);
  return /https?:\/\/\S+/.exec((await res.json()).text)![0];
}

const balance = (p = page) => p.evaluate(async () => ((await (await fetch("/api/credits")).json()) as { total: number }).total);

async function signUp(p: Page, request: APIRequestContext, u: typeof USER, shots = false) {
  await p.goto("/#/signup");
  await p.getByLabel("Name").fill(u.name);
  await p.getByLabel("Email").fill(u.email);
  await p.getByLabel("Password", { exact: true }).fill(u.password);
  if (shots) await snap(p, "signup");
  await p.getByRole("button", { name: "Create account" }).click();
  await expect(p).toHaveURL(/#\/verify/);
  if (shots) await snap(p, "verify");
  await p.goto(await mailLink(request, u.email));
  await expect(p).toHaveURL(/#\/welcome/);
}

/** Map -> level -> theory -> challenges -> result. Quiz answers are the first option in the fixture course. */
async function playBasics(courseTitle: string) {
  await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible();
  await page.getByRole("link", { name: /Basics/ }).click();
  await page.getByRole("button", { name: "Theory" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Start challenges" }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Reveal" }).click();
  await page.getByRole("button", { name: "Good" }).click();
  await page.getByRole("button", { name: "See result" }).click();
  await expect(page.getByRole("heading", { name: "Level cleared" })).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test("sign up, verify email, welcome", async ({ request }) => {
  await signUp(page, request, USER, true);
  await expect(page.getByRole("heading", { name: "What do you want to learn?" })).toBeVisible();
  await snap(page, "welcome");
});

test("course code can't read the session token", async () => {
  // A JSON import carries the session cookie; the API refuses it, other JSON on this origin loads.
  const load = (p: string) => page.evaluate((p) => import(p, { with: { type: "json" } }).then(() => "loaded", () => "blocked"), p);
  expect(await load("/api/auth/get-session")).toBe("blocked");
  expect(await load("/api/auth/list-sessions")).toBe("blocked");
  expect(await load("/.well-known/assetlinks.json")).toBe("loaded");
  // The kata worker's own CSP stops imports to this origin; a kata still runs.
  const worker = `/assets/${readdirSync("dist/assets").find((f) => f.startsWith("runner.worker-"))}`;
  const got = await page.evaluate((url) => new Promise<unknown[]>((done) => {
    const w = new Worker(url), out: unknown[] = [];
    const code = `import("/.well-known/assetlinks.json", { with: { type: "json" } }).then(() => postMessage("loaded"), () => postMessage("blocked")); return eq(1, 1);`;
    w.onmessage = (e) => {
      if (e.data === "ready") return w.postMessage({ source: "", tests: [{ name: "t", code }] });
      out.push(e.data);
      if (typeof e.data === "string") { w.terminate(); done(out); }
    };
  }), worker);
  expect(got).toEqual([[expect.objectContaining({ pass: true })], "blocked"]);
});

test("free AI course from a topic", async () => {
  await page.getByLabel("Topic").fill("Lists in TypeScript");
  await expect(page.getByRole("button", { name: /Build course Free/ })).toBeVisible();
  await page.getByRole("button", { name: /Build course/ }).click();
  await expect(page).toHaveURL(/#\/build\//);
  await expect(page.getByRole("heading", { name: "Course ready" })).toBeVisible({ timeout: 30_000 });
  await snap(page, "free-course-ready");
  expect(await balance()).toBe(0);
});

test("play a level", async () => {
  await page.getByRole("link", { name: "Start" }).click();
  await playBasics("Lists in practice");
  await snap(page, "level-cleared");
});

test("subscribe with Stripe test checkout; plan credits granted", async () => {
  await page.goto("/#/plans");
  await snap(page, "plans");
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByRole("heading", { name: "Test checkout" })).toBeVisible();
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page).toHaveURL(/session_id=cs_test_.*#\/billing\/done/);
  await expect(page.getByRole("heading", { name: "Subscribed" })).toBeVisible({ timeout: 20_000 });
  await snap(page, "subscribed");
  expect(await balance()).toBe(1000);
});

test("build a course from an uploaded PDF (150 credits)", async () => {
  await page.goto("/#/build");
  await page.getByRole("tab", { name: "Files" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "lists.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByLabel("Uploaded")).toBeVisible();
  await snap(page, "build-files");
  await page.getByRole("button", { name: /Build course 150/ }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Spend 150 credits?")).toBeVisible();
  await confirm.getByRole("button", { name: "Build course" }).click();
  await expect(page.getByRole("heading", { name: "Course ready" })).toBeVisible({ timeout: 30_000 });
  await snap(page, "pdf-course-ready");
  expect(await balance()).toBe(850);
});

test("grade a written answer (2), then a stronger answer (3)", async () => {
  await page.getByRole("link", { name: "Start" }).click();
  await playBasics("Lists from your notes");
  await page.getByRole("button", { name: "Next level" }).click();
  await page.getByRole("button", { name: "Challenge" }).click();
  await page.getByRole("textbox").fill("It keeps order.");
  await page.getByRole("button", { name: /Grade 2/ }).click();
  await expect(page.getByRole("button", { name: /Stronger answer 3/ })).toBeVisible();
  await snap(page, "graded");
  expect(await balance()).toBe(848);
  await page.getByRole("button", { name: /Stronger answer 3/ }).click();
  await expect(page.getByText("can be read by position")).toBeVisible();
  await snap(page, "stronger-answer");
  expect(await balance()).toBe(845);
});

test("unlock narration (10)", async () => {
  await page.getByRole("link", { name: "Map" }).first().click();
  await page.getByRole("link", { name: /Basics/ }).click();
  await page.getByRole("button", { name: "Theory" }).click();
  await page.getByRole("button", { name: /Listen 10/ }).click();
  await expect(page.getByRole("slider", { name: "Position" })).toBeVisible({ timeout: 20_000 });
  await snap(page, "narration");
  expect(await balance()).toBe(835);
});

test("publish to the review queue; admin approves; course in Library", async ({ browser, request }) => {
  await page.getByRole("link", { name: "Map" }).first().click();
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Submit to library" }).click();
  await expect(page.getByText("Published under CC BY 4.0.")).toBeVisible();
  await snap(page, "publish-confirm");
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("dialog").getByText("In review")).toBeVisible();
  await snap(page, "in-review");
  await page.keyboard.press("Escape");

  const admin = await browser.newPage();
  await signUp(admin, request, ADMIN);
  await admin.goto("/#/admin/review");
  await expect(admin.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(admin.getByText("Lists from your notes")).toBeVisible();
  await snap(admin, "review-queue");
  const approved = admin.waitForResponse((r) => r.url().endsWith("/approve") && r.status() === 204, { timeout: 15_000 }); // sent after the 5 s undo window
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Approved")).toBeVisible();
  await approved;
  await expect(admin.getByText("Queue empty")).toBeVisible();

  await page.goto("/#/library");
  await expect(page.getByText("Lists from your notes")).toBeVisible();
  await snap(page, "library");

  // Admin takes credits away so the next build cannot be paid.
  const r = await admin.evaluate(async () => (await fetch("/api/admin/credits", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ email: "ada@e2e.test", amount: -800, note: "e2e" }),
  })).status);
  expect(r).toBe(200);
  await admin.close();
});

test("insufficient credits opens the top-up sheet", async () => {
  await page.goto("/#/build");
  await page.reload(); // fresh /me balance
  await page.getByRole("tab", { name: "Topic" }).click();
  await page.getByRole("textbox", { name: "Topic" }).fill("Maps in TypeScript");
  await page.getByRole("button", { name: /Build course 100/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Not enough credits" })).toBeVisible();
  await expect(sheet.getByText("Needs 100 · You have 35")).toBeVisible();
  await snap(page, "top-up");
  await sheet.getByRole("button", { name: "Close" }).click();
});

test("a missing screen chunk reloads once, then offers a retry", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: await page.context().storageState(), serviceWorkers: "block" }); // signed in, nothing cached
  const p = await ctx.newPage();
  const chunk = /\/assets\/CreditsScreen-[^/]+\.js$/;
  await p.route(chunk, (r) => r.abort());
  await p.goto("/#/");
  let loads = 0;
  p.on("load", () => loads++);
  await p.goto("/#/profile/credits");
  await expect(p.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(loads).toBe(1);
  await p.unroute(chunk);
  await p.getByRole("button", { name: "Retry" }).click();
  await expect(p.getByRole("heading", { name: "Credits" })).toBeVisible();
  await ctx.close();
});

test("delete account", async () => {
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Delete account" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Type your email").fill(USER.email);
  await snap(page, "delete-account");
  await d.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/#\/signin/);
  await snap(page, "deleted");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); // empty form: email error under Email
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(async () => (await fetch("/api/me")).status)).toBe(401);
});

test("a Questlog browser keeps its progress after the first sign-in", async ({ browser, request }) => {
  const legacy = { email: "old@e2e.test", name: "Old", password: "correct-horse-3" };
  const p = await browser.newPage();
  await p.goto("/#/signin");
  await p.evaluate((email) => {
    localStorage.setItem("questlog-v1", JSON.stringify({ xp: 230, levels: {}, streak: 0, cards: {}, cleared: [], completed: [], unlockAll: false, sound: { muted: false, volume: 0.7 }, best: {}, run: null, updatedAt: 1 }));
    localStorage.setItem("ql.user", email);
  }, legacy.email);
  await signUp(p, request, legacy);
  await p.goto("/#/");
  await expect(p.getByText("230 XP")).toBeVisible();
  await expect(p.getByText("Apprentice")).toBeVisible();
  await snap(p, "legacy-progress-kept");
  await p.close();
});
