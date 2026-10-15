import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useStore } from '../context/StoreContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatCurrency } from '../utils/format';

export default function CartPage() {
  const { cart, updateCartQuantity, removeFromCart, cartTotal, findVariant } = useStore();
  const { loading: catalogLoading } = useCatalog();
  useDocumentTitle('Cart');

  if (cart.length === 0) {
    return (
      <div className="state-message">
        Your cart is empty. <Link to="/">Browse the catalog</Link>
      </div>
    );
  }

  // Stock is shared by every cart line of the same variant (e.g. different personalization).
  const lines = cart.map((item) => {
    const variant = findVariant(item.variantId);
    const inOtherLines = cart
      .filter((other) => other.variantId === item.variantId && other.id !== item.id)
      .reduce((sum, other) => sum + other.quantity, 0);
    const maxQuantity = Math.max(0, (variant?.available ?? 0) - inOtherLines);

    let problem: string | null = null;
    if (!catalogLoading) {
      if (!variant) problem = 'This item is no longer available. Please remove it.';
      else if (maxQuantity === 0) problem = 'Sold out. Please remove it.';
      else if (item.quantity > maxQuantity) problem = `Only ${maxQuantity} available. Please lower the quantity.`;
    }

    return { item, price: variant?.price ?? item.unitPrice, maxQuantity, problem };
  });
  const hasProblems = lines.some((line) => line.problem !== null);

  return (
    <div className="cart-page">
      <h1>Your Cart</h1>
      <div className="cart-list">
        {lines.map(({ item, price, maxQuantity, problem }) => (
          <div className="cart-item" key={item.id}>
            {item.image ? (
              <img src={item.image} alt={item.productTitle} loading="lazy" decoding="async" />
            ) : (
              <div className="cart-item__image-placeholder">No image</div>
            )}
            <div className="cart-item__info">
              <h3>{item.productTitle}</h3>
              {item.variantOptions.length > 0 && (
                <p className="cart-item__options">
                  {item.variantOptions.map((o) => `${o.name}: ${o.value}`).join(', ')}
                </p>
              )}
              {item.personalization.recipientName && (
                <p className="cart-item__personalize">For: {item.personalization.recipientName}</p>
              )}
              {item.personalization.message && (
                <p className="cart-item__personalize">Text: {item.personalization.message}</p>
              )}
              {item.personalization.instructions && (
                <p className="cart-item__personalize">Instructions: {item.personalization.instructions}</p>
              )}
              {item.personalization.photoDataUrl && (
                <img className="cart-item__thumb" src={item.personalization.photoDataUrl} alt="Your reference photo" />
              )}
              <p className="cart-item__price">{formatCurrency(price)} each</p>
              {problem && <p className="field-error cart-item__problem">{problem}</p>}
            </div>
            <div className="cart-item__actions">
              <div className="qty-stepper">
                <button
                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{item.quantity}</span>
                <button
                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                  disabled={item.quantity >= maxQuantity}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <p className="cart-item__subtotal">{formatCurrency(price * item.quantity)}</p>
              <button className="btn btn--link" onClick={() => removeFromCart(item.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="cart-summary">
        <span>Total</span>
        <strong>{formatCurrency(cartTotal)}</strong>
      </div>
      {hasProblems ? (
        <button type="button" className="btn btn--primary btn--block" disabled>
          Fix the items above to check out
        </button>
      ) : (
        <Link to="/checkout" className="btn btn--primary btn--block">
          Proceed to Checkout
        </Link>
      )}
    </div>
  );
}
