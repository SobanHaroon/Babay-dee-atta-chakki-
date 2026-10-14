import 'dotenv/config';
import express from 'express';
import {databaseStaffQueue, dispatchStaffNotification, validWorkerAuthorization} from './staffNotifications.js';
import { databaseClients } from './database.js';
import { createCatalogLoader } from './catalogRepository.js';
import { createDeliveryQuote, verifyDeliveryQuote, DeliveryQuoteError } from './addressDelivery.js';
import { getDeliverySettings } from './deliverySettings.js';
import { installSecurity, databaseRateStore } from './security.js';
import { authorizeOrder, orderAccessToken, checkout, CommerceError, databaseCommerceRepository, parseReview, validateContext, type CommerceRepository } from './commerce.js';
import { DEFAULT_CATEGORIES } from '../src/types.js';
import { INITIAL_DELIVERY_AREAS } from '../src/deliveryData.js';
import { generateOrderReceiptHtml } from '../src/lib/orderReceipt.js';

const {privileged:db,catalog:catalogDb}=databaseClients();
const catalog=createCatalogLoader(catalogDb);
const notificationsEnabled = () => process.env.APP_ENV === 'production' && process.env.ENABLE_CUSTOMER_NOTIFICATIONS === 'true' && (!process.env.VERCEL || process.env.VERCEL_ENV === 'production');
export function createApplication(overrides: { repository?:CommerceRepository; catalog?:()=>Promise<any[]>; settings?:()=>Promise<any>; rateStore?:any; production?:boolean; quoteVerifier?:any; sendReceipt?:(order:any)=>Promise<any>; staffDispatch?:(orderId?:string,requestId?:string)=>Promise<string> } = {}) {
  const app = express(), repository = overrides.repository || databaseCommerceRepository(db), loadCatalog = overrides.catalog || catalog;
  // Injected repositories never contact the live notification queue during tests.
  const staffDispatch=overrides.staffDispatch || (overrides.repository ? async()=> 'disabled' : (orderId?:string,requestId?:string)=>dispatchStaffNotification(databaseStaffQueue(db),{orderId,requestId}));
  const settings = overrides.settings || (()=>getDeliverySettings(db));
  const production = overrides.production ?? process.env.NODE_ENV === 'production';
  installSecurity(app,{production,rateStore:overrides.rateStore || (production ? databaseRateStore(db) : undefined)});
  app.use(express.json({limit:'32kb',strict:true}));
  app.use((req,res,next)=>{ if(req.method==='POST' && (!req.body || Array.isArray(req.body) || typeof req.body!=='object'))return res.status(400).json({error:'Send a JSON object.'}); next(); });
  const fail = (res:express.Response,error:unknown) => {
    const known = error instanceof CommerceError || error instanceof DeliveryQuoteError;
    const status = known ? error.status : 503;
    console.warn(JSON.stringify({event:'api_request_failed',requestId:res.locals.requestId,status,code:known ? (error as any).code : 'UPSTREAM_UNAVAILABLE'}));
    return res.status(status).json({success:false,error:known ? error.message : 'Service temporarily unavailable. Please try again.',code:known ? (error as any).code : 'UPSTREAM_UNAVAILABLE',requestId:res.locals.requestId});
  };
  const endpoint = (handler:(req:express.Request,res:express.Response)=>Promise<any>) => (req:express.Request,res:express.Response)=>{Promise.resolve(handler(req,res)).catch(error=>fail(res,error));};
  const requireOrder:express.RequestHandler = (req,res,next)=>{authorizeOrder(repository,req.params.id || req.body?.orderId,req.get('X-Order-Access-Token')).then(order=>{res.locals.order=order;next();}).catch(error=>fail(res,error));};
  app.get('/api/health',(_req,res)=>res.json({status:'ok',businessName:'Babay Dee Atta Chakki'}));
  app.get('/api/categories',(_req,res)=>res.json(DEFAULT_CATEGORIES));
  app.get(['/api/products','/api/featured-products','/api/popular-products'],endpoint(async(req,res)=>{
    let products = await loadCatalog();
    if(req.path.includes('featured-products'))products=products.filter(p=>p.featured);
    if(req.path.includes('popular-products'))products=products.filter(p=>p.popular);
    if(typeof req.query.category==='string' && req.query.category!=='all')products=products.filter(p=>p.category===req.query.category);
    if(typeof req.query.search==='string') { if(req.query.search.length>100)throw new CommerceError('Search is too long.'); const term=req.query.search.toLowerCase();products=products.filter(p=>`${p.name} ${p.desc}`.toLowerCase().includes(term)); }
    if(req.query.sort==='price-asc')products.sort((a,b)=>a.price-b.price); else if(req.query.sort==='price-desc')products.sort((a,b)=>b.price-a.price); else if(req.query.sort==='alphabetic')products.sort((a,b)=>a.name.localeCompare(b.name));
    res.json(products);
  }));
  app.get('/api/product/:id',endpoint(async(req,res)=>{const product=(await loadCatalog()).find(p=>p.id===req.params.id);return product?res.json(product):res.status(404).json({error:'Product not found.'});}));
  app.get('/api/delivery/settings',endpoint(async(_req,res)=>{res.json({success:true,data:await settings()});}));
  app.get('/api/delivery-areas',(_req,res)=>res.json({success:true,count:INITIAL_DELIVERY_AREAS.length,data:INITIAL_DELIVERY_AREAS}));
  app.post('/api/delivery/quote',endpoint(async(req,res)=>{
    validateContext(req.body);
    const result=await createDeliveryQuote(req.body.address,await settings(),process.env.MAPBOX_ACCESS_TOKEN || '',{checkoutContext:req.body.checkoutContext,addressVersion:req.body.addressVersion,confirmedPin:req.body.confirmedPin,candidateToken:req.body.candidateToken,requestId:res.locals.requestId});
    res.json(result);
  }));
  app.post('/api/checkout',endpoint(async(req,res)=>{
    const result=await checkout(req.body,req.get('Idempotency-Key'),{repository,catalog:loadCatalog,quote:async(input)=> overrides.quoteVerifier ? overrides.quoteVerifier(input) : verifyDeliveryQuote(input.quoteToken,input.address,await settings(),{checkoutContext:input.checkoutContext,addressVersion:input.addressVersion})});
    // Queue claims make retries safe. Staff alerts are independently opted in.
    try {await staffDispatch(result.orderId,res.locals.requestId);} catch {console.warn(JSON.stringify({event:'staff_notification_deferred',requestId:res.locals.requestId}));}
    // Customer messages remain disabled in development/preview. Persisted retries never resend.
    if(result.created && notificationsEnabled()) {
      try { const sms=await import('./smsService.js');await sms.sendOrderConfirmationSMS(result.order); }catch{console.warn(JSON.stringify({event:'order_sms_failed',requestId:res.locals.requestId}));}
      if(result.order.customer.email) try { const mail=await import('./emailService.js');await mail.sendOrderConfirmationEmail(result.order,result.order.customer.email); }catch{console.warn(JSON.stringify({event:'order_email_failed',requestId:res.locals.requestId}));}
    }
    const {created,...response}=result; res.json(response);
  }));
  app.get('/api/internal/order-alerts',endpoint(async(req,res)=>{
    if(!validWorkerAuthorization(req.get('Authorization')))return res.status(401).json({error:'Unauthorized.'});
    const results:string[]=[];
    for(let i=0;i<3;i++){const result=await staffDispatch(undefined,res.locals.requestId);results.push(result);if(['empty','disabled','deferred'].includes(result))break;}
    res.json({results});
  }));
  app.get('/api/order/:id',requireOrder,(req,res)=>res.json(res.locals.order.document));
  app.get('/api/order/:id/receipt-html',requireOrder,(req,res)=>{
    const html=generateOrderReceiptHtml({...res.locals.order.document,orderAccessToken:orderAccessToken(res.locals.order)});
    if(req.query.download==='1')res.setHeader('Content-Disposition',`attachment; filename="BabayDee_${res.locals.order.id}.html"`);
    res.type('html').send(html);
  });
  app.post('/api/order/send-receipt',requireOrder,endpoint(async(req,res)=>{
    if('email' in req.body || 'order' in req.body)throw new CommerceError('Receipts can only be sent to the email saved with this order.');
    const order={...res.locals.order.document,orderAccessToken:orderAccessToken(res.locals.order)};
    if(!order.customer?.email)throw new CommerceError('No email was saved with this order. You can download your receipt instead.');
    if(!overrides.sendReceipt && !notificationsEnabled())throw new CommerceError('Email delivery is disabled in this environment. Download your receipt instead.',503,'NOTIFICATIONS_DISABLED');
    if(!await repository.claimReceipt(order.id))throw new CommerceError('Please wait before requesting another receipt. Up to three requests are allowed per day.',429,'RECEIPT_LIMIT');
    const result=overrides.sendReceipt ? await overrides.sendReceipt(order) : await (await import('./emailService.js')).sendOrderConfirmationEmail(order,order.customer.email);
    if(!result?.delivered)throw new CommerceError('The email could not be delivered. Download your receipt or try later.',503,'EMAIL_UNAVAILABLE');
    res.json({success:true,delivered:true,message:'Receipt sent to your saved email.'});
  }));
  app.get('/api/reviews',endpoint(async(_req,res)=>res.json(await repository.reviews())));
  app.post('/api/reviews',endpoint(async(req,res)=>{
    const order=req.body.orderId ? await authorizeOrder(repository,req.body.orderId,req.get('X-Order-Access-Token')) : undefined;
    await repository.saveReview(parseReview(req.body,order));res.status(202).json({success:true,status:'pending',message:'Your review was submitted for moderation.'});
  }));
  app.post('/api/order/feedback',requireOrder,endpoint(async(req,res)=>{await repository.saveReview(parseReview(req.body,res.locals.order));res.status(202).json({success:true,status:'pending',message:'Your feedback was submitted for moderation.'});}));
  app.get('/sitemap.xml',endpoint(async(_req,res)=>{
    const paths=['/','/?tab=shop','/?tab=categories','/?tab=about','/?tab=contact',...(await loadCatalog()).map(p=>`/?product=${encodeURIComponent(p.id)}`)];
    const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path=>`<url><loc>${escape('https://babaydeeattachakki.com'+path)}</loc></url>`).join('')}</urlset>`);
  }));
  app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(error?.status===413?413:400).json({error:error?.status===413?'Request body is too large.':'Invalid JSON request body.',requestId:res.locals.requestId}));
  return app;
}
export const getSupabaseDeliverySettings = () => getDeliverySettings(db);
export default createApplication();
