import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiAssetUrl, apiGet } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon from '../components/SvgIcon.jsx';
import { formatPaymentMethod } from '../utils/textFormat.js';

export default function GroupContributions() {
  const { id } = useParams();
  const { fmt } = useAuth();
  const [contribs, setContribs] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    apiGet('/contributions/group/'+id).then(data=>setContribs(Array.isArray(data) ? data : [])).catch(()=>setContribs([]));
  }, [id]);

  const statuses = ['All','Pending','Confirmed','Rejected'];
  const shown = filter==='All' ? contribs : contribs.filter(c=>c.Status===filter);

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/"+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link><div className="ptitle">Contributions</div><div className="psub">{contribs.length} total records</div></div>
        <div style={{display:'flex',gap:10}}>
          <Link to={"/group/"+id+"/pay"} className="btn btn-g btn-sm"><SvgIcon name="contribution" size={15} /> Pay</Link>
        </div>
      </div>

      <div className="tabs-bar" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:3}}>
        {statuses.map(s=><button key={s} className={"tab-btn"+(filter===s?' active':'')} style={{width:'100%',minWidth:0,padding:'8px 3px',fontSize:'clamp(10px,2.7vw,12.5px)',whiteSpace:'nowrap'}} onClick={()=>setFilter(s)}>{s} {s!=='All'&&<span className="badge b-gray" style={{marginLeft:2,fontSize:9,padding:'2px 5px'}}>{contribs.filter(c=>c.Status===s).length}</span>}</button>)}
      </div>

      <div className="card">
        {shown.map(c=>(
          <div className="row" key={c.ContributionId}>
            <div className="uav" style={{width:34,height:34,fontSize:12,background:c.AvatarColor||'var(--sage)',flexShrink:0}}>
              {c.ProfilePicture?<img src={apiAssetUrl(c.ProfilePicture)} style={{width:34,height:34,borderRadius:'50%',objectFit:'cover'}} alt=""/>:c.MemberName?.split(' ').map(w=>w[0]).join('')}
            </div>
            <div style={{flex:1}}>
              <div className="row-name">{c.MemberName}</div>
              <div className="row-sub">Cycle {c.CycleNumber} - {formatPaymentMethod(c.Method)} - {new Date(c.PaidAt).toLocaleDateString()}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--deep)'}}>{fmt(c.Amount)}</div>
              <span className={"badge "+(c.Status==='Confirmed'?'b-green':c.Status==='Pending'?'b-gold':'b-red')} style={{fontSize:10}}>{c.Status}</span>
            </div>
          </div>
        ))}
        {!shown.length && <div style={{padding:32,textAlign:'center',color:'var(--muted)',fontSize:13}}>No {filter.toLowerCase()} contributions</div>}
      </div>
    </div>
  );
}
