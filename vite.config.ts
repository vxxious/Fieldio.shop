import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { fileURLToPath, URL } from "node:url";
import { localApi } from "./scripts/local-api.ts";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN ?? environment.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG ?? environment.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT ?? environment.SENTRY_PROJECT;
  const uploadSourceMaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);
  for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "RESEND_FROM", "NEWSLETTER_TOKEN_SECRET", "APP_URL"]) if (environment[key] && !process.env[key]) process.env[key] = environment[key];
  return {
  plugins: [
    react(),
    tailwindcss(),
    localApi(),
    ...(uploadSourceMaps ? [sentryVitePlugin({
      org: sentryOrg,
      project: sentryProject,
      authToken: sentryAuthToken,
      telemetry: false,
      sourcemaps: { filesToDeleteAfterUpload: "./dist/**/*.map" }
    })] : [])
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
  },
  build: {
    sourcemap: uploadSourceMaps ? "hidden" : false
  },
  };
});
