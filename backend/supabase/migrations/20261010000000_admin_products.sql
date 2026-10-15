-- Admin panel: one validated, all-or-nothing save for a product and its variants.
-- Replaces admin_upsert_product / admin_upsert_variant / admin_delete_variant
-- (dropped at the end), so apply this together with the matching frontend
-- deploy - the previous admin page can't save once this has run.

-- New fields -----------------------------------------------------------------
alter table public.products add column if not exists featured boolean not null default false;
alter table public.product_variants add column if not exists position integer not null default 0;

-- Give existing variants a stable order (A4 before A5, ...), but only for
-- products that have never been ordered, so re-running this keeps admin edits.
update public.product_variants pv
set position = ordered.rn
from (
  select id, (row_number() over (partition by product_id order by created_at, options::text, id) - 1)::integer as rn
  from public.product_variants
  where product_id in (
    select product_id from public.product_variants group by product_id having max(position) = 0
  )
) ordered
where pv.id = ordered.id;

-- Data rules -----------------------------------------------------------------
-- The old RPCs accepted any status text; anything unknown becomes a hidden draft.
update public.products set status = 'draft' where status not in ('active', 'draft');

alter table public.products drop constraint if exists products_status_check;
alter table public.products add constraint products_status_check check (status in ('active', 'draft'));

-- NOT VALID: enforced for every new write without failing on any old rows.
alter table public.product_variants drop constraint if exists product_variants_price_check;
alter table public.product_variants add constraint product_variants_price_check check (price >= 0) not valid;
alter table public.product_variants drop constraint if exists product_variants_available_check;
alter table public.product_variants add constraint product_variants_available_check check (available >= 0) not valid;

-- Image cleanup helper -------------------------------------------------------
-- Returns the given image URLs that no product or variant uses any more, so the
-- admin page can delete those files from Storage. Internal: not callable via the API.
create or replace function public.unreferenced_product_images(p_urls text[])
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct u), '{}')
  from unnest(p_urls) as u
  where u <> ''
    and not exists (select 1 from products p where p.image = u or u = any (p.images))
    and not exists (select 1 from product_variants pv where pv.image = u);
$$;

revoke execute on function public.unreferenced_product_images(text[]) from public, anon, authenticated;

-- Save a product with all of its variants ------------------------------------
-- p_product: { title, description, category, status, tags[], images[] (first = main),
--              option_names[], personalizable, featured }
-- p_variants: [{ id (null = new), option_values[] (one per option name), sku, price,
--               compare_at_price, available, expected_available (stock when loaded) }]
-- Variants missing from p_variants are deleted. Returns { product_id, unreferenced_images }.
create or replace function public.admin_save_product(p_product_id uuid, p_product jsonb, p_variants jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid := p_product_id;
  v_title text := trim(coalesce(p_product ->> 'title', ''));
  v_description text := trim(coalesce(p_product ->> 'description', ''));
  v_category text := coalesce(nullif(trim(p_product ->> 'category'), ''), 'Other');
  v_status text := coalesce(nullif(trim(p_product ->> 'status'), ''), 'draft');
  v_personalizable boolean := coalesce((p_product ->> 'personalizable')::boolean, true);
  v_featured boolean := coalesce((p_product ->> 'featured')::boolean, false);
  v_tags text[];
  v_images text[];
  v_option_names text[];
  v_old_images text[] := '{}';
  v_base_handle text;
  v_handle text;
  v_suffix integer := 1;
  v_variant jsonb;
  v_position integer;
  v_variant_id uuid;
  v_kept_variant_ids uuid[] := '{}';
  v_values text[];
  v_label text;
  v_options jsonb;
  v_combo text;
  v_combos text[] := '{}';
  v_price numeric;
  v_compare_at numeric;
  v_available integer;
  v_expected integer;
  v_current integer;
  v_sku text;
  v_skus text[] := '{}';
  v_taken_sku text;
begin
  perform public.assert_staff();

  if jsonb_typeof(p_product) is distinct from 'object' then
    raise exception 'Product details are missing';
  end if;
  if v_title = '' then
    raise exception 'Title is required';
  end if;
  if char_length(v_title) > 200 then
    raise exception 'Title must be 200 characters or fewer';
  end if;
  if char_length(v_category) > 60 then
    raise exception 'Category must be 60 characters or fewer';
  end if;
  if v_status not in ('active', 'draft') then
    raise exception 'Status must be active or draft';
  end if;

  select coalesce(array_agg(distinct tag order by tag), '{}') into v_tags
  from (
    select trim(value) as tag
    from jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb))
  ) t
  where tag <> '';

  -- De-duplicated, keeping the admin's order (the first image is the main one).
  select coalesce(array_agg(url order by first_position), '{}') into v_images
  from (
    select trim(value) as url, min(ordinality) as first_position
    from jsonb_array_elements_text(coalesce(p_product -> 'images', '[]'::jsonb)) with ordinality
    where trim(value) <> ''
    group by trim(value)
  ) i;

  if exists (select 1 from unnest(v_images) as url where url !~ '^https?://') then
    raise exception 'Images must be http(s) links';
  end if;
  if cardinality(v_images) > 20 then
    raise exception 'A product can have at most 20 images';
  end if;

  select coalesce(array_agg(trim(value) order by ordinality), '{}') into v_option_names
  from jsonb_array_elements_text(coalesce(p_product -> 'option_names', '[]'::jsonb)) with ordinality;

  if exists (select 1 from unnest(v_option_names) as name where name = '') then
    raise exception 'Option names cannot be blank';
  end if;
  if cardinality(v_option_names) > 3 then
    raise exception 'A product can have at most 3 options';
  end if;
  if (select count(distinct lower(name)) from unnest(v_option_names) as name) <> cardinality(v_option_names) then
    raise exception 'Option names must be different from each other';
  end if;

  if jsonb_typeof(p_variants) is distinct from 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'Add at least one variant';
  end if;
  if jsonb_array_length(p_variants) > 100 then
    raise exception 'A product can have at most 100 variants';
  end if;
  if cardinality(v_option_names) = 0 and jsonb_array_length(p_variants) > 1 then
    raise exception 'Add an option (for example Size) to offer more than one variant';
  end if;

  if v_product_id is null then
    v_base_handle := trim(both '-' from lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g')));
    if v_base_handle = '' then
      v_base_handle := 'product';
    end if;
    v_handle := v_base_handle;
    while exists (select 1 from products where handle = v_handle) loop
      v_suffix := v_suffix + 1;
      v_handle := v_base_handle || '-' || v_suffix;
    end loop;

    insert into products (handle, title, description, category, tags, image, images, option_names, personalizable, featured, status)
    values (v_handle, v_title, v_description, v_category, v_tags, coalesce(v_images[1], ''), v_images,
            v_option_names, v_personalizable, v_featured, v_status)
    returning id into v_product_id;
  else
    select array_remove(array[p.image] || p.images, '') into v_old_images
    from products p
    where p.id = v_product_id
    for update;

    if not found then
      raise exception 'This product no longer exists';
    end if;

    v_old_images := v_old_images || coalesce(
      (select array_agg(pv.image) from product_variants pv where pv.product_id = v_product_id and pv.image is not null),
      '{}'
    );

    update products set
      title = v_title,
      description = v_description,
      category = v_category,
      tags = v_tags,
      image = coalesce(v_images[1], ''),
      images = v_images,
      option_names = v_option_names,
      personalizable = v_personalizable,
      featured = v_featured,
      status = v_status
    where id = v_product_id;
  end if;

  -- Any error below rolls back everything above, so a save is all-or-nothing.
  for v_variant, v_position in
    select value, (ordinality - 1)::integer from jsonb_array_elements(p_variants) with ordinality
  loop
    v_values := array(
      select trim(value)
      from jsonb_array_elements_text(coalesce(v_variant -> 'option_values', '[]'::jsonb)) with ordinality
      order by ordinality
    );
    v_label := coalesce(nullif(array_to_string(v_values, ' / '), ''), 'The variant');

    if cardinality(v_values) <> cardinality(v_option_names)
       or exists (select 1 from unnest(v_values) as val where val = '') then
      raise exception 'Every variant needs a value for %', array_to_string(v_option_names, ', ');
    end if;

    v_combo := lower(array_to_string(v_values, chr(31)));
    if v_combo = any (v_combos) then
      raise exception 'Two variants have the same options (%)', v_label;
    end if;
    v_combos := v_combos || v_combo;

    begin
      v_price := round((v_variant ->> 'price')::numeric, 2);
      v_compare_at := round(nullif((v_variant ->> 'compare_at_price')::numeric, 0), 2);
      v_available := (v_variant ->> 'available')::integer;
      v_expected := (v_variant ->> 'expected_available')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception '%: price and stock must be valid numbers', v_label;
    end;

    if v_price is null or v_price < 0 then
      raise exception '%: price must be 0 or more', v_label;
    end if;
    if v_price > 9999999 then
      raise exception '%: price is too large', v_label;
    end if;
    if v_status = 'active' and v_price = 0 then
      raise exception '%: active products need a price above ₹0 (or save the product as a draft)', v_label;
    end if;
    if v_compare_at is not null and (v_compare_at <= v_price or v_compare_at > 9999999) then
      raise exception '%: compare-at price must be higher than the price', v_label;
    end if;
    if v_available is null or v_available < 0 then
      raise exception '%: stock must be 0 or more', v_label;
    end if;

    v_sku := trim(coalesce(v_variant ->> 'sku', ''));
    if char_length(v_sku) > 64 then
      raise exception '%: SKU must be 64 characters or fewer', v_label;
    end if;
    if v_sku <> '' then
      if lower(v_sku) = any (v_skus) then
        raise exception 'SKU "%" is used by more than one variant', v_sku;
      end if;
      v_skus := v_skus || lower(v_sku);
    end if;

    v_options := coalesce(
      (
        select jsonb_agg(jsonb_build_object('name', n.name, 'value', v.val) order by n.ord)
        from unnest(v_option_names) with ordinality as n(name, ord)
        join unnest(v_values) with ordinality as v(val, ord) on v.ord = n.ord
      ),
      '[]'::jsonb
    );

    v_variant_id := nullif(v_variant ->> 'id', '')::uuid;

    if v_variant_id is null then
      insert into product_variants (product_id, sku, options, price, compare_at_price, available, position)
      values (v_product_id, v_sku, v_options, v_price, v_compare_at, v_available, v_position)
      returning id into v_variant_id;
    else
      select available into v_current
      from product_variants
      where id = v_variant_id and product_id = v_product_id
      for update;

      if not found then
        raise exception '%: this variant no longer exists - reload the product', v_label;
      end if;

      -- Orders can change stock while the editor is open: keep their changes unless
      -- the admin edited stock too, in which case ask them to reload instead of overwriting.
      if v_expected is not null and v_available = v_expected then
        v_available := v_current;
      elsif v_expected is not null and v_current <> v_expected then
        raise exception '%: stock changed to % while you were editing - reload the product', v_label, v_current;
      end if;

      update product_variants set
        sku = v_sku,
        options = v_options,
        price = v_price,
        compare_at_price = v_compare_at,
        available = v_available,
        position = v_position
      where id = v_variant_id;
    end if;

    v_kept_variant_ids := v_kept_variant_ids || v_variant_id;
  end loop;

  delete from product_variants
  where product_id = v_product_id and not (id = any (v_kept_variant_ids));

  select pv.sku into v_taken_sku
  from product_variants pv
  where pv.product_id <> v_product_id and pv.sku <> '' and lower(pv.sku) = any (v_skus)
  limit 1;

  if v_taken_sku is not null then
    raise exception 'SKU "%" is already used by another product', v_taken_sku;
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'unreferenced_images', to_jsonb(public.unreferenced_product_images(v_old_images))
  );
end;
$$;

revoke execute on function public.admin_save_product(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb, jsonb) to authenticated;

-- Delete a product ----------------------------------------------------------
-- Now also reports which of its images nothing else uses, for Storage cleanup.
drop function if exists public.admin_delete_product(uuid);

create function public.admin_delete_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_images text[];
begin
  perform public.assert_staff();

  select array_remove(array[p.image] || p.images, '') into v_images
  from products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'This product no longer exists';
  end if;

  v_images := v_images || coalesce(
    (select array_agg(pv.image) from product_variants pv where pv.product_id = p_product_id and pv.image is not null),
    '{}'
  );

  delete from products where id = p_product_id;

  return jsonb_build_object('unreferenced_images', to_jsonb(public.unreferenced_product_images(v_images)));
end;
$$;

revoke execute on function public.admin_delete_product(uuid) from public, anon;
grant execute on function public.admin_delete_product(uuid) to authenticated;

-- Superseded by admin_save_product() ------------------------------------------
drop function if exists public.admin_upsert_product(uuid, text, text, text, text[], text, text[], text[], boolean, text);
drop function if exists public.admin_upsert_variant(uuid, uuid, text, jsonb, numeric, numeric, integer, text);
drop function if exists public.admin_delete_variant(uuid);
