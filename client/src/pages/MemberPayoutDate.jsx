import { useEffect, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { Link, useParams } from 'react-router-dom';
import { apiAssetUrl, apiGet } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchPrivateFile, isNativeApp, saveBlobToDevice } from '../utils/nativeActions.js';

const showDate = value => value ? new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}) : 'Not assigned yet';

export default function MemberPayoutDate() {
  const { id } = useParams();
  const { fmt, showToast } = useAuth();
  const [data,setData] = useState({payouts:[]});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [evidenceViewer,setEvidenceViewer] = useState(null);
  const [openingEvidenceId,setOpeningEvidenceId] = useState(null);
  const [savingEvidence,setSavingEvidence] = useState(false);

  useEffect(()=>{
    apiGet('/payouts/member/'+id).then(result=>setData({...result,payouts:Array.isArray(result.payouts)?result.payouts:[]})).catch(err=>setError(err.message||'Could not load payout information.')).finally(()=>setLoading(false));
  },[id]);

  useEffect(()=>()=>{if(evidenceViewer?.previewUrl)URL.revokeObjectURL(evidenceViewer.previewUrl);},[evidenceViewer?.previewUrl]);

  const openEvidence=async payout=>{
    setOpeningEvidenceId(payout.PayoutId);
    try{
      const file=await fetchPrivateFile(apiAssetUrl(payout.EvidenceUrl),`payout-${payout.PayoutId}`);
      const kind=file.contentType.startsWith('image/')?'image':file.contentType==='application/pdf'?'pdf':'file';
      setEvidenceViewer({...file,kind,native:isNativeApp(),previewUrl:URL.createObjectURL(file.blob)});
    }catch(err){showToast(err.message||'Could not open payment evidence.','error');}
    finally{setOpeningEvidenceId(null);}
  };

  const saveEvidence=async()=>{
    if(!evidenceViewer?.blob)return;
    setSavingEvidence(true);
    try{const name=await saveBlobToDevice(evidenceViewer.blob,evidenceViewer.fileName);showToast(`Evidence saved: ${name}`);}
    catch(err){showToast(err.message||'Could not save payment evidence.','error');}
    finally{setSavingEvidence(false);}
  };

  if(loading) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Loading payout information...</div>;

  return (
    <div className="page-enter">
      <div className="topbar"><div><Link to={'/group/'+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link><div className="ptitle">Payout Date</div><div className="psub">{data.groupName||'Your group'}  -  Slot #{data.slotNumber||'-'}</div></div></div>
      {error ? <div className="err-msg">{error}</div> : null}
      <div className="card" style={{padding:22,marginBottom:20,textAlign:'center',background:'linear-gradient(135deg,var(--deep),var(--forest))'}}>
        <div style={{fontSize:12,fontWeight:700,letterSpacing:1,color:'rgba(255,255,255,.6)',marginBottom:8}}>YOUR ASSIGNED PAYOUT DATE</div>
        <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:'clamp(24px,6vw,34px)',fontWeight:800,color:'var(--gold)'}}>{showDate(data.assignedDate)}</div>
        {!data.assignedDate ? <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:8}}>Your group admin has not assigned your payout date.</div> : null}
      </div>
      <div className="card">
        <div className="card-hd"><div><div className="card-ttl">Payout Information</div><div className="card-sub">Payments recorded by your group admin</div></div><span className="badge b-gray">{data.payouts.length}</span></div>
        {data.payouts.map(payout=>(
          <div className="row" key={payout.PayoutId} style={{alignItems:'flex-start'}}>
            <div className="row-ic" style={{background:payout.Status==='Paid'?'rgba(46,125,50,.12)':'rgba(255,193,7,.1)'}}><SvgIcon name={payout.Status==='Paid' ? 'check' : 'clock'} size={18} /></div>
            <div style={{flex:1,minWidth:0}}>
              <div className="row-name">{payout.Status==='Paid'?'Payout received':'Scheduled payout'}</div>
              <div className="row-sub">Cycle {payout.CycleNumber}  -  {showDate(payout.PaidAt||payout.ScheduledFor)}</div>
              <div className="row-sub">Recorded by {payout.AdminName||'Group admin'}</div>
              {payout.Note ? <div style={{fontSize:12,color:'var(--muted)',marginTop:5}}>Note: {payout.Note}</div> : null}
              {payout.EvidenceUrl ? <button type="button" className="back-link" style={{display:'inline-block',fontSize:12,marginTop:7,border:0,background:'transparent',padding:0}} disabled={openingEvidenceId===payout.PayoutId} onClick={()=>openEvidence(payout)}>{openingEvidenceId===payout.PayoutId?'Opening evidence...':'View payment evidence'}</button> : null}
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontWeight:800,color:'var(--deep)'}}>{fmt(payout.TotalPayout??payout.Amount)}</div>
              {Number(payout.AdminCharge)>0 ? <div style={{fontSize:10,color:'var(--muted)'}}>Charge: {fmt(payout.AdminCharge)}</div> : null}
              <span className={'badge '+(payout.Status==='Paid'?'b-green':'b-gold')} style={{marginTop:5}}>{payout.Status}</span>
            </div>
          </div>
        ))}
        {!data.payouts.length ? <div style={{padding:30,textAlign:'center',color:'var(--muted)',fontSize:13}}>No payout payment has been recorded yet.</div> : null}
      </div>
      {evidenceViewer&&<div className="modal-ov open modal-ov-center evidence-modal-overlay" onClick={event=>event.target===event.currentTarget&&setEvidenceViewer(null)}>
        <div className="modal evidence-modal" role="dialog" aria-modal="true" aria-label="Payment evidence">
          <div style={{marginBottom:12}}><div className="modal-ttl" style={{marginBottom:2}}>Payment Evidence</div><div className="row-sub evidence-file-name">{evidenceViewer.fileName}</div></div>
          <div className="evidence-preview">
            {evidenceViewer.kind==='image'?<img src={evidenceViewer.previewUrl} alt="Payment evidence"/>:evidenceViewer.kind==='pdf'&&!evidenceViewer.native?<iframe title="Payment evidence" src={evidenceViewer.previewUrl}/>:<div className="evidence-file-placeholder"><SvgIcon name="receipt" size={34}/><strong>{evidenceViewer.kind==='pdf'?'PDF payment evidence':'Payment evidence file'}</strong><span>The file stays inside My Ajo. Tap Save to keep a copy on this device.</span></div>}
          </div>
          <div className="evidence-modal-actions"><button type="button" className="btn btn-gh" onClick={()=>setEvidenceViewer(null)}>Close</button><button type="button" className="btn btn-g" onClick={saveEvidence} disabled={savingEvidence}>{savingEvidence?'Saving...':'Save'}</button></div>
        </div>
      </div>}
    </div>
  );
}
