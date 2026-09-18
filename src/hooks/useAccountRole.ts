import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export type AccountRole = "buyer" | "seller" | "admin";

export function useAccountRole(userId?: string) {
  return useQuery({
    queryKey: ["account-role", userId],
    enabled: Boolean(userId && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("current_account_role");
      if (error) throw error;
      if (data !== "buyer" && data !== "seller" && data !== "admin") throw new Error("Invalid account role");
      return data as AccountRole;
    }
  });
}
