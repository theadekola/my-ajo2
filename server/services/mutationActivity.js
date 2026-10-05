import { createActivity } from './activityService.js';

const labels={auth:'Account',users:'Profile',groups:'Group',members:'Member',invites:'Invitation',contributions:'Contribution',payouts:'Payout',messages:'Message',notifications:'Notification','payment-info':'Payment information','direct-debit':'Direct debit',push:'Push notification',support:'Support ticket',paystack:'Payment'};
export function instrumentMutations(req,res,next){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  res.on('finish',()=>{
    if(res.statusCode>=400||!req.user?.userId) return;
    const moduleName=String(req.baseUrl||'').split('/').filter(Boolean).pop()||'system';
    if(moduleName==='activity') return;
    const label=labels[moduleName]||'Application';
    createActivity({eventType:`${moduleName}.${req.method.toLowerCase()}`,category:moduleName,title:`${label} updated`,description:`A ${label.toLowerCase()} action completed successfully`,userId:req.user.userId,entityType:label,severity:'info',isAdminOnly:moduleName==='users'&&req.user.systemRole==='Admin'}).catch(error=>console.warn('Mutation activity failed',error?.message||error));
  }); next();
}
