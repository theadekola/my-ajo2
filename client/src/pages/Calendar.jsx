import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon from '../components/SvgIcon.jsx';

export default function Calendar() {
  const { fmt } = useAuth();
  const [payouts, setPayouts] = useState([]);
  const [assignedPayouts, setAssignedPayouts] = useState([]);
  const [contribs, setContribs] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    apiGet('/payouts').then(data => setPayouts(Array.isArray(data) ? data : [])).catch(() => setPayouts([]));
    apiGet('/contributions').then(data => setContribs(Array.isArray(data) ? data : [])).catch(() => setContribs([]));
    apiGet('/groups')
      .then(async groups => {
        const rows = await Promise.all((Array.isArray(groups) ? groups : []).map(group =>
          apiGet('/members/' + group.GroupId)
            .then(members => (Array.isArray(members) ? members : [])
              .filter(member => member.PayoutDate && member.Status === 'Approved')
              .map(member => ({
                PayoutId: 'assigned-' + member.MemberId,
                GroupId: group.GroupId,
                GroupName: group.GroupName,
                RecipientName: ((member.FirstName || '') + ' ' + (member.LastName || '')).trim() || 'Member',
                ScheduledFor: member.PayoutDate,
                Amount: Number(group.ContributionAmount || 0) * Number(group.MemberCount || group.MaxMembers || 0),
                CycleNumber: group.CurrentCycle,
                Status: 'Assigned',
                IsAssignedDate: true
              })))
            .catch(() => [])))
        setAssignedPayouts(rows.flat());
      })
      .catch(() => setAssignedPayouts([]));
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const selectedInView = selectedDate.getFullYear() === year && selectedDate.getMonth() === month;
  const selectedDay = selectedInView ? selectedDate.getDate() : null;

  const eventsOnDay = day => {
    const d = new Date(year,month,day).toDateString();
    const po = [...payouts, ...assignedPayouts].filter(p => p.ScheduledFor && new Date(p.ScheduledFor).toDateString() === d);
    const co = contribs.filter(c => c.PaidAt && new Date(c.PaidAt).toDateString() === d);
    return { payouts:po, contributions:co };
  };

  const upcoming = [...payouts, ...assignedPayouts].filter(p => p.ScheduledFor && new Date(p.ScheduledFor) >= new Date()).sort((a,b)=>new Date(a.ScheduledFor)-new Date(b.ScheduledFor)).slice(0, 5);
  const selectedEvents = selectedInView ? eventsOnDay(selectedDay) : { payouts:[], contributions:[] };
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthName = viewDate.toLocaleString('default',{month:'long',year:'numeric'});
  const selectedLabel = selectedDate.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const changeMonth = offset => {
    const next = new Date(year, month + offset, 1);
    setViewDate(next);
    setSelectedDate(next);
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/more" className="back-link" aria-label="Back to more"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Calendar</div>
          <div className="psub">Track your contribution and payout dates</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card" style={{padding:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <button className="btn btn-gh btn-sm" onClick={()=>changeMonth(-1)}><SvgIcon name="arrowLeft" size={15}/> Prev</button>
            <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:16,fontWeight:700}}>{monthName}</div>
            <button className="btn btn-gh btn-sm" onClick={()=>changeMonth(1)}>Next <SvgIcon name="arrowRight" size={15}/></button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,textAlign:'center'}}>
            {days.map(d=><div key={d} style={{fontSize:11,fontWeight:700,color:'var(--muted)',padding:'4px 0'}}>{d}</div>)}
            {Array(firstDay).fill(null).map((_,i)=><div key={'e'+i}/>)}
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
              const ev = eventsOnDay(day);
              const today = new Date().getDate()===day&&new Date().getMonth()===month&&new Date().getFullYear()===year;
              const selected = selectedDay===day;
              const hasPayout = ev.payouts.length>0;
              const hasContrib = ev.contributions.length>0;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={()=>setSelectedDate(new Date(year,month,day))}
                  aria-label={`View ${new Date(year,month,day).toLocaleDateString()}`}
                  style={{padding:'6px 0',border:'1.5px solid '+(selected?'var(--gold)':'transparent'),borderRadius:8,background:today?'var(--deep)':selected?'rgba(200,151,58,.18)':'transparent',cursor:'pointer',transition:'background .15s,border-color .15s',fontSize:13,fontWeight:today||selected?700:400,color:today?'#fff':'var(--text)',position:'relative',fontFamily:'inherit'}}
                >
                  {day}
                  {(hasPayout||hasContrib) && <div style={{display:'flex',justifyContent:'center',gap:3,marginTop:2}}>
                    {hasPayout && <div style={{width:5,height:5,borderRadius:'50%',background:'var(--gold)'}}/>}
                    {hasContrib && <div style={{width:5,height:5,borderRadius:'50%',background:'var(--green)'}}/>}
                  </div>}
                </button>
              );
            })}
          </div>

          <div style={{marginTop:16,display:'flex',gap:16,fontSize:11}}>
            <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:'50%',background:'var(--gold)'}}/>Payout</div>
            <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:'50%',background:'var(--green)'}}/>Contribution</div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <div>
              <div className="card-ttl">Selected Date</div>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{selectedLabel}</div>
            </div>
          </div>
          {selectedEvents.payouts.map(p=>(
            <div className="row" key={'p'+p.PayoutId}>
              <div className="row-ic" style={{background:'rgba(200,151,58,.12)'}}><SvgIcon name="bank" size={18} /></div>
              <div style={{flex:1}}>
                <div className="row-name">Payout</div>
                <div className="row-sub">{p.GroupName} - {p.RecipientName}</div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:'var(--deep)'}}>{fmt(p.Amount)}</div>
            </div>
          ))}
          {selectedEvents.contributions.map(c=>(
            <div className="row" key={'c'+c.ContributionId}>
              <div className="row-ic" style={{background:'rgba(46,125,50,.10)'}}><SvgIcon name="check" size={18} /></div>
              <div style={{flex:1}}>
                <div className="row-name">Contribution</div>
                <div className="row-sub">{c.GroupName || 'Group contribution'} - {c.Status || 'Submitted'}</div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:'var(--green)'}}>{fmt(c.Amount)}</div>
            </div>
          ))}
          {!selectedEvents.payouts.length && !selectedEvents.contributions.length && (
            <div style={{padding:24,textAlign:'center',color:'var(--muted)',fontSize:13}}>No payout or contribution on this date</div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="card-hd"><div className="card-ttl">Upcoming Payouts</div></div>
            {upcoming.map(p=>(
              <div className="row" key={p.PayoutId}>
              <div className="row-ic" style={{background:'rgba(200,151,58,.12)'}}><SvgIcon name="bank" size={18} /></div>
                <div style={{flex:1}}>
                  <div className="row-name">{p.RecipientName}</div>
                  <div className="row-sub">{p.GroupName} - Cycle {p.CycleNumber}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--deep)'}}>{fmt(p.Amount)}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{new Date(p.ScheduledFor).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</div>
                </div>
              </div>
            ))}
            {!upcoming.length && <div style={{padding:24,textAlign:'center',color:'var(--muted)',fontSize:13}}>No upcoming payouts</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
