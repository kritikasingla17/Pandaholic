// One-off script to import the Shopify CSV exports (database/seed-data/*.csv)
// into Supabase's `products` and `product_variants` tables.
//
// Usage (from the backend folder):
//   npm run import:catalog
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// The service role key bypasses RLS, so this must only ever run locally /
// in CI - never ship it to the browser.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendRoot, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. ' +
      'Copy .env.local.example to .env.local (in backend/) and fill both in first.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function readCsv(fileName) {
  const filePath = path.join(__dirname, 'seed-data', fileName);
  const text = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function inventoryKey(handle, o1, o2, o3) {
  return [handle, o1, o2, o3].map((v) => (v || '').trim().toLowerCase()).join('::');
}

function deriveCategory(type, productCategory) {
  const trimmedType = (type || '').trim();
  if (trimmedType) return trimmedType;
  const segments = (productCategory || '').split('>').map((s) => s.trim()).filter(Boolean);
  if (segments.length > 0) return segments[segments.length - 1];
  return 'Uncategorized';
}

function buildProducts() {
  const productRows = readCsv('products_export_1.csv');
  const inventoryRows = readCsv('inventory_export.csv');

  const inventoryMap = new Map();
  for (const row of inventoryRows) {
    if (!row.Handle) continue;
    const key = inventoryKey(row.Handle, row['Option1 Value'], row['Option2 Value'], row['Option3 Value']);
    const qty = parseInt(row['Available (not editable)'], 10);
    inventoryMap.set(key, Number.isFinite(qty) ? qty : 0);
  }

  const groups = new Map();
  for (const row of productRows) {
    if (!row.Handle) continue;
    const existing = groups.get(row.Handle);
    if (existing) existing.push(row);
    else groups.set(row.Handle, [row]);
  }

  const products = [];

  for (const [handle, rows] of groups) {
    const headRow = rows.find((r) => r.Title && r.Title.trim().length > 0) ?? rows[0];
    if (!headRow) continue;
    const status = (headRow.Status || '').trim().toLowerCase();
    if (status && status !== 'active') continue;

    const images = Array.from(
      new Set(rows.map((r) => r['Image Src']).filter((src) => !!src && src.trim().length > 0))
    );

    const variantRows = rows.filter((r) => (r['Variant Price'] || '').trim() !== '');
    const effectiveRows = variantRows.length > 0 ? variantRows : [headRow];

    const groupOpt1Name = (headRow['Option1 Name'] || '').trim();
    const groupOpt2Name = (headRow['Option2 Name'] || '').trim();
    const groupOpt3Name = (headRow['Option3 Name'] || '').trim();

    const optionNamesSet = new Set();
    const variants = effectiveRows.map((row) => {
      const options = [];
      const opt1n = (row['Option1 Name'] || '').trim() || groupOpt1Name;
      const opt1v = (row['Option1 Value'] || '').trim();
      const opt2n = (row['Option2 Name'] || '').trim() || groupOpt2Name;
      const opt2v = (row['Option2 Value'] || '').trim();
      const opt3n = (row['Option3 Name'] || '').trim() || groupOpt3Name;
      const opt3v = (row['Option3 Value'] || '').trim();
      if (opt1n && opt1v && opt1n.toLowerCase() !== 'title') {
        options.push({ name: opt1n, value: opt1v });
        optionNamesSet.add(opt1n);
      }
      if (opt2n && opt2v) {
        options.push({ name: opt2n, value: opt2v });
        optionNamesSet.add(opt2n);
      }
      if (opt3n && opt3v) {
        options.push({ name: opt3n, value: opt3v });
        optionNamesSet.add(opt3n);
      }

      const key = inventoryKey(handle, opt1v, opt2v, opt3v);
      const inventoryQty = inventoryMap.get(key);
      const fallbackQty = parseInt(row['Variant Inventory Qty'], 10);
      const available = inventoryQty ?? (Number.isFinite(fallbackQty) ? fallbackQty : 0);

      const price = parseFloat(row['Variant Price']);
      const compareAt = parseFloat(row['Variant Compare At Price']);

      return {
        sku: (row['Variant SKU'] || '').trim(),
        options,
        price: Number.isFinite(price) ? price : 0,
        compare_at_price: Number.isFinite(compareAt) && compareAt > 0 ? compareAt : null,
        available: Number.isFinite(available) ? available : 0,
        image: null,
      };
    });

    const tags = (headRow.Tags || '').split(',').map((t) => t.trim()).filter(Boolean);

    products.push({
      handle,
      title: headRow.Title.trim(),
      description: stripHtml(headRow['Body (HTML)']),
      category: deriveCategory(headRow.Type, headRow['Product Category']),
      tags,
      image: images[0] ?? '',
      images,
      option_names: Array.from(optionNamesSet),
      personalizable: true,
      status: headRow.Status || 'active',
      variants,
    });
  }

  return products;
}

async function main() {
  const products = buildProducts();
  console.log(`Parsed ${products.length} products from CSV exports.`);

  let productCount = 0;
  let variantCount = 0;

  for (const product of products) {
    const { variants, ...productRow } = product;

    const { data: upserted, error: upsertError } = await supabase
      .from('products')
      .upsert(productRow, { onConflict: 'handle' })
      .select('id')
      .single();

    if (upsertError) {
      console.error(`Failed to upsert product "${product.handle}":`, upsertError.message);
      continue;
    }

    const productId = upserted.id;

    // Re-importing should be idempotent: replace this product's variants
    // rather than trying to diff/merge them.
    const { error: deleteError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId);

    if (deleteError) {
      console.error(`Failed to clear variants for "${product.handle}":`, deleteError.message);
      continue;
    }

    if (variants.length > 0) {
      const rows = variants.map((v) => ({ ...v, product_id: productId }));
      const { error: insertError } = await supabase.from('product_variants').insert(rows);
      if (insertError) {
        console.error(`Failed to insert variants for "${product.handle}":`, insertError.message);
        continue;
      }
      variantCount += rows.length;
    }

    productCount += 1;
  }

  console.log(`Imported ${productCount} products and ${variantCount} variants into Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
