create extension if not exists pgcrypto;

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_request_status as enum ('order_request', 'awaiting_confirmation', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.subscriber_status as enum ('subscribed', 'unsubscribed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'fulfilment')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'owner');
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  logo_url text,
  seo_title text,
  seo_description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  intro text,
  hero_image_url text,
  hero_image_alt text,
  editorial_layout jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  slug text not null unique,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null default '',
  short_description text not null default '',
  price integer check (price is null or price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= 0),
  currency char(3) not null default 'GBP',
  materials text,
  care_information text,
  featured boolean not null default false,
  is_new_arrival boolean not null default false,
  is_sale boolean not null default false,
  inquiry_only boolean not null default false,
  tags text[] not null default '{}',
  status public.product_status not null default 'draft',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_brand_id_idx on public.products(brand_id);
create index products_category_id_idx on public.products(category_id);
create index products_status_published_idx on public.products(status, published_at desc);
create index products_tags_idx on public.products using gin(tags);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  public_url text,
  alt_text text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique(product_id, position)
);

create index product_images_product_idx on public.product_images(product_id, position);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  size text,
  color text,
  attributes jsonb not null default '{}'::jsonb,
  price_override integer check (price_override is null or price_override >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants(product_id);

create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  allow_backorder boolean not null default false,
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);

create table public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);

create index collection_products_position_idx on public.collection_products(collection_id, position);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  currency char(3) not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, product_variant_id)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text,
  country_code char(2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_idx on public.addresses(user_id);
create unique index addresses_one_default_per_user_idx on public.addresses(user_id) where is_default;

create sequence public.order_reference_seq start 1001;

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique default ('FLD-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.order_reference_seq')::text, 5, '0')),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  shipping_address text not null,
  customer_note text,
  status public.order_request_status not null default 'order_request',
  currency char(3) not null default 'GBP',
  subtotal integer check (subtotal is null or subtotal >= 0),
  shipping_total integer check (shipping_total is null or shipping_total >= 0),
  total integer check (total is null or total >= 0),
  source text not null default 'whatsapp_checkout',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_requests_user_idx on public.order_requests(user_id, created_at desc);
create index order_requests_status_idx on public.order_requests(status, created_at desc);
create index order_requests_email_idx on public.order_requests(lower(customer_email));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  brand_name text not null,
  sku text not null,
  variant_name text,
  size text,
  color text,
  quantity integer not null check (quantity between 1 and 10),
  unit_price integer check (unit_price is null or unit_price >= 0),
  line_total integer check (line_total is null or line_total >= 0),
  currency char(3) not null default 'GBP',
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_request_id);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status public.subscriber_status not null default 'subscribed',
  consented_at timestamptz not null,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

create table public.wholesale_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  company text,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'quoted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.editorial_content (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  section_key text not null,
  content jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_key, section_key)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  insert into public.wishlists (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','brands','categories','collections','products','product_variants','inventory','carts','cart_items','addresses','order_requests','newsletter_subscribers','wholesale_inquiries','editorial_content']
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.collection_products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.addresses enable row level security;
alter table public.order_requests enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.wholesale_inquiries enable row level security;
alter table public.editorial_content enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self select" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "admins view admins" on public.admin_users for select to authenticated using (public.is_admin());
create policy "owners manage admins" on public.admin_users for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "public read active brands" on public.brands for select using (is_active or public.is_admin());
create policy "public read active categories" on public.categories for select using (is_active or public.is_admin());
create policy "public read published collections" on public.collections for select using ((is_active and published_at <= now()) or public.is_admin());
create policy "public read active products" on public.products for select using ((status = 'active' and published_at <= now()) or public.is_admin());
create policy "public read product images" on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active' and p.published_at <= now()) or public.is_admin());
create policy "public read active variants" on public.product_variants for select using ((is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active' and p.published_at <= now())) or public.is_admin());
create policy "public read collection products" on public.collection_products for select using (true);
create policy "admins manage catalog" on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage collections" on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage images" on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage variants" on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage inventory" on public.inventory for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage collection products" on public.collection_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users manage own cart" on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own cart items" on public.cart_items for all to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())) with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy "users manage own wishlist" on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own wishlist items" on public.wishlist_items for all to authenticated using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid())) with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));
create policy "users manage own addresses" on public.addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own order requests" on public.order_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins manage order requests" on public.order_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.order_requests o where o.id = order_request_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "admins manage order items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage subscribers" on public.newsletter_subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage contact messages" on public.contact_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users read own wholesale enquiries" on public.wholesale_inquiries for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins manage wholesale enquiries" on public.wholesale_inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read published editorial content" on public.editorial_content for select using (is_published or public.is_admin());
create policy "admins manage editorial content" on public.editorial_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit logs" on public.audit_logs for select to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "public read product image objects" on storage.objects for select using (bucket_id = 'product-images');
create policy "admins upload product image objects" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins update product image objects" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins delete product image objects" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
