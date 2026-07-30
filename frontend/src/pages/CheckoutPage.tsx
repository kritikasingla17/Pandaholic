import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

export default function CheckoutPage() {
  const { cart, cartTotal, placeOrder } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (cart.length === 0) {
    return (
      <div className="state-message">
        Your cart is empty. <Link to="/">Browse the catalog</Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Please fill in your name, phone and delivery address.');
      return;
    }
    placeOrder({ name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() }).then(
      (order) => {
        if (!order) {
          setError('Sorry, one or more items in your cart just went out of stock. Please review your cart.');
          return;
        }
        navigate('/orders', { state: { justPlacedOrderId: order.id } });
      }
    );
  }

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      <form className="checkout-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </label>
        <label className="field">
          <span>Phone number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} />
        </label>
        <label className="field">
          <span>Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} />
        </label>
        <label className="field">
          <span>Delivery address</span>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={3} maxLength={300} />
        </label>

        {error && <p className="field-error">{error}</p>}

        <div className="cart-summary">
          <span>Order total</span>
          <strong>{formatCurrency(cartTotal)}</strong>
        </div>

        <button type="submit" className="btn btn--primary btn--block">
          Place Order
        </button>
      </form>
    </div>
  );
}
