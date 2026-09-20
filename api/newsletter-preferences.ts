import { escapeHtml, sendTransactionalEmail } from "./_lib/email.js";
import { preferenceToken, readPreferenceToken } from "./_lib/newsletter.js";
import { checkRateLimit, getAdminSupabase } from "./_lib/server.js";

interface PreferencePage {
  title: string;
  message: string;
  action?: string;
  returnHref?: string;
  returnLabel?: string;
}

export function renderPreferencePage({ title, message, action, returnHref = "/", returnLabel = "Return to Fieldio" }: PreferencePage) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const primaryAction = action
    ? `<form method="post"><button type="submit">${escapeHtml(action)}</button></form>`
    : `<a class="primary-link" href="${escapeHtml(returnHref)}">${escapeHtml(returnLabel)}</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#f6f6f3" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#11120f" media="(prefers-color-scheme: dark)">
  <title>${safeTitle} | Fieldio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&amp;family=Schibsted+Grotesk:wght@500;600&amp;display=swap" rel="stylesheet">
  <style>
    :root{color-scheme:light dark;--paper:#f6f6f3;--surface:#fff;--ink:#151612;--muted:#66685f;--line:#d9dad4;--focus:#315ee7}
    *{box-sizing:border-box}
    html,body{min-height:100%;margin:0}
    body{background:var(--paper);color:var(--ink);font-family:"Manrope",Arial,sans-serif;-webkit-font-smoothing:antialiased}
    .page{width:min(1120px,calc(100% - 40px));min-height:100svh;margin:0 auto;display:grid;grid-template-rows:auto 1fr auto}
    .masthead{min-height:88px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand{display:inline-flex;align-items:center;gap:13px;color:var(--ink);text-decoration:none;font-family:"Schibsted Grotesk",Arial,sans-serif;font-size:24px;font-weight:600;letter-spacing:-.035em}
    .brand img{display:block;width:40px;height:40px;mix-blend-mode:difference}
    .section-name{margin:0;color:var(--muted);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
    main{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.55fr);gap:clamp(48px,9vw,136px);align-items:end;padding:clamp(68px,11vw,150px) 0}
    h1{max-width:9ch;margin:0;font-family:"Schibsted Grotesk",Arial,sans-serif;font-size:clamp(44px,6vw,92px);font-weight:500;line-height:.92;letter-spacing:-.04em;text-wrap:balance}
    .action-panel{border-top:1px solid var(--ink);padding-top:24px}
    .action-panel p{max-width:34rem;margin:0;color:var(--muted);font-size:13px;line-height:1.65}
    form{margin:30px 0 0}
    button,.primary-link{min-height:52px;margin-top:30px;border:1px solid var(--ink);border-radius:0;background:var(--ink);color:var(--surface);display:inline-flex;align-items:center;justify-content:center;padding:15px 26px;font:600 13px/1 "Manrope",Arial,sans-serif;text-decoration:none;cursor:pointer;transition:background-color .15s,color .15s}
    form button{margin-top:0}
    button:hover,.primary-link:hover{background:transparent;color:var(--ink)}
    button:focus-visible,.primary-link:focus-visible,.brand:focus-visible,.text-link:focus-visible{outline:2px solid var(--focus);outline-offset:4px}
    .text-link{display:inline-block;margin-top:22px;color:var(--ink);font-size:13px;text-underline-offset:4px}
    footer{min-height:72px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:24px;color:var(--muted);font-size:10px}
    footer a{color:var(--ink);text-underline-offset:4px}
    ::selection{background:var(--ink);color:var(--surface)}
    @media (max-width:760px){
      .page{width:calc(100% - 28px)}
      .masthead{min-height:72px}
      .section-name{display:none}
      main{grid-template-columns:1fr;align-content:center;align-items:start;gap:54px;padding:64px 0 72px}
      h1{max-width:8ch;font-size:clamp(44px,12vw,68px)}
      .action-panel{padding-top:20px}
      button,.primary-link{width:100%}
      footer{min-height:86px;align-items:flex-start;padding:22px 0}
    }
    @media (prefers-color-scheme:dark){
      :root{--paper:#11120f;--surface:#f6f6f3;--ink:#f6f6f3;--muted:#c9cabf;--line:#3b3c37;--focus:#7e9aff}
      button,.primary-link{color:#11120f}
      button:hover,.primary-link:hover{color:var(--ink)}
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <a class="brand" href="/" aria-label="Fieldio home"><img src="/brand/fieldio-email-logo.png" width="40" height="40" alt=""><span>Fieldio</span></a>
      <p class="section-name">Email preferences</p>
    </header>
    <main>
      <h1>${safeTitle}</h1>
      <section class="action-panel" aria-label="Email preference action">
        <p>${safeMessage}</p>
        ${primaryAction}
        ${action ? '<a class="text-link" href="/">Return to Fieldio</a>' : ""}
      </section>
    </main>
    <footer><span>Fieldio &middot; Worldwide fashion sourcing</span><a href="/privacy">Privacy</a></footer>
  </div>
</body>
</html>`;
}

function page(options: PreferencePage, status = 200) {
  return new Response(renderPreferencePage(options), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
  });
}

export async function GET(request: Request) {
  if (!await checkRateLimit(request, 30)) return page({ title: "Please wait a moment.", message: "Too many requests were made from this connection. Try the link again in one minute." }, 429);
  try {
    const { action } = readPreferenceToken(new URL(request.url).searchParams.get("token") || "");
    return action === "subscribe"
      ? page({ title: "Join the Fieldio list.", message: "Confirm your email to receive new arrivals, exceptional finds, and selected brand updates—sent with restraint.", action: "Confirm subscription" })
      : page({ title: "Leave the Fieldio list?", message: "Confirm below and we will stop sending Fieldio marketing emails to this address.", action: "Unsubscribe" });
  } catch {
    return page({ title: "This link has expired.", message: "Request a fresh confirmation link from the newsletter form on Fieldio.", returnHref: "/#newsletter", returnLabel: "Request a new link" }, 400);
  }
}

export async function POST(request: Request) {
  if (!await checkRateLimit(request)) return page({ title: "Please wait a moment.", message: "Too many requests were made from this connection. Try the link again in one minute." }, 429);

  let preference: ReturnType<typeof readPreferenceToken>;
  try {
    preference = readPreferenceToken(new URL(request.url).searchParams.get("token") || "");
  } catch {
    return page({ title: "This link has expired.", message: "Request a fresh confirmation link from the newsletter form on Fieldio.", returnHref: "/#newsletter", returnLabel: "Request a new link" }, 400);
  }

  try {
    const db = getAdminSupabase();
    if (!db) throw new Error("UNAVAILABLE");
    const { id, action } = preference;
    const { data, error } = await db.from("newsletter_subscribers").select("email,status").eq("id", id).single();
    if (error || !data) throw new Error("NOT_FOUND");
    const unsubscribed = action === "unsubscribe";
    const { error: updateError } = await db.from("newsletter_subscribers").update({ status: unsubscribed ? "unsubscribed" : "subscribed", unsubscribed_at: unsubscribed ? new Date().toISOString() : null }).eq("id", id);
    if (updateError) throw updateError;

    if (!unsubscribed && data.status !== "subscribed") {
      const url = new URL("/api/newsletter-preferences", process.env.APP_URL);
      url.searchParams.set("token", preferenceToken(id, "unsubscribe"));
      await sendTransactionalEmail({ to: data.email, subject: "Welcome to the Fieldio list", heading: "You are on the Fieldio list", message: "Expect new arrivals, exceptional finds, and selected brand updates—sent with restraint.", action: { label: "Manage email preferences", url: url.href } });
    }

    return unsubscribed
      ? page({ title: "You are unsubscribed.", message: "You will no longer receive Fieldio marketing emails. You can join the list again at any time." })
      : page({ title: "You are on the list.", message: "Your subscription is confirmed. Watch your inbox for the Fieldio edit and selected updates." });
  } catch {
    return page({ title: "We could not update your preference.", message: "Try this link again. If the problem continues, contact Fieldio and we will help.", action: "Try again" }, 500);
  }
}
