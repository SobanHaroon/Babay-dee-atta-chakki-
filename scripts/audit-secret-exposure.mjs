// Read-only scan. Prints classifications/paths only; never credentials or source lines.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const known = fs.existsSync('.env') ? Object.entries(dotenv.parse(fs.readFileSync('.env'))).filter(([name,value]) => /KEY|TOKEN|SECRET|PASS/.test(name) && value.length >= 12) : [];
const found = new Map();
function scan(content, location, scope) {
  const types = new Set();
  for (const [name,value] of known) if (content.includes(value)) types.add(name.startsWith('VITE_') || name.includes('MAPBOX') && value.startsWith('pk.') ? 'public-map-token' : name.includes('GEOAPIFY') ? 'geoapify-api-key' : 'environment-secret');
  if (/sb_secret_[A-Za-z0-9_-]{15,}/.test(content)) types.add('supabase-secret-key');
  if (/\bre_[A-Za-z0-9]{20,}/.test(content)) types.add('resend-api-key');
  if (/\bsk\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/.test(content)) types.add('mapbox-secret-token');
  for (const jwt of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { if (JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).role === 'service_role') types.add('supabase-service-role-jwt'); } catch {}
  }
  for (const type of types) found.set(`${scope}:${location}:${type}`,{scope,location,type});
}
const allowed = name => /\.(?:[cm]?[jt]sx?|json|html|md|sql|ya?ml|env|txt|map)$/.test(name) || /(^|\/)\.env(?:\.|$)/.test(name);
const objects = execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8',maxBuffer:32*1024*1024}).trim().split('\n');
for (const line of objects) {
  const gap = line.indexOf(' '); if (gap < 0) continue;
  const oid = line.slice(0,gap), name = line.slice(gap+1);
  if (!allowed(name) || /^(node_modules|\.agents|agent\/skills)\//.test(name)) continue;
  try { scan(execFileSync('git',['cat-file','blob',oid],{encoding:'utf8',maxBuffer:8*1024*1024}), name, 'history'); } catch {}
}
const tracked = execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
for (const name of tracked) if (allowed(name) && fs.existsSync(name)) scan(fs.readFileSync(name,'utf8'),name,'working-tree');
function bundles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const name = path.join(dir,entry.name);
    if(entry.isDirectory()) bundles(name);
    else if(allowed(name)) scan(fs.readFileSync(name,'utf8'),name.replaceAll('\\','/'),'built-artifact');
  }
}
bundles('dist');
console.log(JSON.stringify({checkedAt:new Date().toISOString(),findings:[...found.values()],limitations:'Pattern scan is not proof of absence. Dashboard keys, remote environment restrictions and untracked private files are not inspected.'},null,2));
