import { useState } from 'react';
import { apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MfaSettings(){
  const {user,refreshUser,logout}=useAuth();
  const [setup,setSetup]=useState(null);
  const [code,setCode]=useState('');
  const [password,setPassword]=useState('');
  const [recoveryCodes,setRecoveryCodes]=useState([]);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const begin=async()=>{
    setBusy(true);setError('');
    try{setSetup(await apiPost('/auth/mfa/setup',{password}));}
    catch(ex){setError(ex.message);}
    finally{setBusy(false);}
  };

  const enable=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      const result=await apiPost('/auth/mfa/enable',{code});
      setRecoveryCodes(result.recoveryCodes||[]);setSetup(null);setCode('');
      setMessage('MFA is enabled. Save every recovery code now; they will not be shown again.');
      await refreshUser();
    }catch(ex){setError(ex.message);}finally{setBusy(false);}
  };

  const disable=async event=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      await apiPost('/auth/mfa/disable',{password,code});
      await logout();window.location.assign('/auth');
    }catch(ex){setError(ex.message);setBusy(false);}
  };

  return <div className="page-enter">
    <div className="topbar"><div><div className="ptitle">Multi-factor authentication</div><div className="psub">Protect sensitive account and payout actions</div></div></div>
    {error&&<div className="err-msg">{error}</div>}{message&&<div className="ok-msg">{message}</div>}
    <div className="card" style={{maxWidth:620}}>
      {!user?.MfaEnabled&&!setup&&!recoveryCodes.length&&<>
        <p>Use an authenticator app to add a second verification step to your account.</p>
        <div className="fg"><label className="fl">CURRENT PASSWORD</label><input className="fi" type="password" required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></div>
        <button className="btn btn-g" disabled={busy} onClick={begin}>{busy?'Preparing...':'Set up authenticator'}</button>
      </>}
      {setup&&<form onSubmit={enable}>
        <p>Scan this QR code with your authenticator app, then enter the generated six-digit code.</p>
        <img src={setup.qrCode} alt="Authenticator enrolment QR code" style={{display:'block',width:280,maxWidth:'100%',margin:'18px auto'}}/>
        <details><summary>Cannot scan the QR code?</summary><code style={{display:'block',overflowWrap:'anywhere',margin:'12px 0'}}>{setup.secret}</code></details>
        <div className="fg"><label className="fl">AUTHENTICATOR CODE</label><input className="fi" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event=>setCode(event.target.value)}/></div>
        <button className="btn btn-g" disabled={busy}>{busy?'Enabling...':'Verify and enable MFA'}</button>
      </form>}
      {!!recoveryCodes.length&&<>
        <h3>Recovery codes</h3><p>Store these somewhere private. Each code works once.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,margin:'18px 0'}}>{recoveryCodes.map(item=><code key={item}>{item}</code>)}</div>
        <button className="btn" onClick={()=>navigator.clipboard.writeText(recoveryCodes.join('\n'))}>Copy codes</button>
      </>}
      {user?.MfaEnabled&&!recoveryCodes.length&&<form onSubmit={disable}>
        <p>MFA is enabled. Disabling it requires your password and a current authenticator code, and signs out every device.</p>
        <div className="fg"><label className="fl">PASSWORD</label><input className="fi" type="password" required autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></div>
        <div className="fg"><label className="fl">AUTHENTICATOR CODE</label><input className="fi" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event=>setCode(event.target.value)}/></div>
        <button className="btn btn-danger" disabled={busy}>{busy?'Disabling...':'Disable MFA'}</button>
      </form>}
    </div>
  </div>;
}
