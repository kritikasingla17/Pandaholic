import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../types';
import { loadCatalog } from '../data/loadCatalog';

interface CatalogContextValue {
  products: Product[];
  categories: string[];
  loading: boolean;
  error: string | null;
  updateVariantAvailable: (variantId: string, available: number) => void;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const updateVariantAvailable = useCallback((variantId: string, available: number) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (!product.variants.some((v) => v.id === variantId)) return product;
        const variants = product.variants.map((v) => (v.id === variantId ? { ...v, available } : v));
        return { ...product, variants, totalAvailable: variants.reduce((sum, v) => sum + v.available, 0) };
      })
    );
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const value = useMemo(
    () => ({ products, categories, loading, error, updateVariantAvailable }),
    [products, categories, loading, error, updateVariantAvailable]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider');
  return ctx;
}
