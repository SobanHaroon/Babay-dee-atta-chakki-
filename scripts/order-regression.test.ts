import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { generateOrderReceiptHtml, downloadOrderReceipt, openOrderReceipt } from '../src/lib/orderReceipt.js';

test('checkout saves before confirming; cold-instance receipts retain real order details', async () => {
  process.env.SUPABASE_URL = 'https://database.test';
  process.env.SUPABASE_SECRET_KEY = 'test-server-key';
  for (const key of ['SMSPK_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'RESEND_API_KEY', 'GMAIL_USER', 'SMTP_HOST']) delete process.env[key];
  const originalFetch = globalThis.fetch;
  let rejectWrites = true;
  let inserts = 0;
  let notifications = 0;
  let stored: any;
  const required = ['order id', 'customer name', 'contact number', 'customer address', 'Price'];
  globalThis.fetch = async (input: any, init: any = {}) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return originalFetch(input, init);
    if (url.includes('/rest/v1/orders')) {
      if (init.method === 'POST') {
        inserts++;
        if (rejectWrites) return Response.json({ code: '42501', message: 'row-level security denied insert' }, { status: 403 });
        const row = JSON.parse(init.body)[0];
        const unsupported = Object.keys(row).find(key => !required.includes(key));
        if (unsupported) return Response.json({code: 'PGRST204', message: `Could not find the '${unsupported}' column of 'orders' in the schema cache`}, { status: 400 });
        stored = row;
        return new Response(null, { status: 201 });
      }
      return Response.json(stored ? [stored] : []);
    }
    if (url.includes('ntfy.sh')) { notifications++; return new Response('ok'); }
    return Response.json([]);
  };
  const { default: app } = await import('../api/index.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const submit = () => fetch(`${base}/api/checkout`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name:'Regression Customer',phone:'03000000000',fulfillmentType:'pickup',cartItems:[{id:'test',name:'Test Flour',price:200,quantity:1.5,unit:'kg'}]}) });
  try {
    const failed = await submit();
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).success, false);
    assert.equal(notifications, 0);
    rejectWrites = false;
    const success = await submit();
    assert.equal(success.status, 200);
    const result = await success.json();
    assert.equal(result.success, true);
    assert.equal(stored.Price, 300);
    assert.ok(inserts > 2);
    const metadata = JSON.parse(stored['customer address'].split('| METADATA:')[1]);
    assert.equal(metadata.items[0].unit, 'kg');
    assert.equal(metadata.fulfillmentType, 'pickup');
    // A different ID skips memory and exercises the database lookup used after a cold start.
    stored['order id'] = 987654321;
    const receipt = await fetch(`${base}/api/order/BDEC-987654321/receipt-html?download=1`);
    assert.equal(receipt.status, 200);
    assert.match(receipt.headers.get('content-disposition')!, /attachment/);
    const html = await receipt.text();
    assert.match(html, /Test Flour/);
    assert.match(html, /Regression Customer/);
    assert.match(html, /Self-Pickup/);
    stored = undefined;
    assert.equal((await fetch(`${base}/api/order/BDEC-unknown/receipt-html`)).status, 404);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('receipt safely renders fractional quantities and both browser actions use HTML blobs', () => {
  const order = {id:'BDEC-123456',customer:{name:'<script>alert(1)</script>'},items:[{name:'Flour',price:200,quantity:1.5,unit:'kg'}],subtotal:300,total:300};
  const html = generateOrderReceiptHtml(order);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /1.5/);
  const originals = {document: globalThis.document, create: URL.createObjectURL, timer: globalThis.setTimeout};
  const links: any[] = [];
  const blobs: Blob[] = [];
  globalThis.document = {createElement: () => {const link = {click(){},remove(){}};links.push(link);return link;},body:{appendChild(){}}} as any;
  URL.createObjectURL = blob => {blobs.push(blob as Blob);return 'blob:test-receipt';};
  globalThis.setTimeout = (() => 0) as any;
  try {
    openOrderReceipt(order);
    downloadOrderReceipt(order);
    assert.equal(links[0].href, 'blob:test-receipt');
    assert.equal(links[0].target, '_blank');
    assert.equal(links[1].download, 'BabayDee_Invoice_BDEC-123456.html');
    assert.ok(blobs.every(blob => blob.type === 'text/html;charset=utf-8'));
  } finally {
    globalThis.document = originals.document;
    URL.createObjectURL = originals.create;
    globalThis.setTimeout = originals.timer;
  }
});
