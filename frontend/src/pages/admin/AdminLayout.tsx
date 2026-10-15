import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Box, Button, Container, ThemeProvider, Toolbar, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useAuth } from '../../context/AuthContext';
import { adminTheme } from './adminTheme';

const ACTIVE_NAV_SX = { bgcolor: 'action.selected' };

export default function AdminLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ordersActive = pathname.startsWith('/admin/orders');

  // The login page performs the sign-out, so an open editor's unsaved-changes prompt can still stop it.
  function handleSignOut() {
    navigate('/admin/login', { replace: true, state: { signOut: true } });
  }

  return (
    <ThemeProvider theme={adminTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8f6f9' }}>
        <meta name="robots" content="noindex, nofollow" />
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 1 }}>
            <Box
              component={RouterLink}
              to="/admin"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2, color: 'inherit', textDecoration: 'none' }}
            >
              <Box component="img" src="/logo.png" alt="Pandaholic" sx={{ height: 34, width: 'auto' }} />
              <Typography component="span" sx={{ fontWeight: 700 }}>
                Admin
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/admin/orders"
              aria-current={ordersActive ? 'page' : undefined}
              sx={ordersActive ? ACTIVE_NAV_SX : undefined}
            >
              Orders
            </Button>
            <Button
              component={RouterLink}
              to="/admin"
              aria-current={ordersActive ? undefined : 'page'}
              sx={ordersActive ? undefined : ACTIVE_NAV_SX}
            >
              Products
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button component={RouterLink} to="/" startIcon={<StorefrontIcon />}>
              View store
            </Button>
            {session?.user.email && (
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                {session.user.email}
              </Typography>
            )}
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={handleSignOut}>
              Sign out
            </Button>
          </Toolbar>
        </AppBar>
        <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 } }}>
          <Outlet />
        </Container>
      </Box>
    </ThemeProvider>
  );
}
