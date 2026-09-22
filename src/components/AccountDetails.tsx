import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { AccountIcon, ArrowIcon, BagIcon, EmailIcon, HeartIcon, PlusIcon } from "./Icons";
import { MfaSettings } from "./MfaSecurity";
import { useLocale } from "../context/LocaleContext";
import type { AccountRole } from "../hooks/useAccountRole";
import { authenticatedPost } from "../lib/authenticated-api";
import { supabase } from "../lib/supabase";
import type { TranslationKey } from "../lib/translations";
import { IMAGE_UPLOAD_TYPES, MAX_PROFILE_IMAGE_BYTES, validateUpload } from "../lib/uploads";
import { createWhatsAppUrl } from "../lib/whatsapp";

const detailsSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  line1: z.string().trim().min(3, "Enter your street address.").max(150),
  city: z.string().trim().min(2, "Enter your city.").max(100),
  postal_code: z.string().trim().max(30),
  country_code: z.string().trim().length(2, "Use a two-letter country code.").transform((value) => value.toUpperCase())
});
type Details = z.infer<typeof detailsSchema>;
type AccountIntent = "buy" | "sell";
type AccountView = "overview" | "orders" | "details";
interface Order { id: string; public_reference: string; status: string; created_at: string; subtotal: number | null; currency: string; order_items: Array<{ id: string; product_name: string; quantity: number; size: string | null }> }

const orderStatusKeys: Record<string, TranslationKey> = {
  order_request: "account.status.request",
  awaiting_confirmation: "account.status.awaiting",
  confirmed: "account.status.confirmed",
  processing: "account.status.processing",
  shipped: "account.status.shipped",
  delivered: "account.status.delivered",
  cancelled: "account.status.cancelled"
};
const orderSteps = ["order_request", "confirmed", "processing", "shipped", "delivered"] as const;

export function AccountDetails({ userId, email, avatarUrl = "", accountRole = "buyer" }: { userId: string; email: string; avatarUrl?: string; accountRole?: Exclude<AccountRole, "admin"> }) {
  const { formatMoney, language, t } = useLocale();
  const cache = useQueryClient();
  const [view, setView] = useState<AccountView>("overview");
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState<{ reference: string; state: "copied" | "error" } | null>(null);
  const [savingIntent, setSavingIntent] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const details = useQuery({ queryKey: ["account-details", userId], queryFn: async () => {
    const [profile, address] = await Promise.all([
      supabase!.from("profiles").select("full_name,phone,avatar_url,account_intent").eq("id", userId).maybeSingle(),
      supabase!.from("addresses").select("*").eq("user_id", userId).eq("is_default", true).maybeSingle()
    ]);
    if (profile.error || address.error) throw profile.error || address.error;
    return { profile: profile.data, address: address.data };
  } });
  const orders = useQuery({ queryKey: ["account-orders", userId], enabled: view === "orders", queryFn: async () => {
    const { data, error } = await supabase!.from("order_requests").select("id,public_reference,status,created_at,subtotal,currency,order_items(id,product_name,quantity,size)").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data as Order[];
  } });
  const { register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<Details>({ resolver: zodResolver(detailsSchema), values: {
    full_name: details.data?.profile?.full_name || "",
    phone: details.data?.profile?.phone || "",
    line1: details.data?.address?.line1 || "",
    city: details.data?.address?.city || "",
    postal_code: details.data?.address?.postal_code || "",
    country_code: details.data?.address?.country_code || ""
  } });

  useEffect(() => { if (view !== "overview") viewHeading.current?.focus(); }, [view]);

  async function selectIntent(accountIntent: AccountIntent) {
    setSavingIntent(true);
    setStatus("");
    const { error } = await supabase!.from("profiles").update({ account_intent: accountIntent }).eq("id", userId);
    setSavingIntent(false);
    if (error) { setStatus(t("account.choiceError")); return; }
    await cache.invalidateQueries({ queryKey: ["account-details", userId] });
  }

  async function save(values: Details) {
    setStatus("");
    const profile = await supabase!.from("profiles").update({ full_name: values.full_name, phone: values.phone }).eq("id", userId);
    if (profile.error) { setStatus(t("account.saveError")); return; }
    const address = await supabase!.from("addresses").upsert({ ...(details.data?.address?.id ? { id: details.data.address.id } : {}), user_id: userId, recipient_name: values.full_name, phone: values.phone, line1: values.line1, city: values.city, postal_code: values.postal_code, country_code: values.country_code, is_default: true });
    if (address.error) { setStatus(t("account.addressError")); return; }
    await cache.invalidateQueries({ queryKey: ["account-details", userId] });
    setStatus(t("account.saved"));
  }

  async function saveAvatar(avatar: string) {
    const { error } = await supabase!.from("profiles").update({ avatar_url: avatar }).eq("id", userId);
    if (error) throw error;
    await cache.invalidateQueries({ queryKey: ["account-details", userId] });
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    const validation = validateUpload(file, IMAGE_UPLOAD_TYPES, MAX_PROFILE_IMAGE_BYTES);
    if (validation) { setPhotoStatus(validation); return; }
    setSavingPhoto(true); setPhotoStatus("");
    try {
      const path = `${userId}/avatar`;
      const upload = await supabase!.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: true });
      if (upload.error) throw upload.error;
      const publicUrl = supabase!.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
      await saveAvatar(`${publicUrl}?v=${Date.now()}`);
      setPhotoStatus("Profile photo updated.");
    } catch (error) { setPhotoStatus(error instanceof Error ? error.message : "Your profile photo could not be updated."); }
    finally { setSavingPhoto(false); }
  }

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      setCopyStatus({ reference, state: "copied" });
    } catch {
      setCopyStatus({ reference, state: "error" });
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") { setStatus("Type DELETE exactly to confirm account deletion."); return; }
    setDeletingAccount(true); setStatus("");
    try {
      await authenticatedPost("/api/account", { action: "delete-account", confirmation: deleteConfirmation });
      cache.clear();
      window.location.assign("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your account could not be deleted. Try again.");
      setDeletingAccount(false);
    }
  }

  if (details.isPending) return <div className="route-loading" role="status">{t("common.loading")}…</div>;
  if (details.error) return <div className="account-load-error" role="alert"><p>{t("account.detailsError")}</p><button className="primary-button" onClick={() => void details.refetch()}>{t("account.retry")}</button></div>;
  if (!details.data.profile?.account_intent) return <section className="account-intent" aria-labelledby="account-intent-title">
    <div><p className="account-intent-brand">Fieldio</p><h1 id="account-intent-title">{t("account.intentTitle")}</h1><p>{t("account.intentCopy")}</p></div>
    <div className="account-intent-options">
      <button type="button" onClick={() => void selectIntent("buy")} disabled={savingIntent}><BagIcon /><strong>{t("account.wantBuy")}</strong><span>{t("account.buyCopy")}</span></button>
      <button type="button" onClick={() => void selectIntent("sell")} disabled={savingIntent}><PlusIcon /><strong>{t("account.wantSell")}</strong><span>{t("account.sellCopy")}</span></button>
    </div>
    {status && <p className="form-message" role="status">{status}</p>}
  </section>;

  const profileName = details.data.profile.full_name || email.split("@")[0] || "Fieldio customer";
  const profileAvatar = details.data.profile.avatar_url || avatarUrl;
  const intent = details.data.profile.account_intent as AccountIntent;

  const showOverview = () => setView("overview");
  return <div className="customer-account">
    {view === "overview" ? <>
      <header className="account-identity">
        <div className="account-avatar">{profileAvatar ? <img src={profileAvatar} alt="" referrerPolicy="no-referrer" /> : <AccountIcon />}</div>
        <h1>{profileName}</h1><p>{email}</p><span className="account-role">{accountRole === "seller" ? "Verified seller" : "Buyer account"}</span>
      </header>
      <section className="account-seller-card">
        <div><h2>{accountRole === "seller" ? "Manage your seller store" : t(intent === "sell" ? "account.readySell" : "account.interestedSell")}</h2><p>{accountRole === "seller" ? "Review your products, add listings, and follow their approval status." : t(intent === "sell" ? "account.readySellCopy" : "account.interestedSellCopy")}</p></div>
        <Link className="text-link" to="/sell">{accountRole === "seller" ? "Open dashboard" : t("account.getStarted")}</Link>
      </section>
      <nav className="account-menu" aria-label={t("account.yourAccount")}>
        <button type="button" onClick={() => setView("orders")}><BagIcon /><span>{t("account.myRequests")}</span><ArrowIcon /></button>
        <Link to="/wishlist"><HeartIcon /><span>{t("nav.wishlist")}</span><ArrowIcon /></Link>
        <button type="button" onClick={() => setView("details")}><AccountIcon /><span>{t("account.myDetails")}</span><ArrowIcon /></button>
        <Link to="/contact"><EmailIcon /><span>{t("account.contactFieldio")}</span><ArrowIcon /></Link>
      </nav>
      <button className="account-signout" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setStatus(t("account.signOutError")); else cache.clear(); }}>{t("account.signOut")}</button>
      {status && <p className="form-message" role="status">{status}</p>}
    </> : <>
      <header className="account-view-header"><button className="text-link" type="button" onClick={showOverview}>← {t("account.yourAccount")}</button><h1 ref={viewHeading} tabIndex={-1}>{view === "orders" ? t("account.orderRequests") : t("account.savedInfo")}</h1></header>
      {view === "orders" ? <section className="account-view-content">
        {orders.isPending ? <p role="status">{t("account.loadingRequests")}</p> : orders.error ? <p role="alert">{t("account.requestsError")} <button className="text-link" onClick={() => void orders.refetch()}>{t("account.retry")}</button></p> : orders.data?.length ? orders.data.map((order) => {
          const statusKey = orderStatusKeys[order.status];
          const stepIndex = order.status === "awaiting_confirmation" ? 0 : orderSteps.indexOf(order.status as typeof orderSteps[number]);
          return <article className="account-order" key={order.id}>
            <div className="account-order-heading"><div><div className="account-order-reference"><h2>{order.public_reference}</h2><button className="text-link" type="button" aria-live="polite" onClick={() => void copyReference(order.public_reference)}>{copyStatus?.reference === order.public_reference && copyStatus.state === "copied" ? t("account.referenceCopied") : copyStatus?.reference === order.public_reference && copyStatus.state === "error" ? t("account.copyReferenceError") : t("account.copyReference")}</button></div><p>{statusKey ? t(statusKey) : order.status.replaceAll("_", " ")} · {new Intl.DateTimeFormat(language.locale, { dateStyle: "medium" }).format(new Date(order.created_at))}</p></div>{order.subtotal !== null && <strong>{formatMoney(order.subtotal, order.currency)}</strong>}</div>
            {order.status === "cancelled" ? <p className="account-order-cancelled">{t("account.status.cancelled")}</p> : stepIndex >= 0 && <ol className="account-order-progress" aria-label={t("account.progress")}>{orderSteps.map((step, index) => <li key={step} className={index <= stepIndex ? "complete" : ""} aria-current={index === stepIndex ? "step" : undefined}><span>{t(orderStatusKeys[step]!)}</span></li>)}</ol>}
            <ul>{order.order_items.map((item) => <li key={item.id}>{item.product_name} · {item.size || t("account.variantConfirmed")} · {t("account.quantity")} {item.quantity}</li>)}</ul>
            <div className="account-order-actions">
              <a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like an update on order request ${order.public_reference}.`)} target="_blank" rel="noreferrer">{t("account.continueWhatsApp")}</a>
              {!['delivered', 'cancelled'].includes(order.status) && <><a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like to request a change to order request ${order.public_reference}.`)} target="_blank" rel="noreferrer">Request a change</a><a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like to request cancellation of order request ${order.public_reference}.`)} target="_blank" rel="noreferrer">Request cancellation</a></>}
              {order.status === "shipped" && <a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, please share the delivery tracking for order request ${order.public_reference}.`)} target="_blank" rel="noreferrer">Ask for tracking</a>}
            </div>
          </article>;
        }) : <div className="account-empty"><p><strong>{t("account.noRequests")}</strong><br />{t("account.noRequestsCopy")}</p><Link className="text-link" to="/collections">{t("account.explore")}</Link></div>}
      </section> : <section className="account-view-content">
        <section className="profile-photo-editor" aria-labelledby="profile-photo-title"><div className="account-avatar">{profileAvatar ? <img src={profileAvatar} alt="" referrerPolicy="no-referrer" /> : <AccountIcon />}</div><div><h2 id="profile-photo-title">Profile photo</h2><p>Upload a clear photo, or use the photo from your Google account.</p><div><label className="secondary-button">{savingPhoto ? "Uploading…" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={savingPhoto} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void uploadAvatar(file); }} /></label>{avatarUrl && <button className="text-link" type="button" disabled={savingPhoto} onClick={async () => { setSavingPhoto(true); setPhotoStatus(""); try { await saveAvatar(avatarUrl); setPhotoStatus("Google profile photo selected."); } catch { setPhotoStatus("Your Google profile photo could not be selected."); } finally { setSavingPhoto(false); } }}>Use Google photo</button>}</div><small>JPG, PNG, WebP, or AVIF. Maximum 5 MB.</small>{photoStatus && <p className="form-message profile-photo-status" role="status">{photoStatus}</p>}</div></section>
        <form className="admin-form" onSubmit={handleSubmit(save, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof Details))} noValidate>{([
          ["full_name", t("account.fullName")], ["phone", t("account.phone")], ["line1", t("account.street")], ["city", t("account.city")], ["postal_code", t("account.postal")], ["country_code", t("account.countryCode")]
        ] as const).map(([key, label]) => { const errorId = `details-${key}-error`; return <label key={key}><span>{label}</span><input {...register(key)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? errorId : undefined} />{errors[key] && <small id={errorId} role="alert">{errors[key]?.message}</small>}</label>; })}<button className="primary-button" disabled={isSubmitting}>{t("account.saveDetails")}</button></form>
        <div className="account-preference"><h2>{t("account.preference")}</h2><p>{t("account.preferenceCopy")}</p><div><button type="button" className={intent === "buy" ? "active" : ""} onClick={() => void selectIntent("buy")} disabled={savingIntent}>{t("account.buy")}</button><button type="button" className={intent === "sell" ? "active" : ""} onClick={() => void selectIntent("sell")} disabled={savingIntent}>{t("account.sell")}</button></div></div>
        {status && <p role="status">{status}</p>}
        <div className="account-security"><h2>{t("account.security")}</h2><MfaSettings /><div className="account-security-actions"><button className="text-link" type="button" onClick={async () => { const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` }); setStatus(error ? error.message : t("account.passwordEmail")); }}>{t("account.changePassword")}</button><button className="text-link" type="button" onClick={() => { setShowDelete(true); setStatus(""); }}>{t("account.delete")}</button></div></div>
        {showDelete && <section className="account-delete" aria-labelledby="account-delete-title"><h2 id="account-delete-title">Delete account and seller data</h2><p>This permanently removes your account, seller verification documents, listing media, and seller products. Linked order records are anonymised.</p><label htmlFor="account-delete-confirmation">Type DELETE to confirm</label><input id="account-delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /><div><button className="primary-button" type="button" disabled={deletingAccount || deleteConfirmation !== "DELETE"} onClick={() => void deleteAccount()}>{deletingAccount ? "Deleting…" : "Delete permanently"}</button><button className="text-link" type="button" disabled={deletingAccount} onClick={() => { setShowDelete(false); setDeleteConfirmation(""); }}>Cancel</button></div></section>}
      </section>}
    </>}
  </div>;
}
