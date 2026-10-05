import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiPost } from '../api/appClient.js';
import { currencyInputChange, parseCurrencyValue } from '../utils/currencyInput.js';
import { groupIconNameFromValue } from '../components/SvgIcon.jsx';
import SvgIcon from '../components/SvgIcon.jsx';
import FundsHandlingNotice from '../components/FundsHandlingNotice.jsx';

const initialForm = () => ({
  groupName: '',
  contributionAmount: '',
  frequency: 'Monthly',
  startDate: new Date().toISOString().slice(0, 10),
  paymentDayOfWeek: 1,
  paymentDayOfMonth: 1,
  maxMembers: 10,
  payoutOrder: 'Fixed',
  icon: '',
  description: ''
});

export default function CreateGroup() {
  const { showToast, user, sym } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await apiPost('/groups', {
        ...form,
        icon: groupIconNameFromValue(form.icon, form.groupName),
        contributionAmount: parseFloat(parseCurrencyValue(form.contributionAmount)),
        maxMembers: parseInt(form.maxMembers, 10)
      });
      showToast('Group created! Add payment details before inviting members.');
      navigate(`/group/${result.GroupId}/payment-info`, { replace: true });
    } catch (ex) {
      setError(ex.message || 'Could not create the group.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter create-group-page">
      <div className="topbar">
        <div>
          <Link to="/groups" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Create New Group</div>
          <div className="psub">Members must be registered in your country ({user?.CountryCode}).</div>
        </div>
      </div>

      <section className="card create-group-page-card">
        <FundsHandlingNotice style={{ margin: '0 0 18px' }} />
        {error && <div className="err-msg" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="fg"><label className="fl">GROUP NAME</label><input className="fi" required value={form.groupName} onChange={e=>setForm(value=>({...value,groupName:e.target.value}))} placeholder="Family Circle" autoFocus/></div>
          <div className="form-row">
            <div className="fg"><label className="fl">AMOUNT</label><div className="aiw"><span className="ac">{sym || user?.CurrencySymbol || '$'}</span><input className="fi" type="text" required inputMode="decimal" value={form.contributionAmount} onChange={currencyInputChange(value=>setForm(current=>({...current,contributionAmount:value})))} placeholder="10,000"/></div></div>
            <div className="fg"><label className="fl">FREQUENCY</label><select className="fs" value={form.frequency} onChange={e=>setForm(value=>({...value,frequency:e.target.value}))}><option>Weekly</option><option>Monthly</option></select></div>
          </div>
          <div className="fg"><label className="fl">START DATE</label><input className="fi" type="date" required min={new Date().toISOString().slice(0,10)} value={form.startDate} onChange={e=>setForm(value=>({...value,startDate:e.target.value}))}/><small className="form-hint">The payment schedule and automatic reminders begin from this date.</small></div>
          {form.frequency === 'Weekly' ? (
            <div className="fg"><label className="fl">PAYMENT DAY</label><select className="fs" required value={form.paymentDayOfWeek} onChange={e=>setForm(value=>({...value,paymentDayOfWeek:Number(e.target.value)}))}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,index)=><option key={day} value={index}>{day}</option>)}</select><small className="form-hint">My Ajo AI will privately remind approved members 48 hours before this day.</small></div>
          ) : (
            <div className="fg"><label className="fl">PAYMENT DATE EACH MONTH</label><select className="fs" required value={form.paymentDayOfMonth} onChange={e=>setForm(value=>({...value,paymentDayOfMonth:Number(e.target.value)}))}>{Array.from({length:28},(_,index)=>index+1).map(day=><option key={day} value={day}>{day}{day===1?'st':day===2?'nd':day===3?'rd':'th'} of every month</option>)}</select><small className="form-hint">My Ajo AI will privately remind approved members 48 hours before this date.</small></div>
          )}
          <div className="form-row">
            <div className="fg"><label className="fl">MAX MEMBERS</label><input className="fi" type="number" required min={2} value={form.maxMembers} onChange={e=>setForm(value=>({...value,maxMembers:e.target.value}))}/></div>
            <div className="fg"><label className="fl">PAYOUT ORDER</label><select className="fs" value={form.payoutOrder} onChange={e=>setForm(value=>({...value,payoutOrder:e.target.value}))}><option>Fixed</option><option>Random</option><option>Bidding</option></select></div>
          </div>
          <div className="fg"><label className="fl">DESCRIPTION</label><textarea className="fta" value={form.description} onChange={e=>setForm(value=>({...value,description:e.target.value}))} placeholder="What is this group for?"/></div>
          <div className="create-group-page-actions">
            <Link className="btn btn-gh" to="/groups">Cancel</Link>
            <button type="submit" className="btn btn-g" disabled={busy}>{busy ? 'Creating…' : 'Create Group'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
