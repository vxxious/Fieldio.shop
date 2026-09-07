# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, React Router, Tailwind CSS, Zustand, TanStack Query, React Hook Form, Zod, GSAP, Framer Motion, Node.js, Express, Supabase, and PostgreSQL. Deployment targets are a Vercel-compatible frontend/API and Supabase for database, authentication, and storage.

## Users

Fieldio serves fashion customers shopping for clothing and accessories, customers seeking luxury products through a personal shopper, and wholesale buyers. Administrators maintain catalog, editorial content, inventory, enquiries, and order-request status.

## Product Purpose

Fieldio is a new fashion commerce brand. Customers browse products, select variants, build a cart, provide the minimum fulfilment details, and hand a structured order request to Fieldio on WhatsApp. Success means the customer can complete that journey confidently without the site implying that payment or inventory confirmation has happened online.

## Positioning

Everything fashion with worldwide shipment, combining an editorial shopping experience with direct personal-shopping and wholesale support. Fieldio's confirmed tagline is: “Your Personal Shopper for Luxury Brands: Exceptional Style, Delivered to Your Doorstep.”

## Operating Context

The launch journey is: Browse products → View product → Select size or variant → Add to cart → Review cart → Checkout → Generate WhatsApp order message → Continue the purchase conversation with Fieldio on WhatsApp. Order requests remain awaiting confirmation until Fieldio confirms availability, shipping, and payment. WhatsApp contact: +44 7344 059705. Instagram: https://www.instagram.com/fieldio_wrd/.

## Capabilities and Constraints

- No payment gateway, card form, online payment processing, paid-order state, or payment-success message at launch.
- Customer cart is persisted locally with structured product and variant data. Final server-side order creation must recalculate pricing from trusted catalog data when Supabase is connected.
- Order statuses are Order Request, Awaiting Confirmation, Confirmed, Processing, Shipped, Delivered, and Cancelled.
- Customer features include catalog, collections, product detail, search, wishlist, account-ready routes, cart, validated checkout details, WhatsApp order generation, personal shopping, wholesale, contact, newsletter, legal pages, and accessible responsive navigation.
- Admin features remain intentionally functional: catalog, brands, categories, collections, inventory, editorial content, order requests, customers, and subscribers.
- Products, prices, brand assets, and photography must only use material Fieldio has permission to use. Demo catalog content must be clearly replaceable and must not pretend to be an active inventory feed.
- Do not use Lucide or another large generic icon library. Interface icons are small reusable inline SVG components.
- WCAG 2.2 AA principles, reduced motion, keyboard parity, and responsive behavior are required.

## Brand Commitments

The brand name is Fieldio. It must feel minimal, premium, editorial, sophisticated, and intentional rather than like a generic ecommerce template or dashboard. Supplied mockups and inspiration are the primary visual source of truth. Preserve their hard-edged image composition, whitespace, restrained controls, typography hierarchy, navigation placement, section rhythm, motion direction, and responsive recomposition. Avoid visual clutter, SaaS cards, excessive rounding, shadows, gradients, buttons, and animation.

## Evidence on Hand

- Four supplied editorial ecommerce mockups in the user's Downloads folder establish the visual direction for homepage, catalog, product detail, and mobile layouts.
- The official interlocking F/O monogram was supplied on 6 September 2026. Use the original artwork in `public/brand/fieldio-original.jpg`; the decorative starburst has been removed. Web and favicon derivatives may crop whitespace and resize without redrawing or altering the mark.
- No Fieldio product catalog, licensed product photography, customer testimonials, prices, or production credentials were supplied. The build must not fabricate these as live business claims.

## Product Principles

1. Commerce stays honest: a checkout creates an order request and moves the conversation to WhatsApp.
2. Editorial imagery and typography lead; commerce controls remain quiet and precise.
3. Every launch flow works without a mouse and remains legible across mobile, tablet, and desktop.
4. Catalog, pricing, and order architecture remain replaceable by trusted Supabase data without rebuilding the UI.
5. External services fail clearly and never expose credentials or simulate success.

## Accessibility & Inclusion

Target WCAG 2.2 AA principles. Provide semantic structure, visible focus, labelled forms, keyboard navigation, focus trapping and restoration for modal surfaces, screen-reader announcements, sufficient contrast, touch-friendly controls, and `prefers-reduced-motion` behavior.
