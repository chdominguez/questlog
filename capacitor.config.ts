import type { CapacitorConfig } from "@capacitor/cli";
import { APP_ID } from "./shared/brand.ts";

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: "Questie",
  webDir: "dist",
  plugins: {
    FirebaseMessaging: { presentationOptions: ["badge", "sound", "alert"] },
    SocialLogin: { providers: { google: true, apple: true, facebook: false, twitter: false } },
  },
  // Avoids a SwiftPM package identity collision with the Firebase SDK.
  experimental: { ios: { spm: { packageOptions: { "@capacitor-firebase/messaging": { symlink: true } } } } },
};
export default config;
