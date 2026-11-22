import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { useSession } from "../auth/session";
import { num } from "./format";
import { openTopUp } from "./topup";
import "./billing.css";

const KEY = "ql.lowWarned";
const seenFor = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Once per billing period, after a spend leaves the balance under lowAt. */
export function LowBalance() {
  const c = useSession().me?.credits;
  const prev = useRef(c?.total);
  const [show, setShow] = useState(false);
  const period = c?.planExpiresAt ?? "none";
  useEffect(() => {
    if (!c) return;
    const before = prev.current;
    prev.current = c.total;
    if (before !== undefined && c.total < before && c.total < c.lowAt && seenFor() !== period) setShow(true);
  }, [c?.total]);
  if (!show || !c) return null;
  const seen = () => { try { localStorage.setItem(KEY, period); } catch { /* storage off */ } setShow(false); };
  return (
    <div className="card low-balance" role="status">
      <span>{num(c.total)} credits left</span>
      <button type="button" className="btn ghost" onClick={() => { seen(); openTopUp(); }}>Top up</button>
      <button type="button" className="iconbtn" aria-label="Dismiss" onClick={seen}><X aria-hidden /></button>
    </div>
  );
}
