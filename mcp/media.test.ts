import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { listMedia, uploadMedia } from "./courses";

const root = () => mkdtempSync(join(tmpdir(), "questie-mcpmedia-"));

test("uploads, lists, and refuses overwrite unless asked", () => {
  const r = root();
  expect(uploadMedia(r, "c", "a.png", Buffer.from("1"), false)).toEqual({ ref: "media/a.png", bytes: 1 });
  expect(readFileSync(join(r, "c", "a.png"), "utf8")).toBe("1");
  expect(uploadMedia(r, "c", "a.png", Buffer.from("2"), false)).toEqual({ error: expect.stringContaining("overwrite: true") });
  expect(uploadMedia(r, "c", "a.png", Buffer.from("22"), true)).toEqual({ ref: "media/a.png", bytes: 2 });
  uploadMedia(r, "c", "b.mp3", Buffer.from("x"), false);
  expect(listMedia(r, "c")).toEqual([{ ref: "media/a.png", bytes: 2 }, { ref: "media/b.mp3", bytes: 1 }]);
  expect(listMedia(r, "none")).toEqual([]);
});

test("rejects bad names, extensions, course ids, empty and oversize files", () => {
  const r = root();
  for (const f of ["../a.png", "a/b.png", "a.exe", "a.svg", ".a.png", "a"]) expect(uploadMedia(r, "c", f, Buffer.from("1"), false), f).toHaveProperty("error");
  expect(uploadMedia(r, "../c", "a.png", Buffer.from("1"), false)).toHaveProperty("error");
  expect(uploadMedia(r, "c", "a.png", Buffer.alloc(0), false)).toHaveProperty("error");
  process.env.MEDIA_MAX_BYTES = "3";
  try { expect(uploadMedia(r, "c", "a.png", Buffer.alloc(4), false)).toEqual({ error: expect.stringContaining("limit") }); } finally { delete process.env.MEDIA_MAX_BYTES; }
});
