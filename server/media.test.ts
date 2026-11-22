import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { Hono } from "hono";
import { createMedia, CSP, cspHeader } from "./media";

const dir = mkdtempSync(join(tmpdir(), "questie-media-"));
mkdirSync(join(dir, "c"));
writeFileSync(join(dir, "c", "a.mp4"), "0123456789");
writeFileSync(join(dir, "c", "x.txt"), "no");
writeFileSync(join(dir, "secret.png"), "s");
const get = (path: string, headers?: Record<string, string>) => createMedia(() => dir).request(path, { headers });

test("serves with content type, nosniff and validators", async () => {
  const r = await get("/media/c/a.mp4");
  expect(r.status).toBe(200);
  expect(r.headers.get("Content-Type")).toBe("video/mp4");
  expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(r.headers.get("Accept-Ranges")).toBe("bytes");
  expect(await r.text()).toBe("0123456789");
  const etag = r.headers.get("ETag")!;
  expect(etag).toBeTruthy();
  expect(r.headers.get("Last-Modified")).toBeTruthy();
  expect((await get("/media/c/a.mp4", { "If-None-Match": etag })).status).toBe(304);
});

test("range requests: 206 slices, suffix, 416", async () => {
  const r = await get("/media/c/a.mp4", { Range: "bytes=2-5" });
  expect(r.status).toBe(206);
  expect(r.headers.get("Content-Range")).toBe("bytes 2-5/10");
  expect(await r.text()).toBe("2345");
  expect(await (await get("/media/c/a.mp4", { Range: "bytes=7-" })).text()).toBe("789");
  expect(await (await get("/media/c/a.mp4", { Range: "bytes=-3" })).text()).toBe("789");
  const bad = await get("/media/c/a.mp4", { Range: "bytes=20-30" });
  expect(bad.status).toBe(416);
  expect(bad.headers.get("Content-Range")).toBe("bytes */10");
  expect((await get("/media/c/a.mp4", { Range: "nope" })).status).toBe(416);
});

test("404 for missing, disallowed extension and traversal", async () => {
  for (const p of ["/media/c/missing.mp4", "/media/c/x.txt", "/media/nope/a.mp4", "/media/c/..%2F..%2Fsecret.png", "/media/..%2Fc/a.mp4", "/media/c/%2e%2e", "/media/c/.hidden.png"]) {
    expect((await get(p)).status, p).toBe(404);
  }
});

test("cspHeader: HTML pages get the CSP, other responses do not", async () => {
  const app = new Hono().use(cspHeader).get("/", (c) => c.html("<p>x</p>")).get("/a.js", (c) => c.body("x", 200, { "Content-Type": "text/javascript" }));
  expect((await app.request("/")).headers.get("content-security-policy")).toBe(CSP);
  expect((await app.request("/a.js")).headers.get("content-security-policy")).toBeNull();
});
