import { useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { useWishlistStore } from "../store/wishlist";

export function WishlistSync() {
  const { session, loading } = useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (loading || !supabase) return;
    const previous = useWishlistStore.getState();
    if (!userId) {
      if (previous.ownerId) useWishlistStore.setState({ ownerId: null, productIds: [] });
      return;
    }
    const guestIds = previous.ownerId ? [] : previous.productIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (previous.ownerId !== userId) useWishlistStore.setState({ ownerId: userId, productIds: [] });
    let active = true;
    let unsubscribe = () => {};
    let queue = Promise.resolve();
    async function connect() {
      const { data: wishlist, error } = await supabase!.from("wishlists").upsert({ user_id: userId }, { onConflict: "user_id" }).select("id").single();
      if (error || !wishlist) throw new Error("Wishlist unavailable");
      if (!active) return;
      if (guestIds.length) {
        const { data: valid } = await supabase!.from("products").select("id").in("id", guestIds.slice(0, 100));
        if (valid?.length) {
          const { error: mergeError } = await supabase!.from("wishlist_items").upsert(valid.map(({ id }) => ({ wishlist_id: wishlist.id, product_id: id })), { onConflict: "wishlist_id,product_id" });
          if (mergeError) throw mergeError;
        }
      }
      const { data, error: readError } = await supabase!.from("wishlist_items").select("product_id").eq("wishlist_id", wishlist.id);
      if (readError) throw readError;
      if (!active) return;
      useWishlistStore.setState({ ownerId: userId!, productIds: (data || []).map((item) => item.product_id as string) });
      unsubscribe = useWishlistStore.subscribe((state, previousState) => {
        if (state.ownerId !== userId || state.productIds === previousState.productIds) return;
        const added = state.productIds.filter((id) => !previousState.productIds.includes(id));
        const removed = previousState.productIds.filter((id) => !state.productIds.includes(id));
        queue = queue.then(async () => {
          if (!active) return;
          for (const id of added) {
            const { error: writeError } = await supabase!.from("wishlist_items").upsert({ wishlist_id: wishlist.id, product_id: id }, { onConflict: "wishlist_id,product_id" });
            if (writeError) throw writeError;
          }
          if (removed.length) {
            const { error: removeError } = await supabase!.from("wishlist_items").delete().eq("wishlist_id", wishlist.id).in("product_id", removed);
            if (removeError) throw removeError;
          }
        }).catch(() => { if (active) toast.error("Your wishlist is saved on this device but could not sync. Please try again later."); });
      });
    }
    void connect().catch(() => { if (active) toast.error("Your saved wishlist could not load. Please try again later."); });
    return () => { active = false; unsubscribe(); };
  }, [loading, userId]);
  return null;
}
