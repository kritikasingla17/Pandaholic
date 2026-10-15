import type { ReactNode } from 'react';

interface StatusPageProps {
  title: string;
  message: ReactNode;
  actions?: ReactNode;
  // For screens shown outside the normal header/footer layout (no router available).
  standalone?: boolean;
}

export default function StatusPage({ title, message, actions, standalone = false }: StatusPageProps) {
  const card = (
    <section className="status-page">
      <h1 className="status-page__title">{title}</h1>
      <div className="status-page__message">{message}</div>
      {actions && <div className="status-page__actions">{actions}</div>}
    </section>
  );

  if (!standalone) return card;

  return (
    <main className="app-main">
      <img src="/logo.png" alt="Pandaholic" className="status-page__logo" />
      {card}
    </main>
  );
}
