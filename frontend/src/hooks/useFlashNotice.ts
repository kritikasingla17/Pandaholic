import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function noticeFromState(state: unknown): string | null {
  return (state as { notice?: string } | null)?.notice ?? null;
}

// Reads a one-off `notice` passed through navigation state (e.g. "Product deleted"),
// then clears it from history so reloading the page doesn't show it again.
export function useFlashNotice(): [string | null, (notice: string | null) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(() => noticeFromState(location.state));
  const hasStateNotice = noticeFromState(location.state) !== null;

  useEffect(() => {
    if (hasStateNotice) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }
  }, [hasStateNotice, location.pathname, location.search, navigate]);

  return [notice, setNotice];
}
