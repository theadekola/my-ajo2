import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiUrl } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon from '../components/SvgIcon.jsx';

const FILTERS = ['all','contributions','payments','groups','members','payouts','security'];
const iconFor = category => ({ contributions:'contribution', payments:'money', groups:'users', members:'user', payouts:'bank', security:'shield' }[category] || 'bell');
const timeAgo = value => {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
const payoutDate = (value, options) => {
  if (!value) return '';
  const raw = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}/.test(raw) ? `${raw.slice(0,10)}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, options);
};

export default function Dashboard() {
  const { user, fmt, canCreateGroups } = useAuth();
  const [kpi, setKpi] = useState({});
  const [groups, setGroups] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [summary,setSummary]=useState(null);

  const loadActivity = useCallback(async category => {
    const query = category && category !== 'all' ? `&category=${encodeURIComponent(category)}` : '';
    const data = await apiGet(`/dashboard/activity?limit=30${query}`);
    setActivity(Array.isArray(data?.items) ? data.items : []);
  }, []);

  useEffect(() => {
    Promise.all([
      apiGet('/users/dashboard'), apiGet('/groups'), apiGet('/contributions'), apiGet('/payouts'), loadActivity('all'),
    ]).then(([dashboard, groupData, contributionData, payoutData]) => {
      setKpi(dashboard || {}); setGroups(Array.isArray(groupData) ? groupData : []);
      setContributions(Array.isArray(contributionData) ? contributionData : []);
      setPayouts(Array.isArray(payoutData) ? payoutData : []);
    }).catch(error => {
      console.error('Dashboard data could not be loaded', error);
    }).finally(() => setLoading(false));
  }, [loadActivity]);
  useEffect(()=>{apiGet('/insights/summary').then(setSummary).catch(()=>{});},[]);

  useEffect(() => { if (!loading) loadActivity(filter).catch(() => {}); }, [filter, loadActivity, loading]);
  useEffect(() => {
    const source = new EventSource(apiUrl('/api/dashboard/activity/stream'), { withCredentials:true });
    source.addEventListener('activity', event => {
      const item = JSON.parse(event.data);
      if (filter === 'all' || item.Category === filter) setActivity(items => [item, ...items].slice(0, 30));
    });
    return () => source.close();
  }, [filter]);

  const confirmed = contributions.filter(item => item.Status === 'Confirmed');
  const pending = contributions.filter(item => item.Status === 'Pending' || item.Status === 'Overdue');
  const thisMonth = confirmed.filter(item => {
    const date = new Date(item.PaidAt); const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const nextPayout = payouts.filter(item => item.Status === 'Scheduled' && item.ScheduledFor).sort((a,b) => new Date(a.ScheduledFor)-new Date(b.ScheduledFor))[0];
  const nextPayoutAt = nextPayout?.ScheduledFor || kpi.NextPayoutDate;
  const nextPayoutGroup = nextPayout?.GroupName || kpi.NextPayoutGroup;
  const paidRate = contributions.length ? Math.round(confirmed.length / contributions.length * 100) : 0;
  const groupPerformance = useMemo(() => groups.slice(0,4).map(group => ({
    name:group.GroupName, value:group.MemberCount ? Math.round((group.PaidCount || 0) / group.MemberCount * 100) : 0,
  })), [groups]);
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const kpis = [
    { icon:'money', label:'Total savings', value:fmt(kpi.TotalContributed || 0), note:'Across all your groups', tone:'success' },
    { icon:'contribution', label:'This month', value:fmt(thisMonth.reduce((sum,item)=>sum+Number(item.Amount||0),0)), note:`${thisMonth.length} contributions received`, tone:'success' },
    { icon:'calendar', label:'Next payout', value:payoutDate(nextPayoutAt,{day:'numeric',month:'short',year:'numeric'}) || '—', note:nextPayoutGroup || 'Nothing scheduled', tone:'neutral' },
    { icon:'users', label:'Active groups', value:kpi.ActiveGroups ?? 0, note:`${groups.length} visible to you`, tone:'neutral' },
  ];

  return <div className="dashboard-modern page-enter">
    <div className="dashboard-hero">
      <div><div className="ptitle">{greet}, {user?.FirstName}</div><div className="psub">Here’s what’s happening across your savings today.</div></div>
      <Link className="dashboard-notification" to="/notifications" aria-label="Open notifications"><SvgIcon name="bell" size={20}/><span>{kpi.UnreadNotifications || 0}</span></Link>
    </div>

    <section className="modern-kpi-grid" aria-label="Account summary">
      {kpis.map(item => <article className="modern-kpi" key={item.label}>
        <div className={`modern-kpi-icon ${item.tone}`}><SvgIcon name={item.icon} size={21}/></div>
        <div><div className="modern-kpi-label">{item.label}</div><div className="modern-kpi-value">{loading ? '—' : item.value}</div><div className="modern-kpi-note">{item.note}</div></div>
      </article>)}
    </section>

    <section className="dashboard-insight-grid">
      <article className="dash-panel savings-panel">
        <div className="dash-panel-head"><div><h2>Savings performance</h2><p>Your confirmed contribution health</p></div><span className="badge b-green">Live</span></div>
        <div className="performance-visual">
          <div className="donut" style={{'--paid':`${paidRate * 3.6}deg`}}><strong>{paidRate}%</strong><span>received</span></div>
          <div className="performance-copy"><strong>{fmt(confirmed.reduce((sum,item)=>sum+Number(item.Amount||0),0))}</strong><span>Total confirmed</span><div><i className="legend-dot paid"/> Paid {paidRate}%</div><div><i className="legend-dot pending"/> Outstanding {100-paidRate}%</div></div>
        </div>
      </article>
      <article className="dash-panel next-panel">
        <div className="dash-panel-head"><div><h2>Next payout</h2><p>Your upcoming disbursement</p></div><SvgIcon name="calendar" size={20}/></div>
        {nextPayoutAt ? <><div className="next-payout-value">{payoutDate(nextPayoutAt,{weekday:'short',day:'numeric',month:'short'})}</div><strong>{nextPayoutGroup || 'Your payout'}</strong><p>{payoutDate(nextPayoutAt,{day:'numeric',month:'long',year:'numeric'})}{nextPayout?.Amount != null ? ` · ${fmt(nextPayout.Amount)}` : ''}</p></> : <div className="empty-modern">No payout is currently scheduled.</div>}
      </article>
    </section>

    <section className="dashboard-work-grid">
      <article className="dash-panel activity-panel">
        <div className="dash-panel-head"><div><h2>Live activity</h2><p>Updates relevant to your role and groups</p></div><span className="live-dot">Live</span></div>
        <div className="feed-filters">{FILTERS.map(item => <button key={item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div>
        <div className="activity-list">{activity.slice(0,8).map(item => <div className="activity-item" key={item.Id}>
          <div className={`activity-icon ${String(item.Severity||'info').toLowerCase()}`}><SvgIcon name={iconFor(item.Category)} size={17}/></div>
          <div><strong>{item.Title}</strong><p>{item.Description || item.GroupName || 'Account activity'}</p><span>{item.GroupName ? `${item.GroupName} · ` : ''}{timeAgo(item.CreatedAt)}</span></div>
          {item.Amount != null && <b>{fmt(item.Amount)}</b>}
        </div>)}{!activity.length && <div className="empty-modern">No activity matches this filter yet.</div>}</div>
      </article>
      <aside className="dashboard-side-stack">
        <article className="dash-panel attention-panel"><div className="dash-panel-head"><div><h2>Attention required</h2><p>What to do next</p></div></div>
          {pending.length ? <div className="attention-row"><span><SvgIcon name="warning" size={18}/></span><div><strong>{pending.length} contributions pending</strong><p>{fmt(pending.reduce((s,i)=>s+Number(i.Amount||0),0))} awaiting review</p></div><Link to="/contributions">Review</Link></div> : <div className="attention-clear"><SvgIcon name="check" size={18}/> You’re all caught up</div>}
          {canCreateGroups && nextPayout && <div className="attention-row"><span><SvgIcon name="clock" size={18}/></span><div><strong>Payout scheduled</strong><p>Confirm readiness before release</p></div><Link to="/groups">Open</Link></div>}
        </article>
        <article className="dash-panel quick-panel"><div className="dash-panel-head"><div><h2>Quick actions</h2><p>Common tasks</p></div></div><div className="quick-actions">
          <Link to="/groups"><SvgIcon name="contribution" size={18}/> Add contribution</Link>
          <Link to="/groups"><SvgIcon name="users" size={18}/> {canCreateGroups?'Create group':'Browse groups'}</Link>
          <Link to="/calendar"><SvgIcon name="calendar" size={18}/> View calendar</Link>
          <Link to="/notifications"><SvgIcon name="bell" size={18}/> Notifications</Link>
        </div></article>
      </aside>
    </section>

    <section className="dashboard-bottom-grid">
      <article className="dash-panel"><div className="dash-panel-head"><div><h2>Group performance</h2><p>Current-cycle contribution completion</p></div><Link to="/groups">View groups</Link></div>{groupPerformance.map(group=><div className="performance-row" key={group.name}><span>{group.name}</span><div><i style={{width:`${group.value}%`}}/></div><strong>{group.value}%</strong></div>)}{!groupPerformance.length&&<div className="empty-modern">Join or create a group to see performance.</div>}</article>
      <article className="dash-panel insight-card"><span>{summary?.source==='openai'?'AI summary':'Financial insight'}</span><h2>{summary?.text||`${paidRate}% of submitted contributions are confirmed.`}</h2><p>{pending.length ? `${pending.length} contributions still need attention.` : 'No outstanding submissions need attention.'}</p><Link to="/contributions">Explore contributions →</Link></article>
    </section>
  </div>;
}
