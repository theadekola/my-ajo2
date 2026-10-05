import { useEffect, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { useParams, Link } from 'react-router-dom';
import { apiAssetUrl, apiGet, apiPut, apiUpload } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { currencyInputChange, formatCurrencyInput, parseCurrencyValue } from '../utils/currencyInput.js';
import { fetchPrivateFile, isNativeApp, saveBlobToDevice } from '../utils/nativeActions.js';

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function Disbursement() {
  const { id } = useParams();
  const { fmt, showToast, sym } = useAuth();
  const [tab, setTab] = useState('instant');
  const [members, setMembers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [form, setForm] = useState({ amount:'', adminCharge:'0', scheduledFor:'', cycleNumber:1, bankName:'', accountNumber:'', accountName:'', note:'' });
  const [busy, setBusy] = useState(false);
  const [evidenceViewer, setEvidenceViewer] = useState(null);
  const [openingEvidenceId, setOpeningEvidenceId] = useState(null);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const set = key => event => setForm(current=>({...current,[key]:event.target.value}));

  const load = () => {
    apiGet('/members/'+id).then(data=>setMembers((Array.isArray(data) ? data : []).filter(member=>member.Status==='Approved'))).catch(()=>setMembers([]));
    apiGet('/payouts/group/'+id).then(data=>setPayouts(Array.isArray(data) ? data : [])).catch(()=>setPayouts([]));
    apiGet('/groups/'+id).then(group=>setForm(current=>({...current,amount:formatCurrencyInput(group.ContributionAmount*group.MemberCount),cycleNumber:group.CurrentCycle}))).catch(()=>{});
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => () => {
    if (evidenceViewer?.previewUrl) URL.revokeObjectURL(evidenceViewer.previewUrl);
  }, [evidenceViewer?.previewUrl]);

  const closeEvidenceViewer = () => setEvidenceViewer(null);
  const openEvidenceViewer = async payout => {
    if (!payout?.EvidenceUrl) return;
    setOpeningEvidenceId(payout.PayoutId);
    try {
      const file = await fetchPrivateFile(apiAssetUrl(payout.EvidenceUrl), `payout-${payout.PayoutId}`);
      const kind = file.contentType.startsWith('image/') ? 'image' : file.contentType === 'application/pdf' ? 'pdf' : 'file';
      setEvidenceViewer({ ...file, previewUrl:URL.createObjectURL(file.blob), kind, native:isNativeApp() });
    } catch (error) {
      showToast(error.message || 'Could not open payment evidence.','error');
    } finally {
      setOpeningEvidenceId(null);
    }
  };
  const saveEvidence = async () => {
    if (!evidenceViewer?.blob) return;
    setSavingEvidence(true);
    try {
      const name=await saveBlobToDevice(evidenceViewer.blob,evidenceViewer.fileName);
      showToast(`Evidence saved: ${name}`);
    } catch (error) {
      showToast(error.message || 'Could not save payment evidence.','error');
    } finally {
      setSavingEvidence(false);
    }
  };

  const selectMember = member => {
    setSelected(member);
    setRecipientQuery(`${member.FirstName} ${member.LastName}`.trim());
    setRecipientOpen(false);
    setForm(current=>({
      ...current,
      bankName:member.BankName||'',
      accountNumber:member.BankAccountNumber||'',
      accountName:member.BankAccountName||''
    }));
  };

  const bankDetailsComplete = Boolean(form.bankName && form.accountNumber && form.accountName);
  const grossAmount = Number(parseCurrencyValue(form.amount) || 0);
  const adminCharge = Number(parseCurrencyValue(form.adminCharge) || 0);
  const totalPayout = Math.max(grossAmount - adminCharge, 0);
  const chargeIsValid = adminCharge >= 0 && adminCharge <= grossAmount;
  const filteredMembers = members.filter(member => {
    const search = recipientQuery.trim().toLowerCase();
    if (!search) return true;
    return `${member.FirstName} ${member.LastName} ${member.SlotNumber}`.toLowerCase().includes(search);
  });

  const submitPayout = async event => {
    event.preventDefault();
    if (!selected) return showToast('Select a recipient first','error');
    if (!bankDetailsComplete) return showToast('This member must save complete bank details before payout','error');
    if (!chargeIsValid) return showToast('Admin charge cannot exceed the payout amount','error');
    const instant = tab === 'instant';
    if (instant && !evidence) return showToast('Attach payment evidence before recording an instant payout','error');
    setBusy(true);
    try {
      const data = new FormData();
      data.append('groupId', id);
      data.append('recipientId', selected.UserId);
      data.append('amount', parseFloat(parseCurrencyValue(form.amount)));
      data.append('adminCharge', adminCharge);
      data.append('scheduledFor', instant ? localDate() : form.scheduledFor);
      data.append('cycleNumber', parseInt(form.cycleNumber));
      data.append('bankName', form.bankName);
      data.append('accountNumber', form.accountNumber);
      data.append('accountName', form.accountName);
      data.append('note', form.note);
      data.append('instant', instant ? 'true' : 'false');
      if (evidence) data.append('evidence', evidence);
      await apiUpload('/payouts', data);
      showToast(instant ? 'Instant payout recorded and member notified' : `Payout scheduled and ${selected.FirstName} has been notified`);
      load();
      setEvidence(null);
      setTab('history');
    } catch (error) {
      showToast(error.message,'error');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async payoutId => {
    await apiPut('/payouts/'+payoutId+'/paid',{});
    showToast('Marked as paid');
    load();
  };

  const tabs = [
    ['instant','Instant Payout'],
    ['schedule','Schedule Payout'],
    ['history','History']
  ];

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={'/group/'+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Disbursement</div>
          <div className="psub">Record and manage payouts</div>
        </div>
      </div>

      <div className="tabs-bar" style={{marginBottom:20,display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:4}}>
        {tabs.map(([value,label])=><button key={value} type="button" className={'tab-btn'+(tab===value?' active':'')} style={{width:'100%',minWidth:0,padding:'10px 5px',fontSize:'clamp(11px,2.8vw,13px)',whiteSpace:'nowrap'}} onClick={()=>{setTab(value);if(value!=='instant')setEvidence(null);}}>{label}</button>)}
      </div>

      {tab === 'history' ? (
        <div className="card">
          <div className="card-hd"><div className="card-ttl">Payouts History</div><span className="badge b-gray">{payouts.length}</span></div>
          {payouts.map(payout=>(
            <div className="row" key={payout.PayoutId}>
              <div className="row-ic" style={{background:payout.Status==='Paid'?'rgba(46,125,50,.12)':'rgba(255,193,7,.1)'}}><SvgIcon name={payout.Status==='Paid' ? 'check' : 'clock'} size={18} /></div>
              <div style={{flex:1}}>
                <div className="row-name">{payout.RecipientName}</div>
                <div className="row-sub">{new Date(payout.ScheduledFor).toLocaleDateString()}  -  Cycle {payout.CycleNumber}  -  {payout.BankName||'Bank not recorded'}{Number(payout.AdminCharge)>0?`  -  Admin charge ${fmt(payout.AdminCharge)}`:''}</div>
                {payout.EvidenceUrl ? <button type="button" className="back-link" style={{fontSize:11,border:0,background:'transparent',padding:0}} disabled={openingEvidenceId===payout.PayoutId} onClick={event=>{event.stopPropagation();openEvidenceViewer(payout);}}>{openingEvidenceId===payout.PayoutId?'Opening evidence...':'View payment evidence'}</button> : null}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,fontSize:13}}>{fmt(payout.TotalPayout??payout.Amount)}</div>
                {payout.Status==='Scheduled' ? <button className="btn btn-g btn-sm" type="button" style={{marginTop:4,fontSize:11}} onClick={()=>markPaid(payout.PayoutId)}>Mark Paid</button> : <span className="badge b-green">Paid</span>}
              </div>
            </div>
          ))}
          {!payouts.length ? <div style={{padding:32,textAlign:'center',color:'var(--muted)',fontSize:13}}>No payouts recorded yet</div> : null}
        </div>
      ) : (
        <div className="two-col">
          <div className="card" style={{height:'fit-content',padding:18}}>
            <label className="fl" htmlFor="recipient-search">SELECT RECIPIENT</label>
            <input id="recipient-search" className="fi" type="search" value={recipientQuery} placeholder="Search name or slot number" autoComplete="off" onFocus={()=>setRecipientOpen(true)} onBlur={()=>setTimeout(()=>setRecipientOpen(false),150)} onChange={event=>{setRecipientQuery(event.target.value);setSelected(null);setRecipientOpen(true);}} />
            {recipientOpen ? (
              <div style={{marginTop:8,background:'var(--white)',border:'1.5px solid rgba(0,0,0,.1)',borderRadius:12,boxShadow:'0 10px 24px rgba(0,0,0,.1)',maxHeight:260,overflowY:'auto'}}>
                {filteredMembers.map(member=>(
                  <button type="button" className="row" key={member.UserId} style={{width:'100%',textAlign:'left',cursor:'pointer',border:0,borderBottom:'1px solid rgba(0,0,0,.05)'}} onMouseDown={event=>event.preventDefault()} onClick={()=>selectMember(member)}>
                    <div className="uav" style={{width:34,height:34,fontSize:12,background:member.AvatarColor||'var(--sage)',flexShrink:0}}>{member.ProfilePicture?<img src={apiAssetUrl(member.ProfilePicture)} style={{width:34,height:34,borderRadius:'50%',objectFit:'cover'}} alt=""/>:(member.FirstName?.[0]||'')+(member.LastName?.[0]||'')}</div>
                    <div style={{flex:1}}><div className="row-name">{member.FirstName} {member.LastName}</div><div className="row-sub">Slot #{member.SlotNumber}  -  {member.HasReceived?'Already received':'Waiting'}</div></div>
                  </button>
                ))}
                {!filteredMembers.length ? <div style={{padding:18,textAlign:'center',color:'var(--muted)',fontSize:13}}>No matching member found</div> : null}
              </div>
            ) : null}
          </div>

          <div className="card" style={{height:'fit-content'}}>
            <div className="card-hd"><div className="card-ttl">{tab==='instant'?'Instant Payout':'Schedule Payout'}</div></div>
            <div style={{padding:'0 18px 18px'}}>
              {tab==='instant' ? <div style={{background:'rgba(33,150,243,.07)',border:'1.5px solid rgba(33,150,243,.2)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:'var(--blue)',lineHeight:1.6}}>This records the payout as paid immediately and notifies the member.</div> : null}
              {selected ? (
                <div style={{background:'var(--gold-p)',border:'1.5px solid var(--gold)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:20}}><SvgIcon name="user" size={20} /></span>
                  <div><div style={{fontWeight:700}}>{selected.FirstName} {selected.LastName}</div><div style={{fontSize:11,color:'var(--muted)'}}>Slot #{selected.SlotNumber}</div></div>
                </div>
              ) : <div style={{background:'var(--mist)',borderRadius:10,padding:12,marginBottom:16,fontSize:13,color:'var(--muted)',textAlign:'center'}}>Select a recipient from the list</div>}

              <form onSubmit={submitPayout}>
                <div className="form-row">
                  <div className="fg"><label className="fl">CYCLE</label><input className="fi" type="number" required value={form.cycleNumber} onChange={set('cycleNumber')}/></div>
                  <div className="fg"><label className="fl">AMOUNT</label><div className="aiw"><span className="ac">{sym}</span><input className="fi" type="text" required inputMode="decimal" value={form.amount} onChange={currencyInputChange(value=>setForm(current=>({...current,amount:value})))} placeholder="40,000"/></div></div>
                </div>
                <div className="form-row">
                  <div className="fg"><label className="fl">ADMIN CHARGE</label><div className="aiw"><span className="ac">{sym}</span><input className="fi" type="text" required inputMode="decimal" value={form.adminCharge} onChange={currencyInputChange(value=>setForm(current=>({...current,adminCharge:value})))} placeholder="0"/></div></div>
                  <div className="fg"><label className="fl">TOTAL PAYOUT</label><div className="aiw"><span className="ac">{sym}</span><input className="fi" type="text" disabled value={formatCurrencyInput(totalPayout)} /></div></div>
                </div>
                {!chargeIsValid ? <div className="err-msg">Admin charge cannot exceed the payout amount.</div> : null}
                {tab==='schedule' ? <div className="fg"><label className="fl">SCHEDULED DATE</label><input className="fi" type="date" required value={form.scheduledFor} onChange={set('scheduledFor')}/></div> : null}
                <div className="fg"><label className="fl">RECIPIENT BANK NAME</label><input className="fi" disabled value={form.bankName} placeholder="Member has not added a bank name"/></div>
                <div className="fg"><label className="fl">ACCOUNT NUMBER / IBAN</label><input className="fi" disabled value={form.accountNumber} placeholder="Member has not added an account number"/></div>
                <div className="fg"><label className="fl">ACCOUNT NAME</label><input className="fi" disabled value={form.accountName} placeholder="Member has not added an account name"/></div>
                {selected && !bankDetailsComplete ? <div className="err-msg">This member must add complete bank details before a payout can be made.</div> : null}
                {tab==='instant' ? <div className="fg"><label className="fl">PAYMENT EVIDENCE (required)</label><input className="fi" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={event=>setEvidence(event.target.files?.[0]||null)} style={{padding:8}}/>{evidence ? <div style={{fontSize:11,color:'var(--green)',marginTop:5}}>Evidence attached: {evidence.name}</div> : <div style={{fontSize:11,color:'var(--red)',marginTop:5}}>Attach a receipt, screenshot, or PDF.</div>}</div> : null}
                <div className="fg"><label className="fl">NOTE</label><input className="fi" value={form.note} onChange={set('note')} placeholder="Optional note"/></div>
                <button className="btn btn-g" type="submit" disabled={busy||!selected||!bankDetailsComplete||!chargeIsValid||(tab==='instant'&&!evidence)} style={{width:'100%',justifyContent:'center',padding:12}}>{busy?'Processing...':tab==='instant'?'Record Instant Payout':'Schedule Payout'}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {evidenceViewer && (
        <div className="modal-ov open modal-ov-center evidence-modal-overlay" style={{zIndex:1200,background:'rgba(14,26,18,.35)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}} onClick={event=>event.target===event.currentTarget&&closeEvidenceViewer()}>
          <div className="modal evidence-modal" style={{maxWidth:520,width:'min(520px,calc(100vw - 28px))'}} role="dialog" aria-modal="true" aria-label="Payment evidence">
            <div style={{marginBottom:12}}>
              <div className="modal-ttl" style={{marginBottom:2}}>Payment Evidence</div>
              <div className="row-sub" style={{wordBreak:'break-all'}}>{evidenceViewer.fileName}</div>
            </div>
            <div style={{border:'1px solid rgba(0,0,0,.08)',borderRadius:12,background:'var(--mist)',minHeight:260,maxHeight:'55vh',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {evidenceViewer.kind==='image' ? <img src={evidenceViewer.previewUrl} alt="Payment evidence" style={{width:'100%',height:'100%',maxHeight:'55vh',objectFit:'contain',display:'block'}} /> : evidenceViewer.kind==='pdf'&&!evidenceViewer.native ? <iframe title="Payment evidence" src={evidenceViewer.previewUrl} style={{width:'100%',height:'55vh',border:0,background:'var(--white)'}} /> : <div className="evidence-file-placeholder"><SvgIcon name="receipt" size={34}/><strong>{evidenceViewer.kind==='pdf'?'PDF payment evidence':'Payment evidence file'}</strong><span>The file stays inside My Ajo. Tap Save to keep a copy on this device.</span></div>}
            </div>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button type="button" className="btn btn-gh" onClick={closeEvidenceViewer} style={{flex:1,justifyContent:'center'}}>Close</button>
              <button type="button" className="btn btn-g" onClick={saveEvidence} disabled={savingEvidence} style={{flex:1,justifyContent:'center'}}>{savingEvidence?'Saving...':'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
