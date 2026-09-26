import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const output = path.join(process.cwd(), 'artifacts', 'redesign');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'babay-redesign-'));
const production = process.argv.includes('--production');
const vite = spawn(process.execPath, production ? ['dist/server.cjs'] : ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], { windowsHide: true, stdio: 'ignore', env: {...process.env, ...(production ? {NODE_ENV:'production',PORT:'5176'} : {})} });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--window-size=1440,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description, timeout=90000) { const end=Date.now()+timeout; while(Date.now()<end) { try {const result=await check(); if(result) return result;}catch{} await pause(200); } throw new Error(`Timed out: ${description}`); }
let socket;
try {
  await until(async()=> (await fetch('http://127.0.0.1:5176')).ok, 'Vite');
  if (production) {
    const page=await fetch('http://127.0.0.1:5176');
    assert.ok(page.headers.get('content-security-policy')?.includes("object-src 'none'"));
    assert.equal(page.headers.get('x-content-type-options'),'nosniff');
    assert.equal((await fetch('http://127.0.0.1:5176/server.cjs')).status,404);
    assert.equal((await fetch('http://127.0.0.1:5176/server.cjs.map')).status,404);
  }
  const tabs=await until(async()=> (await fetch('http://127.0.0.1:9336/json')).json(), 'Chrome');
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let id=0; const pending=new Map(); const errors=[];
  function send(method,params={}) { return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));}); }
  const products=Array.from({length:8},(_,i)=>({id:String(i+1),name:['Chakki Atta','Besan','Multi Grain Atta','Jo Atta','Super Basmati Kainat','Daal Mash','Daal Chana','Badaam Giri'][i],price:170+i*30,unit:'Kg',desc:'Pure, carefully selected pantry essentials.',img:'/images/'+(i<4?'flour':i===4?'rice':'spices')+'.webp',category:i<4?'flour':i===4?'rice':'lentils',featured:i<4,popular:i>=4}));
  socket.addEventListener('message',async({data})=>{const msg=JSON.parse(data); if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p?.reject(msg.error):p?.resolve(msg.result);} if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails); if(msg.method==='Fetch.requestPaused') {
    const url=new URL(msg.params.request.url); let body=[];
    if(url.pathname.includes('products'))body=url.pathname.includes('featured')?products.slice(0,4):url.pathname.includes('popular')?products.slice(4):products;
    if(url.pathname.includes('categories'))body=[{id:'flour',name:'Atta & Flour'},{id:'rice',name:'Premium Rice'},{id:'lentils',name:'Daal & Lentils'}];
    if(url.hostname.includes('supabase'))body=[];
    await send('Fetch.fulfillRequest',{requestId:msg.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
  }});
  async function evaluate(expression) {const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'*supabase.co/rest/*'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5176'});
  await until(()=>evaluate('document.querySelector(".hero-photo img")?.naturalWidth > 0'),'hero').catch(async error => { console.log('Diagnostic', await evaluate('document.body.innerText.slice(0,2500)'), JSON.stringify(errors)); throw error; });
  console.log('Hero loaded');
  await pause(1800);
  const results=[{mode:production?'production':'development',catalog:'local fixture'}];
  for(const width of [1440,1280,1024,768,640,390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await evaluate('window.scrollTo({top:0,behavior:"instant"})'); await pause(700);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`overflow at ${width}`);
    assert.equal(await evaluate('document.querySelectorAll("h1").length'),1,'one h1');
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,`home-${width}.png`),Buffer.from(shot.data,'base64'));
    const grids=await evaluate(`Array.from(document.querySelectorAll('.collection-grid,.provisions-grid,.craft-steps')).map(grid=>({name:grid.className,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,items:Array.from(grid.children).map(child=>({left:child.offsetLeft,width:child.offsetWidth})),width:grid.clientWidth}))`);
    for(const grid of grids) {
      assert.equal(grid.columns,grid.name==='provisions-grid'?(width<=1100?2:4):(width<=760?1:3),`${grid.name} columns at ${width}`);
      assert.ok(grid.items.every(item=>item.width<=grid.width),`${grid.name} card fits at ${width}`);
    }
    results.push({width,noOverflow:true,gridColumns:grids.map(grid=>({name:grid.name,columns:grid.columns}))});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('document.querySelector("#interactive-3d-mill").scrollIntoView({block:"center",behavior:"instant"})');
  await until(()=>evaluate('document.querySelector(".craft-scene")?.dataset.ready === "true"'),'3D scene',90000);
  await pause(500);
  const craft=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'craft-desktop.png'),Buffer.from(craft.data,'base64'));
  await evaluate('document.querySelector(".scene-playback").click()');
  await pause(1000);
  assert.equal(await evaluate('document.querySelector(".scene-playback").getAttribute("aria-pressed")'),'true');
  const sceneClip=await evaluate('(() => { const r=document.querySelector(".craft-scene").getBoundingClientRect(); return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}; })()');
  await evaluate('document.querySelectorAll(".scene-caption,.scene-topline,.cinematic-vignette").forEach(e=>e.style.visibility="hidden")');
  const still=await send('Page.captureScreenshot',{format:'png',clip:sceneClip,captureBeyondViewport:true});
  await sharp(Buffer.from(still.data,'base64')).resize(1200).webp({quality:86}).toFile(path.join(process.cwd(),'public/milling/cinematic-still.webp'));
  await evaluate('document.querySelectorAll(".scene-caption,.scene-topline,.cinematic-vignette").forEach(e=>e.style.visibility="")');
  const pausedTime=await evaluate('document.querySelector(".craft-scene").dataset.sceneTime');await pause(300);
  assert.equal(await evaluate('document.querySelector(".craft-scene").dataset.sceneTime'),pausedTime,'pause freezes the simulation clock');
  results.push({ambientPause:true});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('document.querySelector(".craft-scene").scrollIntoView({block:"center",behavior:"instant"})');await pause(700);
  const mobileCraft=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'craft-mobile.png'),Buffer.from(mobileCraft.data,'base64'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await until(()=>evaluate('document.querySelector(".craft-scene")?.dataset.ready === "false"'),'reduced motion');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".craft-scene canvas")).display'),'none');
  await evaluate('document.querySelector("#hero-shop-now-btn").click()');
  await until(()=>evaluate('document.body.innerText.includes("Authentic Store Inventory")'),'shop'); await pause(500);
  assert.equal(await evaluate('new URLSearchParams(location.search).get("tab")'),'shop');
  await evaluate('document.querySelector("#header-basket-btn").click()');
  await pause(500);
  assert.equal(await evaluate('document.querySelector("#cart-drawer-container")?.getAttribute("role")'),'dialog');
  assert.equal(await evaluate('document.querySelector("#cart-drawer-container")?.contains(document.activeElement)'),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await pause(500);
  assert.equal(await evaluate('!!document.querySelector("#cart-drawer-container")'),false);
  await send('Page.navigate',{url:'http://127.0.0.1:5176/?product=1'});
  await until(()=>evaluate('!!document.querySelector("#product-details-container")'),'product deep link');
  assert.equal(await evaluate('document.querySelector("link[rel=canonical]").href'),'https://babaydeeattachakki.com/?product=1');
  results.push({scene:true,reducedMotion:true,shopNavigation:true,basketKeyboard:true,productDeepLink:true,runtimeErrors:errors});
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(path.join(output,production?'production-results.json':'browser-results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally { socket?.close(); chrome.kill(); vite.kill(); }
