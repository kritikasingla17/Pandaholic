-- Real orders. Checkout now creates the order in the database in one step:
-- it checks and lowers stock and takes prices from the database, instead of
-- the browser lowering stock and keeping the order to itself. Staff manage
-- orders in the admin panel; shoppers see theirs through private order links.
-- Deploy together with the matching frontend: the previous checkout used
-- set_variant_stock(), which is removed at the end of this file.

-- Orders ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start with 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.order_number_seq'),
  -- Private link for the shopper's "My Orders" page; never shown to anyone else.
  access_token uuid not null unique default gen_random_uuid(),
  idempotency_key uuid not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null default '',
  address_line text not null,
  city text not null,
  state text not null,
  pincode text not null,
  total numeric(12, 2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.order_number_seq owned by public.orders.order_number;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_phone_created_at_idx on public.orders (customer_phone, created_at);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Kept as a snapshot below, so deleting a product later doesn't change past orders.
  variant_id uuid references public.product_variants (id) on delete set null,
  product_title text not null,
  variant_options jsonb not null default '[]',
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  recipient_name text not null default '',
  message text not null default '',
  instructions text not null default '',
  photo_path text,
  position integer not null default 0
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- Only staff read orders directly; shoppers use get_my_orders() and all writes go through functions.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

drop policy if exists "Staff read orders" on public.orders;
create policy "Staff read orders" on public.orders
  for select to authenticated using ((select public.is_staff()));

drop policy if exists "Staff read order items" on public.order_items;
create policy "Staff read order items" on public.order_items
  for select to authenticated using ((select public.is_staff()));

-- Personalization photos -----------------------------------------------------
-- Private bucket: shoppers can only add photos at checkout paths; staff can view and delete them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-uploads', 'order-uploads', false, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Shoppers upload order photos" on storage.objects;
create policy "Shoppers upload order photos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'order-uploads' and name ~ '^checkout/[0-9a-f-]{36}/[0-9a-z-]{1,64}\.jpg$');

drop policy if exists "Staff read order photos" on storage.objects;
create policy "Staff read order photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-uploads' and (select public.is_staff()));

drop policy if exists "Staff delete order photos" on storage.objects;
create policy "Staff delete order photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'order-uploads' and (select public.is_staff()));

-- Place an order --------------------------------------------------------------
-- p_customer: { name, phone, email, address, city, state, pincode }
-- p_items: [{ variant_id, quantity, recipient_name, message, instructions, photo_path }]
-- Returns { order_number, access_token, total }. Calling again with the same
-- p_idempotency_key (double click, retry) returns the same order.
create or replace function public.place_order(p_idempotency_key uuid, p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_name text := trim(coalesce(p_customer ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_email text := lower(trim(coalesce(p_customer ->> 'email', '')));
  v_address text := trim(coalesce(p_customer ->> 'address', ''));
  v_city text := trim(coalesce(p_customer ->> 'city', ''));
  v_state text := trim(coalesce(p_customer ->> 'state', ''));
  v_pincode text := trim(coalesce(p_customer ->> 'pincode', ''));
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_photo text;
  v_requested integer;
  v_row record;
  v_label text;
  v_order_id uuid;
  v_order_number bigint;
  v_access_token uuid;
  v_total numeric(12, 2);
begin
  if p_idempotency_key is null then
    raise exception 'Missing checkout id - please reload the page and try again.' using hint = 'invalid_request';
  end if;

  -- Serialise retries of the same checkout so a double click can't create two orders.
  perform pg_advisory_xact_lock(hashtextextended('place_order:' || p_idempotency_key::text, 0));

  select order_number, access_token, total into v_existing
  from orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'order_number', v_existing.order_number,
      'access_token', v_existing.access_token,
      'total', v_existing.total
    );
  end if;

  -- Customer details ---------------------------------------------------------
  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'Please enter your full name.' using hint = 'invalid_customer';
  end if;
  if v_phone ~ '^\+91[0-9]{10}$' then
    v_phone := substr(v_phone, 4);
  elsif v_phone ~ '^91[0-9]{10}$' then
    v_phone := substr(v_phone, 3);
  elsif v_phone ~ '^0[0-9]{10}$' then
    v_phone := substr(v_phone, 2);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Please enter a valid 10-digit mobile number.' using hint = 'invalid_customer';
  end if;
  if v_email <> '' and (char_length(v_email) > 150 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Please enter a valid email address, or leave it empty.' using hint = 'invalid_customer';
  end if;
  if v_address = '' or char_length(v_address) > 300 then
    raise exception 'Please enter your delivery address.' using hint = 'invalid_customer';
  end if;
  if v_city = '' or char_length(v_city) > 60 then
    raise exception 'Please enter your city.' using hint = 'invalid_customer';
  end if;
  if v_state = '' or char_length(v_state) > 60 then
    raise exception 'Please enter your state.' using hint = 'invalid_customer';
  end if;
  if v_pincode !~ '^[1-9][0-9]{5}$' then
    raise exception 'Please enter a valid 6-digit PIN code.' using hint = 'invalid_customer';
  end if;

  -- Basic protection against automated orders draining stock.
  if (
    select count(*) from orders
    where customer_phone = v_phone and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Too many orders from this phone number in the last hour. Please try again later or contact us.'
      using hint = 'rate_limited';
  end if;

  -- Cart lines -----------------------------------------------------------------
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using hint = 'invalid_items';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'An order can have at most 30 different items.' using hint = 'invalid_items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_variant_id := (v_item ->> 'variant_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Your cart has an item that can''t be ordered. Please remove it and try again.'
        using hint = 'invalid_items';
    end;

    if v_variant_id is null or v_quantity is null or v_quantity < 1 or v_quantity > 50 then
      raise exception 'Each item needs a quantity between 1 and 50.' using hint = 'invalid_items';
    end if;
    if char_length(coalesce(v_item ->> 'recipient_name', '')) > 100
       or char_length(coalesce(v_item ->> 'message', '')) > 500
       or char_length(coalesce(v_item ->> 'instructions', '')) > 500 then
      raise exception 'Personalization text is too long.' using hint = 'invalid_items';
    end if;

    -- Only the path is checked: storage.objects row-level security may hide uploads from this function.
    v_photo := nullif(trim(coalesce(v_item ->> 'photo_path', '')), '');
    if v_photo is not null
       and v_photo !~ ('^checkout/' || p_idempotency_key::text || '/[0-9a-z-]{1,64}\.jpg$') then
      raise exception 'A personalization photo didn''t upload. Please try placing the order again.'
        using hint = 'invalid_items';
    end if;
  end loop;

  -- Stock: lock each variant (in a fixed order, so concurrent checkouts can't
  -- deadlock), check the total quantity across cart lines, then lower it.
  for v_variant_id, v_requested in
    select (value ->> 'variant_id')::uuid, sum((value ->> 'quantity')::integer)::integer
    from jsonb_array_elements(p_items)
    group by 1
    order by 1
  loop
    select pv.available, pv.price, pv.options, p.title, p.status into v_row
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id
    for update of pv;

    if not found then
      raise exception 'An item in your cart is no longer available. Please remove it and try again.'
        using hint = 'unavailable', detail = v_variant_id::text;
    end if;
    if v_row.status <> 'active' then
      raise exception 'An item in your cart is no longer available. Please remove it and try again.'
        using hint = 'unavailable', detail = v_variant_id::text;
    end if;

    v_label := v_row.title || coalesce(
      ' (' || nullif((select string_agg(o ->> 'value', ' / ') from jsonb_array_elements(v_row.options) as o), '') || ')',
      ''
    );

    if v_row.price <= 0 then
      raise exception '"%" can''t be ordered right now.', v_label
        using hint = 'unavailable', detail = v_variant_id::text;
    end if;
    if v_row.available < v_requested then
      raise exception '%', case
          when v_row.available <= 0 then format('Sorry, "%s" just sold out.', v_label)
          else format('Only %s left of "%s". Please lower the quantity.', v_row.available, v_label)
        end
        using hint = 'out_of_stock', detail = v_variant_id::text;
    end if;

    update product_variants set available = available - v_requested where id = v_variant_id;
  end loop;

  -- Save the order with prices and names as they are right now --------------
  insert into orders (idempotency_key, customer_name, customer_phone, customer_email, address_line, city, state, pincode)
  values (p_idempotency_key, v_name, v_phone, v_email, v_address, v_city, v_state, v_pincode)
  returning id, order_number, access_token into v_order_id, v_order_number, v_access_token;

  insert into order_items (
    order_id, variant_id, product_title, variant_options, unit_price, quantity,
    recipient_name, message, instructions, photo_path, position
  )
  select
    v_order_id,
    pv.id,
    p.title,
    pv.options,
    pv.price,
    (i.value ->> 'quantity')::integer,
    trim(coalesce(i.value ->> 'recipient_name', '')),
    trim(coalesce(i.value ->> 'message', '')),
    trim(coalesce(i.value ->> 'instructions', '')),
    nullif(trim(coalesce(i.value ->> 'photo_path', '')), ''),
    (i.ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as i
  join product_variants pv on pv.id = (i.value ->> 'variant_id')::uuid
  join products p on p.id = pv.product_id;

  select coalesce(sum(unit_price * quantity), 0) into v_total from order_items where order_id = v_order_id;
  update orders set total = v_total where id = v_order_id;

  return jsonb_build_object('order_number', v_order_number, 'access_token', v_access_token, 'total', v_total);
end;
$$;

revoke execute on function public.place_order(uuid, jsonb, jsonb) from public;
grant execute on function public.place_order(uuid, jsonb, jsonb) to anon, authenticated;

-- A shopper's own orders -------------------------------------------------------
create or replace function public.get_my_orders(p_access_tokens uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order_number', o.order_number,
        'access_token', o.access_token,
        'status', o.status,
        'created_at', o.created_at,
        'customer_name', o.customer_name,
        'address_line', o.address_line,
        'city', o.city,
        'state', o.state,
        'pincode', o.pincode,
        'total', o.total,
        'items', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'product_title', oi.product_title,
                'variant_options', oi.variant_options,
                'unit_price', oi.unit_price,
                'quantity', oi.quantity,
                'recipient_name', oi.recipient_name,
                'message', oi.message,
                'instructions', oi.instructions,
                'has_photo', oi.photo_path is not null
              )
              order by oi.position
            ),
            '[]'::jsonb
          )
          from order_items oi
          where oi.order_id = o.id
        )
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
  from orders o
  where o.access_token = any (p_access_tokens[1:50]);
$$;

revoke execute on function public.get_my_orders(uuid[]) from public;
grant execute on function public.get_my_orders(uuid[]) to anon, authenticated;

-- Staff: change an order's status ---------------------------------------------
create or replace function public.admin_update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  perform public.assert_staff();

  if p_status not in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Unknown order status';
  end if;

  select status into v_current from orders where id = p_order_id for update;
  if not found then
    raise exception 'This order no longer exists';
  end if;
  if v_current = p_status then
    return;
  end if;
  if v_current = 'cancelled' then
    raise exception 'A cancelled order can''t be reopened - its stock has already been returned';
  end if;

  -- Cancelling puts the ordered quantities back in stock.
  if p_status = 'cancelled' then
    update product_variants pv
    set available = pv.available + i.quantity
    from (
      select variant_id, sum(quantity)::integer as quantity
      from order_items
      where order_id = p_order_id and variant_id is not null
      group by variant_id
    ) i
    where pv.id = i.variant_id;
  end if;

  update orders set status = p_status, updated_at = now() where id = p_order_id;
end;
$$;

revoke execute on function public.admin_update_order_status(uuid, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, text) to authenticated;

-- The old checkout's stock function is no longer needed ----------------------
drop function if exists public.set_variant_stock(uuid, integer);
