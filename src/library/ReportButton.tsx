import { useState } from "react";
import { Flag } from "@phosphor-icons/react";
import type { FlagReason } from "../../shared/api-types";
import { isDemo } from "../platform";
import { Dialog } from "./Dialog";
import { sendFlag } from "./api";

const REASONS: [FlagReason, string][] = [["wrong", "Wrong"], ["unclear", "Unclear"], ["broken", "Broken"], ["other", "Other"]];

/** Report a problem on a challenge (qualified id) or a theory card ("<level key>#<card index>"). */
export function ReportButton({ courseId, itemId }: { courseId: string; itemId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (isDemo) return null;
  return (
    <span className="lib-report">
      <span role="status" className="lib-meta">{sent ? "Report sent" : ""}</span>
      <button type="button" className="iconbtn" aria-label="Report a problem" onClick={() => { setSent(false); setOpen(true); }}>
        <Flag aria-hidden />
      </button>
      {open && <ReportDialog courseId={courseId} itemId={itemId} onClose={() => setOpen(false)} onSent={() => { setOpen(false); setSent(true); }} />}
    </span>
  );
}

function ReportDialog({ courseId, itemId, onClose, onSent }: { courseId: string; itemId: string; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const send = async () => {
    if (!reason) return;
    setBusy(true); setError(false);
    try { await sendFlag({ courseId, itemId, reason, ...(text.trim() && { text: text.trim() }) }); onSent(); }
    catch { setError(true); setBusy(false); }
  };
  return (
    <Dialog title="Report a problem" onClose={onClose}>
      <form className="lib-stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <fieldset>
          <legend className="sr">Reason</legend>
          {REASONS.map(([r, label]) => (
            <label key={r}><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />{label}</label>
          ))}
        </fieldset>
        <label className="lib-field">Details
          <textarea className="scr-input" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && <p className="wa-error" role="alert">Couldn't send</p>}
        <div className="wa-actions lib-end">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!reason || busy}>Send</button>
        </div>
      </form>
    </Dialog>
  );
}
