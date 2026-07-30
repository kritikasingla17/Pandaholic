-- Pandaholic catalog schema for Supabase (Postgres)
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  title text not null,
  description text not null default '',
  category text not null default 'Uncategorized',
  tags text[] not null default '{}',
  image text not null default '',
  images text[] not null default '{}',
  option_names text[] not null default '{}',
  personalizable boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null default '',
  options jsonb not null default '[]',
  price numeric(10, 2) not null default 0,
  compare_at_price numeric(10, 2),
  available integer not null default 0,
  image text,
  created_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx on product_variants (product_id);

-- Row Level Security -------------------------------------------------------
-- The app's anon key is public (shipped to every browser), so writes are NOT
-- allowed directly on these tables. Reads are public because the catalog is
-- public. Stock changes go through the set_variant_stock() function below,
-- which only lets a caller change the `available` count on one variant -
-- nothing else (price, title, etc. stay protected).
alter table products enable row level security;
alter table product_variants enable row level security;

drop policy if exists "Public read access to products" on products;
create policy "Public read access to products" on products
  for select using (true);

drop policy if exists "Public read access to variants" on product_variants;
create policy "Public read access to variants" on product_variants
  for select using (true);

-- Inventory adjustment RPC --------------------------------------------------
create or replace function public.set_variant_stock(p_variant_id uuid, p_available integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_value integer;
begin
  update product_variants
  set available = greatest(p_available, 0)
  where id = p_variant_id
  returning available into v_new_value;

  return v_new_value;
end;
$$;

grant execute on function public.set_variant_stock(uuid, integer) to anon, authenticated;

-- NOTE: because this app has no admin login yet, anyone with the site open
-- can call set_variant_stock() and change stock counts. That's an accepted
-- trade-off for now, but before going live you should gate the Inventory
-- page behind Supabase Auth and restrict this function to authenticated
-- "staff" users (e.g. check auth.uid() against a staff table).

-- Admin CRUD RPCs (Inventory page) -----------------------------------------
-- The Inventory page manages full product/variant records directly, not
-- just stock counts. As with set_variant_stock() above, these functions are
-- granted to `anon` because there's no auth yet - anyone who opens
-- /inventory can create, edit, or delete any product/variant. Same accepted
-- trade-off, same recommendation: add Supabase Auth + a staff check before
-- going live, then tighten these grants to `authenticated` only.

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

grant execute on function public.admin_upsert_product(uuid, text, text, text, text[], text, text[], text[], boolean, text) to anon, authenticated;

create or replace function public.admin_delete_product(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from products where id = p_product_id;
$$;

grant execute on function public.admin_delete_product(uuid) to anon, authenticated;

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

grant execute on function public.admin_upsert_variant(uuid, uuid, text, jsonb, numeric, numeric, integer, text) to anon, authenticated;

create or replace function public.admin_delete_variant(p_variant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from product_variants where id = p_variant_id;
$$;

grant execute on function public.admin_delete_variant(uuid) to anon, authenticated;
