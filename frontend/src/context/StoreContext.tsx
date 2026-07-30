import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, Order, Personalization, ProductVariant } from '../types';
import { useCatalog } from './CatalogContext';
import { supabase } from '../lib/supabaseClient';
import { readJson, writeJson } from '../utils/storage';

const CART_KEY = 'pandaholic_cart';
const ORDERS_KEY = 'pandaholic_orders';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  adjustStock: (variantId: string, delta: number) => Promise<boolean>;
  setStock: (variantId: string, qty: number) => Promise<boolean>;
  cart: CartItem[];
  addToCart: (input: AddToCartInput) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  orders: Order[];
  placeOrder: (customer: Order['customer']) => Promise<Order | null>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { products, updateVariantAvailable } = useCatalog();
  const [cart, setCart] = useState<CartItem[]>(() => readJson(CART_KEY, []));
  const [orders, setOrders] = useState<Order[]>(() => readJson(ORDERS_KEY, []));

  useEffect(() => writeJson(CART_KEY, cart), [cart]);
  useEffect(() => writeJson(ORDERS_KEY, orders), [orders]);

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

  async function setStock(variantId: string, qty: number): Promise<boolean> {
    const target = Math.max(0, qty);
    const { data, error } = await supabase.rpc('set_variant_stock', {
      p_variant_id: variantId,
      p_available: target,
    });
    if (error) {
      console.error('Failed to update stock:', error.message);
      return false;
    }
    updateVariantAvailable(variantId, typeof data === 'number' ? data : target);
    return true;
  }

  async function adjustStock(variantId: string, delta: number): Promise<boolean> {
    const current = variantByIdMap.get(variantId)?.available ?? 0;
    return setStock(variantId, current + delta);
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
        id: newId(),
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

  function clearCart() {
    setCart([]);
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function placeOrder(customer: Order['customer']): Promise<Order | null> {
    if (cart.length === 0) return null;

    // A variant can appear in multiple cart lines (different personalization),
    // so aggregate the total quantity requested per variant before checking
    // and decrementing stock.
    const requestedByVariant = new Map<string, number>();
    for (const item of cart) {
      requestedByVariant.set(item.variantId, (requestedByVariant.get(item.variantId) ?? 0) + item.quantity);
    }

    for (const [variantId, requested] of requestedByVariant) {
      const available = variantByIdMap.get(variantId)?.available ?? 0;
      if (requested > available) {
        return null;
      }
    }

    const decrements = await Promise.all(
      Array.from(requestedByVariant.entries()).map(([variantId, requested]) =>
        adjustStock(variantId, -requested)
      )
    );
    if (decrements.some((ok) => !ok)) {
      return null;
    }

    const order: Order = {
      id: newId(),
      createdAt: new Date().toISOString(),
      customer,
      items: cart,
      total: cartTotal,
      status: 'placed',
    };

    setOrders((prev) => [order, ...prev]);
    setCart([]);
    return order;
  }

  const value: StoreContextValue = {
    getAvailable,
    adjustStock,
    setStock,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartTotal,
    cartCount,
    orders,
    placeOrder,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
