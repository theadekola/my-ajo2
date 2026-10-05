import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { requireAuth } from '../middleware.js';
import { cacheGet, cacheSet } from '../services/redisService.js';
import { APP_KNOWLEDGE } from '../knowledge/appKnowledge.js';

const r=Router(); r.use(requireAuth);
const formatCurrencyAmount=(value,currency='NGN')=>{
  const currencyCode=String(currency||'NGN').trim().toUpperCase();
  try{
    return new Intl.NumberFormat('en-NG',{style:'currency',currency:currencyCode,minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value||0));
  }catch{
    return `₦${Number(value||0).toLocaleString('en-NG',{maximumFractionDigits:2})}`;
  }
};
const guideFallback=question=>{
  const q=question.toLowerCase();
  if(q.includes('what is my ajo')||q.includes('how is my ajo')||q.includes('about my ajo')) return 'My Ajo is an app for organising rotating savings groups. It helps members and admins manage groups, contribution evidence, confirmations, payout schedules, bank details, calendars, chat, notifications and activity records. My Ajo tracks and coordinates payments; it does not hold or insure users’ money.';
  if(q.includes('create')&&q.includes('group')) return 'To create a group, open Groups and choose Create Group. Enter the group name, contribution amount, frequency, maximum members and start date, then review and save it. After creation, open the group to configure Payment Info and invite members. Group creation is available to eligible admin accounts.';
  if(q.includes('owe')||q.includes('due this')||q.includes('performing best')||q.includes('compare this')) return 'I cannot safely calculate that account-specific answer while the AI analysis service is unavailable. You can review Contributions, Calendar and Group Statistics, or try again shortly.';
  if(q.includes('join')) return 'Open Groups > Join Group, enter the invite code, review the group details, submit your request, then wait for the group admin to approve it.';
  if(q.includes('contribut')||q.includes('payment')) return 'Open Groups > select the group > Make Payment. Verify the payment information, enter the amount, upload genuine transfer evidence and submit it for admin confirmation.';
  if(q.includes('payout')||q.includes('bank detail')) return 'Members manage their payout account under the selected group > My Bank Details. Admins manage transfers under Disbursement and should mark a payout paid only after sending the funds.';
  if(q.includes('install')||q.includes('iphone')||q.includes('android')) return 'Open More > Install App. On iPhone use Safari > Share > Add to Home Screen. On Android use Chrome > menu > Install App or Add to Home Screen.';
  if(q.includes('notification')) return 'Open More > Settings to manage payment, payout, member and chat notifications. Use the bell in the header to read notifications.';
  if(q.includes('profile')) return 'Open More > Profile. Use Overview for your account summary and Personal Info to review or edit your details.';
  if(q.includes('support')||q.includes('help')) return 'Open More > Support for FAQs, the User Guide, privacy and terms. To contact support, choose Email Support or write to support@my-ajo.org.';
  return 'I can help with My Ajo navigation, groups, contributions, payouts, bank details, calendar, notifications, profile, installation, privacy and support. Please ask about the specific page or task you need.';
};

r.get('/search',async(req,res)=>{
  const q=String(req.query.q||'').trim().slice(0,80);
  if(q.length<2) return res.json({query:q,items:[]});
  const key=`search:${req.user.userId}:${q.toLowerCase()}`;
  const cached=await cacheGet(key); if(cached) return res.json(cached);
  const pool=await getPool(); const request=pool.request().input('uid',sql.Int,req.user.userId).input('q',sql.NVarChar(90),`%${q}%`);
  const result=await request.query(`
    SELECT TOP 8 'group' AS Type,CAST(g.GroupId AS NVARCHAR(30)) AS Id,g.GroupName AS Title,g.Status AS Subtitle,'/group/'+CAST(g.GroupId AS NVARCHAR(30)) AS Link
    FROM AjoGroups g WHERE g.GroupName LIKE @q AND (${req.user.systemRole==='Admin'?'1=1':"g.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved')"})
    UNION ALL
    SELECT TOP 8 'contribution',CAST(c.ContributionId AS NVARCHAR(30)),u.FirstName+' '+u.LastName+' contribution',g.GroupName+' · '+CAST(c.Amount AS NVARCHAR(40)),'/contributions'
    FROM Contributions c JOIN Users u ON u.UserId=c.UserId JOIN AjoGroups g ON g.GroupId=c.GroupId
    WHERE (u.FirstName+' '+u.LastName LIKE @q OR g.GroupName LIKE @q OR CAST(c.Amount AS NVARCHAR(40)) LIKE @q)
      AND (${req.user.systemRole==='Admin'?'1=1':"c.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved')"})
    ${req.user.systemRole==='Admin'?"UNION ALL SELECT TOP 8 'user',CAST(UserId AS NVARCHAR(30)),FirstName+' '+LastName,Email,'/more' FROM Users WHERE FirstName+' '+LastName LIKE @q OR Email LIKE @q":''}`);
  const payload={query:q,items:result.recordset}; await cacheSet(key,payload,20); res.json(payload);
});

r.get('/summary',async(req,res)=>{
  const key=`summary:${req.user.userId}`; const cached=await cacheGet(key); if(cached) return res.json(cached);
  const pool=await getPool(); const result=await pool.request().input('uid',sql.Int,req.user.userId).query(`SELECT TOP 50 EventType,Category,Title,Description,Amount,Currency,CreatedAt FROM ActivityEvents e WHERE e.CreatedAt>=DATEADD(day,-1,SYSUTCDATETIME()) AND (${req.user.systemRole==='Admin'?'1=1':"e.IsAdminOnly=0 AND (e.UserId=@uid OR e.IsPublic=1 OR e.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved'))"}) ORDER BY CreatedAt DESC`);
  const events=result.recordset; const total=events.reduce((s,e)=>s+Number(e.Amount||0),0);
  const currency=events.find(event=>event.Amount!=null&&event.Currency)?.Currency||'NGN';
  let text=events.length?`${events.length} activities were recorded in the last 24 hours${total?`, involving ${formatCurrencyAmount(total,currency)} in recorded amounts`:''}.`:'No significant activity was recorded in the last 24 hours.';
  let source='calculated';
  if(process.env.OPENAI_API_KEY && events.length){
    try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_SUMMARY_MODEL||'gpt-5-mini',instructions:'Summarize this savings-app activity in 3 concise bullets. Do not invent facts or expose identifiers.',input:JSON.stringify(events.slice(0,30)),max_output_tokens:220})}); if(response.ok){const data=await response.json(); if(data.output_text){text=data.output_text;source='openai';}}}catch(error){console.warn('AI summary fallback used',error?.message||error);}
  }
  const payload={text,source,generatedAt:new Date().toISOString()}; await cacheSet(key,payload,60); res.json(payload);
});
r.post('/ask',async(req,res)=>{
  const question=String(req.body?.question||'').trim().slice(0,500);
  const history=Array.isArray(req.body?.history)?req.body.history.slice(-8).map(item=>({role:item?.role==='ai'?'assistant':'user',text:String(item?.text||'').slice(0,1000)})).filter(item=>item.text):[];
  if(!question) return res.status(400).json({error:'Enter a question'});
  const pool=await getPool();
  const scope=req.user.systemRole==='Admin'?'1=1':"g.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved')";
  const visibleMemberName=req.user.systemRole==='Admin'
    ? "u.FirstName+' '+u.LastName"
    : `CASE WHEN g.GroupMembersAnonymous=1 AND gm.UserId<>@uid AND gm.Role<>'Admin'
             AND NOT EXISTS(SELECT 1 FROM GroupMembers viewer WHERE viewer.GroupId=g.GroupId AND viewer.UserId=@uid AND viewer.Status='Approved' AND viewer.Role='Admin')
            THEN 'Anonymous Member' ELSE u.FirstName+' '+u.LastName END`;
  const facts=await pool.request().input('uid',sql.Int,req.user.userId).query(`
    SELECT TOP 50 g.GroupName,${visibleMemberName} MemberName,g.ContributionAmount Expected,c.Amount,c.Status,c.PaidAt
    FROM GroupMembers gm JOIN AjoGroups g ON g.GroupId=gm.GroupId JOIN Users u ON u.UserId=gm.UserId
    LEFT JOIN Contributions c ON c.GroupId=g.GroupId AND c.UserId=u.UserId AND c.CycleNumber=g.CurrentCycle WHERE ${scope};
    SELECT TOP 30 g.GroupName,u.FirstName+' '+u.LastName Recipient,p.Amount,p.Status,p.ScheduledFor
    FROM Payouts p JOIN AjoGroups g ON g.GroupId=p.GroupId JOIN Users u ON u.UserId=p.RecipientId WHERE ${scope} ORDER BY p.ScheduledFor;
    SELECT g.GroupName,COUNT(CASE WHEN c.Status='Confirmed' THEN 1 END) Confirmed,COUNT(c.ContributionId) Total,
      ISNULL(SUM(CASE WHEN c.Status='Confirmed' THEN c.Amount ELSE 0 END),0) Collected
    FROM AjoGroups g LEFT JOIN Contributions c ON c.GroupId=g.GroupId WHERE ${scope} GROUP BY g.GroupName;
    SELECT UserId,FirstName,LastName,Email,SystemRole,CountryCode,CurrencyCode,CurrencySymbol,IsEmailVerified,CreatedAt
    FROM Users WHERE UserId=@uid;
    SELECT TOP 30 e.EventType,e.Category,e.Title,e.Description,e.Amount,e.Currency,e.CreatedAt,g.GroupName
    FROM ActivityEvents e LEFT JOIN AjoGroups g ON g.GroupId=e.GroupId
    WHERE e.IsAdminOnly=0 AND (e.UserId=@uid OR e.IsPublic=1 OR e.GroupId IN(SELECT GroupId FROM GroupMembers WHERE UserId=@uid AND Status='Approved'))
    ORDER BY e.CreatedAt DESC;`);
  const context={contributions:facts.recordsets[0],payouts:facts.recordsets[1],groups:facts.recordsets[2],user:facts.recordsets[3]?.[0]||{},recentActivity:facts.recordsets[4]||[]};
  if(!process.env.OPENAI_API_KEY) return res.json({answer:guideFallback(question),source:'guide-fallback'});
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_SUMMARY_MODEL||'gpt-5-mini',instructions:`You are My Ajo AI, the in-app product and account assistant. Follow this authoritative app knowledge:\n${APP_KNOWLEDGE}`,input:`Recent conversation: ${JSON.stringify(history)}\nCurrent question: ${question}\nAUTHORIZED USER DATA: ${JSON.stringify(context)}`,max_output_tokens:900})});
    const data=await response.json(); if(!response.ok) throw new Error(data?.error?.message||'AI request failed');
    res.json({answer:data.output_text||'No answer was generated.',source:'openai'});
  }catch(error){console.error('Ask AI failed',error?.message||error);res.json({answer:guideFallback(question),source:'guide-fallback'});}
});
export default r;
