// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 chdominguez and contributors
/** Media files a course may reference, shared by the schema, the server and the MCP server. */
export const MEDIA_TYPES = {
  image: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
  video: ["mp4", "webm"],
  audio: ["mp3", "ogg", "m4a", "wav"],
} as const;
export type MediaType = keyof typeof MEDIA_TYPES;

export const MEDIA_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav",
};

export const mediaExt = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();

/** Bare file name: no separators, no leading dot, no "..". */
export const safeMediaName = (n: string) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(n) && !n.includes("..");

/** Problem with a course-relative ref like `media/x.mp4`, or null. `types` limits the allowed extensions. */
export function mediaRefProblem(ref: string, types: readonly MediaType[] = ["image", "video", "audio"]): string | null {
  const m = /^media\/([^/]+)$/.exec(ref);
  if (!m || !safeMediaName(m[1])) return 'must look like "media/<file>" (letters, digits, . _ -; no "..", scheme or leading slash)';
  const allowed = types.flatMap((t) => MEDIA_TYPES[t] as readonly string[]);
  return allowed.includes(mediaExt(m[1])) ? null : `extension must be one of ${allowed.join(", ")}`;
}

/** Public URL of a course-relative ref; `base` is the server origin when the app is not served by it (native). */
export const mediaUrl = (course: string, ref: string, base = "") => `${base}/media/${course}/${ref.slice("media/".length)}`;
/** Rewrites Markdown image paths `](media/x.png)` to public URLs. */
export const mdMedia = (course: string, text: string, base = "") => text.replace(/\]\(media\/([A-Za-z0-9_][A-Za-z0-9._-]*)\)/g, (_, f) => `](${base}/media/${course}/${f})`);
