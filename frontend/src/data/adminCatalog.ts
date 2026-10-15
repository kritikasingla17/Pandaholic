import { supabase } from '../lib/supabaseClient';
import { fetchAllPages } from '../lib/fetchAllPages';
import { CATEGORY_OPTIONS } from '../constants/categories';
import type { Product } from '../types';
import {
  mapProductWithVariantsRows,
  PRODUCT_WITH_VARIANTS_SELECT,
  type ProductWithVariantsRow,
} from './loadCatalog';

// Admin data access for the staff-only admin panel. Unlike loadCatalog()
// (active products only), reads here include drafts - row-level security only
// returns those to signed-in staff - and every write goes through the
// staff-only RPCs in backend/supabase/migrations, which validate each save.

const COMMON_OPTION_NAMES = ['Size', 'Color', 'Quantity', 'Style', 'Material'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function fetchAllProductsForAdmin(): Promise<Product[]> {
  try {
    const rows = await fetchAllPages<ProductWithVariantsRow>((from, to) =>
      supabase
        .from('products')
        .select(PRODUCT_WITH_VARIANTS_SELECT, { count: 'exact' })
        .order('id')
        .range(from, to)
    );
    return mapProductWithVariantsRows(rows);
  } catch (err: unknown) {
    throw new Error(`Failed to load products: ${errorMessage(err)}`);
  }
}

export async function fetchProductForAdmin(productId: string): Promise<Product | null> {
  if (!UUID_PATTERN.test(productId)) return null;

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_WITH_VARIANTS_SELECT)
    .eq('id', productId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the product: ${error.message}`);
  return data ? mapProductWithVariantsRows([data as ProductWithVariantsRow])[0] : null;
}

export interface AdminSuggestions {
  categories: string[];
  tags: string[];
  optionNames: string[];
}

export const DEFAULT_ADMIN_SUGGESTIONS: AdminSuggestions = {
  categories: uniqueSorted(CATEGORY_OPTIONS),
  tags: [],
  optionNames: uniqueSorted(COMMON_OPTION_NAMES),
};

// Everything already in use (including drafts) plus the baseline lists, for autocomplete.
export async function fetchAdminSuggestions(): Promise<AdminSuggestions> {
  type SuggestionRow = { category: string | null; tags: string[] | null; option_names: string[] | null };
  const rows = await fetchAllPages<SuggestionRow>((from, to) =>
    supabase
      .from('products')
      .select('category, tags, option_names', { count: 'exact' })
      .order('id')
      .range(from, to)
  );
  return {
    categories: uniqueSorted([...CATEGORY_OPTIONS, ...rows.map((r) => r.category ?? '')]),
    tags: uniqueSorted(rows.flatMap((r) => r.tags ?? [])),
    optionNames: uniqueSorted([...COMMON_OPTION_NAMES, ...rows.flatMap((r) => r.option_names ?? [])]),
  };
}

export interface ProductDraft {
  title: string;
  description: string;
  category: string;
  status: 'active' | 'draft';
  tags: string[];
  images: string[];
  optionNames: string[];
  personalizable: boolean;
  featured: boolean;
}

export interface VariantDraft {
  id: string | null;
  optionValues: string[];
  sku: string;
  price: number;
  compareAtPrice: number | null;
  available: number;
  // Stock when the editor loaded it, so the server won't overwrite sales made meanwhile.
  expectedAvailable: number | null;
}

export interface SaveProductResult {
  productId: string;
  unreferencedImages: string[];
}

export async function saveProduct(
  productId: string | null,
  product: ProductDraft,
  variants: VariantDraft[]
): Promise<SaveProductResult> {
  const { data, error } = await supabase.rpc('admin_save_product', {
    p_product_id: productId,
    p_product: {
      title: product.title,
      description: product.description,
      category: product.category,
      status: product.status,
      tags: product.tags,
      images: product.images,
      option_names: product.optionNames,
      personalizable: product.personalizable,
      featured: product.featured,
    },
    p_variants: variants.map((v) => ({
      id: v.id,
      option_values: v.optionValues,
      sku: v.sku,
      price: v.price,
      compare_at_price: v.compareAtPrice,
      available: v.available,
      expected_available: v.expectedAvailable,
    })),
  });
  if (error) throw new Error(error.message);

  const result = data as { product_id: string; unreferenced_images: string[] | null };
  return { productId: result.product_id, unreferencedImages: result.unreferenced_images ?? [] };
}

// Returns the product's images that nothing else uses any more, for Storage cleanup.
export async function deleteProduct(productId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_delete_product', { p_product_id: productId });
  if (error) throw new Error(error.message);
  return (data as { unreferenced_images: string[] | null } | null)?.unreferenced_images ?? [];
}
