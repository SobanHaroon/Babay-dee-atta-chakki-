import {mkdir,writeFile} from 'node:fs/promises';

// Synthetic house/unit numbers exercise lookup coverage; no orders are placed.
const addresses=[
 'house 64 street 5 gulraiz phase 3 rawalpindi',
 'House 12 Street 7 Gulraiz Phase 2 Rawalpindi',
 'House 25 Street 10 Bahria Town Phase 7 Rawalpindi',
 'Flat 4 Street 8 Bahria Town Phase 8 Rawalpindi',
 'House 12 Street 5 DHA Phase 1 Islamabad',
 'House 15 Street 3 Sector B DHA Phase 2 Islamabad',
 'plaza 47 jinnah bolevard sector E DHA 2 islamabad',
 'House 12 Street 4 Sector F-10/2 Islamabad',
 'Flat 5 Street 9 Sector G-11/3 Islamabad',
 'House 4 Street 6 Sector I-8/2 Islamabad',
 'House 10 Saidpur Road Satellite Town Rawalpindi',
 'Shop 5 Murree Road Saddar Rawalpindi',
 'House 20 Street 3 Chaklala Scheme 3 Rawalpindi',
 'House 15 Street 6 PWD Housing Society Islamabad',
 'Plot 20 Street 4 Soan Garden Islamabad',
 'Shop 3 Adyala Road Rawalpindi',
 'House 10 Street 5 Ghauri Town Phase 4 Islamabad',
 'House 4 Street 9 Sector A Bahria Enclave Islamabad',
 'house 64 streat 5 gulraizz phaze 3 rawalpndi',
 'plasa 47 Jinna bouleverd secter E DHA2 Islmabad',
 'House 12 Rawalpindi city',
 'House 99 Street 999 Imaginary Sector ZZZ Rawalpindi',
];
const base=process.env.DELIVERY_TEST_URL||'http://localhost:3000';
let ready=false;
for(let attempt=0;attempt<20&&!ready;attempt++){
 try{ready=(await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)})).ok;}catch{}
 if(!ready)await new Promise(r=>setTimeout(r,500));
}
if(!ready)throw new Error('Start the local app before running the live delivery matrix.');
const results=[];let cursor=0;
async function worker(){
 while(cursor<addresses.length){
  const address=addresses[cursor++],start=Date.now();
  let result;
  try{
   const response=await fetch(base+'/api/delivery/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address}),signal:AbortSignal.timeout(45000)});
   const q=await response.json();
   result={address,status:response.status,matchedAddress:q.matchedAddress,type:q.type,latitude:q.latitude,longitude:q.longitude,distanceKm:q.distanceKm,deliveryCharge:q.deliveryCharge,error:q.error,ms:Date.now()-start};
  }catch{result={address,status:0,error:'Request unavailable or timed out',ms:Date.now()-start};}
  results.push(result);console.log(JSON.stringify(result));
 }
}
await Promise.all([worker(),worker()]);
await mkdir('artifacts/delivery',{recursive:true});
await writeFile('artifacts/delivery/live-matrix.json',JSON.stringify({testedAt:new Date().toISOString(),base,results},null,2));
const failures=results.filter(r=>r.address.includes('Rawalpindi city')||r.address.includes('Imaginary')?r.status!==422:r.status!==200||!Number.isFinite(r.distanceKm)||!Number.isFinite(r.deliveryCharge));
console.log(JSON.stringify({successes:results.filter(r=>r.status===200).length,total:results.length,unexpectedResults:failures.length}));
if(failures.length)process.exitCode=1;
