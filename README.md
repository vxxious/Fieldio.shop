# Fieldio

Fieldio is a production-oriented fashion storefront for a launch-stage personal-shopping brand. Customers browse an editorial catalog, choose a variant, build a bag, provide delivery details, and continue the request with Fieldio on WhatsApp. The application deliberately contains no card gateway and never presents an order request as paid.

## Stack

- React 19, TypeScript, Vite, React Router
- Tailwind CSS 4 and project CSS variables
- GSAP, ScrollTrigger, Framer Motion, and Lenis
- Zustand for persisted bag and wishlist state
- TanStack Query for catalog state
- React Hook Form and Zod for validated forms
- Supabase Auth, PostgreSQL, Storage, and Row Level Security
- Vercel-compatible server handlers and Resend newsletter sync
- Vitest, React Testing Library, and Playwright

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

The interface falls back to an explicitly local preview catalog when Supabase is not configured. It uses original, unbranded editorial placeholders so the complete experience can be reviewed. Replace that preview data with Fieldio-authorised product records and photography before launch; do not publish scraped brand catalogs.

## Supabase

1. Create a Supabase project and apply `supabase/migrations/202609050001_initial_fieldio_schema.sql`.
2. Set the public URL and anonymous key in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the server deployment environment.
4. Create the first account through the application, then add that user's UUID to `public.admin_users` with the `owner` role from a trusted SQL session.
5. Configure the desired email/password and OAuth providers in Supabase Auth, including the production callback URL.

The browser reads only active catalog rows permitted by RLS. Order requests are created through the server handler, which revalidates product and variant IDs and recalculates every priced line from PostgreSQL. The service-role key is never sent to the client.

## Email and analytics

Newsletter subscribers are stored in Supabase. To also sync confirmed subscribers with Resend, configure `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` in the server environment. `VITE_ANALYTICS_ID` is a deployment placeholder for the selected consent-aware analytics provider; no personal data is sent by the included event adapter.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Deployment

The repository includes `vercel.json` for Vite routes, cache headers, security headers, and the `/api/*` handlers. Configure all production environment variables in the hosting dashboard, apply the database migration, populate authorised catalog content, verify OAuth redirect URLs, and review the launch policy copy with Fieldio's legal adviser before going live.

The WhatsApp destination is fixed to Fieldio's international number, `447344059705`. The generated request states that availability, shipping, and payment still require confirmation.

## Key paths

- `src/data/catalog.ts` — local visual-review catalog only
- `src/hooks/useCatalog.ts` — Supabase-backed product query and mapping
- `src/store/cart.ts` — persisted structured bag state
- `src/lib/whatsapp.ts` — WhatsApp request generation
- `api/order-requests.ts` — trusted order-request persistence
- `supabase/migrations/202609050001_initial_fieldio_schema.sql` — schema, indexes, functions, Storage, and RLS
- `.impeccable/prompts/` — prompts for every generated editorial image
- `PRODUCT.md` — product and design source of truth
