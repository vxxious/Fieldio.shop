import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { authenticatedPost } from "../lib/authenticated-api";
import { optimizeReviewImage, REVIEW_MAX_IMAGES, REVIEW_TAG_LABELS, REVIEW_TAGS, reviewImageError, reviewSchema, reviewVariantLabel, type ReviewTag } from "../lib/reviews";
import { CheckSealIcon, CloseIcon, ImageIcon, StarIcon } from "./Icons";

const PAGE_SIZE = 6;

interface ReviewImage { id: string; storage_path: string; position: number; }
interface Review {
  id: string; product_id: string; buyer_id: string; order_item_id: string; rating: number; review_text: string;
  reviewer_name: string; purchased_variant: string | null; purchased_size: string | null; purchased_color: string | null;
  tags: ReviewTag[]; verified_purchase: boolean; has_photos: boolean; helpful_count: number; created_at: string; updated_at: string;
  images: ReviewImage[];
}
interface Eligibility { order_item_id: string; product_variant_id: string | null; purchased_variant: string | null; purchased_size: string | null; purchased_color: string | null; purchased_at: string; existing_review_id: string | null; }
interface Summary { averageRating: number; total: number; breakdown: Record<string, number>; withPhotos: number; verified: number; tags: Array<{ tag: ReviewTag; count: number }>; }
interface ProductReviewsProps { productId: string; productName: string; averageRating?: number | undefined; ratingCount?: number | undefined; }
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";
type DetailFilter = "all" | "photos" | "verified";
type Sort = "newest" | "helpful";

function Stars({ rating, label }: { rating: number; label?: string }) {
  return <span className="review-stars" aria-label={label ?? `${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <StarIcon key={star} fill={star <= Math.round(rating) ? "currentColor" : "none"} />)}</span>;
}

function imageUrl(path: string) {
  return supabase?.storage.from("review-media").getPublicUrl(path).data.publicUrl ?? "";
}

async function fetchSummary(productId: string): Promise<Summary> {
  if (!supabase) return { averageRating: 0, total: 0, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, withPhotos: 0, verified: 0, tags: [] };
  const { data, error } = await supabase.rpc("product_review_summary", { p_product_id: productId });
  if (error) throw error;
  return data as unknown as Summary;
}

function ReviewLightbox({ images, index, onIndex, onClose }: { images: ReviewImage[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, true, onClose, undefined, undefined, closeRef);
  const image = images[index];
  return createPortal(<div className="review-lightbox" role="dialog" aria-modal="true" aria-label={`Review photo ${index + 1} of ${images.length}`} ref={dialogRef} tabIndex={-1}>
    <button ref={closeRef} className="review-modal-close" type="button" onClick={onClose} aria-label="Close photo viewer"><CloseIcon /></button>
    {image && <img src={imageUrl(image.storage_path)} alt={`Customer review photo ${index + 1}`} />}
    {images.length > 1 && <div className="review-lightbox-nav">
      <button type="button" onClick={() => onIndex((index - 1 + images.length) % images.length)}>Previous</button>
      <span>{index + 1} / {images.length}</span>
      <button type="button" onClick={() => onIndex((index + 1) % images.length)}>Next</button>
    </div>}
  </div>, document.body);
}

function ReviewEditor({ productName, eligibility, review, onClose, onSaved }: { productName: string; eligibility: Eligibility[]; review: Review | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { session } = useSession();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [orderItemId, setOrderItemId] = useState(review?.order_item_id ?? eligibility.find((item) => !item.existing_review_id)?.order_item_id ?? "");
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [reviewText, setReviewText] = useState(review?.review_text ?? "");
  const [tags, setTags] = useState<ReviewTag[]>(review?.tags ?? []);
  const [files, setFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [removedImages, setRemovedImages] = useState<ReviewImage[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach(({ url }) => URL.revokeObjectURL(url)), []);
  useFocusTrap(dialogRef, true, onClose, undefined, undefined, closeRef);
  const visibleExisting = (review?.images ?? []).filter((image) => !removedImages.some((removed) => removed.id === image.id));
  const selectedEligibility = eligibility.find((item) => item.order_item_id === orderItemId);

  const close = useCallback(() => {
    files.forEach(({ url }) => URL.revokeObjectURL(url));
    onClose();
  }, [files, onClose]);

  const chooseFiles = async (chosen: FileList | null) => {
    if (!chosen?.length) return;
    const available = REVIEW_MAX_IMAGES - visibleExisting.length - files.length;
    if (chosen.length > available) { setError(`Add up to ${REVIEW_MAX_IMAGES} photos in total.`); return; }
    const raw = Array.from(chosen);
    const invalid = raw.map(reviewImageError).find(Boolean);
    if (invalid) { setError(invalid); return; }
    setPreparing(true); setError("");
    try {
      const optimized = await Promise.all(raw.map(optimizeReviewImage));
      setFiles((current) => [...current, ...optimized.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare these photos."); }
    finally { setPreparing(false); }
  };

  const save = async () => {
    if (!supabase || !session) return;
    const parsed = reviewSchema.safeParse({ rating, reviewText, tags });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your review."); return; }
    if (!review && !orderItemId) { setError("Choose the delivered item you received."); return; }
    setSaving(true); setError("");
    try {
      const result = review
        ? await supabase.rpc("update_product_review", { p_review_id: review.id, p_rating: parsed.data.rating, p_review_text: parsed.data.reviewText, p_tags: parsed.data.tags })
        : await supabase.rpc("create_product_review", { p_order_item_id: orderItemId, p_rating: parsed.data.rating, p_review_text: parsed.data.reviewText, p_tags: parsed.data.tags });
      if (result.error) throw result.error;
      const saved = result.data as unknown as Review;

      for (const image of removedImages) await authenticatedPost("/api/account", { action: "delete-image", imageId: image.id });
      for (let index = 0; index < files.length; index += 1) {
        setUploading(index + 1);
        const path = `${session.user.id}/${saved.id}/${crypto.randomUUID()}.webp`;
        const reserved = await supabase.rpc("reserve_review_image", { p_review_id: saved.id, p_storage_path: path });
        if (reserved.error) throw reserved.error;
        const uploaded = await supabase.storage.from("review-media").upload(path, files[index]!.file, { contentType: "image/webp", upsert: false });
        if (uploaded.error) {
          const reservation = reserved.data as unknown as ReviewImage;
          await authenticatedPost("/api/account", { action: "delete-image", imageId: reservation.id });
          throw uploaded.error;
        }
      }
      await onSaved();
      toast.success(review ? "Review updated." : "Thank you. Your review is live.");
      close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your review. Try again."); }
    finally { setSaving(false); setUploading(0); }
  };

  return createPortal(<div className="review-modal" role="presentation"><section className="review-editor" role="dialog" aria-modal="true" aria-labelledby="review-editor-title" ref={dialogRef} tabIndex={-1}>
    <header><div><h2 id="review-editor-title">{review ? "Edit your review" : "Review your purchase"}</h2><p>{productName}</p></div><button ref={closeRef} className="review-modal-close" type="button" onClick={close} aria-label="Close review editor"><CloseIcon /></button></header>
    {!review && <label className="review-field">Delivered item<select value={orderItemId} onChange={(event) => setOrderItemId(event.target.value)}><option value="">Select your purchase</option>{eligibility.filter((item) => !item.existing_review_id).map((item) => <option key={item.order_item_id} value={item.order_item_id}>{reviewVariantLabel(item) || "Standard variant"} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.purchased_at))}</option>)}</select></label>}
    {review && <p className="review-editor-variant"><span>Purchased item</span>{reviewVariantLabel(review) || "Standard variant"}</p>}
    {!review && selectedEligibility && <p className="review-editor-variant"><span>Verified purchase</span>{reviewVariantLabel(selectedEligibility) || "Standard variant"}</p>}
    <fieldset className="review-rating-input"><legend>Your rating</legend><div aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={star <= rating ? "is-selected" : undefined} aria-label={`${star} star${star === 1 ? "" : "s"}`} aria-pressed={rating === star} onClick={() => setRating(star)}><StarIcon fill={star <= rating ? "currentColor" : "none"} /></button>)}</div><p className="review-rating-status" aria-live="polite">{rating ? `${rating} out of 5 selected` : "No rating selected"}</p></fieldset>
    <label className="review-field">Your review<textarea value={reviewText} minLength={20} maxLength={3000} rows={6} onChange={(event) => setReviewText(event.target.value)} placeholder="Describe the item you received, its fit, quality, and condition." /><span>{reviewText.length} / 3,000</span></label>
    <fieldset className="review-tag-input"><legend>What stood out? <span>Optional, choose up to 3</span></legend><div>{REVIEW_TAGS.map((tag) => <label key={tag}><input type="checkbox" checked={tags.includes(tag)} disabled={!tags.includes(tag) && tags.length >= 3} onChange={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} /><span>{REVIEW_TAG_LABELS[tag]}</span></label>)}</div></fieldset>
    <div className="review-photo-field"><p>Photos <span>Optional · up to {REVIEW_MAX_IMAGES}</span></p><div className="review-photo-previews">{visibleExisting.map((image) => <figure key={image.id}><img src={imageUrl(image.storage_path)} alt="Existing review upload" /><button type="button" onClick={() => setRemovedImages((current) => [...current, image])} aria-label="Remove this review photo"><CloseIcon /></button></figure>)}{files.map((item, index) => <figure key={item.url}><img src={item.url} alt={`New review upload ${index + 1}`} /><button type="button" onClick={() => { URL.revokeObjectURL(item.url); setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Remove new review photo ${index + 1}`}><CloseIcon /></button></figure>)}</div><label className="review-photo-button"><ImageIcon />{preparing ? "Preparing photos…" : "Add photos"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={preparing || visibleExisting.length + files.length >= REVIEW_MAX_IMAGES} onChange={(event) => void chooseFiles(event.target.files)} /></label></div>
    {uploading > 0 && <div className="review-upload-progress" role="status"><progress value={uploading} max={files.length} />Uploading photo {uploading} of {files.length}</div>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    <footer><button type="button" className="text-link" onClick={close}>Cancel</button><button type="button" className="primary-button" disabled={saving || preparing} onClick={() => void save()}>{saving ? "Saving review…" : review ? "Save changes" : "Publish review"}</button></footer>
  </section></div>, document.body);
}

export function ProductReviews({ productId, productName, averageRating = 0, ratingCount = 0 }: ProductReviewsProps) {
  const { session, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [detailFilter, setDetailFilter] = useState<DetailFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [editorReview, setEditorReview] = useState<Review | "new" | null>(null);
  const [lightbox, setLightbox] = useState<{ images: ReviewImage[]; index: number } | null>(null);

  const summaryQuery = useQuery({ queryKey: ["review-summary", productId], queryFn: () => fetchSummary(productId), initialData: { averageRating, total: ratingCount, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }, withPhotos: 0, verified: ratingCount, tags: [] } });
  const eligibilityQuery = useQuery({
    queryKey: ["review-eligibility", productId, session?.user.id], enabled: Boolean(supabase && session),
    queryFn: async () => { const { data, error } = await supabase!.rpc("review_eligibility", { p_product_id: productId }); if (error) throw error; return data as unknown as Eligibility[]; }
  });
  const reviewsQuery = useInfiniteQuery({
    queryKey: ["product-reviews", productId, ratingFilter, detailFilter, sort], initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!supabase) return { reviews: [] as Review[], count: 0 };
      let request = supabase.from("product_reviews").select("id,product_id,buyer_id,order_item_id,rating,review_text,reviewer_name,purchased_variant,purchased_size,purchased_color,tags,verified_purchase,has_photos,helpful_count,created_at,updated_at,images:product_review_images(id,storage_path,position)", { count: "exact" }).eq("product_id", productId).eq("status", "published");
      if (ratingFilter !== "all") request = request.eq("rating", Number(ratingFilter));
      if (detailFilter === "photos") request = request.eq("has_photos", true);
      if (detailFilter === "verified") request = request.eq("verified_purchase", true);
      request = sort === "helpful" ? request.order("helpful_count", { ascending: false }).order("created_at", { ascending: false }) : request.order("created_at", { ascending: false });
      const { data, error, count } = await request.range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      const reviews = (data ?? []) as unknown as Review[];
      reviews.forEach((review) => review.images.sort((a, b) => a.position - b.position));
      return { reviews, count: count ?? 0 };
    },
    getNextPageParam: (lastPage, pages) => pages.reduce((total, page) => total + page.reviews.length, 0) < lastPage.count ? pages.length * PAGE_SIZE : undefined
  });
  const reviews = useMemo(() => reviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [], [reviewsQuery.data]);
  const reviewIds = useMemo(() => reviews.map((review) => review.id), [reviews]);
  const votesQuery = useQuery({
    queryKey: ["review-votes", session?.user.id, reviewIds.join(",")], enabled: Boolean(supabase && session && reviewIds.length),
    queryFn: async () => { const { data, error } = await supabase!.from("product_review_helpful").select("review_id").in("review_id", reviewIds); if (error) throw error; return new Set((data ?? []).map((vote) => vote.review_id)); }
  });
  const summary = summaryQuery.data;
  const allPhotos = useMemo(() => reviews.flatMap((review) => review.images), [reviews]);
  const canCreate = eligibilityQuery.data?.some((item) => !item.existing_review_id) ?? false;
  const reviewsUnavailable = summaryQuery.isError || reviewsQuery.isError;

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] }),
      queryClient.invalidateQueries({ queryKey: ["review-summary", productId] }),
      queryClient.invalidateQueries({ queryKey: ["review-eligibility", productId] }),
      queryClient.invalidateQueries({ queryKey: ["catalog", "products"] })
    ]);
  }, [productId, queryClient]);

  const helpful = async (review: Review) => {
    if (!session) { toast.error("Sign in to mark a review as helpful."); return; }
    const { error } = await supabase!.rpc("toggle_review_helpful", { p_review_id: review.id });
    if (error) { toast.error(error.message); return; }
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] }), queryClient.invalidateQueries({ queryKey: ["review-votes"] })]);
  };

  const removeReview = async (review: Review) => {
    if (!window.confirm("Delete your review and its photos? This cannot be undone.")) return;
    try {
      await authenticatedPost("/api/account", { action: "delete-review", reviewId: review.id });
      await refresh(); toast.success("Review deleted.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not delete this review."); }
  };

  const report = async (reviewId: string, reason: string) => {
    if (!session) { toast.error("Sign in to report a review."); return; }
    const { error } = await supabase!.rpc("report_product_review", { p_review_id: reviewId, p_reason: reason });
    if (error) toast.error(error.message);
    else toast.success("Report sent to Fieldio.");
  };

  return <section className="product-reviews" id="reviews" aria-labelledby="reviews-title">
    <header className="review-summary"><div><h2 id="reviews-title">Customer reviews</h2>{!reviewsUnavailable && (summary.total > 0 ? <p><strong>{Number(summary.averageRating).toFixed(1)}</strong><Stars rating={Number(summary.averageRating)} /><span>{summary.total} {summary.total === 1 ? "rating" : "ratings"}</span></p> : <p className="review-summary-empty">No reviews yet. Verified buyers can share the first one.</p>)}</div>
      {!reviewsUnavailable && <div className="review-write-action">{sessionLoading ? <span>Checking purchase history…</span> : canCreate ? <button type="button" className="primary-button" onClick={() => setEditorReview("new")}>Write a review</button> : session ? <span>Reviews unlock after a delivered purchase.</span> : <Link className="text-link" to="/account">Sign in to review a purchase</Link>}</div>}
    </header>
    {!reviewsUnavailable && summary.total > 0 && <div className="review-overview">
      <div className="review-breakdown" aria-label="Rating distribution">{[5, 4, 3, 2, 1].map((star) => { const count = summary.breakdown[String(star)] ?? 0; const percent = summary.total ? count / summary.total * 100 : 0; return <button type="button" key={star} aria-pressed={ratingFilter === String(star)} onClick={() => setRatingFilter(ratingFilter === String(star) ? "all" : String(star) as RatingFilter)}><span>{star} star</span><span className="review-breakdown-track"><i style={{ width: `${percent}%` }} /></span><span>{count}</span></button>; })}</div>
      {allPhotos.length > 0 && <div className="review-gallery"><h3>From customers</h3><div>{allPhotos.slice(0, 8).map((image, index) => <button key={image.id} type="button" onClick={() => setLightbox({ images: allPhotos, index })}><img src={imageUrl(image.storage_path)} alt={`Open customer photo ${index + 1}`} loading="lazy" /></button>)}</div></div>}
    </div>}
    {!reviewsUnavailable && summary.tags.length > 0 && <div className="review-summary-tags" aria-label="Common review details">{summary.tags.map(({ tag, count }) => <span key={tag}>{REVIEW_TAG_LABELS[tag] ?? tag.replaceAll("_", " ")} <span>{count}</span></span>)}</div>}
    {!reviewsUnavailable && summary.total > 0 && <div className="review-filters" aria-label="Review filters"><label>Rating<select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value as RatingFilter)}><option value="all">All ratings</option>{[5, 4, 3, 2, 1].map((star) => <option value={star} key={star}>{star} stars</option>)}</select></label><label>Show<select value={detailFilter} onChange={(event) => setDetailFilter(event.target.value as DetailFilter)}><option value="all">All reviews</option><option value="photos">With photos</option><option value="verified">Verified purchases</option></select></label><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="newest">Newest</option><option value="helpful">Most helpful</option></select></label></div>}
    {!reviewsUnavailable && reviewsQuery.isLoading && <div className="review-loading" role="status"><span /><span /><span />Loading reviews…</div>}
    {reviewsUnavailable && <div className="review-error" role="alert"><p>Reviews are temporarily unavailable.</p><button type="button" className="text-link" onClick={() => void Promise.all([summaryQuery.refetch(), reviewsQuery.refetch()])}>Try again</button></div>}
    {!reviewsQuery.isLoading && !reviewsUnavailable && summary.total > 0 && !reviews.length && <div className="review-empty"><p>No reviews match these filters.</p><button type="button" className="text-link" onClick={() => { setRatingFilter("all"); setDetailFilter("all"); }}>Clear filters</button></div>}
    <div className="review-list">{reviews.map((review) => { const own = session?.user.id === review.buyer_id; const voted = votesQuery.data?.has(review.id); return <article className="review-card" key={review.id}>
      <header><div><Stars rating={review.rating} /><p><strong>{review.reviewer_name}</strong>{review.verified_purchase && <span className="verified-review"><CheckSealIcon />Verified purchase</span>}</p></div><time dateTime={review.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(review.created_at))}</time></header>
      {reviewVariantLabel(review) && <p className="review-variant">{reviewVariantLabel(review)}</p>}
      <p className="review-copy">{review.review_text}</p>
      {review.tags.length > 0 && <ul className="review-card-tags" aria-label="Review details">{review.tags.map((tag) => <li key={tag}>{REVIEW_TAG_LABELS[tag] ?? tag}</li>)}</ul>}
      {review.images.length > 0 && <div className="review-card-images">{review.images.map((image, index) => <button type="button" key={image.id} onClick={() => setLightbox({ images: review.images, index })}><img src={imageUrl(image.storage_path)} alt={`Customer photo ${index + 1}`} loading="lazy" /></button>)}</div>}
      <footer><button type="button" aria-pressed={voted} disabled={own} onClick={() => void helpful(review)}>Helpful{review.helpful_count ? ` · ${review.helpful_count}` : ""}</button>{own ? <><button type="button" onClick={() => setEditorReview(review)}>Edit</button><button type="button" onClick={() => void removeReview(review)}>Delete</button></> : <details><summary>Report</summary><div><button type="button" onClick={() => void report(review.id, "spam")}>Spam</button><button type="button" onClick={() => void report(review.id, "abuse")}>Abusive</button><button type="button" onClick={() => void report(review.id, "privacy")}>Privacy</button><button type="button" onClick={() => void report(review.id, "not_about_product")}>Not about product</button></div></details>}</footer>
    </article>; })}</div>
    {reviewsQuery.hasNextPage && <button className="review-load-more" type="button" disabled={reviewsQuery.isFetchingNextPage} onClick={() => void reviewsQuery.fetchNextPage()}>{reviewsQuery.isFetchingNextPage ? "Loading…" : "Load more reviews"}</button>}
    {editorReview && <ReviewEditor productName={productName} eligibility={eligibilityQuery.data ?? []} review={editorReview === "new" ? null : editorReview} onClose={() => setEditorReview(null)} onSaved={refresh} />}
    {lightbox && <ReviewLightbox images={lightbox.images} index={lightbox.index} onIndex={(index) => setLightbox({ ...lightbox, index })} onClose={() => setLightbox(null)} />}
  </section>;
}
