import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

type TotpEnrollment = { id: string; totp: { qr_code: string; secret: string } };

async function currentMfa() {
  const [assurance, factors] = await Promise.all([
    supabase!.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase!.auth.mfa.listFactors()
  ]);
  if (assurance.error) throw assurance.error;
  if (factors.error) throw factors.error;
  return {
    verified: assurance.data.currentLevel === "aal2",
    factorId: factors.data.totp.find((factor) => factor.status === "verified")?.id ?? ""
  };
}

async function startEnrollment(friendlyName: string) {
  const factors = await supabase!.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  for (const factor of factors.data.all.filter(({ factor_type, status }) => factor_type === "totp" && status === "unverified")) {
    const removal = await supabase!.auth.mfa.unenroll({ factorId: factor.id });
    if (removal.error) throw removal.error;
  }
  const result = await supabase!.auth.mfa.enroll({ factorType: "totp", friendlyName, issuer: "Fieldio" });
  if (result.error) throw result.error;
  return result.data;
}

function SetupDetails({ enrollment }: { enrollment: TotpEnrollment }) {
  return <div className="mfa-setup"><img src={enrollment.totp.qr_code} alt="QR code for adding Fieldio to your authenticator app" /><p>Scan this code in Google Authenticator, Microsoft Authenticator, Authy, or your password manager.</p><details><summary>Enter a setup key instead</summary><code>{enrollment.totp.secret}</code></details></div>;
}

function CodeForm({ factorId, enrollment, onVerified }: { factorId: string; enrollment: TotpEnrollment | null; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setStatus("Enter the 6-digit code from your authenticator app."); return; }
    setWorking(true); setStatus("");
    const result = await supabase!.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) { setStatus("That code was not accepted. Check the current code and try again."); setWorking(false); return; }
    setWorking(false); onVerified();
  }
  return <>{enrollment && <SetupDetails enrollment={enrollment} />}<form className="mfa-code-form" onSubmit={verify}><label htmlFor={`mfa-code-${factorId}`}>Authenticator code</label><input id={`mfa-code-${factorId}`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /><button className="primary-button" disabled={working}>{working ? "Verifying…" : enrollment ? "Finish setup" : "Verify and continue"}</button></form>{status && <p className="form-message" role="alert">{status}</p>}</>;
}

function AuthenticatedMfaGate({ children, required, admin }: { children: ReactNode; required: boolean; admin: boolean }) {
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [status, setStatus] = useState("");
  const [checkError, setCheckError] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void currentMfa().then((state) => { if (active) { setVerified(state.verified); setFactorId(state.factorId); } }).catch(() => { if (active) { setCheckError(true); setStatus("Two-step verification could not be checked. Sign out and try again."); } }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function setup() {
    setWorking(true); setStatus("");
    try {
      const next = await startEnrollment(admin ? "Fieldio Admin" : "Fieldio Account");
      setEnrollment(next); setFactorId(next.id);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Authenticator setup could not start."); }
    finally { setWorking(false); }
  }

  if (checking) return <div className="route-loading" role="status">Checking two-step verification…</div>;
  if (checkError) return <section className="mfa-gate" aria-labelledby="mfa-gate-title"><h1 id="mfa-gate-title">Account verification unavailable</h1><p role="alert">{status}</p><button className="text-link mfa-signout" type="button" onClick={async () => { await supabase!.auth.signOut(); window.location.assign("/"); }}>Sign out</button></section>;
  if (verified || (!required && !factorId)) return children;
  return <section className="mfa-gate" aria-labelledby="mfa-gate-title"><h1 id="mfa-gate-title">{admin ? "Secure admin access" : "Secure your Fieldio account"}</h1><p>{admin ? "Fieldio requires an authenticator code before staff tools can open." : "Enter the 6-digit code from your authenticator app to continue."}</p>
    {!factorId ? <button className="primary-button" type="button" disabled={working} onClick={() => void setup()}>{working ? "Preparing…" : "Set up authenticator"}</button> : <CodeForm factorId={factorId} enrollment={enrollment} onVerified={() => setVerified(true)} />}
    {status && <p className="form-message" role="alert">{status}</p>}
    <button className="text-link mfa-signout" type="button" onClick={async () => { await supabase!.auth.signOut(); window.location.assign("/"); }}>Sign out</button>
  </section>;
}

export function MfaGate({ children, required = false, admin = false }: { children: ReactNode; required?: boolean; admin?: boolean }) {
  const { session, loading } = useSession();
  if (loading) return <div className="route-loading" role="status">Checking account…</div>;
  if (!session || !supabase) return children;
  return <AuthenticatedMfaGate required={required} admin={admin}>{children}</AuthenticatedMfaGate>;
}

export function MfaSettings() {
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void currentMfa().then((state) => { if (active) { setVerified(state.verified); setFactorId(state.factorId); } }).catch(() => { if (active) setStatus("Two-step verification could not be checked. Try again."); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function setup() {
    setWorking(true); setStatus("");
    try { const next = await startEnrollment("Fieldio Account"); setEnrollment(next); setFactorId(next.id); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Authenticator setup could not start."); }
    finally { setWorking(false); }
  }
  async function disable() {
    if (!window.confirm("Turn off two-step verification for this account?")) return;
    setWorking(true); setStatus("");
    const result = await supabase!.auth.mfa.unenroll({ factorId });
    if (result.error) setStatus(result.error.message);
    else { setFactorId(""); setVerified(false); setEnrollment(null); setStatus("Two-step verification is off."); }
    setWorking(false);
  }

  return <div className="mfa-settings"><div><h3>Two-step verification</h3><p>{factorId ? "Your account is protected with an authenticator app." : "Add an authenticator app for extra protection when you sign in."}</p></div>
    {checking ? <p role="status">Checking…</p> : enrollment ? <><SetupDetails enrollment={enrollment} /><CodeForm factorId={factorId} enrollment={null} onVerified={() => { setEnrollment(null); setVerified(true); setStatus("Two-step verification is on."); }} /></> : factorId ? <button className="text-link" type="button" disabled={working || !verified} onClick={() => void disable()}>{working ? "Updating…" : "Turn off"}</button> : <button className="secondary-button" type="button" disabled={working} onClick={() => void setup()}>{working ? "Preparing…" : "Set up authenticator"}</button>}
    {status && <p className="form-message" role="status">{status}</p>}
  </div>;
}
