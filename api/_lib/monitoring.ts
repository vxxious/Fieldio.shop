import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn && !Sentry.isInitialized()) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    registerEsmLoaderHooks: false
  });
}

export function captureServerException(error: unknown) {
  Sentry.captureException(error, { tags: { runtime: "vercel-api" } });
}
