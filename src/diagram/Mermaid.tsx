import { useEffect, useId, useState, type CSSProperties } from "react";
import "./mermaid.css";
import { minWidth, svgWidth } from "./svg";

type MermaidApi = typeof import("mermaid").default;

let ready: Promise<MermaidApi> | null = null;

// Lazy: mermaid is large, so it loads on the first diagram and initializes once.
function load(): Promise<MermaidApi> {
  ready ??= import("mermaid").then(({ default: m }) => {
    m.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      // Mirrors the tokens in src/ui/global.css (mermaid needs literal colors, not CSS vars).
      themeVariables: {
        darkMode: true,
        background: "#1f2236",
        primaryColor: "#292d47",
        primaryTextColor: "#eeecf7",
        primaryBorderColor: "#ff8a5c",
        secondaryColor: "#363b5c",
        secondaryTextColor: "#eeecf7",
        secondaryBorderColor: "#a3a5c2",
        tertiaryColor: "#1f2236",
        tertiaryTextColor: "#eeecf7",
        tertiaryBorderColor: "#363b5c",
        lineColor: "#a3a5c2",
        textColor: "#eeecf7",
        mainBkg: "#292d47",
        nodeBorder: "#ff8a5c",
        clusterBkg: "#1f2236",
        clusterBorder: "#363b5c",
        edgeLabelBackground: "#1f2236",
        actorBkg: "#292d47",
        actorBorder: "#ff8a5c",
        actorTextColor: "#eeecf7",
        actorLineColor: "#a3a5c2",
        signalColor: "#a3a5c2",
        signalTextColor: "#eeecf7",
        labelBoxBkgColor: "#292d47",
        labelBoxBorderColor: "#ff8a5c",
        labelTextColor: "#eeecf7",
        loopTextColor: "#eeecf7",
        noteBkgColor: "#363b5c",
        noteBorderColor: "#a3a5c2",
        noteTextColor: "#eeecf7",
        activationBkgColor: "#363b5c",
        activationBorderColor: "#ff8a5c",
        sequenceNumberColor: "#2a1408",
        stateBkg: "#292d47",
        stateLabelColor: "#eeecf7",
        compositeBackground: "#1f2236",
        compositeTitleBackground: "#292d47",
        altBackground: "#292d47",
        transitionColor: "#a3a5c2",
        transitionLabelColor: "#eeecf7",
        specialStateColor: "#ff8a5c",
      },
    });
    return m;
  });
  return ready;
}

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
      .then((m) => m.render(id, src))
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
          <p>Error en el diagrama: {state.error}</p>
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
