import { createRoot } from "react-dom/client";
import "./ui/global.css";
import { App } from "./App";
import { startSync } from "./engine/sync";

startSync();
createRoot(document.getElementById("root")!).render(<App />);
