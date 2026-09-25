import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authenticatedPost } from "../../lib/authenticated-api";
import { supabase } from "../../lib/supabase";

interface Application { id: string; kind: string; legal_name: string; business_name: string | null; country_code: string; phone: string; whatsapp_phone: string; contact_email: string; website: string | null; identity_document_path: string; address_document_path: string; business_document_path: string | null; status: string; review_reason: string | null; submitted_at: string | null; }
interface ListingImage { storage_path: string; alt_text: string; position: number; }
interface Listing { id: string; title: string; description: string; audience: string | null; condition: string; condition_notes: string | null; materials: string | null; item_reference: string | null; price: number; compare_at_price: number | null; currency: string; colors: string[]; sizes: string[]; quantity: number; weight_kg: number; status: string; review_reason: string | null; submitted_at: string | null; store: { name: string } | null; category: { name: string } | null; subcategory: { name: string } | null; images: ListingImage[]; }

function SignedFile({ bucket, path, label, image = false }: { bucket: string; path: string; label: string; image?: boolean }) {
  const query = useQuery({ queryKey: ["signed-file", bucket, path], queryFn: async () => {
    const { data, error } = await supabase!.storage.from(bucket).createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  }, staleTime: 240_000 });
  if (query.isPending) return <span>Loading {label.toLowerCase()}…</span>;
  if (query.error) return <span>{label} unavailable</span>;
  return image ? <img src={query.data} alt={label} /> : <a className="text-link" href={query.data} target="_blank" rel="noreferrer">{label}</a>;
}

export function SellerModeration() {
  const cache = useQueryClient();
  const [tab, setTab] = useState<"applications" | "listings">("applications");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");
  const [status, setStatus] = useState("");
  const [listingNotices, setListingNotices] = useState<Record<string, { message: string; error?: boolean }>>({});
  const applications = useQuery({ queryKey: ["admin", "seller-applications"], queryFn: async () => {
    const { data, error } = await supabase!.from("seller_applications").select("*").order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data as Application[]).map((application) => ({
      ...application,
      phone: `Calls: ${application.phone} · WhatsApp: ${application.whatsapp_phone}`
    }));
  } });
  const listings = useQuery({ queryKey: ["admin", "seller-listings"], queryFn: async () => {
    const { data, error } = await supabase!.from("seller_listings").select("id,title,description,audience,condition,condition_notes,materials,item_reference,price,compare_at_price,currency,colors,sizes,quantity,weight_kg,status,review_reason,submitted_at,store:seller_stores(name),category:categories!seller_listings_category_id_fkey(name),subcategory:categories!seller_listings_subcategory_id_fkey(name),images:seller_listing_images(storage_path,alt_text,position)").order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data as unknown as Listing[];
  } });

  async function reviewApplication(id: string, decision: "approved" | "rejected" | "suspended") {
    const reason = reasons[id]?.trim() || null;
    if (decision !== "approved" && !reason) { setStatus("Add a clear reason before rejecting or suspending a seller."); return; }
    setWorking(id); setStatus("");
    try {
      await authenticatedPost("/api/seller", { action: "review-application", applicationId: id, decision, reason });
      setStatus(`Seller ${decision}.`); await cache.invalidateQueries({ queryKey: ["admin", "seller-applications"] });
    } catch (error) { setStatus(error instanceof Error ? error.message : "The seller review could not be completed."); }
    finally { setWorking(""); }
  }

  async function reviewListing(listing: Listing, decision: "approved" | "rejected" | "suspended") {
    const reason = reasons[listing.id]?.trim() || null;
    if (decision !== "approved" && !reason) { setListingNotices((current) => ({ ...current, [listing.id]: { message: "Add a clear reason before rejecting or suspending this listing.", error: true } })); return; }
    setWorking(listing.id); setListingNotices((current) => ({ ...current, [listing.id]: { message: decision === "approved" ? "Publishing product and images…" : "Saving review…" } }));
    try {
      await authenticatedPost("/api/seller-listing-review", { listingId: listing.id, decision, reason });
      setListingNotices((current) => ({ ...current, [listing.id]: { message: `Listing ${decision}.` } }));
      await Promise.all([cache.invalidateQueries({ queryKey: ["admin", "seller-listings"] }), cache.invalidateQueries({ queryKey: ["catalog"] })]);
    } catch (error) { setListingNotices((current) => ({ ...current, [listing.id]: { message: error instanceof Error ? error.message : "The listing review could not be completed.", error: true } })); }
    finally { setWorking(""); }
  }

  const pendingApplications = applications.data?.filter((item) => item.status === "pending").length ?? 0;
  const pendingListings = listings.data?.filter((item) => item.status === "pending").length ?? 0;
  return <section className="admin-workspace seller-moderation"><header><div><h2>Seller review</h2><span>Identity and listings require management approval.</span></div></header><div className="seller-review-tabs" role="tablist" aria-label="Seller review queue"><button role="tab" aria-selected={tab === "applications"} onClick={() => setTab("applications")}>Verification ({pendingApplications})</button><button role="tab" aria-selected={tab === "listings"} onClick={() => setTab("listings")}>Listings ({pendingListings})</button></div>{status && <p className="form-message" role="status">{status}</p>}
    {tab === "applications" ? applications.isPending ? <p role="status">Loading verification queue…</p> : applications.error ? <p role="alert">Verification requests could not load.</p> : <div className="seller-review-queue">{applications.data?.map((application) => <article key={application.id}><header><div><h3>{application.legal_name}</h3><p>{application.business_name || "Individual seller"} · {application.country_code}</p></div><span className={`seller-status seller-status--${application.status}`}>{application.status}</span></header><dl><div><dt>Type</dt><dd>{application.kind}</dd></div><div><dt>Contact</dt><dd><a href={`mailto:${application.contact_email}`}>{application.contact_email}</a><br />{application.phone}</dd></div>{application.website && <div><dt>Website</dt><dd><a className="text-link" href={application.website} target="_blank" rel="noreferrer">Open website</a></dd></div>}</dl><div className="seller-document-links"><SignedFile bucket="seller-verification" path={application.identity_document_path} label="Identity document" /><SignedFile bucket="seller-verification" path={application.address_document_path} label="Proof of address" />{application.business_document_path && <SignedFile bucket="seller-verification" path={application.business_document_path} label="Business registration" />}</div>{application.status === "pending" && <ReviewActions id={application.id} reason={reasons[application.id] ?? ""} disabled={working === application.id} onReason={(value) => setReasons((current) => ({ ...current, [application.id]: value }))} onApprove={() => void reviewApplication(application.id, "approved")} onReject={() => void reviewApplication(application.id, "rejected")} />}{application.status === "approved" && <SuspensionAction id={application.id} reason={reasons[application.id] ?? ""} disabled={working === application.id} label="Pause seller" onReason={(value) => setReasons((current) => ({ ...current, [application.id]: value }))} onSuspend={() => void reviewApplication(application.id, "suspended")} />}{application.review_reason && <p className="seller-review-reason">Reason: {application.review_reason}</p>}</article>)}{!applications.data?.length && <p>No seller applications yet.</p>}</div>
    : listings.isPending ? <p role="status">Loading listing queue…</p> : listings.error ? <p role="alert">Seller listings could not load.</p> : <div className="seller-review-queue">{listings.data?.map((listing) => <article key={listing.id} aria-busy={working === listing.id}><header><div><h3>{listing.title}</h3><p>{listing.store?.name ?? "Seller store"} · {listing.currency} {(listing.price / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div><span className={`seller-status seller-status--${listing.status}`}>{listing.status}</span></header><div className="seller-review-thumbs">{listing.images.map((image) => <SignedFile key={image.storage_path} bucket="seller-listing-media" path={image.storage_path} label={image.alt_text} image />)}</div><p>{listing.description}</p><dl><div><dt>For</dt><dd>{listing.audience || "Legacy listing"}</dd></div><div><dt>Category</dt><dd>{[listing.category?.name, listing.subcategory?.name].filter(Boolean).join(" · ") || "Not supplied"}</dd></div><div><dt>Condition</dt><dd>{listing.condition.replaceAll("_", " ")}{listing.condition_notes ? ` · ${listing.condition_notes}` : ""}</dd></div><div><dt>Materials</dt><dd>{listing.materials || "Not supplied"}</dd></div>{listing.item_reference && <div><dt>Reference</dt><dd>{listing.item_reference}</dd></div>}<div><dt>Options</dt><dd>{[listing.colors.join(", "), listing.sizes.join(", ")].filter(Boolean).join(" · ") || "None"}</dd></div><div><dt>Quantity / weight</dt><dd>{listing.quantity} per size · {listing.weight_kg} kg</dd></div>{listing.compare_at_price && <div><dt>Original price</dt><dd>{listing.currency} {(listing.compare_at_price / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</dd></div>}</dl><ListingNotice notice={listingNotices[listing.id]} />{listing.status === "pending" && <ReviewActions id={listing.id} reason={reasons[listing.id] ?? ""} disabled={working === listing.id} onReason={(value) => setReasons((current) => ({ ...current, [listing.id]: value }))} onApprove={() => void reviewListing(listing, "approved")} onReject={() => void reviewListing(listing, "rejected")} />}{listing.status === "approved" && <SuspensionAction id={listing.id} reason={reasons[listing.id] ?? ""} disabled={working === listing.id} label="Take down listing" onReason={(value) => setReasons((current) => ({ ...current, [listing.id]: value }))} onSuspend={() => void reviewListing(listing, "suspended")} />}{listing.review_reason && <p className="seller-review-reason">Reason: {listing.review_reason}</p>}</article>)}{!listings.data?.length && <p>No seller listings yet.</p>}</div>}
  </section>;
}

function ListingNotice({ notice }: { notice: { message: string; error?: boolean } | undefined }) {
  return notice ? <p className="form-message" role={notice.error ? "alert" : "status"}>{notice.message}</p> : null;
}

function ReviewActions({ id, reason, disabled, onReason, onApprove, onReject }: { id: string; reason: string; disabled: boolean; onReason: (value: string) => void; onApprove: () => void; onReject: () => void }) {
  return <div className="seller-review-actions"><label htmlFor={`review-reason-${id}`}>Reason for rejection <small>Required only when rejecting</small></label><textarea id={`review-reason-${id}`} rows={2} value={reason} onChange={(event) => onReason(event.target.value)} disabled={disabled} /><div><button type="button" className="primary-button" onClick={onApprove} disabled={disabled}>{disabled ? "Working…" : "Approve"}</button><button type="button" className="secondary-button" onClick={onReject} disabled={disabled}>Reject</button></div></div>;
}

function SuspensionAction({ id, reason, disabled, label, onReason, onSuspend }: { id: string; reason: string; disabled: boolean; label: string; onReason: (value: string) => void; onSuspend: () => void }) {
  return <div className="seller-review-actions"><label htmlFor={`suspension-reason-${id}`}>Suspension reason <small>Required</small></label><textarea id={`suspension-reason-${id}`} rows={2} value={reason} onChange={(event) => onReason(event.target.value)} disabled={disabled} /><div><button type="button" className="secondary-button" onClick={onSuspend} disabled={disabled}>{disabled ? "Working…" : label}</button></div></div>;
}
