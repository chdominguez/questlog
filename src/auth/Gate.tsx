import { useEffect, type ReactNode } from "react";
import { isDemo } from "../platform";
import { go, href, PUBLIC_ROUTES, useHash, useRoute } from "../ui/route";
import { useSession } from "./session";
import { SignInScreen } from "./SignInScreen";
import { SignUpScreen } from "./SignUpScreen";
import { VerifyScreen } from "./VerifyScreen";
import { ForgotScreen } from "./ForgotScreen";
import { ResetScreen } from "./ResetScreen";

const isPublic = (name: string) => (PUBLIC_ROUTES as readonly string[]).includes(name);

/**
 * Renders the app, an auth screen, or nothing, by session status and route. Auth routes always render their screen.
 * Signed out on any other route goes to #/signin?next=<hash>; loading renders the app only with a cached account. Pass-through in the demo.
 */
export function Gate({ children }: { children: ReactNode }) {
  const r = useRoute();
  const hash = useHash();
  const { status, me } = useSession();
  const out = !isDemo && !isPublic(r.name) && status === "signedOut";
  useEffect(() => {
    if (out) go(href.signin(hash && hash !== "#/" && hash !== "#" ? hash : undefined));
  }, [out, hash]);
  if (isDemo) return <>{children}</>;
  switch (r.name) {
    case "signin": return <main className="wrap"><SignInScreen next={r.next} /></main>;
    case "signup": return <main className="wrap"><SignUpScreen next={r.next} /></main>;
    case "verify": return <main className="wrap"><VerifyScreen next={r.next} /></main>;
    case "forgot": return <main className="wrap"><ForgotScreen /></main>;
    case "reset": return <main className="wrap"><ResetScreen token={r.token} /></main>;
  }
  if (status === "signedIn" || status === "offline" || (status === "loading" && me)) return <>{children}</>;
  return <main className="wrap" />;
}
