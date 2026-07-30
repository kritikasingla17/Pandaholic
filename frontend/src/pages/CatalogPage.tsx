import { useMemo, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import CategoryNav from '../components/CategoryNav';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import type { Product } from '../types';

export default function CatalogPage() {
  const { products, categories, loading, error } = useCatalog();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        p.title.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  if (loading) {
    return <div className="state-message">Loading catalog…</div>;
  }

  if (error) {
    return <div className="state-message state-message--error">Couldn't load catalog: {error}</div>;
  }

  return (
    <div className="catalog-page">
      <div className="catalog-hero">
        <h1>Handmade, made just for you</h1>
        <p>Journals, photo books, wedding cards, Spotify plaques, fridge magnets, LED boxes & more — every piece customisable.</p>
        <input
          className="search-input"
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <CategoryNav categories={categories} active={activeCategory} onSelect={setActiveCategory} />

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
