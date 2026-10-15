import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export default function Header() {
  const { cartCount } = useStore();
  const { isStaff } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <NavLink to="/" className="brand" onClick={closeMenu}>
          <img src="/logo.png" alt="Pandaholic" className="brand__logo" />
        </NavLink>
        <button
          className={`hamburger${menuOpen ? ' hamburger--open' : ''}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`main-nav${menuOpen ? ' main-nav--open' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMenu}>
            Catalog
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMenu}>
            My Orders
          </NavLink>
          <NavLink to="/contact" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMenu}>
            Contact
          </NavLink>
          {isStaff && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeMenu}>
              Admin
            </NavLink>
          )}
        </nav>
        <NavLink to="/cart" className="cart-link" onClick={closeMenu}>
          🛍️ Cart
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </NavLink>
      </div>
    </header>
  );
}
