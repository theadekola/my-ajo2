import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPut } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import BankNameField from '../components/BankNameField.jsx';
import ConfirmBankDetailsModal from '../components/ConfirmBankDetailsModal.jsx';
import SvgIcon from '../components/SvgIcon.jsx';

const EMPTY_BANK_DETAILS = { bankName:'', bankAccountNumber:'', bankAccountName:'', bankRoutingCode:'' };

export default function GroupBankDetails() {
  const { id } = useParams();
  const { user, refreshUser, showToast } = useAuth();
  const [group, setGroup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_BANK_DETAILS);
  const [editing, setEditing] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    apiGet('/groups/' + id).then(setGroup).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user) return;
    const loaded = {
      bankName: user.BankName || '',
      bankAccountNumber: user.BankAccountNumber || '',
      bankAccountName: user.BankAccountName || '',
      bankRoutingCode: user.BankRoutingCode || ''
    };
    setForm(loaded); setEditing(!loaded.bankName);
  }, [user]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const requestSave = e => { e.preventDefault(); setConfirming(true); };
  const save = async () => {
    setBusy(true);
    try {
      await apiPut('/users/me/bank-details', {
        bankName: form.bankName,
        bankAccountNumber: form.bankAccountNumber,
        bankAccountName: form.bankAccountName,
        bankRoutingCode: user?.CountryCode === 'NG' ? '' : form.bankRoutingCode
      });
      await refreshUser();
      setConfirming(false); setEditing(false);
      showToast('Bank details saved!');
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/"+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">My Bank Details</div>
          <div className="psub">{group?.GroupName || 'Group'} payout information</div>
        </div>
        <button className="btn btn-g" type={editing?'submit':'button'} form={editing?'bank-details-form':undefined} onClick={editing?undefined:()=>setEditing(true)}>{editing?'Save':'Edit'}</button>
      </div>

      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ background: 'rgba(33,150,243,.07)', border: '1.5px solid rgba(33,150,243,.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: 'var(--blue)', lineHeight: 1.6 }}>
          These details are used by the group admin when it is your turn to receive payout.
        </div>

        <form id="bank-details-form" onSubmit={requestSave}>
          <BankNameField countryCode={user?.CountryCode} value={form.bankName} onChange={bankName=>setForm(f=>({...f,bankName}))} required disabled={!editing} />
          <div className="fg"><label className="fl">ACCOUNT NUMBER / IBAN</label><input className="fi" required disabled={!editing} value={form.bankAccountNumber} onChange={set('bankAccountNumber')} placeholder="0123456789" /></div>
          <div className="fg"><label className="fl">ACCOUNT NAME</label><input className="fi" required disabled={!editing} value={form.bankAccountName} onChange={set('bankAccountName')} placeholder="Your full name as on account" /></div>
          {user?.CountryCode !== 'NG' && <div className="fg"><label className="fl">SORT CODE / ROUTING NUMBER</label><input className="fi" disabled={!editing} value={form.bankRoutingCode} onChange={set('bankRoutingCode')} placeholder="Optional" /></div>}
        </form>
      </div>
      <ConfirmBankDetailsModal open={confirming} bankName={form.bankName} accountNumber={form.bankAccountNumber} accountName={form.bankAccountName} routingCode={user?.CountryCode === 'NG' ? '' : form.bankRoutingCode} busy={busy} onCancel={()=>setConfirming(false)} onConfirm={save} />
    </div>
  );
}
