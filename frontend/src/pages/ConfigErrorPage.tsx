import StatusPage from '../components/StatusPage';

export default function ConfigErrorPage({ missing }: { missing: string[] }) {
  return (
    <StatusPage
      standalone
      title="The store isn't set up yet"
      message={
        <>
          <p>Pandaholic can't connect to its database because these settings are missing:</p>
          <p className="status-page__codes">
            {missing.map((name) => (
              <code key={name}>{name}</code>
            ))}
          </p>
          <p>
            Add them to <code>frontend/.env.local</code> for local development, or to the hosting
            provider's environment variables, then rebuild the site.
          </p>
        </>
      }
    />
  );
}
