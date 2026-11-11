import type { SavedAnswer } from "../../shared/api-types";
import { groupAnswers } from "./group";

const SOURCE: Record<SavedAnswer["source"], string> = { typed: "typed", dictated: "dictated", mixed: "mixed" };
const utc = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

/** Markdown export: level title, then each question with its attempts oldest first. `answers` newest first, as the API lists them. */
export function toMarkdown(answers: SavedAnswer[], levels: { id: string; title: string }[] = [], date: (iso: string) => string = utc): string {
  const out = ["# My answers", ""];
  for (const level of groupAnswers(answers, levels)) {
    out.push(`## ${level.title}`, "");
    for (const ch of level.challenges) {
      const [first, ...rest] = ch.attempts[0].prompt.trim().split("\n");
      out.push(`### ${first}`, "", ...(rest.join("\n").trim() ? [rest.join("\n").trim(), ""] : []));
      for (const a of [...ch.attempts].reverse()) {
        const score = a.grade ? `${a.grade.score}/10` : a.selfScore !== undefined ? `${a.selfScore}/10 (self-rated)` : "ungraded";
        out.push(`#### ${date(a.createdAt)} · ${SOURCE[a.source]} · ${score}`, "", a.answer, "");
        if (a.grade) {
          if (a.grade.missing.length) out.push("**Missing:**", "", ...a.grade.missing.map((m) => `- ${m}`), "");
          if (a.grade.mistakes.length) out.push("**Mistakes:**", "", ...a.grade.mistakes.map((m) => `- ${m}`), "");
          if (a.grade.improved) out.push("**Stronger answer:**", "", a.grade.improved, "");
        }
      }
    }
  }
  return out.join("\n");
}
