import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AccountPage } from "../pages/AccountPage";

const auth = vi.hoisted(() => ({ updateUser: vi.fn(), signOut: vi.fn() }));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: null, loading: false }) }));
vi.mock("../hooks/useAccountRole", () => ({ useAccountRole: () => ({ data: null, error: null, isPending: false }) }));
vi.mock("../hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string) => void) => {
        queueMicrotask(() => callback("PASSWORD_RECOVERY"));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      updateUser: auth.updateUser,
      signOut: auth.signOut
    }
  }
}));

it("revokes every session after a recovered password is changed", async () => {
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  render(<MemoryRouter><AccountPage /></MemoryRouter>);

  const password = await screen.findByLabelText("account.password");
  fireEvent.change(password, { target: { value: "secure-password" } });
  fireEvent.click(screen.getByRole("button", { name: "account.update" }));

  await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" }));
  expect(screen.getByText("Password updated. Sign in again on this device.")).toBeVisible();
});
