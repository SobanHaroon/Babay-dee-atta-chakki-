/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  priceRange?: string; // e.g. "2900 - 3800" for Badam Giri
  unit: string;
  desc: string;
  img: string;
  productImage?: string;
  category: string;
  featured?: boolean;
  popular?: boolean;
  badge?: string;
  specs?: Record<string, string>;
  outOfStock?: boolean;
  nutrition?: {
    calories: string;
    protein: string;
    fiber: string;
  };
}

export interface Category {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "flour", name: "Atta & Flour", desc: "Pure stone-ground whole wheat, grain, and corn flours from our local Chakki", icon: "Wheat" },
  { id: "rice", name: "Premium Rice", desc: "Aromatic Basmati Kainat and Kernel rice aged to perfection", icon: "Salad" },
  { id: "lentils", name: "Daal & Lentils", desc: "Protein-rich, triple machine-cleaned local pulses and legumes", icon: "Disc" },
  { id: "dry_fruits", name: "Premium Dry Fruits", desc: "Crispy energy-packed almond kernels, cashews, raisins, and dates", icon: "Sun" },
  { id: "herbs", name: "Herbs & Special Items", desc: "100% natural psyllium husk, fennel, black seed, chia, and raw honey", icon: "Leaf" }
];

export interface Review {
  id: string;
  name: string;
  rating: number;
  city: string;
  review: string;
  date: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  img: string;
  productImage?: string;
  quantity: number;
}

export interface Order {
  id: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    confirmAddress?: string;
    city?: string;
    area: string;
    category?: string;
    latitude?: number;
    longitude?: number;
  };
  deliveryDetails?: {
    city?: string;
    area?: string;
    distanceKm: number;
    latitude?: number;
    longitude?: number;
    deliveryRate?: number;
    baseDeliveryFee?: number;
    actualDeliveryFee?: number;
    deliveryCharge?: number;
  };
  items: CartItem[];
  paymentMethod: string;
  subtotal: number;
  deliveryCharges: number;
  discount?: number;
  total: number;
  fulfillmentType?: "delivery" | "pickup";
  deliveryDate?: string;
  deliverySlot?: string;
  status: string;
  statusHistory: Array<{
    status: string;
    time: string;
    detail: string;
  }>;
  createdAt: string;
}

export interface ChatMessage {
  sender: "user" | "operator";
  text: string;
  time: string;
}

export type ToastType = "success" | "info" | "warning" | "error" | "wheat";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}
