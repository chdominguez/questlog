import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Private courses: a checkout of your private courses repo (default ./courses-private, gitignored).
const privateCourses = resolve(process.env.QUESTLOG_COURSES ?? "courses-private");

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@private": privateCourses, "questlog/authoring": resolve("src/course/authoring.ts") } },
  server: { host: "127.0.0.1", port: 5173, fs: { allow: [".", privateCourses] }, proxy: { "/api": "http://127.0.0.1:5180" } },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.ts", "shared/**/*.test.ts", "scripts/**/*.test.ts", "mcp/**/*.test.ts"] },
} as any);
