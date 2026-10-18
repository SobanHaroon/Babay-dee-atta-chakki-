import 'dotenv/config';
import {databaseClients} from '../server/database.js';
import {databaseStaffQueue,dispatchStaffNotification} from '../server/staffNotifications.js';
const args=process.argv.slice(2),orderId=args[0]==='--order-id'?args[1]:undefined;
if(!(orderId&&/^BDEC-[a-f0-9]{32}$/.test(orderId))&&!(args.length===1&&args[0]==='--batch')){
 console.error('Use --order-id BDEC-<32 hex characters> or --batch. This sends queued STORE alerts.');process.exit(1);
}
const queue=databaseStaffQueue(databaseClients().privileged),results=[];
for(let i=0;i<(orderId?1:3);i++){
 const result=await dispatchStaffNotification(queue,{orderId});results.push(result);if(result!=='sent')break;
}
console.log(JSON.stringify({results}));if(results.includes('deferred'))process.exitCode=1;
