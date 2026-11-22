import { Coins } from "@phosphor-icons/react";
import { isDemo } from "../platform";
import { useSession } from "../auth/session";
import { href } from "../ui/route";
import { num } from "./format";
import { openTopUp } from "./topup";
import "./billing.css";

/** Hud balance; links to Credits, or opens the top-up sheet at 0. */
export function CreditChip() {
  const c = useSession().me?.credits;
  if (!c || isDemo) return null;
  return (
    <a className={`credit-chip${c.total < c.lowAt ? " low" : ""}`} href={href.credits()} aria-label={`${num(c.total)} credits`}
      onClick={(e) => { if (c.total <= 0) { e.preventDefault(); openTopUp(); } }}>
      <Coins aria-hidden /><b>{num(c.total)}</b>
    </a>
  );
}
