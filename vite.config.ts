import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "node:path";

// Private courses: a checkout of your private courses repo (default ./courses-private, gitignored).
const privateCourses = resolve(process.env.QUESTLOG_COURSES ?? "courses-private");

export default defineConfig({
  // The Cloudflare plugin runs the worker (worker/index.ts) and local D1 inside `vite dev`; tests don't need it.
  plugins: [react(), process.env.VITEST ? [] : cloudflare()],
  resolve: { alias: { "@private": privateCourses, "questlog/authoring": resolve("src/course/authoring.ts") } },
  server: { host: "127.0.0.1", port: 5173, fs: { allow: [".", privateCourses] } },
  test: { environment: "node", include: ["src/**/*.test.ts", "worker/**/*.test.ts", "shared/**/*.test.ts", "scripts/**/*.test.ts"] },
} as any);
