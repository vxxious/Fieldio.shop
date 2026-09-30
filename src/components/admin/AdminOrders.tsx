import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { authenticatedPost } from "../../lib/authenticated-api";
import type { AdminRole } from "../../lib/admin-resources";
import { supabase } from "../../lib/supabase";
import { PaymentConfirmation, type PaymentOrder } from "./AdminFinance";

interface Order extends PaymentOrder {
  customer_email: string; customer_phone: string; shipping_address: string; fulfillment_status: string;
  payment_status: string; payment_amount: number | null; payment_method: string | null; payment_reference: string | null; payment_confirmed_at: string | null;
  shipping_total: number | null; total: number | null; created_at: string; updated_at: string;
}
interface Item { id: string; fulfillment_id: string; product_name: string; variant_name: string | null; size: string | null; color: string | null; quantity: number; unit_price: number | null; line_total: number | null }
interface Fulfillment { id: string; store_name: string; status: string; carrier: string | null; tracking_reference: string | null; rejection_reason: string | null; accepted_at: string | null; preparing_at: string | null; shipped_at: string | null; delivered_at: string | null; rejected_at: string | null; gross_amount: number; commission_amount: number; vendor_net_amount: number; payout_status: string; payout_hold_status: string; payout_adjustment_amount: number; updated_at: string }
interface Case { id: string; order_item_id: string | null; fulfillment_id?: string | null; quantity?: number; reason: string; details: string; status: string; resolution: string | null; payout_resolution: string | null; payout_hold_amount: number; created_at: string }
interface Event { id: number; event_type: string; store_name: string | null; from_status: string | null; to_status: string | null; carrier: string | null; tracking_reference: string | null; note: string | null; created_at: string }
interface Detail { items: Item[]; fulfillments: Fulfillment[]; returns: Case[]; disputes: Case[]; events: Event[] }

const PAGE_SIZE = 30;
const orderTransitions: Record<string, string[]> = {
  order_request: ["awaiting_confirmation", "cancelled"], awaiting_confirmation: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["delivered"]
};
const caseTransitions: Record<"return" | "dispute", Record<string, string[]>> = {
  return: { requested: ["approved", "rejected"], approved: ["in_transit", "closed"], in_transit: ["received"], received: ["refunded", "closed"], refunded: ["closed"], rejected: ["closed"] },
  dispute: { open: ["reviewing", "rejected"], reviewing: ["resolved", "rejected", "closed"], resolved: ["closed"], rejected: ["closed"] }
};
const terminalCases = new Set(["rejected", "resolved", "refunded", "closed"]);
const label = (value: string) => value.replaceAll("_", " ");
const date = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const money = (value: number | null, currency: string) => value === null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value / 100);

function CaseAction({ type, item, role, onUpdated }: { type: "return" | "dispute"; item: Case; role: AdminRole; onUpdated: (message: string) => void }) {
  const financeAdmin = role === "owner" || role === "admin";
  const options = (caseTransitions[type][item.status] ?? []).filter((status) => financeAdmin || !terminalCases.has(status));
  const [status, setStatus] = useState(options[0] ?? "");
  const [resolution, setResolution] = useState("");
  const [payoutResolution, setPayoutResolution] = useState<"release" | "refund" | "keep_held">((item.payout_resolution as "release" | "refund" | "keep_held" | null) ?? "release");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  if (!options.length) return null;
  const needsResolution = terminalCases.has(status);
  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError("");
    try {
      await authenticatedPost("/api/admin/cases", { caseType: type, id: item.id, status, resolution: needsResolution ? resolution.trim() : null, payoutResolution: needsResolution ? payoutResolution : null });
      onUpdated(`${type === "return" ? "Return" : "Dispute"} updated to ${label(status)}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The case could not be updated."); }
    finally { setWorking(false); }
  }
  return <form className="admin-order-case-action" onSubmit={(event) => void submit(event)}>
    <label><span>Next status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
    {needsResolution && <><label className="wide"><span>Resolution</span><textarea required minLength={2} maxLength={2000} value={resolution} onChange={(event) => setResolution(event.target.value)} /></label><label><span>Payout decision</span><select value={payoutResolution} onChange={(event) => setPayoutResolution(event.target.value as typeof payoutResolution)}><option value="release">Release seller payout</option><option value="refund">Record refund adjustment</option><option value="keep_held">Keep payout held</option></select></label></>}
    {error && <p className="field-error wide" role="alert">{error}</p>}<button className="secondary-button" disabled={working}>{working ? "Updating…" : "Update case"}</button>
  </form>;
}

export function AdminOrders({ role, onOpenFinance }: { role: AdminRole; onOpenFinance?: () => void }) {
  const cache = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [working, setWorking] = useState(false);
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: async () => {
    const { data, error } = await supabase!.from("order_requests").select("id,public_reference,customer_name,customer_email,customer_phone,shipping_address,status,fulfillment_status,payment_status,payment_amount,payment_method,payment_reference,payment_confirmed_at,subtotal,shipping_total,total,currency,created_at,updated_at").order("created_at", { ascending: false }).limit(PAGE_SIZE);
    if (error) throw error; return data as Order[];
  } });
  const visibleOrders = useMemo(() => orders.data?.filter((order) => `${order.public_reference} ${order.customer_name} ${order.customer_email}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [], [orders.data, search]);
  const selected = visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];
  const effectiveNextStatus = nextStatus || (selected ? orderTransitions[selected.status]?.[0] ?? "" : "");
  const detail = useQuery({ queryKey: ["admin-order", selected?.id], enabled: Boolean(selected), queryFn: async () => {
    const orderId = selected!.id;
    const [items, fulfillments, returns, disputes, events] = await Promise.all([
      supabase!.from("order_items").select("id,fulfillment_id,product_name,variant_name,size,color,quantity,unit_price,line_total").eq("order_request_id", orderId),
      supabase!.from("order_fulfillments").select("id,store_name,status,carrier,tracking_reference,rejection_reason,accepted_at,preparing_at,shipped_at,delivered_at,rejected_at,gross_amount,commission_amount,vendor_net_amount,payout_status,payout_hold_status,payout_adjustment_amount,updated_at").eq("order_request_id", orderId).order("created_at"),
      supabase!.from("marketplace_returns").select("id,order_item_id,quantity,reason,details,status,resolution,payout_resolution,payout_hold_amount,created_at").eq("order_request_id", orderId).order("created_at", { ascending: false }),
      supabase!.from("marketplace_disputes").select("id,fulfillment_id,order_item_id,reason,details,status,resolution,payout_resolution,payout_hold_amount,created_at").eq("order_request_id", orderId).order("created_at", { ascending: false }),
      supabase!.from("order_events").select("id,event_type,store_name,from_status,to_status,carrier,tracking_reference,note,created_at").eq("order_request_id", orderId).order("created_at")
    ]);
    const failure = [items, fulfillments, returns, disputes, events].find((result) => result.error)?.error;
    if (failure) throw failure;
    return { items: items.data, fulfillments: fulfillments.data, returns: returns.data, disputes: disputes.data, events: events.data } as Detail;
  } });
  const supportCases: Array<{ type: "return" | "dispute"; item: Case }> = detail.data ? [
    ...detail.data.returns.map((item) => ({ type: "return" as const, item })),
    ...detail.data.disputes.map((item) => ({ type: "dispute" as const, item }))
  ] : [];
  async function refresh(message: string) { setStatus(message); await Promise.all([cache.invalidateQueries({ queryKey: ["admin-orders"] }), cache.invalidateQueries({ queryKey: ["admin-order", selected?.id] }), cache.invalidateQueries({ queryKey: ["admin-finance"] })]); }
  async function updateOrder() {
    if (!selected || !effectiveNextStatus) return; setWorking(true); setStatus("");
    try { const result = await authenticatedPost<{ emailDelivered: boolean }>("/api/order-status", { orderId: selected.id, status: effectiveNextStatus }); setNextStatus(""); await refresh(result.emailDelivered ? "Order status updated." : "Order updated, but the customer email could not be sent."); }
    catch (cause) { setStatus(cause instanceof Error ? cause.message : "The order could not be updated."); }
    finally { setWorking(false); }
  }
  return <section className="admin-orders"><header><div><h2>Orders & fulfilment</h2><p>One operational view for payment, vendor progress, customer support, and payout readiness.</p></div>{onOpenFinance && <button className="text-link" onClick={onOpenFinance}>Payments & payouts</button>}</header>
    {status && <p className="form-message" role="status">{status}</p>}
    <label className="admin-order-search"><span className="sr-only">Search orders</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, customer, or email" /></label>
    {orders.isPending ? <p role="status">Loading orders…</p> : orders.error ? <p role="alert">Orders could not load. <button className="text-link" onClick={() => void orders.refetch()}>Try again</button></p> : !visibleOrders.length ? <p>No matching orders.</p> : <div className="admin-orders-layout"><nav className="admin-order-index" aria-label="Orders">{visibleOrders.map((order) => <button key={order.id} aria-current={selected?.id === order.id ? "page" : undefined} onClick={() => { setSelectedId(order.id); setNextStatus(""); }}><strong>{order.public_reference}</strong><span>{order.customer_name}</span><small>{label(order.fulfillment_status)} · {label(order.payment_status)}</small></button>)}</nav>
      {selected && <article className="admin-order-detail"><header><div><p className="eyebrow">{selected.public_reference}</p><h3>{selected.customer_name}</h3></div><strong>{money(selected.total ?? selected.subtotal, selected.currency)}</strong></header>
        <dl className="admin-order-meta"><div><dt>Master status</dt><dd>{label(selected.status)}</dd></div><div><dt>Vendor progress</dt><dd>{label(selected.fulfillment_status)}</dd></div><div><dt>Payment</dt><dd>{label(selected.payment_status)}</dd></div><div><dt>Placed</dt><dd>{date(selected.created_at)}</dd></div><div><dt>Email</dt><dd><a href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a></dd></div><div><dt>Phone</dt><dd>{selected.customer_phone}</dd></div><div className="wide"><dt>Shipping address</dt><dd>{selected.shipping_address}</dd></div></dl>
        {(orderTransitions[selected.status]?.length ?? 0) > 0 && <div className="admin-order-control"><label><span>Update master order</span><select value={effectiveNextStatus} onChange={(event) => setNextStatus(event.target.value)}>{(orderTransitions[selected.status] ?? []).map((option) => <option key={option}>{option}</option>)}</select></label><button className="primary-button" disabled={working || !effectiveNextStatus} onClick={() => void updateOrder()}>{working ? "Updating…" : "Update order"}</button></div>}
        <section className="admin-order-section"><h4>Payment</h4>{selected.payment_status === "confirmed" ? <p>{money(selected.payment_amount, selected.currency)} via {label(selected.payment_method ?? "unknown")} · {selected.payment_reference ?? "No reference"}<br /><small>Confirmed {date(selected.payment_confirmed_at)}</small></p> : (role === "owner" || role === "admin") && ["confirmed", "processing", "shipped", "delivered"].includes(selected.status) ? <PaymentConfirmation order={selected} onConfirmed={(message) => void refresh(message)} /> : <p>Payment is pending{role === "fulfilment" ? "; confirmation requires a finance administrator" : ""}.</p>}</section>
        {detail.isPending ? <p role="status">Loading order operations…</p> : detail.error ? <p role="alert">Order operations could not load. <button className="text-link" onClick={() => void detail.refetch()}>Try again</button></p> : detail.data && <>
          <section className="admin-order-section"><h4>Vendor fulfilments</h4>{detail.data.fulfillments.map((group) => <div className="admin-order-fulfillment" key={group.id}><header><div><strong>{group.store_name}</strong><span>{label(group.status)}</span></div><small>Updated {date(group.updated_at)}</small></header>{group.rejection_reason && <p><strong>Rejection:</strong> {group.rejection_reason}</p>}{group.carrier && <p>{group.carrier} · {group.tracking_reference}</p>}<ul>{detail.data.items.filter((item) => item.fulfillment_id === group.id).map((item) => <li key={item.id}><span>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}{item.size ? ` · ${item.size}` : ""}{item.color ? ` · ${item.color}` : ""}</span><span>{item.quantity} × {money(item.unit_price, selected.currency)}</span></li>)}</ul><dl><div><dt>Gross</dt><dd>{money(group.gross_amount, selected.currency)}</dd></div><div><dt>Commission</dt><dd>{money(group.commission_amount, selected.currency)}</dd></div><div><dt>Seller net</dt><dd>{money(group.vendor_net_amount - group.payout_adjustment_amount, selected.currency)}</dd></div><div><dt>Payout</dt><dd>{label(group.payout_status)} · {label(group.payout_hold_status)}</dd></div></dl></div>)}</section>
          {supportCases.length > 0 && <section className="admin-order-section"><h4>Returns & disputes</h4>{supportCases.map(({ type, item }) => <article className="admin-order-case" key={`${item.id}:${item.status}`}><header><strong>{type === "return" ? "Return" : "Dispute"} · {label(item.status)}</strong><span>{date(item.created_at)}</span></header><p>{label(item.reason)} — {item.details}</p>{item.resolution && <p><strong>Resolution:</strong> {item.resolution}</p>}<p><small>Payout: {item.payout_resolution ? label(item.payout_resolution) : `${label(item.status)} hold`} · {money(item.payout_hold_amount, selected.currency)}</small></p><CaseAction type={type} item={item} role={role} onUpdated={(message) => void refresh(message)} /></article>)}</section>}
          <section className="admin-order-section"><h4>Immutable timeline</h4>{detail.data.events.length ? <ol className="admin-order-timeline">{detail.data.events.map((event) => <li key={event.id}><time>{date(event.created_at)}</time><div><strong>{event.store_name ?? "Fieldio"}</strong><span>{event.from_status && event.to_status ? `${label(event.from_status)} → ${label(event.to_status)}` : label(event.event_type)}</span>{event.carrier && <small>{event.carrier} · {event.tracking_reference}</small>}{event.note && <small>{event.note}</small>}</div></li>)}</ol> : <p>No order events recorded yet.</p>}</section>
        </>}</article>}
    </div>}
  </section>;
}
