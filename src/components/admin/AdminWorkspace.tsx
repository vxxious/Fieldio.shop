import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { parseAdminValues, type AdminResource } from "../../lib/admin-resources";
import { supabase } from "../../lib/supabase";

type Row = Record<string, unknown>;
function display(value: unknown): string { return value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function displayCell(row: Row, key: string): string {
  if (key !== "price" || typeof row.price !== "number") return display(row[key]);
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: String(row.currency || "GBP") }).format(row.price / 100); }
  catch { return display(row.price); }
}
const referenceSources: Record<string, { table: string; label: string }> = {
  brand_id: { table: "brands", label: "name" },
  category_id: { table: "categories", label: "name" },
  collection_id: { table: "collections", label: "name" },
  parent_id: { table: "categories", label: "name" },
  product_id: { table: "products", label: "name" },
  variant_id: { table: "product_variants", label: "sku" }
};

function editorialImage(value: unknown): string {
  if (!value) return "";
  try {
    const content = typeof value === "string" ? JSON.parse(value) as Row : value as Row;
    return typeof content.image === "string" ? content.image : "";
  } catch { return ""; }
}

export function AdminWorkspace({ resource }: { resource: AdminResource }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const { register, handleSubmit, reset, setValue, getValues, formState: { isSubmitting } } = useForm<Row>();
  const query = useQuery({ queryKey: ["admin", resource.table, page], queryFn: async () => {
    const { data, error, count } = await supabase!.from(resource.table).select("*", { count: "exact" }).order(resource.columns[0]!).range(page * 25, page * 25 + 24);
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

  function begin(row: Row) {
    setEditing(row); setStatus("");
    const productImage = typeof row.public_url === "string" ? row.public_url : typeof row.storage_path === "string" ? supabase!.storage.from("product-images").getPublicUrl(row.storage_path).data.publicUrl : "";
    setPreviewUrl(resource.table === "product_images" ? productImage : resource.table === "collections" && typeof row.hero_image_url === "string" ? row.hero_image_url : resource.table === "editorial_content" ? editorialImage(row.content) : "");
    const values: Row = {};
    for (const f of resource.fields) {
      const value = row[f.key];
      values[f.key] = f.type === "boolean" ? value ?? f.key === "is_active" : f.type === "json" ? JSON.stringify(value ?? {}, null, 2) : f.type === "tags" ? (Array.isArray(value) ? value.join(", ") : "") : f.type === "datetime-local" ? (value ? String(value).slice(0, 16) : "") : f.type === "money" && typeof value === "number" ? value / 100 : value ?? f.options?.[0] ?? (f.type === "number" && f.required ? 0 : "");
    }
    reset(values);
  }

  async function save(values: Row) {
    setStatus("");
    try {
      const payload = parseAdminValues(resource, values);
      const key = resource.key ?? "id";
      const id = editing?.[key];
      if (id && resource.table === "order_requests") {
        const result = await supabase!.rpc("update_order_request_status", { p_order_id: id, p_status: payload.status });
        if (result.error) throw result.error;
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
      setEditing(null); setStatus("Saved.");
    } catch (error) { setStatus(error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ") : error instanceof Error ? error.message : "The record could not be saved. Check the fields and try again."); }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 10 * 1024 * 1024) { setStatus("Choose a JPG, PNG, WebP, or AVIF image under 10 MB."); return; }
    let content: Row = {};
    if (resource.table === "editorial_content") {
      try { content = z.record(z.string(), z.unknown()).parse(JSON.parse(String(getValues("content") || "{}"))); }
      catch { setStatus("Fix the section content JSON before uploading an image."); return; }
    }
    setUploading(true); setStatus("");
    try {
      const path = `${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const { error } = await supabase!.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const publicUrl = supabase!.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      if (resource.table === "product_images") {
        setValue("storage_path", path);
        setValue("public_url", publicUrl);
      } else if (resource.table === "collections") setValue("hero_image_url", publicUrl);
      else setValue("content", JSON.stringify({ ...content, image: publicUrl }, null, 2));
      setPreviewUrl(publicUrl);
      setStatus("Image uploaded. Review the preview and save the record.");
    } catch { setStatus("The upload failed. Please try again."); }
    finally { setUploading(false); }
  }

  return <section className="admin-workspace">
    <header><h2>{resource.title}</h2>{!resource.readOnly && !resource.noCreate && <button className="primary-button" onClick={() => begin({})}>Add record</button>}</header>
    {status && <p role="status" className="form-message">{status}</p>}
    {query.isPending ? <p role="status">Loading records…</p> : query.error ? <div role="alert"><p>Records could not load.</p><button onClick={() => void query.refetch()}>Try again</button></div> : <>
      <div className="admin-table-wrap"><table><thead><tr>{resource.columns.map((col) => <th key={col}>{col.replaceAll("_", " ")}</th>)}<th>Record</th></tr></thead><tbody>{query.data.rows.map((row, index) => <tr key={display(row.id ?? row.variant_id ?? index)}>{resource.columns.map((col) => <td key={col}>{displayCell(row, col)}</td>)}<td><button className="text-link" onClick={() => begin(row)}>{resource.readOnly ? "View" : "Edit"}</button></td></tr>)}</tbody></table></div>
      {!query.data.rows.length && <p>No records yet.</p>}
      <div className="admin-pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} · {query.data.count} records</span><button disabled={(page + 1) * 25 >= query.data.count} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
    {editing && <section className="admin-editor" aria-label="Edit record"><h3>{editing[resource.key ?? "id"] ? "Record details" : "New record"}</h3>
      {editing.id != null && <p className="admin-id">ID: {display(editing.id)}</p>}
      {(resource.noCreate || resource.readOnly) && <dl className="record-detail">{Object.entries(editing).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{display(value)}</dd></div>)}</dl>}
      {!resource.readOnly && <form onSubmit={handleSubmit(save)} className="admin-form">
        {references.error && <p className="form-message" role="alert">Related products, brands, or collections could not load. Close and reopen the editor to retry.</p>}
        {["product_images", "collections", "editorial_content"].includes(resource.table) && <label className="admin-image-upload"><span>{resource.table === "product_images" ? "Upload product photography" : resource.table === "collections" ? "Upload collection hero" : "Upload lookbook image"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} />{previewUrl && previewUrl !== "—" && <img src={previewUrl} alt="Uploaded preview" />}</label>}
        {resource.fields.map((f) => {
          const referenceOptions = references.data?.[f.key];
          return <label key={f.key}><span>{f.label}</span>{f.options ? <select {...register(f.key)}>{f.options.map((option) => <option key={option}>{option}</option>)}</select> : f.type === "uuid" && referenceSources[f.key] ? <select {...register(f.key)} disabled={references.isPending || Boolean(references.error)}><option value="">{references.isPending ? "Loading choices…" : references.error ? "Choices unavailable" : f.required ? "Select one" : "None"}</option>{referenceOptions?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : ["textarea", "json"].includes(f.type ?? "") ? <textarea rows={f.type === "json" ? 8 : 3} {...register(f.key)} /> : <input type={f.type === "boolean" ? "checkbox" : f.type === "number" || f.type === "money" ? "number" : f.type === "datetime-local" ? "datetime-local" : "text"} step={f.type === "money" ? "0.01" : undefined} min={f.type === "number" || f.type === "money" ? "0" : undefined} {...register(f.key)} />}</label>;
        })}
        <button className="primary-button" disabled={isSubmitting || uploading}>{isSubmitting ? "Saving…" : "Save record"}</button>
      </form>}
      <button className="text-link" onClick={() => setEditing(null)}>Close editor</button>
    </section>}
  </section>;
}
