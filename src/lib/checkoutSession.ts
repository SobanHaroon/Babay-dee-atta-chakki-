export function checkoutContext(reset=false):string {
  try {
    const current=sessionStorage.getItem('babay_checkout_context');
    if(!reset&&current&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current))return current;
    const next=crypto.randomUUID();sessionStorage.setItem('babay_checkout_context',next);return next;
  }catch{return crypto.randomUUID();}
}
