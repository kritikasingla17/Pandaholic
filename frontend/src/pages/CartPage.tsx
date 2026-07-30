import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

export default function CartPage() {
  const { cart, updateCartQuantity, removeFromCart, cartTotal } = useStore();

  if (cart.length === 0) {
    return (
      <div className="state-message">
        Your cart is empty. <Link to="/">Browse the catalog</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Your Cart</h1>
      <div className="cart-list">
        {cart.map((item) => (
          <div className="cart-item" key={item.id}>
            <img src={item.image} alt={item.productTitle} />
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
              {item.personalization.photoDataUrl && (
                <img className="cart-item__thumb" src={item.personalization.photoDataUrl} alt="reference" />
              )}
              <p className="cart-item__price">{formatCurrency(item.unitPrice)} each</p>
            </div>
            <div className="cart-item__actions">
              <div className="qty-stepper">
                <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                  −
                </button>
                <span>{item.quantity}</span>
                <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
              <p className="cart-item__subtotal">{formatCurrency(item.unitPrice * item.quantity)}</p>
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
      <Link to="/checkout" className="btn btn--primary btn--block">
        Proceed to Checkout
      </Link>
    </div>
  );
}
