import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { SellerModeration } from "../components/admin/SellerModeration";
import { adminResourcesFor, type AdminRole } from "../lib/admin-resources";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

export function AdminPage() {
  const { session, loading } = useSession();
  const [section, setSection] = useState("products");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const handleDirtyChange = useCallback((dirty: boolean) => setHasUnsavedChanges(dirty), []);
  const access = useQuery({ queryKey: ["admin-access", session?.user.id], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase!.rpc("current_admin_role");
    if (error) throw error;
    return (["owner", "admin", "editor", "fulfilment"] as const).includes(data as AdminRole) ? data as AdminRole : null;
  } });
  usePageMeta({ title: "Fieldio Admin", description: "Fieldio administration." });
  if (loading || (session && access.isPending)) return <div className="route-loading" role="status">Checking access…</div>;
  if (!session) return <div className="not-found"><h1>Staff access</h1><p>Sign in with your authorised Fieldio account.</p><Link to="/account" className="primary-button">Sign in</Link></div>;
  if (!access.data) return <div className="not-found"><h1>Access unavailable</h1><p>{access.error ? "Access could not be verified. Please try again." : "This account does not have staff access."}</p><button className="primary-button" onClick={() => void access.refetch()}>Try again</button></div>;
  const resources = adminResourcesFor(access.data);
  const resource = resources.find((item) => item.table === section) ?? resources[0]!;
  const canReviewSellers = access.data === "owner" || access.data === "admin";
  const sellerReviewSelected = section === "seller_review" && canReviewSellers;
  const selectSection = (nextSection: string) => {
    if (nextSection === section || !hasUnsavedChanges || window.confirm("Discard unsaved changes?")) setSection(nextSection);
  };
  return <div className="admin-page"><aside><h1>Fieldio Admin</h1><nav aria-label="Administration">{canReviewSellers && <button aria-current={sellerReviewSelected ? "page" : undefined} onClick={() => selectSection("seller_review")}>Seller review</button>}{resources.map((item) => <button key={item.table} aria-current={!sellerReviewSelected && resource.table === item.table ? "page" : undefined} onClick={() => selectSection(item.table)}>{item.title}</button>)}</nav></aside>{sellerReviewSelected ? <SellerModeration /> : <AdminWorkspace key={resource.table} resource={resource} onDirtyChange={handleDirtyChange} />}</div>;
}
