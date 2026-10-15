import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import { visuallyHiddenSx } from '../../components/admin/visuallyHidden';
import { fetchAllProductsForAdmin } from '../../data/adminCatalog';
import { useFlashNotice } from '../../hooks/useFlashNotice';
import { formatCurrency } from '../../utils/format';
import type { Product } from '../../types';

const LOW_STOCK_THRESHOLD = 5;
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_ROWS_PER_PAGE = 25;

type StatusFilter = 'all' | 'active' | 'draft';
type StockFilter = 'all' | 'low' | 'out';

function priceRange(product: Product): string {
  if (product.variants.length === 0) return 'No variants';
  const prices = product.variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

function stockColor(available: number): string {
  if (available <= 0) return 'error.main';
  if (available <= LOW_STOCK_THRESHOLD) return 'warning.main';
  return 'text.primary';
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useFlashNotice();

  // Filters live in the URL so they survive opening a product and coming back.
  const query = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status');
  const status: StatusFilter = statusParam === 'active' || statusParam === 'draft' ? statusParam : 'all';
  const stockParam = searchParams.get('stock');
  const stock: StockFilter = stockParam === 'low' || stockParam === 'out' ? stockParam : 'all';
  const perPageParam = Number(searchParams.get('perPage'));
  const rowsPerPage = ROWS_PER_PAGE_OPTIONS.includes(perPageParam) ? perPageParam : DEFAULT_ROWS_PER_PAGE;
  const requestedPage = Math.max(0, Math.floor(Number(searchParams.get('page')) || 0));

  useEffect(() => {
    let active = true;
    fetchAllProductsForAdmin()
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load products');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const categoryParam = searchParams.get('category') ?? '';
  const category = categories.includes(categoryParam) ? categoryParam : 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (stock === 'out' && p.totalAvailable > 0) return false;
      if (stock === 'low' && p.totalAvailable > LOW_STOCK_THRESHOLD) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
      );
    });
  }, [products, query, status, category, stock]);

  const lastPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const page = Math.min(requestedPage, lastPage);
  const visible = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const activeCount = products.filter((p) => p.status === 'active').length;
  const hasFilters = query !== '' || status !== 'all' || category !== 'all' || stock !== 'all';

  function updateParams(changes: Record<string, string | null>, keepPage = false) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '' || value === 'all') next.delete(key);
          else next.set(key, value);
        }
        if (!keepPage) next.delete('page');
        return next;
      },
      { replace: true }
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            Products
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {products.length} total · {activeCount} active · {products.length - activeCount} drafts
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/admin/products/new">
          Add product
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search by title, handle, category, tag or SKU…"
          value={query}
          onChange={(e) => updateParams({ q: e.target.value })}
          size="small"
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Search products' },
          }}
        />
        <TextField
          select
          label="Status"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value })}
          size="small"
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
        </TextField>
        <TextField
          select
          label="Category"
          value={category}
          onChange={(e) => updateParams({ category: e.target.value })}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All categories</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Stock"
          value={stock}
          onChange={(e) => updateParams({ stock: e.target.value })}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">Any stock</MenuItem>
          <MenuItem value="low">Low ({LOW_STOCK_THRESHOLD} or fewer)</MenuItem>
          <MenuItem value="out">Out of stock</MenuItem>
        </TextField>
      </Stack>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small" aria-label="Products">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 64 }}>
                  <Box component="span" sx={visuallyHiddenSx}>
                    Image
                  </Box>
                </TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="center">Featured</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={{ mb: hasFilters ? 1.5 : 0 }}>
                      {products.length === 0 ? 'No products yet.' : 'No products match these filters.'}
                    </Typography>
                    {hasFilters && (
                      <Button onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>
                        Clear filters
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((product) => (
                  <TableRow
                    key={product.id}
                    hover
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      {product.image ? (
                        <Avatar
                          variant="rounded"
                          src={product.image}
                          alt=""
                          slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
                        />
                      ) : (
                        <Avatar variant="rounded" sx={{ bgcolor: 'action.hover' }}>
                          <ImageNotSupportedIcon color="disabled" fontSize="small" />
                        </Avatar>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/admin/products/${product.id}`}
                        underline="hover"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ fontWeight: 600 }}
                      >
                        {product.title}
                      </Link>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {product.handle}
                      </Typography>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={product.status === 'active' ? 'Active' : 'Draft'}
                        color={product.status === 'active' ? 'success' : 'default'}
                        variant={product.status === 'active' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {priceRange(product)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ color: stockColor(product.totalAvailable), fontWeight: 600 }}>
                        {product.totalAvailable}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {product.featured && <StarIcon fontSize="small" color="warning" titleAccess="Featured" />}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          onPageChange={(_, nextPage) => updateParams({ page: nextPage > 0 ? String(nextPage) : null }, true)}
          onRowsPerPageChange={(e) =>
            updateParams({ perPage: Number(e.target.value) === DEFAULT_ROWS_PER_PAGE ? null : e.target.value })
          }
        />
      </Paper>

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
