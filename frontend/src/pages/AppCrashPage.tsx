import StatusPage from '../components/StatusPage';

export default function AppCrashPage() {
  return (
    <StatusPage
      standalone
      title="Something went wrong"
      message={<p>Pandaholic couldn't load properly. Reloading the page usually fixes it.</p>}
      actions={
        <>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a href="/" className="btn btn--secondary">
            Go to the homepage
          </a>
        </>
      }
    />
  );
}
