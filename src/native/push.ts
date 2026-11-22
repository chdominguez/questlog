import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { call } from "../api";
import type { DeviceInput } from "../../shared/api-types";
import { getToken } from "../auth/token";
import { platform } from "../platform";
import type { PushState } from "../engine/push";

/** Ties this device's FCM token to the signed-in user; a no-op when signed out. */
export async function registerDevice(token: string) {
  if (!getToken()) return;
  await call<void>("/push/device", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: platform as DeviceInput["platform"] } satisfies DeviceInput),
  });
}

/** Registers the token again when granted, so it follows whoever is signed in now. */
export async function pushState(): Promise<PushState> {
  const { receive } = await FirebaseMessaging.checkPermissions();
  if (receive === "denied") return "denied";
  if (receive !== "granted") return "off";
  FirebaseMessaging.getToken().then(({ token }) => registerDevice(token)).catch(() => {});
  return "on";
}

/** Asks permission (from a tap), then registers the FCM token with the server. */
export async function enablePush(): Promise<PushState> {
  const { receive } = await FirebaseMessaging.requestPermissions();
  if (receive !== "granted") return receive === "denied" ? "denied" : "off";
  await registerDevice((await FirebaseMessaging.getToken()).token);
  return "on";
}
