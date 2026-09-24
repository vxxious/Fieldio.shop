import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authenticatedPost } from "../../lib/authenticated-api";
import { supabase } from "../../lib/supabase";

interface Eligible { seller_owner_id: string; store_name: string; gross_amount: number; commission_amount: number; vendor_net_amount: number; order_request: { currency: string } | Array<{ currency: string }> }
interface Payout { id: string; seller_owner_id: string; amount: number; currency: string; status: string; reference: string | null; created_at: string }

export function AdminFinance() {
  const cache = useQueryClient();
  const [working, setWorking] = useState("");
  const [status, setStatus] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const finance = useQuery({ queryKey: ["admin-finance"], queryFn: async () => {
    const [fulfillments, payouts] = await Promise.all([
      supabase!.from("order_fulfillments").select("seller_owner_id,store_name,gross_amount,commission_amount,vendor_net_amount,order_request:order_requests(currency)").eq("payout_status", "eligible").not("seller_owner_id", "is", null),
      supabase!.from("seller_payouts").select("id,seller_owner_id,amount,currency,status,reference,created_at").order("created_at", { ascending: false }).limit(100)
    ]);
    if (fulfillments.error || payouts.error) throw fulfillments.error || payouts.error;
    const groups = new Map<string, { sellerOwnerId: string; storeName: string; currency: string; gross: number; commission: number; amount: number }>();
    for (const row of fulfillments.data as unknown as Eligible[]) {
      const relation = Array.isArray(row.order_request) ? row.order_request[0] : row.order_request;
      const currency = relation?.currency ?? "GBP";
      const key = `${row.seller_owner_id}:${currency}`;
      const group = groups.get(key) ?? { sellerOwnerId: row.seller_owner_id, storeName: row.store_name, currency, gross: 0, commission: 0, amount: 0 };
      group.gross += row.gross_amount;
      group.commission += row.commission_amount;
      group.amount += row.vendor_net_amount;
      groups.set(key, group);
    }
    return { eligible: [...groups.values()], payouts: payouts.data as Payout[] };
  } });
  async function run(key: string, body: Record<string, unknown>, message: string) {
    setWorking(key); setStatus("");
    try { await authenticatedPost("/api/admin/payouts", body); setStatus(message); await cache.invalidateQueries({ queryKey: ["admin-finance"] }); }
    catch (error) { setStatus(error instanceof Error ? error.message : "The payout action failed."); }
    finally { setWorking(""); }
  }
  return <section className="admin-finance"><header><div><h2>Commission & payouts</h2><p>Delivered vendor fulfilments become eligible automatically. Fieldio commission is currently 15% unless changed in the database.</p></div></header>{status && <p className="form-message" role="status">{status}</p>}
    {finance.isPending ? <p role="status">Loading payout records…</p> : finance.error ? <p role="alert">Payout records could not load.</p> : <><section><h3>Eligible balances</h3>{finance.data.eligible.length ? <div className="admin-table-wrap"><table><thead><tr><th>Store</th><th>Gross</th><th>Fieldio commission</th><th>Seller net</th><th>Action</th></tr></thead><tbody>{finance.data.eligible.map((group) => { const key = `${group.sellerOwnerId}:${group.currency}`; const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: group.currency }); return <tr key={key}><td data-label="Store">{group.storeName}</td><td data-label="Gross">{money.format(group.gross / 100)}</td><td data-label="Fieldio commission">{money.format(group.commission / 100)}</td><td data-label="Seller net">{money.format(group.amount / 100)}</td><td data-label="Action"><button className="text-link" disabled={Boolean(working)} onClick={() => void run(key, { action: "create", sellerOwnerId: group.sellerOwnerId, currency: group.currency }, "Payout record created for approval.")}>{working === key ? "Creating…" : "Create payout"}</button></td></tr>; })}</tbody></table></div> : <p>No delivered seller balances are waiting.</p>}</section>
    <section><h3>Payout history</h3>{finance.data.payouts.length ? <div className="admin-table-wrap"><table><thead><tr><th>Amount</th><th>Status</th><th>Created</th><th>Reference</th><th>Action</th></tr></thead><tbody>{finance.data.payouts.map((payout) => <tr key={payout.id}><td data-label="Amount">{new Intl.NumberFormat("en-GB", { style: "currency", currency: payout.currency }).format(payout.amount / 100)}</td><td data-label="Status">{payout.status}</td><td data-label="Created">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(payout.created_at))}</td><td data-label="Reference">{payout.status === "approved" ? <input aria-label={`Payment reference for ${payout.id}`} value={references[payout.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [payout.id]: event.target.value }))} /> : payout.reference ?? "—"}</td><td data-label="Action">{payout.status === "pending" && <><button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "approved" }, "Payout approved.")}>Approve</button><button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "cancelled" }, "Payout cancelled and balance released.")}>Cancel</button></>}{payout.status === "approved" && <><button className="text-link" disabled={Boolean(working) || !(references[payout.id]?.trim())} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "paid", reference: references[payout.id] }, "Payout marked paid and seller notified.")}>Mark paid</button><button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "failed" }, "Payout failed and balance released.")}>Mark failed</button></>}</td></tr>)}</tbody></table></div> : <p>No payouts yet.</p>}</section></>}
  </section>;
}
