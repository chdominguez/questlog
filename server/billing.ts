import type { Deps } from "./api";
import type { Db } from "./db";
import type { Env } from "./env";

// Stub until WP4 (credits).

/** Cancels the user's Stripe plan now (account deletion). */
export async function cancelForUser(_db: Db, _env: Env, _deps: Deps, _user: string): Promise<void> {}
