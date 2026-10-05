import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { profileUpload, requireAdmin, requireAuth, requireVerifiedEmail, validateUploadedFile } from '../middleware.js';
import { encryptValue } from '../utils/fieldCrypto.js';
import { cacheGet, cacheSet } from '../services/redisService.js';

const r = Router();
r.use(requireAuth);

r.post('/me/organizer-application', requireVerifiedEmail, async (req,res) => {
  const pool=await getPool();
  const result=await pool.request().input('id',sql.Int,req.user.userId)
    .query(`UPDATE Users SET OrganizerStatus='Pending',CanCreateGroups=0,UpdatedAt=SYSUTCDATETIME()
            WHERE UserId=@id AND OrganizerStatus IN ('NotApplied','Rejected') AND IsActive=1`);
  if(!result.rowsAffected?.[0]) return res.status(409).json({error:'An organiser application is already active or unavailable'});
  const current=await pool.request().input('id',sql.Int,req.user.userId).query('SELECT OrganizerStatus,CanCreateGroups FROM dbo.Users WHERE UserId=@id');
  res.json(current.recordset[0]);
});

r.patch('/:userId/organizer-status', requireAdmin, async (req,res) => {
  const status=String(req.body?.status||'');
  if(!['Pending','Approved','Rejected','Suspended'].includes(status)) return res.status(400).json({error:'Invalid organiser status'});
  const pool=await getPool();
  const result=await pool.request().input('id',sql.Int,parseInt(req.params.userId,10)).input('status',sql.NVarChar,status)
    .query(`UPDATE Users SET OrganizerStatus=@status,CanCreateGroups=CASE WHEN @status='Approved' THEN 1 ELSE 0 END,
            TokenVersion=TokenVersion+1,UpdatedAt=SYSUTCDATETIME()
            WHERE UserId=@id AND IsActive=1`);
  if(!result.rowsAffected?.[0]) return res.status(404).json({error:'User not found'});
  const current=await pool.request().input('id',sql.Int,parseInt(req.params.userId,10)).query('SELECT UserId,OrganizerStatus,CanCreateGroups FROM dbo.Users WHERE UserId=@id');
  res.json(current.recordset[0]);
});

r.put('/me/bank-details', async (req,res) => {
  try {
    const {bankName,bankAccountNumber,bankAccountName,bankRoutingCode}=req.body||{};
    if(![bankName,bankAccountNumber,bankAccountName].every(value=>String(value||'').trim())) return res.status(400).json({error:'Bank name, account number, and account name are required'});
    const pool=await getPool();
    await pool.request().input('id',sql.Int,req.user.userId)
      .input('bn',sql.NVarChar,encryptValue(String(bankName).trim()))
      .input('ba',sql.NVarChar,encryptValue(String(bankAccountNumber).trim()))
      .input('bna',sql.NVarChar,encryptValue(String(bankAccountName).trim()))
      .input('br',sql.NVarChar,encryptValue(String(bankRoutingCode||'').trim()))
      .query('UPDATE Users SET BankName=@bn,BankAccountNumber=@ba,BankAccountName=@bna,BankRoutingCode=@br,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id');
    res.json({saved:true});
  } catch(error) { console.error(error); res.status(500).json({error:'Bank details update failed'}); }
});

r.put('/me/notification-settings', async (req,res) => {
  try {
    const { notifPayment, notifPayout, notifMember, notifChat } = req.body || {};
    const pool = await getPool();
    await pool.request()
      .input('id',sql.Int,req.user.userId)
      .input('np',sql.Bit,notifPayment !== undefined ? !!notifPayment : true)
      .input('no',sql.Bit,notifPayout !== undefined ? !!notifPayout : true)
      .input('nm',sql.Bit,notifMember !== undefined ? !!notifMember : true)
      .input('nc',sql.Bit,notifChat !== undefined ? !!notifChat : true)
      .query(`UPDATE Users SET
              NotifPayment=@np,NotifPayout=@no,NotifMember=@nm,NotifChat=@nc,
              UpdatedAt=SYSUTCDATETIME()
              WHERE UserId=@id`);
    res.json({ updated:true });
  } catch(e){ console.error(e); res.status(500).json({ error:'Notification settings update failed' }); }
});

r.put('/me', async (req,res) => {
  try {
    const { firstName,lastName,title,phone,sex,dateOfBirth,address,occupation,
            countryCode,currencyCode,currencySymbol,
            language,avatarColor,bio,
            bankName,bankAccountNumber,bankAccountName,bankRoutingCode,
            notifPayment,notifPayout,notifMember,notifChat } = req.body;

    const required = { firstName,lastName,title,phone,sex,address,occupation };
    const missing = Object.entries(required)
      .filter(([,value]) => !String(value || '').trim())
      .map(([key]) => key);
    if (missing.length) {
      return res.status(400).json({ error:'Complete all required profile fields', code:'PROFILE_REQUIRED', fields:missing });
    }
const pool = await getPool();
    await pool.request()
      .input('id',sql.Int,req.user.userId)
      .input('fn',sql.NVarChar,String(firstName).trim()).input('ln',sql.NVarChar,String(lastName).trim())
      .input('ti',sql.NVarChar,String(title).trim()).input('ph',sql.NVarChar,encryptValue(String(phone).trim()))
      .input('sx',sql.NVarChar,String(sex).trim()).input('ad',sql.NVarChar,encryptValue(String(address).trim()))
      .input('oc',sql.NVarChar,String(occupation).trim())
      .input('cc',sql.NVarChar,countryCode || 'NG')
      .input('cu',sql.NVarChar,currencyCode || 'NGN')
      .input('cs',sql.NVarChar,currencySymbol || '\u20A6')
      .input('la',sql.NVarChar,language||'English')
      .input('av',sql.NVarChar,avatarColor||'#2D5040').input('bi',sql.NVarChar,bio||null)
      .input('db',sql.Date,dateOfBirth || null)
      .input('bn',sql.NVarChar,encryptValue(bankName)).input('ba',sql.NVarChar,encryptValue(bankAccountNumber))
      .input('bna',sql.NVarChar,encryptValue(bankAccountName)).input('br',sql.NVarChar,encryptValue(bankRoutingCode))
      .input('np',sql.Bit,notifPayment!==undefined?notifPayment:1)
      .input('no',sql.Bit,notifPayout!==undefined?notifPayout:1)
      .input('nm',sql.Bit,notifMember!==undefined?notifMember:1)
      .input('nc',sql.Bit,notifChat!==undefined?notifChat:1)
      .query(`UPDATE Users SET FirstName=@fn,LastName=@ln,Title=@ti,Phone=@ph,Sex=@sx,
              Address=@ad,Occupation=@oc,CountryCode=@cc,CurrencyCode=@cu,CurrencySymbol=@cs,
              Language=@la,AvatarColor=@av,Bio=@bi,DateOfBirth=@db,
              BankName=@bn,BankAccountNumber=@ba,BankAccountName=@bna,BankRoutingCode=@br,
              NotifPayment=@np,NotifPayout=@no,NotifMember=@nm,NotifChat=@nc,
              UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id`);
    res.json({ updated:true });
  } catch(e){ console.error(e); res.status(500).json({ error:'Update failed' }); }
});

r.post('/me/picture', profileUpload.single('picture'), async (req,res) => {
  try {
    if (!req.file) return res.status(400).json({ error:'No file' });
    const isImage = String(req.file.mimetype || '').startsWith('image/') && /\.(jpe?g|png|webp|heic|heif)$/i.test(req.file.originalname || req.file.filename || '');
    if (!isImage || !await validateUploadedFile(req.file,{profileOnly:true})) return res.status(400).json({ error:'Upload a valid profile image' });
    const url = `/profile-pictures/${req.file.filename}`;
    const pool = await getPool();
    await pool.request().input('id',sql.Int,req.user.userId).input('u',sql.NVarChar,url)
      .query('UPDATE Users SET ProfilePicture=@u,UpdatedAt=SYSUTCDATETIME() WHERE UserId=@id');
    res.json({ url });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error:'Profile picture update failed' });
  }
});

r.get('/dashboard', async (req,res) => {
  const cacheKey=`dashboard:user:${req.user.userId}`;
  const cached=await cacheGet(cacheKey);
  if(cached) return res.json(cached);
  const pool = await getPool();
  const result = await pool.request().input('uid',sql.Int,req.user.userId).query(`
    SELECT
      (SELECT ISNULL(SUM(Amount),0) FROM Contributions WHERE UserId=@uid AND Status='Confirmed') AS TotalContributed,
      (SELECT ISNULL(SUM(Amount),0) FROM Payouts WHERE RecipientId=@uid AND Status='Paid') AS TotalReceived,
      (SELECT COUNT(*) FROM GroupMembers WHERE UserId=@uid AND Status='Approved') AS ActiveGroups,
      (SELECT COUNT(*) FROM Notifications WHERE UserId=@uid AND IsRead=0) AS UnreadNotifications,
      (SELECT TOP 1 gm.PayoutDate
         FROM GroupMembers gm
        WHERE gm.UserId=@uid AND gm.Status='Approved'
          AND gm.PayoutDate >= CAST(SYSUTCDATETIME() AS date)
        ORDER BY gm.PayoutDate) AS NextPayoutDate,
      (SELECT TOP 1 g.GroupName
         FROM GroupMembers gm
         JOIN AjoGroups g ON g.GroupId=gm.GroupId
        WHERE gm.UserId=@uid AND gm.Status='Approved'
          AND gm.PayoutDate >= CAST(SYSUTCDATETIME() AS date)
        ORDER BY gm.PayoutDate) AS NextPayoutGroup`);
  const dashboard=result.recordset[0];
  await cacheSet(cacheKey,dashboard,Number(process.env.REDIS_CACHE_TTL_SECONDS||30));
  res.json(dashboard);
});

export default r;
