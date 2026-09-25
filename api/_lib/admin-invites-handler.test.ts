import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  audit: vi.fn(),
  requireStaff: vi.fn()
}));

vi.mock("./admin.js", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("./email.js", () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock("./server.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./server.js")>(),
  checkRateLimit: vi.fn(async () => true)
}));

import { POST } from "./admin-invites-handler.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";

describe("admin removal", () => {
  beforeEach(() => {
    mocks.remove.mockReset();
    mocks.audit.mockReset();
    const admin = {
      from: (table: string) => table === "admin_users" ? {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: memberId, email: "old@example.com", role: "admin" }, error: null }) }) }),
        delete: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { mocks.remove(memberId); return { data: { user_id: memberId }, error: null }; } }) }) })
      } : { insert: async (entry: unknown) => { mocks.audit(entry); return { error: null }; } }
    };
    mocks.requireStaff.mockResolvedValue({ admin, user: { id: ownerId } });
  });

  it("lets an owner remove another admin and records the action", async () => {
    const response = await POST(new Request("https://fieldio.shop/api/admin/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", memberId })
    }));

    expect(response.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith(memberId);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actor_id: ownerId, action: "REMOVE", entity_id: memberId }));
  });

  it("prevents an owner from removing their own access", async () => {
    const response = await POST(new Request("https://fieldio.shop/api/admin/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", memberId: ownerId })
    }));

    expect(response.status).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
