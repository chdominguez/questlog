import { useEffect, useId, useRef, type ReactNode } from "react";
import "./billing.css";

const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex='-1'])";

/**
 * Modal with the LevelUp focus pattern: initial focus on [data-autofocus] (else the first control), Tab stays inside,
 * Esc and backdrop close unless `closable` is false, body scroll locked, focus back to the trigger on close.
 */
export function Dialog({ title, line, onClose, closable = true, sheet = false, children }: {
  title: ReactNode; line?: ReactNode; onClose(): void; closable?: boolean; sheet?: boolean; children: ReactNode;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef({ onClose, closable });
  latest.current = { onClose, closable };
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const els = () => [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    (box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? els()[0])?.focus();
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && latest.current.closable) latest.current.onClose();
      if (e.key !== "Tab") return;
      const l = els();
      if (!l.length) return e.preventDefault();
      const i = l.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); l[l.length - 1].focus(); }
      else if (!e.shiftKey && i === l.length - 1) { e.preventDefault(); l[0].focus(); }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", on);
    return () => { removeEventListener("keydown", on); document.body.style.overflow = overflow; back?.focus(); };
  }, []);
  return (
    <div className={`overlay${sheet ? " overlay-sheet" : ""}`} onClick={() => closable && onClose()}>
      <div ref={box} className={`dialog${sheet ? " sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`${id}t`}
        aria-describedby={line ? `${id}d` : undefined} onClick={(e) => e.stopPropagation()}>
        <h2 id={`${id}t`}>{title}</h2>
        {line && <p id={`${id}d`} className="dialog-line">{line}</p>}
        {children}
      </div>
    </div>
  );
}

/** Spend confirmation for costs at or above confirmAt. */
export function Confirm({ title, line, action, onConfirm, onCancel }: { title: string; line?: string; action: string; onConfirm(): void; onCancel(): void }) {
  return (
    <Dialog title={title} line={line} onClose={onCancel}>
      <div className="row end">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn" data-autofocus onClick={onConfirm}>{action}</button>
      </div>
    </Dialog>
  );
}
