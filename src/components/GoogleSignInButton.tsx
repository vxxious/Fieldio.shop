import { useEffect, useRef, useState } from "react";
import { GoogleIcon } from "./Icons";

type Props = {
  label: string;
  onCredential: (credential: string) => void;
  onError: () => void;
};

export function GoogleSignInButton({ label, onCredential, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    const container = containerRef.current;
    if (!clientId || !container) return;
    const renderButton = () => {
      if (!window.google) {
        setFailed(true);
        onErrorRef.current();
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => credential ? onCredentialRef.current(credential) : onErrorRef.current(),
        use_fedcm_for_prompt: true
      });
      container.replaceChildren();
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.min(container.clientWidth || 400, 400)
      });
      setReady(true);
    };

    let script = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
    const reportError = () => {
      setFailed(true);
      onErrorRef.current();
    };
    if (window.google) renderButton();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.dataset.googleIdentity = "true";
      }
      script.addEventListener("load", renderButton, { once: true });
      script.addEventListener("error", reportError, { once: true });
      if (!script.isConnected) document.head.append(script);
    }
    return () => {
      script?.removeEventListener("load", renderButton);
      script?.removeEventListener("error", reportError);
    };
  }, [clientId]);

  if (!clientId || failed) return <p className="google-signin-error">Google sign-in is temporarily unavailable.</p>;
  return <div className={`google-signin-button${ready ? " is-ready" : ""}`} aria-busy={!ready}>
    <div className="google-signin-render" ref={containerRef} />
    {!ready && <div className="google-signin-placeholder" aria-hidden="true"><GoogleIcon data-preserve-color />{label}</div>}
  </div>;
}
