-- Product image storage setup for Supabase Storage.
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query),
-- AFTER schema.sql. It creates a public bucket for product images and lets the
-- app's anon key (used by the Inventory admin page) upload to it directly from
-- the browser - matching the same "no auth yet" trade-off already accepted for
-- the admin_upsert_product / admin_upsert_variant RPCs in schema.sql.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Anyone can view product images (the storefront is public).
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

-- Anyone can upload/replace/delete product images - same trade-off as the
-- open admin RPCs above. Tighten to `authenticated` + a staff check once
-- Supabase Auth is added to the Inventory page.
drop policy if exists "Public upload product images" on storage.objects;
create policy "Public upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images');

drop policy if exists "Public update product images" on storage.objects;
create policy "Public update product images" on storage.objects
  for update using (bucket_id = 'product-images');

drop policy if exists "Public delete product images" on storage.objects;
create policy "Public delete product images" on storage.objects
  for delete using (bucket_id = 'product-images');
