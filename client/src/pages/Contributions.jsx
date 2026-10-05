import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon, { groupIconNameFromValue } from '../components/SvgIcon.jsx';
import { formatPaymentMethod } from '../utils/textFormat.js';

export default function Contributions() {
  const { fmt } = useAuth();
  const [contribs, setContribs] = useState([]);
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    apiGet('/contributions').then(data => setContribs(Array.isArray(data) ? data : [])).catch(()=>setContribs([]));
  }, []);

  const statuses = ['All','Pending','Confirmed','Rejected'];
  const shown = filter==='All' ? contribs : contribs.filter(c=>c.Status===filter);
  const total = contribs.filter(c=>c.Status==='Confirmed').reduce((s,c)=>s+parseFloat(c.Amount||0),0);

  return (
    <div className="page-enter">
      <div className="topbar">
        <div><div className="ptitle">My Contributions</div><div className="psub">Track your payments across all groups</div></div>
        <button className="btn btn-g" onClick={()=>navigate('/groups')}><SvgIcon name="contribution" size={16} /> Pay Now</button>
      </div>

      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[['money',fmt(total),'Total Confirmed'],['clock',contribs.filter(c=>c.Status==='Pending').length,'Pending Review'],['groups',new Set(contribs.map(c=>c.GroupId)).size,'Groups']].map(([ic,v,l])=>(
          <div className="kpi" key={l}><div className="kpi-ic"><SvgIcon name={ic} size={18} /></div><div className="kpi-val">{v}</div><div className="kpi-lbl">{l}</div></div>
        ))}
      </div>

      <div className="tabs-bar" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:3,padding:2}}>
        {statuses.map(s=><button key={s} className={"tab-btn"+(filter===s?' active':'')} style={{width:'100%',minWidth:0,padding:'6px 2px',fontSize:'clamp(10px,2.5vw,11.5px)',whiteSpace:'nowrap'}} onClick={()=>setFilter(s)}>{s}</button>)}
      </div>

      <div className="card">
        {shown.map(c=>(
          <div className="row" key={c.ContributionId} style={{cursor:'pointer'}} onClick={()=>navigate('/group/'+c.GroupId)}>
            <div className="row-ic" style={{background:'rgba(200,151,58,.12)',fontSize:17}}><SvgIcon name={groupIconNameFromValue(c.Icon, c.GroupName)} size={18} /></div>
            <div style={{flex:1}}>
              <div className="row-name">{c.GroupName}</div>
              <div className="row-sub">Cycle {c.CycleNumber} - {formatPaymentMethod(c.Method)} - {new Date(c.PaidAt).toLocaleDateString()}</div>
              {c.ReferenceNo && <div style={{fontSize:11,color:'var(--muted)'}}>Ref: {c.ReferenceNo}</div>}
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--deep)'}}>{fmt(c.Amount)}</div>
              <span className={"badge "+(c.Status==='Confirmed'?'b-green':c.Status==='Pending'?'b-gold':'b-red')} style={{fontSize:10}}>{c.Status}</span>
            </div>
          </div>
        ))}
        {!shown.length && <div style={{padding:40,textAlign:'center'}}>
          <div style={{marginBottom:12,color:'var(--gold)'}}><SvgIcon name="money" size={40} /></div>
          <div style={{color:'var(--muted)',fontSize:13}}>No {filter === 'All' ? '' : filter.toLowerCase() + ' '}contributions yet</div>
        </div>}
      </div>
    </div>
  );
}


