import type { Action } from "../../shared/api-types";
import { isDemo } from "../platform";

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

// Stub until WP4 (credits): billing off, so the plain label. WP4 adds "label · cost", "· Free" and the confirm step.
export function CostButton({ label, busy, busyLabel, disabled, className = "btn", onPress }: CostButtonProps) {
  if (isDemo) return null;
  return (
    <button type="button" className={className} disabled={disabled || busy} aria-busy={busy || undefined} onClick={onPress}>
      {busy && busyLabel ? busyLabel : label}
    </button>
  );
}
