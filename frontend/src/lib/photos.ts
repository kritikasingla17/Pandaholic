// Shrinks shoppers' personalization photos (phone photos are often several MB)
// to a JPEG of at most 1600px, small enough to keep in the cart and upload at checkout.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const MAX_DATA_URL_LENGTH = 2_800_000; // about 2 MB of image data

export async function preparePersonalizationPhoto(file: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('We couldn’t read this photo. Please choose a JPG or PNG image.');
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Your browser couldn’t process this photo. Please try another one.');
  }
  // JPEG has no transparency; without a background, transparent areas turn black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('This photo is too large. Please choose a smaller one.');
  }
  return dataUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ''] = dataUrl.split(',');
  const type = /^data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

// Carts saved before photos were compressed may still hold the original PNG/HEIC data.
export async function jpegBlobFromDataUrl(dataUrl: string): Promise<Blob> {
  const blob = dataUrlToBlob(dataUrl);
  if (blob.type === 'image/jpeg') return blob;
  return dataUrlToBlob(await preparePersonalizationPhoto(blob));
}
