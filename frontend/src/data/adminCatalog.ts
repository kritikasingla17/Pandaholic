import { supabase } from '../lib/supabaseClient';
import type { Product, VariantOption } from '../types';
import { mapRowsToProducts, type ProductRow, type VariantRow } from './loadCatalog';

// Admin data access for the Inventory page. Unlike loadCatalog() (public,
// active-only catalog), this fetches every product regardless of status so
// staff can manage drafts too, and writes go through dedicated Postgres RPC
// functions (see backend/database/schema.sql) rather than direct table
// writes, keeping one documented, auditable write surface.
//
// SECURITY NOTE: the Inventory page has no authentication yet, so anyone who
// finds /inventory can create, edit, or delete any product. This is an
// accepted trade-off for now (matches the existing stock-adjustment RPC) but
// should be gated behind Supabase Auth + a staff check before going live.

export async function fetchAllProductsForAdmin(): Promise<Product[]> {
  // Same single-round-trip embedded query as loadCatalog(), just without the
  // active-only filter so staff can manage drafts too.
  const { data, error } = await supabase.from('products').select('*, product_variants(*)');

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const productRows = (data ?? []) as (ProductRow & { product_variants: VariantRow[] })[];
  const variantRows = productRows.flatMap((row) => row.product_variants ?? []);
  return mapRowsToProducts(productRows, variantRows);
}

export interface ProductInput {
  title: string;
  description: string;
  category: string;
  tags: string[];
  image: string;
  images: string[];
  optionNames: string[];
  personalizable: boolean;
  status: string;
}

export async function saveProduct(input: ProductInput, productId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_upsert_product', {
    p_product_id: productId ?? null,
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_tags: input.tags,
    p_image: input.image,
    p_images: input.images,
    p_option_names: input.optionNames,
    p_personalizable: input.personalizable,
    p_status: input.status,
  });
  if (error) throw new Error(`Failed to save product: ${error.message}`);
  return data as string;
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_product', { p_product_id: productId });
  if (error) throw new Error(`Failed to delete product: ${error.message}`);
}

export interface VariantInput {
  sku: string;
  options: VariantOption[];
  price: number;
  compareAtPrice: number | null;
  available: number;
  image: string | null;
}

export async function saveVariant(productId: string, input: VariantInput, variantId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_upsert_variant', {
    p_variant_id: variantId ?? null,
    p_product_id: productId,
    p_sku: input.sku,
    p_options: input.options,
    p_price: input.price,
    p_compare_at_price: input.compareAtPrice,
    p_available: input.available,
    p_image: input.image,
  });
  if (error) throw new Error(`Failed to save variant: ${error.message}`);
  return data as string;
}

export async function deleteVariant(variantId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_variant', { p_variant_id: variantId });
  if (error) throw new Error(`Failed to delete variant: ${error.message}`);
}
