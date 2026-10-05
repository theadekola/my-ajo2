import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPut } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import BankNameField from '../components/BankNameField.jsx';
import ConfirmBankDetailsModal from '../components/ConfirmBankDetailsModal.jsx';
import { copyText, inviteUrl, shareText } from '../utils/nativeActions.js';
import SvgIcon from '../components/SvgIcon.jsx';
import FundsHandlingNotice from '../components/FundsHandlingNotice.jsx';

const EMPTY_PAYMENT_INFO = { bankName:'', accountNumber:'', accountName:'', routingCode:'', instructions:'' };

export default function PaymentInformation() {
  const { id } = useParams();
  const { user, showToast } = useAuth();
  const [form, setForm] = useState(EMPTY_PAYMENT_INFO);
  const [editing, setEditing] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [codes, setCodes] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  useEffect(() => {
    apiGet('/payment-info/'+id).then(d=>{
      if (!d) return;
      const loaded = {bankName:d.BankName||'',accountNumber:d.AccountNumber||'',accountName:d.AccountName||'',routingCode:d.RoutingCode||'',instructions:d.Instructions||''};
      setForm(loaded); setEditing(false);
    }).catch(()=>{});
    apiGet('/invites/'+id).then(data=>setCodes(Array.isArray(data) ? data : [])).catch(()=>setCodes([]));
  }, [id]);

  const requestSave = e => { e.preventDefault(); setConfirming(true); };
  const save = async () => {
    setBusy(true);
    try { await apiPut('/payment-info/'+id, {...form,routingCode:user?.CountryCode === 'NG' ? '' : form.routingCode}); setSaved(true); setConfirming(false); setEditing(false); showToast('Payment info saved!'); }
    catch(ex) { showToast(ex.message,'error'); } finally { setBusy(false); }
  };

  const activeCode = codes.find(c=>c.IsActive);
  const inviteLink = code => inviteUrl(code);
  const copyInvite = async code => {
    try {
      await copyText(inviteLink(code));
      showToast('Invite link copied!');
    } catch (ex) {
      showToast(ex.message || 'Copy failed.', 'error');
    }
  };
  const shareInvite = async code => {
    const url = inviteLink(code);
    try {
      await shareText({
        title: 'My Ajo Invite',
        text: 'Join my My Ajo savings group with this invite code: ' + code,
        url,
      });
      showToast('Invite ready to share.');
    } catch (ex) {
      try {
        await copyText(url);
        showToast('Share was not available, invite link copied.');
      } catch {
        showToast(ex.message || 'Share failed.', 'error');
      }
    }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/"+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link><div className="ptitle">Payment Information</div><div className="psub">Set bank details for group members to pay into</div></div>
        <button className="btn btn-g" type={editing?'submit':'button'} form={editing?'payment-info-form':undefined} onClick={editing?undefined:()=>setEditing(true)}>{editing?'Save':'Edit'}</button>
      </div>
      <FundsHandlingNotice style={{ marginBottom: 18 }} />
      <div className="two-col">
        <div className="card">
          <div className="card-hd"><div className="card-ttl">Bank Details</div></div>
          <div style={{padding:'0 18px 18px'}}>
            <form id="payment-info-form" onSubmit={requestSave} style={{marginTop:16}}>
              <BankNameField countryCode={user?.CountryCode} value={form.bankName} onChange={bankName=>setForm(f=>({...f,bankName}))} required disabled={!editing} />
              <div className="fg"><label className="fl">ACCOUNT NUMBER / IBAN</label><input className="fi" required disabled={!editing} value={form.accountNumber} onChange={set('accountNumber')} placeholder="0123456789"/></div>
              <div className="fg"><label className="fl">ACCOUNT NAME</label><input className="fi" required disabled={!editing} value={form.accountName} onChange={set('accountName')} placeholder="Family Circle Ajo"/></div>
              {user?.CountryCode !== 'NG' && <div className="fg"><label className="fl">SORT CODE / ROUTING (optional)</label><input className="fi" disabled={!editing} value={form.routingCode} onChange={set('routingCode')} placeholder="12-34-56"/></div>}
              <div className="fg"><label className="fl">PAYMENT INSTRUCTIONS (optional)</label><textarea className="fta" disabled={!editing} value={form.instructions} onChange={set('instructions')} placeholder="Any extra instructions for members…"/></div>
            </form>
          </div>
        </div>
        <div>
          {saved && activeCode && (
            <div className="card" style={{padding:20}}>
              <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:15,fontWeight:700,marginBottom:12}}>Share Invite Code</div>
              <div style={{fontFamily:'monospace',fontSize:18,fontWeight:700,letterSpacing:3,color:'var(--deep)',background:'var(--mist)',padding:'14px',borderRadius:10,textAlign:'center',marginBottom:12}}>{activeCode.Code}</div>
              <button className="btn btn-g" style={{width:'100%',justifyContent:'center'}} onClick={()=>shareInvite(activeCode.Code)}>Share Invite Link</button>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button type="button" className="btn btn-gh" style={{flex:1,justifyContent:'center',fontSize:12}} onClick={()=>copyInvite(activeCode.Code)}>Copy Link</button>
                <Link to={"/group/"+id+"/invite-codes"} className="btn btn-gh" style={{flex:1,justifyContent:'center',fontSize:12}}>Manage Codes</Link>
                <Link to={"/group/"+id} className="btn btn-gh" style={{flex:1,justifyContent:'center',fontSize:12}}>Group Detail</Link>
              </div>
            </div>
          )}
          <div className="card" style={{padding:20}}>
            <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:14,fontWeight:700,marginBottom:12}}>Tips</div>
            {['Use a dedicated account for each group to avoid confusion.','Share the invite link only after adding payment details.','Members will see these details when making payments.'].map(t=>(
              <div key={t} style={{display:'flex',gap:8,fontSize:13,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>
                <span style={{color:'var(--gold)',flexShrink:0}}>•</span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ConfirmBankDetailsModal open={confirming} {...form} routingCode={user?.CountryCode === 'NG' ? '' : form.routingCode} busy={busy} onCancel={()=>setConfirming(false)} onConfirm={save} />
    </div>
  );
}
