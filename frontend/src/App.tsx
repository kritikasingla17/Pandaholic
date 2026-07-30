import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CatalogProvider } from './context/CatalogContext';
import { StoreProvider } from './context/StoreContext';
import Header from './components/Header';
import CategoriesPage from './pages/CategoriesPage';
import CategoryProductsPage from './pages/CategoryProductsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import ContactPage from './pages/ContactPage';

// The Inventory admin page (and its Material UI dependency) is only needed by
// staff, not shoppers, so it's loaded on demand instead of bloating the
// storefront's initial JS bundle.
const InventoryPage = lazy(() => import('./pages/InventoryPage'));

export default function App() {
  return (
    <CatalogProvider>
      <StoreProvider>
        <BrowserRouter>
          <Header />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<CategoriesPage />} />
              <Route path="/category/:categoryName" element={<CategoryProductsPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route
                path="/inventory"
                element={
                  <Suspense fallback={<div className="state-message">Loading…</div>}>
                    <InventoryPage />
                  </Suspense>
                }
              />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </main>
        </BrowserRouter>
      </StoreProvider>
    </CatalogProvider>
  );
}
