// Inline SVG per level. Theme colors only (var(--…)), viewBox, no width/height, under 4 KB.
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="var(--raise)"/>${body}</svg>`;

export default {
  // Browser window and server rack with a request going right and a response coming back.
  requests: svg(
    `<rect x="14" y="34" width="38" height="30" rx="5" fill="var(--surface)" stroke="var(--info)" stroke-width="4"/>` +
      `<path d="M14 44h38" stroke="var(--info)" stroke-width="4"/>` +
      `<rect x="72" y="30" width="34" height="14" rx="3" fill="var(--accent)"/><rect x="72" y="48" width="34" height="14" rx="3" fill="var(--accent)"/>` +
      `<rect x="72" y="66" width="34" height="14" rx="3" fill="var(--accent)"/>` +
      `<circle cx="80" cy="37" r="2.5" fill="var(--accent-ink)"/><circle cx="80" cy="55" r="2.5" fill="var(--accent-ink)"/><circle cx="80" cy="73" r="2.5" fill="var(--accent-ink)"/>` +
      `<path d="M30 74h32m-8-7 8 7-8 7" fill="none" stroke="var(--ok)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M90 92H58m8-7-8 7 8 7" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  // A stopwatch over a stored box: freshness lifetime.
  caching: svg(
    `<rect x="26" y="70" width="68" height="26" rx="5" fill="var(--accent)"/><path d="M26 80h68" stroke="var(--accent-ink)" stroke-width="3"/>` +
      `<circle cx="60" cy="46" r="24" fill="var(--surface)" stroke="var(--info)" stroke-width="5"/>` +
      `<rect x="55" y="14" width="10" height="8" rx="2" fill="var(--info)"/>` +
      `<path d="M60 46V32" stroke="var(--fg)" stroke-width="4" stroke-linecap="round"/><path d="M60 46l9 6" stroke="var(--bad)" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M60 22a24 24 0 0 1 22 15" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round"/>`,
  ),
  // A bitten cookie next to a shield: state and cross-origin rules.
  "cookies-cors": svg(
    `<path d="M56 60a26 26 0 1 1-12-30 9 9 0 0 0 12 12 9 9 0 0 0 0 18z" fill="var(--gold)"/>` +
      `<circle cx="28" cy="58" r="4" fill="var(--accent-ink)"/><circle cx="40" cy="74" r="4" fill="var(--accent-ink)"/><circle cx="24" cy="44" r="3" fill="var(--accent-ink)"/>` +
      `<path d="M84 28l20 7v15c0 13-9 22-20 26-11-4-20-13-20-26V35z" fill="var(--ok)"/>` +
      `<path d="M75 50l7 7 12-13" fill="none" stroke="var(--bg)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M30 96h60" stroke="var(--line)" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9"/>`,
  ),
};
