import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";

const consentKey = "fieldio-analytics-consent";
type Choice = "accepted" | "declined" | null;

function readChoice(): Choice {
  const value = localStorage.getItem(consentKey);
  return value === "accepted" || value === "declined" ? value : null;
}

export function AnalyticsConsent() {
  const [choice, setChoice] = useState<Choice>(readChoice);
  const [open, setOpen] = useState(() => !readChoice());

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener("fieldio:privacy-choices", reopen);
    return () => window.removeEventListener("fieldio:privacy-choices", reopen);
  }, []);

  const choose = (next: Exclude<Choice, null>) => {
    localStorage.setItem(consentKey, next);
    setChoice(next);
    setOpen(false);
  };

  return <>
    {choice === "accepted" && <Analytics beforeSend={(event) => ({ ...event, url: event.url.split("?")[0] ?? event.url })} />}
    {open && <aside className="analytics-consent" aria-label="Analytics preference"><p>Anonymous analytics helps Fieldio improve the edit. No checkout or account data is tracked.</p><div><button type="button" className="text-link" onClick={() => choose("declined")}>Decline</button><button type="button" className="primary-button" onClick={() => choose("accepted")}>Allow</button></div></aside>}
  </>;
}
