import { useQuery } from "@tanstack/react-query";
import type { AdminRole } from "../lib/admin-resources";
import { supabase } from "../lib/supabase";

const adminRoles: AdminRole[] = ["owner", "admin", "editor", "fulfilment"];

export function useAdminRole(userId?: string) {
  return useQuery({
    queryKey: ["admin-access", userId],
    enabled: Boolean(userId && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("current_admin_role");
      if (error) throw error;
      return adminRoles.includes(data as AdminRole) ? data as AdminRole : null;
    }
  });
}
