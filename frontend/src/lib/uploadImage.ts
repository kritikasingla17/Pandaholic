import { supabase } from './supabaseClient';

// Uploads a product image straight to Supabase Storage from the browser
// (Inventory admin page) so images live in our own backend instead of
// pointing at an external host. See backend/database/storage-setup.sql for
// the bucket + RLS policies this depends on.
const BUCKET = 'product-images';
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

// Downscale/compress large photos client-side before upload (product photos
// straight off a phone are often 3000px+ / several MB) so every future
// storefront visit stays fast without needing a paid image-transformation
// service. Falls back to the original file if resizing isn't possible/needed.
async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
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
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, JPEG_QUALITY)
    );
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, outputType === 'image/png' ? '.png' : '.jpg');
    return new File([blob], newName, { type: outputType });
  } catch {
    return file; // any decoding failure - just upload the original
  }
}

export async function uploadProductImage(file: File, folder: string): Promise<string> {
  const optimized = await optimizeImage(file);
  const safeFolder = (folder || 'misc').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'misc';
  const ext = optimized.name.includes('.') ? optimized.name.split('.').pop() : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const objectPath = `${safeFolder}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, optimized, {
    contentType: optimized.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload image: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}
