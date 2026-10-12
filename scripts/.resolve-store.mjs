const response=await fetch('https://maps.app.goo.gl/XYR14ymesAJdSA1v5',{redirect:'follow',signal:AbortSignal.timeout(30000)});
console.log(JSON.stringify({status:response.status,url:response.url}));
