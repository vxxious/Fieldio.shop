import { beforeEach, describe, expect, it } from "vitest";
import { products } from "../data/catalog";
import { selectCartCount, useCartStore } from "./cart";

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
});
