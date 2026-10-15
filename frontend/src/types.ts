export interface VariantOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  options: VariantOption[];
  price: number;
  compareAtPrice: number | null;
  available: number;
  image: string | null;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  image: string;
  images: string[];
  variants: ProductVariant[];
  optionNames: string[];
  minPrice: number;
  maxPrice: number;
  totalAvailable: number;
  personalizable: boolean;
  featured: boolean;
  status: string;
}

export interface Personalization {
  recipientName: string;
  message: string;
  instructions: string;
  photoDataUrl: string | null;
  photoName: string | null;
}

export interface CartItem {
  id: string;
  productHandle: string;
  productTitle: string;
  image: string;
  variantId: string;
  variantOptions: VariantOption[];
  unitPrice: number;
  quantity: number;
  personalization: Personalization;
}

export interface CheckoutCustomer {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderLine {
  productTitle: string;
  variantOptions: VariantOption[];
  unitPrice: number;
  quantity: number;
  recipientName: string;
  message: string;
  instructions: string;
}

// What a shopper sees about their own order on "My Orders".
export interface CustomerOrder {
  orderNumber: number;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  total: number;
  items: (OrderLine & { hasPhoto: boolean })[];
}
