const fs=require('fs');
const f='scripts/verify-local-catalog.mjs';let s=fs.readFileSync(f,'utf8');s=s.replace("const profile=",`const apiResponse=await fetch('http://127.0.0.1:3000/api/products');
assert.equal(apiResponse.status,200);const catalog=await apiResponse.json();
assert.equal(catalog.find(p=>p.id==='4').unit,'Kg');assert.equal(catalog.find(p=>p.id==='4').purchasable,true);
assert.equal(catalog.find(p=>p.id==='5').outOfStock,true);
assert.ok(catalog.every(p=>p.unit==='Kg'));assert.ok(catalog.some(p=>p.purchasable));
const profile=`).replace("assert.equal(body.includes('The catalog could not be loaded'),false);","assert.equal(body.includes('The catalog could not be loaded'),false);assert.doesNotMatch(body,/SALE DETAILS UNCONFIRMED|Unit unconfirmed|DETAILS NEED CONFIRMATION/);assert.match(body,/OUT OF STOCK/);");fs.writeFileSync(f,s);
const g='scripts/frontend-audit.test.ts';s=fs.readFileSync(g,'utf8').replace('availableBundle, cartFromProduct,','availableBundle, hasUnconfirmedSaleDetails, cartFromProduct,');s+=`\ntest('variant descriptions do not mislabel confirmed out-of-stock products',()=>{\n assert.equal(hasUnconfirmedSaleDetails(product('1','Rice',{outOfStock:true,catalogIssues:['variant_description_needed']})),false);\n assert.equal(hasUnconfirmedSaleDetails(product('2','Pack',{catalogIssues:['unconfirmed_pack_weight']})),true);\n});\n`;fs.writeFileSync(g,s);
