import { useState, type FormEvent } from "react";
import { trackEvent } from "../lib/analytics";
import { ArrowIcon } from "./Icons";

export function Newsletter() {
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; consent?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const consent = form.elements.namedItem("consent") as HTMLInputElement;
    const nextErrors = {
      ...(!email.validity.valid && { email: "Enter a valid email address." }),
      ...(!consent.checked && { consent: "Consent is required to subscribe." })
    };
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length) {
      (nextErrors.email ? email : consent).focus();
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value, consent: true })
      });
      const payload = await response.json().catch(() => ({ error: "Subscription could not be completed." })) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Subscription could not be completed.");
      setMessage(payload.message ?? "You are on the Fieldio list.");
      trackEvent("newsletter_signup");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The subscription could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="newsletter" className="newsletter" aria-labelledby="newsletter-title">
      <div>
        <h2 id="newsletter-title">The Fieldio list</h2>
        <p>New arrivals, exceptional finds, and selected brand updates. Sent with restraint.</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <div className="newsletter-field">
          <label htmlFor="newsletter-email" className="sr-only">Email address</label>
          <input id="newsletter-email" name="email" type="email" placeholder="Email address" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "newsletter-email-error" : undefined} />
          <button type="submit" aria-label="Subscribe" disabled={isSubmitting}><ArrowIcon /></button>
        </div>
        <label className="consent-field"><input name="consent" type="checkbox" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "newsletter-consent-error" : undefined} /> <span>I agree to receive Fieldio emails and can unsubscribe at any time.</span></label>
        {errors.email && <p id="newsletter-email-error" className="form-message" role="alert">{errors.email}</p>}
        {errors.consent && <p id="newsletter-consent-error" className="form-message" role="alert">{errors.consent}</p>}
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </section>
  );
}
