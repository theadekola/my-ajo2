import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, COUNTRIES, currencySymbol } from '../context/AuthContext.jsx';
import { apiGet, apiPost } from '../api/appClient.js';
import { currencyInputChange, parseCurrencyValue } from '../utils/currencyInput.js';
import SvgIcon, { groupIconNameFromValue } from '../components/SvgIcon.jsx';
import { clearPendingInvite, normalizeInviteCode, savePendingInvite } from '../utils/pendingInvite.js';
import FundsHandlingNotice from '../components/FundsHandlingNotice.jsx';

export default function Groups() {
  const { fmt, showToast, user, sym } = useAuth();
  const [groups, setGroups] = useState([]);
  const [showCreate, setCreate] = useState(false);
  const [showJoin, setJoin] = useState(false);
  const [preview, setPreview] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [joinPhase, setJoinPhase] = useState('input');
  const [inviteCode, setInviteCode] = useState('');
  const [autoPreviewInvite, setAutoPreviewInvite] = useState('');
  const [autoJoinInvite, setAutoJoinInvite] = useState('');
  const [cForm, setCForm] = useState({ groupName:'',contributionAmount:'',frequency:'Monthly',startDate:new Date().toISOString().slice(0,10),paymentDayOfWeek:1,paymentDayOfMonth:1,maxMembers:10,payoutOrder:'Fixed',icon:'',description:'' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const openCreateGroup = () => {
    if (window.matchMedia?.('(max-width: 767px)').matches) navigate('/groups/create');
    else setCreate(true);
  };

  const load = () => apiGet('/groups').then(data=>setGroups(Array.isArray(data) ? data : [])).catch(()=>setGroups([]));
  useEffect(() => {
    load();
    const inv = normalizeInviteCode(params.get('invite'));
    if (inv) {
      savePendingInvite(inv);
      setInviteCode(inv);
      setAutoPreviewInvite(inv);
      if (params.get('join') === '1') setAutoJoinInvite(inv);
      setJoin(true);
    }
  }, []);

  const countryName = code => COUNTRIES.find(c=>c.code===code)?.name || code;
  const moneySymbol = group => currencySymbol(group?.CurrencyCode, group?.CurrencySymbol || sym);
  const fmtGroupAmount = (amount, group) => `${moneySymbol(group)}${Number(amount || 0).toLocaleString()}`;

  const createGroup = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await apiPost('/groups', { ...cForm, icon: groupIconNameFromValue(cForm.icon, cForm.groupName), contributionAmount:parseFloat(parseCurrencyValue(cForm.contributionAmount)), maxMembers:parseInt(cForm.maxMembers) });
      showToast('Group created! Add payment details before inviting members.');
      setCreate(false);
      navigate(`/group/${r.GroupId}/payment-info`);
    } catch(ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const fetchPreview = async e => {
    e && e.preventDefault(); setErr(''); setBusy(true);
    try {
      const data = await apiGet('/groups/preview/'+normalizeInviteCode(inviteCode));
      if (data.CountryCode !== user?.CountryCode) { setBlocked(data); setJoinPhase('blocked'); }
      else { setPreview(data); setJoinPhase('preview'); }
    } catch(ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  const confirmJoin = async code => {
    const codeToJoin = normalizeInviteCode(code || inviteCode);
    setBusy(true);
    try {
      const r = await apiPost('/groups/join', { inviteCode: codeToJoin });
      showToast('Joined "'+r.groupName+'"! Slot #'+r.slot+' - awaiting admin approval');
      clearPendingInvite();
      setBusy(false);
      setJoin(false); setJoinPhase('input'); load();
      navigate('/groups', { replace: true });
    } catch(ex) {
      if (ex.code === 'COUNTRY_MISMATCH') { setBlocked(preview); setJoinPhase('blocked'); }
      else {
        if (ex.code === 'ALREADY_MEMBER') {
          clearPendingInvite();
          navigate('/groups', { replace: true });
        }
        setErr(ex.message);
      }
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!showJoin || joinPhase !== 'input' || !autoPreviewInvite) return;
    setAutoPreviewInvite('');
    fetchPreview();
  }, [showJoin, joinPhase, autoPreviewInvite]);

  useEffect(() => {
    if (!showJoin || joinPhase !== 'preview' || !autoJoinInvite || !preview) return;
    const codeToJoin = autoJoinInvite;
    setAutoJoinInvite('');
    confirmJoin(codeToJoin);
  }, [showJoin, joinPhase, autoJoinInvite, preview]);

  return (
    <div className="page-enter">
      <div className="topbar">
        <div><div className="ptitle">My Groups</div><div className="psub">Manage your Ajo savings circles</div></div>
        {!!groups.length && (
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-g" onClick={openCreateGroup}><SvgIcon name="plus" size={16}/> Create Group</button>
            <button className="btn btn-gh" onClick={()=>setJoin(true)}><SvgIcon name="link" size={16}/> Join Group</button>
          </div>
        )}
      </div>

      <div className="grid-3">
        {groups.map(g=>(
          <div key={g.GroupId} className="card" style={{padding:20,cursor:'pointer',border:'2px solid transparent',transition:'border-color .2s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold-p)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}
            onClick={()=>navigate('/group/'+g.GroupId)}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <div style={{width:44,height:44,borderRadius:11,background:'rgba(200,151,58,.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}><SvgIcon name={groupIconNameFromValue(g.Icon, g.GroupName)} size={22} /></div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:20,background:'rgba(45,80,64,.1)',color:'var(--sage)'}}>{g.CountryCode}</span>
                <span className={"badge "+(g.Status==='Active'?'b-green':'b-gold')}>{g.Status}</span>
              </div>
            </div>
            <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:15,fontWeight:700,color:'var(--deep)'}}>{g.GroupName}</div>
            <div style={{fontSize:11.5,color:'var(--muted)',marginTop:2}}>{g.MemberCount}/{g.MaxMembers} members {'\u00B7'} {g.Frequency}</div>
            <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:22,fontWeight:700,color:'var(--deep)',margin:'10px 0 3px'}}>{fmtGroupAmount(g.ContributionAmount, g)}</div>
            <div style={{fontSize:11,color:'var(--muted)'}}>per {g.Frequency==='Weekly'?'week':'month'}</div>
            <div className="pw" style={{marginTop:12}}><div className="pb" style={{width:`${g.MemberCount?(g.PaidCount/g.MemberCount)*100:0}%`}}/></div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'var(--muted)'}}><span>{g.PaidCount}/{g.MemberCount} paid</span><span>{fmtGroupAmount(g.CollectedThisCycle, g)}</span></div>
            {g.MemberStatus==='Pending' && <div className="badge b-gold" style={{marginTop:10}}>Awaiting Approval</div>}
          </div>
        ))}
        {!groups.length && (
          <div className="empty-state" style={{gridColumn:'1/-1'}}>
            <SvgIcon name="users" size={44} />
            <h2>Create or join your first group</h2>
            <p>Start a savings group or join an existing group using an invitation code.</p>
            <div className="empty-state-actions">
              <button className="btn btn-g" onClick={openCreateGroup}><SvgIcon name="plus" size={16}/> Create Group</button>
              <button className="btn btn-gh" onClick={()=>setJoin(true)}><SvgIcon name="link" size={16}/> Join Group</button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="modal-ov open create-group-overlay" onClick={e=>e.target===e.currentTarget&&setCreate(false)}>
          <div className="modal create-group-modal">
            <button className="modal-close" onClick={()=>setCreate(false)}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl">Create New Group</div>
            <div className="modal-sub">This group will be restricted to members from your country ({user?.CountryCode}).</div>
            <FundsHandlingNotice style={{ margin: '14px 0' }} />
            {err && <div className="err-msg">{err}</div>}
            <form onSubmit={createGroup}>
              <div className="fg"><label className="fl">GROUP NAME</label><input className="fi" required value={cForm.groupName} onChange={e=>setCForm(f=>({...f,groupName:e.target.value}))} placeholder="Family Circle"/></div>
              <div className="form-row">
                <div className="fg"><label className="fl">AMOUNT</label><div className="aiw"><span className="ac">{sym || user?.CurrencySymbol || '$'}</span><input className="fi" type="text" required inputMode="decimal" value={cForm.contributionAmount} onChange={currencyInputChange(value=>setCForm(f=>({...f,contributionAmount:value})))} placeholder="10,000"/></div></div>
                <div className="fg"><label className="fl">FREQUENCY</label><select className="fs" value={cForm.frequency} onChange={e=>setCForm(f=>({...f,frequency:e.target.value}))}><option>Weekly</option><option>Monthly</option></select></div>
              </div>
              <div className="fg"><label className="fl">START DATE</label><input className="fi" type="date" required min={new Date().toISOString().slice(0,10)} value={cForm.startDate} onChange={e=>setCForm(f=>({...f,startDate:e.target.value}))}/><small className="form-hint">The payment schedule and automatic reminders begin from this date.</small></div>
              {cForm.frequency==='Weekly' ? <div className="fg"><label className="fl">PAYMENT DAY</label><select className="fs" required value={cForm.paymentDayOfWeek} onChange={e=>setCForm(f=>({...f,paymentDayOfWeek:Number(e.target.value)}))}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,index)=><option key={day} value={index}>{day}</option>)}</select><small className="form-hint">My Ajo AI will privately remind every approved member 48 hours before this day.</small></div> : <div className="fg"><label className="fl">PAYMENT DATE EACH MONTH</label><select className="fs" required value={cForm.paymentDayOfMonth} onChange={e=>setCForm(f=>({...f,paymentDayOfMonth:Number(e.target.value)}))}>{Array.from({length:28},(_,index)=>index+1).map(day=><option key={day} value={day}>{day}{day===1?'st':day===2?'nd':day===3?'rd':'th'} of every month</option>)}</select><small className="form-hint">My Ajo AI will privately remind every approved member 48 hours before this date.</small></div>}
              <div className="form-row">
                <div className="fg"><label className="fl">MAX MEMBERS</label><input className="fi" type="number" min={2} value={cForm.maxMembers} onChange={e=>setCForm(f=>({...f,maxMembers:e.target.value}))}/></div>
                <div className="fg"><label className="fl">PAYOUT ORDER</label><select className="fs" value={cForm.payoutOrder} onChange={e=>setCForm(f=>({...f,payoutOrder:e.target.value}))}><option>Fixed</option><option>Random</option><option>Bidding</option></select></div>
              </div>
              <div className="fg"><label className="fl">DESCRIPTION</label><textarea className="fta" value={cForm.description} onChange={e=>setCForm(f=>({...f,description:e.target.value}))} placeholder="What is this group for?"/></div>
              <div className="modal-form-actions" style={{display:'flex',gap:10}}><button type="button" className="btn btn-gh" onClick={()=>setCreate(false)} style={{flex:1,justifyContent:'center'}}>Cancel</button><button type="submit" className="btn btn-g" disabled={busy} style={{flex:2,justifyContent:'center'}}>{busy?'Creating...':'Create Group'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN MODAL */}
      {showJoin && (
        <div className="modal-ov open" onClick={e=>e.target===e.currentTarget&&(setJoin(false),setJoinPhase('input'))}>
          <div className="modal">
            <button className="modal-close" onClick={()=>{setJoin(false);setJoinPhase('input');}}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl">{joinPhase==='blocked'?<><SvgIcon name="warning" size={18} /> Access Denied</>:joinPhase==='preview'?'Group Preview':'Join a Group'}</div>
            {err && <div className="err-msg">{err}</div>}

            {joinPhase==='input' && (
              <>
                <div style={{background:'rgba(33,150,243,.07)',border:'1.5px solid rgba(33,150,243,.2)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'var(--blue)'}}>
                  You can only join groups from {countryName(user?.CountryCode)}.
                </div>
                <form onSubmit={fetchPreview}>
                  <div className="fg"><label className="fl">INVITE CODE</label><input className="fi" required value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="FAMILY-AO7G3K" style={{textTransform:'uppercase',letterSpacing:3,fontWeight:700,fontSize:16}} autoFocus/></div>
                  <div style={{display:'flex',gap:10}}><button type="button" className="btn btn-gh" onClick={()=>setJoin(false)} style={{flex:1,justifyContent:'center'}}>Cancel</button><button type="submit" className="btn btn-g" disabled={busy||!inviteCode.trim()} style={{flex:2,justifyContent:'center'}}>{busy?'Looking up...':'Preview Group'}</button></div>
                </form>
              </>
            )}

            {joinPhase==='preview' && preview && (
              <div>
                <div style={{background:'linear-gradient(135deg,var(--deep),var(--forest))',borderRadius:13,padding:18,marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    <div style={{fontSize:28,background:'rgba(200,151,58,.2)',borderRadius:10,width:46,height:46,display:'flex',alignItems:'center',justifyContent:'center'}}><SvgIcon name={groupIconNameFromValue(preview.Icon, preview.GroupName)} size={28} /></div>
                    <div><div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:17,fontWeight:700,color:'#fff'}}>{preview.GroupName}</div><div style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>By {preview.AdminName}</div></div>
                    <span style={{marginLeft:'auto',background:'rgba(76,175,80,.2)',color:'#4CAF50',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700}}>{preview.Status}</span>
                  </div>
                  {[['Contribution',fmt(preview.ContributionAmount)+'/'+preview.Frequency],['Country',countryName(preview.CountryCode)],['Max Members',preview.MaxMembers]].map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,.07)',fontSize:13}}>
                      <span style={{color:'rgba(255,255,255,.5)'}}>{l}</span><span style={{fontWeight:600,color:'#fff'}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:'rgba(46,125,50,.07)',border:'1.5px solid rgba(46,125,50,.2)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:13,color:'var(--green)'}}>
                  <SvgIcon name="check" size={16} /> Your country matches. You are eligible to join.
                </div>
                <div style={{display:'flex',gap:10}}><button className="btn btn-gh" onClick={()=>setJoinPhase('input')} style={{flex:1,justifyContent:'center'}}>Back</button><button className="btn btn-g" onClick={() => confirmJoin()} disabled={busy} style={{flex:2,justifyContent:'center'}}>{busy?'Joining...':'Confirm & Join'}</button></div>
              </div>
            )}

            {joinPhase==='blocked' && blocked && (
              <div style={{textAlign:'center'}}>
                <div style={{marginBottom:12,color:'var(--red)'}}><SvgIcon name="globe" size={52} /></div>
                <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:18,fontWeight:700,color:'var(--red)',marginBottom:10}}>Country Restriction</div>
                <div style={{background:'rgba(198,40,40,.06)',border:'1.5px solid rgba(198,40,40,.2)',borderRadius:12,padding:'14px 16px',marginBottom:16,textAlign:'left',fontSize:13,lineHeight:1.65}}>
                  <strong>"{blocked.GroupName}"</strong> is restricted to members from <strong>{countryName(blocked.CountryCode)}</strong>. Your account is registered in <strong style={{color:'var(--red)'}}>{countryName(user?.CountryCode)}</strong>.
                </div>
                <div style={{display:'flex',gap:10}}><button className="btn btn-gh" onClick={()=>setJoinPhase('input')} style={{flex:1,justifyContent:'center'}}>Try Another</button><button className="btn btn-p" onClick={()=>setJoin(false)} style={{flex:1,justifyContent:'center'}}>Close</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


