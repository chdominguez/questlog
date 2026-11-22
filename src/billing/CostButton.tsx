import { useState } from "react";
import type { Action } from "../../shared/api-types";
import { isDemo } from "../platform";
import { useSession } from "../auth/session";
import { Confirm } from "./Dialog";
import { costOf, num } from "./format";
import { openTopUp } from "./topup";

export interface CostButtonProps {
  action: Action;
  label: string;
  free?: boolean;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
  onPress(): void;
}

/** "label · cost" ("· Free", or the plain label when billing is off); spends at or above confirmAt ask first. */
export function CostButton({ action, label, free, busy, busyLabel, disabled, className = "btn", onPress }: CostButtonProps) {
  const credits = useSession().me?.credits;
  const [asking, setAsking] = useState(false);
  if (isDemo) return null;
  const { text, cost, confirm } = costOf(credits, action, free);
  const press = () => {
    if (!confirm) return onPress();
    if (credits && cost > credits.total) return openTopUp({ cost, balance: credits.total });
    setAsking(true);
  };
  return (
    <>
      <button type="button" className={className} disabled={disabled || busy} aria-busy={busy || undefined} onClick={press}>
        {busy && busyLabel ? busyLabel : (
          <>{label}{text && <> <span aria-hidden="true">·</span> {text}{text !== "Free" && <span className="sr"> credits</span>}</>}</>
        )}
      </button>
      {asking && credits && (
        <Confirm title={`Spend ${num(cost)} credits?`} line={`Balance after: ${num(credits.total - cost)}`} action={label}
          onCancel={() => setAsking(false)} onConfirm={() => { setAsking(false); onPress(); }} />
      )}
    </>
  );
}
