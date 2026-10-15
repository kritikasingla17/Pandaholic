import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import StatusPage from '../components/StatusPage';
import NotFoundPage from './NotFoundPage';

export default function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!notFound) console.error('Page error:', error);
  }, [error, notFound]);

  if (notFound) return <NotFoundPage />;

  return (
    <StatusPage
      title="Something went wrong"
      message={
        <>
          <p>This page ran into an unexpected problem. Reloading usually fixes it.</p>
          {import.meta.env.DEV && error instanceof Error && (
            <p>
              <code>{error.message}</code>
            </p>
          )}
        </>
      }
      actions={
        <>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <Link to="/" className="btn btn--secondary">
            Go to the homepage
          </Link>
        </>
      }
    />
  );
}
