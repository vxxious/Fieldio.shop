import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

afterEach(() => {
  delete window.google;
  vi.unstubAllEnvs();
});

it("returns the Google credential without redirecting through Supabase", () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "fieldio.apps.googleusercontent.com");
  const initialize = vi.fn();
  const onCredential = vi.fn();
  window.google = { accounts: { id: { initialize, renderButton: vi.fn() } } };

  render(<GoogleSignInButton onCredential={onCredential} onError={vi.fn()} />);
  initialize.mock.calls[0]?.[0].callback({ credential: "verified-google-token" });

  expect(onCredential).toHaveBeenCalledWith("verified-google-token");
});
