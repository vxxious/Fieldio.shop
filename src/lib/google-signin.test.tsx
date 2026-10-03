import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountPage } from "../pages/AccountPage";

const auth = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("../hooks/useAccountRole", () => ({ useAccountRole: () => ({ data: null, error: null, isPending: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("./supabase", () => ({
  supabase: { auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithOAuth: auth.signInWithOAuth
  } }
}));

beforeEach(() => auth.signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null }));

it("renders Google sign-in immediately and preserves the requested route", async () => {
  render(<MemoryRouter initialEntries={["/account?returnTo=%2Fcheckout"]}><AccountPage /></MemoryRouter>);

  const button = screen.getByRole("button", { name: "account.google" });
  expect(button).toBeVisible();
  fireEvent.click(button);

  await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1));
  const request = auth.signInWithOAuth.mock.calls[0]?.[0];
  const redirect = new URL(request.options.redirectTo);

  expect(request.provider).toBe("google");
  expect(redirect.pathname).toBe("/account");
  expect(redirect.searchParams.get("returnTo")).toBe("/checkout");
  expect(document.querySelector("script[data-google-identity]")).not.toBeInTheDocument();
});
