import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = process.cwd();
const output = path.join(root, 'artifacts', 'mobile-story');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'babay-milling-browser-'));
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { cwd: root, windowsHide: true, stdio: 'ignore' });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--window-size=1440,900', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
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
  await until(async () => (await fetch('http://127.0.0.1:5175')).ok, 'Vite');
  const tabs = await until(async () => (await fetch('http://127.0.0.1:9335/json')).json(), 'Chrome');
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
  await send('Page.navigate', { url: 'http://127.0.0.1:5175' });
  await until(() => evaluate('document.querySelector(".hero-slide-image")?.naturalWidth > 0'), 'hero photo', 120000).catch(async (error) => { console.log('Page diagnostic:', await evaluate('({text:document.body.innerText.slice(0,2000),hero:document.querySelector(".hero-slideshow")?.outerHTML})'));console.log('Exceptions:',JSON.stringify(exceptions));throw error; });


  const results = [];
  for (const width of [320, 390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height:844, deviceScaleFactor:1, mobile:width < 600});
    await evaluate('window.scrollTo({top:0,behavior:"instant"})');
    await pause(1200);
    const start = await evaluate(`(() => { const rail = document.querySelector('.milling-story-rail'); const target = innerWidth >= 1024 ? rail.closest('section') : rail; return target.getBoundingClientRect().top + scrollY - (innerWidth >= 1024 ? 72 : Math.ceil(document.querySelector('header').getBoundingClientRect().height) + 16); })()`);
    const states = [];
    for (const progress of [0, 0.5, 1, 0]) {
      await evaluate(`window.scrollTo({top:${start} + ${width >= 1024 ? 900 : 600} * ${progress},behavior:'instant'})`);
      await pause(1300);
      states.push(await evaluate(`({cards:[...document.querySelectorAll('.milling-story-card')].map(el=>({opacity:Number(getComputedStyle(el).opacity),x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width,top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height,overflow:el.scrollWidth>el.clientWidth})), pageOverflow:document.documentElement.scrollWidth > innerWidth})`));
      if (progress === 1) {
        const shot = await send('Page.captureScreenshot', {format:'png'});
        await writeFile(path.join(output, `story-${width}.png`), Buffer.from(shot.data,'base64'));
      }
    }
    const full = states[2];
    assert.ok(full.cards.every(c=>c.opacity > 0.99 && !c.overflow));
    assert.ok(full.cards.every(c=>Math.abs(c.top-full.cards[0].top)<2));
    assert.equal(full.pageOverflow,false);
    assert.ok(states[3].cards[2].opacity < full.cards[2].opacity);
    assert.ok(states[1].cards[0].opacity > states[1].cards[2].opacity);
    results.push({width,states});
  }
  await writeFile(path.join(output,'verification.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({passed:true,widths:results.map(r=>r.width),exceptions:exceptions.length}));
} finally {
  socket?.close();
  chrome.kill();
  vite.kill();
}
