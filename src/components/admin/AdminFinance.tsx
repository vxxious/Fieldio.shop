import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { authenticatedPost } from "../../lib/authenticated-api";
import { supabase } from "../../lib/supabase";

export interface PaymentOrder { id: string; public_reference: string; customer_name: string; status: string; currency: string; subtotal: number | null }
interface Eligible { seller_owner_id: string; store_name: string; gross_amount: number; commission_amount: number; vendor_net_amount: number; payout_adjustment_amount: number; order_request: { currency: string } | Array<{ currency: string }> }
interface Payout { id: string; seller_owner_id: string; amount: number; currency: string; status: string; reference: string | null; created_at: string }
interface Adjustment { id: number; case_type: string; kind: string; amount: number; currency: string; reason: string; created_at: string }
type PaymentMethod = "bank_transfer" | "card" | "crypto" | "cash" | "other";

function minorUnits(value: string, allowZero = false): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimals = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

export function PaymentConfirmation({ order, onConfirmed }: { order: PaymentOrder; onConfirmed: (message: string) => void }) {
  const [amount, setAmount] = useState(order.subtotal === null ? "" : (order.subtotal / 100).toFixed(2));
  const [shipping, setShipping] = useState("0.00");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const paymentAmount = minorUnits(amount);
    const shippingAmount = minorUnits(shipping, true);
    if (paymentAmount === null || shippingAmount === null || shippingAmount > paymentAmount) {
      setError("Enter a valid amount received and shipping amount.");
      return;
    }
    if (reference.trim().length < 2) {
      setError("Enter the bank, card, receipt, or transaction reference.");
      return;
    }
    setWorking(true); setError("");
    try {
      const result = await authenticatedPost<{ emailDelivered: boolean }>("/api/admin/order-payments", {
        orderId: order.id,
        amount: paymentAmount,
        shippingAmount,
        method,
        reference: reference.trim()
      });
      onConfirmed(result.emailDelivered ? `Payment confirmed for ${order.public_reference}.` : `Payment confirmed for ${order.public_reference}, but the customer email could not be sent.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be confirmed.");
    } finally {
      setWorking(false);
    }
  }

  return <form className="admin-payment-card" onSubmit={(event) => void submit(event)}>
    <header><div><strong>{order.public_reference}</strong><span>{order.customer_name}</span></div><span>{order.status.replaceAll("_", " ")}</span></header>
    <label><span>Amount received ({order.currency})</span><input inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label>
    <label><span>Shipping included ({order.currency})</span><input inputMode="decimal" required value={shipping} onChange={(event) => setShipping(event.target.value)} /></label>
    <label><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="crypto">Cryptocurrency</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
    <label><span>Payment reference</span><input required minLength={2} maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction or receipt reference" /></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={working}>{working ? "Confirming…" : "Confirm payment"}</button>
  </form>;
}

export function AdminFinance() {
  const cache = useQueryClient();
  const [working, setWorking] = useState("");
  const [status, setStatus] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const finance = useQuery({ queryKey: ["admin-finance"], queryFn: async () => {
    const [payments, fulfillments, payouts, adjustments] = await Promise.all([
      supabase!.from("order_requests").select("id,public_reference,customer_name,status,currency,subtotal").eq("payment_status", "pending").in("status", ["confirmed", "processing", "shipped", "delivered"]).order("created_at", { ascending: false }).limit(100),
      supabase!.from("order_fulfillments").select("seller_owner_id,store_name,gross_amount,commission_amount,vendor_net_amount,payout_adjustment_amount,order_request:order_requests(currency)").eq("payout_status", "eligible").eq("payout_hold_status", "clear").not("seller_owner_id", "is", null),
      supabase!.from("seller_payouts").select("id,seller_owner_id,amount,currency,status,reference,created_at").order("created_at", { ascending: false }).limit(100),
      supabase!.from("payout_adjustments").select("id,case_type,kind,amount,currency,reason,created_at").order("created_at", { ascending: false }).limit(100)
    ]);
    if (payments.error || fulfillments.error || payouts.error || adjustments.error) throw payments.error || fulfillments.error || payouts.error || adjustments.error;
    const groups = new Map<string, { sellerOwnerId: string; storeName: string; currency: string; gross: number; commission: number; amount: number }>();
    for (const row of fulfillments.data as unknown as Eligible[]) {
      const relation = Array.isArray(row.order_request) ? row.order_request[0] : row.order_request;
      const currency = relation?.currency ?? "GBP";
      const key = `${row.seller_owner_id}:${currency}`;
      const group = groups.get(key) ?? { sellerOwnerId: row.seller_owner_id, storeName: row.store_name, currency, gross: 0, commission: 0, amount: 0 };
      group.gross += row.gross_amount;
      group.commission += row.commission_amount;
      group.amount += Math.max(0, row.vendor_net_amount - row.payout_adjustment_amount);
      groups.set(key, group);
    }
    return { pendingPayments: payments.data as PaymentOrder[], eligible: [...groups.values()], payouts: payouts.data as Payout[], adjustments: adjustments.data as Adjustment[] };
  } });
  async function refreshPayment(message: string) {
    setStatus(message);
    await Promise.all([cache.invalidateQueries({ queryKey: ["admin-finance"] }), cache.invalidateQueries({ queryKey: ["admin", "order_requests"] })]);
  }
  async function run(key: string, body: Record<string, unknown>, message: string) {
    setWorking(key); setStatus("");
    try { await authenticatedPost("/api/admin/payouts", body); setStatus(message); await cache.invalidateQueries({ queryKey: ["admin-finance"] }); }
    catch (error) { setStatus(error instanceof Error ? error.message : "The payout action failed."); }
    finally { setWorking(""); }
  }
  return <section className="admin-finance"><header><div><h2>Payments, commission & payouts</h2><p>Only paid, delivered balances without an active return or dispute can be paid. Case adjustments remain in the financial history.</p></div></header>{status && <p className="form-message" role="status">{status}</p>}
    {finance.isPending ? <p role="status">Loading payment and payout records…</p> : finance.error ? <p role="alert">Payment and payout records could not load.</p> : <><section><h3>Payments awaiting confirmation</h3>{finance.data.pendingPayments.length ? <div className="admin-payment-grid">{finance.data.pendingPayments.map((order) => <PaymentConfirmation key={order.id} order={order} onConfirmed={(message) => void refreshPayment(message)} />)}</div> : <p>No confirmed orders are waiting for payment confirmation.</p>}</section>
    <section><h3>Eligible balances</h3>{finance.data.eligible.length ? <div className="admin-table-wrap"><table><thead><tr><th>Store</th><th>Gross</th><th>Fieldio commission</th><th>Seller net</th><th>Action</th></tr></thead><tbody>{finance.data.eligible.map((group) => { const key = `${group.sellerOwnerId}:${group.currency}`; const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: group.currency }); return <tr key={key}><td data-label="Store">{group.storeName}</td><td data-label="Gross">{money.format(group.gross / 100)}</td><td data-label="Fieldio commission">{money.format(group.commission / 100)}</td><td data-label="Seller net">{money.format(group.amount / 100)}</td><td data-label="Action"><button className="text-link" disabled={Boolean(working)} onClick={() => void run(key, { action: "create", sellerOwnerId: group.sellerOwnerId, currency: group.currency }, "Payout record created for approval.")}>{working === key ? "Creating…" : "Create payout"}</button></td></tr>; })}</tbody></table></div> : <p>No paid, delivered seller balances are waiting.</p>}</section>
    <section><h3>Payout history</h3>{finance.data.payouts.length ? <div className="admin-table-wrap"><table><thead><tr><th>Amount</th><th>Status</th><th>Created</th><th>Reference</th><th>Action</th></tr></thead><tbody>{finance.data.payouts.map((payout) => <tr key={payout.id}><td data-label="Amount">{new Intl.NumberFormat("en-GB", { style: "currency", currency: payout.currency }).format(payout.amount / 100)}</td><td data-label="Status">{payout.status}</td><td data-label="Created">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(payout.created_at))}</td><td data-label="Reference">{payout.status === "approved" ? <input aria-label={`Payment reference for ${payout.id}`} value={references[payout.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [payout.id]: event.target.value }))} /> : payout.reference ?? "—"}</td><td data-label="Action">{payout.status === "pending" && <><button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "approved" }, "Payout approved.")}>Approve</button><button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "cancelled" }, "Payout cancelled and balance released.")}>Cancel</button></>}{payout.status === "held" && <button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "cancelled" }, "Held payout cancelled; case-held balances remain protected.")}>Cancel batch</button>}{payout.status === "approved" && <><button className="text-link" disabled={Boolean(working) || !(references[payout.id]?.trim())} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "paid", reference: references[payout.id] }, "Payout marked paid and seller notified.")}>Mark paid</button><button className="text-link" disabled={Boolean(working)} onClick={() => void run(payout.id, { action: "update", payoutId: payout.id, status: "failed" }, "Payout failed and balance released.")}>Mark failed</button></>}</td></tr>)}</tbody></table></div> : <p>No payouts yet.</p>}</section>
    <section><h3>Immutable payout adjustments</h3>{finance.data.adjustments.length ? <div className="admin-table-wrap"><table><thead><tr><th>Case</th><th>Entry</th><th>Amount</th><th>Reason</th><th>Recorded</th></tr></thead><tbody>{finance.data.adjustments.map((adjustment) => <tr key={adjustment.id}><td data-label="Case">{adjustment.case_type}</td><td data-label="Entry">{adjustment.kind.replaceAll("_", " ")}</td><td data-label="Amount">{new Intl.NumberFormat("en-GB", { style: "currency", currency: adjustment.currency }).format(adjustment.amount / 100)}</td><td data-label="Reason">{adjustment.reason}</td><td data-label="Recorded">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(adjustment.created_at))}</td></tr>)}</tbody></table></div> : <p>No payout holds, releases, or refund adjustments recorded.</p>}</section></>}
  </section>;
}
