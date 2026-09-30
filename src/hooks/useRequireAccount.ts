import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function accountSignUpPath(returnTo: string) {
  return `/account?mode=signup&returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}

export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  const candidate = value?.trim();
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) return fallback;
  try {
    const url = new URL(candidate, "https://fieldio.invalid");
    if (url.origin !== "https://fieldio.invalid" || url.pathname === "/account") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function useRequireAccount() {
  const location = useLocation();
  const navigate = useNavigate();
  const signUpPath = accountSignUpPath(`${location.pathname}${location.search}`);
  const requireAccount = useCallback(async () => {
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    if (session) return true;
    navigate(signUpPath);
    return false;
  }, [navigate, signUpPath]);

  return { signUpPath, requireAccount };
}
