// Lightweight offline persistence using Capacitor Preferences (web fallback: localStorage).
// Used to cache the last-seen product list so the POS / inventory screens can render
// something useful even when the network is unavailable.

import { Preferences } from '@capacitor/preferences';
import type { Product } from './supabase';

const PRODUCTS_KEY = 'shatir_products_cache';
const PENDING_KEY = 'shatir_pending_ops';

export type PendingOp = {
  id: string;
  kind: 'purchase' | 'sale';
  payload: {
    type: 'PURCHASE' | 'SALE';
    total_amount: number;
    tax_amount: number;
    items: { product_id: string; quantity: number; unit_price: number; subtotal: number }[];
  };
  createdAt: string;
};

export async function cacheProducts(products: Product[]): Promise<void> {
  try {
    await Preferences.set({ key: PRODUCTS_KEY, value: JSON.stringify(products) });
  } catch {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  }
}

export async function loadCachedProducts(): Promise<Product[]> {
  try {
    const { value } = await Preferences.get({ key: PRODUCTS_KEY });
    return value ? (JSON.parse(value) as Product[]) : [];
  } catch {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  }
}

export async function getPendingOps(): Promise<PendingOp[]> {
  try {
    const { value } = await Preferences.get({ key: PENDING_KEY });
    return value ? (JSON.parse(value) as PendingOp[]) : [];
  } catch {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  }
}

export async function addPendingOp(op: PendingOp): Promise<void> {
  const ops = await getPendingOps();
  ops.push(op);
  try {
    await Preferences.set({ key: PENDING_KEY, value: JSON.stringify(ops) });
  } catch {
    localStorage.setItem(PENDING_KEY, JSON.stringify(ops));
  }
}

export async function removePendingOp(id: string): Promise<void> {
  const ops = (await getPendingOps()).filter((o) => o.id !== id);
  try {
    await Preferences.set({ key: PENDING_KEY, value: JSON.stringify(ops) });
  } catch {
    localStorage.setItem(PENDING_KEY, JSON.stringify(ops));
  }
}
