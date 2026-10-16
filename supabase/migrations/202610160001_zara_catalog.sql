begin;

create temporary table zara_catalog_seed (
  sku text primary key,
  slug text not null,
  name text not null,
  category_slug text not null,
  short_description text not null,
  price_pence integer not null,
  tags text[] not null,
  image_labels text[] not null check (cardinality(image_labels) > 0)
) on commit drop;

insert into zara_catalog_seed values
  ('FIELDIO-ZARA-20261016-001', 'zara-barefoot-trainers-black', 'Zara Barefoot Trainers - Black', 'footwear', 'Low-profile black lace-up trainers with a slim, textured sole.', 6400, array['zara','men','footwear','shoes','trainers','sneakers','black'], array['black pair, three-quarter view','black trainer, side profile','black trainer, rear view','black trainer, upper detail','black trainer with insole','black trainer, outsole view','black trainer, opposite side']),
  ('FIELDIO-ZARA-20261016-002', 'zara-barefoot-trainers-yellow', 'Zara Barefoot Trainers - Yellow', 'footwear', 'Yellow low-profile lace-up trainers with a slim, textured sole.', 6400, array['zara','men','footwear','shoes','trainers','sneakers','yellow'], array['yellow pair, three-quarter view','yellow trainer, side profile','yellow trainer, rear view','yellow trainers worn with denim','yellow trainers styled with jeans','yellow trainer, upper detail','yellow trainer with insole','yellow trainer, outsole view','yellow trainer, opposite side']),
  ('FIELDIO-ZARA-20261016-003', 'zara-denim-jeans', 'Zara Denim Jeans', 'bottoms', 'Blue distressed denim jeans with a relaxed leg.', 6000, array['zara','men','bottoms','pants','denim','jeans','blue'], array['blue jeans, front view','blue jeans, back view','blue denim and distressed detail','back pocket and denim detail']),
  ('FIELDIO-ZARA-20261016-004', 'zara-boxers', 'Zara Boxers', 'underwear', 'Boxer briefs in neutral shades; size and assortment are confirmed on request.', 2900, array['zara','men','underwear','boxers'], array['assorted boxer briefs','blue boxer briefs','brown boxer briefs']),
  ('FIELDIO-ZARA-20261016-005', 'zara-jacket', 'Zara Jacket', 'outerwear', 'Brown zip-front jacket with a pointed collar and front pockets.', 28000, array['zara','men','outerwear','jacket','jackets','brown'], array['brown jacket, front view','brown jacket, back view']),
  ('FIELDIO-ZARA-20261016-006', 'zara-leather-travel-bag', 'Zara Leather Travel Bag', 'bags', 'Travel bag with leather handles and an adjustable shoulder strap.', 10000, array['zara','bags','travel bag'], array['travel bag, front view','travel bag, angled view','travel bag, side detail','travel bag with handles','travel bag with shoulder strap','travel bag, handle and strap detail','travel bag, interior detail','travel bag carried by a model']),
  ('FIELDIO-ZARA-20261016-007', 'zara-puffer-jacket', 'Zara Puffer Jacket', 'outerwear', 'Black hooded puffer jacket with a quilted body and zip front.', 9400, array['zara','men','outerwear','jacket','jackets','puffer','black'], array['black puffer jacket, front view','black puffer jacket, back view','black puffer jacket, supplied feature graphic']);

insert into public.brands (name, slug, description, is_active)
values ('Zara', 'zara', 'Zara pieces available through the Fieldio edit.', true)
on conflict (slug) do update set is_active = true, updated_at = now();

insert into public.categories (name, slug, description, is_active)
values
  ('Footwear', 'footwear', 'Shoes and trainers.', true),
  ('Bottoms', 'bottoms', 'Jeans and trousers.', true),
  ('Underwear', 'underwear', 'Underwear and boxers.', true),
  ('Outerwear', 'outerwear', 'Jackets and coats.', true),
  ('Bags', 'bags', 'Bags and travel bags.', true)
on conflict (slug) do update set is_active = true, updated_at = now();

insert into public.products (
  sku, slug, name, brand_id, category_id, description, short_description,
  price, currency, materials, care_information, featured, is_new_arrival,
  is_sale, inquiry_only, tags, status, seo_title, seo_description, published_at
)
select
  seed.sku, seed.slug, seed.name, brand.id, category.id,
  seed.short_description || ' Fieldio confirms size, condition, availability, final price and shipping before payment.',
  seed.short_description, seed.price_pence, 'GBP',
  'Composition and material details are confirmed on request.',
  'Care instructions are confirmed with the item.',
  false, true, false, true, seed.tags, 'active',
  seed.name || ' | Fieldio',
  'Explore ' || seed.name || ' at Fieldio. Ask about sizing, availability and worldwide delivery.',
  now()
from zara_catalog_seed seed
join public.brands brand on brand.slug = 'zara'
join public.categories category on category.slug = seed.category_slug
on conflict (sku) do nothing;

insert into public.product_images (product_id, storage_path, public_url, alt_text, position)
select
  product.id,
  'brand-catalog/zara/' || seed.slug || '-' || lpad(image.position::text, 2, '0') || '.webp',
  'https://fieldio.shop/images/brand-catalog/zara/' || seed.slug || '-' || lpad(image.position::text, 2, '0') || '.webp',
  seed.name || ', ' || image.label,
  image.position - 1
from zara_catalog_seed seed
join public.products product on product.sku = seed.sku
cross join lateral unnest(seed.image_labels) with ordinality as image(label, position)
on conflict (product_id, position) do nothing;

-- Sizes and stock were not supplied; a single inquiry variant prevents invented availability.
insert into public.product_variants (product_id, sku, name, is_active)
select product.id, seed.sku || '-REQUEST', 'Size and availability on request', true
from zara_catalog_seed seed
join public.products product on product.sku = seed.sku
on conflict (sku) do nothing;

commit;
