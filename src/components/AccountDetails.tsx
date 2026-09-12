import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "../lib/supabase";
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
interface Order { id: string; public_reference: string; status: string; created_at: string; order_items: Array<{ id: string; product_name: string; quantity: number; size: string | null }> }

export function AccountDetails({ userId, email }: { userId: string; email: string }) {
  const cache = useQueryClient();
  const [status, setStatus] = useState("");
  const details = useQuery({ queryKey: ["account-details", userId], queryFn: async () => {
    const [profile, address] = await Promise.all([
      supabase!.from("profiles").select("full_name,phone").eq("id", userId).maybeSingle(),
      supabase!.from("addresses").select("*").eq("user_id", userId).eq("is_default", true).maybeSingle()
    ]);
    if (profile.error || address.error) throw profile.error || address.error;
    return { profile: profile.data, address: address.data };
  } });
  const orders = useQuery({ queryKey: ["account-orders", userId], queryFn: async () => {
    const { data, error } = await supabase!.from("order_requests").select("id,public_reference,status,created_at,order_items(id,product_name,quantity,size)").eq("user_id", userId).order("created_at", { ascending: false });
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

  async function save(values: Details) {
    setStatus("");
    const profile = await supabase!.from("profiles").update({ full_name: values.full_name, phone: values.phone }).eq("id", userId);
    if (profile.error) { setStatus("Your details could not be saved. Please try again."); return; }
    const address = await supabase!.from("addresses").upsert({ ...(details.data?.address?.id ? { id: details.data.address.id } : {}), user_id: userId, recipient_name: values.full_name, phone: values.phone, line1: values.line1, city: values.city, postal_code: values.postal_code, country_code: values.country_code, is_default: true });
    if (address.error) { setStatus("Your profile was saved, but the address could not be saved. Try again."); return; }
    await cache.invalidateQueries({ queryKey: ["account-details", userId] });
    setStatus("Your details have been saved.");
  }

  return <div className="customer-account">
    <header><h1>Your account</h1><p>{email}</p><nav className="account-nav" aria-label="Account"><a href="#details">Profile</a><a href="#orders">Orders</a><Link to="/wishlist">Wishlist</Link></nav><button className="text-link" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setStatus("Sign out failed. Please try again."); else cache.clear(); }}>Sign out</button></header>
    <section id="orders"><h2>Order requests</h2>{orders.isPending ? <p role="status">Loading requests…</p> : orders.error ? <p role="alert">Requests could not load. <button onClick={() => void orders.refetch()}>Try again</button></p> : orders.data?.length ? orders.data.map((order) => <article className="account-order" key={order.id}><div><h3>{order.public_reference}</h3><p>{order.status.replaceAll("_", " ")} · {new Date(order.created_at).toLocaleDateString("en-GB")}</p></div><ul>{order.order_items.map((item) => <li key={item.id}>{item.product_name} · {item.size || "Variant confirmed directly"} · Quantity {item.quantity}</li>)}</ul><a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like an update on order request ${order.public_reference}.`)} target="_blank" rel="noreferrer">Continue conversation on WhatsApp</a></article>) : <div className="account-empty"><p>No order requests yet. Requests made while signed in will appear here.</p><Link className="text-link" to="/collections">Explore the edit</Link></div>}</section>
    <section id="details"><h2>Saved information</h2>{details.error ? <p role="alert">Details could not load. <button onClick={() => void details.refetch()}>Try again</button></p> : <form className="admin-form" onSubmit={handleSubmit(save, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof Details))} noValidate>{([['full_name','Full name'],['phone','Phone number'],['line1','Street address'],['city','City'],['postal_code','Postal code'],['country_code','Country code (GB, US, etc.)']] as const).map(([key, label]) => { const errorId = `details-${key}-error`; return <label key={key}><span>{label}</span><input {...register(key)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? errorId : undefined} />{errors[key] && <small id={errorId} role="alert">{errors[key]?.message}</small>}</label>; })}<button className="primary-button" disabled={isSubmitting || details.isPending}>Save details</button></form>}{status && <p role="status">{status}</p>}<div className="account-security"><h3>Account access</h3><button className="text-link" type="button" onClick={async () => { const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` }); setStatus(error ? error.message : "Check your email to change your password."); }}>Change password</button><a className="text-link" href={createWhatsAppUrl(`Hello Fieldio, I would like to request deletion of the account registered to ${email}.`)} target="_blank" rel="noreferrer">Request account deletion</a></div></section>
  </div>;
}
