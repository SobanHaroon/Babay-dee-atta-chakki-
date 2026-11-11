import type { Order } from '../types.js';

// The same business number used by the store's existing WhatsApp contact links.
export const BUSINESS_WHATSAPP_NUMBER = '923215010846';
export const DELIVERY_CHARGES_NOTE = 'Delivery charges will be calculated separately. The total price including delivery will be shared through WhatsApp.';

export function hasPendingDeliveryCharges(order: Pick<Order, 'fulfillmentType' | 'deliveryChargeStatus'>): boolean {
  return order.fulfillmentType !== 'pickup' && order.deliveryChargeStatus === 'pending';
}

export function orderWhatsAppUrl(order: Pick<Order, 'id' | 'customer' | 'fulfillmentType'>): string {
  const pickup = order.fulfillmentType === 'pickup';
  const message = [
    'Assalam-o-Alaikum! I have placed an order on the Babay Dee Atta Chakki website.',
    '',
    `Order tracking ID: ${order.id}`,
    `Customer name: ${order.customer.name}`,
    `Address: ${pickup ? 'Store pickup — Babay Dee Atta Chakki, Main Gulraiz Phase 3 / High Court Road, Rawalpindi' : order.customer.address}`,
    `Contact number: ${order.customer.phone}`,
    '',
    pickup ? 'Please confirm my order and pickup details.' : 'Please confirm my order and share the total price including delivery charges.',
  ].join('\n');
  return `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
