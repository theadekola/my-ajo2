import { sql, getPool } from '../db.js';
const READ={users:'Manage users',groups:'Review groups',transactions:'Review transactions',security:'Review security alerts','audit-logs':'View audit logs',support:'Handle support tickets',reports:'Handle support tickets'};
export function requiredPermission(path,method){
  const section=path.split('/').filter(Boolean)[0];
  if(['access','overview'].includes(section))return null;
  if(section==='groups'&&method!=='GET')return 'Suspend groups';
  return READ[section]||'SuperAdmin';
}
export async function requireSystemAccess(req,res,next){
  if(req.user.systemRole==='SuperAdmin')return next();
  if(req.user.systemRole!=='Admin')return res.status(403).json({error:'Administrator access required'});
  const result=await (await getPool()).request().input('uid',sql.Int,req.user.userId).query('SELECT PermissionName FROM dbo.AdminPermissions WHERE AdminUserId=@uid');
  req.adminPermissions=result.recordset.map(row=>row.PermissionName);
  const permission=requiredPermission(req.path,req.method);
  if(permission&&!req.adminPermissions.includes(permission)&&!(req.method==='GET'&&permission==='Review groups'&&req.adminPermissions.includes('Suspend groups')))return res.status(403).json({error:'Your administrator account does not have permission for this action'});
  next();
}
