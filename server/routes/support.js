import { Router } from 'express';
import { requireAuth,rateLimit } from '../middleware.js';
import { getPool,sql } from '../db.js';
import { sendSupportMessage } from '../mailer.js';
const r=Router();r.use(requireAuth,rateLimit({windowMs:15*60*1000,max:10}));
r.post('/email',async(req,res,next)=>{
  try{
    const subject=String(req.body.subject||'My Ajo support request').trim();const message=String(req.body.message||'').trim();
    if(!subject||subject.length>200||!message||message.length>5000)return res.status(400).json({error:'Enter a subject up to 200 characters and a message up to 5000 characters'});
    const pool=await getPool();const created=await pool.request().input('uid',sql.Int,req.user.userId).input('subject',sql.NVarChar(200),subject).input('body',sql.NVarChar(sql.MAX),message)
      .query("INSERT dbo.SupportTickets(UserId,Subject,Description,Category,Status) OUTPUT INSERTED.TicketId VALUES(@uid,@subject,@body,'AppSupport','Open')");
    let emailSent=false;
    try{await sendSupportMessage({fromEmail:req.user.email,fromName:req.user.name,role:req.user.systemRole,subject,message});emailSent=true;}catch(error){console.error('Support ticket saved; email delivery failed',error.message);}
    res.status(201).json({ticketId:created.recordset[0].TicketId,emailSent});
  }catch(error){next(error);}
});
export default r;
