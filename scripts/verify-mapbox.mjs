import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('artifacts/mapbox');await mkdir(output,{recursive:true});
const harness=path.resolve('artifacts/mapbox-check.html');
await writeFile(harness, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {DeliveryMapPicker} from '/src/components/DeliveryMapPicker.tsx';import '/src/index.css';import 'leaflet/dist/leaflet.css';
function Harness(){const [point,setPoint]=React.useState(null);window.externalSelect=setPoint;return React.createElement('div',{style:{maxWidth:700,margin:'20px auto'}},React.createElement(DeliveryMapPicker,{selectedLat:point?.lat,selectedLng:point?.lng,addressInput:point?.address,onVerificationChange:p=>window.pending=p,onLocationChange:p=>{window.selection=p;setPoint(p)}}));}createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`);
const profile=await mkdtemp(path.join(tmpdir(),'babay-mapbox-'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5178','--strictPort'],{windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9338','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--window-size=900,900','about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){try{const r=await fn();if(r)return r;}catch{}await pause(250);}throw Error('Timed out: '+label);}
let socket;const errors=[];const routeBodies=[];let failRoute=false;
try {
 await until(async()=>(await fetch('http://127.0.0.1:5178/artifacts/mapbox-check.html')).ok,'Vite');
 const tabs=await until(async()=>(await fetch('http://127.0.0.1:9338/json')).json(),'Chrome');
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const place={placeId:'test-address',formatted:'House 14-B, Street 25, F-10/2, Islamabad',mainText:'House 14-B, Street 25',secondaryText:'F-10/2, Islamabad',lat:33.678,lng:73.01,city:'Islamabad',area:'Sector F-10/2',featureType:'address',details:{houseNumber:'14-B',street:'Street 25',sector:'Sector F-10/2',city:'Islamabad'}};
 socket.addEventListener('message',async({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;const url=new URL(request.url);let body;let status=200;
  if(url.pathname.includes('autocomplete'))body={success:true,results:[place]};
  else if(url.pathname.includes('calculate-route')){const p=JSON.parse(request.postData);routeBodies.push(p);if(failRoute){status=503;body={success:false,error:'No driving route reaches this pin.'};}else body={success:true,deliverable:true,distanceKm:12.5,deliveryCharge:625,durationMinutes:24,pricePerKm:50,maxDeliveryDistanceKm:45,city:'Islamabad',area:'Sector F-10/2',details:place.details,storeLocation:{lat:33.567348,lng:73.104510},customerLocation:{lat:p.latitude,lng:p.longitude,address:p.address||'Street 25, F-10/2, Islamabad'},routeCoordinates:[{lat:33.567348,lng:73.104510},{lat:p.latitude,lng:p.longitude}]};}
  else {await send('Fetch.continueRequest',{requestId});return;}
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/delivery/*'}]});
 await send('Browser.grantPermissions',{origin:'http://127.0.0.1:5178',permissions:['geolocation']});
 await send('Emulation.setGeolocationOverride',{latitude:33.600123,longitude:73.070456,accuracy:12});
 await send('Page.navigate',{url:'http://127.0.0.1:5178/artifacts/mapbox-check.html'});
 await until(()=>evaluate("Boolean(document.querySelector('input[role=combobox]'))"),'map search');
 assert.equal(routeBodies.length,0,'shop is not auto-selected as customer');
 await evaluate(`(()=>{const e=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Street 25 F-10');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await until(()=>evaluate('document.querySelectorAll("[role=option]").length === 1'),'suggestions');
 await evaluate('document.querySelector("[role=option] button").click()');
 await until(()=>evaluate('window.selection?.deliveryCharge === 625 && !window.pending'),'verified selection');
 assert.equal(await evaluate('window.selection.lat'),33.678);
 assert.equal(await evaluate('window.selection.details.houseNumber'),'14-B');
 await until(()=>evaluate("Array.from(document.querySelectorAll('.leaflet-tile')).some(i=>i.complete && i.naturalWidth>0)"),'loaded map tiles',45000);
 const marker=await evaluate(`(()=>{const r=document.querySelector('[title="Drag delivery pin to your entrance"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:marker.x,y:marker.y});
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:marker.x,y:marker.y,button:'left',clickCount:1});
 for(let i=1;i<=8;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:marker.x+i*6,y:marker.y+i*3,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:marker.x+48,y:marker.y+24,button:'left',clickCount:1});
 await until(()=>evaluate('window.selection?.lat !== 33.678 && !window.pending'),'drag updated location');
 assert.equal(routeBodies.at(-1).address,'','drag reverse-geocodes without stale search text');
 await evaluate('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("Detect location")).click()');
 await until(()=>evaluate('window.selection?.lat === 33.600123 && !window.pending'),'GPS exact coordinates');
 assert.ok((await evaluate('document.body.innerText')).includes('12 metres'));
 await evaluate('window.externalSelect({lat:33.61,lng:73.08,address:"Rawalpindi"})');
 await until(()=>evaluate('document.body.innerText.includes("Confirm pin at my entrance") && !window.pending'),'external search pin review');
 assert.equal(await evaluate('window.selection.deliverable'),false,'external address needs pin confirmation');
 await evaluate('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("Confirm pin at my entrance")).click()');
 await until(()=>evaluate('window.selection.deliverable && !window.pending'),'confirmed external pin');
 failRoute=true;
 const bounds=await evaluate('(()=>{const r=document.querySelector(".leaflet-container").getBoundingClientRect();return {x:r.x+80,y:r.y+120};})()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...bounds,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...bounds,button:'left',clickCount:1});
 await until(()=>evaluate('document.body.innerText.includes("No driving route reaches")'),'route failure');
 assert.equal(await evaluate('document.body.innerText.includes("Delivery: Rs. 625")'),false,'stale quote removed');
 assert.equal(errors.length,0,JSON.stringify(errors));
 await until(()=>evaluate("Array.from(document.querySelectorAll('.leaflet-tile')).some(i=>i.complete && i.naturalWidth>0)"),'final map tiles',45000);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'map-validation.png'),Buffer.from(shot.data,'base64'));
 await writeFile(path.join(output,'results.json'),JSON.stringify({passed:['no default customer pin','autocomplete selection and details','drag coordinates','fresh GPS and accuracy','route error clears fee'],routes:routeBodies.length,consoleErrors:errors},null,2));
 console.log('Browser map checks passed: search, address details, pin drag, GPS, and failed-route fee clearing.');
} finally {socket?.close();chrome.kill();vite.kill();await unlink(harness).catch(()=>{});}
