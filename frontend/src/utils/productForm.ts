import type { Product } from '../types';
import type { ProductDraft, VariantDraft } from '../data/adminCatalog';

// Mirrors the rules enforced by admin_save_product() in
// backend/supabase/migrations/20261010000000_admin_products.sql.
export const MAX_OPTION_NAMES = 3;
export const MAX_PRODUCT_IMAGES = 20;
export const MAX_VARIANTS = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 60;
const MAX_SKU_LENGTH = 64;
const MAX_PRICE = 9_999_999;

export type ProductStatus = 'active' | 'draft';

// Prices and stock stay as the raw input text while editing, so typing isn't fought by number parsing.
export interface VariantFormRow {
  key: string;
  id: string | null;
  optionValues: string[];
  sku: string;
  price: string;
  compareAtPrice: string;
  available: string;
  expectedAvailable: number | null;
}

export interface ProductForm {
  title: string;
  description: string;
  category: string;
  status: ProductStatus;
  tags: string[];
  images: string[];
  personalizable: boolean;
  featured: boolean;
  optionNames: string[];
  variants: VariantFormRow[];
}

let rowCounter = 0;

export function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function emptyVariantRow(optionCount: number, template?: VariantFormRow): VariantFormRow {
  rowCounter += 1;
  return {
    key: `new-${rowCounter}`,
    id: null,
    optionValues: Array.from({ length: optionCount }, () => ''),
    sku: '',
    price: template?.price ?? '',
    compareAtPrice: template?.compareAtPrice ?? '',
    available: template?.available ?? '0',
    expectedAvailable: null,
  };
}

export function emptyProductForm(): ProductForm {
  return {
    title: '',
    description: '',
    category: 'Other',
    status: 'draft',
    tags: [],
    images: [],
    personalizable: true,
    featured: false,
    optionNames: [],
    variants: [emptyVariantRow(0)],
  };
}

export function productToForm(product: Product): ProductForm {
  const optionNames =
    product.optionNames.length > 0
      ? uniqueInOrder(product.optionNames)
      : uniqueInOrder(product.variants.flatMap((v) => v.options.map((o) => o.name)));

  const variants: VariantFormRow[] = product.variants.map((v) => ({
    key: v.id,
    id: v.id,
    optionValues: optionNames.map(
      (name) => v.options.find((o) => o.name.trim().toLowerCase() === name.toLowerCase())?.value ?? ''
    ),
    sku: v.sku,
    price: String(v.price),
    compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : '',
    available: String(v.available),
    expectedAvailable: v.available,
  }));

  return {
    title: product.title,
    description: product.description,
    category: product.category,
    status: product.status === 'active' ? 'active' : 'draft',
    tags: uniqueInOrder(product.tags),
    images: uniqueInOrder([product.image, ...product.images]),
    personalizable: product.personalizable,
    featured: product.featured,
    optionNames,
    variants: variants.length > 0 ? variants : [emptyVariantRow(optionNames.length)],
  };
}

// Used to detect unsaved changes; row keys are UI-only, so they're left out.
export function formSnapshot(form: ProductForm): string {
  return JSON.stringify({
    ...form,
    variants: form.variants.map((v) => [v.id, v.optionValues, v.sku, v.price, v.compareAtPrice, v.available]),
  });
}

// Keeps each variant's values attached to the right option when options are added, removed or reordered.
export function withOptionNames(form: ProductForm, nextNames: string[]): ProductForm {
  const names = uniqueInOrder(nextNames).slice(0, MAX_OPTION_NAMES);
  return {
    ...form,
    optionNames: names,
    variants: form.variants.map((variant) => ({
      ...variant,
      optionValues: names.map((name) => {
        const previousIndex = form.optionNames.indexOf(name);
        return previousIndex >= 0 ? (variant.optionValues[previousIndex] ?? '') : '';
      }),
    })),
  };
}

export function variantLabel(variant: VariantFormRow, index: number): string {
  const values = variant.optionValues.map((v) => v.trim()).filter(Boolean);
  return values.length > 0 ? values.join(' / ') : `Variant ${index + 1}`;
}

// '' -> null; anything that isn't a finite number -> NaN.
function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateProductForm(form: ProductForm): string[] {
  const errors: string[] = [];
  const title = form.title.trim();
  const optionNames = form.optionNames.map((n) => n.trim());

  if (!title) errors.push('Add a title.');
  else if (title.length > MAX_TITLE_LENGTH) errors.push(`Keep the title to ${MAX_TITLE_LENGTH} characters or fewer.`);
  if (form.category.trim().length > MAX_CATEGORY_LENGTH) {
    errors.push(`Keep the category to ${MAX_CATEGORY_LENGTH} characters or fewer.`);
  }
  if (form.images.length > MAX_PRODUCT_IMAGES) errors.push(`Use at most ${MAX_PRODUCT_IMAGES} images.`);

  if (optionNames.some((n) => !n)) errors.push('Option names can’t be blank.');
  if (optionNames.length > MAX_OPTION_NAMES) errors.push(`Use at most ${MAX_OPTION_NAMES} options.`);
  if (new Set(optionNames.map((n) => n.toLowerCase())).size !== optionNames.length) {
    errors.push('Option names must be different from each other.');
  }

  if (form.variants.length === 0) errors.push('Add at least one variant.');
  if (form.variants.length > MAX_VARIANTS) errors.push(`Use at most ${MAX_VARIANTS} variants.`);
  if (optionNames.length === 0 && form.variants.length > 1) {
    errors.push('Add an option (for example Size) to offer more than one variant.');
  }

  const combos = new Set<string>();
  const skus = new Set<string>();

  form.variants.forEach((variant, index) => {
    const label = variantLabel(variant, index);
    const values = variant.optionValues.map((v) => v.trim());

    if (values.length !== optionNames.length || values.some((v) => !v)) {
      errors.push(`${label}: fill in ${optionNames.join(', ')}.`);
    } else {
      const combo = values.map((v) => v.toLowerCase()).join('\u001f');
      if (combos.has(combo)) errors.push(`${label}: another variant has the same options.`);
      combos.add(combo);
    }

    const price = parseNumber(variant.price);
    if (price === null || Number.isNaN(price) || price < 0) {
      errors.push(`${label}: enter a price of 0 or more.`);
    } else if (price > MAX_PRICE) {
      errors.push(`${label}: the price is too large.`);
    } else {
      if (form.status === 'active' && roundMoney(price) === 0) {
        errors.push(`${label}: active products need a price above ₹0 (or save the product as a draft).`);
      }
      const compareAt = parseNumber(variant.compareAtPrice);
      if (compareAt !== null && compareAt !== 0) {
        if (Number.isNaN(compareAt) || roundMoney(compareAt) <= roundMoney(price) || compareAt > MAX_PRICE) {
          errors.push(`${label}: the compare-at price must be higher than the price.`);
        }
      }
    }

    const available = parseNumber(variant.available);
    if (available === null || !Number.isInteger(available) || available < 0) {
      errors.push(`${label}: stock must be a whole number, 0 or more.`);
    }

    const sku = variant.sku.trim();
    if (sku.length > MAX_SKU_LENGTH) errors.push(`${label}: keep the SKU to ${MAX_SKU_LENGTH} characters or fewer.`);
    if (sku) {
      if (skus.has(sku.toLowerCase())) errors.push(`SKU "${sku}" is used by more than one variant.`);
      skus.add(sku.toLowerCase());
    }
  });

  return errors;
}

// Call only after validateProductForm() returned no errors.
export function formToPayload(form: ProductForm): { product: ProductDraft; variants: VariantDraft[] } {
  return {
    product: {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || 'Other',
      status: form.status,
      tags: uniqueInOrder(form.tags),
      images: uniqueInOrder(form.images),
      optionNames: form.optionNames.map((n) => n.trim()),
      personalizable: form.personalizable,
      featured: form.featured,
    },
    variants: form.variants.map((v) => {
      const compareAt = parseNumber(v.compareAtPrice);
      return {
        id: v.id,
        optionValues: v.optionValues.map((value) => value.trim()),
        sku: v.sku.trim(),
        price: roundMoney(Number(v.price)),
        compareAtPrice: compareAt ? roundMoney(compareAt) : null,
        available: Number(v.available),
        expectedAvailable: v.expectedAvailable,
      };
    }),
  };
}
