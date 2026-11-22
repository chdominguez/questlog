import type { MiddlewareHandler } from "hono";
import type { App } from "./api";
import { err } from "./errors";

// One process (OPS-6), so an in-memory fixed window per user is exact.
const windows = new Map<string, { start: number; count: number }>();

/** At most `max` requests per user per `windowSec` for this limit name; 429 rate_limited with Retry-After beyond. */
export function limit(name: string, max: number, windowSec: number): MiddlewareHandler<App> {
  return async (c, next) => {
    const key = `${name}\n${c.get("user")}`;
    const now = Date.now();
    let w = windows.get(key);
    if (!w || now - w.start >= windowSec * 1000) windows.set(key, (w = { start: now, count: 0 }));
    if (++w.count > max) {
      const retryAfter = Math.max(1, Math.ceil((w.start + windowSec * 1000 - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return err(c, 429, "rate_limited", { retryAfter });
    }
    await next();
  };
}
