const fs=require('node:fs');
for(const file of ['package.json','vercel.json'])fs.writeFileSync(file,JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')),null,2)+'\n');
const decoder=new TextDecoder('windows-1252'),utf8=new TextDecoder('utf-8',{fatal:true});const codes=new Map();for(let i=0;i<256;i++)codes.set(decoder.decode(Uint8Array.of(i)),i);
const paths=['src/App.tsx','api/commerce.ts','api/index.ts','scripts/mapbox.test.ts','scripts/security.test.ts','scripts/verify-checkout.mjs'];
for(const file of paths){let count=0;const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split('\n').map(line=>{if(!/[ÃÂâðï]/.test(line))return line;const bytes=[];for(const c of line){if(!codes.has(c))return line;bytes.push(codes.get(c));}try{const result=utf8.decode(Uint8Array.from(bytes));if(result!==line){count++;return result;}}catch{}return line;}).join('\n');fs.writeFileSync(file,text);console.log(file+': repaired encoding on '+count+' lines');}
