import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve(process.env.CHECKOUT_ARTIFACTS_DIR || 'artifacts/checkout');await mkdir(output,{recursive:true});
const harness=path.resolve('artifacts/checkout-check.html');
await writeFile(harness,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#f8f6f0"><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import Checkout from '/src/components/CheckoutMultiStepForm.tsx';import{ToastProvider}from'/src/components/ToastContainer.tsx';import{OrderSuccessView}from'/src/components/OrderSuccessView.tsx';import{OrderTracker}from'/src/components/OrderTracker.tsx';import{upcomingDeliveryDays}from'/src/lib/commerce.ts';import '/src/index.css';import '/src/editorial.css';
const order={id:'BDEC-11111111111111111111111111111111',orderAccessToken:'synthetic-test-token',customer:{name:'Test Customer',phone:'03211234567',address:'House 14, Main Gulraiz Road, Rawalpindi',city:'Rawalpindi',area:'Gulraiz'},items:[{id:'1',name:'Chakki Atta',quantity:5,price:170,unit:'Kg'}],subtotal:850,deliveryCharges:0,deliveryChargeStatus:'pending',total:850,paymentMethod:'Cash on delivery',fulfillmentType:'delivery',deliveryDate:upcomingDeliveryDays()[0].value,deliverySlot:'Morning',status:'Out for Delivery',statusHistory:[{status:'Order Placed',time:'10:00 AM',detail:'Your order was received.'},{status:'Out for Delivery',time:'11:30 AM',detail:'Your order has left our store.'}],createdAt:new Date().toISOString()};window.sampleOrder=order;
function Harness(){const[view,setView]=React.useState('checkout');window.setView=setView;const[data,setData]=React.useState({checkoutContext:crypto.randomUUID(),addressVersion:0,name:'',phone:'',email:'',address:'',area:'',paymentMethod:'Cash on delivery',sendingBank:'',transactionId:'',deliveryDate:upcomingDeliveryDays()[0].value,deliverySlot:'Morning'});const[error,setError]=React.useState('');const[type,setType]=React.useState('delivery');window.checkoutState={data,type};return React.createElement('main',{style:{maxWidth:view==='checkout'?760:960,margin:'25px auto',padding:16}},view==='checkout'?React.createElement(Checkout,{checkoutFormData:data,setCheckoutFormData:setData,fulfillmentType:type,setFulfillmentType:setType,checkoutError:error,setCheckoutError:setError,upcomingDays:upcomingDeliveryDays(),cartItemsCount:1,handleCheckoutSubmit:()=>window.reviewed=true,onReturnToCart:()=>{}}):view==='success'?React.createElement(OrderSuccessView,{order,onClose:()=>{},onTrack:()=>setView('tracker'),onReorder:()=>{}}):React.createElement(OrderTracker));}createRoot(document.getElementById('root')).render(React.createElement(ToastProvider,null,React.createElement(Harness)));
</script></body></html>`);
const profile=await mkdtemp(path.join(tmpdir(),'babay-checkout-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn(process.env.CHROME_BIN || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'chromium'),['--no-sandbox','--disable-dev-shm-usage','--headless=new','--remote-debugging-port=9340','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1280,1100','about:blank'],{windowsHide:true,stdio:'ignore'});
let launchError;
for(const [name,child] of [['Vite',vite],['Chrome',chrome]]) {child.on('error',error=>{launchError=new Error(name+' could not start: '+error.message);});child.on('exit',code=>{if(code)launchError=new Error(name+' exited with code '+code);});}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){if(launchError)throw launchError;try{const r=await fn();if(r)return r;}catch{}await pause(150);}throw Error('Timed out: '+label);}
let socket;const errors=[];let catalogMode='ok',catalogName='Chakki Atta';let mode='ok',quoteCalls=0,trackCalls=0,appOrder=null,submittedBody=null;let checkoutMode='ok',checkoutCalls=0;const whatsappUrls=[],checkoutKeys=[];
try{
 await until(async()=>(await fetch('http://127.0.0.1:5180/artifacts/checkout-check.html')).ok,'Vite');
 const tabs=await until(async()=>(await fetch('http://127.0.0.1:9340/json')).json(),'Chrome');socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 socket.addEventListener('message',async({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown'){errors.push(m.params.exceptionDetails);console.error(JSON.stringify(m.params.exceptionDetails));}if(m.method==='Fetch.requestPaused'){
  const{requestId,request}=m.params;let body,status=200;
  if(request.url.startsWith('https://wa.me/')){
   whatsappUrls.push(request.url);
   // Keep the confirmation page open; never contact WhatsApp during this test.
   await send('Fetch.fulfillRequest',{requestId,responseCode:204});return;
  }
  if(request.url.includes('/api/delivery/')){quoteCalls++;status=404;body={error:'Removed endpoint'};}
  else if(request.url.includes('/api/order/')){trackCalls++;body=await evaluate('window.sampleOrder');if(mode==='cancelled')body.status='Cancelled';if(mode==='denied'){status=404;body={error:'Not found'};}}
  else if(request.url.includes('/api/checkout')){
   checkoutCalls++;submittedBody=JSON.parse(request.postData);checkoutKeys.push(Object.entries(request.headers).find(([key])=>key.toLowerCase()==='idempotency-key')?.[1]);
   if(checkoutMode==='failure'){status=503;body={success:false,error:'Synthetic storage failure. Your basket has been kept.'};}
   else {const sub=submittedBody.cartItems.reduce((sum,item)=>sum+170*item.quantity,0);appOrder={...appOrder,customer:{name:submittedBody.name,phone:submittedBody.phone,address:submittedBody.address,area:''},items:submittedBody.cartItems.map(item=>({...item,name:'Chakki Atta',price:170,unit:'Kg'})),subtotal:sub,total:sub,deliveryCharges:0,deliveryChargeStatus:'pending',deliveryDate:submittedBody.deliveryDate,deliverySlot:submittedBody.deliverySlot};body={success:true,order:appOrder,orderId:appOrder.id,orderAccessToken:appOrder.orderAccessToken};}
  }
  else if(request.url.includes('/api/products')){if(catalogMode==='failure'){status=503;body={error:'Synthetic catalog failure'};}else body=[{id:'1',name:catalogName,price:170,unit:'Kg',saleUnit:'kg',stockQuantity:100,quantityStep:.1,purchasable:true,category:'flour',desc:'Fresh flour',img:'/images/flour.webp'}];}
  else body=[];
  try{await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}catch{}
 }});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=async text=>{await until(()=>evaluate(`Array.from(document.querySelectorAll('button')).some(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled)`),'ready button '+text);return evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled).click()`);};
 const fill=async(selector,value)=>{await until(()=>evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),'ready field '+selector);return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
 const nextDisabled=()=>evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()==='Continue').disabled`);
 const shot=async(name,width)=>{await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});await pause(1000);await evaluate('window.scrollTo(0,0)');await pause(300);assert.equal(await evaluate('document.documentElement.scrollWidth<='+width),true,'No overflow: '+name);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(output,name+'.png'),Buffer.from(s.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'*supabase.co/rest/*'},{urlPattern:'https://wa.me/*'}]});await send('Page.navigate',{url:'http://127.0.0.1:5180/artifacts/checkout-check.html'});
 await until(()=>evaluate('Boolean(document.querySelector("input[name=name]"))'),'checkout');await fill('input[name=name]','Test Customer');await fill('input[name=phone]','03211234567');await click('Continue');await until(()=>evaluate('Boolean(document.querySelector("textarea"))'),'address step');
 assert.equal(await nextDisabled(),false);await click('Continue');
 assert.ok((await evaluate('document.body.innerText')).includes('Please enter your complete delivery address.'));
 assert.equal(await evaluate('document.querySelectorAll("textarea").length'),1);assert.equal(await evaluate('Boolean(document.querySelector(".leaflet-container"))'),false);
 await fill('textarea','House 14, Main Gulraiz Road, Rawalpindi');
 await shot('checkout-desktop',1280);await shot('checkout-mobile',390);await click('Continue');
 await until(()=>evaluate('document.body.innerText.includes("Your order, your time.")'),'review');await click('Review order');assert.equal(await evaluate('window.reviewed'),true);
 await click('Back');await fill('textarea','House 15 & Flat 2, Rawalpindi');await click('Continue');
 assert.ok((await evaluate('document.querySelector(".order-review").innerText')).includes('House 15 & Flat 2, Rawalpindi'));
 await click('Back');await fill('textarea','');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent.includes('Collect from store')).click()`);await click('Continue');
 await until(()=>evaluate('document.body.innerText.includes("Pay at the store")'),'pickup needs no address');
 await evaluate('window.setView("success")');await until(()=>evaluate('Boolean(document.querySelector("#order-received-title"))'),'success receipt');
 assert.ok((await evaluate('document.body.innerText')).includes('Total before delivery'));
 assert.ok((await evaluate('document.body.innerText')).includes('The total price including delivery will be shared through WhatsApp.'));
 assert.ok((await evaluate('document.body.innerText')).includes('House 14, Main Gulraiz Road, Rawalpindi'));
 await shot('order-received-desktop',1280);await shot('order-received-mobile',390);await click('Track your order');await until(()=>evaluate('Boolean(document.querySelector("input[name=order-code]"))'),'tracker');
 await fill('input[name=order-code]','BDEC-11111111111111111111111111111111');await fill('input[name=order-access]','synthetic-test-token');mode='ok';await click('Track order');await until(()=>evaluate('Boolean(document.querySelector(".order-timeline .active"))'),'tracking result');assert.ok((await evaluate('document.querySelector(".order-timeline .active").innerText')).includes('Out for delivery'));assert.equal(await evaluate('Boolean(document.querySelector(".leaflet-container"))'),false);
 await shot('tracking-desktop',1280);await shot('tracking-mobile',390);const before=trackCalls;mode='cancelled';await click('Track order');await until(()=>trackCalls>before&&evaluate('Boolean(document.querySelector(".status-chip.cancelled"))'),'repeat lookup');assert.equal(await evaluate('Boolean(document.querySelector(".order-timeline"))'),false);
 mode='denied';await click('Track order');await until(()=>evaluate('document.body.innerText.includes("No order found")'),'wrong access token');assert.equal(await evaluate('Boolean(document.querySelector(".receipt-panel"))'),false);
 appOrder=await evaluate('window.sampleOrder');mode='ok';
 catalogMode='failure';
 await send('Page.navigate',{url:'http://127.0.0.1:5180/?tab=shop'});
 await until(()=>evaluate('document.body.innerText.includes("The catalog could not be loaded")'),'catalog failure state');
 assert.equal(await evaluate('document.body.innerText.includes("No merchandise matches")'),false);
 await shot('catalog-error-mobile',390);catalogMode='ok';await click('Retry catalog');
 await until(()=>evaluate('Boolean(document.querySelector("#add-to-cart-btn-1"))'),'full app catalog');
 catalogName='Refreshed catalog fixture';await evaluate('window.dispatchEvent(new Event("online"))');
 await until(()=>evaluate('document.querySelector("#add-to-cart-btn-1")?.getAttribute("aria-label").includes("Refreshed catalog fixture")'),'catalog synchronizes on reconnect');
 catalogMode='failure';await evaluate('window.dispatchEvent(new Event("online"))');
 await until(()=>evaluate('document.body.innerText.includes("could not be refreshed")'),'refresh failure message');
 assert.equal(await evaluate('Boolean(document.querySelector("#add-to-cart-btn-1"))'),true,'refresh failure preserves current products');
 catalogMode='ok';catalogName='Chakki Atta';await click('Retry');
 await until(()=>evaluate('Boolean(document.querySelector("#add-to-cart-btn-1")) && !document.body.innerText.includes("Refreshed catalog fixture")'),'catalog retry recovery');
 await shot('catalog-loaded-mobile',390);

 await evaluate('document.querySelector("#add-to-cart-btn-1").click()');
 await pause(300);if(!await evaluate('Boolean(document.querySelector("#cart-drawer-checkout-btn"))'))await evaluate('document.querySelector("#header-basket-btn").click()');
 await until(()=>evaluate('Boolean(document.querySelector("#cart-drawer-checkout-btn"))'),'full app basket');
 await evaluate('document.querySelector("#cart-drawer-checkout-btn").click()');
 await until(()=>evaluate('Boolean(document.querySelector("input[name=name]"))'),'full app checkout');
 await fill('input[name=name]','Test Customer');await fill('input[name=phone]','03211234567');await click('Continue');
 await until(()=>evaluate('Boolean(document.querySelector("textarea"))'),'full app address');
 await fill('textarea','House 14, Main Gulraiz Road, Rawalpindi');
 assert.equal(await evaluate('Boolean(document.querySelector(".leaflet-container, .calculate-button, .delivery-confirm-map"))'),false);
 assert.ok((await evaluate('document.querySelector(".checkout-basket").innerText')).includes('Total before delivery'));
 await shot('full-checkout-desktop',1280);await shot('full-checkout-mobile',390);
 await click('Continue');await click('Review order');await until(()=>evaluate('Boolean(document.querySelector("#checkout-confirmation"))'),'full app review dialog');
 assert.equal(await evaluate('document.querySelector("#checkout-confirmation").contains(document.activeElement)'),true,'review dialog focus');
 assert.ok((await evaluate('document.querySelector("#checkout-confirmation").innerText')).includes('Confirmed on WhatsApp'));
 await shot('confirm-order-mobile',390);
 checkoutMode='failure';await click('Confirm & place order');
 await until(()=>evaluate('document.body.innerText.includes("Synthetic storage failure")'),'failed save shown');
 assert.equal(whatsappUrls.length,0,'failed orders must not redirect');
 assert.ok(await evaluate('JSON.parse(localStorage.getItem("babay_dee_cart")).length>0'),'failed save keeps basket');
 assert.equal(checkoutCalls,1);
 checkoutMode='ok';await click('Confirm & place order');
 await until(()=>whatsappUrls.length===1,'WhatsApp redirect after save');
 await until(()=>evaluate('Boolean(document.querySelector("#order-received-title"))'),'full app order received');
 assert.equal(checkoutCalls,2);assert.equal(checkoutKeys[0],checkoutKeys[1]);assert.ok(checkoutKeys[0]);
 assert.equal(submittedBody.deliveryQuoteToken,undefined);assert.equal(submittedBody.latitude,undefined);
 assert.equal(submittedBody.address,'House 14, Main Gulraiz Road, Rawalpindi');assert.equal(submittedBody.deliverySlot,'Morning');
 const whatsapp=new URL(whatsappUrls[0]);assert.equal(whatsapp.pathname,'/923215010846');
 for(const value of [appOrder.id,appOrder.customer.name,appOrder.customer.address,appOrder.customer.phone])assert.ok(whatsapp.searchParams.get('text').includes(value));
 assert.equal(await evaluate('sessionStorage.getItem("last_tracking_id")'),appOrder.id);
 assert.equal(await evaluate('JSON.parse(localStorage.getItem("babay_dee_cart")||"[]").length'),0);
 assert.equal(quoteCalls,0,'checkout never requests a delivery quote');
 console.log('Full app: basket, address, review, failed save, retry, confirmation and WhatsApp redirect passed.');
 assert.equal(errors.length,0,JSON.stringify(errors));await writeFile(path.join(output,'results.json'),JSON.stringify({quoteCalls,trackCalls,checkoutCalls,whatsappRedirects:whatsappUrls.length,passed:['catalog retry and reconnect','address required without map or quote','address edits proceed directly','free pickup without address','pending delivery note on receipts','tracking and access control','desktop and mobile no overflow','failed save keeps basket without redirect','retry retains idempotency key','successful save opens WhatsApp with saved order details','basket cleared and tracking preserved before redirect'],consoleErrors:errors},null,2));console.log('Checkout, receipt and tracking browser checks passed.');
}finally{socket?.close();chrome.kill();vite.kill();await unlink(harness).catch(()=>{});}
