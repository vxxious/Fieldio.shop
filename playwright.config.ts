import { defineConfig, devices } from "@playwright/test";

process.env.VITE_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= "e2e-preview-key";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:4173", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"] } }
  ],
  webServer: {
    command: "npm run build:preview && npm run preview -- --host 127.0.0.1",
    port: 4173,
    reuseExistingServer: false
  }
});
