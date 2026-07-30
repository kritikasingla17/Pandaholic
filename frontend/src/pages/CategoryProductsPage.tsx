import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import type { Product } from '../types';

export default function CategoryProductsPage() {
  const { categoryName } = useParams<{ categoryName: string }>();
  const category = decodeURIComponent(categoryName ?? '');
  const { products, categories, loading, error } = useCatalog();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.category !== category) return false;
      if (!query) return true;
      return p.title.toLowerCase().includes(query) || p.tags.some((t) => t.toLowerCase().includes(query));
    });
  }, [products, category, search]);

  if (loading) {
    return <div className="state-message">Loading catalog…</div>;
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

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
