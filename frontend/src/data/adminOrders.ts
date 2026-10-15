import { supabase } from '../lib/supabaseClient';
import { fetchAllPages } from '../lib/fetchAllPages';
import type { CheckoutCustomer, OrderLine, OrderStatus, VariantOption } from '../types';

// Staff-only order access. Row-level security only returns orders to signed-in
// staff, and status changes go through admin_update_order_status().
const ORDER_PHOTOS_BUCKET = 'order-uploads';
const PHOTO_LINK_SECONDS = 60 * 60;

export interface AdminOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  customer: CheckoutCustomer;
  total: number;
  items: (OrderLine & { photoPath: string | null })[];
}

interface AdminOrderItemRow {
  product_title: string;
  variant_options: VariantOption[] | null;
  unit_price: number | string;
  quantity: number;
  recipient_name: string;
  message: string;
  instructions: string;
  photo_path: string | null;
  position: number;
}

interface AdminOrderRow {
  id: string;
  order_number: number | string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  total: number | string;
  order_items: AdminOrderItemRow[] | null;
}

function toAdminOrder(row: AdminOrderRow): AdminOrder {
  return {
    id: row.id,
    orderNumber: Number(row.order_number),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
      address: row.address_line,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
    },
    total: Number(row.total),
    items: (row.order_items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        productTitle: item.product_title,
        variantOptions: item.variant_options ?? [],
        unitPrice: Number(item.unit_price),
        quantity: item.quantity,
        recipientName: item.recipient_name,
        message: item.message,
        instructions: item.instructions,
        photoPath: item.photo_path,
      })),
  };
}

export async function fetchOrdersForAdmin(): Promise<AdminOrder[]> {
  try {
    const rows = await fetchAllPages<AdminOrderRow>((from, to) =>
      supabase
        .from('orders')
        .select('*, order_items(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
    );
    return rows.map(toAdminOrder);
  } catch (err: unknown) {
    throw new Error(`Failed to load orders: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_update_order_status', { p_order_id: orderId, p_status: status });
  if (error) throw new Error(error.message);
}

// Personalization photos are private; staff view them through short-lived links.
export async function getOrderPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(path, PHOTO_LINK_SECONDS);
  if (error || !data) {
    console.warn('Could not create a link for the order photo:', error?.message);
    return null;
  }
  return data.signedUrl;
}
