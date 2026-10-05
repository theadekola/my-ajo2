import { useEffect, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { currencyInputChange, formatCurrencyInput, parseCurrencyValue } from '../utils/currencyInput.js';
import FundsHandlingNotice from '../components/FundsHandlingNotice.jsx';

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
]);
const ALLOWED_RECEIPT_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read receipt evidence. Please choose the file again.'));
    reader.readAsDataURL(file);
  });
}

export default function MakePayment() {
  const { id } = useParams();
  const { fmt, showToast, sym } = useAuth();
  const [group, setGroup] = useState(null);
  const [payInfo, setPayInfo] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'BankTransfer', referenceNo: '', note: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingPayInfo, setLoadingPayInfo] = useState(true);
  const [loadError, setLoadError] = useState('');
  const requiresReceipt = form.method === 'BankTransfer';
  const usesPaystack = false;
  const hasPaymentDetails = Boolean(
    payInfo &&
    String(payInfo.BankName || '').trim() &&
    String(payInfo.AccountNumber || '').trim() &&
    String(payInfo.AccountName || '').trim()
  );
  const pageLoaded = !loadingGroup && !loadingPayInfo;
  const canSubmit = pageLoaded && !busy && hasPaymentDetails && !!parseCurrencyValue(form.amount) && (!requiresReceipt || !!file);

  useEffect(() => {
    let alive = true;
    setLoadingGroup(true);
    setLoadingPayInfo(true);
    setLoadError('');
    setPayInfo(null);
    apiGet('/groups/' + id)
      .then(g => {
        if (!alive) return;
        setGroup(g);
        setForm(f => ({ ...f, amount: formatCurrencyInput(g.ContributionAmount) }));
      })
      .catch(ex => { if (alive) setLoadError(ex.message || 'Could not load group details.'); })
      .finally(() => { if (alive) setLoadingGroup(false); });
    apiGet('/payment-info/' + id)
      .then(info => { if (alive) setPayInfo(info || null); })
      .catch(ex => { if (alive) setLoadError(ex.message || 'Could not load payment details.'); })
      .finally(() => { if (alive) setLoadingPayInfo(false); });
    return () => { alive = false; };
  }, [id]);


  const submit = async e => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const amount = parseCurrencyValue(form.amount);
      if (!amount || amount <= 0) throw new Error('Enter a valid amount.');
      if (requiresReceipt && !file) throw new Error('Please upload transfer evidence before submitting payment.');
      if (file) {
        const hasAllowedType = ALLOWED_RECEIPT_TYPES.has(file.type) && ALLOWED_RECEIPT_EXTENSIONS.test(file.name);
        if (!hasAllowedType) throw new Error('Upload a JPG, PNG, WebP, HEIC, HEIF, or PDF receipt.');
        if (file.size > MAX_RECEIPT_SIZE) throw new Error('Receipt upload must be 5 MB or smaller.');
      }
      const receiptDataUrl = file ? await fileToDataUrl(file) : '';
      await apiPost('/contributions', {
        groupId: id,
        amount,
        method: form.method,
        referenceNo: form.referenceNo,
        note: form.note,
        receiptDataUrl,
        receiptFileName: file?.name || '',
        receiptMimeType: file?.type || ''
      });
      setDone(true);
      showToast('Payment submitted! Admin will confirm shortly.');
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  if (done) return (
    <div className="page-enter">
      <Link to={'/group/' + id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ marginBottom: 16, color: 'var(--green)' }}><SvgIcon name="check" size={64} /></div>
        <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--deep)', marginBottom: 8 }}>Payment Submitted!</div>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>Your admin will review and confirm your payment shortly.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-gh" onClick={() => setDone(false)}>Pay Again</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={'/group/' + id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Make Payment</div>
          <div className="psub">{group?.GroupName} - Cycle #{group?.CurrentCycle}</div>
        </div>
      </div>

      <FundsHandlingNotice style={{ marginBottom: 18 }} />

      <div className="two-col">
        <div>
          {!pageLoaded && !loadError && (
            <div className="card" style={{ padding: 18, marginBottom: 18, color: 'var(--muted)', fontSize: 13 }}>
              Loading payment details...
            </div>
          )}
          {loadError && (
            <div className="err-msg" style={{ marginBottom: 18 }}>{loadError}</div>
          )}
          {pageLoaded && hasPaymentDetails && !usesPaystack && (
            <div className="card" style={{ padding: 18, marginBottom: 18, background: 'linear-gradient(135deg,var(--deep),var(--forest))' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 10, fontWeight: 600 }}>PAYMENT DETAILS - send to:</div>
              {[['Bank', payInfo.BankName], ['Account No.', payInfo.AccountNumber], ['Account Name', payInfo.AccountName], payInfo.RoutingCode && ['Sort/Routing', payInfo.RoutingCode]].filter(Boolean).map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 13 }}>
                  <span style={{ color: 'rgba(255,255,255,.5)' }}>{l}</span><span style={{ fontWeight: 700, color: '#fff' }}>{v}</span>
                </div>
              ))}
              {payInfo.Instructions && <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{payInfo.Instructions}</div>}
            </div>
          )}
          {pageLoaded && !loadError && !hasPaymentDetails && !usesPaystack && (
            <div className="err-msg" style={{ marginBottom: 18 }}>
              Payment details are not available yet. Please wait for the group admin to add bank details before making a payment.
            </div>
          )}
          <div className="card">
            <div className="card-hd"><div className="card-ttl">Submit Payment</div></div>
            <div style={{ padding: '16px 18px' }}>
              {err && <div className="err-msg">{err}</div>}
              <form onSubmit={submit}>
                <div className="fg"><label className="fl">AMOUNT</label><div className="aiw"><span className="ac">{sym}</span><input className="fi" type="text" required inputMode="decimal" disabled={!pageLoaded || !hasPaymentDetails} value={form.amount} onChange={currencyInputChange(value => setForm(f => ({ ...f, amount: value })))} placeholder="10,000" /></div></div>
                <div className="fg"><label className="fl">PAYMENT METHOD</label>
                  <select className="fs" value={form.method} disabled={!pageLoaded || !hasPaymentDetails} onChange={e => { setForm(f => ({ ...f, method: e.target.value })); setErr(''); }}>
                    <option value="BankTransfer">Bank Transfer</option>
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>Bank transfer requires receipt evidence.</div>
                </div>
                {!usesPaystack && <>
                  <div className="fg"><label className="fl">REFERENCE / RECEIPT NO.</label><input className="fi" disabled={!pageLoaded || !hasPaymentDetails} value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} placeholder="e.g. TXN-0081" /></div>
                  <div className="fg"><label className="fl">UPLOAD RECEIPT / SCREENSHOT {requiresReceipt ? '(required)' : '(optional)'}</label>
                    <input type="file" accept="image/*,.pdf" required={requiresReceipt} disabled={!pageLoaded || !hasPaymentDetails} className="fi" style={{ padding: '8px' }} onChange={e => setFile(e.target.files[0] || null)} />
                    {pageLoaded && hasPaymentDetails && requiresReceipt && !file && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 5 }}>Bank transfer requires evidence before you can submit.</div>}
                    {file && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 5 }}>Evidence attached: {file.name}</div>}
                  </div>
                </>}
                <div className="fg"><label className="fl">NOTE (optional)</label><input className="fi" disabled={!pageLoaded || !hasPaymentDetails} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="April contribution" /></div>
                <button className="btn btn-g" type="submit" disabled={!canSubmit} style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 14 }}>
                  {busy ? 'Submitting...' : <><SvgIcon name="contribution" size={16} /> Submit Payment</>}
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 20, height: 'fit-content' }}>
          <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Summary</div>
          {[['Group', group?.GroupName], ['Frequency', group?.Frequency], ['Cycle', '#' + (group?.CurrentCycle)], ['Method', form.method || '-']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.05)', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid rgba(0,0,0,.08)', marginTop: 14, paddingTop: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total Due</span>
            <span style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{form.amount ? fmt(parseCurrencyValue(form.amount)) : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
