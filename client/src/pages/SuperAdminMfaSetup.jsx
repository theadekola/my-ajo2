import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon from '../components/SvgIcon.jsx';

export default function SuperAdminMfaSetup(){
  const {user,refreshUser,logout}=useAuth(); const navigate=useNavigate();
  const [password,setPassword]=useState(''); const [setup,setSetup]=useState(null); const [code,setCode]=useState('');
  const [recoveryCodes,setRecoveryCodes]=useState([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const start=async e=>{e.preventDefault();setBusy(true);setError('');try{setSetup(await apiPost('/auth/mfa/setup',{password}));setPassword('');}catch(ex){setError(ex.message);}finally{setBusy(false);}};
  const verify=async e=>{e.preventDefault();setBusy(true);setError('');try{const result=await apiPost('/auth/mfa/enable',{code});setRecoveryCodes(result.recoveryCodes||[]);setSetup(null);await refreshUser();}catch(ex){setError(ex.message);}finally{setBusy(false);}};
  const download=()=>{const blob=new Blob([recoveryCodes.join('\r\n')+'\r\n'],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='my-ajo-superadmin-recovery-codes.txt';a.click();URL.revokeObjectURL(url);};
  const signOut=async()=>{await logout();navigate('/');};
  if(user?.MfaEnabled&&!recoveryCodes.length) return <section className="sa-page"><div className="sa-mfa-card"><h1>MFA is enabled</h1><p>Your protected SuperAdmin account is ready.</p><button className="btn btn-g" onClick={()=>navigate('/system-admin')}>Open System Overview</button></div></section>;
  return <section className="sa-page"><div className="sa-mfa-card"><div className="sa-mfa-icon"><SvgIcon name="shield" size={30}/></div><h1>Secure your Super Admin account</h1><p>Multi-factor authentication is required before you can access administrative data and controls.</p>{error&&<div className="err-msg">{error}</div>}
    {!setup&&!recoveryCodes.length&&<form onSubmit={start}><div className="fg"><label className="fl">RE-ENTER ACCOUNT PASSWORD</label><input className="fi" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="sa-mfa-actions"><button className="btn btn-g" disabled={busy}>{busy?'Preparing…':'Continue to MFA setup'}</button><button type="button" className="btn btn-gh" onClick={signOut}>Sign out</button></div></form>}
    {setup&&<form onSubmit={verify}><p>Scan this QR code using Microsoft Authenticator, Google Authenticator, or Authy. Then enter the current six-digit code.</p><img className="sa-mfa-qr" src={setup.qrCode} alt="MFA authenticator QR code"/><details><summary>Cannot scan the QR code?</summary><code>{setup.secret}</code></details><div className="fg"><label className="fl">SIX-DIGIT CODE</label><input className="fi" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></div><button className="btn btn-g" disabled={busy||code.length!==6}>{busy?'Verifying…':'Verify and enable MFA'}</button></form>}
    {!!recoveryCodes.length&&<div><h2>Save your recovery codes</h2><p>These codes are displayed only once. Each code can be used one time if your authenticator is unavailable.</p><div className="sa-recovery-codes">{recoveryCodes.map(item=><code key={item}>{item}</code>)}</div><div className="sa-mfa-actions"><button className="btn btn-gh" onClick={download}>Download codes</button><button className="btn btn-g" onClick={()=>navigate('/system-admin')}>I saved them — open Overview</button></div></div>}
  </div></section>;
}
