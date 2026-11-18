// Canvas (confetti), Mermaid and Monaco need literal colors, not var() or oklch(): resolve tokens from global.css.
let ctx: CanvasRenderingContext2D | null = null;

/** A color token of the current scheme as #rrggbb, e.g. token("--accent"). */
export function token(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return v;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
