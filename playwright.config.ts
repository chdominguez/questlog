import { defineConfig, devices } from "@playwright/test";

// One serial flow against server/e2e.ts (real app and API, fake Anthropic, Stripe, ElevenLabs, Resend, FCM).
const PORT = 8799;
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, ...devices["Desktop Chrome"], headless: true, actionTimeout: 10_000 },
  webServer: {
    command: `vite build && vite build --ssr server/e2e.ts --outDir dist-e2e && E2E_PORT=${PORT} node dist-e2e/e2e.js`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
