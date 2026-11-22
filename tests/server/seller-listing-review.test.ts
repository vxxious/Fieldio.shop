import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedSupabase: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn()
}));

vi.mock("../../api/_lib/server.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../api/_lib/server.js")>(),
  checkRateLimit: vi.fn(async () => true),
  getAuthenticatedSupabase: mocks.getAuthenticatedSupabase
}));
vi.mock("../../api/_lib/email.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../api/_lib/email.js")>(),
  sendTrackedEmail: vi.fn()
}));

import { POST } from "../../api/seller-listing-review.js";

const listingId = "11111111-1111-4111-8111-111111111111";
const approvalRequest = () => new Request("https://fieldio.shop/api/seller-listing-review", {
  method: "POST",
  headers: { authorization: "Bearer staff-session", "content-type": "application/json" },
  body: JSON.stringify({ listingId, decision: "approved" })
});

describe("seller listing approval authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedSupabase.mockResolvedValue({
      admin: { from: mocks.from, storage: { from: mocks.storageFrom } },
      client: { rpc: mocks.rpc },
      user: { id: "22222222-2222-4222-8222-222222222222" }
    });
  });

  it("does not copy private listing images when staff has not completed MFA", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "current_admin_role" ? "admin" : false, error: null }));

    const response = await POST(approvalRequest());

    expect(response.status).toBe(403);
    expect(mocks.rpc).toHaveBeenCalledWith("has_admin_role", { p_roles: ["owner", "admin"] });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("review_seller_listing", expect.anything());
  });

  it("still publishes images and approves a listing for MFA-verified staff", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      data: name === "current_admin_role" ? "admin" : name === "has_admin_role" ? true : { id: listingId },
      error: null
    }));
    mocks.from.mockImplementation((table: string) => table === "seller_listing_images"
      ? { select: () => ({ eq: () => ({ order: async () => ({ data: [{ storage_path: "seller/image.jpg", alt_text: "Jacket", position: 0 }], error: null }) }) }) }
      : { select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === "seller_listings" ? { store_id: "33333333-3333-4333-8333-333333333333", status: "pending" } : { status: "active" },
        error: null
      }) }) }) });
    mocks.storageFrom.mockReturnValue({
      download: async () => ({ data: new Blob(["image"], { type: "image/jpeg" }), error: null }),
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://example.com/image.jpg" } })
    });

    const response = await POST(approvalRequest());

    expect(response.status).toBe(200);
    expect(mocks.storageFrom).toHaveBeenCalledWith("seller-listing-media");
    expect(mocks.storageFrom).toHaveBeenCalledWith("product-images");
    expect(mocks.rpc).toHaveBeenCalledWith("review_seller_listing", expect.objectContaining({
      p_listing_id: listingId,
      p_public_images: [expect.objectContaining({ public_url: "https://example.com/image.jpg" })]
    }));
  });

  it("does not copy images for a listing that is no longer pending", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "current_admin_role" ? "admin" : true, error: null }));
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "rejected" }, error: null }) }) }) });

    const response = await POST(approvalRequest());

    expect(response.status).toBe(409);
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("review_seller_listing", expect.anything());
  });

  it("does not copy images when the seller store is inactive", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "current_admin_role" ? "admin" : true, error: null }));
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: table === "seller_listings" ? { status: "pending", store_id: "33333333-3333-4333-8333-333333333333" } : { status: "suspended" },
      error: null
    }) }) }) }));

    const response = await POST(approvalRequest());

    expect(response.status).toBe(409);
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("review_seller_listing", expect.anything());
  });
});
