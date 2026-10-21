import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./fixtures/db-loader.mjs',import.meta.url);
process.env.NODE_ENV='test';process.env.JWT_SECRET='b'.repeat(64);process.env.OTP_PEPPER='c'.repeat(64);process.env.MFA_ENCRYPTION_KEY='a'.repeat(64);
const {configureDatabase}=await import('./fixtures/mockDatabase.mjs');
const {requireAuth,setAuthUserLoaderForTests,signToken}=await import('../middleware.js');
const {AUTH_COOKIE_NAME}=await import('../config.js');
const {requireSystemAccess}=await import('../utils/adminAccess.js');
const {redactActivity,canReceiveActivity}=await import('../services/activityService.js');
const messages=(await import('../routes/messages.js')).default;
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('an administrator-forced reset blocks a previously issued normal session',async()=>{
 setAuthUserLoaderForTests(async()=>({UserId:7,FirstName:'Test',LastName:'Member',SystemRole:'Member',IsActive:1,TokenVersion:1,IsEmailVerified:1,MustResetPassword:1}));
 const cookie=signToken({UserId:7,Email:'test@example.invalid',TokenVersion:1});const res=response();let allowed=false;
 await requireAuth({headers:{cookie:`${AUTH_COOKIE_NAME}=${cookie}`}},res,()=>{allowed=true;});assert.equal(allowed,false);assert.equal(res.statusCode,403);assert.equal(res.body.code,'PASSWORD_RESET_REQUIRED');
});
test('ordinary admin access consults assigned permissions and rejects ungranted sections',async()=>{
 configureDatabase({query:async()=>({recordset:[{PermissionName:'Handle support tickets'}]})});
 let called=false;let res=response();await requireSystemAccess({user:{userId:3,systemRole:'Admin'},path:'/reports',method:'GET'},res,()=>{called=true;});assert.equal(called,true);
 called=false;res=response();await requireSystemAccess({user:{userId:3,systemRole:'Admin'},path:'/users/7/action',method:'POST'},res,()=>{called=true;});assert.equal(called,false);assert.equal(res.statusCode,403);
});
test('an accessible private message cannot be quoted into the public group',async()=>{
 let inserts=0;
 configureDatabase({async query(sql,values){
  if(sql.includes('SenderRole'))return {recordset:[{SenderRole:'Member',RecipientRole:'Member',IsBlocked:0,GroupMembersAnonymous:0}]};
  if(sql.includes('SELECT MessageId FROM Messages')){
   const sourceMessageIsPrivate=true;
   return {recordset:sql.includes('IsPrivate=@private')&&Boolean(values.private)!==sourceMessageIsPrivate?[]:[{MessageId:9}]};
  }
  if(sql.includes('INSERT INTO Messages'))inserts++;return {recordset:[]};
 }});
 const handler=messages.stack.find(layer=>layer.route?.path==='/group/:groupId'&&layer.route.methods.post).route.stack.at(-1).handle;
 const res=response();await handler({params:{groupId:'2'},body:{body:'Quote',isPrivate:false,replyToMessageId:9},user:{userId:7}},res,error=>{throw error;});assert.equal(res.statusCode,400);assert.equal(inserts,0);
});
test('anonymous activity projection removes names and IDs for another member only',()=>{
 const event={UserId:7,Title:'A named person paid',Description:'Private identity',RelatedEntityId:9,RelatedEntityType:'Contribution'};
 const redacted=redactActivity(event,3,{anonymous:true});assert.equal(redacted.UserId,null);assert.equal(redacted.Title,'Group activity');assert.equal(redacted.RelatedEntityId,null);
 assert.equal(redactActivity(event,7,{anonymous:true}),event);assert.equal(redactActivity(event,3,{anonymous:true,groupAdmin:true}),event);
 assert.equal(canReceiveActivity({...event,IsAdminOnly:true},{systemRole:'Admin',userId:3}),false);
});
