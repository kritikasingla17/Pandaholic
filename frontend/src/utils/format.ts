import type { VariantOption } from '../types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Lightweight text <-> VariantOption[] conversion for the Inventory admin
// UI, e.g. "Size: Large, Color: Red" <-> [{name:'Size',value:'Large'},...]
export function formatOptionsText(options: VariantOption[]): string {
  return options.map((o) => `${o.name}: ${o.value}`).join(', ');
}

export function parseOptionsText(text: string): VariantOption[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split(':');
      return { name: (name ?? '').trim(), value: rest.join(':').trim() };
    })
    .filter((o) => o.name && o.value);
}

// Product descriptions (imported from the Shopify CSV) are often a single
// run-on line like "Product Description ... Specifications Size: A4 (210 x
// 297 mm) Material: Matte paper Finish: Matte ..." with no real line breaks.
// This splits known section headings and "Label: value" spec pairs (Size:,
// Material:, Finish:, Suitable for:, etc) onto their own lines so they read
// as a list instead of a wall of text.
const DESCRIPTION_HEADINGS = ['Product Description', 'Specifications'];

export function formatDescription(description: string): string[] {
  if (!description) return [];
  let text = description.trim();

  for (const heading of DESCRIPTION_HEADINGS) {
    text = text.split(heading).join(`\n${heading}\n`);
  }

  // Break "Label:" / "Two Word Label:" pairs onto their own line, e.g.
  // "Size:", "Print Quality:", "Suitable for:".
  text = text.replace(/\s+(?=[A-Z][a-zA-Z]*(?:\s[A-Za-z]+){0,2}:\s)/g, '\n');

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

