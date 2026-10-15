import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { adminTheme } from './adminTheme';

// Not linked from anywhere in the store; staff open /admin/login directly.
export default function AdminLoginPage() {
  const { session, isStaff, loading, accessError, signIn, signOut } = useAuth();
  const location = useLocation();
  const signOutRequested = (location.state as { signOut?: boolean } | null)?.signOut === true;
  const [signingOut, setSigningOut] = useState(signOutRequested);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arriving from the admin panel's "Sign out" button.
  useEffect(() => {
    if (!signOutRequested) return;
    let active = true;
    signOut().finally(() => {
      if (active) setSigningOut(false);
    });
    return () => {
      active = false;
    };
  }, [signOutRequested, signOut]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setSubmitting(false);
    if (message) {
      setError(message);
    } else {
      setPassword('');
    }
  }

  if (session && isStaff && !loading && !signingOut) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <ThemeProvider theme={adminTheme}>
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 6 }}>
        <meta name="robots" content="noindex, nofollow" />
        <Card variant="outlined" sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box
              component="img"
              src="/logo.png"
              alt="Pandaholic"
              sx={{ display: 'block', height: 44, width: 'auto', mx: 'auto', mb: 2 }}
            />
            <Typography variant="h5" component="h1" sx={{ textAlign: 'center', mb: 3 }}>
              Staff sign in
            </Typography>

            {loading || signingOut ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : session ? (
              <Stack spacing={2}>
                <Alert severity="warning">
                  {accessError ?? `${session.user.email ?? 'This account'} doesn't have staff access.`}
                </Alert>
                <Button variant="outlined" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </Stack>
            ) : (
              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  {error && <Alert severity="error">{error}</Alert>}
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    fullWidth
                    autoFocus
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    fullWidth
                  />
                  <Button type="submit" variant="contained" size="large" disabled={submitting}>
                    {submitting ? 'Signing in…' : 'Sign in'}
                  </Button>
                </Stack>
              </Box>
            )}

            <Typography variant="body2" sx={{ textAlign: 'center', mt: 3 }}>
              <Link component={RouterLink} to="/">
                Back to the store
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
}
