import { registerPlugin } from "@capacitor/core";
import { platform } from "../platform";

const Bg = registerPlugin<{ start(o: { title: string }): Promise<void>; stop(): Promise<void> }>("BackgroundAudio");
let on = false;

/** Keeps lesson audio going outside the app: a "playback" session on iOS (sfx.ts sets "ambient"), a media foreground service on Android. */
export function backgroundAudio(title: string | null): void {
  if (!!title === on) return;
  on = !!title;
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) nav.audioSession.type = title ? "playback" : "ambient";
  if (platform === "android") void (title ? Bg.start({ title }) : Bg.stop()).catch(() => { on = false; });
}
