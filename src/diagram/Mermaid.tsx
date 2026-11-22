import { useEffect, useId, useState, type CSSProperties } from "react";
import "./mermaid.css";
import { minWidth, svgWidth } from "./svg";
import { isDark, token } from "../ui/theme";

type MermaidApi = typeof import("mermaid").default;

let ready: Promise<MermaidApi> | null = null;

// Lazy: mermaid is large, so it loads on the first diagram.
const load = () => (ready ??= import("mermaid").then(({ default: m }) => m));

// Mermaid theme variable -> token in src/ui/global.css.
const VARS = {
  background: "--surface",
  primaryColor: "--raise",
  primaryTextColor: "--fg",
  primaryBorderColor: "--accent",
  secondaryColor: "--line",
  secondaryTextColor: "--fg",
  secondaryBorderColor: "--muted",
  tertiaryColor: "--surface",
  tertiaryTextColor: "--fg",
  tertiaryBorderColor: "--line",
  lineColor: "--muted",
  textColor: "--fg",
  mainBkg: "--raise",
  nodeBorder: "--accent",
  clusterBkg: "--surface",
  clusterBorder: "--line",
  edgeLabelBackground: "--surface",
  actorBkg: "--raise",
  actorBorder: "--accent",
  actorTextColor: "--fg",
  actorLineColor: "--muted",
  signalColor: "--muted",
  signalTextColor: "--fg",
  labelBoxBkgColor: "--raise",
  labelBoxBorderColor: "--accent",
  labelTextColor: "--fg",
  loopTextColor: "--fg",
  noteBkgColor: "--line",
  noteBorderColor: "--muted",
  noteTextColor: "--fg",
  activationBkgColor: "--line",
  activationBorderColor: "--accent",
  sequenceNumberColor: "--accent-ink",
  stateBkg: "--raise",
  stateLabelColor: "--fg",
  compositeBackground: "--surface",
  compositeTitleBackground: "--raise",
  altBackground: "--raise",
  transitionColor: "--muted",
  transitionLabelColor: "--fg",
  specialStateColor: "--accent",
};

// Re-run before each render so diagrams follow the current color scheme.
const init = (m: MermaidApi) => m.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  fontFamily: '"Atkinson Hyperlegible", system-ui, sans-serif',
  look: "handDrawn",
  handDrawnSeed: 7, // same sketch on every render
  themeVariables: { darkMode: isDark(), ...Object.fromEntries(Object.entries(VARS).map(([k, v]) => [k, token(v)])) },
});

let seq = 0;

export function Mermaid({ src, caption }: { src: string; caption?: string }) {
  const reactId = useId();
  const [state, setState] = useState<{ svg?: string; error?: string }>({});

  useEffect(() => {
    let live = true;
    // Unique per render call: mermaid uses the id for the SVG element and its scoped styles.
    const id = `mmd-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${++seq}`;
    setState({});
    load()
      .then((m) => { init(m); return m.render(id, src); })
      .then(({ svg }) => live && setState({ svg }))
      .catch((e: unknown) => {
        document.getElementById(id)?.remove(); // mermaid can leave its scratch node behind on parse errors
        document.getElementById(`d${id}`)?.remove();
        if (live) setState({ error: e instanceof Error ? e.message : String(e) });
      });
    return () => { live = false; };
  }, [src, reactId]);

  return (
    <figure className="mmd">
      {state.error ? (
        <div className="mmd-error" role="alert">
          <p>Diagram error: {state.error}</p>
          <pre>{src}</pre>
        </div>
      ) : state.svg ? (
        <div
          className="mmd-svg"
          tabIndex={0}
          role="group"
          aria-label={caption ?? "Diagram"}
          style={{ "--mmd-min": `${minWidth(svgWidth(state.svg))}px` } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : (
        <div className="mmd-svg mmd-loading" aria-busy="true" />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
