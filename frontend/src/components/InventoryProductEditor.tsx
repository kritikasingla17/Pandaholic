import { useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import type { Product, ProductVariant } from '../types';
import { deleteProduct, deleteVariant, saveProduct, saveVariant } from '../data/adminCatalog';
import { formatOptionsText, parseOptionsText } from '../utils/format';
import { uploadProductImage } from '../lib/uploadImage';

interface EditorProps {
  product: Product;
  categoryOptions: string[];
  onChanged: () => void;
}

export default function InventoryProductEditor({ product, categoryOptions, onChanged }: EditorProps) {
  const [title, setTitle] = useState(product.title);
  const [category, setCategory] = useState(product.category);
  const [description, setDescription] = useState(product.description);
  const [image, setImage] = useState(product.image);
  const [status, setStatus] = useState(product.status);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const url = await uploadProductImage(file, product.handle);
      setImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveProduct() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProduct(
        {
          title,
          description,
          category,
          tags: product.tags,
          image,
          images: image ? [image] : [],
          optionNames: product.optionNames,
          personalizable: product.personalizable,
          status,
        },
        product.id
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct() {
    if (!window.confirm(`Delete "${product.title}" and all its variants? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProduct(product.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      setSaving(false);
    }
  }

  async function handleAddVariant() {
    setSaving(true);
    setError(null);
    try {
      await saveVariant(product.id, {
        sku: '',
        options: [],
        price: 0,
        compareAtPrice: null,
        available: 0,
        image: null,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add variant');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          {image ? (
            <Avatar variant="rounded" src={image} sx={{ width: 56, height: 56 }} />
          ) : (
            <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}>
              <ImageNotSupportedIcon color="disabled" fontSize="small" />
            </Avatar>
          )}
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            fullWidth
          />
          <Autocomplete
            freeSolo
            options={categoryOptions}
            inputValue={category}
            onInputChange={(_, value) => setCategory(value)}
            sx={{ minWidth: 180 }}
            renderInput={(params) => <TextField {...params} label="Category" size="small" />}
          />
          <TextField
            select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            size="small"
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
          </TextField>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Save product">
              <span>
                <IconButton color="primary" onClick={handleSaveProduct} disabled={saving}>
                  <SaveIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete product">
              <span>
                <IconButton color="error" onClick={handleDeleteProduct} disabled={saving}>
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={expanded ? 'Hide details' : 'More details'}>
              <IconButton
                onClick={() => setExpanded((v) => !v)}
                sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Collapse in={expanded}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              {image ? <Avatar variant="rounded" src={image} sx={{ width: 48, height: 48 }} /> : null}
              <Button component="label" variant="outlined" size="small" startIcon={<UploadIcon />} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : image ? 'Replace image' : 'Upload image'}
                <input type="file" accept="image/*" hidden onChange={handleImageFileChange} />
              </Button>
            </Stack>
          </Stack>
        </Collapse>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TableContainer sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Options</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Compare at</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {product.variants.map((variant) => (
                <VariantRow key={variant.id} productId={product.id} variant={variant} onChanged={onChanged} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Button startIcon={<AddIcon />} onClick={handleAddVariant} disabled={saving} sx={{ mt: 1 }} size="small">
          Add variant
        </Button>
      </CardContent>
    </Card>
  );
}

function VariantRow({
  productId,
  variant,
  onChanged,
}: {
  productId: string;
  variant: ProductVariant;
  onChanged: () => void;
}) {
  const [optionsText, setOptionsText] = useState(formatOptionsText(variant.options));
  const [sku, setSku] = useState(variant.sku);
  const [price, setPrice] = useState(variant.price);
  const [compareAt, setCompareAt] = useState<number | ''>(variant.compareAtPrice ?? '');
  const [available, setAvailable] = useState(variant.available);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveVariant(
        productId,
        {
          sku,
          options: parseOptionsText(optionsText),
          price: Number(price) || 0,
          compareAtPrice: compareAt === '' ? null : Number(compareAt),
          available: Math.max(0, Number(available) || 0),
          image: variant.image,
        },
        variant.id
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variant');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this variant?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteVariant(variant.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variant');
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell sx={{ minWidth: 160 }}>
        <TextField
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder="Name: Value"
          size="small"
          fullWidth
          variant="standard"
        />
      </TableCell>
      <TableCell sx={{ minWidth: 110 }}>
        <TextField
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          size="small"
          fullWidth
          variant="standard"
        />
      </TableCell>
      <TableCell sx={{ width: 100 }}>
        <TextField
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          size="small"
          fullWidth
          variant="standard"
          slotProps={{ htmlInput: { min: 0 } }}
        />
      </TableCell>
      <TableCell sx={{ width: 110 }}>
        <TextField
          type="number"
          value={compareAt}
          onChange={(e) => setCompareAt(e.target.value === '' ? '' : Number(e.target.value))}
          size="small"
          fullWidth
          variant="standard"
          slotProps={{ htmlInput: { min: 0 } }}
        />
      </TableCell>
      <TableCell sx={{ width: 90 }}>
        <TextField
          type="number"
          value={available}
          onChange={(e) => setAvailable(Number(e.target.value))}
          size="small"
          fullWidth
          variant="standard"
          slotProps={{ htmlInput: { min: 0 } }}
        />
      </TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        <Box>
          <Tooltip title="Save variant">
            <span>
              <IconButton color="primary" size="small" onClick={handleSave} disabled={saving}>
                <SaveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete variant">
            <span>
              <IconButton color="error" size="small" onClick={handleDelete} disabled={saving}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {error && (
          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
            {error}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}
