import type { OrderStatus } from '../types';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Received',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function formatOrderNumber(orderNumber: number): string {
  return `PH-${orderNumber}`;
}
