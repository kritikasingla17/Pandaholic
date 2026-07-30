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
