import { beforeEach, describe, expect, it } from "vitest";
import { products } from "../data/catalog";
import { groupCartItemsByStore, selectCartCount, selectCartSubtotal, useCartStore } from "./cart";

describe("cart store", () => {
  beforeEach(() => useCartStore.setState({ items: [], isOpen: false, lastTrigger: null }));

  it("merges identical product variants and updates quantity", () => {
    const product = products[0]!;
    const variant = product.variants[0]!;
    useCartStore.getState().addItem(product, variant);
    useCartStore.getState().addItem(product, variant, 2);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(selectCartCount(useCartStore.getState())).toBe(3);
  });

  it("keeps quantities within launch limits", () => {
    const product = products[0]!;
    const variant = product.variants[0]!;
    useCartStore.getState().addItem(product, variant);
    const key = useCartStore.getState().items[0]!.key;
    useCartStore.getState().updateQuantity(key, 100);
    expect(useCartStore.getState().items[0]!.quantity).toBe(10);
  });

  it("does not exceed the selected variant's available stock", () => {
    const product = products[0]!;
    const variant = { ...product.variants[0]!, inventory: 2 };
    useCartStore.getState().addItem(product, variant, 10);
    const item = useCartStore.getState().items[0]!;
    expect(item.quantity).toBe(2);
    useCartStore.getState().updateQuantity(item.key, 8);
    expect(useCartStore.getState().items[0]!.quantity).toBe(2);
  });

  it("groups items by public store identity without copying private seller data", () => {
    const first = { ...products[0]!, price: 10_000, sellerVerified: true, sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a", sellerEmail: "private@example.com" };
    const second = { ...products[1]!, price: 20_000, sellerVerified: true, sellerStoreName: "Studio B", sellerStoreSlug: "studio-b", sellerPhone: "+440000000" };
    useCartStore.getState().addItem(first, first.variants[0]!, 2);
    useCartStore.getState().addItem(second, second.variants[0]!);

    const state = useCartStore.getState();
    const groups = groupCartItemsByStore(state.items);
    expect(groups.map(({ name }) => name)).toEqual(["Atelier A", "Studio B"]);
    expect(groups[0]!.items[0]).toMatchObject({ quantity: 2, selectedVariant: first.variants[0]!.name, sellerStoreName: "Atelier A" });
    expect(groups[0]!.items[0]).not.toHaveProperty("sellerEmail");
    expect(groups[1]!.items[0]).not.toHaveProperty("sellerPhone");
    expect(selectCartSubtotal(state)).toBe(state.items.reduce((total, item) => total + (item.unitPrice ?? 0) * item.quantity, 0));
  });

  it("keeps single-store and legacy carts simple", () => {
    const product = products[0]!;
    useCartStore.getState().addItem(product, product.variants[0]!);
    const legacyItem = useCartStore.getState().items[0]!;
    expect(groupCartItemsByStore([legacyItem])).toEqual([{ key: "fieldio", name: "Fieldio", items: [legacyItem] }]);
    expect(groupCartItemsByStore([legacyItem], [{ ...product, sellerVerified: true, sellerStoreName: "Atelier A", sellerStoreSlug: "atelier-a" }])[0]!.name).toBe("Atelier A");
  });
});
