import { Link } from 'react-router-dom';
import StatusPage from '../components/StatusPage';

export default function NotFoundPage() {
  return (
    <StatusPage
      title="Page not found"
      message={<p>We couldn't find that page. The link may be mistyped, or the page may have moved.</p>}
      actions={
        <Link to="/" className="btn btn--primary">
          Browse the catalog
        </Link>
      }
    />
  );
}
