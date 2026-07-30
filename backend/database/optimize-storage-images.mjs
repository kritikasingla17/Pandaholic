// One-off/re-runnable script that downsizes/compresses every product and
// variant image that ALREADY lives in our Supabase Storage bucket (i.e. the
// images migrated by migrate-images-to-storage.mjs, or uploaded before
// uploadImage.ts started optimizing on upload client-side).
//
// Each image is downloaded, resized (max 1600px on the longest side,
// preserving aspect ratio, never upscaled) and re-compressed (JPEG q82,
// mozjpeg; PNGs stay PNG but get re-compressed), then re-uploaded to the
// SAME object path (upsert). Because the path/public URL doesn't change,
// no product/variant DB rows need updating.
//
// Usage (from the backend folder):
//   npm run optimize:images
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Safe to re-run: images already at/under the target size are skipped, and
// an image is only re-uploaded if the optimized version is actually smaller.
// Note: this rewrites bytes in place and is lossy (JPEG re-compression) -
// there's no automatic way to get the original bytes back afterwards.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sharp from 'sharp';
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
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
const SKIP_BELOW_BYTES = 400 * 1024; // don't bother re-encoding small images already under this size

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;

function objectPathFromUrl(url) {
  if (!url || !url.startsWith(publicPrefix)) return null; // not one of our own Storage objects
  return decodeURIComponent(url.slice(publicPrefix.length));
}

async function optimizeObject(objectPath, cache) {
  if (cache.has(objectPath)) return cache.get(objectPath);

  const ext = path.extname(objectPath).toLowerCase();
  if (ext === '.svg' || ext === '.gif') {
    cache.set(objectPath, null); // leave animated/vector images untouched
    return null;
  }

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(objectPath);
  if (downloadError || !blob) {
    console.warn(`  ! Failed to download ${objectPath}: ${downloadError?.message}`);
    cache.set(objectPath, null);
    return null;
  }

  const inputBuffer = Buffer.from(await blob.arrayBuffer());

  let metadata;
  try {
    metadata = await sharp(inputBuffer).metadata();
  } catch (err) {
    console.warn(`  ! Failed to read ${objectPath}: ${err.message}`);
    cache.set(objectPath, null);
    return null;
  }

  const longestSide = Math.max(metadata.width || 0, metadata.height || 0);
  if (longestSide > 0 && longestSide <= MAX_DIMENSION && inputBuffer.length < SKIP_BELOW_BYTES) {
    cache.set(objectPath, null); // already small enough, not worth re-encoding
    return null;
  }

  let image = sharp(inputBuffer);
  if (longestSide > MAX_DIMENSION) {
    image = image.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
  }

  const isPng = metadata.format === 'png';
  const outputBuffer = isPng
    ? await image.png({ compressionLevel: 9 }).toBuffer()
    : await image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

  if (outputBuffer.length >= inputBuffer.length) {
    cache.set(objectPath, null); // re-encoding didn't actually help - leave original alone
    return null;
  }

  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, outputBuffer, { contentType, upsert: true });

  if (uploadError) {
    console.warn(`  ! Failed to re-upload ${objectPath}: ${uploadError.message}`);
    cache.set(objectPath, null);
    return null;
  }

  const result = { before: inputBuffer.length, after: outputBuffer.length };
  console.log(`  ✓ ${objectPath}: ${(result.before / 1024).toFixed(0)}kB -> ${(result.after / 1024).toFixed(0)}kB`);
  cache.set(objectPath, result);
  return result;
}

async function main() {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, handle, image, images');
  if (productsError) {
    console.error('Failed to load products:', productsError.message);
    process.exit(1);
  }

  const { data: variants, error: variantsError } = await supabase.from('product_variants').select('id, image');
  if (variantsError) {
    console.error('Failed to load variants:', variantsError.message);
    process.exit(1);
  }

  const objectPaths = new Set();
  for (const product of products) {
    for (const url of [product.image, ...(product.images || [])].filter(Boolean)) {
      const objectPath = objectPathFromUrl(url);
      if (objectPath) objectPaths.add(objectPath);
    }
  }
  for (const variant of variants) {
    const objectPath = objectPathFromUrl(variant.image);
    if (objectPath) objectPaths.add(objectPath);
  }

  console.log(`Found ${objectPaths.size} unique image(s) in Storage referenced by products/variants. Checking each...`);

  const cache = new Map();
  let optimizedCount = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const objectPath of objectPaths) {
    const result = await optimizeObject(objectPath, cache);
    if (result) {
      optimizedCount += 1;
      bytesBefore += result.before;
      bytesAfter += result.after;
    }
  }

  const savedMb = ((bytesBefore - bytesAfter) / (1024 * 1024)).toFixed(2);
  console.log(
    `Done. Optimized ${optimizedCount} of ${objectPaths.size} image(s) in place (same URLs, no DB changes needed). ` +
      `Saved ~${savedMb}MB.`
  );
}

main();
