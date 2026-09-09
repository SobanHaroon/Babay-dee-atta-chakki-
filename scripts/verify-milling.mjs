import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = process.cwd();
const output = path.join(root, 'artifacts', 'milling');
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/scripts/milling-preview.html' });
  await until(() => evaluate('typeof window.captureMillingFrame === "function"'), 'scene preview');
  const frameHashes = [];
  const stages = [['wheat', 0.08], ['grinding', 0.29], ['packing', 0.53], ['delivery', 0.83], ['shelf', 1]];
  await mkdir(path.join(root, 'public', 'milling'), { recursive: true });
  for (const [stage, p] of stages) {
    const data = await evaluate(`window.captureMillingFrame(${p})`);
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    const stats = await sharp(bytes).stats();
    assert.ok(stats.channels.some(c => c.stdev > 15), `${stage} is not blank`);
    await sharp(bytes).resize(1440).webp({ quality: 84 }).toFile(path.join(root, 'public', 'milling', `${stage}.webp`));
    frameHashes.push(data);
  }
  assert.equal(await evaluate('window.captureMillingFrame(0.29)'), frameHashes[1], 'Rendering backward returns the identical frame');
  assert.equal(new Set(frameHashes).size, 5, 'All five stages differ');
  console.log('Scene: five nonblank frames; exact reverse frame equality passed.');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173' });
  try {
    await until(() => evaluate('document.querySelector(".milling-background")?.dataset.ready === "true"'), 'homepage background', 45000);
  } catch (error) {
    console.log('Page diagnostic:', await evaluate('({ text: document.body.innerText.slice(0,1600), background: document.querySelector(".milling-background")?.outerHTML, html: document.documentElement.outerHTML.slice(-1800) })'));
    console.log('Exceptions:', JSON.stringify(exceptions));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, 'page-failure.png'), Buffer.from(shot.data, 'base64'));
    throw error;
  }
  await pause(1800);
  const state = () => evaluate(`(() => { const bg = document.querySelector('.milling-background'); const main = document.querySelector('main'); const rect = main.getBoundingClientRect(); return { progress: Number(bg?.dataset.progress), stage: bg?.dataset.stage, ready: bg?.dataset.ready, scroll: scrollY, start: rect.top + scrollY, end: rect.bottom + scrollY - innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, canvas: [bg?.querySelector('canvas').width, bg?.querySelector('canvas').height], pointer: bg && getComputedStyle(bg).pointerEvents }; })()`);
  async function scrollToProgress(p) {
    await evaluate(`(() => { const rect = document.querySelector('main').getBoundingClientRect(); const start = rect.top + scrollY; const end = rect.bottom + scrollY - innerHeight; scrollTo({ top: start + (end - start) * ${p}, behavior: 'instant' }); })()`);
    await until(async () => Math.abs((await state()).progress - p) < 0.015, `scroll progress ${p}`);
    return state();
  }
  const results = [];
  for (const [width, height, mobile] of [[1440, 900, false], [390, 844, true]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await pause(600);
    for (const p of [0.05, 0.28, 0.52, 0.75, 1, 0.52, 0.05]) {
      const current = await scrollToProgress(p);
      assert.equal(current.overflow, false, `No horizontal overflow at ${width}`);
      assert.equal(current.pointer, 'none');
      results.push({ width, ...current });
    }
    await scrollToProgress(0.52);
    const before = await state(); await pause(500); assert.equal((await state()).progress, before.progress, 'No autoplay while stationary');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(output, `homepage-${width}.png`), Buffer.from(shot.data, 'base64'));
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await until(() => evaluate('document.querySelector(".milling-background")?.dataset.ready === "false"'), 'reduced motion');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".milling-background-canvas")).display'), 'none');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await until(() => evaluate('document.querySelector(".milling-background")?.dataset.ready === "true"'), 'motion restored');
  await evaluate('document.querySelector("#hero-shop-now-btn").click()');
  await until(() => evaluate('!document.querySelector(".milling-background")'), 'background cleanup on navigation');
  assert.equal(await evaluate(`(async () => { const { ScrollTrigger } = await import('/node_modules/gsap/ScrollTrigger.js'); return !!ScrollTrigger.getById('milling-background'); })()`), false, 'ScrollTrigger cleaned up');
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ results, exceptions }, null, 2));
  assert.equal(exceptions.length, 0, `Browser exceptions: ${JSON.stringify(exceptions)}`);
  console.log('Desktop/mobile: bidirectional scroll sync, stationary progress, layout, pointer events, reduced motion and cleanup passed.');
} finally {
  socket?.close(); chrome.kill(); vite.kill();
}
