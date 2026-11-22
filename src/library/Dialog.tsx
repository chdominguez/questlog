import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import "./library.css";

/** Modal on the native <dialog>: focus trap, Escape and backdrop handled by the browser. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
  return (
    <dialog ref={ref} className="lib-dialog card" aria-labelledby={id} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lib-dialog-head">
        <h2 id={id}>{title}</h2>
        <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}><X aria-hidden /></button>
      </div>
      {children}
    </dialog>
  );
}
