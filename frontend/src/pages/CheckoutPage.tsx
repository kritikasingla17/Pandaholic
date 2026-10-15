import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatCurrency } from '../utils/format';
import { uuidV4 } from '../utils/id';
import type { CheckoutCustomer } from '../types';

const EMPTY_CUSTOMER: CheckoutCustomer = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
};

// Same rules as place_order() in the database, so most mistakes are caught before submitting.
function validateCustomer(customer: CheckoutCustomer): string | null {
  if (!customer.name.trim()) return 'Please enter your full name.';
  const digits = customer.phone.replace(/[^0-9]/g, '');
  const mobile =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  if (!/^[6-9][0-9]{9}$/.test(mobile)) return 'Please enter a valid 10-digit mobile number.';
  const email = customer.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Please enter a valid email address, or leave it empty.';
  if (!customer.address.trim()) return 'Please enter your delivery address.';
  if (!customer.city.trim()) return 'Please enter your city.';
  if (!customer.state.trim()) return 'Please enter your state.';
  if (!/^[1-9][0-9]{5}$/.test(customer.pincode.trim())) return 'Please enter a valid 6-digit PIN code.';
  return null;
}

export default function CheckoutPage() {
  const { cart, cartTotal, placeOrder, findVariant } = useStore();
  const navigate = useNavigate();
  // One id per checkout: retries reuse it, so a double click or flaky network can't place the order twice.
  const [checkoutId] = useState(uuidV4);
  const [customer, setCustomer] = useState<CheckoutCustomer>(EMPTY_CUSTOMER);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  useDocumentTitle('Checkout');

  if (cart.length === 0) {
    return placing ? (
      <div className="state-message">Placing your order…</div>
    ) : (
      <div className="state-message">
        Your cart is empty. <Link to="/">Browse the catalog</Link>
      </div>
    );
  }

  function updateField(field: keyof CheckoutCustomer, value: string) {
    setCustomer((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (placing) return;

    const problem = validateCustomer(customer);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setPlacing(true);
    try {
      const order = await placeOrder(checkoutId, {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email.trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
        state: customer.state.trim(),
        pincode: customer.pincode.trim(),
      });
      navigate('/orders', { replace: true, state: { placedOrderNumber: order.orderNumber } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPlacing(false);
    }
  }

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      <form className="checkout-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Full name</span>
          <input
            value={customer.name}
            onChange={(e) => updateField('name', e.target.value)}
            autoComplete="name"
            required
            maxLength={100}
          />
        </label>
        <label className="field">
          <span>Mobile number</span>
          <input
            type="tel"
            inputMode="tel"
            value={customer.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            autoComplete="tel"
            placeholder="10-digit mobile number"
            required
            maxLength={20}
          />
        </label>
        <label className="field">
          <span>Email (optional)</span>
          <input
            type="email"
            value={customer.email}
            onChange={(e) => updateField('email', e.target.value)}
            autoComplete="email"
            maxLength={150}
          />
        </label>
        <label className="field">
          <span>Delivery address</span>
          <textarea
            value={customer.address}
            onChange={(e) => updateField('address', e.target.value)}
            autoComplete="street-address"
            placeholder="House / flat, street, area, landmark"
            required
            rows={3}
            maxLength={300}
          />
        </label>
        <div className="checkout-form__row">
          <label className="field">
            <span>City</span>
            <input
              value={customer.city}
              onChange={(e) => updateField('city', e.target.value)}
              autoComplete="address-level2"
              required
              maxLength={60}
            />
          </label>
          <label className="field">
            <span>State</span>
            <input
              value={customer.state}
              onChange={(e) => updateField('state', e.target.value)}
              autoComplete="address-level1"
              required
              maxLength={60}
            />
          </label>
          <label className="field">
            <span>PIN code</span>
            <input
              inputMode="numeric"
              value={customer.pincode}
              onChange={(e) => updateField('pincode', e.target.value)}
              autoComplete="postal-code"
              required
              maxLength={6}
            />
          </label>
        </div>

        <div className="checkout-items">
          <h2 className="checkout-items__title">Order summary</h2>
          {cart.map((item) => (
            <div className="checkout-items__row" key={item.id}>
              <span>
                {item.productTitle}
                {item.variantOptions.length > 0 && (
                  <span className="checkout-items__option">
                    {' '}
                    ({item.variantOptions.map((o) => o.value).join(', ')})
                  </span>
                )}
                {' '}× {item.quantity}
              </span>
              <span>{formatCurrency((findVariant(item.variantId)?.price ?? item.unitPrice) * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <span>Order total</span>
          <strong>{formatCurrency(cartTotal)}</strong>
        </div>

        <p className="checkout-note">
          There’s no online payment on this website. After you place your order, we’ll contact you on your
          mobile number to confirm it, the payment and the delivery.
        </p>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary btn--block" disabled={placing}>
          {placing ? 'Placing your order…' : 'Place order'}
        </button>
      </form>
    </div>
  );
}
