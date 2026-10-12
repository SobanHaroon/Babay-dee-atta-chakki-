const fs=require('fs');const file='api/catalog.ts';let s=fs.readFileSync(file,'utf8');s=s.replace(/  const stockQuantity = catalogNumber\(p.stock_quantity \?\? p.stockQuantity\);\r?\n  const legacyStockQuantity = catalogNumber\(p.quantity\);/,`  const legacyStockQuantity = catalogNumber(p.quantity);
  const explicitStock = p.stock_quantity ?? p.stockQuantity;
  const stockQuantity = explicitStock == null
    ? (saleUnit === 'kg' && legacyStockQuantity !== null ? legacyStockQuantity / 10 : null)
    : catalogNumber(explicitStock);`);fs.writeFileSync(file,s);
for(const f of ['scripts/20261011_confirm_kg_catalog.sql','scripts/database-integration.test.ts'])fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.scripts.test+=' scripts/database-integration.test.ts scripts/delivery-settings.test.ts';p.scripts['test:database']='node --import tsx --test scripts/database-integration.test.ts';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
