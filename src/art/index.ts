// Inline SVG registry. Colors come from the theme's CSS variables, so the art only renders right inline (not as <img>).
const svg = (viewBox: string, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

const BG = `<circle cx="60" cy="60" r="54" fill="var(--raise)"/>`;
const SHIELD = (fill: string, extra = "") =>
  `<path d="M32 4 56 12v20c0 14-10 24-24 28C18 56 8 46 8 32V12z" fill="${fill}"${extra}/>`;
const CHEVRON = (y: number) =>
  `<path d="M20 ${y}l12 9 12-9" fill="none" stroke="var(--bg)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;

const ART: Record<string, string> = {
  mascot: svg(
    "0 0 120 120",
    `<ellipse cx="44" cy="102" rx="11" ry="5" fill="var(--accent)"/><ellipse cx="76" cy="102" rx="11" ry="5" fill="var(--accent)"/>` +
      `<ellipse cx="60" cy="64" rx="38" ry="36" fill="var(--accent)"/>` +
      `<ellipse cx="60" cy="80" rx="22" ry="15" fill="var(--gold)"/>` +
      `<circle cx="47" cy="56" r="9" fill="var(--fg)"/><circle cx="73" cy="56" r="9" fill="var(--fg)"/>` +
      `<circle cx="49" cy="57" r="4" fill="var(--accent-ink)"/><circle cx="75" cy="57" r="4" fill="var(--accent-ink)"/>` +
      `<path d="M54 70q6 5 12 0" fill="none" stroke="var(--accent-ink)" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M23 58a37 37 0 0 1 74 0" fill="none" stroke="var(--info)" stroke-width="6"/>` +
      `<rect x="16" y="52" width="11" height="20" rx="4" fill="var(--info)"/><rect x="93" y="52" width="11" height="20" rx="4" fill="var(--info)"/>` +
      `<path d="M22 72q2 16 22 16" fill="none" stroke="var(--info)" stroke-width="3"/><circle cx="46" cy="88" r="4" fill="var(--info)"/>`,
  ),
  "rank-0": svg("0 0 64 64", SHIELD("var(--muted)") + `<circle cx="32" cy="31" r="6" fill="var(--bg)"/>`),
  "rank-1": svg("0 0 64 64", SHIELD("var(--info)") + CHEVRON(27)),
  "rank-2": svg("0 0 64 64", SHIELD("var(--ok)") + CHEVRON(20) + CHEVRON(32)),
  "rank-3": svg("0 0 64 64", SHIELD("var(--accent)") + CHEVRON(15) + CHEVRON(26) + CHEVRON(37)),
  "rank-4": svg(
    "0 0 64 64",
    SHIELD("var(--bad)") +
      `<path d="m32 16 4.4 9 9.9 1.4-7.2 7 1.7 9.8L32 38.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z" fill="var(--bg)"/>`,
  ),
  "rank-5": svg(
    "0 0 64 64",
    SHIELD("var(--gold)", ` stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"`) +
      `<path d="M21 32l8 8 14-15" fill="none" stroke="var(--accent-ink)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
};

export const ART_KEYS = Object.keys(ART);
/** Course art is registered by the course registry under qualified keys ("course:key"). */
export const addArt = (entries: Record<string, string>) => { Object.assign(ART, entries); };
export const getArt = (key?: string): string | undefined => (key ? ART[key] : undefined);
