import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountPage } from "../pages/AccountPage";

const auth = vi.hoisted(() => ({ signInWithIdToken: vi.fn() }));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("../hooks/useAccountRole", () => ({ useAccountRole: () => ({ data: null, error: null, isPending: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("./supabase", () => ({
  supabase: { auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithIdToken: auth.signInWithIdToken
  } }
}));

beforeEach(() => {
  auth.signInWithIdToken.mockReset().mockResolvedValue({ data: {}, error: null });
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "fieldio.apps.googleusercontent.com");
  delete window.google;
  document.querySelector("script[data-google-identity]")?.remove();
});

afterEach(() => {
  delete window.google;
  document.querySelector("script[data-google-identity]")?.remove();
  vi.unstubAllEnvs();
});

it("shows the Google action immediately and signs in without a Supabase OAuth redirect", async () => {
  render(<MemoryRouter initialEntries={["/account?returnTo=%2Fcheckout"]}><AccountPage /></MemoryRouter>);

  expect(screen.getByText("account.google")).toBeVisible();
  await waitFor(() => expect(document.querySelector("script[data-google-identity]")).toBeInTheDocument());
  const script = document.querySelector<HTMLScriptElement>("script[data-google-identity]")!;
  let credentialCallback: ((response: { credential?: string }) => void) | undefined;
  window.google = { accounts: { id: {
    initialize: (config) => { credentialCallback = config.callback; },
    renderButton: (parent) => {
      const button = document.createElement("button");
      button.textContent = "Continue with Google";
      button.addEventListener("click", () => credentialCallback?.({ credential: "verified-google-token" }));
      parent.append(button);
    }
  } } };
  fireEvent.load(script);
  fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

  await waitFor(() => expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: "google", token: "verified-google-token" }));
});
