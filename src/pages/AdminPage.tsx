import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { adminResources } from "../lib/admin-resources";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

export function AdminPage() {
  const { session, loading } = useSession();
  const [section, setSection] = useState("products");
  const access = useQuery({ queryKey: ["admin-access", session?.user.id], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase!.rpc("is_admin");
    if (error) throw error;
    return data === true;
  } });
  usePageMeta({ title: "Fieldio Admin", description: "Fieldio administration." });
  if (loading || (session && access.isPending)) return <div className="route-loading" role="status">Checking access…</div>;
  if (!session) return <div className="not-found"><h1>Staff access</h1><p>Sign in with your authorised Fieldio account.</p><Link to="/account" className="primary-button">Sign in</Link></div>;
  if (!access.data) return <div className="not-found"><h1>Access unavailable</h1><p>{access.error ? "Access could not be verified. Please try again." : "This account does not have staff access."}</p><button className="primary-button" onClick={() => void access.refetch()}>Try again</button></div>;
  const resource = adminResources.find((item) => item.table === section)!;
  return <div className="admin-page"><aside><h1>Fieldio Admin</h1><nav aria-label="Administration">{adminResources.map((item) => <button key={item.table} aria-current={section === item.table ? "page" : undefined} onClick={() => setSection(item.table)}>{item.title}</button>)}</nav></aside><AdminWorkspace key={section} resource={resource} /></div>;
}
