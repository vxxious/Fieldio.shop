import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { localApi } from "./scripts/local-api.ts";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "RESEND_FROM", "NEWSLETTER_TOKEN_SECRET", "APP_URL"]) if (environment[key] && !process.env[key]) process.env[key] = environment[key];
  return {
  plugins: [react(), tailwindcss(), localApi()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("gsap") || id.includes("lenis") || id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("react-hook-form") || id.includes("zod") || id.includes("@hookform")) return "forms";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("node_modules/react/")) return "react";
          return "vendor";
        }
      }
    }
  },
  };
});
