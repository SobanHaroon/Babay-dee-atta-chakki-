const fs=require('node:fs');let f='api/addressDelivery.ts',s=fs.readFileSync(f,'utf8');
s=s.replace('const matches:AddressMatch[]=[];', 'const matches:AddressMatch[]=[];let providerFailure:DeliveryQuoteError|undefined;');
s=s.replace("    const candidates=cached&&cached.until>Date.now()?cached.matches:await geoapifySearch(query.text,key,settings,query.stage,requestId,budget);", `    let candidates:AddressMatch[];
    try {candidates=cached&&cached.until>Date.now()?cached.matches:await geoapifySearch(query.text,key,settings,query.stage,requestId,budget);}
    catch(error){
      if(error instanceof DeliveryQuoteError&&['PROVIDER_TIMEOUT','PROVIDER_UNAVAILABLE'].includes(error.code)){
        providerFailure=error;if(budget.aborted)break;continue;
      }
      throw error;
    }`);
s=s.replace("if(!unique.length)throw new DeliveryQuoteError(", "if(!unique.length&&providerFailure)throw providerFailure;\n  if(!unique.length)throw new DeliveryQuoteError(");fs.writeFileSync(f,s);
f='scripts/verify-checkout.mjs';s=fs.readFileSync(f,'utf8');s=s.replace("if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);", "if(m.method==='Runtime.exceptionThrown'){errors.push(m.params.exceptionDetails);console.error(JSON.stringify(m.params.exceptionDetails));}");fs.writeFileSync(f,s);
