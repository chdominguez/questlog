import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";
import { API_BASE, isNative } from "../platform";
import { getToken, setToken } from "./token";

// Better Auth client for sign-in, sign-up, sign-out and tokens only; the account itself comes from GET /api/me.
export const authClient = createAuthClient({
  baseURL: `${API_BASE || location.origin}/api/auth`,
  plugins: [magicLinkClient(), apiKeyClient()],
  fetchOptions: isNative ? {
    credentials: "omit",
    auth: { type: "Bearer", token: () => getToken() ?? undefined },
    onSuccess: ({ response }) => { const t = response.headers.get("set-auth-token"); if (t) return setToken(t); },
  } : undefined,
});
