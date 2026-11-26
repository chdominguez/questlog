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

// Light or dark per device: a saved choice, else the OS scheme. global.css keys the dark tokens on data-theme.
type Theme = "light" | "dark";
const KEY = "questie.theme";
const os = typeof window === "undefined" ? null : matchMedia("(prefers-color-scheme: dark)");
const osTheme = (): Theme => (os?.matches ? "dark" : "light");
let choice: Theme | null = null;
try { const t = localStorage.getItem(KEY); if (t === "light" || t === "dark") choice = t; } catch { /* no storage: follow the OS */ }

export const isDark = () => document.documentElement.dataset.theme === "dark";

function apply() {
  document.documentElement.dataset.theme = choice ?? osTheme();
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = token("--bg");
  dispatchEvent(new Event("themechange"));
}

/** Flips light/dark. Landing on the OS scheme goes back to following it. */
export function toggleTheme(): void {
  const next: Theme = isDark() ? "light" : "dark";
  choice = next === osTheme() ? null : next;
  try { if (choice) localStorage.setItem(KEY, choice); else localStorage.removeItem(KEY); } catch { /* kept for this session */ }
  apply();
}

/** Calls f after every theme change; returns the unsubscribe. */
export function onTheme(f: () => void): () => void {
  addEventListener("themechange", f);
  return () => removeEventListener("themechange", f);
}

if (os) { apply(); os.addEventListener("change", apply); }
