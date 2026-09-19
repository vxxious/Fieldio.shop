import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { ArrowIcon, CheckSealIcon, ImageIcon, PlusIcon, StoreIcon } from "../components/Icons";
import { useLocale } from "../context/LocaleContext";
import { usePageMeta } from "../hooks/usePageMeta";
import { useSession } from "../hooks/useSession";
import { internationalPhone, isPhoneCountryCode, nationalPhone, phoneCountryOptions } from "../lib/phone";
import { supabase } from "../lib/supabase";
import { DOCUMENT_UPLOAD_TYPES, IMAGE_UPLOAD_TYPES, uploadExtension, validateUpload } from "../lib/uploads";

type ReviewStatus = "draft" | "pending" | "approved" | "rejected" | "suspended";
type ListingStatus = ReviewStatus | "archived";
interface SellerApplication { id: string; kind: "seller" | "vendor"; legal_name: string; business_name: string | null; country_code: string; phone_country_code: string; phone: string; whatsapp_country_code: string; whatsapp_phone: string; contact_email: string; website: string | null; identity_document_path: string; address_document_path: string; business_document_path: string | null; status: ReviewStatus; review_reason: string | null; }
interface Store { id: string; name: string; slug: string; description: string; contact_email: string; contact_phone_country_code: string; contact_phone: string; contact_whatsapp_country_code: string; contact_whatsapp_phone: string; status: "active" | "suspended"; }
interface Listing { id: string; title: string; price: number; currency: string; status: ListingStatus; review_reason: string | null; published_product_id: string | null; created_at: string; }
interface Category { id: string; parent_id: string | null; name: string; }

const callingCodeOptions = phoneCountryOptions();
const phoneCountrySchema = z.string().refine(isPhoneCountryCode, "Choose a country calling code.");
const nationalPhoneSchema = z.string().trim().regex(/^[0-9 ()-]{6,20}$/, "Enter a valid local number.");
const contactFields = {
  contact_email: z.string().email("Enter a valid email."), phone_country_code: phoneCountrySchema, phone: nationalPhoneSchema,
  whatsapp_country_code: phoneCountrySchema, whatsapp_phone: nationalPhoneSchema
};

const applicationSchema = z.object({
  kind: z.enum(["seller", "vendor"]), legal_name: z.string().trim().min(2, "Enter your legal name.").max(120),
  business_name: z.string().trim().max(120), country_code: z.string().trim().length(2, "Use a two-letter country code.").transform((value) => value.toUpperCase()),
  ...contactFields,
  website: z.union([z.literal(""), z.string().url("Enter a complete website URL.")]), declaration: z.boolean().refine(Boolean, "Accept the verification declaration.")
});
type ApplicationValues = z.infer<typeof applicationSchema>;

const storeSchema = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().min(20, "Add at least 20 characters.").max(2000), ...contactFields });
type StoreValues = z.infer<typeof storeSchema>;
const contactSchema = z.object(contactFields);
type ContactValues = z.infer<typeof contactSchema>;

export const listingSchema = z.object({
  title: z.string().trim().min(2, "Enter a product name.").max(160), description: z.string().trim().min(20, "Add at least 20 characters.").max(5000),
  audience: z.enum(["women", "men", "unisex"], { message: "Choose who this product is for." }),
  category_id: z.string().uuid("Choose a category."), subcategory_id: z.string().uuid("Choose a subcategory."), condition: z.enum(["new_with_tags", "new_without_tags", "excellent", "very_good", "good", "fair"]),
  condition_notes: z.string().trim().min(10, "Describe the product's condition in at least 10 characters.").max(1000), materials: z.string().trim().min(2, "Add the material or composition.").max(500), item_reference: z.string().trim().max(120),
  price: z.number().positive("Enter a price."), compare_at_price: z.union([z.literal(""), z.number().positive()]), currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  colors: z.string().trim().min(1, "Add at least one colour.").max(300), sizes: z.string().trim().min(1, "Add at least one size or enter One size.").max(300), quantity: z.number().int().min(1).max(10000), weight_kg: z.number().positive().max(1000),
  authenticity_confirmed: z.boolean().refine(Boolean, "Confirm authenticity and your authority to sell this product.")
}).superRefine((values, context) => { if (values.compare_at_price !== "" && values.compare_at_price <= values.price) context.addIssue({ code: "custom", path: ["compare_at_price"], message: "The original price must be higher than the selling price." }); });
type ListingValues = z.infer<typeof listingSchema>;

const splitOptions = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
export const subcategoriesFor = (categories: Category[], categoryId: string | undefined) => categories.filter((item) => item.parent_id === categoryId);
export const requiresDefectEvidence = (condition: ListingValues["condition"]) => condition === "good" || condition === "fair";

async function uploadFile(bucket: string, path: string, file: File) {
  const { error } = await supabase!.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? <small id={id} role="alert">{message}</small> : null;
}

function VerificationForm({ userId, email, application, defaultCountryCode, onDone }: { userId: string; email: string; application: SellerApplication | null; defaultCountryCode: string; onDone: () => Promise<void> }) {
  const [identity, setIdentity] = useState<File>();
  const [address, setAddress] = useState<File>();
  const [business, setBusiness] = useState<File>();
  const [status, setStatus] = useState("");
  const { control, register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<ApplicationValues>({ resolver: zodResolver(applicationSchema), defaultValues: {
    kind: application?.kind ?? "seller", legal_name: application?.legal_name ?? "", business_name: application?.business_name ?? "", country_code: application?.country_code ?? defaultCountryCode,
    phone_country_code: application?.phone_country_code ?? application?.country_code ?? defaultCountryCode, phone: nationalPhone(application?.phone_country_code ?? application?.country_code ?? defaultCountryCode, application?.phone),
    whatsapp_country_code: application?.whatsapp_country_code ?? application?.country_code ?? defaultCountryCode, whatsapp_phone: nationalPhone(application?.whatsapp_country_code ?? application?.country_code ?? defaultCountryCode, application?.whatsapp_phone ?? application?.phone),
    contact_email: application?.contact_email ?? email, website: application?.website ?? "", declaration: false
  } });
  const kind = useWatch({ control, name: "kind" });

  async function submit(values: ApplicationValues) {
    setStatus("");
    if (!identity && !application?.identity_document_path) { setStatus("Add a government-issued identity document."); return; }
    if (!address && !application?.address_document_path) { setStatus("Add proof of address."); return; }
    if (kind === "vendor" && !business && !application?.business_document_path) { setStatus("Vendors must add a business registration document."); return; }
    const files = [["identity", identity], ["address", address], ["business", business]] as const;
    for (const [, file] of files) { if (file) { const message = validateUpload(file, DOCUMENT_UPLOAD_TYPES); if (message) { setStatus(message); return; } } }
    const uploaded: string[] = [];
    try {
      const paths: Record<string, string | null> = { identity: application?.identity_document_path ?? null, address: application?.address_document_path ?? null, business: application?.business_document_path ?? null };
      for (const [name, file] of files) if (file) { const path = `${userId}/${name}-${crypto.randomUUID()}.${uploadExtension(file)}`; paths[name] = await uploadFile("seller-verification", path, file); uploaded.push(path); }
      const details = { kind: values.kind, legal_name: values.legal_name, business_name: values.business_name || null, country_code: values.country_code, phone_country_code: values.phone_country_code, phone: internationalPhone(values.phone_country_code, values.phone), whatsapp_country_code: values.whatsapp_country_code, whatsapp_phone: internationalPhone(values.whatsapp_country_code, values.whatsapp_phone), contact_email: values.contact_email, website: values.website || null, identity_document_path: paths.identity!, address_document_path: paths.address!, business_document_path: paths.business, declaration_accepted: true };
      const result = application ? await supabase!.from("seller_applications").update(details).eq("id", application.id) : await supabase!.from("seller_applications").insert({ owner_id: userId, ...details });
      if (result.error) throw result.error;
      const submitted = await supabase!.rpc("submit_seller_application");
      if (submitted.error) throw submitted.error;
      await onDone();
    } catch (error) {
      await Promise.all(uploaded.map((path) => supabase!.storage.from("seller-verification").remove([path])));
      setStatus(error instanceof Error ? error.message : "Verification could not be submitted. Try again.");
    }
  }

  return <section className="seller-panel seller-verification"><header><h1>Seller verification</h1><p>Fieldio reviews every seller before a store can publish. Your documents stay private and are used only for verification.</p></header>
    {application?.status === "rejected" && <div className="seller-state seller-state--warning"><strong>Changes required</strong><p>{application.review_reason}</p></div>}
    <form className="seller-form" onSubmit={handleSubmit(submit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof ApplicationValues))} noValidate>
      <fieldset className="seller-choice"><legend>Account type</legend><label><input type="radio" value="seller" {...register("kind")} /> Individual seller</label><label><input type="radio" value="vendor" {...register("kind")} /> Business vendor</label></fieldset>
      <label><span>Legal name</span><input autoComplete="name" {...register("legal_name")} aria-invalid={!!errors.legal_name} aria-describedby={errors.legal_name ? "seller-legal-error" : undefined} /><FieldError id="seller-legal-error" message={errors.legal_name?.message} /></label>
      <label><span>Business or trading name <small>Optional for individual sellers</small></span><input {...register("business_name")} /></label>
      <label><span>Country of residence or business</span><select {...register("country_code")} aria-invalid={!!errors.country_code} aria-describedby={errors.country_code ? "seller-country-error" : undefined}>{callingCodeOptions.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select><FieldError id="seller-country-error" message={errors.country_code?.message} /></label>
      <label><span>Contact email</span><input type="email" autoComplete="email" {...register("contact_email")} aria-invalid={!!errors.contact_email} aria-describedby={errors.contact_email ? "seller-email-error" : undefined} /><FieldError id="seller-email-error" message={errors.contact_email?.message} /></label>
      <fieldset className="seller-contact"><legend>Contact numbers</legend><div className="seller-form-row"><div className="seller-phone-field"><label><span>Calling code</span><select {...register("phone_country_code")}>{callingCodeOptions.map(({ code, dialCode, name }) => <option key={code} value={code}>{name} ({dialCode})</option>)}</select></label><label><span>Phone calls</span><input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="801 234 5678" {...register("phone")} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "seller-phone-error" : undefined} /></label><FieldError id="seller-phone-error" message={errors.phone?.message} /></div><div className="seller-phone-field"><label><span>WhatsApp country code</span><select {...register("whatsapp_country_code")}>{callingCodeOptions.map(({ code, dialCode, name }) => <option key={code} value={code}>{name} ({dialCode})</option>)}</select></label><label><span>WhatsApp number</span><input type="tel" inputMode="tel" placeholder="801 234 5678" {...register("whatsapp_phone")} aria-invalid={!!errors.whatsapp_phone} aria-describedby={errors.whatsapp_phone ? "seller-whatsapp-error" : undefined} /></label><FieldError id="seller-whatsapp-error" message={errors.whatsapp_phone?.message} /></div></div><small>Choose the country code, then enter the local number without the international prefix.</small></fieldset>
      <label><span>Website <small>Optional</small></span><input type="url" placeholder="https://" {...register("website")} aria-invalid={!!errors.website} aria-describedby={errors.website ? "seller-website-error" : undefined} /><FieldError id="seller-website-error" message={errors.website?.message} /></label>
      <fieldset className="seller-documents"><legend>Private verification documents</legend><label><span>Government-issued ID</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setIdentity(event.target.files?.[0])} />{application?.identity_document_path && !identity && <small>Document already supplied.</small>}</label><label><span>Proof of address</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setAddress(event.target.files?.[0])} />{application?.address_document_path && !address && <small>Document already supplied.</small>}</label>{kind === "vendor" && <label><span>Business registration</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setBusiness(event.target.files?.[0])} />{application?.business_document_path && !business && <small>Document already supplied.</small>}</label>}</fieldset>
      <label className="seller-consent"><input type="checkbox" {...register("declaration")} aria-invalid={!!errors.declaration} /><span>I confirm these details are accurate, I own or am authorised to sell the products I list, and Fieldio may verify the information supplied.</span></label><FieldError id="seller-declaration-error" message={errors.declaration?.message} />
      {status && <p className="form-message" role="alert">{status}</p>}<button className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Submitting verification…" : "Submit for verification"}</button>
    </form>
  </section>;
}

function StoreForm({ userId, application, onDone }: { userId: string; application: SellerApplication; onDone: () => Promise<void> }) {
  const [status, setStatus] = useState("");
  const { register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<StoreValues>({ resolver: zodResolver(storeSchema), defaultValues: {
    contact_email: application.contact_email, phone_country_code: application.phone_country_code, phone: nationalPhone(application.phone_country_code, application.phone),
    whatsapp_country_code: application.whatsapp_country_code, whatsapp_phone: nationalPhone(application.whatsapp_country_code, application.whatsapp_phone)
  } });
  async function submit(values: StoreValues) {
    setStatus("");
    const slug = `${slugify(values.name) || "store"}-${userId.slice(0, 6)}`;
    const { error } = await supabase!.from("seller_stores").insert({ owner_id: userId, name: values.name, description: values.description, contact_email: values.contact_email, contact_phone_country_code: values.phone_country_code, contact_phone: internationalPhone(values.phone_country_code, values.phone), contact_whatsapp_country_code: values.whatsapp_country_code, contact_whatsapp_phone: internationalPhone(values.whatsapp_country_code, values.whatsapp_phone), slug });
    if (error) { setStatus(error.message); return; }
    await onDone();
  }
  return <section className="seller-panel"><header><StoreIcon /><h1>Create your store</h1><p>Your approved store name becomes the brand shown on your products.</p></header><form className="seller-form" onSubmit={handleSubmit(submit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof StoreValues))} noValidate>
    <label><span>Store or brand name</span><input {...register("name")} aria-invalid={!!errors.name} /><FieldError id="store-name-error" message={errors.name?.message} /></label>
    <label><span>Brand description</span><textarea rows={5} {...register("description")} aria-invalid={!!errors.description} /><FieldError id="store-description-error" message={errors.description?.message} /></label>
    <label><span>Contact email</span><input type="email" autoComplete="email" {...register("contact_email")} aria-invalid={!!errors.contact_email} /><FieldError id="store-email-error" message={errors.contact_email?.message} /></label>
    <fieldset className="seller-contact"><legend>Store contact numbers</legend><div className="seller-form-row"><div className="seller-phone-field"><label><span>Calling code</span><select {...register("phone_country_code")}>{callingCodeOptions.map(({ code, dialCode, name }) => <option key={code} value={code}>{name} ({dialCode})</option>)}</select></label><label><span>Phone calls</span><input type="tel" inputMode="tel" autoComplete="tel-national" {...register("phone")} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "store-phone-error" : undefined} /></label><FieldError id="store-phone-error" message={errors.phone?.message} /></div><div className="seller-phone-field"><label><span>WhatsApp country code</span><select {...register("whatsapp_country_code")}>{callingCodeOptions.map(({ code, dialCode, name }) => <option key={code} value={code}>{name} ({dialCode})</option>)}</select></label><label><span>WhatsApp number</span><input type="tel" inputMode="tel" {...register("whatsapp_phone")} aria-invalid={!!errors.whatsapp_phone} aria-describedby={errors.whatsapp_phone ? "store-whatsapp-error" : undefined} /></label><FieldError id="store-whatsapp-error" message={errors.whatsapp_phone?.message} /></div></div></fieldset>
    {status && <p className="form-message" role="alert">{status}</p>}<button className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Creating store…" : "Create store"}</button>
  </form></section>;
}

export function ContactDetailsForm({ application, store, onCancel, onDone }: { application: SellerApplication; store: Store; onCancel: () => void; onDone: () => Promise<void> }) {
  const [status, setStatus] = useState("");
  const { register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: {
    contact_email: store.contact_email || application.contact_email,
    phone_country_code: store.contact_phone_country_code || application.phone_country_code,
    phone: nationalPhone(store.contact_phone_country_code || application.phone_country_code, store.contact_phone || application.phone),
    whatsapp_country_code: store.contact_whatsapp_country_code || application.whatsapp_country_code,
    whatsapp_phone: nationalPhone(store.contact_whatsapp_country_code || application.whatsapp_country_code, store.contact_whatsapp_phone || application.whatsapp_phone)
  } });

  async function submit(values: ContactValues) {
    setStatus("");
    const result = await supabase!.rpc("update_seller_contacts", {
      p_contact_email: values.contact_email,
      p_phone_country_code: values.phone_country_code,
      p_phone: internationalPhone(values.phone_country_code, values.phone),
      p_whatsapp_country_code: values.whatsapp_country_code,
      p_whatsapp_phone: internationalPhone(values.whatsapp_country_code, values.whatsapp_phone)
    });
    if (result.error) { setStatus(result.error.message); return; }
    await onDone();
    setStatus("Contact details updated.");
  }

  return <section className="seller-panel"><header><button type="button" className="text-link" onClick={onCancel}>← Seller dashboard</button><h1>Contact details</h1><p>Update where Fieldio and customers can reach your store. These details do not change your verification status.</p></header><form className="seller-form" onSubmit={handleSubmit(submit, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof ContactValues))} noValidate>
    <label><span>Contact email</span><input type="email" autoComplete="email" {...register("contact_email")} aria-invalid={!!errors.contact_email} aria-describedby={errors.contact_email ? "contact-email-error" : undefined} /><FieldError id="contact-email-error" message={errors.contact_email?.message} /></label>
    <fieldset className="seller-contact"><legend>Phone and WhatsApp</legend><div className="seller-form-row"><div className="seller-phone-field"><label><span>Calling code</span><select {...register("phone_country_code")}>{callingCodeOptions.map(({ code, dialCode, name }) => <option key={code} value={code}>{name} ({dialCode})</option>)}</select></label><label><span>Phone calls</span><input type="tel" inputMode="tel" autoComplete="tel-national" {...register("phone")} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "contact-phone-error" : undefined} /></label><FieldError id="contact-phone-error" message={errors.phone?.message} /></div><div className="seller-phone-field"><label><span>WhatsApp country code</span><select {...register("whatsapp_country_code")}>{callingCodeOptions.map(({ code, dialCode, name }) => <option key={code} value={code}>{name} ({dialCode})</option>)}</select></label><label><span>WhatsApp number</span><input type="tel" inputMode="tel" {...register("whatsapp_phone")} aria-invalid={!!errors.whatsapp_phone} aria-describedby={errors.whatsapp_phone ? "contact-whatsapp-error" : undefined} /></label><FieldError id="contact-whatsapp-error" message={errors.whatsapp_phone?.message} /></div></div></fieldset>
    {status && <p className="form-message" role={status.endsWith("updated.") ? "status" : "alert"}>{status}</p>}<button className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save contact details"}</button>
  </form></section>;
}

function ListingForm({ userId, store, categories, currency, onCancel, onSubmitted }: { userId: string; store: Store; categories: Category[]; currency: string; onCancel: () => void; onSubmitted: (title: string) => Promise<void> }) {
  const [images, setImages] = useState<File[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [status, setStatus] = useState("");
  const roots = categories.filter((item) => !item.parent_id);
  const { control, register, handleSubmit, getValues, setFocus, setValue, formState: { errors, isSubmitting } } = useForm<ListingValues>({ resolver: zodResolver(listingSchema), defaultValues: { audience: "women", condition: "excellent", currency, quantity: 1, colors: "", sizes: "", compare_at_price: "", condition_notes: "", materials: "", item_reference: "", authenticity_confirmed: false } });
  const selectedCategory = useWatch({ control, name: "category_id" });
  const selectedCondition = useWatch({ control, name: "condition" });
  const subcategories = subcategoriesFor(categories, selectedCategory);
  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  useEffect(() => { setValue("subcategory_id", "", { shouldValidate: false }); }, [selectedCategory, setValue]);

  function addImages(files: FileList | null) {
    if (!files) return;
    const next = [...files];
    const invalid = next.find((file) => validateUpload(file, IMAGE_UPLOAD_TYPES));
    if (invalid) { setStatus(validateUpload(invalid, IMAGE_UPLOAD_TYPES)); return; }
    if (images.length + next.length > 8) { setStatus("Add up to 8 product images."); return; }
    setStatus(""); setImages((current) => [...current, ...next]);
  }

  async function submit(values: ListingValues) {
    if (!images.length) { setReviewing(false); setStatus("Add at least one clear product image."); return; }
    if (requiresDefectEvidence(values.condition) && images.length < 2) { setReviewing(false); setStatus("Good and Fair items need an additional close-up image showing the wear or defect."); return; }
    const listingId = crypto.randomUUID();
    const uploaded: string[] = [];
    setStatus("");
    try {
      for (const file of images) { const path = `${userId}/${listingId}/${crypto.randomUUID()}.${uploadExtension(file)}`; uploaded.push(await uploadFile("seller-listing-media", path, file)); }
      const { error: listingError } = await supabase!.from("seller_listings").insert({ id: listingId, owner_id: userId, store_id: store.id, title: values.title, description: values.description, audience: values.audience, category_id: values.category_id, subcategory_id: values.subcategory_id, condition: values.condition, condition_notes: values.condition_notes, materials: values.materials, item_reference: values.item_reference || null, price: Math.round(values.price * 100), compare_at_price: values.compare_at_price === "" ? null : Math.round(values.compare_at_price * 100), currency: values.currency, colors: splitOptions(values.colors), sizes: splitOptions(values.sizes), quantity: values.quantity, weight_kg: values.weight_kg, authenticity_confirmed: values.authenticity_confirmed });
      if (listingError) throw listingError;
      const { error: imageError } = await supabase!.from("seller_listing_images").insert(uploaded.map((path, position) => ({ listing_id: listingId, owner_id: userId, storage_path: path, alt_text: `${values.title}, image ${position + 1}`, position })));
      if (imageError) throw imageError;
      const result = await supabase!.rpc("submit_seller_listing", { p_listing_id: listingId });
      if (result.error) throw result.error;
      await onSubmitted(values.title);
    } catch (error) {
      await Promise.all([supabase!.storage.from("seller-listing-media").remove(uploaded), supabase!.from("seller_listings").delete().eq("id", listingId)]);
      setStatus(error instanceof Error ? error.message : "The listing could not be submitted. Try again.");
    }
  }

  const values = getValues();
  const categoryName = categories.find((item) => item.id === values.category_id)?.name;
  const subcategoryName = categories.find((item) => item.id === values.subcategory_id)?.name;
  if (reviewing) return <section className="seller-panel seller-review"><header><button type="button" className="text-link" onClick={() => setReviewing(false)}>← Edit listing</button><h1>Review listing</h1><p>Confirm every detail before sending it to Fieldio for approval.</p></header><div className="seller-review-grid"><div className="seller-review-images">{previews.map((url, index) => <img key={url} src={url} alt={`Product preview ${index + 1}`} />)}</div><dl><div><dt>Product</dt><dd>{values.title}</dd></div><div><dt>Store</dt><dd>{store.name}</dd></div><div><dt>For</dt><dd>{values.audience}</dd></div><div><dt>Category</dt><dd>{categoryName} · {subcategoryName}</dd></div><div><dt>Price</dt><dd>{values.currency} {Number(values.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}{values.compare_at_price !== "" && <> <s>{values.currency} {Number(values.compare_at_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</s></>}</dd></div><div><dt>Condition</dt><dd>{values.condition.replaceAll("_", " ")} · {values.condition_notes}</dd></div><div><dt>Materials</dt><dd>{values.materials}</dd></div>{values.item_reference && <div><dt>Reference</dt><dd>{values.item_reference}</dd></div>}<div><dt>Options</dt><dd>{values.colors} · {values.sizes}</dd></div><div><dt>Quantity / weight</dt><dd>{values.quantity} per size · {values.weight_kg} kg</dd></div></dl></div><p className="seller-review-copy">{values.description}</p>{status && <p className="form-message" role="alert">{status}</p>}<button type="button" className="primary-button" disabled={isSubmitting} onClick={() => void handleSubmit(submit)()}>{isSubmitting ? "Submitting…" : "Submit listing for review"}</button></section>;

  return <section className="seller-panel"><header><button type="button" className="text-link" onClick={onCancel}>← Seller dashboard</button><h1>Add a product</h1><p>Listings are checked for authenticity, ownership, condition, and image quality before they appear in the shop.</p></header><form className="seller-form" onSubmit={handleSubmit(() => { if (!images.length) { setStatus("Add at least one clear product image."); return; } setReviewing(true); }, (formErrors) => setFocus(Object.keys(formErrors)[0] as keyof ListingValues))} noValidate>
    <fieldset className="seller-media"><legend>Product images</legend><div className="seller-media-actions"><label><ImageIcon /><span>Choose from gallery</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => addImages(event.target.files)} /></label><label><ImageIcon /><span>Take a photo</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" capture="environment" onChange={(event) => addImages(event.target.files)} /></label></div>{previews.length > 0 && <div className="seller-media-preview">{previews.map((url, index) => <figure key={url}><img src={url} alt={`Product preview ${index + 1}`} /><button type="button" onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}>Remove</button></figure>)}</div>}<small>1–8 JPG, PNG, WebP, or AVIF images. Maximum 10 MB each.</small></fieldset>
    <label><span>Product name</span><input {...register("title")} aria-invalid={!!errors.title} aria-describedby={errors.title ? "listing-title-error" : undefined} /><FieldError id="listing-title-error" message={errors.title?.message} /></label>
    <label><span>Description</span><textarea rows={6} {...register("description")} aria-invalid={!!errors.description} aria-describedby={errors.description ? "listing-description-error" : undefined} /><FieldError id="listing-description-error" message={errors.description?.message} /></label>
    <div className="seller-form-row"><label><span>Who is it for?</span><select {...register("audience")} aria-invalid={!!errors.audience} aria-describedby={errors.audience ? "listing-audience-error" : undefined}><option value="women">Women</option><option value="men">Men</option><option value="unisex">Unisex</option></select><FieldError id="listing-audience-error" message={errors.audience?.message} /></label><label><span>Category</span><select {...register("category_id")} aria-invalid={!!errors.category_id} aria-describedby={errors.category_id ? "listing-category-error" : undefined}><option value="">Select category</option>{roots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><FieldError id="listing-category-error" message={errors.category_id?.message} /></label></div>
    <label><span>Subcategory</span><select {...register("subcategory_id")} disabled={!selectedCategory || !subcategories.length} aria-invalid={!!errors.subcategory_id} aria-describedby={errors.subcategory_id ? "listing-subcategory-error" : undefined}><option value="">{selectedCategory ? "Select subcategory" : "Choose a category first"}</option>{subcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><FieldError id="listing-subcategory-error" message={errors.subcategory_id?.message} /></label>
    <div className="seller-form-row"><label><span>Condition</span><select {...register("condition")}><option value="new_with_tags">New with tags</option><option value="new_without_tags">New without tags</option><option value="excellent">Excellent · minimal wear</option><option value="very_good">Very good · light visible wear</option><option value="good">Good · visible disclosed wear</option><option value="fair">Fair · significant disclosed wear</option></select><small>{requiresDefectEvidence(selectedCondition) ? "Add a clear close-up image of every visible flaw." : "Choose the lowest grade that accurately describes the item."}</small></label><label><span>Currency</span><input maxLength={3} readOnly {...register("currency")} /><small>Set from your selected region.</small></label></div>
    <label><span>Condition details</span><textarea rows={3} placeholder="Mention wear, marks, repairs, or missing packaging." {...register("condition_notes")} aria-invalid={!!errors.condition_notes} aria-describedby={errors.condition_notes ? "listing-condition-notes-error" : undefined} /><FieldError id="listing-condition-notes-error" message={errors.condition_notes?.message} /></label>
    <div className="seller-form-row"><label><span>Materials or composition</span><input placeholder="100% cotton" {...register("materials")} aria-invalid={!!errors.materials} aria-describedby={errors.materials ? "listing-materials-error" : undefined} /><FieldError id="listing-materials-error" message={errors.materials?.message} /></label><label><span>Item or style reference <small>Optional</small></span><input placeholder="Style code or model" {...register("item_reference")} /></label></div>
    <div className="seller-form-row seller-price-row"><label><span>Selling price</span><input type="number" min="0.01" step="0.01" {...register("price", { valueAsNumber: true })} aria-invalid={!!errors.price} aria-describedby={errors.price ? "listing-price-error" : undefined} /><FieldError id="listing-price-error" message={errors.price?.message} /></label><label><span>Original price <small>Optional slash price</small></span><input type="number" min="0.01" step="0.01" {...register("compare_at_price", { setValueAs: (value) => value === "" ? "" : Number(value) })} aria-invalid={!!errors.compare_at_price} aria-describedby={errors.compare_at_price ? "listing-compare-error" : undefined} /><FieldError id="listing-compare-error" message={errors.compare_at_price?.message} /></label></div>
    <div className="seller-form-row"><label><span>Colours <small>Comma separated</small></span><input placeholder="Black, Ivory" {...register("colors")} aria-invalid={!!errors.colors} aria-describedby={errors.colors ? "listing-colours-error" : undefined} /><FieldError id="listing-colours-error" message={errors.colors?.message} /></label><label><span>Sizes <small>Comma separated</small></span><input placeholder="S, M, L or One size" {...register("sizes")} aria-invalid={!!errors.sizes} aria-describedby={errors.sizes ? "listing-sizes-error" : undefined} /><FieldError id="listing-sizes-error" message={errors.sizes?.message} /></label></div>
    <div className="seller-form-row"><label><span>Quantity available per size</span><input type="number" min="1" {...register("quantity", { valueAsNumber: true })} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? "listing-quantity-error" : undefined} /><FieldError id="listing-quantity-error" message={errors.quantity?.message} /></label><label><span>Weight (kg)</span><input type="number" min="0.001" step="0.001" {...register("weight_kg", { valueAsNumber: true })} aria-invalid={!!errors.weight_kg} aria-describedby={errors.weight_kg ? "listing-weight-error" : undefined} /><FieldError id="listing-weight-error" message={errors.weight_kg?.message} /></label></div>
    <label className="seller-consent"><input type="checkbox" {...register("authenticity_confirmed")} aria-invalid={!!errors.authenticity_confirmed} aria-describedby={errors.authenticity_confirmed ? "listing-authenticity-error" : undefined} /><span>I confirm this item is authentic, the details are accurate, and I am authorised to sell it.</span></label><FieldError id="listing-authenticity-error" message={errors.authenticity_confirmed?.message} />
    {status && <p className="form-message" role="alert">{status}</p>}<button className="primary-button">Review listing</button>
  </form></section>;
}

function SellerDashboard({ store, listings, onAdd, onEditContacts }: { store: Store; listings: Listing[]; onAdd: () => void; onEditContacts: () => void }) {
  return <section className="seller-dashboard"><header><div><p>{store.name}</p><h1>Seller dashboard</h1><span>{store.description}</span></div><div className="seller-dashboard-actions"><button className="secondary-button" onClick={onEditContacts}>Edit contact details</button><button className="primary-button" onClick={onAdd}><PlusIcon /> Add product</button></div></header><div className="seller-summary"><div><strong>{listings.length}</strong><span>Total listings</span></div><div><strong>{listings.filter((item) => item.status === "pending").length}</strong><span>In review</span></div><div><strong>{listings.filter((item) => item.status === "approved").length}</strong><span>Live</span></div></div><section className="seller-listings"><h2>Your products</h2>{listings.length ? listings.map((listing) => <article key={listing.id}><div><h3>{listing.title}</h3><p>{listing.currency} {(listing.price / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} · <span className={`seller-status seller-status--${listing.status}`}>{listing.status}</span></p>{listing.review_reason && <small>{listing.review_reason}</small>}</div>{listing.published_product_id && <Link className="text-link" to="/collections">View in shop <ArrowIcon /></Link>}</article>) : <div className="seller-empty"><StoreIcon /><h3>Your store is ready.</h3><p>Add your first product. Fieldio will review it before publication.</p><button className="text-link" onClick={onAdd}>Add a product</button></div>}</section></section>;
}

function SubmittedState({ title, onAdd }: { title: string; onAdd: () => void }) {
  return <section className="seller-success" aria-labelledby="seller-success-title"><CheckSealIcon /><h1 id="seller-success-title">{title} was submitted for review.</h1><p>Fieldio will check the product details, ownership, condition, and images before it goes live.</p><button className="primary-button" onClick={onAdd}>Add another product</button><button className="secondary-button" onClick={() => window.location.reload()}>View dashboard</button><Link className="secondary-button" to="/collections">Explore</Link></section>;
}

export function SellerPage() {
  const { session, loading } = useSession();
  const { region } = useLocale();
  const cache = useQueryClient();
  const [mode, setMode] = useState<"dashboard" | "listing" | "contacts">("dashboard");
  const [submittedTitle, setSubmittedTitle] = useState("");
  usePageMeta({ title: "Sell with Fieldio", description: "Apply to sell verified fashion through your Fieldio store.", canonical: "https://fieldio.shop/sell" });
  const query = useQuery({ queryKey: ["seller-account", session?.user.id], enabled: Boolean(session && supabase), queryFn: async () => {
    const [application, store, listings, categories] = await Promise.all([
      supabase!.from("seller_applications").select("*").eq("owner_id", session!.user.id).maybeSingle(),
      supabase!.from("seller_stores").select("*").eq("owner_id", session!.user.id).maybeSingle(),
      supabase!.from("seller_listings").select("id,title,price,currency,status,review_reason,published_product_id,created_at").eq("owner_id", session!.user.id).order("created_at", { ascending: false }),
      supabase!.from("categories").select("id,parent_id,name").eq("is_active", true).order("name")
    ]);
    const error = application.error || store.error || listings.error || categories.error;
    if (error) throw error;
    return { application: application.data as SellerApplication | null, store: store.data as Store | null, listings: listings.data as Listing[], categories: categories.data as Category[] };
  } });
  const refresh = async () => { await cache.invalidateQueries({ queryKey: ["seller-account", session?.user.id] }); };

  if (loading) return <div className="route-loading" role="status">Loading seller account…</div>;
  if (!session) return <div className="seller-gate"><StoreIcon /><h1>Sell with Fieldio</h1><p>Create an account or sign in before applying. Every seller and vendor is verified before products can be listed.</p><Link className="primary-button" to="/account?mode=signup&returnTo=%2Fsell">Create seller account</Link><Link className="text-link" to="/account?returnTo=%2Fsell">Already have an account? Sign in</Link></div>;
  if (!supabase) return <div className="seller-gate"><h1>Seller services unavailable</h1><p>Please try again later or contact Fieldio.</p><Link className="primary-button" to="/contact">Contact Fieldio</Link></div>;
  if (query.isPending) return <div className="route-loading" role="status">Loading seller account…</div>;
  if (query.error || !query.data) return <div className="seller-gate"><h1>Your seller account could not load.</h1><p>Check your connection and try again.</p><button className="primary-button" onClick={() => void query.refetch()}>Try again</button></div>;
  const { application, store, listings, categories } = query.data;
  if (!application || application.status === "draft" || application.status === "rejected") return <VerificationForm userId={session.user.id} email={session.user.email ?? ""} application={application} defaultCountryCode={region.code} onDone={refresh} />;
  if (application.status === "pending") return <div className="seller-gate"><CheckSealIcon /><h1>Verification in review</h1><p>We are checking your identity and seller details. You will be able to create your store after approval.</p><Link className="text-link" to="/account">Return to account</Link></div>;
  if (application.status === "suspended") return <div className="seller-gate"><h1>Seller access paused</h1><p>{application.review_reason || "Contact Fieldio for help with your seller account."}</p><Link className="primary-button" to="/contact">Contact Fieldio</Link></div>;
  if (!store) return <StoreForm userId={session.user.id} application={application} onDone={refresh} />;
  if (store.status === "suspended") return <div className="seller-gate"><h1>Store access paused</h1><p>Contact Fieldio to review your store status.</p><Link className="primary-button" to="/contact">Contact Fieldio</Link></div>;
  if (submittedTitle) return <SubmittedState title={submittedTitle} onAdd={() => { setSubmittedTitle(""); setMode("listing"); }} />;
  if (mode === "contacts") return <ContactDetailsForm application={application} store={store} onCancel={() => setMode("dashboard")} onDone={refresh} />;
  if (mode === "listing") return <ListingForm userId={session.user.id} store={store} categories={categories} currency={region.currency} onCancel={() => setMode("dashboard")} onSubmitted={async (title) => { await refresh(); setSubmittedTitle(title); }} />;
  return <SellerDashboard store={store} listings={listings} onAdd={() => setMode("listing")} onEditContacts={() => setMode("contacts")} />;
}
