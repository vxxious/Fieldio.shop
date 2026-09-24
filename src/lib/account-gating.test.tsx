import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountGate } from "../components/AccountGate";
import { useRequireAccount } from "../hooks/useRequireAccount";

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
