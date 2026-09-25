import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { parseAdminValues, type AdminResource } from "../../lib/admin-resources";
import { authenticatedPost } from "../../lib/authenticated-api";
import { supabase } from "../../lib/supabase";
import { IMAGE_UPLOAD_TYPES, uploadExtension, validateUpload } from "../../lib/uploads";

type Row = Record<string, unknown>;
function display(value: unknown): string { return value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function displayCell(row: Row, key: string): string {
  if (key !== "price" || typeof row.price !== "number") return display(row[key]);
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: String(row.currency || "GBP") }).format(row.price / 100); }
  catch { return display(row.price); }
}

const referenceSources: Record<string, { table: string; label: string }> = {
  brand_id: { table: "brands", label: "name" }, category_id: { table: "categories", label: "name" },
  collection_id: { table: "collections", label: "name" }, parent_id: { table: "categories", label: "name" },
  product_id: { table: "products", label: "name" }, variant_id: { table: "product_variants", label: "sku" }
};
const searchColumns: Record<string, string> = {
  products: "name", product_variants: "sku", brands: "name", categories: "name", collections: "name",
  order_requests: "public_reference", profiles: "full_name", newsletter_subscribers: "email",
  contact_messages: "email", wholesale_inquiries: "company", editorial_content: "page_key"
};

function editorialImage(value: unknown): string {
  if (!value) return "";
  try {
    const content = typeof value === "string" ? JSON.parse(value) as Row : value as Row;
    return typeof content.image === "string" ? content.image : "";
  } catch { return ""; }
}

export function AdminWorkspace({ resource, canDelete = false, onDirtyChange }: { resource: AdminResource; canDelete?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const { register, handleSubmit, reset, setValue, getValues, setError, setFocus, formState: { errors, isDirty, isSubmitting } } = useForm<Row>();
  const query = useQuery({ queryKey: ["admin", resource.table, page, submittedSearch], queryFn: async () => {
    let request = supabase!.from(resource.table).select("*", { count: "exact" }).order(resource.columns[0]!);
    const searchColumn = searchColumns[resource.table];
    if (searchColumn && submittedSearch) request = request.ilike(searchColumn, `%${submittedSearch}%`);
    const { data, error, count } = await request.range(page * 25, page * 25 + 24);
    if (error) throw error;
    return { rows: data as Row[], count: count ?? 0 };
  } });
  const references = useQuery({
    queryKey: ["admin-references", resource.table],
    enabled: editing !== null && resource.fields.some((item) => item.type === "uuid"),
    queryFn: async () => {
      const sources = [...new Map(resource.fields.flatMap((item) => referenceSources[item.key] ? [[item.key, referenceSources[item.key]!]] : [])).entries()];
      const entries = await Promise.all(sources.map(async ([key, source]) => {
        const { data, error } = await supabase!.from(source.table).select(`id,${source.label}`).order(source.label).limit(500);
        if (error) throw error;
        return [key, (data as unknown as Row[]).map((row) => ({ id: String(row.id), label: String(row[source.label]) }))] as const;
      }));
      return Object.fromEntries(entries) as Record<string, Array<{ id: string; label: string }>>;
    }
  });

  useEffect(() => { onDirtyChange?.(Boolean(editing && isDirty)); }, [editing, isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!editing) return;
    editorHeading.current?.scrollIntoView?.({ block: "start" });
    editorHeading.current?.focus({ preventScroll: true });
  }, [editing]);
  useEffect(() => {
    if (!editing || !isDirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [editing, isDirty]);

  function begin(row: Row) {
    if (editing && isDirty && !window.confirm("Discard unsaved changes?")) return;
    setEditing(row); setStatus("");
    const productImage = typeof row.public_url === "string" ? row.public_url : typeof row.storage_path === "string" ? supabase!.storage.from("product-images").getPublicUrl(row.storage_path).data.publicUrl : "";
    setPreviewUrl(resource.table === "product_images" ? productImage : resource.table === "collections" && typeof row.hero_image_url === "string" ? row.hero_image_url : resource.table === "editorial_content" ? editorialImage(row.content) : "");
    const values: Row = {};
    for (const field of resource.fields) {
      const value = row[field.key];
      values[field.key] = field.type === "boolean" ? value ?? field.key === "is_active" : field.type === "json" ? JSON.stringify(value ?? {}, null, 2) : field.type === "tags" ? (Array.isArray(value) ? value.join(", ") : "") : field.type === "datetime-local" ? (value ? String(value).slice(0, 16) : "") : field.type === "money" && typeof value === "number" ? value / 100 : value ?? field.options?.[0] ?? (field.type === "number" && field.required ? 0 : "");
    }
    reset(values);
  }

  async function save(values: Row) {
    setStatus("");
    try {
      const payload = parseAdminValues(resource, values);
      const key = resource.key ?? "id";
      const id = editing?.[key];
      let savedStatus = "Saved.";
      if (id && resource.table === "order_requests") {
        const result = await authenticatedPost<{ emailDelivered: boolean }>("/api/order-status", { orderId: id, status: payload.status });
        if (!result.emailDelivered) savedStatus = "Order updated, but the customer email could not be sent.";
      } else if (id && ["marketplace_returns", "marketplace_disputes"].includes(resource.table)) {
        await authenticatedPost("/api/admin/cases", { caseType: resource.table === "marketplace_returns" ? "return" : "dispute", id, status: payload.status, resolution: payload.resolution });
      } else if (id) {
        let mutation = supabase!.from(resource.table).update(payload).eq(key, id);
        if (resource.table === "collection_products") mutation = mutation.eq("collection_id", editing?.collection_id);
        const result = await mutation;
        if (result.error) throw result.error;
      } else {
        const result = await supabase!.from(resource.table).insert(payload);
        if (result.error) throw result.error;
      }
      await Promise.all([cache.invalidateQueries({ queryKey: ["admin", resource.table] }), cache.invalidateQueries({ queryKey: ["catalog"] })]);
      setEditing(null); setStatus(savedStatus);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstField = error.issues.find((issue) => typeof issue.path[0] === "string")?.path[0];
        error.issues.forEach((issue) => { if (typeof issue.path[0] === "string") setError(issue.path[0], { type: "validate", message: issue.message }); });
        setStatus("Review the highlighted fields.");
        if (typeof firstField === "string") setFocus(firstField);
        return;
      }
      setStatus(error instanceof Error ? error.message : "The record could not be saved. Check the fields and try again.");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (validateUpload(file, IMAGE_UPLOAD_TYPES)) { setStatus("Choose a JPG, PNG, WebP, or AVIF image under 10 MB."); return; }
    let content: Row = {};
    if (resource.table === "editorial_content") {
      try { content = z.record(z.string(), z.unknown()).parse(JSON.parse(String(getValues("content") || "{}"))); }
      catch { setStatus("Fix the section content JSON before uploading an image."); return; }
    }
    setUploading(true); setStatus("Uploading image…");
    try {
      const path = `${crypto.randomUUID()}.${uploadExtension(file)}`;
      const { error } = await supabase!.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const publicUrl = supabase!.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      if (resource.table === "product_images") { setValue("storage_path", path, { shouldDirty: true }); setValue("public_url", publicUrl, { shouldDirty: true }); }
      else if (resource.table === "collections") setValue("hero_image_url", publicUrl, { shouldDirty: true });
      else setValue("content", JSON.stringify({ ...content, image: publicUrl }, null, 2), { shouldDirty: true });
      setPreviewUrl(publicUrl);
      setStatus("Image uploaded. Review the preview and save the record.");
    } catch { setStatus("The upload failed. Please try again."); }
    finally { setUploading(false); }
  }

  async function deleteBrand() {
    const id = editing?.id;
    const name = typeof editing?.name === "string" ? editing.name : "this brand";
    if (!id || resource.table !== "brands" || !window.confirm(`Delete ${name}? Products will remain, but the brand will be removed.`)) return;
    setStatus("");
    const { data, error } = await supabase!.from("brands").delete().eq("id", id).select("id").maybeSingle();
    if (error) { setStatus(error.message); return; }
    if (!data) { setStatus("The brand could not be deleted. Refresh your access and try again."); return; }
    await Promise.all([cache.invalidateQueries({ queryKey: ["admin", "brands"] }), cache.invalidateQueries({ queryKey: ["catalog"] })]);
    setEditing(null); setStatus("Brand deleted.");
  }

  const closeEditor = () => { if (!isDirty || window.confirm("Discard unsaved changes?")) setEditing(null); };
  const searchColumn = searchColumns[resource.table];

  return <section className="admin-workspace">
    <header><h2>{resource.title}</h2>{!resource.readOnly && !resource.noCreate && <button className="primary-button" onClick={() => begin({})}>Add record</button>}</header>
    {searchColumn && <form className="admin-toolbar" role="search" onSubmit={(event) => { event.preventDefault(); setPage(0); setSubmittedSearch(search.trim()); }}><label htmlFor={`admin-search-${resource.table}`} className="sr-only">Search {resource.title}</label><input id={`admin-search-${resource.table}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${resource.title.toLowerCase()}`} /><button type="submit">Search</button>{submittedSearch && <button type="button" className="text-link" onClick={() => { setSearch(""); setSubmittedSearch(""); setPage(0); }}>Clear</button>}</form>}
    {status && <p role="status" className="form-message">{status}</p>}
    {query.isPending ? <p role="status">Loading records…</p> : query.error ? <div role="alert"><p>Records could not load.</p><button onClick={() => void query.refetch()}>Try again</button></div> : <>
      <div className="admin-table-wrap"><table><thead><tr>{resource.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}<th>Record</th></tr></thead><tbody>{query.data.rows.map((row, index) => <tr key={display(row.id ?? row.variant_id ?? index)}>{resource.columns.map((column) => <td key={column} data-label={column.replaceAll("_", " ")}>{displayCell(row, column)}</td>)}<td data-label="Record"><button className="text-link" onClick={() => begin(row)}>{resource.readOnly ? "View" : "Edit"}</button></td></tr>)}</tbody></table></div>
      {!query.data.rows.length && <p>{submittedSearch ? "No matching records." : "No records yet."}</p>}
      <div className="admin-pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} · {query.data.count} records</span><button disabled={(page + 1) * 25 >= query.data.count} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
    {editing && <section className="admin-editor" aria-label="Edit record"><h3 ref={editorHeading} tabIndex={-1}>{editing[resource.key ?? "id"] ? "Record details" : "New record"}</h3>
      {editing.id != null && <p className="admin-id">ID: {display(editing.id)}</p>}
      {(resource.noCreate || resource.readOnly) && <dl className="record-detail">{Object.entries(editing).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{display(value)}</dd></div>)}</dl>}
      {!resource.readOnly && <form onSubmit={handleSubmit(save)} className="admin-form" noValidate>
        {references.error && <p className="form-message" role="alert">Related products, brands, or collections could not load. Close and reopen the editor to retry.</p>}
        {["product_images", "collections", "editorial_content"].includes(resource.table) && <label className="admin-image-upload"><span>{resource.table === "product_images" ? "Upload product photography" : resource.table === "collections" ? "Upload collection hero" : "Upload lookbook image"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} aria-busy={uploading} onChange={(event) => void upload(event.target.files?.[0])} />{previewUrl && previewUrl !== "—" && <img src={previewUrl} alt="Uploaded preview" />}</label>}
        {resource.fields.map((field) => {
          const referenceOptions = references.data?.[field.key];
          const errorId = `admin-${resource.table}-${field.key}-error`;
          const fieldProps = register(field.key);
          const accessibility = { "aria-invalid": Boolean(errors[field.key]), "aria-describedby": errors[field.key] ? errorId : undefined };
          return <label key={field.key}><span>{field.label}</span>{field.options ? <select {...fieldProps} {...accessibility}>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "uuid" && referenceSources[field.key] ? <select {...fieldProps} {...accessibility} disabled={references.isPending || Boolean(references.error)}><option value="">{references.isPending ? "Loading choices…" : references.error ? "Choices unavailable" : field.required ? "Select one" : "None"}</option>{referenceOptions?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : ["textarea", "json"].includes(field.type ?? "") ? <textarea rows={field.type === "json" ? 8 : 3} {...fieldProps} {...accessibility} /> : <input type={field.type === "boolean" ? "checkbox" : field.type === "number" || field.type === "money" ? "number" : field.type === "datetime-local" ? "datetime-local" : "text"} step={field.type === "money" ? "0.01" : undefined} min={field.type === "number" || field.type === "money" ? "0" : undefined} {...fieldProps} {...accessibility} />}{errors[field.key] && <small id={errorId} role="alert">{String(errors[field.key]?.message)}</small>}</label>;
        })}
        <button className="primary-button" disabled={isSubmitting || uploading}>{isSubmitting ? "Saving…" : "Save record"}</button>
      </form>}
      {canDelete && resource.table === "brands" && editing.id != null && <button className="text-link" type="button" onClick={() => void deleteBrand()}>Delete brand</button>}
      <button className="text-link" onClick={closeEditor}>Close editor</button>
    </section>}
  </section>;
}
