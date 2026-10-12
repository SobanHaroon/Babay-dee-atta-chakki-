// Read-only check against the running local app; no fixture products or order writes.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const apiResponse=await fetch('http://127.0.0.1:3000/api/products');
assert.equal(apiResponse.status,200);const catalog=await apiResponse.json();
assert.equal(catalog.find(p=>p.id==='4').unit,'Kg');assert.equal(catalog.find(p=>p.id==='4').purchasable,true);
assert.equal(catalog.find(p=>p.id==='5').outOfStock,true);
assert.ok(catalog.every(p=>p.unit==='Kg'));assert.ok(catalog.some(p=>p.purchasable));
const profile=await mkdtemp(path.join(tmpdir(),'babay-real-catalog-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9341','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=1280,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const end=Date.now()+60000;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch{}await pause(200);}throw Error('Timed out: '+label);}
let socket;
try {
  const tabs=await until(async()=>(await fetch('http://127.0.0.1:9341/json')).json(),'browser');
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let sequence=0;const pending=new Map();const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result);}if(m.method==='Fetch.requestPaused'){const r=m.params;void send(['GET','HEAD','OPTIONS'].includes(r.request.method)?'Fetch.continueRequest':'Fetch.failRequest',{requestId:r.requestId,...(!['GET','HEAD','OPTIONS'].includes(r.request.method)?{errorReason:'BlockedByClient'}:{})}).catch(()=>{});}});
  const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error('Page evaluation failed');return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
  await send('Page.navigate',{url:'http://127.0.0.1:3000/?tab=shop'});
  const productCount=await until(()=>evaluate('document.querySelectorAll("h3[title]").length'),'real catalog cards');
  const body=await evaluate('document.body.innerText');assert.match(body,/161\s+items in catalog/);assert.equal(body.includes('The catalog could not be loaded'),false);assert.doesNotMatch(body,/SALE DETAILS UNCONFIRMED|Unit unconfirmed|DETAILS NEED CONFIRMATION/);assert.match(body,/OUT OF STOCK/);
  await mkdir('artifacts/catalog-live',{recursive:true});
  await evaluate('document.querySelector("h3[title]").scrollIntoView({block:"center"})');await pause(800);
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/catalog-live/desktop.png',Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(600);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'),true);
  const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/catalog-live/mobile.png',Buffer.from(mobile.data,'base64'));
  await writeFile('artifacts/catalog-live/results.json',JSON.stringify({productCount,catalogCount:161,source:'Real localhost API and Supabase catalog; no product fixtures',desktop:true,mobile:true,mutatingRequestsBlocked:true},null,2));
  console.log(JSON.stringify({success:true,productCount,catalogCount:161,desktop:true,mobile:true}));
}finally{socket?.close();chrome.kill();}
