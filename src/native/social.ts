import { SocialLogin } from "@capgo/capacitor-social-login";
import { platform } from "../platform";

let ready: Promise<void> | undefined;
const init = () => ready ??= SocialLogin.initialize({
  google: { webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID, iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID, mode: "online" },
  ...(platform === "ios" ? { apple: {} } : {}),
}).catch((e) => { ready = undefined; throw e; });

/** Native Google or Apple ID token for signIn.social; null when cancelled. Apple only on iOS. */
export async function idToken(provider: "google" | "apple"): Promise<{ token: string; nonce?: string } | null> {
  if (provider === "apple" && platform !== "ios") return null;
  await init();
  const nonce = crypto.randomUUID();
  try {
    const { result } = provider === "google"
      ? await SocialLogin.login({ provider: "google", options: { nonce } })
      : await SocialLogin.login({ provider: "apple", options: { scopes: ["email", "name"], nonce } });
    const token = "idToken" in result ? result.idToken : null;
    return token ? { token, nonce } : null;
  } catch (e) {
    if ((e as { code?: string }).code === "USER_CANCELLED") return null;
    throw e;
  }
}
