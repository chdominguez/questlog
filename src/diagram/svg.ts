/** Intrinsic width of a rendered SVG string, from its viewBox. 0 when unknown. */
export function svgWidth(svg: string): number {
  const m = svg.match(/viewBox="\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)/);
  return m ? Number(m[1]) : 0;
}

// Below this width, text in a wide diagram gets too small: scroll the figure instead of shrinking further.
export const MIN_READABLE = 680;
// Never shrink a diagram below this share of its natural size (~16px labels → ~11px); wider ones scroll.
export const MIN_SCALE = 0.7;

/** Minimum rendered width for a diagram whose natural width is `w`. */
export const minWidth = (w: number) => Math.min(w, Math.max(MIN_READABLE, w * MIN_SCALE));
