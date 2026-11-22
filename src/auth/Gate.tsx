import type { ReactNode } from "react";
import { isDemo } from "../platform";
import { useRoute } from "../ui/route";
import { SignInScreen } from "./SignInScreen";
import { SignUpScreen } from "./SignUpScreen";
import { VerifyScreen } from "./VerifyScreen";
import { ForgotScreen } from "./ForgotScreen";
import { ResetScreen } from "./ResetScreen";

// Stub until WP3 (auth): auth routes render their screens, every other route renders the app.

/** Renders the app, an auth screen, or nothing, by session status and route. Pass-through in the demo. */
export function Gate({ children }: { children: ReactNode }) {
  const r = useRoute();
  if (isDemo) return <>{children}</>;
  switch (r.name) {
    case "signin": return <main className="wrap"><SignInScreen next={r.next} /></main>;
    case "signup": return <main className="wrap"><SignUpScreen /></main>;
    case "verify": return <main className="wrap"><VerifyScreen /></main>;
    case "forgot": return <main className="wrap"><ForgotScreen /></main>;
    case "reset": return <main className="wrap"><ResetScreen token={r.token} /></main>;
    default: return <>{children}</>;
  }
}
