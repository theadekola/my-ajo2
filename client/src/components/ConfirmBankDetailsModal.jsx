import SvgIcon from './SvgIcon.jsx';
export default function ConfirmBankDetailsModal({ open, bankName, accountNumber, accountName, routingCode, busy, onCancel, onConfirm }) {
  if (!open) return null;
  const rows = [
    ['Bank', bankName],
    ['Account number / IBAN', accountNumber],
    ['Account name', accountName],
    routingCode ? ['Sort code / Routing', routingCode] : null
  ].filter(Boolean);

  return (
    <div className="modal-ov open" onClick={event=>event.target===event.currentTarget && !busy && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-bank-title">
        <button className="modal-close" type="button" onClick={onCancel} disabled={busy} aria-label="Close"><SvgIcon name="x" size={18} /></button>
        <div className="modal-ttl" id="confirm-bank-title">Confirm bank details</div>
        <div className="modal-sub">Please check the information carefully before saving.</div>
        <div style={{background:'var(--mist)',borderRadius:12,padding:'8px 14px',margin:'16px 0'}}>
          {rows.map(([label, value])=>(
            <div key={label} style={{display:'flex',justifyContent:'space-between',gap:16,padding:'9px 0',borderBottom:'1px solid rgba(0,0,0,.06)',fontSize:13}}>
              <span style={{color:'var(--muted)'}}>{label}</span>
              <strong style={{textAlign:'right',overflowWrap:'anywhere'}}>{value}</strong>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-gh" type="button" onClick={onCancel} disabled={busy} style={{flex:1,justifyContent:'center'}}><SvgIcon name="x" size={16} /> Go Back</button>
          <button className="btn btn-g" type="button" onClick={onConfirm} disabled={busy} style={{flex:1.5,justifyContent:'center'}}>{busy ? 'Saving...' : 'Confirm & Save'}</button>
        </div>
      </div>
    </div>
  );
}
