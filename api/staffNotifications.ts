import { timingSafeEqual } from 'node:crypto';

type Environment = Record<string, string | undefined>;
export type OrderAlertDetails = {customer:{name:string;phone:string;email?:string;address:string};items:Array<{name:string;quantity:number;unit:string;price:number}>;subtotal:number;deliveryCharges:number;discount?:number};
export type Job = {orderId:string;legacyOrderId:number;leaseToken:string;total:number;fulfillmentType:string;deliveryDate:string;deliverySlot:string;details?:OrderAlertDetails};
export interface StaffQueue {
  claim(orderId?:string):Promise<Job|null>;
  finish(job:Job,error:string|null):Promise<boolean>;
}
export function databaseStaffQueue(db:any):StaffQueue {
  async function rpc(name:string,args:any) {
    if(!db)throw Error('QUEUE_UNAVAILABLE');
    const {data,error}=await db.rpc(name,args).abortSignal(AbortSignal.timeout(4000));
    if(error)throw Error('QUEUE_UNAVAILABLE');
    return data;
  }
  return {
    async claim(orderId){
      const job=await rpc('claim_staff_notification',{p_order_id:orderId||null});
      if(!job)return null;
      try {
        // Server-only read of the persisted order, never checkout/client-supplied details.
        const {data,error}=await db.from('secure_orders').select('document').eq('id',job.orderId).single().abortSignal(AbortSignal.timeout(4000));
        if(error||!data?.document)throw Error('ORDER_UNAVAILABLE');
        const d=data.document;
        return {...job,details:{customer:{name:d.customer?.name,phone:d.customer?.phone,email:d.customer?.email,address:d.customer?.address},
          items:d.items?.map((i:any)=>({name:i.name,quantity:i.quantity,unit:i.unit,price:i.price})),
          subtotal:d.subtotal,deliveryCharges:d.deliveryCharges,discount:d.discount}};
      } catch {
        await rpc('finish_staff_notification',{p_order_id:job.orderId,p_lease_token:job.leaseToken,p_error:'ORDER_DETAILS_UNAVAILABLE'});
        throw Error('ORDER_DETAILS_UNAVAILABLE');
      }
    },
    finish:(job,error)=>rpc('finish_staff_notification',{p_order_id:job.orderId,p_lease_token:job.leaseToken,p_error:error}),
  };
}
export function staffNotificationsEnabled(env:Environment=process.env) {
  return env.ENABLE_STAFF_NOTIFICATIONS==='true' && !!env.NTFY_TOPIC?.trim()
    && env.NODE_ENV!=='test' && env.APP_ENV!=='test' && env.APP_ENV!=='staging'
    && (!env.VERCEL || env.VERCEL_ENV==='production');
}
export function validWorkerAuthorization(header:string|undefined,env:Environment=process.env) {
  const secret=env.CRON_SECRET;
  if(!secret || secret.length<32 || !header)return false;
  const actual=Buffer.from(header),expected=Buffer.from(`Bearer ${secret}`);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
const money=(amount:number)=>new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(amount);
const plain=(value:unknown,fallback='Not provided')=>typeof value==='string'&&value.trim()?value.replace(/[\r\n\u0000-\u001f\u007f]+/g,' ').trim():fallback;
export function formatStaffOrder(job:Job):string[] {
  const d=job.details;
  if(!d||!Array.isArray(d.items)||!d.items.length||d.items.length>50||!d.customer?.name||!d.customer.phone
    ||![job.total,d.subtotal,d.deliveryCharges,d.discount??0].every(v=>Number.isFinite(v)&&v>=0)
    ||Math.abs(d.subtotal+d.deliveryCharges-(d.discount??0)-job.total)>.011
    ||d.items.some(i=>!i.name||!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isFinite(i.price)||i.price<0))throw Error('INVALID_ORDER_DETAILS');
  const lines=[
    'Order: '+job.orderId,'Dashboard order: '+job.legacyOrderId,
    'Fulfillment: '+(job.fulfillmentType==='pickup'?'Store pickup':'Delivery'),
    'Scheduled: '+plain(job.deliveryDate)+' / '+plain(job.deliverySlot),'',
    'Customer: '+plain(d.customer.name),'Phone: '+plain(d.customer.phone),'Email: '+plain(d.customer.email),
    'Address: '+plain(d.customer.address,job.fulfillmentType==='pickup'?'Store pickup — no delivery address':'Not provided'),'',
    'Items:',...d.items.map((item,index)=>(index+1)+'. '+plain(item.name)+' — '+item.quantity+' '+plain(item.unit,'unit')+' × Rs. '+money(item.price)+' = Rs. '+money(Math.round(item.quantity*item.price*100)/100)),
    '', 'Order without delivery (subtotal): Rs. '+money(d.subtotal),'Delivery charges: Rs. '+money(d.deliveryCharges),
    ...((d.discount??0)>0?['Discount: Rs. '+money(d.discount!)]:[]),'Order total: Rs. '+money(job.total),
  ];
  // ntfy limits UTF-8 message bodies to 4096 bytes. Never split a Unicode character or drop items.
  const parts:string[]=[];let part='',bytes=0;
  for(const line of lines){
    const text=line+'\n',size=Buffer.byteLength(text);
    if(bytes+size>3600&&part){parts.push(part.trimEnd());part='';bytes=0;}
    for(const ch of text){const length=Buffer.byteLength(ch);if(bytes+length>3600){parts.push(part);part='';bytes=0;}part+=ch;bytes+=length;}
  }
  if(part.trim())parts.push(part.trimEnd());
  if(parts.length>20)throw Error('ORDER_DETAILS_TOO_LARGE');
  return parts.map((part,index)=>parts.length>1?'Order #'+job.legacyOrderId+' — part '+(index+1)+'/'+parts.length+'\n'+part:part);
}
export async function dispatchStaffNotification(queue:StaffQueue,options:{orderId?:string;requestId?:string;env?:Environment;fetcher?:typeof fetch;log?:(data:any)=>void}={}) {
  const env=options.env||process.env;
  if(!staffNotificationsEnabled(env))return 'disabled';
  const log=options.log||((data:any)=>console.warn(JSON.stringify(data)));
  let job:Job|null=null;
  const deadline=Date.now()+10000;
  try {
    const base=new URL(env.NTFY_BASE_URL||'https://ntfy.sh');
    if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!/^\/[\w/-]*$/.test(base.pathname)
      || !/^[A-Za-z0-9_-]{1,200}$/.test(env.NTFY_TOPIC!))throw Error('NTFY_CONFIGURATION');
    job=await queue.claim(options.orderId);
    if(!job)return 'empty';
    if(!Number.isFinite(job.total)||!Number.isInteger(job.legacyOrderId))throw Error('INVALID_JOB');
    let messages:string[];
    try {messages=formatStaffOrder(job);}catch{await queue.finish(job,'INVALID_ORDER_DETAILS');throw Error('INVALID_ORDER_DETAILS');}
    let failure:string|null=null;
    for(let index=0;index<messages.length;index++){
      try {
        const remaining=deadline-Date.now();if(remaining<=0)throw Error('DEADLINE');
        const response=await (options.fetcher||fetch)(base.toString(),{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(Math.min(6000,remaining)),
          headers:{'Content-Type':'application/json',...(env.NTFY_ACCESS_TOKEN?{Authorization:'Bearer '+env.NTFY_ACCESS_TOKEN}:{})},
          body:JSON.stringify({topic:env.NTFY_TOPIC,title:'New order #'+job.legacyOrderId+(messages.length>1?' ('+(index+1)+'/'+messages.length+')':''),priority:4,tags:['shopping_cart'],message:messages[index]}),
        });
        if(!response.ok)failure='NTFY_HTTP_'+response.status;
        // Never log provider bodies: they may echo customer details or credentials.
        await response.body?.cancel();
      } catch { failure='NTFY_NETWORK_OR_TIMEOUT'; }
      if(failure)break;
    }
    if(!await queue.finish(job,failure))throw Error('QUEUE_ACK_FAILED');
    if(failure){log({event:'staff_notification_deferred',code:failure,requestId:options.requestId});return 'deferred';}
    return 'sent';
  } catch {
    // The lease expires automatically if recording the result also fails.
    log({event:'staff_notification_unavailable',requestId:options.requestId});
    return 'deferred';
  }
}
