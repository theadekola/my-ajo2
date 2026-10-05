import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon from '../components/SvgIcon.jsx';
import { currencyInputChange, formatCurrencyInput, parseCurrencyValue } from '../utils/currencyInput.js';

export default function Calculator() {
  const { sym } = useAuth();
  const [form, setForm] = useState({ amount:formatCurrencyInput(10000), members:10, frequency:'Monthly', position:1 });
  const set = k => e => setForm(f=>({...f,[k]:parseFloat(e.target.value)||e.target.value}));
  const amountValue = parseFloat(parseCurrencyValue(form.amount) || 0);

  const periods = form.frequency==='Weekly'?52:form.frequency==='Bi-weekly'?26:12;
  const payoutValue = amountValue * parseFloat(form.members||1);
  const cyclesPerYear = periods;
  const waitCycles = parseInt(form.position||1) - 1;
  const waitMonths = form.frequency==='Weekly' ? (waitCycles/4.33).toFixed(1) : form.frequency==='Bi-weekly' ? (waitCycles/2.17).toFixed(1) : waitCycles;
  const totalDuration = parseInt(form.members||1);
  const durationLabel = form.frequency==='Weekly'?`${totalDuration} weeks`:form.frequency==='Bi-weekly'?`${totalDuration*2} weeks`:`${totalDuration} months`;

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/more" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Ajo Calculator</div>
          <div className="psub">Plan your savings circle</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-hd"><div className="card-ttl">Inputs</div></div>
          <div style={{padding:'0 18px 20px'}}>
            <div className="fg" style={{marginTop:16}}>
              <label className="fl">CONTRIBUTION AMOUNT PER PERIOD</label>
              <div className="aiw"><span className="ac">{sym}</span><input className="fi" type="text" value={form.amount} onChange={currencyInputChange(value=>setForm(f=>({...f,amount:value})))} inputMode="decimal" placeholder="10,000"/></div>
            </div>
            <div className="fg">
              <label className="fl">NUMBER OF MEMBERS</label>
              <input className="fi" type="number" min={2} max={200} value={form.members} onChange={set('members')} inputMode="numeric"/>
            </div>
            <div className="fg">
              <label className="fl">CONTRIBUTION FREQUENCY</label>
              <select className="fs" value={form.frequency} onChange={set('frequency')}>
                <option>Weekly</option><option>Bi-weekly</option><option>Monthly</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">YOUR PAYOUT POSITION (SLOT)</label>
              <input className="fi" type="number" min={1} max={parseInt(form.members)||10} value={form.position} onChange={set('position')} inputMode="numeric"/>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Position 1 receives first, position {form.members} receives last.</div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{background:'linear-gradient(135deg,var(--deep),var(--forest))',color:'#fff',marginBottom:16}}>
            <div style={{padding:24,textAlign:'center'}}>
              <div style={{fontSize:13,color:'rgba(255,255,255,.5)',marginBottom:4,fontWeight:600,letterSpacing:1}}>YOU WILL RECEIVE</div>
              <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:42,fontWeight:900,color:'var(--gold)'}}>{sym}{Number(payoutValue).toLocaleString()}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,.5)',marginTop:4}}>Total payout value</div>
            </div>
          </div>

          <div className="card" style={{padding:0,overflow:'hidden'}}>
            {[
              ['money','Per Period Contribution',`${sym}${Number(amountValue).toLocaleString()}`],
              ['users','Total Members',form.members],
              ['rotate','Frequency',form.frequency],
              ['calendar','Group Duration',durationLabel],
              ['clock','Wait for Your Payout',waitCycles===0?'You go first!':`~${waitMonths} ${form.frequency==='Monthly'?'months':'weeks'}`],
              ['trophy','Your Slot',`#${form.position} of ${form.members}`],
              ['trend','Total Group Savings',`${sym}${Number(payoutValue*parseInt(form.members||1)).toLocaleString()}`],
            ].map(([ic,l,v],i)=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:14,padding:'13px 18px',borderBottom:i<6?'1px solid rgba(0,0,0,.05)':'none'}}>
                <span style={{width:28,textAlign:'center',color:'var(--gold)'}}><SvgIcon name={ic} size={20} /></span>
                <div style={{flex:1,fontSize:13,color:'var(--muted)'}}>{l}</div>
                <div style={{fontWeight:700,fontSize:13,color:'var(--deep)'}}>{v}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{padding:18,marginTop:0}}>
            <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:14,fontWeight:700,marginBottom:12}}>Payout Timeline</div>
            <div style={{display:'flex',gap:4,overflow:'hidden'}}>
              {Array.from({length:Math.min(parseInt(form.members)||1,10)},(_,i)=>(
                <div key={i} style={{flex:1,minWidth:0,background:i===parseInt(form.position)-1?'var(--gold)':'var(--mist)',borderRadius:6,padding:'6px 2px',textAlign:'center',fontSize:10,fontWeight:i===parseInt(form.position)-1?800:500,color:i===parseInt(form.position)-1?'var(--deep)':'var(--muted)',transition:'all .3s'}}>
                  {i+1}
                </div>
              ))}
              {parseInt(form.members)>10 && <div style={{display:'flex',alignItems:'center',fontSize:11,color:'var(--muted)',padding:'0 4px'}}>+{parseInt(form.members)-10}</div>}
            </div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>Your slot highlighted in gold</div>
          </div>
        </div>
      </div>
    </div>
  );
}
