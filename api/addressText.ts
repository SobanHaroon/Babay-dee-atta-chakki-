import { INITIAL_DELIVERY_AREAS } from '../src/deliveryData.js';

/** Edit distance with adjacent transpositions, used only for lookup text, never house/sector numbers. */
export function spellingDistance(a: string, b: string): number {
  const d = Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
const aliases = (s:string) => s.replace(/\bgul(?:raiz|rez|reiz|raez)\b/gi,'Gulrez').replace(/\bpindi\b/gi,'Rawalpindi').replace(/\bdefen[cs]e\s+housing\s+authority\b/gi,'DHA').replace(/\b(?:blvd|boul)\.?\b/gi,'Boulevard').replace(/\bave\.?\b/gi,'Avenue');
const vocabulary = [...new Set(('house home flat apartment plot building plaza shop office street road avenue boulevard highway expressway lane main sector phase housing scheme society colony town block near opposite behind number rawalpindi islamabad rawat chaklala gulrez gulraiz bahria jinnah '+INITIAL_DELIVERY_AREAS.map(a=>a.area+' '+a.city).join(' ')).toLowerCase().match(/[a-z]{4,}/g)||[])];
const roman:Record<string,string> = {i:'1',ii:'2',iii:'3',iv:'4',v:'5',vi:'6',vii:'7',viii:'8',ix:'9',x:'10'};

export function correctAddressText(input:string):string {
  let text=input.normalize('NFKC').replace(/\s+/g,' ').trim();
  text=text.replace(/[a-z]{4,}/gi,word=>{
    const lower=word.toLowerCase();
    if(vocabulary.includes(lower))return word;
    const choices=vocabulary.filter(w=>Math.abs(w.length-lower.length)<=2).map(w=>({word:w,d:spellingDistance(lower,w)})).sort((a,b)=>a.d-b.d);
    const best=choices[0],limit=lower.length>=7?2:1;
    return best&&best.d<=limit&&(!choices[1]||choices[1].d>best.d)?best.word:word;
  });
  return aliases(text)
    .replace(/\bphase\s*[-:]?\s*([ivx]+)\b/gi,(_,r)=>'Phase '+(roman[r.toLowerCase()]||r))
    .replace(/\bdha\s*-?\s*(\d+)\b/gi,'DHA Phase $1')
    .replace(/\b([a-i])\s*-?\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\b/gi,(_,letter,n,sub)=>letter.toUpperCase()+'-'+n+(sub?'/'+sub:''));
}
export const normalizeAddressText=(s:string)=>aliases(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const premisePattern=/\b(?:house|home|flat|apartment|plot|building|plaza|shop|office)\s*(?:(?:no\.?|number|#)\s*)?[:#-]?\s*(?:[a-z]-?)?\d[\w/-]*\s*,?\s*/gi;
export const withoutHouse=(s:string)=>s.replace(premisePattern,'').replace(/^\s*#?\d+[\w/-]*\s*,?\s+(?=[a-z])/i,'').trim();
export const houseNumber=(s:string)=>correctAddressText(s).match(/\b(?:house|home|plot|building|plaza)\s*(?:(?:no\.?|number|#)\s*)?[:#-]?\s*((?:[a-z]-?)?\d[\w/-]*)\b/i)?.[1] || correctAddressText(s).match(/^#?(\d+[\w/-]*)\s+/)?.[1];
export const sectorId=(s:string)=>{
  const numbered=withoutHouse(correctAddressText(s)).match(/\b([a-i])-([0-9]{1,2})(?:\/([0-9]{1,2}))?\b/i);
  return numbered?numbered[1].toUpperCase()+'-'+numbered[2]+(numbered[3]?'/'+numbered[3]:''):undefined;
};
export const localSector=(s:string)=>correctAddressText(s).match(/\bsector\s*[-:]?\s*([a-z]|\d{1,3})\b(?!\s*[-/\d])/i)?.[1].toUpperCase();
const phasePattern=/\bphase\s*[-:]?\s*\d+(?:\s*-?\s*[a-z]\b)?/gi;
export const phaseId=(s:string)=>correctAddressText(s).match(/\bphase\s*[-:]?\s*(\d+(?:\s*-?\s*[a-z]\b)?)/i)?.[1].replace(/[\s-]/g,'').toLowerCase();
export const phasesAgree=(a:string|undefined,b:string|undefined)=>!a||!b||a===b||(/^\d+$/.test(a)&&b.replace(/[a-z]$/,'')===a)||(/^\d+$/.test(b)&&a.replace(/[a-z]$/,'')===b);
export const streetNumber=(s:string)=>correctAddressText(s).match(/\b(?:street|st|road|rd)[-.]?\s*(?:no\.?|number|#)?\s*(\d+[a-z]?)\b/i)?.[1].toLowerCase();
const generic=/^(house|home|flat|apartment|plot|building|plaza|shop|office|street|st|road|rd|avenue|boulevard|highway|expressway|lane|sector|phase|town|city|colony|main|number|housing|scheme|society|block|rawalpindi|islamabad|rawat|district|cantonment|capital|territory|pakistan|punjab|near|opposite|behind)$/;
export const significantWords=(s:string)=>normalizeAddressText(correctAddressText(s)).split(' ').filter(w=>w.length>2&&!generic.test(w)&&!/^\d+$/.test(w));
export function wordsAgree(wanted:string[],found:string[]):boolean {
  if(!wanted.length||!found.length)return false;
  return wanted.every(w=>found.some(f=>w===f||(Math.min(w.length,f.length)>=4&&spellingDistance(w,f)<=(Math.min(w.length,f.length)>=7?2:1))));
}
export function namedRoad(s:string):string {
  const cleaned=withoutHouse(correctAddressText(s)).replace(/\b(?:near|opposite|behind)\b/gi,',');
  return cleaned.match(/\b([\p{L}]+(?:\s+[\p{L}]+){0,3}\s+(?:road|avenue|boulevard|highway|expressway|lane))\b/iu)?.[1]||'';
}
export function localityQuery(address:string):string {
  const cleaned=correctAddressText(address),sector=sectorId(cleaned);
  if(sector)return sector;
  if(/\bdha\s+phase\b/i.test(cleaned)&&phaseId(cleaned))return 'DHA Phase '+phaseId(cleaned);
  const road=namedRoad(cleaned);
  let body=withoutHouse(cleaned).replace(/\b(?:street|st|road|rd)[-.]?\s*(?:no\.?|number|#)?\s*\d+[a-z/-]*\b/gi,'').replace(phasePattern,'');
  // Prefer a named society after a road; otherwise retain the road's name for searching.
  if(road){const after=significantWords(body.slice(body.indexOf(road)+road.length));if(after.length)body=after.join(' ');}
  const name=[...new Set(significantWords(body))].join(' ');
  return name && phaseId(cleaned) ? name+' Phase '+phaseId(cleaned) : name;
}
/** Remove unmapped subdivisions for a last-resort, explicitly disclosed neighbourhood quote. */
export function neighborhoodQuery(address:string):string {
  if(sectorId(address))return '';
  return localityQuery(address).replace(phasePattern,'').trim();
}
export function isSectorName(name:string):boolean {
  return /^(?:sector\s+)?[a-i]-\d{1,2}(?:\/\d{1,2})?$/i.test(correctAddressText(name).trim());
}
export function lookupQueries(address:string) {
  const corrected=correctAddressText(address),locality=localityQuery(corrected);
  const city=/\bislamabad\b/i.test(corrected)?'Islamabad':/\brawalpindi\b/i.test(corrected)?'Rawalpindi':'';
  const road=namedRoad(corrected);
  // Local sector identifiers often prevent a road lookup; retain them for validation and the sector search.
  const detailed=withoutHouse(corrected).replace(/\bsector\s+(?:[a-z]|\d{1,3})\b(?!\s*[-/\d])/gi,'').replace(/[,;]+/g,' ').replace(/\s+/g,' ').trim();
  const parent=sectorId(corrected)?.split('/')[0];
  const broad=parent&&parent!==locality?parent:locality;
  const requestedLetter=localSector(corrected);
  const specific=requestedLetter?`Sector ${requestedLetter} ${locality}`:locality;
  return {corrected,detailed,locality,broad,city,road,specific,neighborhood:neighborhoodQuery(corrected),localityWithCity:[broad,city].filter(Boolean).join(' ')};
}
