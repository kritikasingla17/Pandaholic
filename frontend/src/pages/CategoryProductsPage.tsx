import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { Product } from '../types';

export default function CategoryProductsPage() {
  const { categoryName } = useParams<{ categoryName: string }>();
  // React Router already decodes params; decoding again breaks names containing "%".
  const category = categoryName ?? '';
  const { products, categories, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(category || undefined);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.category !== category) return false;
      if (!query) return true;
      return p.title.toLowerCase().includes(query) || p.tags.some((t) => t.toLowerCase().includes(query));
    });
  }, [products, category, search]);

  // A link like /category/Poster?product=god-shiva-poster opens that product's modal.
  const linkedHandle = searchParams.get('product');
  const linkedProduct = useMemo(
    () =>
      linkedHandle
        ? products.find((p) => p.handle === linkedHandle && p.category === category) ?? null
        : null,
    [products, category, linkedHandle],
  );
  const openProduct = selectedProduct ?? linkedProduct;

  const closeProduct = () => {
    setSelectedProduct(null);
    if (linkedHandle) {
      const next = new URLSearchParams(searchParams);
      next.delete('product');
      setSearchParams(next, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="catalog-page">
        <div className="product-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <div className="skeleton-card__image skeleton-card__image--square" />
              <div className="skeleton-card__body">
                <div className="skeleton-line skeleton-line--short" />
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="state-message state-message--error">Couldn't load catalog: {error}</div>;
  }

  if (!categories.includes(category)) {
    return (
      <div className="state-message">
        Category not found. <Link to="/">Back to all categories</Link>
      </div>
    );
  }

  return (
    <div className="catalog-page">
      <div className="catalog-hero">
        <Link to="/" className="back-link">
          ← All categories
        </Link>
        <h1>{category}</h1>
        <input
          className="search-input"
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="state-message">No products found.</div>
      ) : (
        <div className="product-grid">
          {filtered.map((product) => (
            <ProductCard key={product.handle} product={product} onSelect={setSelectedProduct} />
          ))}
        </div>
      )}

      {openProduct && <ProductModal product={openProduct} onClose={closeProduct} />}
    </div>
  );
}