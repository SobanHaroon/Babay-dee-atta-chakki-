export function pakistanDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year','month','day'].map(type => parts.find(p => p.type === type)?.value).join('-');
}
export function upcomingDeliveryDays(count = 5) {
  const today = new Date(pakistanDateKey() + 'T12:00:00+05:00');
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today.getTime() + i * 86400000);
    return { value: pakistanDateKey(date), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Asia/Karachi' }).format(date), formattedDate: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' }).format(date) };
  });
}
export function deliveryDateLabel(value?: string) {
  if (!value) return 'To be confirmed';
  const date = new Date(value + 'T12:00:00+05:00');
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' }).format(date);
}
export const formatRupees = (amount: number) => 'Rs. ' + (Number.isFinite(amount) ? amount : 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });

export function orderProgress(status: string, pickup = false) {
  const value = (status || '').toLowerCase().trim();
  const cancelled = /cancelled|canceled|rejected/.test(value);
  const index = cancelled ? -1 : /^(delivered|completed|collected)$/.test(value) ? 4 : /out for delivery|on the way|ready for pickup/.test(value) ? 3 : /dispatch/.test(value) ? 2 : /pending|milling|processing|inspected|preparing/.test(value) ? 1 : 0;
  return { cancelled, index, steps: pickup ? ['Order received','Preparing','Packed','Ready to collect','Collected'] : ['Order received','Preparing','Dispatched','Out for delivery','Delivered'] };
}
