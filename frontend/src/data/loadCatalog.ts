import { supabase } from '../lib/supabaseClient';
import type { Product, ProductVariant, VariantOption } from '../types';

interface ProductRow {
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

interface VariantRow {
  id: string;
  product_id: string;
  sku: string | null;
  options: VariantOption[] | null;
  price: number | string | null;
  compare_at_price: number | string | null;
  available: number | null;
  image: string | null;
}

export async function loadCatalog(): Promise<Product[]> {
  const [{ data: productRows, error: productsError }, { data: variantRows, error: variantsError }] =
    await Promise.all([
      supabase.from('products').select('*').eq('status', 'active'),
      supabase.from('product_variants').select('*'),
    ]);

  if (productsError) throw new Error(`Failed to load products: ${productsError.message}`);
  if (variantsError) throw new Error(`Failed to load variants: ${variantsError.message}`);

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const row of (variantRows ?? []) as VariantRow[]) {
    const existing = variantsByProduct.get(row.product_id);
    if (existing) existing.push(row);
    else variantsByProduct.set(row.product_id, [row]);
  }

  const products: Product[] = ((productRows ?? []) as ProductRow[]).map((row) => {
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
