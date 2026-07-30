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

export interface Order {
  id: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  items: CartItem[];
  total: number;
  status: 'placed' | 'processing' | 'completed';
}
