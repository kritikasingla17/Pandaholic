import { supabase } from '../lib/supabaseClient';
import { fetchAllPages } from '../lib/fetchAllPages';
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
  featured: boolean | null;
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
  position: number | null;
}

export type ProductWithVariantsRow = ProductRow & { product_variants: VariantRow[] | null };

// Products with their variants in one round trip (PostgREST embedded resource).
export const PRODUCT_WITH_VARIANTS_SELECT = '*, product_variants(*)';

function mapRowsToProducts(productRows: ProductRow[], variantRows: VariantRow[]): Product[] {
  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const row of variantRows) {
    const existing = variantsByProduct.get(row.product_id);
    if (existing) existing.push(row);
    else variantsByProduct.set(row.product_id, [row]);
  }

  const products: Product[] = productRows.map((row) => {
    const variants: ProductVariant[] = (variantsByProduct.get(row.id) ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((v) => ({
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
      featured: row.featured ?? false,
      status: row.status ?? 'active',
    };
  });

  products.sort((a, b) => a.title.localeCompare(b.title));
  return products;
}

export function mapProductWithVariantsRows(rows: ProductWithVariantsRow[]): Product[] {
  return mapRowsToProducts(rows, rows.flatMap((row) => row.product_variants ?? []));
}

export async function loadCatalog(): Promise<Product[]> {
  try {
    const rows = await fetchAllPages<ProductWithVariantsRow>((from, to) =>
      supabase
        .from('products')
        .select(PRODUCT_WITH_VARIANTS_SELECT, { count: 'exact' })
        .eq('status', 'active')
        .order('id')
        .range(from, to)
    );
    return mapProductWithVariantsRows(rows);
  } catch (err: unknown) {
    throw new Error(`Failed to load products: ${err instanceof Error ? err.message : String(err)}`);
  }
}
