import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Private courses: a checkout of your private courses repo (default ./courses-private, gitignored).
const privateCourses = resolve(process.env.QUESTIE_COURSES ?? process.env.QUESTLOG_COURSES ?? "courses-private");

export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.VITE_COMMIT": JSON.stringify(process.env.VITE_COMMIT ?? process.env.COMMIT ?? "dev") },
  // KATA=1 bundles server/kata-child.ts into one file: the sandboxed child may read only that file.
  ...(process.env.KATA && { ssr: { noExternal: true } }),
  resolve: { alias: { "@private": privateCourses, "questie/authoring": resolve("src/course/authoring.ts"), "questlog/authoring": resolve("src/course/authoring.ts") } },
  server: { host: "127.0.0.1", port: 5173, fs: { allow: [".", privateCourses] }, proxy: { "/api": "http://127.0.0.1:8787" } }, // `npm run server` serves /api
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.ts", "shared/**/*.test.ts", "scripts/**/*.test.ts", "mcp/**/*.test.ts"] },
} as any);
