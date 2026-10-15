-- Product image storage for Supabase Storage - baseline migration (runs after
-- 20260730000000_catalog_baseline.sql). Creates the public product-images
-- bucket. All four policies below were replaced by staff-only ones in
-- 20261009000000_staff_access.sql (public URLs keep working for shoppers).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "Public upload product images" on storage.objects;
create policy "Public upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images');

drop policy if exists "Public update product images" on storage.objects;
create policy "Public update product images" on storage.objects
  for update using (bucket_id = 'product-images');

drop policy if exists "Public delete product images" on storage.objects;
create policy "Public delete product images" on storage.objects
  for delete using (bucket_id = 'product-images');
