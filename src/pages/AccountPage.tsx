import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AccountDetails } from "../components/AccountDetails";
import { EmailIcon, EyeIcon, GoogleIcon } from "../components/Icons";
import { useLocale } from "../context/LocaleContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { useAdminRole } from "../hooks/useAdminRole";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup" | "reset" | "update";
type AuthValues = { email: string | undefined; password: string | undefined };

export function AccountPage() {
  const { t } = useLocale();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [status, setStatus] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [oauthPending, setOauthPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "";
  const { session, loading } = useSession();
  const adminAccess = useAdminRole(session?.user.id);
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
  useEffect(() => {
    if (!session || mode === "update" || adminAccess.isPending) return;
    if (adminAccess.data) navigate("/admin", { replace: true });
    else if (returnTo) navigate(returnTo, { replace: true });
  }, [adminAccess.data, adminAccess.isPending, mode, navigate, returnTo, session]);

  const onSubmit = async ({ email = "", password = "" }: AuthValues) => {
    setStatus(null);
    if (!supabase) { setStatus("Account services are temporarily unavailable. Please contact Fieldio for assistance."); return; }
    try {
      const result = mode === "signup" ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account` } })
        : mode === "reset" ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` })
        : mode === "update" ? await supabase.auth.updateUser({ password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "update") {
        await supabase.auth.signOut({ scope: "global" });
        setMode("signin");
        setStatus("Password updated. Sign in again on this device.");
        return;
      }
      setStatus(mode === "reset" ? "If an account exists, a reset link has been sent." : mode === "signup" ? "Check your email to continue if confirmation is required." : "Signed in.");
      if (mode === "signup") setConfirmationEmail(email);
    } catch { setStatus(mode === "signin" ? "The email or password is incorrect." : "We could not complete that request. Please try again shortly."); }
  };

  const oauth = async () => {
    setStatus(null);
    if (!supabase) { setStatus("Account services are temporarily unavailable."); return; }
    setOauthPending(true);
    const redirectPath = returnTo ? `/account?returnTo=${encodeURIComponent(returnTo)}` : "/account";
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${redirectPath}` } });
    if (error) setStatus("Google sign-in could not be completed. Please try again.");
    setOauthPending(false);
  };
  if (loading || (session && mode !== "update" && adminAccess.isPending)) return <div className="route-loading" role="status">Checking account…</div>;
  if (session && mode !== "update" && adminAccess.error) return <div className="not-found"><h1>Account unavailable</h1><p>We could not verify your account access.</p><button className="primary-button" onClick={() => void adminAccess.refetch()}>Try again</button></div>;
  if (session && mode !== "update" && adminAccess.data) return <div className="route-loading" role="status">Opening administration…</div>;
  if (session && mode !== "update") return <AccountDetails userId={session.user.id} email={session.user.email || ""} avatarUrl={String(session.user.user_metadata.avatar_url || session.user.user_metadata.picture || "")} />;
  const titles = { signin: t("account.signInTitle"), signup: t("account.signUpTitle"), reset: t("account.resetTitle"), update: t("account.updateTitle") };
  const showAuthMethods = mode === "signin" || mode === "signup";
  return <div className="account-page"><section><h1>{titles[mode]}</h1><p>{t("account.intro")}</p>
    {showAuthMethods && <div className="oauth-buttons" aria-label={mode === "signup" ? "Account creation methods" : "Sign-in methods"}>
      <button type="button" onClick={() => void oauth()} disabled={oauthPending} aria-busy={oauthPending}><GoogleIcon />{oauthPending ? `${t("common.loading")}…` : t("account.google")}</button>
      <button type="button" onClick={() => window.requestAnimationFrame(() => setFocus("email"))} aria-controls="account-email"><EmailIcon />{t("account.emailMethod")}</button>
    </div>}
    {showAuthMethods && <div className="auth-divider" aria-hidden="true"><span>{t("account.emailPassword")}</span></div>}
    <form onSubmit={handleSubmit(onSubmit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof AuthValues))} noValidate>
    {mode !== "update" && <label><span>{t("account.email")}</span><input id="account-email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "account-email-error" : undefined} />{errors.email && <small id="account-email-error" role="alert">{errors.email.message}</small>}</label>}
    {mode !== "reset" && <label><span>{t("account.password")}</span><span className="password-field"><input id="account-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} {...register("password")} aria-invalid={!!errors.password} aria-describedby={errors.password ? "account-password-error" : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? t("account.hidePassword") : t("account.showPassword")} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}><EyeIcon open={showPassword} /></button></span>{errors.password && <small id="account-password-error" role="alert">{errors.password.message}</small>}</label>}
    {status && <p className="form-message" role="status">{status}</p>}
    {confirmationEmail && mode === "signup" && <button className="text-link resend-link" type="button" onClick={async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.resend({ type: "signup", email: confirmationEmail, options: { emailRedirectTo: `${window.location.origin}/account` } });
      setStatus(error ? "The confirmation email could not be sent. Please try again shortly." : "If confirmation is required, another email has been sent.");
    }}>Resend confirmation email</button>}
    <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? `${t("common.loading")}…` : mode === "reset" ? t("account.reset") : mode === "update" ? t("account.update") : mode === "signup" ? t("account.create") : t("account.signIn")}</button>
  </form>
    <div className="account-switch">{(["signin", "signup", "reset"] as const).filter((value) => value !== mode).map((value) => <button key={value} type="button" onClick={() => { setMode(value); setStatus(null); }}>{value === "signin" ? t("account.signIn") : value === "signup" ? t("account.create") : t("account.forgot")}</button>)}</div>
  </section></div>;
}
