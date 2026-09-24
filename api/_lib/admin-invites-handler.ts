import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireStaff } from "./admin.js";
import { sendTransactionalEmail } from "./email.js";
import { checkRateLimit, getAuthenticatedSupabase, handleApiError, json, readValidatedJson } from "./server.js";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().trim().email().max(254), role: z.enum(["admin", "editor", "fulfilment"]) }),
  z.object({ action: z.enum(["resend", "revoke"]), invitationId: z.string().uuid() }),
  z.object({ action: z.literal("accept"), token: z.string().min(40).max(500) })
]);

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function sendInvitation(email: string, role: string, token: string) {
  const url = new URL("/admin/invite", process.env.APP_URL);
  url.searchParams.set("token", token);
  return sendTransactionalEmail({
    to: email,
    subject: "You are invited to Fieldio Admin",
    heading: "Join the Fieldio admin team",
    message: `A Fieldio super admin invited you as ${role === "fulfilment" ? "fulfilment staff" : role}. Sign in or create an account with this email, then accept the invitation. This link expires in 72 hours.`,
    action: { label: "Accept invitation", url: url.href }
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!await checkRateLimit(request, 10, 60_000)) return json({ error: "Invitation requests are temporarily limited. Wait a minute and try again." }, 429);
  try {
    const input = await readValidatedJson(request, schema);
    if (input.action === "accept") {
      const { client } = await getAuthenticatedSupabase(request);
      const { data, error } = await client.rpc("accept_admin_invitation", { p_token_hash: hashToken(input.token) });
      if (error?.message.includes("INVITATION_EMAIL_MISMATCH")) return json({ error: "Sign in with the email address that received this invitation." }, 403);
      if (error?.message.includes("INVITATION_INVALID")) return json({ error: "This invitation is invalid, expired, or already used." }, 410);
      if (error) throw error;
      return json({ role: data });
    }

    const { admin, user } = await requireStaff(request, ["owner"]);
    if (!process.env.APP_URL || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return json({ error: "Admin invitations are not configured." }, 503);
    if (input.action === "revoke") {
      const { data, error } = await admin.from("admin_invitations").update({ status: "revoked" }).eq("id", input.invitationId).eq("status", "pending").select("id").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "This invitation is no longer pending." }, 409);
      await admin.from("audit_logs").insert({ actor_id: user.id, action: "REVOKE", entity_type: "admin_invitation", entity_id: input.invitationId });
      return json({ revoked: true });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    if (input.action === "invite") {
      const email = input.email.toLowerCase();
      const existing = await admin.from("admin_users").select("user_id").ilike("email", email).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return json({ error: "This email already has admin access." }, 409);
      await admin.from("admin_invitations").update({ status: "revoked" }).ilike("email", email).eq("status", "pending");
      const { data, error } = await admin.from("admin_invitations").insert({ email, role: input.role, token_hash: hashToken(token), invited_by: user.id, expires_at: expiresAt }).select("id,email,role,expires_at,status,created_at").single();
      if (error) throw error;
      const sent = await sendInvitation(email, input.role, token);
      await admin.from("audit_logs").insert({ actor_id: user.id, action: "INVITE", entity_type: "admin_invitation", entity_id: data.id, metadata: { role: input.role, email } });
      return sent ? json({ invitation: data }, 201) : json({ error: "The invitation was saved but the email provider did not accept it. Use resend." }, 502);
    }

    const { data: invitation, error } = await admin.from("admin_invitations").update({ token_hash: hashToken(token), expires_at: expiresAt }).eq("id", input.invitationId).eq("status", "pending").select("id,email,role,expires_at,status,created_at").maybeSingle();
    if (error) throw error;
    if (!invitation) return json({ error: "This invitation is no longer pending." }, 409);
    const sent = await sendInvitation(invitation.email, invitation.role, token);
    await admin.from("audit_logs").insert({ actor_id: user.id, action: "RESEND", entity_type: "admin_invitation", entity_id: invitation.id });
    return sent ? json({ invitation }) : json({ error: "The invitation was renewed but the email provider did not accept it. Try again." }, 502);
  } catch (error) { return handleApiError(error); }
}
