import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

// Renders the matched storefront route, or `children` when used directly (e.g. by RequireStaff).
export default function Layout({ children }: { children?: ReactNode }) {
  return (
    <>
      <Header />
      <main className="app-main">{children ?? <Outlet />}</main>
      <Footer />
    </>
  );
}
