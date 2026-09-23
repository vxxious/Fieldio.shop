// @vitest-environment node
import { expect, it, vi } from "vitest";

const remove = vi.fn(async () => ({ error: null }));
const deleteBuilder = { eq: vi.fn(() => deleteBuilder), then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve) };
const reviewBuilder = { select: vi.fn(() => reviewBuilder), eq: vi.fn(() => reviewBuilder), maybeSingle: vi.fn(async () => ({ data: { id: "11111111-1111-4111-8111-111111111111", buyer_id: "22222222-2222-4222-8222-222222222222", images: [{ storage_path: "buyer/review/photo.webp" }] }, error: null })) };
const admin = {
  from: vi.fn(() => ({ ...reviewBuilder, delete: vi.fn(() => deleteBuilder) })),
  storage: { from: vi.fn(() => ({ remove })) }
};

vi.mock("../../api/_lib/server", () => ({
  checkRateLimit: vi.fn(async () => true),
  readValidatedJson: vi.fn(async () => ({ action: "delete-review", reviewId: "11111111-1111-4111-8111-111111111111" })),
  getAuthenticatedSupabase: vi.fn(async () => ({ admin, user: { id: "22222222-2222-4222-8222-222222222222" } })),
  json: (body: unknown, status = 200) => Response.json(body, { status }),
  handleApiError: () => Response.json({ error: "failed" }, { status: 500 })
}));

it("removes owned review media before deleting the review", async () => {
  const { POST } = await import("../../api/account");
  const response = await POST(new Request("https://fieldio.shop/api/account", { method: "POST" }));
  expect(response.status).toBe(200);
  expect(remove).toHaveBeenCalledWith(["buyer/review/photo.webp"]);
  expect(admin.from).toHaveBeenCalledWith("product_reviews");
});
