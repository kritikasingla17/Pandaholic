import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import type { ChipProps } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { useCatalog } from '../../context/CatalogContext';
import { fetchOrdersForAdmin, getOrderPhotoUrl, updateOrderStatus, type AdminOrder } from '../../data/adminOrders';
import { formatOrderNumber, ORDER_STATUS_LABELS, ORDER_STATUSES } from '../../constants/orders';
import { formatCurrency } from '../../utils/format';
import type { OrderStatus } from '../../types';

const ROWS_PER_PAGE = 25;

const STATUS_COLORS: Record<OrderStatus, ChipProps['color']> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'default',
};

function StatusChip({ status }: { status: OrderStatus }) {
  return <Chip size="small" label={ORDER_STATUS_LABELS[status]} color={STATUS_COLORS[status]} />;
}

export default function AdminOrdersPage() {
  const { refresh: refreshCatalog } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status');
  const statusFilter = ORDER_STATUSES.find((s) => s === statusParam) ?? 'all';
  const requestedPage = Math.max(0, Math.floor(Number(searchParams.get('page')) || 0));

  useEffect(() => {
    let active = true;
    fetchOrdersForAdmin()
      .then((data) => {
        if (!active) return;
        setOrders(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load orders');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/[^0-9]/g, '');
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!q) return true;
      return (
        formatOrderNumber(order.orderNumber).toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        (digits.length > 0 && order.customer.phone.includes(digits))
      );
    });
  }, [orders, query, statusFilter]);

  const lastPage = Math.max(0, Math.ceil(filtered.length / ROWS_PER_PAGE) - 1);
  const page = Math.min(requestedPage, lastPage);
  const visible = filtered.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const selected = orders.find((o) => o.id === selectedId) ?? null;

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
            Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {orders.length} total · {pendingCount} waiting to be confirmed
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => setReloadToken((t) => t + 1)}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search by order number, name or phone…"
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
            htmlInput: { 'aria-label': 'Search orders' },
          }}
        />
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => updateParams({ status: e.target.value })}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All</MenuItem>
          {ORDER_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small" aria-label="Orders">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Placed</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Items</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {orders.length === 0 ? 'No orders yet.' : 'No orders match these filters.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((order) => (
                  <TableRow key={order.id} hover onClick={() => setSelectedId(order.id)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ fontWeight: 600 }}>{formatOrderNumber(order.orderNumber)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(order.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {order.customer.name}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {order.customer.phone}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(order.total)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={order.status} />
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
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[ROWS_PER_PAGE]}
          onPageChange={(_, nextPage) => updateParams({ page: nextPage > 0 ? String(nextPage) : null }, true)}
        />
      </Paper>

      {selected && (
        <OrderDialog
          key={selected.id}
          order={selected}
          onClose={() => setSelectedId(null)}
          onStatusChanged={(status) => {
            setNotice(`${formatOrderNumber(selected.orderNumber)} is now ${ORDER_STATUS_LABELS[status].toLowerCase()}`);
            setReloadToken((t) => t + 1);
            if (status === 'cancelled') void refreshCatalog();
          }}
        />
      )}

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

interface OrderDialogProps {
  order: AdminOrder;
  onClose: () => void;
  onStatusChanged: (status: OrderStatus) => void;
}

function OrderDialog({ order, onClose, onStatusChanged }: OrderDialogProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const { customer } = order;

  useEffect(() => {
    let active = true;
    const paths = order.items.map((item) => item.photoPath).filter((path): path is string => path !== null);
    Promise.all(paths.map(async (path) => [path, await getOrderPhotoUrl(path)] as const)).then((entries) => {
      if (!active) return;
      const urls: Record<string, string> = {};
      for (const [path, url] of entries) if (url) urls[path] = url;
      setPhotoUrls(urls);
    });
    return () => {
      active = false;
    };
  }, [order.items]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateOrderStatus(order.id, status);
      onStatusChanged(status);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update the order');
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>
        Order {formatOrderNumber(order.orderNumber)} <StatusChip status={order.status} />
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Placed {new Date(order.createdAt).toLocaleString()}
          </Typography>

          <Box>
            <Typography variant="subtitle2">Customer</Typography>
            <Typography>{customer.name}</Typography>
            <Typography>
              <Link href={`tel:+91${customer.phone}`}>+91 {customer.phone}</Link>
              {' · '}
              <Link href={`https://wa.me/91${customer.phone}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </Link>
            </Typography>
            {customer.email && (
              <Typography>
                <Link href={`mailto:${customer.email}`}>{customer.email}</Link>
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2">Deliver to</Typography>
            <Typography sx={{ whiteSpace: 'pre-line' }}>{customer.address}</Typography>
            <Typography>
              {customer.city}, {customer.state} {customer.pincode}
            </Typography>
          </Box>

          <Divider />

          {order.items.map((item, index) => (
            <Box key={index}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {item.quantity} × {item.productTitle}
                  {item.variantOptions.length > 0 && ` (${item.variantOptions.map((o) => o.value).join(', ')})`}
                </Typography>
                <Typography sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(item.unitPrice * item.quantity)}</Typography>
              </Stack>
              {item.recipientName && <Typography variant="body2">For: {item.recipientName}</Typography>}
              {item.message && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  Text: {item.message}
                </Typography>
              )}
              {item.instructions && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  Instructions: {item.instructions}
                </Typography>
              )}
              {item.photoPath &&
                (photoUrls[item.photoPath] ? (
                  <Link href={photoUrls[item.photoPath]} target="_blank" rel="noopener noreferrer">
                    <Box
                      component="img"
                      src={photoUrls[item.photoPath]}
                      alt={`Reference photo for ${item.productTitle}`}
                      sx={{ mt: 1, width: 96, height: 96, objectFit: 'cover', borderRadius: 1, display: 'block' }}
                    />
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Reference photo attached (loading…)
                  </Typography>
                ))}
            </Box>
          ))}

          <Divider />

          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700 }}>Total</Typography>
            <Typography sx={{ fontWeight: 700 }}>{formatCurrency(order.total)}</Typography>
          </Stack>

          <TextField
            select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            disabled={saving || order.status === 'cancelled'}
            helperText={
              order.status === 'cancelled'
                ? 'Cancelled orders can’t be changed.'
                : 'The customer sees this status on their “My Orders” page.'
            }
          >
            {ORDER_STATUSES.map((value) => (
              <MenuItem key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </MenuItem>
            ))}
          </TextField>

          {status === 'cancelled' && order.status !== 'cancelled' && (
            <Alert severity="warning">Cancelling returns these items to stock and can’t be undone.</Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button
          variant="contained"
          color={status === 'cancelled' ? 'error' : 'primary'}
          onClick={() => void handleSave()}
          disabled={saving || status === order.status}
        >
          {saving ? 'Saving…' : status === 'cancelled' ? 'Cancel order' : 'Update status'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
