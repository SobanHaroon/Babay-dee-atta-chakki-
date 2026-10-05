const PREFIX = 'babay_order_access:';
export function rememberOrderAccess(id: string, token: string): void {
  if (!id || !token) return;
  try { sessionStorage.setItem(PREFIX + id.toUpperCase(), token); sessionStorage.setItem('last_tracking_id', id); } catch { /* Private browsing can disable storage. */ }
}
export function readOrderAccess(id: string): string {
  try { return sessionStorage.getItem(PREFIX + id.toUpperCase()) || ''; } catch { return ''; }
}
export function orderTrackingUrl(id: string, token: string, base: string): string {
  const url = new URL('/', base);
  url.searchParams.set('tab', 'tracker'); url.searchParams.set('order', id);
  if (token) url.hash = new URLSearchParams({access: token}).toString();
  return url.toString();
}
