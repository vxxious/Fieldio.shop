import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminWorkspace } from "../components/admin/AdminWorkspace";
import { SellerModeration } from "../components/admin/SellerModeration";
import { adminResourcesFor } from "../lib/admin-resources";
import { useAdminRole } from "../hooks/useAdminRole";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

type TotpEnrollment = { id: string; totp: { qr_code: string; secret: string } };

function AdminMfaGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void Promise.all([supabase!.auth.mfa.getAuthenticatorAssuranceLevel(), supabase!.auth.mfa.listFactors()]).then(([assurance, factors]) => {
      if (assurance.error || factors.error) setStatus("Two-step verification could not be checked. Sign out and try again.");
      else {
        setVerified(assurance.data.currentLevel === "aal2");
        setFactorId(factors.data.totp[0]?.id ?? "");
      }
      setChecking(false);
    });
  }, []);

  async function setup() {
    setWorking(true); setStatus("");
    const factors = await supabase!.auth.mfa.listFactors();
    if (factors.error) { setStatus(factors.error.message); setWorking(false); return; }
    const removals = await Promise.all(factors.data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified").map((factor) => supabase!.auth.mfa.unenroll({ factorId: factor.id })));
    const removalError = removals.find(({ error }) => error)?.error;
    if (removalError) { setStatus(removalError.message); setWorking(false); return; }
    const result = await supabase!.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fieldio Admin", issuer: "Fieldio" });
    if (result.error) setStatus(result.error.message);
    else { setEnrollment(result.data); setFactorId(result.data.id); }
    setWorking(false);
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setStatus("Enter the 6-digit code from your authenticator app."); return; }
    setWorking(true); setStatus("");
    const result = await supabase!.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) { setStatus("That code was not accepted. Check the current code and try again."); setWorking(false); return; }
    setVerified(true); setWorking(false);
  }

  if (checking) return <div className="route-loading" role="status">Checking two-step verification…</div>;
  if (verified) return children;
  return <section className="admin-mfa" aria-labelledby="admin-mfa-title"><h1 id="admin-mfa-title">Secure admin access</h1><p>Fieldio requires a 6-digit authenticator code before staff tools can open.</p>
    {!factorId && !enrollment ? <button className="primary-button" type="button" disabled={working} onClick={() => void setup()}>{working ? "Preparing…" : "Set up authenticator"}</button> : <>
      {enrollment && <div className="admin-mfa-setup"><img src={enrollment.totp.qr_code} alt="QR code for adding Fieldio to your authenticator app" /><p>Scan this code in Google Authenticator, Microsoft Authenticator, Authy, or your password manager.</p><details><summary>Enter a setup key instead</summary><code>{enrollment.totp.secret}</code></details></div>}
      <form onSubmit={verify}><label htmlFor="admin-mfa-code">Authenticator code</label><input id="admin-mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /><button className="primary-button" disabled={working}>{working ? "Verifying…" : enrollment ? "Finish setup" : "Verify and continue"}</button></form>
    </>}
    {status && <p className="form-message" role="alert">{status}</p>}
    <button className="text-link admin-mfa-signout" type="button" onClick={async () => { await supabase!.auth.signOut(); window.location.assign("/"); }}>Sign out</button>
  </section>;
}

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
  const selectSection = (nextSection: string) => {
    if (nextSection === section || !hasUnsavedChanges || window.confirm("Discard unsaved changes?")) setSection(nextSection);
  };
  const signOut = async () => {
    const { error } = await supabase!.auth.signOut();
    if (error) { setSignOutError("Sign out failed. Please try again."); return; }
    navigate("/", { replace: true });
  };
  return <AdminMfaGate><div className="admin-page"><aside><div className="admin-page-heading"><h1>Fieldio Admin</h1><span>{access.data}</span></div><label className="admin-mobile-navigation"><span>Manage</span><select value={sellerReviewSelected ? "seller_review" : resource.table} onChange={(event) => selectSection(event.target.value)}>{canReviewSellers && <option value="seller_review">Seller review</option>}{resources.map((item) => <option key={item.table} value={item.table}>{item.title}</option>)}</select></label><nav aria-label="Administration">{canReviewSellers && <button aria-current={sellerReviewSelected ? "page" : undefined} onClick={() => selectSection("seller_review")}>Seller review</button>}{resources.map((item) => <button key={item.table} aria-current={!sellerReviewSelected && resource.table === item.table ? "page" : undefined} onClick={() => selectSection(item.table)}>{item.title}</button>)}</nav><button className="admin-signout text-link" onClick={() => void signOut()}>Sign out</button>{signOutError && <p className="field-error" role="alert">{signOutError}</p>}</aside>{sellerReviewSelected ? <SellerModeration /> : <AdminWorkspace key={resource.table} resource={resource} onDirtyChange={handleDirtyChange} />}</div></AdminMfaGate>;
}
