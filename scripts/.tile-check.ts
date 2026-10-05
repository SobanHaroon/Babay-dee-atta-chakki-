import 'dotenv/config';
const key=process.env.VITE_MAPBOX_ACCESS_TOKEN;const url=new URL('https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/10/719/410');url.searchParams.set('access_token',key||'');
try{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});console.log(JSON.stringify({provider:'Mapbox tiles',status:r.status,contentType:r.headers.get('content-type'),configured:Boolean(key)}));}catch{console.log(JSON.stringify({provider:'Mapbox tiles',status:'network-timeout',configured:Boolean(key)}));}
