import { supabase } from '../lib/supabaseClient';
import { jpegBlobFromDataUrl } from '../lib/photos';
import { readJson, removeKey, writeJson } from '../utils/storage';
import type { CartItem, CheckoutCustomer, CustomerOrder, OrderStatus, VariantOption } from '../types';

const ORDER_PHOTOS_BUCKET = 'order-uploads';
// Only order numbers and private links are kept in the browser, never customer details.
const MY_ORDERS_KEY = 'pandaholic_my_orders';
// Orders the old checkout kept only in this browser; they never reached the shop.
const LEGACY_ORDERS_KEY = 'pandaholic_orders';
const MAX_SAVED_ORDERS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlacedOrder {
  orderNumber: number;
  accessToken: string;
  total: number;
}

interface SavedOrderRef {
  accessToken: string;
  orderNumber: number;
}

interface OrderItemRow {
  product_title: string;
  variant_options: VariantOption[] | null;
  unit_price: number | string;
  quantity: number;
  recipient_name: string;
  message: string;
  instructions: string;
  has_photo: boolean;
}

interface OrderRow {
  order_number: number | string;
  status: OrderStatus;
  created_at: string;
  customer_name: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  total: number | string;
  items: OrderItemRow[] | null;
}

function savedOrders(): SavedOrderRef[] {
  const saved = readJson<unknown>(MY_ORDERS_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (entry): entry is SavedOrderRef =>
      typeof (entry as SavedOrderRef | null)?.accessToken === 'string' &&
      UUID_PATTERN.test((entry as SavedOrderRef).accessToken)
  );
}

export function rememberOrder(order: PlacedOrder) {
  const others = savedOrders().filter((saved) => saved.accessToken !== order.accessToken);
  writeJson(
    MY_ORDERS_KEY,
    [{ accessToken: order.accessToken, orderNumber: order.orderNumber }, ...others].slice(0, MAX_SAVED_ORDERS)
  );
}

async function uploadPersonalizationPhoto(checkoutId: string, item: CartItem): Promise<string | null> {
  const dataUrl = item.personalization.photoDataUrl;
  if (!dataUrl) return null;

  const fileName = item.id.toLowerCase().replace(/[^0-9a-z-]/g, '').slice(0, 64) || 'photo';
  const path = `checkout/${checkoutId}/${fileName}.jpg`;
  const photo = await jpegBlobFromDataUrl(dataUrl);
  const { error } = await supabase.storage
    .from(ORDER_PHOTOS_BUCKET)
    .upload(path, photo, { contentType: 'image/jpeg', upsert: false });

  // A retried checkout uploads the same file to the same path again, which is fine.
  if (error && !/exists|duplicate/i.test(error.message)) {
    console.error('Photo upload failed:', error.message);
    throw new Error(`We couldn’t upload the photo for “${item.productTitle}”. Please try again.`);
  }
  return path;
}

// checkoutId must stay the same across retries of one checkout, so a retry
// returns the order already placed instead of creating a second one.
export async function submitOrder(
  checkoutId: string,
  customer: CheckoutCustomer,
  cart: CartItem[]
): Promise<PlacedOrder> {
  const items = [];
  for (const item of cart) {
    items.push({
      variant_id: item.variantId,
      quantity: item.quantity,
      recipient_name: item.personalization.recipientName,
      message: item.personalization.message,
      instructions: item.personalization.instructions,
      photo_path: await uploadPersonalizationPhoto(checkoutId, item),
    });
  }

  const { data, error } = await supabase.rpc('place_order', {
    p_idempotency_key: checkoutId,
    p_customer: customer,
    p_items: items,
  });

  if (error) {
    // place_order's own errors (stock, validation) carry a hint and are written for shoppers.
    if (error.hint) throw new Error(error.message);
    console.error('place_order failed:', error);
    throw new Error(
      /fetch|network/i.test(error.message)
        ? 'We couldn’t reach the store. Please check your connection and try again.'
        : 'Something went wrong while placing your order. Please try again, or contact us if it keeps happening.'
    );
  }

  const result = data as { order_number: number | string; access_token: string; total: number | string };
  return {
    orderNumber: Number(result.order_number),
    accessToken: result.access_token,
    total: Number(result.total),
  };
}

export async function fetchMyOrders(): Promise<CustomerOrder[]> {
  const tokens = savedOrders().map((saved) => saved.accessToken);
  if (tokens.length === 0) return [];

  const { data, error } = await supabase.rpc('get_my_orders', { p_access_tokens: tokens });
  if (error) {
    console.error('get_my_orders failed:', error);
    throw new Error('We couldn’t load your orders. Please check your connection and try again.');
  }

  return ((data ?? []) as OrderRow[]).map((row) => ({
    orderNumber: Number(row.order_number),
    status: row.status,
    createdAt: row.created_at,
    customerName: row.customer_name,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    total: Number(row.total),
    items: (row.items ?? []).map((item) => ({
      productTitle: item.product_title,
      variantOptions: item.variant_options ?? [],
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      recipientName: item.recipient_name,
      message: item.message,
      instructions: item.instructions,
      hasPhoto: item.has_photo,
    })),
  }));
}

export function hasLegacyOrders(): boolean {
  const legacy = readJson<unknown>(LEGACY_ORDERS_KEY, []);
  return Array.isArray(legacy) && legacy.length > 0;
}

export function forgetLegacyOrders(): void {
  removeKey(LEGACY_ORDERS_KEY);
}
