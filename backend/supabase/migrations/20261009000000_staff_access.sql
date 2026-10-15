-- Staff-only admin access.
-- Admin RPCs, draft products and product-image writes used to be reachable
-- with the public anon key. They now require a signed-in user listed in
-- public.staff (manage it with `npm run staff:add|staff:remove|staff:list`).
-- Also turn off "Allow new users to sign up" in Supabase Auth settings.

-- Staff registry -------------------------------------------------------------
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No policies on purpose: only the service role and is_staff() read this table.
alter table public.staff enable row level security;
revoke all on table public.staff from anon, authenticated;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- RLS policies run is_staff() as the querying role, so anon needs EXECUTE too (it returns false).
revoke execute on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

create or replace function public.assert_staff()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_staff() from public, anon;
grant execute on function public.assert_staff() to authenticated;

-- Catalog reads --------------------------------------------------------------
-- Shoppers see active products only; staff also see drafts.
drop policy if exists "Public read access to products" on public.products;
drop policy if exists "Read active products, staff read all" on public.products;
create policy "Read active products, staff read all" on public.products
  for select using (status = 'active' or (select public.is_staff()));

drop policy if exists "Public read access to variants" on public.product_variants;
drop policy if exists "Read variants of active products, staff read all" on public.product_variants;
create policy "Read variants of active products, staff read all" on public.product_variants
  for select using (
    (select public.is_staff())
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'active'
    )
  );

-- Checkout stock RPC ---------------------------------------------------------
-- Still callable by anon because checkout uses it, but it can only lower stock
-- now; staff set stock through admin_upsert_variant().
create or replace function public.set_variant_stock(p_variant_id uuid, p_available integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available integer;
begin
  update product_variants
  set available = greatest(p_available, 0)
  where id = p_variant_id
    and greatest(p_available, 0) < available
  returning available into v_available;

  if v_available is null then
    select available into v_available from product_variants where id = p_variant_id;
  end if;

  return v_available;
end;
$$;

-- Admin RPCs (staff only) ----------------------------------------------------
create or replace function public.admin_upsert_product(
  p_product_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_tags text[],
  p_image text,
  p_images text[],
  p_option_names text[],
  p_personalizable boolean,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_base_handle text;
  v_handle text;
  v_suffix int := 1;
begin
  perform public.assert_staff();

  if p_title is null or trim(p_title) = '' then
    raise exception 'Title is required';
  end if;

  if p_product_id is null then
    v_base_handle := trim(both '-' from lower(regexp_replace(trim(p_title), '[^a-zA-Z0-9]+', '-', 'g')));
    if v_base_handle = '' then
      v_base_handle := 'product';
    end if;
    v_handle := v_base_handle;
    while exists (select 1 from products where handle = v_handle) loop
      v_suffix := v_suffix + 1;
      v_handle := v_base_handle || '-' || v_suffix;
    end loop;

    insert into products (handle, title, description, category, tags, image, images, option_names, personalizable, status)
    values (
      v_handle,
      trim(p_title),
      coalesce(p_description, ''),
      coalesce(nullif(trim(p_category), ''), 'Other'),
      coalesce(p_tags, '{}'),
      coalesce(p_image, ''),
      coalesce(p_images, '{}'),
      coalesce(p_option_names, '{}'),
      coalesce(p_personalizable, true),
      coalesce(nullif(trim(p_status), ''), 'active')
    )
    returning id into v_id;
  else
    update products set
      title = trim(p_title),
      description = coalesce(p_description, ''),
      category = coalesce(nullif(trim(p_category), ''), 'Other'),
      tags = coalesce(p_tags, '{}'),
      image = coalesce(p_image, ''),
      images = coalesce(p_images, '{}'),
      option_names = coalesce(p_option_names, '{}'),
      personalizable = coalesce(p_personalizable, true),
      status = coalesce(nullif(trim(p_status), ''), 'active')
    where id = p_product_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Product % not found', p_product_id;
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_staff();
  delete from products where id = p_product_id;
end;
$$;

create or replace function public.admin_upsert_variant(
  p_variant_id uuid,
  p_product_id uuid,
  p_sku text,
  p_options jsonb,
  p_price numeric,
  p_compare_at_price numeric,
  p_available integer,
  p_image text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_staff();

  if p_variant_id is null then
    if p_product_id is null then
      raise exception 'p_product_id is required to create a variant';
    end if;

    insert into product_variants (product_id, sku, options, price, compare_at_price, available, image)
    values (
      p_product_id,
      coalesce(p_sku, ''),
      coalesce(p_options, '[]'::jsonb),
      greatest(coalesce(p_price, 0), 0),
      nullif(p_compare_at_price, 0),
      greatest(coalesce(p_available, 0), 0),
      p_image
    )
    returning id into v_id;
  else
    update product_variants set
      sku = coalesce(p_sku, ''),
      options = coalesce(p_options, '[]'::jsonb),
      price = greatest(coalesce(p_price, 0), 0),
      compare_at_price = nullif(p_compare_at_price, 0),
      available = greatest(coalesce(p_available, 0), 0),
      image = p_image
    where id = p_variant_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Variant % not found', p_variant_id;
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_delete_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_staff();
  delete from product_variants where id = p_variant_id;
end;
$$;

revoke execute on function public.admin_upsert_product(uuid, text, text, text, text[], text, text[], text[], boolean, text) from public, anon;
revoke execute on function public.admin_delete_product(uuid) from public, anon;
revoke execute on function public.admin_upsert_variant(uuid, uuid, text, jsonb, numeric, numeric, integer, text) from public, anon;
revoke execute on function public.admin_delete_variant(uuid) from public, anon;

grant execute on function public.admin_upsert_product(uuid, text, text, text, text[], text, text[], text[], boolean, text) to authenticated;
grant execute on function public.admin_delete_product(uuid) to authenticated;
grant execute on function public.admin_upsert_variant(uuid, uuid, text, jsonb, numeric, numeric, integer, text) to authenticated;
grant execute on function public.admin_delete_variant(uuid) to authenticated;

-- Product images -------------------------------------------------------------
-- The bucket stays public, so shoppers load images from their public URLs
-- without any policy; these only govern API list/upload/overwrite/delete.
drop policy if exists "Public read product images" on storage.objects;
drop policy if exists "Public upload product images" on storage.objects;
drop policy if exists "Public update product images" on storage.objects;
drop policy if exists "Public delete product images" on storage.objects;

drop policy if exists "Staff read product images" on storage.objects;
create policy "Staff read product images" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()));

drop policy if exists "Staff upload product images" on storage.objects;
create policy "Staff upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_staff()));

drop policy if exists "Staff update product images" on storage.objects;
create policy "Staff update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()))
  with check (bucket_id = 'product-images' and (select public.is_staff()));

drop policy if exists "Staff delete product images" on storage.objects;
create policy "Staff delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()));

-- Keep in sync with ALLOWED_IMAGE_TYPES / MAX_UPLOAD_BYTES in frontend/src/lib/uploadImage.ts.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'product-images';
