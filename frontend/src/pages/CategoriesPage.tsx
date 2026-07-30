import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';

export default function CategoriesPage() {
  const { products, categories, loading, error } = useCatalog();
  const navigate = useNavigate();

  const tiles = useMemo(() => {
    return categories.map((category) => {
      const categoryProducts = products.filter((p) => p.category === category);
      return {
        category,
        count: categoryProducts.length,
        image: categoryProducts.find((p) => p.image)?.image ?? '',
      };
    });
  }, [categories, products]);

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
        <p>Browse by category — every piece customisable, made just for you.</p>
      </div>

      {tiles.length === 0 ? (
        <div className="state-message">No categories found.</div>
      ) : (
        <div className="category-grid">
          {tiles.map((tile) => (
            <button
              key={tile.category}
              className="category-tile"
              onClick={() => navigate(`/category/${encodeURIComponent(tile.category)}`)}
            >
              <div className="category-tile__image">
                {tile.image ? (
                  <img src={tile.image} alt={tile.category} />
                ) : (
                  <div className="product-card__placeholder">No image</div>
                )}
              </div>
              <div className="category-tile__body">
                <h3>{tile.category}</h3>
                <p className="category-tile__count">
                  {tile.count} {tile.count === 1 ? 'product' : 'products'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
