import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <img src="/logo.png" alt="Pandaholic" className="site-footer__logo" />
          <p>Handmade, personalized gifts — made just for you, delivered with care.</p>
        </div>
        <div className="site-footer__links">
          <Link to="/">Catalog</Link>
          <Link to="/orders">My Orders</Link>
          <Link to="/contact">Contact</Link>
          <a href="https://www.instagram.com/pandaholicdiy" target="_blank" rel="noreferrer">
            Instagram
          </a>
        </div>
      </div>
      <p className="site-footer__copy">© {new Date().getFullYear()} Pandaholic. Made with 💗 for handmade lovers.</p>
    </footer>
  );
}
