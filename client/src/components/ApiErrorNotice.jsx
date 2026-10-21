import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
export default function ApiErrorNotice(){
  const [error,setError]=useState('');const [loading,setLoading]=useState(false);const location=useLocation();
  useEffect(()=>{setError('');},[location.pathname]);
  useEffect(()=>{const fail=event=>setError(event.detail?.message||'Some information could not load.');window.addEventListener('myajo:api-error',fail);return()=>window.removeEventListener('myajo:api-error',fail);},[]);
  useEffect(()=>{const update=event=>setLoading(event.detail.active>0);window.addEventListener('myajo:api-loading',update);return()=>window.removeEventListener('myajo:api-loading',update);},[]);
  return error?<div className="err-msg" role="alert">{error} <button type="button" className="btn btn-gh btn-sm" onClick={()=>window.location.reload()}>Retry page</button> <button type="button" aria-label="Dismiss error" onClick={()=>setError('')}>Close</button></div>:loading?<div role="status" aria-live="polite" style={{padding:'6px 0',color:'var(--muted)',fontSize:12}}>Loading…</div>:null;
}
