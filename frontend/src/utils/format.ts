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
