import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { REVIEW_TAG_LABELS, type ReviewTag } from "../../lib/reviews";
import { supabase } from "../../lib/supabase";
import { CheckSealIcon, StarIcon } from "../Icons";

interface ModerationReview {
  id: string; rating: number; review_text: string; reviewer_name: string; tags: ReviewTag[]; verified_purchase: boolean;
  status: "published" | "hidden"; moderation_reason: string | null; created_at: string; helpful_count: number;
  product: { name: string } | null; images: Array<{ id: string; storage_path: string; position: number }>;
  reports: Array<{ id: string; reason: string; status: string; created_at: string }>;
}

export function ReviewModeration() {
  const cache = useQueryClient();
  const [filter, setFilter] = useState<"reported" | "all" | "hidden">("reported");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["admin", "product-reviews"], queryFn: async () => {
    const { data, error } = await supabase!.from("product_reviews").select("id,rating,review_text,reviewer_name,tags,verified_purchase,status,moderation_reason,created_at,helpful_count,product:products(name),images:product_review_images(id,storage_path,position),reports:product_review_reports(id,reason,status,created_at)").order("created_at", { ascending: false });
    if (error) throw error;
    return data as unknown as ModerationReview[];
  } });
  const reviews = (query.data ?? []).filter((review) => filter === "all" || filter === "hidden" ? filter === "all" || review.status === "hidden" : review.reports.some((report) => report.status === "open"));

  const moderate = async (review: ModerationReview, decision: "hide" | "restore") => {
    const reason = reasons[review.id]?.trim() || null;
    if (decision === "hide" && !reason) { setNotice("Add a moderation reason before hiding a review."); return; }
    setWorking(review.id); setNotice("");
    const { error } = await supabase!.rpc("moderate_product_review", { p_review_id: review.id, p_decision: decision, p_reason: reason });
    if (error) setNotice(error.message);
    else { setNotice(decision === "hide" ? "Review hidden." : "Review restored."); await cache.invalidateQueries({ queryKey: ["admin", "product-reviews"] }); }
    setWorking("");
  };

  return <section className="admin-workspace review-moderation"><header><div><h2>Review moderation</h2><span>Reported customer feedback and publication status.</span></div></header><div className="seller-review-tabs" role="tablist" aria-label="Review moderation filters"><button role="tab" aria-selected={filter === "reported"} onClick={() => setFilter("reported")}>Reported ({query.data?.filter((review) => review.reports.some((report) => report.status === "open")).length ?? 0})</button><button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>All reviews</button><button role="tab" aria-selected={filter === "hidden"} onClick={() => setFilter("hidden")}>Hidden</button></div>{notice && <p className="form-message" role="status">{notice}</p>}
    {query.isPending ? <p role="status">Loading review queue…</p> : query.error ? <p role="alert">The review queue could not load.</p> : <div className="review-moderation-list">{reviews.map((review) => <article key={review.id}><header><div><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <StarIcon key={star} className={star <= review.rating ? "filled" : "empty"} />)}</span><h3>{review.product?.name ?? "Product"}</h3><p>{review.reviewer_name}{review.verified_purchase && <span className="verified-review"><CheckSealIcon />Verified purchase</span>}</p></div><span className={`seller-status seller-status--${review.status === "hidden" ? "suspended" : "approved"}`}>{review.status}</span></header><p>{review.review_text}</p>{review.tags.length > 0 && <ul className="review-card-tags">{review.tags.map((tag) => <li key={tag}>{REVIEW_TAG_LABELS[tag] ?? tag}</li>)}</ul>}{review.images.length > 0 && <div className="review-moderation-images">{review.images.map((image, index) => <a key={image.id} href={supabase!.storage.from("review-media").getPublicUrl(image.storage_path).data.publicUrl} target="_blank" rel="noreferrer"><img src={supabase!.storage.from("review-media").getPublicUrl(image.storage_path).data.publicUrl} alt={`Review evidence ${index + 1}`} /></a>)}</div>}{review.reports.length > 0 && <div className="review-report-list"><strong>Reports</strong>{review.reports.map((report) => <p key={report.id}>{report.reason.replaceAll("_", " ")} · {report.status}</p>)}</div>}<div className="seller-review-actions"><label htmlFor={`moderation-reason-${review.id}`}>Moderation reason <small>Required when hiding</small></label><textarea id={`moderation-reason-${review.id}`} rows={2} value={reasons[review.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [review.id]: event.target.value }))} disabled={working === review.id} />{review.status === "published" ? <button type="button" className="secondary-button" disabled={working === review.id} onClick={() => void moderate(review, "hide")}>{working === review.id ? "Working…" : "Hide review"}</button> : <button type="button" className="primary-button" disabled={working === review.id} onClick={() => void moderate(review, "restore")}>{working === review.id ? "Working…" : "Restore review"}</button>}</div>{review.moderation_reason && <p className="seller-review-reason">Current reason: {review.moderation_reason}</p>}</article>)}{!reviews.length && <p>No reviews in this view.</p>}</div>}
  </section>;
}
