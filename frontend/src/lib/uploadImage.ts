import { supabase } from './supabaseClient';

// Uploads a product image straight to Supabase Storage from the staff-only
// admin page. The type/size limits mirror the product-images bucket settings
// in backend/supabase/migrations/20261009000000_staff_access.sql, so keep both in sync.
const BUCKET = 'product-images';
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export const IMAGE_INPUT_ACCEPT = Object.keys(EXTENSION_BY_TYPE).join(',');

// Downscale/compress large photos client-side before upload (product photos
// straight off a phone are often 3000px+ / several MB) so every future
// storefront visit stays fast without needing a paid image-transformation
// service. Falls back to the original file if resizing isn't possible/needed.
async function optimizeImage(file: File): Promise<File> {
  if (file.type === 'image/gif') {
    return file; // re-encoding would drop the animation
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return file; // already small enough
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    if (outputType === 'image/jpeg') {
      // JPEG has no transparency; without this, transparent WebP/AVIF areas turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, JPEG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name, { type: outputType });
  } catch {
    return file; // any decoding failure - just upload the original
  }
}

export async function uploadProductImage(file: File, folder: string): Promise<string> {
  if (!EXTENSION_BY_TYPE[file.type]) {
    throw new Error('Please choose a JPEG, PNG, WebP, GIF or AVIF image.');
  }

  const optimized = await optimizeImage(file);
  if (optimized.size > MAX_UPLOAD_BYTES) {
    throw new Error('This image is larger than 10 MB even after compression. Please choose a smaller one.');
  }

  const safeFolder = (folder || 'misc').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'misc';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXTENSION_BY_TYPE[optimized.type]}`;
  const objectPath = `${safeFolder}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, optimized, {
    contentType: optimized.type,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload image: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

// Best-effort cleanup of images nothing uses any more; links outside our bucket are ignored.
export async function deleteProductImages(urls: string[]): Promise<void> {
  const publicPrefix = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl;
  const paths = Array.from(new Set(urls))
    .filter((url) => url.startsWith(publicPrefix))
    .map((url) => decodeURIComponent(url.slice(publicPrefix.length)))
    .filter(Boolean);
  if (paths.length === 0) return;

  try {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) console.warn('Could not delete unused product images:', error.message);
  } catch (err: unknown) {
    console.warn('Could not delete unused product images:', err);
  }
}
