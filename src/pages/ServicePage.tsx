import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { useLocale } from "../context/LocaleContext";
import { usePageMeta } from "../hooks/usePageMeta";
import type { TranslationKey } from "../lib/translations";
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

const copy: Record<string, { title: TranslationKey; intro: TranslationKey; points: TranslationKey[] }> = {
  "/personal-shopping": { title: "service.personalTitle", intro: "service.personalIntro", points: ["service.personalPoint1", "service.personalPoint2", "service.personalPoint3", "service.personalPoint4"] },
  "/wholesale": { title: "service.wholesaleTitle", intro: "service.wholesaleIntro", points: ["service.wholesalePoint1", "service.wholesalePoint2", "service.wholesalePoint3", "service.wholesalePoint4"] },
  "/contact": { title: "service.contactTitle", intro: "service.contactIntro", points: ["service.contactPoint1", "service.contactPoint2", "service.contactPoint3", "service.contactPoint4"] }
};

export function ServicePage() {
  const { pathname, search } = useLocation();
  const { t } = useLocale();
  const page = copy[pathname] ?? copy["/contact"]!;
  const isWholesale = pathname === "/wholesale";
  const [status, setStatus] = useState<string | null>(null);
  const params = new URLSearchParams(search);
  const { register, handleSubmit, reset, setFocus, formState: { errors, isSubmitting } } = useForm<EnquiryValues>({ resolver: zodResolver(enquirySchema), defaultValues: { subject: (params.get("subject") ?? "").slice(0, 160), message: (params.get("message") ?? "").slice(0, 2000) } });
  usePageMeta({ title: `${t(page.title).replace(".", "")} | Fieldio`, description: t(page.intro), canonical: `https://fieldio.shop${pathname}` });

  const onSubmit = async (values: EnquiryValues) => {
    setStatus(null);
    try {
      const response = await fetch(isWholesale ? "/api/wholesale" : "/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({ error: t("service.sendError") })) as { message?: string; error?: string };
      if (!response.ok) { setStatus(result.error ?? t("service.sendError")); return; }
      setStatus(result.message ?? t("service.received"));
      reset();
    } catch { setStatus(t("service.networkError")); }
  };

  const inputField = (name: keyof EnquiryValues, label: string, type = "text") => {
    const error = errors[name];
    const errorId = `enquiry-${name}-error`;
    return <label><span>{label}</span><input type={type} {...register(name)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <small id={errorId} role="alert">{error.message}</small>}</label>;
  };

  return <div className="service-page"><div className="service-lead"><h1>{t(page.title)}</h1><p>{t(page.intro)}</p><ul>{page.points.map((point) => <li key={point}>{t(point)}</li>)}</ul><a className="primary-button" href={createWhatsAppUrl(`Hello Fieldio, I would like help with ${isWholesale ? "a wholesale enquiry" : pathname === "/contact" ? "an enquiry" : "personal shopping"}.`)} target="_blank" rel="noreferrer">{t("service.continueWhatsApp")}</a></div><form className="service-form" onSubmit={handleSubmit(onSubmit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof EnquiryValues))} noValidate><h2>{t(isWholesale ? "service.wholesaleEnquiry" : "service.sendEnquiry")}</h2>{inputField("name", t("service.name"))}{inputField("email", t("account.email"), "email")}{inputField("phone", t("account.phone"), "tel")}{isWholesale && inputField("company", t("service.company"))}{inputField("subject", t("service.subject"))}<label><span>{t("service.message")}</span><textarea rows={6} {...register("message")} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "enquiry-message-error" : undefined} />{errors.message && <small id="enquiry-message-error" role="alert">{errors.message.message}</small>}</label>{status && <p className="form-message" role="status">{status}</p>}<button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? t("service.sending") : t("service.send")}</button></form></div>;
}
