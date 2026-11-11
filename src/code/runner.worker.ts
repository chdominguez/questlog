import { runKata } from "./runner";
import type { KataTest } from "../course/schema";

self.onmessage = (e: MessageEvent<{ source: string; tests: KataTest[] }>) => {
  self.postMessage(runKata(e.data.source, e.data.tests));
};
self.postMessage("ready");
