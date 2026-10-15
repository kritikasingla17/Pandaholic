import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, CheckoutCustomer, Personalization, ProductVariant } from '../types';
import { useCatalog } from './CatalogContext';
import { rememberOrder, submitOrder, type PlacedOrder } from '../data/orders';
import { readJson, writeJson } from '../utils/storage';
import { uuidV4 } from '../utils/id';

const CART_KEY = 'pandaholic_cart';

// Validate cart items loaded from localStorage so corrupt data doesn't crash the app.
function isValidCartItem(item: unknown): item is CartItem {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.productHandle === 'string' &&
    typeof obj.productTitle === 'string' &&
    typeof obj.variantId === 'string' &&
    typeof obj.unitPrice === 'number' &&
    typeof obj.quantity === 'number' &&
    obj.quantity > 0 &&
    Array.isArray(obj.variantOptions) &&
    obj.personalization !== null &&
    typeof obj.personalization === 'object'
  );
}

function loadCart(): CartItem[] {
  const raw = readJson<unknown>(CART_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidCartItem);
}

interface AddToCartInput {
  productHandle: string;
  productTitle: string;
  image: string;
  variant: ProductVariant;
  quantity: number;
  personalization: Personalization;
}

interface StoreContextValue {
  getAvailable: (variantId: string, baseAvailable: number) => number;
  // The variant as currently in the catalog (live price and stock), if it's still for sale.
  findVariant: (variantId: string) => ProductVariant | undefined;
  cart: CartItem[];
  addToCart: (input: AddToCartInput) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  cartTotal: number;
  cartCount: number;
  placeOrder: (checkoutId: string, customer: CheckoutCustomer) => Promise<PlacedOrder>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { products, refresh: refreshCatalog } = useCatalog();
  const [cart, setCart] = useState<CartItem[]>(loadCart);

  useEffect(() => writeJson(CART_KEY, cart), [cart]);

  const variantByIdMap = useMemo(() => {
    const map = new Map<string, ProductVariant>();
    products.forEach((p) => p.variants.forEach((v) => map.set(v.id, v)));
    return map;
  }, [products]);

  // Inventory now lives in Supabase (product_variants.available). Reads come
  // straight from the catalog data loaded from the DB, so this just returns
  // whatever the caller already has - kept for a stable component API.
  function getAvailable(_variantId: string, baseAvailable: number): number {
    return baseAvailable;
  }

  function findVariant(variantId: string): ProductVariant | undefined {
    return variantByIdMap.get(variantId);
  }

  function addToCart(input: AddToCartInput) {
    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.variantId === input.variant.id &&
          JSON.stringify(item.personalization) === JSON.stringify(input.personalization)
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + input.quantity } : item
        );
      }
      const newItem: CartItem = {
        id: uuidV4(),
        productHandle: input.productHandle,
        productTitle: input.productTitle,
        image: input.image,
        variantId: input.variant.id,
        variantOptions: input.variant.options,
        unitPrice: input.variant.price,
        quantity: input.quantity,
        personalization: input.personalization,
      };
      return [...prev, newItem];
    });
  }

  function removeFromCart(cartItemId: string) {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  }

  function updateCartQuantity(cartItemId: string, quantity: number) {
    setCart((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, quantity: Math.max(1, quantity) } : item))
    );
  }

  // Prices come from the live catalog (the order is charged at those prices), falling back to the price when added.
  const cartTotal = cart.reduce(
    (sum, item) => sum + (variantByIdMap.get(item.variantId)?.price ?? item.unitPrice) * item.quantity,
    0
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function placeOrder(checkoutId: string, customer: CheckoutCustomer): Promise<PlacedOrder> {
    if (cart.length === 0) throw new Error('Your cart is empty.');
    const order = await submitOrder(checkoutId, customer, cart);
    // Free the cart's storage (it can hold photos) before saving the order link, so a full quota can't drop it.
    writeJson(CART_KEY, []);
    setCart([]);
    rememberOrder(order);
    void refreshCatalog();
    return order;
  }

  const value: StoreContextValue = {
    getAvailable,
    findVariant,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    cartTotal,
    cartCount,
    placeOrder,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
