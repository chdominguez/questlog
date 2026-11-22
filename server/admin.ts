import type { MiddlewareHandler } from "hono";
import type { App, SessionUser } from "./api";
import type { Env } from "./env";
import { err } from "./errors";

export const isAdmin = (u: SessionUser, env: Env): boolean => u.emailVerified && env.ADMIN_EMAILS.includes(u.email.toLowerCase());

export const requireAdmin: MiddlewareHandler<App> = async (c, next) => {
  if (!isAdmin(c.get("account"), c.env)) return err(c, 403, "forbidden");
  await next();
};
