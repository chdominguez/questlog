import type { TheoryCard } from "../src/course/schema";

/** Markdown to plain prose for TTS: code becomes "Code example.", links and images keep their text. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "\nCode example.\n")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^[ \t]{0,3}(#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/(\*\*|__|\*|_|~~)(?=\S)([^*_~]*?\S)\1/g, "$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const join = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(" ");

/** What the narrator reads for one theory card. Practice and drill blocks are skipped. */
export function narrationText(card: TheoryCard): string {
  const parts = [card.title];
  for (const b of card.blocks) {
    switch (b.kind) {
      case "md": parts.push(plainText(b.text)); break;
      case "code": parts.push(join("Code example.", b.title)); break;
      case "trace": parts.push(join("Code trace.", b.title)); break;
      case "mermaid": parts.push(join("Diagram.", b.caption)); break;
      case "flow": parts.push(join("Flow diagram.", b.caption)); break;
      case "figure": if (b.caption) parts.push(b.caption); break;
      case "media": parts.push(join(b.alt, b.caption)); break;
      case "drill": case "practice": break;
    }
  }
  return parts.filter((p) => p.trim()).join("\n\n");
}

/** Splits on paragraph breaks into chunks of at most `max` chars; a longer paragraph is cut on sentence ends, then hard. */
export function chunks(text: string, max = 9000): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  const push = (piece: string, sep: string) => {
    if (cur && cur.length + sep.length + piece.length > max) { out.push(cur); cur = ""; }
    if (piece.length > max) {
      const sentences = piece.match(/[^.!?]+[.!?]*\s*/g) ?? [piece];
      if (sentences.length > 1) { for (const s of sentences) push(s.trim(), " "); return; }
      for (let i = 0; i < piece.length; i += max) out.push(piece.slice(i, i + max));
      return;
    }
    cur = cur ? cur + sep + piece : piece;
  };
  for (const p of text.split(/\n{2,}/)) push(p, "\n\n");
  if (cur) out.push(cur);
  return out;
}
