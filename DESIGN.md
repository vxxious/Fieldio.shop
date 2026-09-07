---
name: "Fieldio"
description: "A restrained editorial catalog for worldwide fashion sourcing and personal shopping."
colors:
  paper: "#f6f6f3"
  surface: "#ffffff"
  ink: "#151612"
  muted: "#66685f"
  line: "#d9dad4"
  line-dark: "#acada6"
  moss: "#727863"
  oxblood: "#5a1721"
  focus: "#315ee7"
  error: "#9f2635"
  image-placeholder: "#e5e5e1"
  inverse-muted: "#c9cabf"
  footer-muted: "#aeb0a8"
  footer-line: "#3b3c37"
  scrim: "rgba(17, 18, 15, 0.44)"
typography:
  display:
    fontFamily: '"Schibsted Grotesk", sans-serif'
    fontSize: "clamp(44px, 6vw, 92px)"
    fontWeight: 500
    lineHeight: 0.92
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Schibsted Grotesk", sans-serif'
    fontSize: "clamp(35px, 4.5vw, 68px)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Schibsted Grotesk", sans-serif'
    fontSize: "24px"
    fontWeight: 500
    letterSpacing: "-0.035em"
  body:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "10px"
    fontWeight: 400
    letterSpacing: "0.02em"
rounded:
  square: "0"
  circle: "50%"
spacing:
  micro: "6px"
  compact: "9px"
  small: "14px"
  medium: "24px"
  large: "30px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "13px 24px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "13px 24px"
    height: "46px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 20px"
    height: "44px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "13px"
  product-badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "6px 9px"
  variant-option:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    height: "42px"
  variant-option-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    height: "42px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "6px"
    size: "34px"
  rail-control:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    size: "44px"
  rail-control-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    size: "44px"
  quick-size-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "5px"
    size: "34px"
  accordion-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "16px 0"
  separator:
    backgroundColor: "{colors.line}"
    rounded: "{rounded.square}"
    height: "1px"
    width: "100%"
---

# Design System: Fieldio

## Overview

**Creative North Star: "The Catalog Index"**

Fieldio behaves like a precise fashion index rather than a conventional promotional storefront. A compact centered masthead gives way to image-led collection stories, oversized editorial type, filters, and tightly aligned product imagery. Collection and product surfaces now extend the index language through asymmetric hero compositions, masked reveals, structured product information, and horizontally browsable recommendations.

The atmosphere is minimal, premium, editorial, assured, globally minded, and restrained. Warm paper, near-black ink, quiet utility copy, square image fields, and exact hairline rules establish the world; controlled scale and whitespace provide luxury without ornament. Accessible Shadcn and Radix primitives are restyled into this geometry instead of importing their default visual personality. The interface stays honest about its service model by presenting checkout as a request that continues with a personal shopper on WhatsApp.

**Key Characteristics:**

- Editorial imagery carries the strongest visual weight.
- Typography moves between monumental display statements and compact commerce metadata.
- Square edges, flush grids, and hairline rules create rigor.
- Controls remain quiet, exact, and accessible.
- Collection heroes use four intentional compositions: split, reverse, index, and cinematic.
- Shadcn and Radix provide behavior while Fieldio tokens, square geometry, and custom inline icons provide identity.
- Motion uses masked vertical reveals, clipped image entrances, and short directional drawer transitions; every effect is removable.

## Colors

The palette is a mineral-white and near-black neutral system, with muted moss and oxblood reserved for restrained semantic or photographic warmth rather than decorative saturation.

### Primary

- **Near-Black Ink:** The primary voice for text, filled actions, the announcement bar, selection, and inverse footer surfaces.

### Secondary

- **Muted Moss:** A restrained confirmation accent used for the prepared-request status boundary.
- **Deep Oxblood:** A reserved brand accent available to support editorial warmth without becoming a default control color.

### Neutral

- **Mineral Paper:** The site canvas and drawer surface; its slight warmth prevents the catalog from feeling clinical.
- **Clean Surface:** White inset surfaces, fields, filter controls, and selected editorial panels.
- **Utility Gray:** Secondary copy, supporting metadata, and de-emphasized actions.
- **Hairline:** Quiet separators that structure content without cards or shadow.
- **Strong Hairline:** Higher-contrast field borders, section boundaries, and compact controls.
- **Image Placeholder:** A neutral media field used while photography is absent or loading.
- **Inverse Muted and Footer Muted:** Supporting copy on dark surfaces.
- **Footer Line:** The subdued divider used inside the inverse footer.
- **Accessible Focus Blue:** A visible keyboard-only focus outline kept distinct from the brand palette.
- **Error Oxblood:** Validation copy and failure messaging.
- **Scrim Ink:** The translucent backdrop behind modal drawers and mobile navigation.

### Named Rules

**The Paper-and-Ink Rule.** Default interfaces to Mineral Paper, Clean Surface, Near-Black Ink, and hairline neutrals; accents must remain exceptional.

**The Accessible Exception Rule.** Accessible Focus Blue may interrupt the neutral world because keyboard clarity outranks palette purity.

## Typography

**Display Font:** Schibsted Grotesk (with sans-serif fallback)
**Body Font:** Manrope (with sans-serif fallback)

**Character:** Schibsted Grotesk supplies compact editorial authority at large scales, while Manrope keeps navigation, commerce detail, forms, and prices calm and legible. Both are sans serif, so hierarchy comes from scale, density, and tracking rather than decorative contrast.

### Hierarchy

- **Display** (500, fluid from 44px to 92px, 0.92 line-height): Opening catalog and checkout statements; keep lines short and balanced.
- **Headline** (500, fluid from 35px to 68px, 0.98 line-height): Editorial sections, service propositions, and major supporting moments.
- **Title** (500, 24px): Compact section and drawer headings.
- **Body** (400, 13px, 1.55 line-height): Explanatory copy, typically constrained to roughly 48–62 characters for reading comfort.
- **Label** (400, 10px, 0.02em tracking): Product brands, state labels, form labels, and compact metadata.

### Named Rules

**The Scale-Does-the-Talking Rule.** Keep the type palette restrained; create hierarchy through decisive size changes, tight display tracking, and disciplined line length.

**The Quiet-Commerce Rule.** Product names, prices, form labels, and controls stay compact so imagery and editorial headlines retain authority.

## Layout

The primary page container is fluid with 20px side gutters and a 1600px ceiling. At widths up to 1050px the gutters become 16px; at 760px and below they become 14px. The header uses a three-part grid with the Fieldio mark centered independently between primary navigation and utilities.

The catalog is a four-column image index with a fluid 10–18px gap, reducing to three columns below 1050px and two columns with a 9px gap on mobile. Product media uses a tall 4:5.25 proportion on larger screens and 3:4 on mobile. Collection pages begin with a white editorial hero, 520–760px tall, using one of four actual variants: a narrow-copy/wide-image split; its image-left reverse; an index with a full-width copy row above a full-width image; or a cinematic image with copy overlaid on a translucent ink block. At 760px, split, reverse, and index heroes become image-first stacks, while cinematic heroes retain the overlay composition.

Product detail pairs a broad image gallery with a narrow sticky purchase column. A full-width Details / Fit chapter follows: display headline and summary above a three-column ledger for fit and sizing, composition, and care and delivery. The recommendation area is a keyboard-focusable horizontal snap rail showing three cards at a time, advancing by 78% of the visible width, with disabled previous/next states and optional inline quick-add size controls. Below 760px the gallery becomes a full-width horizontal snap sequence, the purchase panel returns to normal flow, the ledger becomes a bordered vertical list, and the recommendation rail exposes 78vw cards. A sticky bottom purchase bar appears only after the primary controls leave the viewport and reports the selected variant, quantity, bag count, and bag total beside its disabled-aware Add to bag action. Checkout uses an asymmetric two-column form and order review, then reverses into a single-column mobile flow so the order summary precedes the form.

**The Above-the-Fold Catalog Rule.** Preserve the direct path from centered masthead to category controls and product imagery; do not insert an oversized generic hero before shopping begins.

## Elevation & Depth

The system is flat by default and defines depth without box shadows. White or paper-toned layers, image cropping, hairline borders, sticky positioning, and translucent modal scrims separate planes. The cart and mobile navigation enter laterally over the scrim, but their panels remain flat and square.

Motion is editorial and mask-led. Display words rise from 112% below individual overflow masks over 0.72 seconds with a 0.045-second stagger and `power4.out`, triggering once when their text reaches 88% of the viewport. Collection hero media reveals upward through a clipped inset over 0.78 seconds with `power4.inOut`; product gallery images use the same clipping model over 0.72 seconds with a 0.08-second stagger. Product-card images scale to 1.025 over 0.55 seconds with a cubic-bezier curve of `(0.16, 1, 0.3, 1)`.

Route changes use `AnimatePresence` in wait mode and key the main region by pathname. The incoming route moves from 18px below with a 3% bottom clip and zero opacity over 0.44 seconds; the outgoing route moves 8px upward and clears over 0.18 seconds. Both use the editorial cubic-bezier curve `(0.23, 1, 0.32, 1)`. On each pathname change, `AppLayout` waits for the new pathname-keyed `main` and its `h1`, focuses `main` with `preventScroll`, and announces the destination through `#status-region`. Reusable `Reveal` wrappers enter from 24px below over 0.62 seconds with the same curve, trigger once with an 8% negative viewport margin, and become static when reduced motion is active.

The GSAP motion director binds once per element within the current main region. Unmasked headings enter from 24px below with opacity and a full bottom clip over 0.72 seconds using `power4.out`, starting at 90% of the viewport. Selected structural sections enter from 28px below over 0.64 seconds with `power3.out`, starting at 88%. Product-grid cards enter from 18px below over 0.48 seconds with a 0.055-second stagger and `power3.out`, starting at 90%. Elements containing `EditorialText` and screen-reader-only headings are excluded from generic heading motion so effects never stack.

A mutation observer schedules binding through one animation frame and refreshes `ScrollTrigger`, so lazy-loaded routes, products, and asynchronous content receive the same one-time motion after insertion. A `data-motion-bound` marker prevents rebinding, and route cleanup disconnects the observer, cancels the frame, and kills registered animations. Fine-pointer, motion-permitted devices additionally use Lenis wheel smoothing at a duration of 1.05; coarse pointers and reduced-motion users retain native scrolling.

Cart motion is deliberately faster than editorial reveal motion. Opening fades the scrim over 0.22 seconds while the panel enters over 0.28 seconds with `power4.out`; rows arrive over 0.22 seconds with a 0.04-second stagger, and summary items over 0.2 seconds with a 0.035-second stagger. Closing moves the panel out over 0.24 seconds with `power4.inOut` while the scrim clears over 0.2 seconds. Row removal takes 0.24 seconds and quantity-price feedback 0.16 seconds. The root `MotionConfig` uses `reducedMotion="user"`; CSS transitions collapse to 0.01ms, Framer Motion entrances resolve immediately, GSAP reveals are skipped, rails use immediate scrolling, and smooth wheel behavior is disabled when the user requests reduced motion.

### Named Rules

**The No-Shadow Rule.** Do not add ambient card shadows or floating-panel shadows; use tonal separation, rules, cropping, and overlay scrims.

**The Motion-Explains-Depth Rule.** Lateral drawer movement and image-scale response may clarify hierarchy, but resting surfaces stay visually still.

**The Masked-Reveal Rule.** Reveal editorial words and image fields through their own bounds; do not fade entire page sections as undifferentiated blocks.

**The One-Binding Rule.** Every directed scroll reveal runs once and receives one owner; use the motion-bound marker and selector exclusions to prevent duplicate effects.

## Shapes

Fieldio is hard-edged and architectural. Buttons, fields, cards, media, drawers, variant selectors, and content panels use square corners. Borders are generally single-pixel hairlines. The only recurring circular forms are compact icon utilities, wishlist controls, and count indicators; circles signal a small atomic action, not a container style.

**The Square-Field Rule.** Keep commerce surfaces and image frames unrounded; reserve the full circle for compact icon-sized controls and counters.

## Components

### Buttons

- **Shape:** Hard-edged rectangle with no corner radius.
- **Primitive:** Use the Shadcn `Button`, backed by Radix `Slot` for `asChild` composition and CVA for variants. Its default height is 44px with 20px horizontal padding; large actions are 46px high with 24px horizontal padding. Text is 11px, normal weight, and never rounded.
- **Primary:** Near-Black Ink fill, Clean Surface text, and a one-pixel ink border. Hover reverses to transparent with ink text.
- **Outline / Secondary / Ghost:** Outline starts transparent with a Strong Hairline and inverts on hover; secondary uses a white surface and Hairline border; ghost is borderless and inverts to ink on hover.
- **Link:** Auto height, zero padding, ink text, and a four-pixel underline offset; hover removes the underline.
- **Interaction:** Color, background, border, opacity, and transform transition over 150ms. Non-popup active buttons move down one pixel. Shadcn buttons do not add a component ring; they inherit Fieldio's single global two-pixel Accessible Focus Blue outline with a three-pixel offset. Disabled buttons block pointer interaction and use 45% opacity.
- **Text / Arrow:** Underlined text links and arrow links remain visually light; arrows create direction without turning every action into a filled button.

### Accordion

Use the Radix Accordion primitive for disclosure semantics and state. Product details use a single, collapsible group with Description open by default. Each item ends in a one-pixel Hairline; the 11px trigger spans the full width with 16px vertical padding and relies on Fieldio's single global focus outline rather than adding a component ring. The custom 16px Chevron rotates 180 degrees over 200ms when open. Content is clipped while the Shadcn accordion height animation runs, and its muted 11px body copy uses relaxed leading and 16px bottom padding; `motion-reduce` removes the content animation.

### Separator

Use the Radix Separator primitive for intentional rules rather than ad hoc decorative borders. It is decorative by default, accepts horizontal or vertical orientation, and always resolves to a one-pixel Hairline: full width and one pixel tall horizontally, or full height and one pixel wide vertically.

### Icons

Use only Fieldio's small inline SVG components. The shared drawing language is a 24px view box, no fill, current-color strokes at 1.5px, and rounded line caps and joins. Icons are `aria-hidden`; the surrounding link or button owns the accessible name. Do not introduce Lucide, icon fonts, or another generic icon package.

### Chips

- **Style:** Variant options are adjoining square cells with a Strong Hairline border and a 42px minimum height. Small status badges use Mineral Paper with compact 6px by 9px padding.
- **State:** Selected variants invert to Near-Black Ink with white text. Disabled variants fade, while focus uses the global visible outline.

### Cards / Containers

- **Corner Style:** Square media and content edges.
- **Background:** Product cards sit directly on Mineral Paper; imagery occupies a neutral placeholder field until available.
- **Shadow Strategy:** None. Product grouping is created by a fixed image ratio, metadata alignment, and whitespace.
- **Border:** Product cards are borderless; ledger rows, notices, and form-like containers use hairlines.
- **Internal Padding:** Product metadata begins 12px below media on larger screens and 10px below it on mobile.
- **Behavior:** Product imagery scales subtly to 1.025 on hover over 0.55 seconds with a restrained editorial ease, and the effect is removed when reduced motion is requested.

### Inputs / Fields

- **Style:** White square fields with a one-pixel Strong Hairline border and 13px padding. Labels are compact and inputs remain full width.
- **Focus:** The shared two-pixel Accessible Focus Blue outline with a three-pixel offset remains visible for keyboard users.
- **Error / Disabled:** Validation messages use Error Oxblood at 9px. Disabled controls reduce opacity without hiding their label or selected value.

### Navigation

The 74px desktop masthead uses compact 12px links arranged around the independently centered Fieldio wordmark. Active links are underlined with a five-pixel underline offset. At 760px, the header becomes 66px tall, primary links move into a full-screen paper-toned menu, and utility actions compress visually while preserving minimum 44px by 44px hit areas and global focus behavior.

### Product Card

The product card is the signature index unit: tall flush imagery, a small paper badge, one circular wishlist action, then compact brand, name, price, and request action aligned beneath. Wishlist actions retain a minimum 44px by 44px hit area on mobile. In the related-products rail, the action becomes Quick add or Quick request. Multi-variant products disclose square 34px size choices in a wrapped row; mobile enlarges them to 44px touch targets. It should read like catalog notation attached to an image, not like a boxed ecommerce tile.

### Collection Editorial Hero

Collection heroes share one white, square-edged frame and four content-driven layouts. Split places copy left and the larger media field right; reverse swaps their order and uses a 54% horizontal image focal point; index places a two-column copy row over full-width media focused at 38% vertically; cinematic overlays a white title and muted-light statement on a 54% ink panel covering no more than 46% or 650px. The media clip reveals over 0.78 seconds and is static under reduced motion.

### Editorial Text

Display phrases are split into visually masked words with a `0.14em` gap while an intact screen-reader-only copy preserves natural pronunciation. Each word rises into view once as it enters the viewport. Focal headline measures remain deliberately constrained—10ch for the catalog statement, 8ch for collection and Details / Fit headings, 12ch for the brand ledger and campaign statement, and 9ch for service leads—with the narrower mobile measures preserved where defined so animation never disturbs line balance. Never expose the duplicated visual words to assistive technology, and never hide the complete accessible string.

### Product Details / Fit Ledger

The Details / Fit chapter uses a full-width ink rule, a large masked heading, and a right-aligned supporting statement. The three ledger cells are separated by Strong Hairlines and carry compact Manrope headings above muted copy. On mobile the cells become a single vertical sequence with bottom dividers.

### Related Products Rail

The rail is an ordered, keyboard-focusable horizontal snap region. Desktop cards are at least 280px wide and resolve to three visible columns; mobile cards are at least 230px and occupy 78vw. Arrow controls are square 44px cells, invert to ink on hover, expose disabled endpoints, and advance by 78% of the viewport. Left and right arrow keys provide parity, and reduced motion changes smooth scrolling to immediate movement.

### Mobile Purchase Bar

After the original purchase controls scroll above the viewport, a fixed paper bar appears at the bottom on screens up to 760px. It presents a truncated product name plus two metadata lines for selection, quantity, bag count, and total, with a 44px minimum Add to bag action and safe-area-aware bottom padding. The action stays disabled until a valid, available variant is selected.

### Cart Drawer

The cart is a flat paper panel up to 520px wide over a translucent ink scrim. Hairline-separated rows combine a 112px by 140px image with compact details and a bordered quantity stepper. The panel enters from the right, stages its rows and summary in short sequences, traps focus, restores focus on close, kills conflicting panel or scrim tweens before exit, and removes its animation for reduced-motion users.

## Do's and Don'ts

### Do:

- **Do** lead with editorial photography, display typography, and product access in the first viewport.
- **Do** preserve the centered masthead, rigorous alignment, square image fields, and thin rules of The Catalog Index.
- **Do** keep controls compact while maintaining accessible focus and touch-friendly behavior.
- **Do** recompose four-column desktop catalogs into two-column mobile indexes and stack split editorial sections deliberately.
- **Do** choose among split, reverse, index, and cinematic collection heroes according to the available editorial image and statement.
- **Do** preserve keyboard arrow navigation, scroll snapping, disabled endpoints, and immediate reduced-motion scrolling in horizontal rails.
- **Do** keep the Details / Fit content in an editorial ledger and preserve the sticky bar's live purchase context on mobile.
- **Do** use the Shadcn Button and Radix Accordion or Separator primitives where their behaviors apply, then preserve Fieldio's square tokens and restrained states.
- **Do** let MotionDirector observe and bind asynchronous content while retaining one-time triggers and selector exclusions.
- **Do** keep custom SVG icons subordinate to text and give their containing controls explicit accessible names.
- **Do** use short, directional motion and honor `prefers-reduced-motion` everywhere.

### Don't:

- **Don't** introduce rounded cards, pill-heavy interfaces, gradients, or decorative shadows.
- **Don't** place a generic oversized commerce hero between the masthead and the catalog.
- **Don't** let accent colors compete with the paper-and-ink foundation or editorial photography.
- **Don't** inflate product metadata, utility navigation, or checkout controls into the dominant visual layer.
- **Don't** animate duplicate accessible text or allow masked visual words to replace the intact screen-reader label.
- **Don't** make quick add bypass variant choice, inventory-disabled states, or the cart drawer confirmation.
- **Don't** restore Shadcn's rounded defaults, default theme personality, or generic iconography.
- **Don't** bind a generic heading reveal to an `EditorialText` heading or animate the same element from both Reveal and MotionDirector.
- **Don't** assume the first render contains every motion target; lazy-loaded and queried content must remain eligible for one-time binding.
- **Don't** imply that checkout confirms inventory, shipping, or payment; the interface prepares an order request for WhatsApp.
