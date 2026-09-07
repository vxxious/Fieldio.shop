import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  productIds: string[];
  ownerId: string | null;
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      ownerId: null,
      toggle: (productId) => set((state) => ({
        productIds: state.productIds.includes(productId)
          ? state.productIds.filter((id) => id !== productId)
          : [...state.productIds, productId]
      })),
      has: (productId) => get().productIds.includes(productId)
    }),
    { name: "fieldio-wishlist-v1" }
  )
);
