// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const remove = vi.fn(async () => ({ error: null }));
const deleteUser = vi.fn(async () => ({ error: null }));
const responses: Record<string, { data: unknown; error: null }> = {
  admin_users: { data: null, error: null },
  seller_applications: { data: { identity_document_path: "user/id.pdf", address_document_path: "user/address.pdf", business_document_path: null }, error: null },
  seller_listing_images: { data: [{ storage_path: "user/listing/image.webp" }], error: null },
  seller_listings: { data: [{ id: "11111111-1111-4111-8111-111111111111" }], error: null },
  products: { data: [{ id: "22222222-2222-4222-8222-222222222222" }], error: null },
  product_images: { data: [{ storage_path: "seller/product.webp" }], error: null }
};

function query(table: string) {
  const result = responses[table] ?? { data: null, error: null };
  const builder = {
    select: vi.fn(() => builder), update: vi.fn(() => builder), delete: vi.fn(() => builder),
    eq: vi.fn(() => builder), in: vi.fn(() => builder), ilike: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  };
  return builder;
}

const admin = {
  from: vi.fn((table: string) => query(table)),
  storage: { from: vi.fn(() => ({ remove })) },
  auth: { admin: { deleteUser } }
};

vi.mock("../../api/_lib/server", () => ({
  checkRateLimit: vi.fn(async () => true),
  readValidatedJson: vi.fn(async () => ({ action: "delete-account", confirmation: "DELETE" })),
  getAuthenticatedSupabase: vi.fn(async () => ({ admin, user: { id: "33333333-3333-4333-8333-333333333333", email: "seller@example.com", last_sign_in_at: new Date().toISOString() } })),
  json: (body: unknown, status = 200) => Response.json(body, { status }),
  handleApiError: () => Response.json({ error: "failed" }, { status: 500 })
}));

beforeEach(() => { vi.clearAllMocks(); });

it("removes seller files and deletes the authenticated non-staff account", async () => {
  const { POST } = await import("../../api/account");
  const response = await POST(new Request("https://fieldio.shop/api/account", { method: "POST" }));

  expect(response.status).toBe(200);
  expect(remove).toHaveBeenCalledWith(["user/id.pdf", "user/address.pdf"]);
  expect(remove).toHaveBeenCalledWith(["user/listing/image.webp"]);
  expect(remove).toHaveBeenCalledWith(["seller/product.webp"]);
  expect(remove).toHaveBeenCalledWith(["33333333-3333-4333-8333-333333333333/avatar", "33333333-3333-4333-8333-333333333333/store-logo"]);
  expect(deleteUser).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333");
}, 10_000);
