import type { Express, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

const windows = new Map<string, { count: number; expires: number }>();
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_TOKEN;
  const supplied = req.headers.authorization?.replace(/^Bearer /, '') || '';
  if (!expected || expected.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  next();
}

export const productionCsp = [
  "default-src 'self'",
  "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: https://www.google.com https://maps.google.com",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

export function installSecurity(app: Express) {
  app.disable('x-powered-by');
  // Only trust the deployment's known proxy hop when explicitly configured.
  if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Content-Security-Policy', productionCsp);
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }
    if (!req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const origin = req.headers.origin;
    const allowed = new Set(['https://babaydeeattachakki.com', 'https://www.babaydeeattachakki.com', ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
    if (process.env.NODE_ENV !== 'production') { allowed.add('http://localhost:3000'); allowed.add('http://127.0.0.1:3000'); }
    if (origin && !allowed.has(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.vary('Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Order-Phone');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    const now = Date.now();
    // Expire entries and cap cardinality to avoid unbounded process memory.
    if (windows.size > 5000) for (const [key, entry] of windows) if (entry.expires < now) windows.delete(key);
    const sensitive = /checkout|order|notifications|email|reviews|support/.test(req.path);
    const key = `${req.ip}:${sensitive ? req.method === 'GET' ? 'private-read' : 'write' : 'public'}`;
    let entry = windows.get(key);
    if (!entry || entry.expires < now) {
      if (windows.size >= 10000) return res.status(503).json({ error: 'Please try again shortly.' });
      entry = {count: 0, expires: now + 60000}; windows.set(key, entry);
    }
    const limit = sensitive ? req.method === 'GET' ? 40 : 12 : 120;
    if (++entry.count > limit) { res.setHeader('Retry-After', String(Math.ceil((entry.expires-now)/1000))); return res.status(429).json({error:'Too many requests. Please try again shortly.'}); }
    next();
  });
  app.use('/api/admin', requireAdmin);
  app.use('/api/email', requireAdmin);
  app.use('/api/notifications', requireAdmin);
  app.post('/api/order/:id/status', requireAdmin);
}

export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('92') ? `0${digits.slice(2)}` : digits;
}

export function priceCart(items: unknown, catalog: any[]) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Basket must contain between 1 and 50 items.');
  return items.map(item => {
    const product = catalog.find(p => String(p.id) === String(item?.id));
    const quantity = item?.quantity;
    if (!product || product.outOfStock || !Number.isFinite(product.price) || product.price <= 0) throw new Error('A basket item is unavailable. Please refresh the store.');
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0.1 || quantity > 100 || Math.abs(quantity * 100 - Math.round(quantity * 100)) > 0.00001) throw new Error('Invalid item quantity.');
    return { id: product.id, name: product.name, price: product.price, unit: product.unit, img: product.img, quantity };
  });
}
