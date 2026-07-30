import { supabase } from '../lib/supabaseClient';
import type { Product, ProductVariant, VariantOption } from '../types';

export interface ProductRow {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  image: string | null;
  images: string[] | null;
  option_names: string[] | null;
  personalizable: boolean | null;
  status: string | null;
}

export interface VariantRow {
  id: string;
  product_id: string;
  sku: string | null;
  options: VariantOption[] | null;
  price: number | string | null;
  compare_at_price: number | string | null;
  available: number | null;
  image: string | null;
}

export function mapRowsToProducts(productRows: ProductRow[], variantRows: VariantRow[]): Product[] {
  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const row of variantRows) {
    const existing = variantsByProduct.get(row.product_id);
    if (existing) existing.push(row);
    else variantsByProduct.set(row.product_id, [row]);
  }

  const products: Product[] = productRows.map((row) => {
    const variants: ProductVariant[] = (variantsByProduct.get(row.id) ?? []).map((v) => ({
      id: v.id,
      sku: v.sku ?? '',
      options: v.options ?? [],
      price: Number(v.price) || 0,
      compareAtPrice: v.compare_at_price != null ? Number(v.compare_at_price) : null,
      available: v.available ?? 0,
      image: v.image ?? null,
    }));

    const prices = variants.map((v) => v.price).filter((p) => p > 0);

    return {
      id: row.id,
      handle: row.handle,
      title: row.title,
      description: row.description ?? '',
      category: row.category ?? 'Uncategorized',
      tags: row.tags ?? [],
      image: row.image ?? '',
      images: row.images ?? [],
      variants,
      optionNames: row.option_names ?? [],
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      totalAvailable: variants.reduce((sum, v) => sum + v.available, 0),
      personalizable: row.personalizable ?? true,
      status: row.status ?? 'active',
    };
  });

  products.sort((a, b) => a.title.localeCompare(b.title));
  return products;
}

export async function loadCatalog(): Promise<Product[]> {
  // Fetch products and their variants in a single round trip using
  // PostgREST's embedded-resource syntax (based on the product_variants ->
  // products foreign key), instead of two separate queries.
  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('status', 'active');

  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const productRows = (data ?? []) as (ProductRow & { product_variants: VariantRow[] })[];
  const variantRows = productRows.flatMap((row) => row.product_variants ?? []);
  return mapRowsToProducts(productRows, variantRows);
}
