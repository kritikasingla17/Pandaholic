import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import InventoryProductEditor from '../components/InventoryProductEditor';
import { fetchAllProductsForAdmin, saveProduct, saveVariant } from '../data/adminCatalog';
import { useCatalog } from '../context/CatalogContext';
import { CATEGORY_OPTIONS } from '../constants/categories';
import { uploadProductImage } from '../lib/uploadImage';
import type { Product } from '../types';

const EMPTY_NEW_PRODUCT = {
  title: '',
  category: 'Other',
  description: '',
  image: '',
  sku: '',
  price: '',
  compareAtPrice: '',
  available: '',
};

export default function InventoryPage() {
  const { refresh: refreshPublicCatalog } = useCatalog();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState(EMPTY_NEW_PRODUCT);
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAllProductsForAdmin();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any admin change should also refresh the public-facing catalog so the
  // storefront doesn't show stale data for the rest of the current session.
  const handleChanged = useCallback(() => {
    refresh();
    refreshPublicCatalog();
  }, [refresh, refreshPublicCatalog]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => {
      const skuMatch = p.variants.some((v) => v.sku.toLowerCase().includes(query));
      return (
        p.title.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        skuMatch
      );
    });
  }, [products, search]);

  // Categories are dynamic, not a fixed list: suggest every category already
  // in use (across all products, including drafts) plus the curated
  // baseline, but the admin can always type a brand new one.
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CATEGORY_OPTIONS);
    products.forEach((p) => set.add(p.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  function updateNewProduct(field: keyof typeof EMPTY_NEW_PRODUCT, value: string) {
    setNewProduct((prev) => ({ ...prev, [field]: value }));
  }

  async function handleImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    setUploadError(null);
    try {
      const url = await uploadProductImage(file, 'new');
      updateNewProduct('image', url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  }

  function closeAddForm() {
    if (creating) return;
    setShowAddForm(false);
    setNewProduct(EMPTY_NEW_PRODUCT);
  }

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    if (!newProduct.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const productId = await saveProduct({
        title: newProduct.title.trim(),
        description: newProduct.description.trim(),
        category: newProduct.category.trim() || 'Other',
        tags: [],
        image: newProduct.image.trim(),
        images: newProduct.image.trim() ? [newProduct.image.trim()] : [],
        optionNames: [],
        personalizable: true,
        status: 'active',
      });

      // Create the product's first variant too, so price/stock/SKU are set
      // immediately instead of requiring a separate "+ Add variant" step.
      await saveVariant(productId, {
        sku: newProduct.sku.trim(),
        options: [],
        price: Number(newProduct.price) || 0,
        compareAtPrice: newProduct.compareAtPrice === '' ? null : Number(newProduct.compareAtPrice),
        available: Math.max(0, Number(newProduct.available) || 0),
        image: newProduct.image.trim() || null,
      });

      setNewProduct(EMPTY_NEW_PRODUCT);
      setShowAddForm(false);
      handleChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Inventory Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowAddForm(true)}>
          Add product
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        placeholder="Search by product, category or SKU…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack spacing={2}>
        {filtered.length === 0 ? (
          <Typography color="text.secondary">No products found.</Typography>
        ) : (
          filtered.map((product) => (
            <InventoryProductEditor
              key={product.id}
              product={product}
              categoryOptions={categoryOptions}
              onChanged={handleChanged}
            />
          ))
        )}
      </Stack>

      <Dialog open={showAddForm} onClose={closeAddForm} fullWidth maxWidth="sm">
        <DialogTitle>Add product</DialogTitle>
        <Box component="form" onSubmit={handleCreateProduct}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  label="Title"
                  value={newProduct.title}
                  onChange={(e) => updateNewProduct('title', e.target.value)}
                  required
                  fullWidth
                  autoFocus
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  freeSolo
                  options={categoryOptions}
                  inputValue={newProduct.category}
                  onInputChange={(_, value) => updateNewProduct('category', value)}
                  renderInput={(params) => <TextField {...params} label="Category" fullWidth />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  {newProduct.image ? (
                    <Avatar variant="rounded" src={newProduct.image} sx={{ width: 48, height: 48 }} />
                  ) : null}
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? 'Uploading…' : newProduct.image ? 'Replace image' : 'Upload image'}
                    <input type="file" accept="image/*" hidden onChange={handleImageFileChange} />
                  </Button>
                </Stack>
                {uploadError && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                    {uploadError}
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="SKU"
                  value={newProduct.sku}
                  onChange={(e) => updateNewProduct('sku', e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Price"
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => updateNewProduct('price', e.target.value)}
                  required
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Compare-at price"
                  type="number"
                  value={newProduct.compareAtPrice}
                  onChange={(e) => updateNewProduct('compareAtPrice', e.target.value)}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Stock"
                  type="number"
                  value={newProduct.available}
                  onChange={(e) => updateNewProduct('available', e.target.value)}
                  fullWidth
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Description"
                  value={newProduct.description}
                  onChange={(e) => updateNewProduct('description', e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeAddForm} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

