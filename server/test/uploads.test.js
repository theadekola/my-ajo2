import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
process.env.NODE_ENV='test';process.env.JWT_SECRET='b'.repeat(64);process.env.OTP_PEPPER='c'.repeat(64);process.env.MFA_ENCRYPTION_KEY='a'.repeat(64);
const {profileUpload,validateUploadedFile}=await import('../middleware.js');
test('Multer 2 accepts multipart PNGs and rejects mismatched image signatures',async()=>{
 const app=express();app.post('/picture',profileUpload.single('picture'),async(req,res,next)=>{try{const valid=await validateUploadedFile(req.file,{profileOnly:true});await fs.unlink(req.file.path).catch(()=>{});res.status(valid?200:400).json({valid});}catch(error){next(error);}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{for(const [buffer,status] of [[Buffer.from([137,80,78,71,13,10,26,10]),200],[Buffer.from('invalid image data'),400]]){
  const body=new FormData();body.append('picture',new Blob([buffer],{type:'image/png'}),'image.png');const response=await fetch(`http://127.0.0.1:${server.address().port}/picture`,{method:'POST',body});assert.equal(response.status,status);
 }}finally{await new Promise(resolve=>server.close(resolve));}
});
