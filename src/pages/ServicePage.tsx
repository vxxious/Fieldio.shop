import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { usePageMeta } from "../hooks/usePageMeta";
import { createWhatsAppUrl } from "../lib/whatsapp";

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().min(7, "Enter a valid phone number."),
  company: z.string().trim().max(120).optional(),
  subject: z.string().trim().min(3, "Tell us what this is about."),
  message: z.string().trim().min(15, "Add a little more detail.").max(2000)
});
type EnquiryValues = z.infer<typeof enquirySchema>;

const copy = {
  "/personal-shopping": { title: "Personal shopping, made personal.", intro: "Tell us what you are looking for. Fieldio combines product sourcing, luxury support, and worldwide shipping in one direct conversation.", points: ["Luxury and designer sourcing", "Specific products, sizes, and colourways", "Worldwide shipping coordination", "Direct support from request to delivery"] },
  "/wholesale": { title: "Wholesale & supply.", intro: "A direct sourcing service for boutiques, stylists, teams, and businesses. Share the category, quantity, target market, and timing.", points: ["Fashion and accessory supply", "Mixed-category sourcing", "Minimum order confirmed per enquiry", "Worldwide fulfilment planning"] },
  "/contact": { title: "Speak with Fieldio.", intro: "For products, orders, sourcing, wholesale, or general enquiries, send the details below or continue directly on WhatsApp.", points: ["Product enquiries", "Order assistance", "Wholesale requests", "Shipping support"] }
} as const;

export function ServicePage() {
  const { pathname } = useLocation();
  const page = copy[pathname as keyof typeof copy] ?? copy["/contact"];
  const isWholesale = pathname === "/wholesale";
  const [status, setStatus] = useState<string | null>(null);
  const { register, handleSubmit, reset, setFocus, formState: { errors, isSubmitting } } = useForm<EnquiryValues>({ resolver: zodResolver(enquirySchema) });
  usePageMeta({ title: `${page.title.replace(".", "")} | Fieldio`, description: page.intro, canonical: `https://fieldio.shop${pathname}` });
  const onSubmit = async (values: EnquiryValues) => {
    setStatus(null);
    const endpoint = isWholesale ? "/api/wholesale" : "/api/contact";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const result = await response.json().catch(() => ({ error: "Your enquiry could not be sent." })) as { message?: string; error?: string };
    if (!response.ok) { setStatus(result.error ?? "Your enquiry could not be sent. Please use WhatsApp instead."); return; }
    setStatus(result.message ?? "Your enquiry has been received.");
    reset();
  };
  const inputField = (name: keyof EnquiryValues, label: string, type = "text") => {
    const error = errors[name];
    const errorId = `enquiry-${name}-error`;
    return <label><span>{label}</span><input type={type} {...register(name)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <small id={errorId} role="alert">{error.message}</small>}</label>;
  };
  return <div className="service-page"><div className="service-lead"><h1>{page.title}</h1><p>{page.intro}</p><ul>{page.points.map((point) => <li key={point}>{point}</li>)}</ul><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I would like help with ${isWholesale ? "a wholesale enquiry" : pathname === "/contact" ? "an enquiry" : "personal shopping"}.`)} target="_blank" rel="noreferrer">Continue on WhatsApp</a></div><form className="service-form" onSubmit={handleSubmit(onSubmit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof EnquiryValues))} noValidate><h2>{isWholesale ? "Wholesale enquiry" : "Send an enquiry"}</h2>{inputField("name", "Name")}{inputField("email", "Email", "email")}{inputField("phone", "Phone", "tel")}{isWholesale && inputField("company", "Company (optional)")}{inputField("subject", "Subject")}<label><span>Message</span><textarea rows={6} {...register("message")} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "enquiry-message-error" : undefined} />{errors.message && <small id="enquiry-message-error" role="alert">{errors.message.message}</small>}</label>{status && <p className="form-message" role="status">{status}</p>}<button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send enquiry"}</button></form></div>;
}
