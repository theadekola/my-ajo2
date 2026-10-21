import { useState } from 'react';
import { Link,useLocation } from 'react-router-dom';
import { apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
export default function MfaActionGate({children}){
  const {user,completeMfaLogin}=useAuth();const location=useLocation();
  const [ticket,setTicket]=useState(''),[code,setCode]=useState(''),[recovery,setRecovery]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(user?.MfaEnabled&&user?.MfaVerifiedAt)return children;
  const security=`/security/mfa?returnTo=${encodeURIComponent(location.pathname)}`;
  const start=async()=>{setBusy(true);setError('');try{setTicket((await apiPost('/auth/mfa/challenge',{})).mfaTicket);}catch(ex){setError(ex.message);}finally{setBusy(false);}};
  const verify=async event=>{event.preventDefault();setBusy(true);setError('');try{await completeMfaLogin(ticket,recovery?'':code,recovery?code:'');}catch(ex){setError(ex.message);}finally{setBusy(false);}};
  return <section className="card" style={{padding:24}}><h2>Verify before managing payouts</h2>{error&&<div className="err-msg">{error}</div>}{!user?.MfaEnabled?<><p>Set up an authenticator to protect payout actions.</p><Link className="btn btn-g" to={security}>Set up account security</Link></>:!ticket?<button className="btn btn-g" disabled={busy} onClick={start}>Verify authenticator</button>:<form onSubmit={verify}><label>{recovery?'Recovery code':'Authenticator code'}<input className="fi" required autoComplete="one-time-code" value={code} onChange={event=>setCode(event.target.value)}/></label><button type="button" className="btn btn-gh" onClick={()=>{setRecovery(v=>!v);setCode('');}}>{recovery?'Use authenticator':'Use recovery code'}</button><button className="btn btn-g" disabled={busy}>{busy?'Verifying…':'Verify and continue'}</button></form>}<Link className="back-link" to="/groups">Back to groups</Link></section>;
}
