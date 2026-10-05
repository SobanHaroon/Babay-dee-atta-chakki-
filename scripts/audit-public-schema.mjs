// Read public bundle identifiers and schema metadata only. No customer rows/writes.
const site = 'https://babaydeeattachakki.com';
const request = url => fetch(url,{signal:AbortSignal.timeout(15000)});
const html = await (await request(site)).text();
const files = [...html.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]);
const keys = new Set();
for (const file of files) {
  const source = await (await request(new URL(file,site))).text();
  for (const key of source.match(/sb_publishable_[A-Za-z0-9_-]+/g) || []) keys.add(key);
}
for (const key of keys) {
  const response = await fetch('https://dlinknypnlmcrhgbediu.supabase.co/rest/v1/',{headers:{apikey:key,Accept:'application/openapi+json'},signal:AbortSignal.timeout(15000)});
  const body = await response.json();
  console.log(JSON.stringify({source:'public-browser-bundle',status:response.status,schemas:Object.fromEntries(Object.entries(body.definitions || {}).map(([name,value]) => [name,{required:value.required,properties:value.properties}]))},null,2));
}
if (!keys.size) console.log(JSON.stringify({publicBundleKeysFound:0}));
