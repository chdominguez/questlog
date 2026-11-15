import type { Result } from "./store";

/** Self-rating buttons in key order (1-4). Easy is an "ok" that schedules like FSRS Easy. */
export const FLASH_RATINGS: { label: string; result: Result; easy?: boolean }[] = [
  { label: "Again", result: "miss" },
  { label: "Hard", result: "partial" },
  { label: "Good", result: "ok" },
  { label: "Easy", result: "ok", easy: true },
];

export const ratingForKey = (key: string) => FLASH_RATINGS[Number(key) - 1];
