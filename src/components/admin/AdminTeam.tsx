import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { authenticatedPost } from "../../lib/authenticated-api";
import { supabase } from "../../lib/supabase";

interface Invitation { id: string; email: string; role: string; status: string; expires_at: string; created_at: string }
interface Member { user_id: string; email: string | null; role: string; created_at: string }

export function AdminTeam({ currentUserId }: { currentUserId: string }) {
  const cache = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState("");
  const team = useQuery({ queryKey: ["admin-team"], queryFn: async () => {
    const [members, invitations] = await Promise.all([
      supabase!.from("admin_users").select("user_id,email,role,created_at").order("created_at"),
      supabase!.from("admin_invitations").select("id,email,role,status,expires_at,created_at").order("created_at", { ascending: false }).limit(50)
    ]);
    if (members.error || invitations.error) throw members.error || invitations.error;
    return { members: members.data as Member[], invitations: invitations.data as Invitation[] };
  } });
  async function action(body: Record<string, string>, success: string) {
    setWorking(body.invitationId ?? body.memberId ?? "invite"); setStatus("");
    try { await authenticatedPost("/api/admin/invites", body); setStatus(success); await cache.invalidateQueries({ queryKey: ["admin-team"] }); }
    catch (error) { setStatus(error instanceof Error ? error.message : "The admin invitation action failed."); }
    finally { setWorking(""); }
  }
  async function invite(event: FormEvent) { event.preventDefault(); await action({ action: "invite", email, role }, "Invitation sent."); setEmail(""); }
  async function remove(member: Member) {
    if (!window.confirm(`Remove ${member.email ?? "this admin"} from the Fieldio admin team?`)) return;
    await action({ action: "remove", memberId: member.user_id }, "Admin access removed.");
  }
  return <section className="admin-team"><header><div><h2>Admin team</h2><p>The owner is the super admin. Invitations expire after 72 hours and require the invited email.</p></div></header>
    <form className="admin-form admin-invite-form" onSubmit={(event) => void invite(event)}><label><span>Email address</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="admin">Admin — management</option><option value="editor">Editor — catalogue</option><option value="fulfilment">Fulfilment — orders</option></select></label><button className="primary-button" disabled={Boolean(working)}>{working === "invite" ? "Sending…" : "Invite admin"}</button></form>
    {status && <p className="form-message" role="status">{status}</p>}
    {team.isPending ? <p role="status">Loading admin team…</p> : team.error ? <p role="alert">Admin team could not load.</p> : <><section><h3>Active admins</h3><div className="admin-table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Added</th><th>Actions</th></tr></thead><tbody>{team.data.members.map((member) => <tr key={member.user_id}><td data-label="Email">{member.email ?? "Existing admin"}</td><td data-label="Role">{member.role === "owner" ? "Super admin" : member.role}</td><td data-label="Added">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(member.created_at))}</td><td data-label="Actions">{member.user_id === currentUserId ? "Current account" : <button className="text-link" type="button" disabled={Boolean(working)} onClick={() => void remove(member)}>{working === member.user_id ? "Removing…" : "Remove access"}</button>}</td></tr>)}</tbody></table></div></section>
    <section><h3>Invitations</h3>{team.data.invitations.length ? <div className="admin-table-wrap"><table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{team.data.invitations.map((invitation) => <tr key={invitation.id}><td data-label="Email">{invitation.email}</td><td data-label="Role">{invitation.role}</td><td data-label="Status">{invitation.status}</td><td data-label="Expires">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expires_at))}</td><td data-label="Actions">{invitation.status === "pending" && <><button className="text-link" type="button" disabled={Boolean(working)} onClick={() => void action({ action: "resend", invitationId: invitation.id }, "Invitation resent with a new secure link.")}>{working === invitation.id ? "Working…" : "Resend"}</button><button className="text-link" type="button" disabled={Boolean(working)} onClick={() => void action({ action: "revoke", invitationId: invitation.id }, "Invitation revoked.")}>Revoke</button></>}</td></tr>)}</tbody></table></div> : <p>No invitations yet.</p>}</section></>}
  </section>;
}
