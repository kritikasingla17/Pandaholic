// One-off script to migrate product images from external URLs (Shopify CDN,
// from the original CSV import) into our own Supabase Storage bucket, so the
// storefront no longer depends on a third-party host for images.
//
// Creates the `product-images` bucket automatically if it doesn't exist yet.
// You still need to run database/storage-setup.sql once in the Supabase SQL
// editor before admins can upload new images from the Inventory page in the
// browser (that adds the RLS policies the public anon key needs) - this
// script itself uses the service role key, which bypasses RLS.
//
// Usage (from the backend folder):
//   npm run migrate:images
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Safe to re-run: any URL that already points at our own Storage bucket is
// left untouched, and uploads use upsert so re-uploading the same path is a
// no-op overwrite rather than a duplicate.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
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

const BUCKET = 'product-images';
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const storageHost = new URL(supabaseUrl).host;

function isAlreadyMigrated(url) {
  if (!url) return true;
  try {
    return new URL(url).host === storageHost;
  } catch {
    return true; // not a valid absolute URL - leave it alone
  }
}

function extensionFromUrlOrType(url, contentType) {
  const fromUrl = path.extname(new URL(url).pathname).replace('.', '').split('?')[0];
  if (fromUrl && fromUrl.length <= 5) return fromUrl.toLowerCase();
  if (contentType && contentType.includes('/')) return contentType.split('/')[1].split(';')[0];
  return 'jpg';
}

// Storage object keys must be plain ASCII (no emoji/unicode), or Supabase
// Storage rejects the upload with "Invalid key".
function safeKeySegment(segment) {
  return segment.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'x';
}

async function migrateUrl(url, handle, cache) {
  if (cache.has(url)) return cache.get(url);
  if (isAlreadyMigrated(url)) {
    cache.set(url, url);
    return url;
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`  ! Failed to download ${url} (${response.status}), leaving as-is.`);
    cache.set(url, url);
    return url;
  }
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = extensionFromUrlOrType(url, contentType);
  const fileName = path.basename(new URL(url).pathname).split('?')[0] || `image.${ext}`;
  const objectPath = `${safeKeySegment(handle)}/${safeKeySegment(fileName)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (uploadError) {
    console.warn(`  ! Failed to upload ${url} -> ${objectPath}: ${uploadError.message}`);
    cache.set(url, url);
    return url;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  cache.set(url, data.publicUrl);
  return data.publicUrl;
}

async function main() {
  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(BUCKET);
  if (bucketError || !bucket) {
    console.log(`Bucket "${BUCKET}" not found, creating it...`);
    const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createError) {
      console.error(`Failed to create bucket "${BUCKET}": ${createError.message}`);
      process.exit(1);
    }
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, handle, image, images');
  if (productsError) {
    console.error('Failed to load products:', productsError.message);
    process.exit(1);
  }

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, product_id, image');
  if (variantsError) {
    console.error('Failed to load variants:', variantsError.message);
    process.exit(1);
  }

  const urlCache = new Map();
  let migratedCount = 0;
  let productsUpdated = 0;

  for (const product of products) {
    const before = [product.image, ...(product.images || [])].filter(Boolean);
    if (before.every((url) => isAlreadyMigrated(url))) continue;

    console.log(`Migrating images for "${product.handle}"...`);

    const newImage = product.image ? await migrateUrl(product.image, product.handle, urlCache) : product.image;
    const newImages = [];
    for (const url of product.images || []) {
      newImages.push(await migrateUrl(url, product.handle, urlCache));
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({ image: newImage, images: newImages })
      .eq('id', product.id);

    if (updateError) {
      console.warn(`  ! Failed to update product row ${product.id}: ${updateError.message}`);
      continue;
    }
    productsUpdated += 1;
  }

  const productHandleById = new Map(products.map((p) => [p.id, p.handle]));
  for (const variant of variants) {
    if (!variant.image || isAlreadyMigrated(variant.image)) continue;
    const handle = productHandleById.get(variant.product_id) || 'misc';
    const newImage = await migrateUrl(variant.image, handle, urlCache);
    const { error: updateError } = await supabase
      .from('product_variants')
      .update({ image: newImage })
      .eq('id', variant.id);
    if (updateError) {
      console.warn(`  ! Failed to update variant row ${variant.id}: ${updateError.message}`);
    }
  }

  migratedCount = Array.from(urlCache.values()).filter((v, i) => Array.from(urlCache.keys())[i] !== v).length;

  console.log(
    `Done. Migrated ${migratedCount} unique image(s) to Supabase Storage, updated ${productsUpdated} product row(s).`
  );
}

main();
