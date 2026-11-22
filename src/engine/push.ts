import { getPushKey, savePushSubscription } from "../answers/api";
import { isNative } from "../platform";

export type PushState = "unsupported" | "install" | "denied" | "off" | "on";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

const registration = () => navigator.serviceWorker.getRegistration();

export async function pushState(): Promise<PushState> {
  if (isNative) return (await import("../native/push")).pushState();
  if (isIos() && !standalone()) return "install"; // iOS delivers push to the home-screen app only
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Asks permission (must run from a tap), subscribes and registers the subscription with the server. */
export async function enablePush(): Promise<PushState> {
  if (isNative) return (await import("../native/push")).enablePush();
  if (await Notification.requestPermission() !== "granted") return pushState();
  const reg = await navigator.serviceWorker.ready;
  const { key } = await getPushKey();
  const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  const j = sub.toJSON();
  await savePushSubscription({ endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
  return "on";
}

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
