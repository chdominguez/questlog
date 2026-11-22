import type { JobPoll, NarrationState } from "../../shared/api-types";
import { apiFetch, call } from "../api";
import { apiUrl, isNative } from "../platform";

const e = encodeURIComponent;

export const getNarration = (course: string, level: string) => call<NarrationState>(`/narration/${e(course)}/${e(level)}`);

/** The job's status only (no events). */
export const jobStatus = (id: string) => call<JobPoll>(`/jobs/${e(id)}?after=${Number.MAX_SAFE_INTEGER}`).then((p) => p.job.status);

/** Unlocks the lesson (charged once) and starts any missing audio. */
export const unlockNarration = (course: string, level: string, key: string) => call<NarrationState>("/narration", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": key },
  body: JSON.stringify({ courseId: course, levelId: level }),
});

/** Playable URL for a segment: same origin with the cookie on web; a blob URL fetched with the bearer on native (caller revokes it). */
export async function audioSrc(hash: string): Promise<string> {
  const path = `/narration/audio/${e(hash)}`;
  if (!isNative) return apiUrl(path);
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}
