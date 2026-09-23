import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { REVIEW_TAG_LABELS, signReviewImages, type ReviewTag } from "../../lib/reviews";
import { supabase } from "../../lib/supabase";
import { CheckSealIcon, StarIcon } from "../Icons";

interface ModerationReview {
  id: string; rating: number; review_text: string; reviewer_name: string; tags: ReviewTag[]; verified_purchase: boolean;
  status: "published" | "hidden"; moderation_reason: string | null; created_at: string; helpful_count: number;
  product: { name: string } | null; images: Array<{ id: string; storage_path: string; position: number; url: string }>;
  reports: Array<{ id: string; reason: string; status: string; created_at: string }>;
}

const PAGE_SIZE = 20;

export function ReviewModeration() {
  const cache = useQueryClient();
  const [filter, setFilter] = useState<"reported" | "all" | "hidden">("reported");
  const [page, setPage] = useState(0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["admin", "product-reviews", filter, page], queryFn: async () => {
    const reports = filter === "reported" ? "reports:product_review_reports!inner(id,reason,status,created_at)" : "reports:product_review_reports(id,reason,status,created_at)";
    let request = supabase!.from("product_reviews").select(`id,rating,review_text,reviewer_name,tags,verified_purchase,status,moderation_reason,created_at,helpful_count,product:products(name),images:product_review_images(id,storage_path,position),${reports}`, { count: "exact" }).order("created_at", { ascending: false });
    if (filter === "reported") request = request.eq("reports.status", "open");
    if (filter === "hidden") request = request.eq("status", "hidden");
    const { data, error, count } = await request.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    const reviews = data as unknown as ModerationReview[];
    const signedImages = await signReviewImages(supabase!, reviews.flatMap((review) => review.images));
    const imagesById = new Map(signedImages.map((image) => [image.id, image]));
    return { reviews: reviews.map((review) => ({ ...review, images: review.images.map((image) => imagesById.get(image.id) ?? { ...image, url: "" }) })), count: count ?? 0 };
  } });
  const reviews = query.data?.reviews ?? [];

  const moderate = async (review: ModerationReview, decision: "hide" | "restore") => {
    const reason = reasons[review.id]?.trim() || null;
    if (decision === "hide" && !reason) { setNotice("Add a moderation reason before hiding a review."); return; }
    setWorking(review.id); setNotice("");
    const { error } = await supabase!.rpc("moderate_product_review", { p_review_id: review.id, p_decision: decision, p_reason: reason });
    if (error) setNotice(error.message);
    else { setNotice(decision === "hide" ? "Review hidden." : "Review restored."); await cache.invalidateQueries({ queryKey: ["admin", "product-reviews"] }); }
    setWorking("");
  };

  return <section className="admin-workspace review-moderation"><header><div><h2>Review moderation</h2><span>Reported customer feedback and publication status.</span></div></header><div className="seller-review-tabs" role="tablist" aria-label="Review moderation filters"><button role="tab" aria-selected={filter === "reported"} onClick={() => { setFilter("reported"); setPage(0); }}>Reported</button><button role="tab" aria-selected={filter === "all"} onClick={() => { setFilter("all"); setPage(0); }}>All reviews</button><button role="tab" aria-selected={filter === "hidden"} onClick={() => { setFilter("hidden"); setPage(0); }}>Hidden</button></div>{notice && <p className="form-message" role="status">{notice}</p>}
    {query.isPending ? <p role="status">Loading review queue…</p> : query.error ? <p role="alert">The review queue could not load.</p> : <><div className="review-moderation-list">{reviews.map((review) => <article key={review.id}><header><div><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <StarIcon key={star} className={star <= review.rating ? "filled" : "empty"} />)}</span><h3>{review.product?.name ?? "Product"}</h3><p>{review.reviewer_name}{review.verified_purchase && <span className="verified-review"><CheckSealIcon />Verified purchase</span>}</p></div><span className={`seller-status seller-status--${review.status === "hidden" ? "suspended" : "approved"}`}>{review.status}</span></header><p>{review.review_text}</p>{review.tags.length > 0 && <ul className="review-card-tags">{review.tags.map((tag) => <li key={tag}>{REVIEW_TAG_LABELS[tag] ?? tag}</li>)}</ul>}{review.images.some((image) => image.url) && <div className="review-moderation-images">{review.images.filter((image) => image.url).map((image, index) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={`Review evidence ${index + 1}`} /></a>)}</div>}{review.reports.length > 0 && <div className="review-report-list"><strong>Reports</strong>{review.reports.map((report) => <p key={report.id}>{report.reason.replaceAll("_", " ")} · {report.status}</p>)}</div>}<div className="seller-review-actions"><label htmlFor={`moderation-reason-${review.id}`}>Moderation reason <small>Required when hiding</small></label><textarea id={`moderation-reason-${review.id}`} rows={2} value={reasons[review.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [review.id]: event.target.value }))} disabled={working === review.id} />{review.status === "published" ? <button type="button" className="secondary-button" disabled={working === review.id} onClick={() => void moderate(review, "hide")}>{working === review.id ? "Working…" : "Hide review"}</button> : <button type="button" className="primary-button" disabled={working === review.id} onClick={() => void moderate(review, "restore")}>{working === review.id ? "Working…" : "Restore review"}</button>}</div>{review.moderation_reason && <p className="seller-review-reason">Current reason: {review.moderation_reason}</p>}</article>)}{!reviews.length && <p>No reviews in this view.</p>}</div>{(query.data?.count ?? 0) > PAGE_SIZE && <nav className="review-moderation-pagination" aria-label="Review moderation pages"><button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil((query.data?.count ?? 0) / PAGE_SIZE)}</span><button type="button" className="secondary-button" disabled={(page + 1) * PAGE_SIZE >= (query.data?.count ?? 0)} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}</>}
  </section>;
}
