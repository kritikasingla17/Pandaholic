import { createTheme } from '@mui/material';

// Brand colours and font from index.css, so the admin panel matches the store.
export const adminTheme = createTheme({
  palette: {
    primary: { main: '#c9445c' },
    text: { primary: '#2b2530' },
  },
  typography: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
  },
});
