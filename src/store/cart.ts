import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, ProductVariant } from "../types/catalog";

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  lastTrigger: HTMLElement | null;
  openCart: (trigger?: HTMLElement | null) => void;
  closeCart: () => void;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
}

export interface CartStoreGroup {
  key: string;
  name: string;
  items: CartItem[];
}

function buildKey(productId: string, variantId: string): string {
  return `${productId}:${variantId}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      lastTrigger: null,
      openCart: (trigger = null) => set({ isOpen: true, lastTrigger: trigger }),
      closeCart: () => set({ isOpen: false }),
      addItem: (product, variant, quantity = 1) => set((state) => {
        const key = buildKey(product.id, variant.id);
        const existing = state.items.find((item) => item.key === key);
        const limit = Math.min(10, variant.inventory ?? 10);
        if (limit < 1) return state;
        const items = existing
          ? state.items.map((item) => item.key === key ? { ...item, quantity: Math.max(1, Math.min(item.quantity + quantity, limit)), availableQuantity: variant.inventory } : item)
          : [...state.items, {
              key,
              productId: product.id,
              sku: variant.sku,
              productName: product.name,
              brand: product.brand,
              image: product.images[0]?.url ?? "",
              ...(variant.size ? { selectedSize: variant.size } : {}),
              selectedVariant: variant.name,
              variantId: variant.id,
              quantity: Math.max(1, Math.min(quantity, limit)),
              availableQuantity: variant.inventory,
              unitPrice: variant.priceOverride ?? product.price,
              currency: product.currency,
              ...(product.sellerVerified && product.sellerStoreName ? { sellerStoreName: product.sellerStoreName } : {}),
              ...(product.sellerVerified && product.sellerStoreSlug ? { sellerStoreSlug: product.sellerStoreSlug } : {})
            }];
        return { items, isOpen: true };
      }),
      removeItem: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
      updateQuantity: (key, quantity) => set((state) => ({
        items: state.items.map((item) => item.key === key ? { ...item, quantity: Math.max(1, Math.min(quantity, 10, item.availableQuantity ?? 10)) } : item)
      })),
      clearCart: () => set({ items: [] })
    }),
    {
      name: "fieldio-cart-v1",
      partialize: (state) => ({ items: state.items })
    }
  )
);

export const selectCartCount = (state: CartState): number => state.items.reduce((count, item) => count + item.quantity, 0);

export const selectCartSubtotal = (state: CartState): number | null => {
  if (state.items.some((item) => item.unitPrice === null) || new Set(state.items.map((item) => item.currency)).size > 1) return null;
  return state.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0);
};

export function groupCartItemsByStore(items: CartItem[], catalog: Product[] = []): CartStoreGroup[] {
  const groups = new Map<string, CartStoreGroup>();
  const products = new Map(catalog.map((product) => [product.id, product]));
  for (const item of items) {
    const product = products.get(item.productId);
    const name = (product?.sellerVerified ? product.sellerStoreName?.trim() : "") || item.sellerStoreName?.trim() || "Fieldio";
    const slug = (product?.sellerVerified ? product.sellerStoreSlug?.trim() : "") || item.sellerStoreSlug?.trim();
    const key = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "fieldio";
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, name, items: [item] });
  }
  return [...groups.values()];
}
