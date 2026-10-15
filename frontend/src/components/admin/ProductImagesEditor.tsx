import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import UploadIcon from '@mui/icons-material/Upload';
import { IMAGE_INPUT_ACCEPT, uploadProductImage } from '../../lib/uploadImage';
import { MAX_PRODUCT_IMAGES } from '../../utils/productForm';

interface ProductImagesEditorProps {
  images: string[];
  // Storage folder for new uploads (the product's handle, or "new").
  folder: string;
  disabled?: boolean;
  onChange: (images: string[]) => void;
  onUploaded: (url: string) => void;
}

export default function ProductImagesEditor({
  images,
  folder,
  disabled = false,
  onChange,
  onUploaded,
}: ProductImagesEditorProps) {
  const [uploadsLeft, setUploadsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = disabled || uploadsLeft > 0;

  function moveImage(index: number, targetIndex: number) {
    const next = images.slice();
    const [image] = next.splice(index, 1);
    next.splice(targetIndex, 0, image);
    onChange(next);
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const room = MAX_PRODUCT_IMAGES - images.length;
    const accepted = files.slice(0, Math.max(0, room));
    const problems: string[] = [];
    if (accepted.length < files.length) {
      problems.push(`A product can have at most ${MAX_PRODUCT_IMAGES} images.`);
    }

    setError(null);
    setUploadsLeft(accepted.length);
    for (const file of accepted) {
      try {
        onUploaded(await uploadProductImage(file, folder));
      } catch (err: unknown) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`);
      } finally {
        setUploadsLeft((count) => count - 1);
      }
    }
    if (problems.length > 0) setError(problems.join(' '));
  }

  return (
    <Stack spacing={1.5}>
      {images.length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 1.5 }}>
          {images.map((url, index) => (
            <Box
              key={url}
              sx={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 2,
                overflow: 'hidden',
                border: 2,
                borderColor: index === 0 ? 'primary.main' : 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Box
                component="img"
                src={url}
                alt={`Product image ${index + 1}`}
                loading="lazy"
                decoding="async"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {index === 0 && (
                <Chip label="Main" size="small" color="primary" sx={{ position: 'absolute', top: 6, left: 6 }} />
              )}
              <Stack
                direction="row"
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'space-between',
                  bgcolor: 'rgba(255, 255, 255, 0.92)',
                }}
              >
                <Tooltip title="Move left">
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Move image ${index + 1} left`}
                      disabled={busy || index === 0}
                      onClick={() => moveImage(index, index - 1)}
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Make main image">
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Make image ${index + 1} the main image`}
                      disabled={busy || index === 0}
                      onClick={() => moveImage(index, 0)}
                    >
                      <StarIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move right">
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Move image ${index + 1} right`}
                      disabled={busy || index === images.length - 1}
                      onClick={() => moveImage(index, index + 1)}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Remove">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Remove image ${index + 1}`}
                      disabled={busy}
                      onClick={() => onChange(images.filter((_, i) => i !== index))}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No images yet. The first image is the one shoppers see on product cards.
        </Typography>
      )}

      <Box>
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadIcon />}
          disabled={busy || images.length >= MAX_PRODUCT_IMAGES}
        >
          {uploadsLeft > 0 ? `Uploading ${uploadsLeft}…` : 'Upload images'}
          <input type="file" accept={IMAGE_INPUT_ACCEPT} multiple hidden onChange={handleFiles} />
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
