import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useBlocker, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ProductImagesEditor from '../../components/admin/ProductImagesEditor';
import VariantsEditor from '../../components/admin/VariantsEditor';
import { useCatalog } from '../../context/CatalogContext';
import {
  DEFAULT_ADMIN_SUGGESTIONS,
  deleteProduct,
  fetchAdminSuggestions,
  fetchProductForAdmin,
  saveProduct,
  type AdminSuggestions,
} from '../../data/adminCatalog';
import { useFlashNotice } from '../../hooks/useFlashNotice';
import { deleteProductImages } from '../../lib/uploadImage';
import {
  emptyProductForm,
  formSnapshot,
  formToPayload,
  productToForm,
  uniqueInOrder,
  validateProductForm,
  withOptionNames,
  type ProductForm,
  type ProductStatus,
} from '../../utils/productForm';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

interface EditorState {
  form: ProductForm;
  savedSnapshot: string;
}

function editorStateFor(form: ProductForm): EditorState {
  return { form, savedSnapshot: formSnapshot(form) };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Remounts per product so no state (form, pending uploads) leaks between products.
export default function AdminProductEditorPage() {
  const { productId } = useParams<{ productId: string }>();
  return <ProductEditor key={productId ?? 'new'} productId={productId ?? null} />;
}

function ProductEditor({ productId }: { productId: string | null }) {
  const navigate = useNavigate();
  const { refresh: refreshCatalog } = useCatalog();
  const [{ form, savedSnapshot }, setEditor] = useState<EditorState>(() => editorStateFor(emptyProductForm()));
  const [handle, setHandle] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(productId ? 'loading' : 'ready');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AdminSuggestions>(DEFAULT_ADMIN_SUGGESTIONS);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useFlashNotice();
  // Images uploaded while editing that no saved version of the product uses yet.
  const pendingUploads = useRef(new Set<string>());
  const skipLeaveGuard = useRef(false);

  const isDirty = formSnapshot(form) !== savedSnapshot;
  const busy = saving || deleting;

  useEffect(() => {
    if (!productId) return;
    let active = true;
    fetchProductForAdmin(productId)
      .then((product) => {
        if (!active) return;
        if (!product) {
          setLoadState('missing');
          return;
        }
        setEditor(editorStateFor(productToForm(product)));
        setHandle(product.handle);
        setLoadState('ready');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(errorText(err));
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;
    fetchAdminSuggestions()
      .then((data) => {
        if (active) setSuggestions(data);
      })
      .catch((err: unknown) => console.warn('Could not load admin suggestions:', err));
    return () => {
      active = false;
    };
  }, []);

  // Uploads that never made it into a saved product are deleted when the editor closes.
  useEffect(() => {
    const pending = pendingUploads.current;
    return () => {
      if (pending.size > 0) void deleteProductImages([...pending]);
      pending.clear();
    };
  }, []);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !skipLeaveGuard.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!isDirty) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const updateForm = useCallback((changes: Partial<ProductForm>) => {
    setEditor((current) => ({ ...current, form: { ...current.form, ...changes } }));
  }, []);

  const handleImageUploaded = useCallback((url: string) => {
    pendingUploads.current.add(url);
    setEditor((current) => ({ ...current, form: { ...current.form, images: [...current.form.images, url] } }));
  }, []);

  async function handleSave() {
    const problems = validateProductForm(form);
    setErrors(problems);
    if (problems.length > 0) return;

    setSaving(true);
    try {
      const { product, variants } = formToPayload(form);
      const result = await saveProduct(productId, product, variants);

      const savedImages = new Set(product.images);
      const discardedUploads = [...pendingUploads.current].filter((url) => !savedImages.has(url));
      pendingUploads.current.clear();
      void deleteProductImages([...result.unreferencedImages, ...discardedUploads]);
      void refreshCatalog();

      if (!productId) {
        skipLeaveGuard.current = true;
        navigate(`/admin/products/${result.productId}`, { replace: true, state: { notice: 'Product created' } });
        return;
      }

      // Reload so newly created variants get their ids before the next save.
      const fresh = await fetchProductForAdmin(productId);
      if (!fresh) {
        setLoadState('missing');
        return;
      }
      setEditor(editorStateFor(productToForm(fresh)));
      setHandle(fresh.handle);
      setNotice('Changes saved');
    } catch (err: unknown) {
      setErrors([errorText(err)]);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productId) return;
    setDeleting(true);
    setErrors([]);
    try {
      const unreferencedImages = await deleteProduct(productId);
      void deleteProductImages([...unreferencedImages, ...pendingUploads.current]);
      pendingUploads.current.clear();
      void refreshCatalog();
      skipLeaveGuard.current = true;
      navigate('/admin', { replace: true, state: { notice: `Deleted “${form.title}”` } });
    } catch (err: unknown) {
      setErrors([errorText(err)]);
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadState === 'missing' || loadState === 'error') {
    return (
      <Alert
        severity={loadState === 'missing' ? 'warning' : 'error'}
        action={
          <Button color="inherit" component={RouterLink} to="/admin">
            Back to products
          </Button>
        }
      >
        {loadState === 'missing' ? 'This product doesn’t exist any more.' : `Couldn’t load the product: ${loadError}`}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button component={RouterLink} to="/admin" startIcon={<ArrowBackIcon />}>
            Products
          </Button>
          <Typography variant="h5" component="h1">
            {productId ? form.title.trim() || 'Untitled product' : 'New product'}
          </Typography>
          {isDirty && <Chip label="Unsaved changes" size="small" color="warning" variant="outlined" />}
        </Stack>
        <Stack direction="row" spacing={1}>
          {productId && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={busy || (productId !== null && !isDirty)}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Stack>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrors([])}>
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {errors.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, alignItems: 'start' }}>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <TextField
                label="Title"
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                required
                fullWidth
                disabled={busy}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                multiline
                minRows={5}
                fullWidth
                disabled={busy}
                helperText="Details like “Size: A4” or “Material: Matte paper” show as a list in the store."
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Images
            </Typography>
            <ProductImagesEditor
              images={form.images}
              folder={handle ?? 'new'}
              disabled={busy}
              onChange={(images) => updateForm({ images })}
              onUploaded={handleImageUploaded}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Options and variants
            </Typography>
            <VariantsEditor
              optionNames={form.optionNames}
              variants={form.variants}
              optionNameSuggestions={suggestions.optionNames}
              disabled={busy}
              onOptionNamesChange={(names) => setEditor((current) => ({ ...current, form: withOptionNames(current.form, names) }))}
              onVariantsChange={(variants) => updateForm({ variants })}
            />
          </Paper>
        </Stack>

        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <TextField
                select
                label="Status"
                value={form.status}
                onChange={(e) => updateForm({ status: e.target.value as ProductStatus })}
                disabled={busy}
                helperText={form.status === 'active' ? 'Visible in the store.' : 'Hidden from shoppers.'}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.featured}
                    onChange={(e) => updateForm({ featured: e.target.checked })}
                    disabled={busy}
                  />
                }
                label="Feature on the home page"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.personalizable}
                    onChange={(e) => updateForm({ personalizable: e.target.checked })}
                    disabled={busy}
                  />
                }
                label="Shoppers can personalize it"
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2}>
              <Autocomplete
                freeSolo
                options={suggestions.categories}
                inputValue={form.category}
                onInputChange={(_, value) => updateForm({ category: value })}
                disabled={busy}
                renderInput={(params) => <TextField {...params} label="Category" />}
              />
              <Autocomplete
                multiple
                freeSolo
                autoSelect
                options={suggestions.tags}
                value={form.tags}
                onChange={(_, value) => updateForm({ tags: uniqueInOrder(value) })}
                disabled={busy}
                renderInput={(params) => (
                  <TextField {...params} label="Tags" helperText="Shoppers can search by tag. Press Enter after each one." />
                )}
              />
            </Stack>
          </Paper>

          {handle && (
            <Typography variant="caption" color="text.secondary">
              Handle: {handle}
            </Typography>
          )}
        </Stack>
      </Box>

      <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()}>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your changes to this product haven’t been saved.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmingDelete} onClose={() => !deleting && setConfirmingDelete(false)}>
        <DialogTitle>Delete this product?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{form.title}” and all of its variants will be removed from the store. This can’t be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete product'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
