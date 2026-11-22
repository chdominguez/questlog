import { ArrowSquareOut } from "@phosphor-icons/react";
import type { TheoryCard } from "../course/schema";
import "../builder/builder.css";

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** Citations under a theory card (research courses); nothing when there are none. */
export function Sources({ sources }: { sources?: TheoryCard["sources"] }) {
  if (!sources?.length) return null;
  return (
    <section className="sources">
      <h3>Sources</h3>
      <ol>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}<ArrowSquareOut aria-hidden /><span className="sr">opens in new tab</span></a>
            {" "}<span className="source-host">· {host(s.url)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
