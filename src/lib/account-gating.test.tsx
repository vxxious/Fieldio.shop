import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountGate } from "../components/AccountGate";
import { accountSignUpPath, safeReturnTo, useRequireAccount } from "../hooks/useRequireAccount";

const auth = vi.hoisted(() => ({ session: null as { user: { id: string } } | null }));
vi.mock("../hooks/useSession", () => ({ useSession: () => ({ session: auth.session, loading: false }) }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: auth.session }, error: null }) } } }));

function Location() {
  const location = useLocation();
  return <output aria-label="location">{`${location.pathname}${location.search}`}</output>;
}

beforeEach(() => { auth.session = null; });
afterEach(cleanup);

it("sends guests to account creation before protected commerce routes open", () => {
  render(<MemoryRouter initialEntries={["/wishlist?from=header"]}><Routes>
    <Route path="/wishlist" element={<AccountGate><div>Saved pieces</div></AccountGate>} />
    <Route path="/account" element={<Location />} />
  </Routes></MemoryRouter>);
  expect(screen.queryByText("Saved pieces")).not.toBeInTheDocument();
  expect(screen.getByLabelText("location")).toHaveTextContent("/account?mode=signup&returnTo=%2Fwishlist%3Ffrom%3Dheader");
});

it.each(["/wishlist", "/checkout"])("lets authenticated customers open %s", (path) => {
  auth.session = { user: { id: "buyer-1" } };
  render(<MemoryRouter initialEntries={[path]}><AccountGate><div>Protected commerce</div></AccountGate></MemoryRouter>);
  expect(screen.getByText("Protected commerce")).toBeVisible();
});

it("accepts only non-account internal return destinations", () => {
  expect(safeReturnTo("/checkout?from=bag#payment")).toBe("/checkout?from=bag#payment");
  for (const unsafe of ["https://evil.example", "//evil.example", "javascript:alert(1)", "data:text/html,evil", "/account?mode=signup&returnTo=%2Fwishlist", "/\\evil.example"]) {
    expect(safeReturnTo(unsafe)).toBe("/");
  }
  expect(accountSignUpPath("/sell")).toBe("/account?mode=signup&returnTo=%2Fsell");
  expect(accountSignUpPath("https://evil.example")).toBe("/account?mode=signup&returnTo=%2F");
});

it("blocks guest commerce actions and preserves the return path", async () => {
  const action = vi.fn();
  function AddButton() {
    const { requireAccount } = useRequireAccount();
    return <><button onClick={async () => { if (await requireAccount()) action(); }}>Add to bag</button><Location /></>;
  }
  render(<MemoryRouter initialEntries={["/products/test-piece?size=M"]}><Routes>
    <Route path="*" element={<AddButton />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Add to bag" }));
  expect(action).not.toHaveBeenCalled();
  expect(await screen.findByText("/account?mode=signup&returnTo=%2Fproducts%2Ftest-piece%3Fsize%3DM")).toBeVisible();
});
