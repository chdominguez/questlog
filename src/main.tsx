import { createRoot } from "react-dom/client";
import "./ui/global.css";
import { App } from "./App";
import { isDemo, isNative } from "./platform";
import { loadToken } from "./auth/token";
import { loadMe } from "./auth/session";
import { loadCourses } from "./builder/api";
import { markCoursesLoaded } from "./course/registry";

// Shared links arrive as /c/<id>; the app routes by hash. The query (?session_id= from Stripe) stays for BillingDone.
const link = /^\/c\/([^/]+)\/?$/.exec(location.pathname);
if (link && !isDemo) history.replaceState(null, "", `/${location.search}#/c/${link[1]}`);

async function boot() {
  if (isNative) await (await import("./native")).init(); // registers the secure token store first
  await loadToken();
  if (isDemo) markCoursesLoaded();
  else {
    void loadCourses(); // registers cached courses synchronously, before the first render
    void loadMe(); // the session store starts sync once signed in
  }
  createRoot(document.getElementById("root")!).render(<App />);
  if (import.meta.env.PROD && !isNative && !isDemo && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

void boot();
