import type { Express, Request } from 'express';
import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

export interface RateStore { consume(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }> }
export function memoryRateStore(): RateStore {
  const windows = new Map<string, { count: number; expires: number }>();
  return { async consume(key, limit, seconds) {
    const now = Date.now();
    for (const [id, entry] of windows) if (entry.expires <= now) windows.delete(id);
    let entry = windows.get(key);
    if (!entry) { if (windows.size >= 10000) throw new Error('Rate store full'); entry = { count: 0, expires: now + seconds * 1000 }; windows.set(key, entry); }
    return { allowed: ++entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.expires - now) / 1000)) };
  } };
}
export class RateStoreError extends Error {constructor(public code:string){super('Shared rate store unavailable');}}
export function databaseRateStore(db: any): RateStore {
  return { async consume(key, limit, seconds) {
    if (!db) throw new RateStoreError('DATABASE_CONFIGURATION');
    const { data, error } = await db.rpc('consume_api_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: seconds }).abortSignal(AbortSignal.timeout(3000));
    if (error || !data || typeof data.allowed !== 'boolean') throw new RateStoreError(/^[A-Z0-9]{3,20}$/.test(error?.code||'') ? error.code : 'RATE_STORE_RESPONSE');
    return { allowed: data.allowed, retryAfter: Number(data.retry_after) || seconds };
  } };
}
export const productionCsp = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:", "img-src 'self' data: blob: https:",
  "connect-src 'self'", "worker-src 'self' blob:", "frame-src 'self' blob: https://www.google.com https://maps.google.com",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');
export function requestIp(req: Request) {
  // Vercel overwrites this header at its edge. Never trust it on arbitrary hosts.
  const edgeIp = process.env.VERCEL === '1' ? req.get('x-forwarded-for')?.split(',')[0]?.trim() : '';
  return edgeIp && isIP(edgeIp) ? edgeIp : req.ip || req.socket.remoteAddress || 'unknown';
}
export function installSecurity(app: Express, options: { rateStore?: RateStore; production?: boolean } = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const store = options.rateStore ?? (production ? databaseRateStore(null) : memoryRateStore());
  // Catalog reads do not depend on commerce migrations or signing secrets.
  const catalogRateStore=memoryRateStore(),catalogRateSecret=randomBytes(32).toString('hex');
  app.disable('x-powered-by');
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (Number.isInteger(hops) && hops > 0 && hops < 5) app.set('trust proxy', hops);
  app.use(async (req, res, next) => {
    const requestId = randomUUID(); res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    if (production) { res.setHeader('Content-Security-Policy', productionCsp); res.setHeader('Strict-Transport-Security', 'max-age=31536000'); }
    if (!req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const origin = req.get('origin');
    const allowed = new Set(['https://babaydeeattachakki.com', 'https://www.babaydeeattachakki.com', ...(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)]);
    if (!production) { allowed.add('http://localhost:3000'); allowed.add('http://127.0.0.1:3000'); }
    if (origin && !allowed.has(origin)) return res.status(403).json({ error: 'Origin not allowed.', requestId });
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.vary('Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Order-Access-Token, Idempotency-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (/^\/api\/(?:admin|email|notifications|support)(?:\/|$)/.test(req.path) || /^\/api\/order\/[^/]+\/status$/.test(req.path)) return res.status(404).json({ error: 'Endpoint not found.' });
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
    if (req.method === 'POST' && !req.is('application/json')) return res.status(415).json({ error: 'Send a JSON request body.' });
    if (req.get('sec-fetch-site') === 'cross-site' && req.method === 'POST') return res.status(403).json({ error: 'Cross-site request rejected.' });
    const bucket = req.path.startsWith('/api/delivery/') && req.method === 'POST' ? 'quote' : req.path === '/api/checkout' ? 'checkout' : req.path.includes('send-receipt') ? 'receipt' : req.path.includes('reviews') || req.path.includes('feedback') ? (req.method === 'POST' ? 'review' : 'public') : req.path.startsWith('/api/order/') ? 'tracking' : 'public';
    const limit = ({ quote: 12, checkout: 8, receipt: 3, review: 3, tracking: 40, public: 120 })[bucket];
    try {
      const catalogRead=['GET','HEAD'].includes(req.method)&&(/^\/api\/(?:health|categories|products|featured-products|popular-products)$/.test(req.path)||/^\/api\/product\/[^/]+$/.test(req.path));
      const secret = catalogRead ? catalogRateSecret : process.env.RATE_LIMIT_SECRET || process.env.ORDER_ACCESS_SECRET;
      if (production && (!secret || secret.length < 32)) throw new RateStoreError('RATE_LIMIT_CONFIGURATION');
      const key = createHmac('sha256', secret || 'local-development-only').update(`${bucket}:${requestIp(req)}`).digest('hex');
      const result = await (catalogRead?catalogRateStore:store).consume(key, limit, 60);
      if (!result.allowed) { res.setHeader('Retry-After', String(result.retryAfter)); return res.status(429).json({ error: 'Too many requests. Please wait and try again.', requestId }); }
      next();
    } catch (error) { const code=error instanceof RateStoreError?error.code:'RATE_STORE_UNAVAILABLE'; console.warn(JSON.stringify({ event: 'rate_limit_unavailable', requestId, bucket, code })); res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.', code:'SERVICE_UNAVAILABLE', requestId }); }
  });
}
export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, ''); return digits.startsWith('92') ? `0${digits.slice(2)}` : digits;
}
export function priceCart(items: unknown, catalog: any[]) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Basket must contain between 1 and 50 items.');
  const seen = new Set<string>();
  return items.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || seen.has(item.id)) throw new Error('Duplicate or invalid basket item.');
    seen.add(item.id);
    const product = catalog.find(p => p.id === item.id), quantity = item.quantity;
    if (!product || product.outOfStock || product.purchasable === false || !Number.isFinite(product.price) || product.price <= 0) throw new Error('A basket item is unavailable. Please refresh the store.');
    const step = product.quantityStep ?? (product.saleUnit === 'pack' || product.unit === 'Pack' ? 1 : 0.1);
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < step || quantity > 100 || Math.abs(quantity / step - Math.round(quantity / step)) > 0.00001) throw new Error('Invalid item quantity.');
    if (Number.isFinite(product.stockQuantity) && quantity > product.stockQuantity) throw new Error(`There is not enough stock of ${product.name}. Please update your basket.`);
    return { id: product.id, name: product.name, price: product.price, unit: product.unit, saleUnit: product.saleUnit, packWeightKg: product.packWeightKg, img: product.img, quantity };
  });
}
