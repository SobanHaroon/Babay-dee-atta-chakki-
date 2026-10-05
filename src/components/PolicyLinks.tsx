/** Only publish policy links after the owner supplies approved content. */
export function PolicyLinks() {
  const env = (import.meta as any).env || {};
  const links = [
    {label: 'Privacy information', url: env.VITE_APPROVED_PRIVACY_URL},
    {label: 'Delivery information', url: env.VITE_APPROVED_DELIVERY_URL},
    {label: 'Returns information', url: env.VITE_APPROVED_RETURNS_URL},
  ].filter(link => typeof link.url === 'string' && (/^https:\/\//i.test(link.url) || /^\/(?!\/)/.test(link.url)));
  if (!links.length) return null;
  return <nav aria-label="Store policies" className="flex flex-wrap gap-4 text-xs mt-4">{links.map(link => <a key={link.label} href={link.url} className="underline underline-offset-4 hover:text-amber-400 focus-visible:outline focus-visible:outline-2">{link.label}</a>)}</nav>;
}
