import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { normalizePhone, priceCart } from './security.js';
import { upcomingDeliveryDays } from '../src/lib/commerce.js';

export class CommerceError extends Error { constructor(message: string, public status = 400, public code = 'INVALID_REQUEST') { super(message); } }
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function validateContext(body: any) {
  if (!body || typeof body.checkoutContext !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.checkoutContext || '') || !Number.isSafeInteger(body.addressVersion) || body.addressVersion < 0) throw new CommerceError('Please restart checkout to refresh your address session.');
}
export function parseCheckout(body: any, key: unknown) {
  validateContext(body);
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new CommerceError('A valid checkout retry key is required.');
  const pickup = body.fulfillmentType === 'pickup';
  if (!['pickup','delivery'].includes(body.fulfillmentType) || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 120 || !/^03\d{9}$/.test(normalizePhone(body.phone))) throw new CommerceError('Please provide valid customer details.');
  if (body.email && (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))) throw new CommerceError('Please provide a valid email address.');
  if (!pickup && (typeof body.address !== 'string' || body.address.trim().length < 8 || body.address.length > 600 || /[\u0000-\u0008]/.test(body.address))) throw new CommerceError('Please provide your complete delivery address.');
  if (!upcomingDeliveryDays().some(day => day.value === body.deliveryDate) || !['Morning','Afternoon','Late Afternoon','Evening'].includes(body.deliverySlot)) throw new CommerceError('Choose an available date and time.');
  const items = body.cartItems ?? body.items;
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new CommerceError('Add between 1 and 50 items to your basket.');
  const cleanItems = items.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100) throw new CommerceError('Invalid basket item.');
    return { id: item.id, quantity: item.quantity };
  }).sort((a,b) => a.id.localeCompare(b.id));
  if (new Set(cleanItems.map(item => item.id)).size !== cleanItems.length) throw new CommerceError('Duplicate basket items are not allowed.');
  return { key, checkoutContext: body.checkoutContext as string, addressVersion: body.addressVersion as number, name: body.name.trim(), phone: normalizePhone(body.phone), email: body.email?.trim() || '', address: pickup ? 'Store pickup' : body.address, fulfillmentType: pickup ? 'pickup' : 'delivery', deliveryDate: body.deliveryDate as string, deliverySlot: body.deliverySlot as string, items: cleanItems, quoteToken: pickup ? '' : body.deliveryQuoteToken as string };
}
export interface StoredOrder { id: string; document: any; order_access_hash: string; idempotency_key: string; checkout_context: string; request_hash: string; access_expires_at: string }
export interface CommerceRepository {
  findRetry(context: string, key: string): Promise<StoredOrder | null>;
  place(order: StoredOrder): Promise<{ record: StoredOrder; created: boolean }>;
  findOrder(id: string): Promise<StoredOrder | null>;
  claimReceipt(id: string): Promise<boolean>;
  reviews(): Promise<any[]>;
  saveReview(review: any): Promise<void>;
}
const storedColumns = 'id,document,order_access_hash,idempotency_key,checkout_context,request_hash,access_expires_at';
export function databaseCommerceRepository(db: any): CommerceRepository {
  function available() { if (!db) throw new CommerceError('Checkout is temporarily unavailable. Your basket has been kept.', 503, 'DATABASE_UNAVAILABLE'); }
  function failed(error: any) {
    const message = String(error?.message || '');
    if (['42P01','42883','PGRST202','PGRST205'].includes(error?.code)) throw new CommerceError('Ordering is not available yet. Your basket has been kept. Please contact the store.',503,'DATABASE_SETUP_REQUIRED');
    if (message.includes('STOCK_CHANGED')) throw new CommerceError('Stock changed while you were checking out. Please refresh your basket.', 409, 'STOCK_CHANGED');
    if (message.includes('PRICE_CHANGED')) throw new CommerceError('A product price changed. Please refresh your basket.', 409, 'PRICE_CHANGED');
    if (message.includes('IDEMPOTENCY_CONFLICT')) throw new CommerceError('This checkout retry contains different details. Please start a new checkout.', 409, 'IDEMPOTENCY_CONFLICT');
    throw new CommerceError('Checkout storage is temporarily unavailable. Your basket has been kept.', 503, 'DATABASE_UNAVAILABLE');
  }
  return {
    async findRetry(context,_key) { available(); const {data,error} = await db.from('secure_orders').select(storedColumns).eq('checkout_context',context).maybeSingle().abortSignal(AbortSignal.timeout(5000)); if(error) failed(error); return data; },
    async place(record) { available(); const {data,error} = await db.rpc('place_store_order',{p_order:record}).abortSignal(AbortSignal.timeout(10000)); if(error || !data?.record) failed(error); return data; },
    async findOrder(id) { available(); const {data,error} = await db.from('secure_orders').select(storedColumns).eq('id',id).maybeSingle().abortSignal(AbortSignal.timeout(5000)); if(error) failed(error); return data; },
    async claimReceipt(id) { available(); const {data,error} = await db.rpc('claim_order_receipt',{p_order_id:id}).abortSignal(AbortSignal.timeout(5000)); if(error) failed(error); return data === true; },
    async reviews() { available(); const {data,error} = await db.from('customer_reviews').select('id,name,rating,city,review,created_at,verified_purchase').eq('status','approved').eq('is_synthetic',false).order('created_at',{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(5000)); if(error) failed(error); return (data || []).map((r:any) => ({id:r.id,name:r.name,rating:r.rating,city:r.city,review:r.review,date:r.created_at.slice(0,10),verifiedPurchase:r.verified_purchase === true})); },
    async saveReview(review) { available(); const {error} = await db.from('customer_reviews').insert(review).abortSignal(AbortSignal.timeout(5000)); if(error) failed(error); },
  };
}
export function orderAccessToken(record: Pick<StoredOrder,'id'|'checkout_context'|'idempotency_key'>) {
  const secret = process.env.ORDER_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new CommerceError('Order access is temporarily unavailable.',503,'ACCESS_CONFIG');
  return createHmac('sha256',secret).update(`order-access:v1:${record.id}:${record.checkout_context}:${record.idempotency_key}`).digest('base64url');
}
export async function authorizeOrder(repository: CommerceRepository, id: unknown, token: unknown) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CommerceError('Use the private order link saved after checkout.',401,'ORDER_ACCESS_REQUIRED');
  if (typeof id !== 'string' || !/^BDEC-[a-f0-9]{32}$/i.test(id)) throw new CommerceError('Order access could not be verified.',404,'ORDER_NOT_FOUND');
  const record = await repository.findOrder('BDEC-'+id.slice(5).toLowerCase()), digest = hash(token);
  if (!record || !/^[a-f0-9]{64}$/.test(record.order_access_hash) || !timingSafeEqual(Buffer.from(record.order_access_hash),Buffer.from(digest)) || (!Number.isFinite(Date.parse(record.access_expires_at)) || Date.parse(record.access_expires_at) <= Date.now())) throw new CommerceError('Order access could not be verified.',404,'ORDER_NOT_FOUND');
  return record;
}
export async function checkout(body: any, key: unknown, dependencies: { repository: CommerceRepository; catalog(): Promise<any[]>; quote(input: ReturnType<typeof parseCheckout>): Promise<any> }) {
  const input = parseCheckout(body,key);
  // The signed token changes on renewal. Compare destination/pricing claims only
  // for retry identity; the actual signature is still verified before a new order.
  let destination:any = null;
  if (input.fulfillmentType === 'delivery') {
    try { const claims=JSON.parse(Buffer.from(input.quoteToken.split('.')[0],'base64url').toString()); destination={latitude:claims.latitude,longitude:claims.longitude,deliveryCharge:claims.deliveryCharge}; }
    catch { throw new CommerceError('Calculate delivery charges before placing your order.',409,'QUOTE_REQUIRED'); }
  }
  const { key:_key, quoteToken:_quoteToken,addressVersion:_addressVersion,...semantic } = input;
  const requestHash = hash(JSON.stringify({...semantic,destination}));
  const existing = await dependencies.repository.findRetry(input.checkoutContext,input.key);
  const response = (record:StoredOrder,created:boolean) => { const token = orderAccessToken(record); return {success:true,orderId:record.id,order:{...record.document,orderAccessToken:token},orderAccessToken:token,created}; };
  if (existing) { if(existing.request_hash !== requestHash || existing.idempotency_key !== input.key) throw new CommerceError('This checkout retry contains different details.',409,'IDEMPOTENCY_CONFLICT'); return response(existing,false); }
  const quote = input.fulfillmentType === 'delivery' ? await dependencies.quote(input) : null;
  let items:any[];
  try { items = priceCart(input.items,await dependencies.catalog()); } catch(error) { throw new CommerceError(error instanceof Error ? error.message : 'Refresh your basket.',409,'CART_CHANGED'); }
  const subtotal = Math.round(items.reduce((sum,item) => sum + item.price * item.quantity,0) * 100) / 100;
  const now = new Date().toISOString(), id = `BDEC-${randomUUID().replaceAll('-','')}`;
  const document = { id, fulfillmentType:input.fulfillmentType, customer:{name:input.name,phone:input.phone,email:input.email || undefined,address:input.address,city:quote?.city || '',area:input.fulfillmentType==='pickup'?'Store pickup':quote?.area||'',latitude:quote?.latitude,longitude:quote?.longitude}, items, subtotal, deliveryCharges:quote?.deliveryCharge || 0, discount:0, total:subtotal+(quote?.deliveryCharge || 0), paymentMethod:input.fulfillmentType === 'pickup' ? 'Pay at Store Counter' : 'Cash on Delivery', paymentStatus:'unpaid', status:'Order Placed', statusHistory:[{status:'Order Placed',time:now,detail:'Order received.'}], createdAt:now, deliveryDate:input.deliveryDate,deliverySlot:input.deliverySlot, deliveryDetails:quote ? {distanceKm:quote.distanceKm,latitude:quote.latitude,longitude:quote.longitude,locationPrecision:quote.type,matchedAddress:quote.matchedAddress,geocodedLatitude:quote.geocodedLatitude,geocodedLongitude:quote.geocodedLongitude,sourcePrecision:quote.sourcePrecision,actualDeliveryFee:quote.deliveryCharge} : undefined };
  const record:StoredOrder = {id,document,checkout_context:input.checkoutContext,idempotency_key:input.key,request_hash:requestHash,order_access_hash:'',access_expires_at:new Date(Date.now()+90*86400000).toISOString()};
  record.order_access_hash = hash(orderAccessToken(record));
  const placed = await dependencies.repository.place(record);
  return response(placed.record,placed.created);
}
export function parseReview(body:any, order?:StoredOrder) {
  const name = body?.name ?? body?.customerName, review = body?.review ?? body?.comment, rating = body?.rating, city = body?.city ?? '';
  if(typeof name !== 'string' || name.trim().length < 2 || name.length > 80 || typeof review !== 'string' || review.trim().length < 10 || review.length > 2000 || !Number.isInteger(rating) || rating < 1 || rating > 5 || typeof city !== 'string' || city.length > 100 || /https?:\/\//i.test(review)) throw new CommerceError('Enter your name, a rating from 1 to 5, and a review of 10–2,000 characters without links.');
  return {name:name.trim(),rating,review:review.trim(),city:city.trim(),status:'pending',verified_purchase:!!order && /^(delivered|collected|completed)$/i.test(order.document.status),order_id:order?.id || null,is_synthetic:false};
}

