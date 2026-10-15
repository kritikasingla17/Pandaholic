import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../types';
import { loadCatalog } from '../data/loadCatalog';

interface CatalogContextValue {
  products: Product[];
  categories: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// The main storefront categories always lead the list, in this order; other
// categories follow alphabetically, with the catch-all "Other" last.
const FEATURED_CATEGORY_ORDER = ["Valentine's Special", 'DIY', '2026 Calendars', 'Polaroids'];
const LAST_CATEGORY = 'Other';

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await loadCatalog();
      setProducts(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load catalog');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    const featured = FEATURED_CATEGORY_ORDER.filter((c) => set.has(c));
    const rest = Array.from(set)
      .filter((c) => !FEATURED_CATEGORY_ORDER.includes(c))
      .sort((a, b) => Number(a === LAST_CATEGORY) - Number(b === LAST_CATEGORY) || a.localeCompare(b));
    return [...featured, ...rest];
  }, [products]);

  const value = useMemo(
    () => ({ products, categories, loading, error, refresh }),
    [products, categories, loading, error, refresh]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
