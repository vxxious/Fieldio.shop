begin;

create temporary table brand_catalog_seed (
  brand_name text not null,
  brand_slug text not null,
  category_name text not null,
  category_slug text not null,
  sku text not null,
  slug text not null,
  name text not null,
  short_description text not null,
  price integer not null,
  image_path text not null,
  image_alt text not null,
  gender text not null,
  colour text not null,
  sizes text[] not null,
  featured boolean not null default false
) on commit drop;

insert into brand_catalog_seed values
  ('Dior', 'dior', 'Tops', 'tops', 'FIELDIO-IMPORT-20260913-DIOR-001', 'dior-oblique-polo-shirt', 'Dior Oblique Polo Shirt', 'Dior Oblique jacquard polo in a relaxed menswear silhouette.', 135000, 'dior/dior-oblique-polo-shirt.webp', 'Model wearing a navy Dior Oblique polo shirt', 'men', 'Navy', array['S','M','L','XL'], true),
  ('Dior', 'dior', 'Outerwear', 'outerwear', 'FIELDIO-IMPORT-20260913-DIOR-002', 'christian-dior-atelier-bomber-jacket', 'Christian Dior Atelier Bomber Jacket', 'Varsity-inspired bomber jacket with Christian Dior Atelier detailing.', 260000, 'dior/christian-dior-atelier-bomber-jacket.webp', 'Model wearing a black Christian Dior Atelier bomber jacket', 'men', 'Black', array['S','M','L','XL'], false),
  ('Dior', 'dior', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-DIOR-003', 'dior-b23-high-top-sneaker', 'B23 High-Top Sneaker', 'Signature high-top sneaker in Dior Oblique canvas.', 90000, 'dior/b23-high-top-sneaker.webp', 'Dior B23 high-top sneaker in Oblique canvas', 'men', 'Black / White', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], false),
  ('Dior', 'dior', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-DIOR-004', 'jadior-slingback-pump', 'J''Adior Slingback Pump', 'Technical-fabric slingback pump with embroidered J''Adior ribbon.', 88000, 'dior/jadior-slingback-pump.webp', 'Black J Adior slingback pump', 'women', 'Black', array['UK 3','UK 4','UK 5','UK 6','UK 7','UK 8'], false),
  ('Dior', 'dior', 'Dresses', 'dresses', 'FIELDIO-IMPORT-20260913-DIOR-005', 'dior-oblique-shirt-dress', 'Dior Oblique Shirt Dress', 'Fitted Dior Oblique dress with a clean collared silhouette.', 320000, 'dior/dior-oblique-shirt-dress.webp', 'Model wearing a fitted Dior Oblique shirt dress', 'women', 'Navy', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false),
  ('Dior', 'dior', 'Bottoms', 'bottoms', 'FIELDIO-IMPORT-20260913-DIOR-006', 'dior-oblique-mini-skirt', 'Dior Oblique Mini Skirt', 'Dior Oblique mini skirt finished with a CD buckle belt.', 135000, 'dior/dior-oblique-mini-skirt.webp', 'Dior Oblique mini skirt with a CD buckle belt', 'women', 'Navy', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false),

  ('Gucci', 'gucci', 'Bottoms', 'bottoms', 'FIELDIO-IMPORT-20260913-GUCCI-001', 'gucci-gg-canvas-relaxed-trousers', 'GG Canvas Relaxed Trousers', 'Relaxed trousers cut in beige GG canvas.', 85000, 'gucci/gg-canvas-relaxed-trousers.webp', 'Beige Gucci GG canvas relaxed trousers', 'men', 'Beige / Ebony', array['30','32','34','36','38'], false),
  ('Gucci', 'gucci', 'Outerwear', 'outerwear', 'FIELDIO-IMPORT-20260913-GUCCI-002', 'gucci-gg-denim-jacket', 'GG Denim Jacket', 'GG denim jacket with contrasting brown leather details.', 210000, 'gucci/gg-denim-jacket.webp', 'Gucci GG denim jacket with brown leather details', 'men', 'Blue / Brown', array['S','M','L','XL'], true),
  ('Gucci', 'gucci', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-GUCCI-003', 'gucci-chunky-gg-canvas-lace-up-shoes', 'Chunky GG Canvas Lace-Up Shoes', 'Chunky lace-up shoes in signature GG canvas.', 95000, 'gucci/chunky-gg-canvas-lace-up-shoes.webp', 'Chunky Gucci GG canvas lace-up shoes', 'men', 'Beige / Ebony', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], false),
  ('Gucci', 'gucci', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-GUCCI-004', 'gucci-rhyton-gg-sneaker', 'Rhyton GG Sneaker', 'Rhyton sneaker with all-over GG motif and sculpted sole.', 81000, 'gucci/rhyton-gg-sneaker.webp', 'Gucci Rhyton sneaker in GG canvas', 'men', 'Beige / Ebony', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], false),
  ('Gucci', 'gucci', 'Dresses', 'dresses', 'FIELDIO-IMPORT-20260913-GUCCI-005', 'gucci-gg-canvas-mini-dress', 'GG Canvas Mini Dress', 'Sleeveless mini dress in signature GG canvas.', 230000, 'gucci/gg-canvas-mini-dress.webp', 'Model wearing a Gucci GG canvas mini dress', 'women', 'Beige / Ebony', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false),
  ('Gucci', 'gucci', 'Tops', 'tops', 'FIELDIO-IMPORT-20260913-GUCCI-006', 'gucci-gg-jacquard-polo-top', 'GG Jacquard Polo Top', 'Pink short-sleeve polo top in GG jacquard.', 105000, 'gucci/gg-jacquard-polo-top.webp', 'Pink Gucci GG jacquard polo top', 'women', 'Pink', array['XS','S','M','L','XL'], false),

  ('Louis Vuitton', 'louis-vuitton', 'Tops', 'tops', 'FIELDIO-IMPORT-20260913-LV-001', 'louis-vuitton-monogram-gradient-t-shirt', 'Monogram Gradient T-Shirt', 'Cotton T-shirt with a tonal Monogram gradient finish.', 79000, 'louis-vuitton/monogram-gradient-t-shirt.webp', 'Black Louis Vuitton Monogram gradient T-shirt', 'men', 'Black', array['S','M','L','XL'], false),
  ('Louis Vuitton', 'louis-vuitton', 'Bottoms', 'bottoms', 'FIELDIO-IMPORT-20260913-LV-002', 'louis-vuitton-monogram-denim-shorts', 'Monogram Denim Shorts', 'Blue denim shorts with an all-over Monogram treatment.', 149000, 'louis-vuitton/monogram-denim-shorts.webp', 'Blue Louis Vuitton Monogram denim shorts', 'men', 'Blue', array['30','32','34','36','38'], false),
  ('Louis Vuitton', 'louis-vuitton', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-LV-003', 'louis-vuitton-lv-trainer-blue', 'LV Trainer Sneaker — Blue', 'LV Trainer sneaker in blue and white with signature details.', 98500, 'louis-vuitton/lv-trainer-blue.webp', 'Blue and white Louis Vuitton LV Trainer sneaker', 'men', 'Blue / White', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], true),
  ('Louis Vuitton', 'louis-vuitton', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-LV-004', 'louis-vuitton-lv-trainer-green', 'LV Trainer Sneaker — Green', 'LV Trainer sneaker in green Monogram leather.', 98500, 'louis-vuitton/lv-trainer-green.webp', 'Green Louis Vuitton LV Trainer sneaker', 'men', 'Green', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], false),
  ('Louis Vuitton', 'louis-vuitton', 'Dresses', 'dresses', 'FIELDIO-IMPORT-20260913-LV-005', 'louis-vuitton-monogram-jacquard-sleeveless-dress', 'Monogram Jacquard Sleeveless Dress', 'Sleeveless fitted dress in tonal Monogram jacquard.', 245000, 'louis-vuitton/monogram-jacquard-sleeveless-dress.webp', 'Beige Louis Vuitton Monogram jacquard sleeveless dress', 'women', 'Beige', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false),
  ('Louis Vuitton', 'louis-vuitton', 'Dresses', 'dresses', 'FIELDIO-IMPORT-20260913-LV-006', 'louis-vuitton-monogram-knit-polo-dress', 'Monogram Knit Polo Dress', 'Ivory knit polo dress with tonal Monogram detailing.', 220000, 'louis-vuitton/monogram-knit-polo-dress.webp', 'Ivory Louis Vuitton Monogram knit polo dress', 'women', 'Ivory', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false),

  ('Prada', 'prada', 'Tops', 'tops', 'FIELDIO-IMPORT-20260913-PRADA-001', 'prada-nappa-leather-shirt', 'Nappa Leather Shirt', 'Short-sleeve black leather shirt with a clean zip front.', 380000, 'prada/nappa-leather-shirt.webp', 'Black Prada short-sleeve leather shirt', 'men', 'Black', array['S','M','L','XL'], false),
  ('Prada', 'prada', 'Outerwear', 'outerwear', 'FIELDIO-IMPORT-20260913-PRADA-002', 'prada-technical-jersey-tracksuit-set', 'Technical Jersey Tracksuit Set', 'Coordinated technical-jersey jacket and trousers with contrast piping.', 260000, 'prada/technical-jersey-tracksuit-set.webp', 'Black Prada technical jersey tracksuit set', 'men', 'Black', array['S','M','L','XL'], false),
  ('Prada', 'prada', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-PRADA-003', 'prada-monolith-lace-up-shoes', 'Monolith Lace-Up Shoes', 'Brushed-leather Monolith lace-up shoes with a bold lug sole.', 95000, 'prada/monolith-lace-up-shoes.webp', 'Black Prada Monolith lace-up shoes', 'men', 'Black', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], false),
  ('Prada', 'prada', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-PRADA-004', 'prada-monolith-chelsea-boots', 'Monolith Chelsea Boots', 'Brushed-leather Monolith Chelsea boots with a chunky sole.', 113000, 'prada/monolith-chelsea-boots.webp', 'Black Prada Monolith Chelsea boots', 'men', 'Black', array['UK 6','UK 7','UK 8','UK 9','UK 10','UK 11'], false),
  ('Prada', 'prada', 'Dresses', 'dresses', 'FIELDIO-IMPORT-20260913-PRADA-005', 'prada-re-nylon-shirt-dress', 'Re-Nylon Shirt Dress', 'Belted black shirt dress in Prada Re-Nylon.', 170000, 'prada/re-nylon-shirt-dress.webp', 'Model wearing a black Prada Re-Nylon shirt dress', 'women', 'Black', array['UK 6','UK 8','UK 10','UK 12','UK 14'], true),
  ('Prada', 'prada', 'Dresses', 'dresses', 'FIELDIO-IMPORT-20260913-PRADA-006', 'prada-sleeveless-mini-dress', 'Sleeveless Mini Dress', 'Minimal black sleeveless dress with a softly flared skirt.', 220000, 'prada/sleeveless-mini-dress.webp', 'Model wearing a black Prada sleeveless mini dress', 'women', 'Black', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false),

  ('Yves Saint Laurent', 'yves-saint-laurent', 'Outerwear', 'outerwear', 'FIELDIO-IMPORT-20260913-YSL-001', 'yves-saint-laurent-cassandre-track-jacket', 'Cassandre Track Jacket', 'Cotton-and-nylon track jacket with contrast piping.', 133000, 'yves-saint-laurent/cassandre-track-jacket.webp', 'Navy Yves Saint Laurent track jacket with contrast piping', 'men', 'Navy', array['S','M','L','XL'], true),
  ('Yves Saint Laurent', 'yves-saint-laurent', 'Bottoms', 'bottoms', 'FIELDIO-IMPORT-20260913-YSL-002', 'yves-saint-laurent-wide-leg-jeans', 'Wide-Leg Jeans', 'Light-wash denim jeans cut with a wide leg.', 85000, 'yves-saint-laurent/wide-leg-jeans.webp', 'Light blue Yves Saint Laurent wide-leg jeans', 'men', 'Light Blue', array['30','32','34','36','38'], false),
  ('Yves Saint Laurent', 'yves-saint-laurent', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-YSL-003', 'yves-saint-laurent-opyum-patent-leather-sandals', 'Opyum Patent Leather Sandals', 'Patent-leather sandals with a sculptural gold Cassandre heel.', 115500, 'yves-saint-laurent/opyum-patent-leather-sandals.webp', 'Black Yves Saint Laurent Opyum sandals with a gold Cassandre heel', 'women', 'Black / Gold', array['UK 3','UK 4','UK 5','UK 6','UK 7','UK 8'], false),
  ('Yves Saint Laurent', 'yves-saint-laurent', 'Footwear', 'footwear', 'FIELDIO-IMPORT-20260913-YSL-004', 'yves-saint-laurent-leather-ankle-boots', 'Leather Ankle Boots', 'Black leather ankle boots with a streamlined pointed profile.', 110000, 'yves-saint-laurent/leather-ankle-boots.webp', 'Black Yves Saint Laurent leather ankle boots', 'women', 'Black', array['UK 3','UK 4','UK 5','UK 6','UK 7','UK 8'], false),
  ('Yves Saint Laurent', 'yves-saint-laurent', 'Swimwear', 'swimwear', 'FIELDIO-IMPORT-20260913-YSL-005', 'yves-saint-laurent-cassandre-strapless-swimsuit', 'Cassandre Strapless Swimsuit', 'Black strapless one-piece finished with a vertical Cassandre detail.', 90000, 'yves-saint-laurent/cassandre-strapless-swimsuit.webp', 'Black Yves Saint Laurent strapless swimsuit with Cassandre detail', 'women', 'Black', array['XS','S','M','L','XL'], false),
  ('Yves Saint Laurent', 'yves-saint-laurent', 'Bottoms', 'bottoms', 'FIELDIO-IMPORT-20260913-YSL-006', 'yves-saint-laurent-wide-leg-trousers', 'Wide-Leg Trousers', 'Fluid black tailored trousers with a wide-leg cut.', 120000, 'yves-saint-laurent/wide-leg-trousers.webp', 'Black Yves Saint Laurent wide-leg trousers', 'women', 'Black', array['UK 6','UK 8','UK 10','UK 12','UK 14'], false);

insert into public.brands (name, slug, description, is_active)
select distinct brand_name, brand_slug, 'Fieldio personal sourcing selection.', true
from brand_catalog_seed
on conflict (slug) do update set name = excluded.name, is_active = true, updated_at = now();

insert into public.categories (name, slug, description, is_active)
select distinct category_name, category_slug, 'Fieldio catalog category.', true
from brand_catalog_seed
on conflict (slug) do update set name = excluded.name, is_active = true, updated_at = now();

insert into public.products (
  sku, name, slug, brand_id, category_id, description, short_description,
  price, currency, materials, care_information, featured, is_new_arrival,
  is_sale, inquiry_only, tags, status, seo_title, seo_description, published_at
)
select
  s.sku,
  s.name,
  s.slug,
  b.id,
  c.id,
  s.short_description || ' Reference image supplied for Fieldio sourcing. This GBP price is a temporary estimate based on comparable current brand pricing; exact model, condition, availability, final price and shipping are confirmed before payment.',
  s.short_description,
  s.price,
  'GBP',
  'Exact composition confirmed with the sourced item.',
  'Care guidance is confirmed with the sourced item.',
  s.featured,
  true,
  false,
  true,
  array[s.gender, s.category_slug, s.brand_slug, 'luxury', 'sourcing', 'estimated-price'],
  'active',
  s.name || ' | Fieldio',
  'Request ' || s.name || ' through Fieldio personal shopping with worldwide shipping support.',
  now()
from brand_catalog_seed s
join public.brands b on b.slug = s.brand_slug
join public.categories c on c.slug = s.category_slug
on conflict (sku) do update set
  name = excluded.name,
  slug = excluded.slug,
  brand_id = excluded.brand_id,
  category_id = excluded.category_id,
  description = excluded.description,
  short_description = excluded.short_description,
  price = excluded.price,
  currency = excluded.currency,
  materials = excluded.materials,
  care_information = excluded.care_information,
  featured = excluded.featured,
  is_new_arrival = excluded.is_new_arrival,
  is_sale = excluded.is_sale,
  inquiry_only = excluded.inquiry_only,
  tags = excluded.tags,
  status = excluded.status,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.product_images (product_id, storage_path, public_url, alt_text, position)
select
  p.id,
  'brand-catalog/' || s.image_path,
  'https://fieldio.shop/images/brand-catalog/' || s.image_path,
  s.image_alt,
  0
from brand_catalog_seed s
join public.products p on p.sku = s.sku
on conflict (product_id, position) do update set
  storage_path = excluded.storage_path,
  public_url = excluded.public_url,
  alt_text = excluded.alt_text;

insert into public.product_variants (product_id, sku, name, size, color, is_active)
select
  p.id,
  s.sku || '-' || upper(regexp_replace(size_value, '[^a-zA-Z0-9]+', '', 'g')),
  s.colour || ' / ' || size_value,
  size_value,
  s.colour,
  true
from brand_catalog_seed s
join public.products p on p.sku = s.sku
cross join lateral unnest(s.sizes) as size_value
on conflict (sku) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  size = excluded.size,
  color = excluded.color,
  is_active = true,
  updated_at = now();

commit;
