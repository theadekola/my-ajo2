import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiAssetUrl, apiGet, apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import BankNameField from '../components/BankNameField.jsx';
import SvgIcon from '../components/SvgIcon.jsx';

export default function DirectDebitSetup() {
  const { id } = useParams();
  const { user, showToast } = useAuth();
  const [members, setMembers] = useState([]);
  const [existing, setExisting] = useState([]);
  const [form, setForm] = useState({ bankName:user?.BankName||'', accountNumber:user?.BankAccountNumber||'', accountName:user?.BankAccountName||'' });
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  useEffect(() => {
    apiGet('/members/'+id).then(m=>setMembers((Array.isArray(m) ? m : []).filter(x=>x.Status==='Approved'))).catch(()=>setMembers([]));
    apiGet('/direct-debit/group/'+id).then(data=>setExisting(Array.isArray(data) ? data : [])).catch(()=>setExisting([]));
  }, [id]);

  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try { await apiPost('/direct-debit/group/'+id, form); showToast('Direct debit set up!'); apiGet('/direct-debit/group/'+id).then(data=>setExisting(Array.isArray(data) ? data : [])); }
    catch(ex) { showToast(ex.message,'error'); } finally { setBusy(false); }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/"+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link><div className="ptitle">Direct Debit Setup</div><div className="psub">Authorise automatic contributions</div></div>
      </div>
      <div className="two-col">
        <div>
          <div className="card">
            <div className="card-hd"><div className="card-ttl">Your Direct Debit</div></div>
            <div style={{padding:'0 18px 18px'}}>
              <div style={{background:'rgba(33,150,243,.07)',border:'1.5px solid rgba(33,150,243,.2)',borderRadius:10,padding:'12px 14px',margin:'16px 0',fontSize:13,color:'var(--blue)',lineHeight:1.6}}>
                <SvgIcon name="help" size={16} /> By setting up a direct debit, you authorise the group admin to collect contributions on the scheduled date.
              </div>
              <form onSubmit={submit}>
                <BankNameField countryCode={user?.CountryCode} value={form.bankName} onChange={bankName=>setForm(f=>({...f,bankName}))} required />
                <div className="fg"><label className="fl">ACCOUNT NUMBER</label><input className="fi" required value={form.accountNumber} onChange={set('accountNumber')} placeholder="0123456789"/></div>
                <div className="fg"><label className="fl">ACCOUNT NAME</label><input className="fi" required value={form.accountName} onChange={set('accountName')} placeholder="Your full name on account"/></div>
                <button className="btn btn-g" type="submit" disabled={busy} style={{width:'100%',justifyContent:'center',padding:12}}>{busy?'Setting up…':'Set Up Direct Debit'}</button>
              </form>
            </div>
          </div>
          {existing.length>0 && (
            <div className="card">
              <div className="card-hd"><div className="card-ttl">Active Direct Debits</div><span className="badge b-green">{existing.length}</span></div>
              {existing.map(dd=>(
                <div className="row" key={dd.DirectDebitId}>
                  <div className="row-ic" style={{background:'rgba(46,125,50,.1)'}}><SvgIcon name="bank" size={18} /></div>
                  <div style={{flex:1}}><div className="row-name">{dd.MemberName}</div><div className="row-sub">{dd.BankName}  -  {dd.AccountNumber}</div></div>
                  <span className="badge b-green">Active</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{padding:20,height:'fit-content'}}>
          <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:14,fontWeight:700,marginBottom:14}}>Group Members</div>
          {members.map(m=>(
            <div key={m.UserId} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(0,0,0,.05)'}}>
              <div className="uav" style={{width:30,height:30,fontSize:11,background:m.AvatarColor||'var(--sage)',flexShrink:0}}>
                {m.ProfilePicture?<img src={apiAssetUrl(m.ProfilePicture)} style={{width:30,height:30,borderRadius:'50%',objectFit:'cover'}} alt=""/>:(m.FirstName?.[0]||'')+(m.LastName?.[0]||'')}
              </div>
              <div style={{flex:1,fontSize:12.5}}><div style={{fontWeight:600}}>{m.FirstName} {m.LastName}</div><div style={{color:'var(--muted)',fontSize:11}}>Slot #{m.SlotNumber}</div></div>
              <span className={"badge "+(existing.find(dd=>dd.UserId===m.UserId)?'b-green':'b-gray')}>{existing.find(dd=>dd.UserId===m.UserId)?'Set up':'Pending'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
