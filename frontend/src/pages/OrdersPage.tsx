import { useLocation, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

export default function OrdersPage() {
  const { orders } = useStore();
  const location = useLocation();
  const justPlacedOrderId = (location.state as { justPlacedOrderId?: string } | null)?.justPlacedOrderId;

  if (orders.length === 0) {
    return (
      <div className="state-message">
        No orders yet. <Link to="/">Browse the catalog</Link>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1>My Orders</h1>
      {justPlacedOrderId && (
        <div className="banner banner--success">
          🎉 Order placed successfully! We'll get started on your custom pieces right away.
        </div>
      )}
      <div className="orders-list">
        {orders.map((order) => (
          <div className={order.id === justPlacedOrderId ? 'order-card order-card--highlight' : 'order-card'} key={order.id}>
            <div className="order-card__header">
              <div>
                <strong>Order #{order.id.slice(0, 8)}</strong>
                <span className="order-card__date">{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <span className={`status-pill status-pill--${order.status}`}>{order.status}</span>
            </div>
            <ul className="order-card__items">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.quantity} × {item.productTitle}
                  {item.variantOptions.length > 0 &&
                    ` (${item.variantOptions.map((o) => o.value).join(', ')})`}
                  <span> — {formatCurrency(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="order-card__footer">
              <span>Deliver to: {order.customer.name}, {order.customer.address}</span>
              <strong>{formatCurrency(order.total)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
