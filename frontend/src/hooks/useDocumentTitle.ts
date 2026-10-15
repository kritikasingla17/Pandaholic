import { useEffect } from 'react';

const BASE_TITLE = 'Pandaholic';
const DEFAULT_SUFFIX = 'Handmade, Personalized Gifts';

/**
 * Sets `document.title` for the current page. Restores the default on unmount
 * so navigating away always resets the tab title.
 */
export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — ${DEFAULT_SUFFIX}`;
  }, [title]);
}
