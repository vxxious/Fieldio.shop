import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { parseAdminValues, type AdminResource } from "../../lib/admin-resources";
import { supabase } from "../../lib/supabase";

type Row = Record<string, unknown>;
function display(value: unknown): string { return value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }

export function AdminWorkspace({ resource }: { resource: AdminResource }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm<Row>();
  const query = useQuery({ queryKey: ["admin", resource.table, page], queryFn: async () => {
    const { data, error, count } = await supabase!.from(resource.table).select("*", { count: "exact" }).order(resource.columns[0]!).range(page * 25, page * 25 + 24);
    if (error) throw error;
    return { rows: data as Row[], count: count ?? 0 };
  } });

  function begin(row: Row) {
    setEditing(row); setStatus("");
    const values: Row = {};
    for (const f of resource.fields) {
      const value = row[f.key];
      values[f.key] = f.type === "boolean" ? value ?? f.key === "is_active" : f.type === "json" ? JSON.stringify(value ?? {}, null, 2) : f.type === "tags" ? (Array.isArray(value) ? value.join(", ") : "") : f.type === "datetime-local" ? (value ? String(value).slice(0, 16) : "") : value ?? f.options?.[0] ?? (f.type === "number" && f.required ? 0 : "");
    }
    reset(values);
  }

  async function save(values: Row) {
    setStatus("");
    try {
      const payload = parseAdminValues(resource, values);
      const key = resource.key ?? "id";
      const id = editing?.[key];
      let result;
      if (id) {
        let mutation = supabase!.from(resource.table).update(payload).eq(key, id);
        if (resource.table === "collection_products") mutation = mutation.eq("collection_id", editing?.collection_id);
        result = await mutation;
      } else result = await supabase!.from(resource.table).insert(payload);
      if (result.error) throw result.error;
      await Promise.all([cache.invalidateQueries({ queryKey: ["admin", resource.table] }), cache.invalidateQueries({ queryKey: ["catalog"] })]);
      setEditing(null); setStatus("Saved.");
    } catch (error) { setStatus(error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ") : error instanceof Error ? error.message : "The record could not be saved. Check the fields and try again."); }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 10 * 1024 * 1024) { setStatus("Choose a JPG, PNG, WebP, or AVIF image under 10 MB."); return; }
    setUploading(true); setStatus("");
    try {
      const path = `${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const { error } = await supabase!.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setValue("storage_path", path);
      setValue("public_url", supabase!.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      setStatus("Image uploaded. Add its description and save the record.");
    } catch { setStatus("The upload failed. Please try again."); }
    finally { setUploading(false); }
  }

  return <section className="admin-workspace">
    <header><h2>{resource.title}</h2>{!resource.readOnly && !resource.noCreate && <button className="primary-button" onClick={() => begin({})}>Add record</button>}</header>
    {status && <p role="status" className="form-message">{status}</p>}
    {query.isPending ? <p role="status">Loading records…</p> : query.error ? <div role="alert"><p>Records could not load.</p><button onClick={() => void query.refetch()}>Try again</button></div> : <>
      <div className="admin-table-wrap"><table><thead><tr>{resource.columns.map((col) => <th key={col}>{col.replaceAll("_", " ")}</th>)}<th>Record</th></tr></thead><tbody>{query.data.rows.map((row, index) => <tr key={display(row.id ?? row.variant_id ?? index)}>{resource.columns.map((col) => <td key={col}>{display(row[col])}</td>)}<td><button className="text-link" onClick={() => begin(row)}>{resource.readOnly ? "View" : "Edit"}</button></td></tr>)}</tbody></table></div>
      {!query.data.rows.length && <p>No records yet.</p>}
      <div className="admin-pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} · {query.data.count} records</span><button disabled={(page + 1) * 25 >= query.data.count} onClick={() => setPage(page + 1)}>Next</button></div>
    </>}
    {editing && <section className="admin-editor" aria-label="Edit record"><h3>{editing[resource.key ?? "id"] ? "Record details" : "New record"}</h3>
      {editing.id != null && <p className="admin-id">ID: {display(editing.id)}</p>}
      {(resource.noCreate || resource.readOnly) && <dl className="record-detail">{Object.entries(editing).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{display(value)}</dd></div>)}</dl>}
      {!resource.readOnly && <form onSubmit={handleSubmit(save)} className="admin-form">
        {resource.table === "product_images" && <label>Upload authorised photography<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} /></label>}
        {resource.fields.map((f) => <label key={f.key}><span>{f.label}</span>{f.options ? <select {...register(f.key)}>{f.options.map((option) => <option key={option}>{option}</option>)}</select> : ["textarea", "json"].includes(f.type ?? "") ? <textarea rows={f.type === "json" ? 8 : 3} {...register(f.key)} /> : <input type={f.type === "boolean" ? "checkbox" : f.type === "number" ? "number" : f.type === "datetime-local" ? "datetime-local" : "text"} {...register(f.key)} />}</label>)}
        <button className="primary-button" disabled={isSubmitting || uploading}>{isSubmitting ? "Saving…" : "Save record"}</button>
      </form>}
      <button className="text-link" onClick={() => setEditing(null)}>Close editor</button>
    </section>}
  </section>;
}
