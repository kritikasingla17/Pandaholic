import { supabase } from './supabaseClient';

// Uploads a product image straight to Supabase Storage from the browser
// (Inventory admin page) so images live in our own backend instead of
// pointing at an external host. See backend/database/storage-setup.sql for
// the bucket + RLS policies this depends on.
const BUCKET = 'product-images';

export async function uploadProductImage(file: File, folder: string): Promise<string> {
  const safeFolder = (folder || 'misc').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'misc';
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const objectPath = `${safeFolder}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload image: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}
