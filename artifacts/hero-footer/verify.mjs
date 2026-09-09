import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = process.cwd();
const output = path.join(root, 'artifacts', 'hero-footer');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'babay-milling-browser-'));
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: root, windowsHide: true, stdio: 'ignore' });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--window-size=1440,900', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; } catch {}
    await pause(150);
  }
  throw new Error(`Timed out: ${description}`);
}
let socket;
try {
  await until(async () => (await fetch('http://127.0.0.1:5173')).ok, 'Vite');
  const tabs = await until(async () => (await fetch('http://127.0.0.1:9333/json')).json(), 'Chrome');
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', async ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) { const entry = pending.get(msg.id); pending.delete(msg.id); msg.error ? entry?.reject(msg.error) : entry?.resolve(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails);
    if (msg.method === 'Fetch.requestPaused') {
      await send('Fetch.fulfillRequest', { requestId: msg.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from('[]').toString('base64') });
    }
  });
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }

  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await until(() => evaluate('document.querySelector(".hero-slide-image")?.naturalWidth > 0'), 'hero photo', 120000).catch(async (error) => { console.log('Page diagnostic:', await evaluate('({text:document.body.innerText.slice(0,2000),hero:document.querySelector(".hero-slideshow")?.outerHTML})'));console.log('Exceptions:',JSON.stringify(exceptions));throw error; });
  await pause(1200);
  const initial=await evaluate('document.querySelector(".hero-slideshow").dataset.slide');
  const transform1=await evaluate('getComputedStyle(document.querySelector(".hero-slide[data-active=true] img")).transform');
  await pause(400);
  const transform2=await evaluate('getComputedStyle(document.querySelector(".hero-slide[data-active=true] img")).transform');
  assert.notEqual(transform1,transform2,'Gentle photo motion runs');
  await until(() => evaluate('document.querySelector(".hero-slideshow").dataset.slide !== "'+initial+'"'), 'automatic slide change', 12000);
  await pause(2000);
  assert.ok(await evaluate('document.querySelector(".hero-slide[data-active=true] img").naturalWidth > 0'));
  await evaluate('document.querySelector(".hero-slideshow-toggle").click()');
  await pause(200);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero-slide[data-active=true] img")).animationPlayState'),'paused');
  await writeFile(path.join(output,'hero-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('document.querySelector(".hero-slideshow-toggle").click()');
  const results=[];
  for(const [width,height,mobile] of [[1440,900,false],[390,844,true]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await evaluate('document.querySelector("footer").scrollIntoView({behavior:"instant",block:"start"})');
    await pause(700);
    const footer=await evaluate('(() => { const f=document.querySelector("footer"); const s=getComputedStyle(f);const r=f.getBoundingClientRect();return {background:s.backgroundColor,zIndex:s.zIndex,text:f.innerText,rect:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:document.documentElement.scrollWidth>innerWidth,topmost:document.elementFromPoint(20,Math.max(5,r.top+8))?.closest("footer") === f}; })()');
    assert.equal(footer.zIndex,'10'); assert.equal(footer.overflow,false); assert.equal(footer.topmost,true);
    assert.ok(footer.text.includes('Approved Categories') || footer.text.includes('APPROVED CATEGORIES'));
    const shot=await send('Page.captureScreenshot',{format:'png',...(width===1440?{clip:{x:0,y:Math.max(0,footer.rect.y),width:footer.rect.width,height:Math.min(footer.rect.height,900-footer.rect.y),scale:1}}:{})});
    await writeFile(path.join(output,'footer-'+width+'.png'),Buffer.from(shot.data,'base64'));
    results.push({width,...footer});
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('scrollTo({top:0,behavior:"instant"})');
  await pause(400);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero-slide[data-active=true] img")).animationName'),'none');
  assert.equal(await evaluate('document.querySelector(".hero-slideshow-toggle")'),null);
  await writeFile(path.join(output,'verification.json'),JSON.stringify({results,exceptions},null,2));
  assert.equal(exceptions.length,0);
  console.log('PASS: hero photos load, autoplay, drift, pause and reduced motion; footer paints above background at desktop/mobile widths with no horizontal overflow or uncaught errors.');
} finally { socket?.close(); chrome.kill(); vite.kill(); }
