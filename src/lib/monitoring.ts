import * as Sentry from "@sentry/react";

export function stripSensitiveUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
}

export function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!import.meta.env.PROD || !dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      if (event.request?.url) event.request.url = stripSensitiveUrl(event.request.url);
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (typeof breadcrumb.data?.url === "string") breadcrumb.data.url = stripSensitiveUrl(breadcrumb.data.url);
      return breadcrumb;
    }
  });
}

export function captureRouteError(error: unknown) {
  Sentry.captureException(error, { tags: { boundary: "react-router" } });
}
