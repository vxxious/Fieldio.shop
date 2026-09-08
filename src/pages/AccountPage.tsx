import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AccountDetails } from "../components/AccountDetails";
import { EmailIcon, GoogleIcon } from "../components/Icons";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "reset" | "update";
type AuthValues = { email: string | undefined; password: string | undefined };

export function AccountPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [status, setStatus] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);
  const { session, loading } = useSession();
  const schema = z.object({
    email: mode === "update" ? z.string().optional() : z.string().email("Enter a valid email."),
    password: mode === "reset" ? z.string().optional() : z.string().min(8, "Use at least 8 characters.")
  });
  const { register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<AuthValues>({ resolver: zodResolver(schema) });
  usePageMeta({ title: "Account | Fieldio", description: "Manage your Fieldio details, wishlist, and order requests.", canonical: "https://fieldio.shop/account" });
  useEffect(() => {
    const listener = supabase?.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setMode("update"); });
    return () => listener?.data.subscription.unsubscribe();
  }, []);

  const onSubmit = async ({ email = "", password = "" }: AuthValues) => {
    setStatus(null);
    if (!supabase) { setStatus("Account services are temporarily unavailable. Please contact Fieldio for assistance."); return; }
    try {
      const result = mode === "signup" ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account` } })
        : mode === "reset" ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` })
        : mode === "update" ? await supabase.auth.updateUser({ password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setStatus(mode === "reset" ? "Check your email for the reset link." : mode === "signup" ? "Check your email to confirm your account." : mode === "update" ? "Password updated." : "Signed in.");
      if (mode === "update") setMode("signin");
    } catch (error) { setStatus(error instanceof Error ? error.message : "We could not complete that request. Please try again."); }
  };

  const oauth = async () => {
    setStatus(null);
    if (!supabase) { setStatus("Account services are temporarily unavailable."); return; }
    setOauthPending(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/account` } });
    if (error) setStatus(error.message);
    setOauthPending(false);
  };
  if (loading) return <div className="route-loading" role="status">Loading account…</div>;
  if (session && mode !== "update") return <AccountDetails userId={session.user.id} email={session.user.email || ""} />;
  const titles = { signin: "Welcome back", signup: "Create your account", reset: "Reset your password", update: "Choose a new password" };
  const showAuthMethods = mode === "signin" || mode === "signup";
  return <div className="account-page"><section><h1>{titles[mode]}</h1><p>Manage saved details, wishlist, and order requests.</p>
    {showAuthMethods && <div className="oauth-buttons" aria-label={mode === "signup" ? "Account creation methods" : "Sign-in methods"}>
      <button type="button" onClick={() => void oauth()} disabled={oauthPending} aria-busy={oauthPending}><GoogleIcon />{oauthPending ? "Connecting…" : "Continue with Google"}</button>
      <button type="button" onClick={() => setFocus("email")} aria-controls="account-email"><EmailIcon />Continue with email</button>
    </div>}
    {showAuthMethods && <div className="auth-divider" aria-hidden="true"><span>or use your email</span></div>}
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
    {mode !== "update" && <label><span>Email</span><input id="account-email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />{errors.email && <small role="alert">{errors.email.message}</small>}</label>}
    {mode !== "reset" && <label><span>Password</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} {...register("password")} aria-invalid={!!errors.password} />{errors.password && <small role="alert">{errors.password.message}</small>}</label>}
    {status && <p className="form-message" role="status">{status}</p>}
    <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : mode === "reset" ? "Send reset link" : mode === "update" ? "Update password" : mode === "signup" ? "Create account" : "Sign in"}</button>
  </form>
    <div className="account-switch">{(["signin", "signup", "reset"] as const).filter((value) => value !== mode).map((value) => <button key={value} type="button" onClick={() => { setMode(value); setStatus(null); }}>{value === "signin" ? "Sign in" : value === "signup" ? "Create account" : "Forgot password?"}</button>)}</div>
  </section></div>;
}
