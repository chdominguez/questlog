import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as "web" | "ios" | "android";
/** Static site demo: no account, no server. */
export const isDemo = !!import.meta.env?.VITE_DEMO;
/** "" on web (same origin); the hosted server on iOS and Android. */
export const API_BASE: string = isNative ? import.meta.env?.VITE_API_BASE ?? "" : "";
export const apiUrl = (path: string) => `${API_BASE}/api${path}`;
