import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CatalogProvider } from './context/CatalogContext';
import { StoreProvider } from './context/StoreContext';
import Header from './components/Header';
import CategoriesPage from './pages/CategoriesPage';
import CategoryProductsPage from './pages/CategoryProductsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import InventoryPage from './pages/InventoryPage';
import ContactPage from './pages/ContactPage';

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
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </main>
        </BrowserRouter>
      </StoreProvider>
    </CatalogProvider>
  );
}
