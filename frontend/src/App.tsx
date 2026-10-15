import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { StoreProvider } from './context/StoreContext';
import Layout from './components/Layout';
import RequireStaff from './components/RequireStaff';
import CategoriesPage from './pages/CategoriesPage';
import CategoryProductsPage from './pages/CategoryProductsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import ContactPage from './pages/ContactPage';
import NotFoundPage from './pages/NotFoundPage';
import RouteErrorPage from './pages/RouteErrorPage';

// The admin panel (and its Material UI dependency) is only for staff, so it's
// loaded on demand and never downloaded by shoppers.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminProductEditorPage = lazy(() => import('./pages/admin/AdminProductEditorPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));

function withSuspense(page: ReactNode) {
  return <Suspense fallback={<div className="state-message">Loading…</div>}>{page}</Suspense>;
}

function RootRoute() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            // Page errors render inside the layout, so the header and footer stay usable.
            errorElement: <RouteErrorPage />,
            children: [
              { index: true, element: <CategoriesPage /> },
              { path: 'category/:categoryName', element: <CategoryProductsPage /> },
              { path: 'cart', element: <CartPage /> },
              { path: 'checkout', element: <CheckoutPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'contact', element: <ContactPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      { path: 'admin/login', element: withSuspense(<AdminLoginPage />) },
      {
        path: 'admin',
        element: <RequireStaff>{withSuspense(<AdminLayout />)}</RequireStaff>,
        children: [
          {
            errorElement: <RouteErrorPage />,
            children: [
              { index: true, element: withSuspense(<AdminProductsPage />) },
              { path: 'products/new', element: withSuspense(<AdminProductEditorPage />) },
              { path: 'products/:productId', element: withSuspense(<AdminProductEditorPage />) },
              { path: 'orders', element: withSuspense(<AdminOrdersPage />) },
              { path: '*', element: <Navigate to="/admin" replace /> },
            ],
          },
        ],
      },
      // The admin panel's old address, kept working for staff bookmarks only.
      {
        path: 'inventory',
        element: (
          <RequireStaff>
            <Navigate to="/admin" replace />
          </RequireStaff>
        ),
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <StoreProvider>
          <RouterProvider router={router} />
        </StoreProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
