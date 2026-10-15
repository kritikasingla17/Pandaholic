import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { fetchMyOrders, forgetLegacyOrders, hasLegacyOrders } from '../data/orders';
import { formatOrderNumber, ORDER_STATUS_LABELS } from '../constants/orders';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatCurrency } from '../utils/format';
import type { CustomerOrder } from '../types';

export default function OrdersPage() {
  const location = useLocation();
  const placedOrderNumber =
    (location.state as { placedOrderNumber?: number } | null)?.placedOrderNumber ?? null;
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLegacyNotice, setShowLegacyNotice] = useState(hasLegacyOrders);
  useDocumentTitle('My Orders');

  useEffect(() => {
    let active = true;
    fetchMyOrders()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'We couldn’t load your orders.');
      });
    return () => {
      active = false;
    };
  }, []);

  function dismissLegacyNotice() {
    forgetLegacyOrders();
    setShowLegacyNotice(false);
  }

  return (
    <div className="orders-page">
      <h1>My Orders</h1>

      {placedOrderNumber !== null && (
        <div className="banner banner--success">
          Thank you! Your order {formatOrderNumber(placedOrderNumber)} has been placed. We’ll contact you on your
          mobile number to confirm it.
        </div>
      )}

      {showLegacyNotice && (
        <div className="banner banner--warning">
          Orders placed on this device before our new checkout weren’t sent to us. If you’re still expecting one,
          please <Link to="/contact">contact us</Link> or order again.{' '}
          <button type="button" className="btn btn--link" onClick={dismissLegacyNotice}>
            Dismiss
          </button>
        </div>
      )}

      {error ? (
        <div className="state-message state-message--error">{error}</div>
      ) : orders === null ? (
        <div className="state-message">Loading your orders…</div>
      ) : orders.length === 0 ? (
        <div className="state-message">
          No orders on this device yet. <Link to="/">Browse the catalog</Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div
              className={
                order.orderNumber === placedOrderNumber ? 'order-card order-card--highlight' : 'order-card'
              }
              key={order.orderNumber}
            >
              <div className="order-card__header">
                <div>
                  <strong>Order {formatOrderNumber(order.orderNumber)}</strong>
                  <span className="order-card__date">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <span className={`status-pill status-pill--${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
              </div>
              <ul className="order-card__items">
                {order.items.map((item, index) => (
                  <li key={index}>
                    {item.quantity} × {item.productTitle}
                    {item.variantOptions.length > 0 && ` (${item.variantOptions.map((o) => o.value).join(', ')})`}
                    <span> — {formatCurrency(item.unitPrice * item.quantity)}</span>
                    {(item.recipientName || item.message || item.instructions || item.hasPhoto) && (
                      <span className="order-card__personalization">
                        {[
                          item.recipientName && `For: ${item.recipientName}`,
                          item.message && `Text: ${item.message}`,
                          item.instructions && `Instructions: ${item.instructions}`,
                          item.hasPhoto && 'Photo attached',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="order-card__footer">
                <span>
                  Deliver to: {order.customerName}, {order.addressLine}, {order.city}, {order.state} {order.pincode}
                </span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
