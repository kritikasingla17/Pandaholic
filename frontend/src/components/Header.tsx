import { NavLink } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function Header() {
  const { cartCount } = useStore();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink to="/" className="brand">
          <img src="/logo.png" alt="Pandaholic" className="brand__logo" />
        </NavLink>
        <nav className="main-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Catalog
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
            My Orders
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => (isActive ? 'active' : '')}>
            Inventory
          </NavLink>
          <NavLink to="/contact" className={({ isActive }) => (isActive ? 'active' : '')}>
            Contact
          </NavLink>
        </nav>
        <NavLink to="/cart" className="cart-link">
          🛍️ Cart
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </NavLink>
      </div>
    </header>
  );
}
