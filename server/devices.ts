import { Hono, type Context } from "hono";
import type { DeviceInput } from "../shared/api-types";
import { str, type App, type Deps } from "./api";
import { err } from "./errors";

const body = async (c: Context<App>) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

/** POST /push/device registers a native FCM token for the caller (a token moves to whoever registers it last); DELETE removes the caller's own token. */
export function devicesRoutes(deps: Deps): Hono<App> {
  return new Hono<App>()
    .post("/push/device", async (c) => {
      const b = await body(c);
      if (!str(b.token, 4096, 1) || (b.platform !== "ios" && b.platform !== "android")) return err(c, 400, "invalid_request", {}, "Invalid device");
      const d = b as unknown as DeviceInput;
      await c.env.DB.prepare(
        `INSERT INTO device_tokens (token, user_id, platform, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`,
      ).bind(d.token, c.get("user"), d.platform, deps.now().toISOString()).run();
      return c.body(null, 204);
    })
    .delete("/push/device", async (c) => {
      const b = await body(c);
      if (!str(b.token, 4096, 1)) return err(c, 400, "invalid_request", {}, "Invalid token");
      await c.env.DB.prepare("DELETE FROM device_tokens WHERE token = ? AND user_id = ?").bind(b.token, c.get("user")).run();
      return c.body(null, 204);
    });
}
