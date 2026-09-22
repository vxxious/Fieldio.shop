import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MfaGate, MfaSettings } from "../components/MfaSecurity";

const auth = vi.hoisted(() => ({
  currentLevel: "aal1" as "aal1" | "aal2",
  factorStatus: "verified" as "verified" | "unverified" | "none",
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn()
}));

vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: { user: { id: "user-1" } }, loading: false }) }));
vi.mock("./supabase", () => ({
  supabase: { auth: {
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: auth.currentLevel, nextLevel: auth.factorStatus === "verified" ? "aal2" : "aal1" }, error: null }),
      listFactors: async () => {
        const factor = auth.factorStatus === "none" ? [] : [{ id: "factor-1", factor_type: "totp", status: auth.factorStatus }];
        return { data: { all: factor, totp: factor.filter(({ status }) => status === "verified") }, error: null };
      },
      challengeAndVerify: auth.challengeAndVerify,
      enroll: auth.enroll,
      unenroll: auth.unenroll
    },
    signOut: vi.fn(async () => ({ error: null }))
  } }
}));

beforeEach(() => {
  auth.currentLevel = "aal1";
  auth.factorStatus = "verified";
  auth.challengeAndVerify.mockReset().mockImplementation(async () => { auth.currentLevel = "aal2"; return { data: {}, error: null }; });
  auth.enroll.mockReset().mockResolvedValue({ data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml,test", secret: "SECRET" } }, error: null });
  auth.unenroll.mockReset().mockResolvedValue({ data: {}, error: null });
});

it("requires an enrolled buyer or seller to verify before protected content opens", async () => {
  render(<MfaGate><div>Protected account</div></MfaGate>);
  expect(await screen.findByRole("heading", { name: "Secure your Fieldio account" })).toBeVisible();
  expect(screen.queryByText("Protected account")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
  await waitFor(() => expect(auth.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" }));
  expect(await screen.findByText("Protected account")).toBeVisible();
});

it("lets an account without MFA start authenticator enrollment", async () => {
  auth.factorStatus = "none";
  render(<MfaSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));
  expect(await screen.findByAltText("QR code for adding Fieldio to your authenticator app")).toBeVisible();
  expect(auth.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Fieldio Account", issuer: "Fieldio" });
});
