import { App } from "@capacitor/app";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { StatusBar, Style } from "@capacitor/status-bar";
import { registerTokenStore } from "../auth/token";
import { linkTarget, pushHash } from "./links";
import { registerDevice } from "./push";

// Loaded only through import() behind isNative.

const TOKEN = "questie.token";

async function openLink(url: string) {
  const t = linkTarget(url);
  if (!t) return;
  if ("hash" in t) { location.hash = t.hash; return; }
  const [{ authClient }, { loadMe }] = await Promise.all([import("../auth/client"), import("../auth/session")]);
  await authClient.$fetch("/magic-link/verify", { method: "GET", query: { token: t.token } }); // the bearer client stores set-auth-token
  await loadMe();
}

/** Android back: close an open dialog (dialogs close on Escape), else go back, else leave from Home. */
function back() {
  if (document.querySelector('[aria-modal="true"]')) dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  else if (!location.hash || location.hash === "#/" || location.hash === "#") void App.exitApp();
  else history.back();
}

/** Dark text on paper, light text on graphite. */
function statusBar() {
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => { StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {}); };
  apply();
  dark.addEventListener("change", apply);
}

/** Opens this app's page in the OS settings (notifications blocked). */
export async function openSettings() {
  const { NativeSettings, AndroidSettings, IOSSettings } = await import("capacitor-native-settings");
  await NativeSettings.open({ optionAndroid: AndroidSettings.ApplicationDetails, optionIOS: IOSSettings.App });
}

/** Registers the secure token store, back button, appUrlOpen and push listeners. Runs before loadToken. */
export async function init(): Promise<void> {
  registerTokenStore({
    load: () => SecureStorage.getItem(TOKEN).catch(() => null),
    save: (t) => SecureStorage.setItem(TOKEN, t),
    clear: () => SecureStorage.removeItem(TOKEN),
  });
  statusBar();
  void App.addListener("backButton", back);
  void App.addListener("appUrlOpen", ({ url }) => { openLink(url).catch((e) => console.error("app link failed:", e)); });
  void FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => {
    const h = pushHash((notification.data as { url?: unknown } | undefined)?.url);
    if (h) location.hash = h;
  });
  void FirebaseMessaging.addListener("tokenReceived", ({ token }) => { registerDevice(token).catch(() => {}); });
}
