import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useRef, useState } from "react";
import { authenticatedPost } from "../../lib/authenticated-api";
import { supabase } from "../../lib/supabase";

type Audience = "subscribers" | "customers" | "sellers";
interface CampaignDraft { name: string; subject: string; preheader: string; heading: string; body: string; actionLabel: string; actionUrl: string; audience: Audience }
interface CampaignRow { id: string; name: string; subject: string; preheader: string | null; heading: string; body: string; action_label: string | null; action_url: string | null; audience: Audience; status: string; recipient_count: number; sent_count: number; delivered_count: number; opened_count: number; clicked_count: number; failed_count: number; unsubscribed_count: number; created_at: string }

const emptyCampaign: CampaignDraft = { name: "", subject: "", preheader: "", heading: "", body: "", actionLabel: "", actionUrl: "", audience: "subscribers" };
const toDraft = (row: CampaignRow): CampaignDraft => ({ name: row.name, subject: row.subject, preheader: row.preheader ?? "", heading: row.heading, body: row.body, actionLabel: row.action_label ?? "", actionUrl: row.action_url ?? "", audience: row.audience });

export function EmailCampaigns() {
  const cache = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const testEmailRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(emptyCampaign);
  const [campaignId, setCampaignId] = useState<string>();
  const [testEmail, setTestEmail] = useState("");
  const [preview, setPreview] = useState("");
  const [recipientCount, setRecipientCount] = useState<number>();
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const campaigns = useQuery({ queryKey: ["admin-campaigns"], queryFn: async () => {
    const { data, error } = await supabase!.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data as CampaignRow[];
  } });
  const locked = Boolean(campaignId && campaigns.data?.find((campaign) => campaign.id === campaignId)?.status !== "draft");
  const set = (key: keyof CampaignDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const validDraft = () => formRef.current?.reportValidity() ?? false;
  async function run<T>(action: () => Promise<T>, success: string) {
    setWorking(true); setStatus("");
    try { const result = await action(); setStatus(success); return result; }
    catch (error) { setStatus(error instanceof Error ? error.message : "The campaign action failed."); }
    finally { setWorking(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const result = await run(() => authenticatedPost<{ campaign: CampaignRow }>("/api/admin/campaigns", { action: "save", campaignId, campaign: draft }), "Draft saved.");
    if (result) { setCampaignId(result.campaign.id); await cache.invalidateQueries({ queryKey: ["admin-campaigns"] }); }
  }
  async function showPreview() {
    if (!validDraft()) return;
    const result = await run(() => authenticatedPost<{ html: string; recipientCount: number }>("/api/admin/campaigns", { action: "preview", campaign: draft }), "Preview updated.");
    if (result) { setPreview(result.html); setRecipientCount(result.recipientCount); }
  }
  async function sendTest() {
    if (!validDraft() || !testEmailRef.current?.reportValidity()) return;
    await run(() => authenticatedPost("/api/admin/campaigns", { action: "test", email: testEmail, campaign: draft }), "Test email sent.");
  }
  async function send() {
    if (!campaignId) { setStatus("Save the draft before sending."); return; }
    if (!window.confirm(`Send this campaign to ${recipientCount ?? "the current"} eligible recipients?`)) return;
    const result = await run(() => authenticatedPost<{ sent: number; failed: number }>("/api/admin/campaigns", { action: "send", campaignId }), "Campaign submitted to Resend.");
    if (result) { setStatus(`Resend accepted ${result.sent} messages${result.failed ? `; ${result.failed} failed and can be retried` : ""}.`); await cache.invalidateQueries({ queryKey: ["admin-campaigns"] }); }
  }
  return <section className="admin-campaigns">
    <header><div><h2>Email campaigns</h2><p>Create a restrained Fieldio campaign and send only to subscribed audiences.</p></div><button className="secondary-button" type="button" onClick={() => { setCampaignId(undefined); setDraft(emptyCampaign); setPreview(""); setRecipientCount(undefined); setStatus(""); }}>New campaign</button></header>
    <div className="campaign-layout"><div className="campaign-editor"><form ref={formRef} className="admin-form campaign-form" onSubmit={(event) => void save(event)}>
      <label><span>Internal campaign name</span><input required maxLength={120} value={draft.name} onChange={(event) => set("name", event.target.value)} /></label>
      <label><span>Audience</span><select value={draft.audience} onChange={(event) => set("audience", event.target.value)}><option value="subscribers">All subscribed contacts</option><option value="customers">Subscribed customers with orders</option><option value="sellers">Subscribed approved sellers</option></select></label>
      <label className="wide"><span>Subject</span><input required maxLength={160} value={draft.subject} onChange={(event) => set("subject", event.target.value)} /></label>
      <label className="wide"><span>Inbox preview text</span><input maxLength={180} value={draft.preheader} onChange={(event) => set("preheader", event.target.value)} /></label>
      <label className="wide"><span>Email heading</span><input required maxLength={160} value={draft.heading} onChange={(event) => set("heading", event.target.value)} /></label>
      <label className="wide"><span>Message</span><textarea required rows={9} maxLength={10000} value={draft.body} onChange={(event) => set("body", event.target.value)} /></label>
      <label><span>Button label (optional)</span><input minLength={2} maxLength={80} required={Boolean(draft.actionUrl.trim())} placeholder="Shop now" value={draft.actionLabel} onChange={(event) => set("actionLabel", event.target.value)} /></label>
      <label><span>Button URL (optional)</span><input type="url" required={Boolean(draft.actionLabel.trim())} placeholder="https://fieldio.shop/…" value={draft.actionUrl} onChange={(event) => set("actionUrl", event.target.value)} /></label>
      <div className="campaign-actions wide"><button className="primary-button" disabled={working || locked}>{working ? "Working…" : locked ? "Campaign sent" : "Save draft"}</button><button className="secondary-button" type="button" disabled={working} onClick={() => void showPreview()}>Preview audience</button><button className="secondary-button" type="button" disabled={working || !campaignId || locked} onClick={() => void send()}>Send campaign</button></div>
    </form><div className="campaign-test"><label><span>Test recipient</span><input ref={testEmailRef} type="email" required value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="you@fieldio.shop" /></label><button className="text-link" type="button" disabled={working || !testEmail} onClick={() => void sendTest()}>Send test</button></div>{status && <p className="form-message" role="status">{status}</p>}</div>
    <aside className="campaign-preview" aria-label="Campaign preview"><div><strong>Preview</strong>{recipientCount !== undefined && <span>{recipientCount} eligible recipients</span>}</div>{preview ? <iframe title="Email campaign preview" srcDoc={preview} /> : <p>Preview the campaign to verify the final light and dark mode email and current audience size.</p>}</aside></div>
      <section className="campaign-history"><h3>Campaign history</h3>{campaigns.isPending ? <p role="status">Loading campaigns…</p> : campaigns.error ? <p role="alert">Campaign history could not load.</p> : campaigns.data?.length ? <div className="admin-table-wrap"><table><thead><tr><th>Campaign</th><th>Audience</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Failed</th><th>Action</th></tr></thead><tbody>{campaigns.data.map((row) => <tr key={row.id}><td data-label="Campaign">{row.name}</td><td data-label="Audience">{row.audience}</td><td data-label="Status">{row.status}</td><td data-label="Sent">{row.sent_count}</td><td data-label="Delivered">{row.delivered_count}</td><td data-label="Opened">{row.opened_count}</td><td data-label="Clicked">{row.clicked_count}</td><td data-label="Failed">{row.failed_count}</td><td data-label="Action"><button className="text-link" type="button" onClick={() => { setCampaignId(row.id); setDraft(toDraft(row)); setPreview(""); setRecipientCount(row.recipient_count); }}>{row.status === "draft" ? "Edit" : "View"}</button>{["partial", "failed"].includes(row.status) && <button className="text-link" type="button" disabled={working} onClick={() => void run(async () => { await authenticatedPost("/api/admin/campaigns", { action: "retry", campaignId: row.id }); await cache.invalidateQueries({ queryKey: ["admin-campaigns"] }); }, "Failed deliveries retried.")}>Retry failed</button>}</td></tr>)}</tbody></table></div> : <p>No campaigns yet.</p>}</section>
  </section>;
}
