import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { SellerModeration } from "../components/admin/SellerModeration";
import { ReviewModeration } from "../components/admin/ReviewModeration";
import { EmailCampaigns } from "../components/admin/EmailCampaigns";
import { AdminTeam } from "../components/admin/AdminTeam";
import { AdminFinance } from "../components/admin/AdminFinance";
import { MfaGate } from "../components/MfaSecurity";
import { adminResourcesFor } from "../lib/admin-resources";
import { useAdminRole } from "../hooks/useAdminRole";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

export function AdminPage() {
  const { session, loading } = useSession();
  const [section, setSection] = useState("products");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const navigate = useNavigate();
  const handleDirtyChange = useCallback((dirty: boolean) => setHasUnsavedChanges(dirty), []);
  const access = useAdminRole(session?.user.id);
  usePageMeta({ title: "Fieldio Admin", description: "Fieldio administration." });
  if (loading || (session && access.isPending)) return <div className="route-loading" role="status">Checking access…</div>;
  if (!session) return <div className="not-found"><h1>Staff access</h1><p>Sign in with your authorised Fieldio account.</p><Link to="/account" className="primary-button">Sign in</Link></div>;
  if (!access.data) return <div className="not-found"><h1>Access unavailable</h1><p>{access.error ? "Access could not be verified. Please try again." : "This account does not have staff access."}</p><button className="primary-button" onClick={() => void access.refetch()}>Try again</button></div>;
  const resources = adminResourcesFor(access.data);
  const resource = resources.find((item) => item.table === section) ?? resources[0]!;
  const canReviewSellers = access.data === "owner" || access.data === "admin";
  const sellerReviewSelected = section === "seller_review" && canReviewSellers;
  const reviewModerationSelected = section === "review_moderation" && canReviewSellers;
  const campaignsSelected = section === "email_campaigns" && canReviewSellers;
  const teamSelected = section === "admin_team" && access.data === "owner";
  const financeSelected = section === "admin_finance" && canReviewSellers;
  const selectSection = (nextSection: string) => {
    if (nextSection === section || !hasUnsavedChanges || window.confirm("Discard unsaved changes?")) setSection(nextSection);
  };
  const signOut = async () => {
    const { error } = await supabase!.auth.signOut();
    if (error) { setSignOutError("Sign out failed. Please try again."); return; }
    navigate("/", { replace: true });
  };
  const selectedValue = sellerReviewSelected ? "seller_review" : reviewModerationSelected ? "review_moderation" : campaignsSelected ? "email_campaigns" : financeSelected ? "admin_finance" : teamSelected ? "admin_team" : resource.table;
  const specialOptions = <>{canReviewSellers && <><option value="seller_review">Seller review</option><option value="review_moderation">Review moderation</option><option value="email_campaigns">Email campaigns</option><option value="admin_finance">Commission & payouts</option></>}{access.data === "owner" && <option value="admin_team">Admin team</option>}</>;
  return <MfaGate required admin><div className="admin-page"><aside><div className="admin-page-heading"><h1>Fieldio Admin</h1><span>{access.data === "owner" ? "Super admin" : access.data}</span></div><label className="admin-mobile-navigation"><span>Manage</span><select value={selectedValue} onChange={(event) => selectSection(event.target.value)}>{specialOptions}{resources.map((item) => <option key={item.table} value={item.table}>{item.title}</option>)}</select></label><nav aria-label="Administration">{canReviewSellers && <><button aria-current={sellerReviewSelected ? "page" : undefined} onClick={() => selectSection("seller_review")}>Seller review</button><button aria-current={reviewModerationSelected ? "page" : undefined} onClick={() => selectSection("review_moderation")}>Review moderation</button><button aria-current={campaignsSelected ? "page" : undefined} onClick={() => selectSection("email_campaigns")}>Email campaigns</button><button aria-current={financeSelected ? "page" : undefined} onClick={() => selectSection("admin_finance")}>Commission & payouts</button></>}{access.data === "owner" && <button aria-current={teamSelected ? "page" : undefined} onClick={() => selectSection("admin_team")}>Admin team</button>}{resources.map((item) => <button key={item.table} aria-current={!sellerReviewSelected && !reviewModerationSelected && !campaignsSelected && !financeSelected && !teamSelected && resource.table === item.table ? "page" : undefined} onClick={() => selectSection(item.table)}>{item.title}</button>)}</nav><button className="admin-signout text-link" onClick={() => void signOut()}>Sign out</button>{signOutError && <p className="field-error" role="alert">{signOutError}</p>}</aside>{sellerReviewSelected ? <SellerModeration /> : reviewModerationSelected ? <ReviewModeration /> : campaignsSelected ? <EmailCampaigns /> : financeSelected ? <AdminFinance /> : teamSelected ? <AdminTeam currentUserId={session.user.id} /> : <AdminWorkspace key={resource.table} resource={resource} canDelete={access.data === "owner"} onDirtyChange={handleDirtyChange} />}</div></MfaGate>;
}
