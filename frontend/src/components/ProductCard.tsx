import type { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const { getAvailable } = useStore();
  const totalAvailable = product.variants.reduce(
    (sum, v) => sum + getAvailable(v.id, v.available),
    0
  );
  const outOfStock = totalAvailable <= 0;

  return (
    <button className="product-card" onClick={() => onSelect(product)} disabled={outOfStock}>
      <div className="product-card__image">
        {product.image ? (
          <img src={product.image} alt={product.title} loading="lazy" decoding="async" />
        ) : (
          <div className="product-card__placeholder">No image</div>
        )}
        {outOfStock && <span className="badge badge--out">Out of stock</span>}
        {!outOfStock && product.personalizable && (
          <span className="badge badge--personalized">✨ Personalize it</span>
        )}
      </div>
      <div className="product-card__body">
        <span className="product-card__category">{product.category}</span>
        <h3>{product.title}</h3>
        <p className="product-card__price">
          {product.minPrice === product.maxPrice
            ? formatCurrency(product.minPrice)
            : `${formatCurrency(product.minPrice)} – ${formatCurrency(product.maxPrice)}`}
        </p>
      </div>
    </button>
  );
}
