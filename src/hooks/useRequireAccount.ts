import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function accountSignUpPath(returnTo: string) {
  return `/account?mode=signup&returnTo=${encodeURIComponent(returnTo)}`;
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
