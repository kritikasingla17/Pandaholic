// Both bounds are set explicitly: older browsers throw a RangeError when only
// maximumFractionDigits is lowered below INR's default of 2.
const rupeesFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const rupeesAndPaiseFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Whole amounts show as "₹29"; amounts with paise keep them ("₹29.50") instead of being rounded away.
export function formatCurrency(amount: number): string {
  const paise = Math.round(amount * 100);
  return paise % 100 === 0 ? rupeesFormat.format(paise / 100) : rupeesAndPaiseFormat.format(paise / 100);
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

