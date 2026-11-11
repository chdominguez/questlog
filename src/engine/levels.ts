import type { Level } from "../course/schema";
import type { Progress } from "./store";

/** Map order: by `order`, boss levels last. */
export const mapOrder = (levels: Level[]) =>
  [...levels].sort((a, b) => Number(!!a.boss) - Number(!!b.boss) || a.order - b.order);

/** A level opens when the previous one on the map is done, or with unlockAll. */
export const isUnlocked = (ordered: Level[], i: number, p: Pick<Progress, "levels" | "unlockAll">) =>
  p.unlockAll || i === 0 || !!p.levels[ordered[i - 1]?.id]?.done;
