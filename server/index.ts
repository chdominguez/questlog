import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { api } from "./api";

const app = new Hono();
app.route("/api", api);
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

const port = Number(process.env.PORT ?? 5180);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => console.log(`Entrevista Quest → http://localhost:${port}`));
