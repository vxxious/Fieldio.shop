insert into public.categories (name, slug, description, is_active)
values ('Hats & caps', 'hats-caps', 'Hats, caps and other headwear.', true)
on conflict (slug) do update set is_active = true;
