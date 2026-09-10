import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = process.cwd();
const output = path.join(root, 'artifacts', 'glass-home');
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
  for (const width of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:width < 600});
    for (const target of ['#interactive-3d-mill', '[data-cinematic-section]:has(h3)', '#customer-reviews-section']) {
      await evaluate(`document.querySelector(${JSON.stringify(target)}).scrollIntoView({block:'start'})`);
      await pause(900);
    }
    await evaluate(`document.querySelector('#interactive-3d-mill').scrollIntoView({block:'start'})`);
    await pause(900);
    const shot = await send('Page.captureScreenshot', {format:'png'});
    await writeFile(path.join(output, `mill-${width}.png`), Buffer.from(shot.data,'base64'));
    const result = await evaluate(`({width:innerWidth, overflow:document.documentElement.scrollWidth > innerWidth, ready:document.querySelector('.milling-background').dataset.ready, surfaces:[...document.querySelectorAll('.cinematic-home .cinematic-glass')].map(el=>({background:getComputedStyle(el).backgroundColor,image:getComputedStyle(el).backgroundImage,blur:getComputedStyle(el).backdropFilter})), sections:document.querySelectorAll('.cinematic-home [data-cinematic-section]').length})`);
    assert.ok(result.sections >= 6);
    assert.ok(result.surfaces.every(s=>(s.background!=='rgba(0, 0, 0, 0)' || s.image!=='none') && s.blur==='blur(8px)'));
    assert.equal(result.overflow,false);
    await evaluate(`document.querySelector('.milling-story-card').closest('section').scrollIntoView({block:'center'})`);
    await pause(900);
    const story = await send('Page.captureScreenshot', {format:'png'});
    await writeFile(path.join(output, `story-${width}.png`), Buffer.from(story.data,'base64'));
    results.push(result);
  }
  await writeFile(path.join(output,'verification.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({passed:true,widths:results.map(r=>r.width),sections:results[0].sections,exceptions:exceptions.length}));
} finally {
  socket?.close();
  chrome.kill();
  vite.kill();
}
