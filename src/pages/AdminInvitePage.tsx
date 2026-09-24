import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authenticatedPost } from "../lib/authenticated-api";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";

export function AdminInvitePage() {
  const { session, loading } = useSession();
  const [searchParams] = useSearchParams();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  usePageMeta({ title: "Admin invitation | Fieldio", description: "Accept a secure Fieldio admin invitation." });
  const returnTo = `/admin/invite?token=${encodeURIComponent(token)}`;
  async function accept() {
    setWorking(true); setError("");
    try {
      await authenticatedPost("/api/admin/invites", { action: "accept", token });
      navigate("/admin", { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The invitation could not be accepted."); setWorking(false); }
  }
  if (loading) return <div className="route-loading" role="status">Checking invitation…</div>;
  return <main className="admin-invite-page"><p className="eyebrow">Fieldio administration</p><h1>Join the admin team.</h1>{!token ? <><p>This invitation link is incomplete. Ask a super admin to resend it.</p><Link className="text-link" to="/">Return to Fieldio</Link></> : !session ? <><p>Sign in or create an account using the exact email address that received the invitation.</p><div><Link className="primary-button" to={`/account?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link><Link className="secondary-button" to={`/account?mode=signup&returnTo=${encodeURIComponent(returnTo)}`}>Create account</Link></div></> : <><p>Access is granted only after the secure invitation is verified against your signed-in email.</p><button className="primary-button" disabled={working} onClick={() => void accept()}>{working ? "Accepting…" : "Accept invitation"}</button>{error && <p className="field-error" role="alert">{error}</p>}</>}</main>;
}
