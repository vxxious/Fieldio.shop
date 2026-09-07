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
        const items = existing
          ? state.items.map((item) => item.key === key ? { ...item, quantity: Math.min(item.quantity + quantity, 10) } : item)
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
              quantity,
              unitPrice: variant.priceOverride ?? product.price,
              currency: product.currency
            }];
        return { items, isOpen: true };
      }),
      removeItem: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
      updateQuantity: (key, quantity) => set((state) => ({
        items: state.items.map((item) => item.key === key ? { ...item, quantity: Math.max(1, Math.min(quantity, 10)) } : item)
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
