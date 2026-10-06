import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://localhost:5178", channel: "chrome", timezoneId: "America/Sao_Paulo", viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] },
  webServer: { command: "npm run dev -- --port 5178 --strictPort", url: "http://localhost:5178", reuseExistingServer: false },
});
