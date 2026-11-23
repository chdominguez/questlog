import { useEffect, useRef, useState, type ReactNode } from "react";
import { CaretDown, Check, X } from "@phosphor-icons/react";
import "./engine.css";

export type Mark = "ok" | "bad" | null;
export interface JumpItem { label: string; kind?: string; mark?: Mark; disabled?: boolean }

/** Numbered rows to jump to; the ring on the right fills in once an item is done. */
export function JumpList({ items, current, onPick }: { items: JumpItem[]; current?: number; onPick: (k: number) => void }) {
  return (
    <ol className="jlist">
      {items.map((it, k) => (
        <li key={k}>
          <button type="button" className={k === current ? "on" : ""} disabled={it.disabled} aria-current={k === current ? "step" : undefined} onClick={() => onPick(k)}>
            <span className="jlist-n">{k + 1}</span>
            <span className="jlist-q">{it.label}</span>
            <span className="jlist-kind">{it.kind}</span>
            <span className={`jlist-mark ${it.mark ?? ""}`}>
              {it.mark === "ok" ? <Check weight="bold" aria-label="Done" /> : it.mark === "bad" ? <X weight="bold" aria-label="Wrong" /> : null}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** A button that drops down a JumpList; closes on pick, outside tap or Escape. `up` opens it above the button. */
export function Jump({ label, children, items, current, onPick, up = false, className = "" }: {
  label: string; children?: ReactNode; items: JumpItem[]; current?: number; onPick: (k: number) => void; up?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (!el.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("pointerdown", off);
    addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", off); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={el} className={`jump${up ? " up" : ""}`}>
      <button type="button" className={`jump-btn ${className}`} aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        {children}<CaretDown weight="bold" className="jump-caret" aria-hidden />
      </button>
      {open && <div className="jump-pop"><JumpList items={items} current={current} onPick={(k) => { setOpen(false); onPick(k); }} /></div>}
    </div>
  );
}
