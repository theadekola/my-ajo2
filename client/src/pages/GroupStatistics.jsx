import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SvgIcon from '../components/SvgIcon.jsx';
import { apiAssetUrl, apiGet, apiUrl } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const CHART_COLORS = ['#2E7D32','#D4A843','#C62828','#1565C0','#8EA99A'];
const activityIcon = category => ({contributions:'contribution',payments:'money',payouts:'bank',members:'users',groups:'users',security:'shield'}[category] || 'bell');
const ago = value => {
  const seconds=Math.max(1,Math.floor((Date.now()-new Date(value).getTime())/1000));
  if(seconds<60)return 'Just now'; if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`; return `${Math.floor(seconds/86400)}d ago`;
};

function StatusChart({title,subtitle,rows,emptyLabel}) {
  const total=rows.reduce((sum,row)=>sum+Number(row.Count||0),0);
  let start=0;
  const stops=rows.map((row,index)=>{const end=start+(Number(row.Count||0)/Math.max(total,1))*100;const stop=`${CHART_COLORS[index%CHART_COLORS.length]} ${start}% ${end}%`;start=end;return stop;}).join(',');
  const positive=rows.filter(row=>['Confirmed','Paid','Completed'].includes(row.Status)).reduce((sum,row)=>sum+Number(row.Count||0),0);
  const percentage=total?Math.round(positive/total*100):0;
  return <article className="group-stat-panel status-chart-card">
    <div className="group-stat-head"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="group-stat-total">{total} records</span></div>
    {!total?<div className="group-stat-empty">{emptyLabel}</div>:<div className="group-status-chart">
      <div className="group-donut" style={{background:`conic-gradient(${stops})`}}><div><strong>{percentage}%</strong><span>complete</span></div></div>
      <div className="group-chart-legend">{rows.map((row,index)=><div key={row.Status}><span><i style={{background:CHART_COLORS[index%CHART_COLORS.length]}}/>{row.Status}</span><strong>{row.Count}</strong></div>)}</div>
    </div>}
  </article>;
}

export default function GroupStatistics(){
  const {id}=useParams(); const {fmt}=useAuth();
  const [stats,setStats]=useState(null); const [activity,setActivity]=useState([]); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    const [statsData,activityData]=await Promise.all([apiGet(`/groups/${id}/statistics`),apiGet(`/dashboard/activity?groupId=${encodeURIComponent(id)}&limit=20`)]);
    setStats(statsData); setActivity(Array.isArray(activityData?.items)?activityData.items:[]);
  },[id]);
  useEffect(()=>{setLoading(true);load().catch(()=>{}).finally(()=>setLoading(false));},[load]);
  useEffect(()=>{
    const source=new EventSource(apiUrl(`/api/dashboard/activity/stream?groupId=${encodeURIComponent(id)}`),{withCredentials:true});
    source.addEventListener('activity',event=>{const item=JSON.parse(event.data);if(Number(item.GroupId)===Number(id))setActivity(items=>[item,...items.filter(existing=>existing.Id!==item.Id)].slice(0,20));});
    return()=>source.close();
  },[id]);
  if(loading&&!stats)return <div className="group-stat-loading">Loading group statistics...</div>;
  if(!stats)return <div className="group-stat-loading">Statistics could not be loaded.</div>;

  const summary=stats.summary||{}; const ranking=Array.isArray(stats.ranking)?stats.ranking:[];
  const cycles=Array.isArray(stats.cycles)?stats.cycles:[]; const contributionStatus=Array.isArray(stats.contributionStatus)?stats.contributionStatus:[];
  const payoutStatus=Array.isArray(stats.payoutStatus)?stats.payoutStatus:[]; const isAdmin=summary.IsAdmin===true;
  const maxAmount=Math.max(...ranking.map(row=>Number(row.TotalAmount||0)),1); const maxCycle=Math.max(...cycles.map(row=>Number(row.Total||0)),1);
  const expectedPayers=isAdmin?Number(summary.MaxMembers||0):Number(summary.MemberCount||0);
  const paymentRate=expectedPayers?Math.round(Number(summary.PaidCount||0)/expectedPayers*100):0;
  const monthlyTrend=cycles.slice(-8);

  return <div className="group-statistics page-enter">
    <div className="topbar">
      <div>
        <Link to={`/group/${id}`} className="back-link" aria-label="Back to group"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
        <div className="ptitle">{isAdmin?'Group Statistics':'My Statistics'}</div>
        <div className="psub">{summary.GroupName} · Cycle {summary.CurrentCycle}</div>
      </div>
    </div>

    <section className="group-stat-kpis" aria-label="Group summary">{[
      ['money',fmt(summary.TotalCollected),isAdmin?'Total collected':'My total paid','success'],
      ['bank',fmt(summary.TotalPayout),isAdmin?'Total payouts':'My payouts','gold'],
      ['check',summary.PaidCount||0,isAdmin?'Paid this cycle':'My payments','success'],
      ['rotate',summary.CurrentCycle||0,'Current cycle','neutral']
    ].map(([icon,value,label,tone])=><article key={label}><span className={tone}><SvgIcon name={icon} size={20}/></span><div><p>{label}</p><strong>{value}</strong><small>{label==='Paid this cycle'?`${paymentRate}% of expected members`:summary.GroupName}</small></div></article>)}</section>

    <section className="group-stat-chart-grid">
      <StatusChart title={isAdmin?'Contribution performance':'My contribution performance'} subtitle="Current status across recorded payments" rows={contributionStatus} emptyLabel="No contribution data yet"/>
      <StatusChart title={isAdmin?'Payout performance':'My payout performance'} subtitle="Current status across recorded payouts" rows={payoutStatus} emptyLabel="No payout data yet"/>
    </section>

    <section className="group-stat-main-grid">
      <article className="group-stat-panel group-ranking">
        <div className="group-stat-head"><div><h2>{isAdmin?'Member ranking':'My contribution'}</h2><p>Based on confirmed contributions</p></div><SvgIcon name="trophy" size={21}/></div>
        <div className="ranking-list">{ranking.map((row,index)=><div className="ranking-row" key={row.UserId||row.Name}>
          <span className={`rank-number rank-${index+1}`}>{index+1}</span>
          <div className="ranking-avatar" style={{background:row.AvatarColor||'var(--sage)'}}>{row.ProfilePicture?<img src={apiAssetUrl(row.ProfilePicture)} alt={`${row.Name||'Member'} profile`}/>:String(row.Name||'?').split(' ').slice(0,2).map(word=>word[0]).join('')}</div>
          <div className="ranking-member"><div><strong>{row.Name||'Member'}</strong><b>{fmt(row.TotalAmount)}</b></div><small>{row.TotalPaid||0} confirmed payment{Number(row.TotalPaid)===1?'':'s'}</small><span><i style={{width:`${Number(row.TotalAmount||0)/maxAmount*100}%`}}/></span></div>
        </div>)}{!ranking.length&&<div className="group-stat-empty">No confirmed contributions yet</div>}</div>
      </article>

      <article className="group-stat-panel group-live-activity">
        <div className="group-stat-head"><div><h2>Live group activity</h2><p>Only events from {summary.GroupName}</p></div><span className="live-dot">Live</span></div>
        <div className="activity-list">{activity.slice(0,10).map(item=><div className="activity-item" key={item.Id}>
          <div className={`activity-icon ${String(item.Severity||'info').toLowerCase()}`}><SvgIcon name={activityIcon(item.Category)} size={17}/></div>
          <div><strong>{item.Title}</strong><p>{item.Description||'Group activity recorded'}</p><span>{ago(item.CreatedAt)}</span></div>{item.Amount!=null&&<b>{fmt(item.Amount)}</b>}
        </div>)}{!activity.length&&<div className="group-stat-empty">No group activity has been recorded yet.</div>}</div>
      </article>
    </section>

    <section className="group-stat-bottom-grid">
      <article className="group-stat-panel cycle-trend"><div className="group-stat-head"><div><h2>Cycle progress</h2><p>Confirmed savings by cycle</p></div><SvgIcon name="trend" size={20}/></div>
        {monthlyTrend.map(c=><div className="cycle-row" key={c.CycleNumber}><span>Cycle {c.CycleNumber}</span><div><i style={{width:`${Number(c.Total||0)/maxCycle*100}%`}}/></div><strong>{fmt(c.Total)}</strong><small>{c.Count} payment{Number(c.Count)===1?'':'s'}</small></div>)}
        {!monthlyTrend.length&&<div className="group-stat-empty">No cycle data yet</div>}
      </article>
      <article className="group-stat-panel group-health"><div className="group-stat-head"><div><h2>{isAdmin?'Group health':'My account summary'}</h2><p>At-a-glance performance</p></div></div><div>{[
        ['Payment rate',`${paymentRate}%`,'Members paid this cycle'],['Collected',fmt(summary.CollectedThisCycle),'This cycle so far'],
        ['Expected',fmt(Number(summary.ContributionAmount||0)*(isAdmin?Number(summary.MaxMembers||0):1)),'Current cycle target'],['Payouts',fmt(summary.TotalPayout),'Across recorded payouts']
      ].map(([label,value,note])=><section key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></section>)}</div></article>
    </section>
  </div>;
}
