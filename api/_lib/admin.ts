import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticatedSupabase } from "./server.js";

export type StaffRole = "owner" | "admin" | "editor" | "fulfilment";

export async function requireStaff(request: Request, roles: StaffRole[]): Promise<{ admin: SupabaseClient; client: SupabaseClient; user: User; role: StaffRole }> {
  const auth = await getAuthenticatedSupabase(request);
  const [{ data: role, error: roleError }, { data: allowed, error: accessError }] = await Promise.all([
    auth.client.rpc("current_admin_role"),
    auth.client.rpc("has_admin_role", { p_roles: roles })
  ]);
  if (roleError || accessError || !allowed || !roles.includes(role as StaffRole)) throw new Error("STAFF_ACCESS_REQUIRED");
  return { ...auth, role: role as StaffRole };
}
