import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import NotFoundPage from '../pages/NotFoundPage';
import Layout from './Layout';

// Anyone who isn't signed-in staff gets the store's normal 404 page, so the
// admin area looks exactly like a page that doesn't exist. Staff sign in at /admin/login.
export default function RequireStaff({ children }: { children: ReactNode }) {
  const { session, isStaff, loading } = useAuth();

  if (loading) {
    return <div className="state-message">Loading…</div>;
  }

  if (!session || !isStaff) {
    return (
      <Layout>
        <NotFoundPage />
      </Layout>
    );
  }

  return children;
}
