import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { trackEvent } from "../lib/analytics";
import { ArrowIcon } from "./Icons";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  consent: z.literal(true, { error: "Consent is required to subscribe." })
});

type NewsletterValues = z.infer<typeof schema>;

export function Newsletter() {
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, setFocus, formState: { errors, isSubmitting } } = useForm<NewsletterValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: NewsletterValues) => {
    setMessage(null);
    try {
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const payload = await response.json().catch(() => ({ error: "Subscription could not be completed." })) as { message?: string; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Subscription could not be completed.");
    setMessage(payload.message ?? "You are on the Fieldio list.");
    trackEvent("newsletter_signup");
    reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The subscription could not be completed. Please try again."); }
  };

  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div>
        <h2 id="newsletter-title">The Fieldio list</h2>
        <p>New arrivals, exceptional finds, and selected brand updates. Sent with restraint.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit, (formErrors) => { setMessage(null); setFocus(Object.keys(formErrors)[0] as keyof NewsletterValues); })} noValidate>
        <div className="newsletter-field">
          <label htmlFor="newsletter-email" className="sr-only">Email address</label>
          <input id="newsletter-email" type="email" placeholder="Email address" autoComplete="email" {...register("email")} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "newsletter-email-error" : undefined} />
          <button type="submit" aria-label="Subscribe" disabled={isSubmitting}><ArrowIcon /></button>
        </div>
        <label className="consent-field"><input type="checkbox" {...register("consent")} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "newsletter-consent-error" : undefined} /> <span>I agree to receive Fieldio emails and can unsubscribe at any time.</span></label>
        {errors.email && <p id="newsletter-email-error" className="form-message" role="alert">{errors.email.message}</p>}
        {errors.consent && <p id="newsletter-consent-error" className="form-message" role="alert">{errors.consent.message}</p>}
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </section>
  );
}
