import { useEffect, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const FAQS = [
  ['What is My Ajo?', 'My Ajo is a digital platform for running rotating savings circles. Members contribute a fixed amount each period, and each member takes turns receiving the full pot.'],
  ['Can I be in multiple groups?', 'Yes. You can join or create more than one group, depending on your role and each group admin approval.'],
  ['What happens if I miss a payment?', 'Contact your group admin quickly. Penalties or next steps depend on the group rules.'],
  ['How is my money protected?', 'My Ajo helps with tracking and coordination. Money is transferred directly between members, so always verify group and payment details before sending funds.'],
  ['How do I change my role?', 'Contact support. Roles are set at registration and cannot be changed directly inside your profile.'],
  ['How do I delete my account?', 'Use the danger zone at the bottom of this page. Deletion is permanent and some audit records may remain where required.'],
];

export default function Help() {
  const { user, logout } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteInfo, setDeleteInfo] = useState(null);
  const navigate = useNavigate();
  const expectedFullName = [user?.FirstName, user?.LastName].filter(Boolean).join(' ').trim();
  const typedNameMatches = expectedFullName && confirmName.trim().toLowerCase() === expectedFullName.toLowerCase();
  const blockingAdminGroups = deleteInfo?.adminGroups || [];
  const memberDeletionGroups = (deleteInfo?.memberships || []).filter(group => group.Role !== 'Admin');
  const canDeleteAccount = user?.SystemRole !== 'SuperAdmin' && !user?.IsProtectedAccount;

  useEffect(() => {
    if (!showDelete) return;
    let cancelled = false;
    setDeleteInfo(null);
    apiGet('/auth/me/delete-info')
      .then(data => { if (!cancelled) setDeleteInfo(data || { memberships: [], adminGroups: [] }); })
      .catch(() => { if (!cancelled) setDeleteInfo({ memberships: [], adminGroups: [] }); });
    return () => { cancelled = true; };
  }, [showDelete]);

  const deleteAccount = async () => {
    if (!typedNameMatches) {
      setDeleteError('Type your full name exactly to confirm deletion');
      return;
    }
    setDeleteError('');
    setBusy(true);
    try {
      const result = await apiPost('/auth/me/delete', { feedback, rating, confirmName: confirmName.trim() });
      window.alert(result?.message || 'Your account has been made inactive and scheduled for deletion.');
      logout();
      navigate('/');
    } catch (ex) {
      setDeleteError(ex.message || 'Deletion failed. Please try again.');
      setBusy(false);
    }
  };

  const supportLinks = [
    { icon: 'book', t: 'User Guide', s: 'Step-by-step app guide', to: '/user-guide' },
    { icon: 'mail', t: 'Email Support', s: 'support@my-ajo.org', to: '/support-email' },
    { icon: 'scale', t: 'Terms of Service', s: 'App rules', to: '/terms' },
    { icon: 'lock', t: 'Privacy Policy', s: 'How we use your data', to: '/privacy' },
  ];

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/more" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Support</div>
          <div className="psub">Help, FAQ, contact, terms and privacy</div>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 22 }}>
        {supportLinks.map(link => (
          <Link key={link.t} to={link.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div className="row-ic" aria-hidden="true" style={{ width: 44, height: 44, fontSize: 20, background: 'rgba(200,151,58,.1)' }}><SvgIcon name={link.icon} size={22} /></div>
              <div><div style={{ fontWeight: 700, color: 'var(--deep)' }}>{link.t}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{link.s}</div></div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-hd"><div className="card-ttl"><SvgIcon name="help" size={18} /> Frequently Asked Questions</div></div>
        {FAQS.map(([q, a], i) => (
          <div key={q} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
            <div style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 13 }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              {q}<SvgIcon name="chevronDown" size={18} style={{ color: 'var(--gold)', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition:'transform .18s' }}/>
            </div>
            {openFaq === i && <div style={{ padding: '0 20px 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{a}</div>}
          </div>
        ))}
      </div>

      {canDeleteAccount ? <div className="card" style={{ border: '2px solid rgba(198,40,40,.2)', background: 'rgba(198,40,40,.02)' }}>
        <div className="card-hd" style={{ borderBottom: '1px solid rgba(198,40,40,.1)' }}>
          <div><div className="card-ttl" style={{ color: 'var(--red)' }}><SvgIcon name="warning" size={18} /> Warning: Danger Zone</div><div className="card-sub">Permanent actions cannot be undone</div></div>
          <button className="btn btn-red btn-sm" onClick={() => { setConfirmName(''); setDeleteError(''); setDeleteInfo(null); setShowDelete(true); }}>Delete Account</button>
        </div>
      </div> : user?.IsProtectedAccount ? (
        <div className="protected-account-notice">
          <strong>Protected SuperAdmin account</strong>
          <p>This platform-owner account cannot be deleted, deactivated or demoted.</p>
        </div>
      ) : null}

      {canDeleteAccount && showDelete && (
        <div className="modal-ov modal-ov-center open" onClick={event => event.target === event.currentTarget && !busy && setShowDelete(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <button className="modal-close" disabled={busy} onClick={() => setShowDelete(false)} aria-label="Close delete account popup"><SvgIcon name="x" size={18} /></button>
            <div id="delete-account-title" className="modal-ttl" style={{ color: 'var(--red)' }}>Delete your account?</div>
            <div className="modal-sub" style={{ lineHeight: 1.6 }}>
              This action is permanent and cannot be undone. Your account will be disabled and some records may remain where required for audit purposes.
            </div>
            <div className="err-msg" style={{ marginBottom: 18 }}>
              Only continue if you are certain you want to permanently delete your My Ajo account.
            </div>
            {blockingAdminGroups.length > 0 && (
              <div className="err-msg" style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Admin deletion blocked</div>
                <div>You created {blockingAdminGroups.length === 1 ? 'this group' : 'these groups'}. Remove all approved members first before your account can be deleted:</div>
                <ul style={{ margin: '8px 0 0 18px' }}>
                  {blockingAdminGroups.map(group => <li key={group.GroupId}>{group.GroupName} ({group.ActiveMemberCount} member{Number(group.ActiveMemberCount) === 1 ? '' : 's'})</li>)}
                </ul>
              </div>
            )}
            {!blockingAdminGroups.length && memberDeletionGroups.length > 0 && (
              <div className="notice" style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Group approval required</div>
                <div>You are a member of {memberDeletionGroups.length === 1 ? 'this group' : 'these groups'}. A private approval request will be sent to the group admin before your account can be fully deleted:</div>
                <ul style={{ margin: '8px 0 0 18px' }}>
                  {memberDeletionGroups.map(group => <li key={group.GroupId}>{group.GroupName} — admin: {group.AdminName || 'Group admin'}</li>)}
                </ul>
              </div>
            )}
            {!blockingAdminGroups.length && !memberDeletionGroups.length && deleteInfo && (
              <div className="notice" style={{ marginBottom: 18 }}>Your account will become inactive immediately and will be fully deleted after 24 hours. You can recover it by signing in before the 24 hours ends.</div>
            )}
            {deleteError && <div className="err-msg" style={{ marginBottom: 18 }}>{deleteError}</div>}
            <div className="fg">
              <label className="fl">HOW WOULD YOU RATE YOUR EXPERIENCE?</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {[1, 2, 3, 4, 5].map(r => (
                  <button key={r} type="button" onClick={() => setRating(r)} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid ' + (rating >= r ? 'var(--gold)' : 'rgba(0,0,0,.1)'), background: rating >= r ? 'var(--gold-p)' : 'var(--white)', cursor: 'pointer', fontSize: 16 }}>{r}</button>
                ))}
                <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--muted)' }}>{rating}/5</span>
              </div>
            </div>
            <div className="fg">
              <label className="fl">TYPE YOUR FULL NAME TO CONFIRM</label>
              <input
                className="fi"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={expectedFullName || 'Your full name'}
                autoComplete="name"
                disabled={busy}
              />
              <div style={{ fontSize: 11, color: typedNameMatches ? 'var(--green)' : 'var(--muted)', marginTop: 6 }}>
                {typedNameMatches ? 'Full name matched.' : `Please type: ${expectedFullName || 'your full name'}`}
              </div>
            </div>
            <div className="fg">
              <label className="fl">WHY ARE YOU LEAVING? (OPTIONAL)</label>
              <textarea className="fta" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Help us improve..." disabled={busy} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-gh" disabled={busy} onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn btn-red" disabled={busy || !typedNameMatches || blockingAdminGroups.length > 0} onClick={deleteAccount}>{blockingAdminGroups.length ? 'Resolve Groups First' : (busy ? 'Deleting...' : 'Permanently Delete Account')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


