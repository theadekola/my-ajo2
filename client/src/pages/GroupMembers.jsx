import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SvgIcon from '../components/SvgIcon.jsx';
import { formatPaymentMethod } from '../utils/textFormat.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiAssetUrl, apiDelete, apiGet, apiPut } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { saveOrShareBlob } from '../utils/nativeActions.js';

export default function GroupMembers() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, showToast, fmt } = useAuth();
  const [members, setMembers] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [profile, setProfile] = useState(null);
  const [historyMember, setHistoryMember] = useState(null);
  const [history, setHistory] = useState([]);
  const [removeMember, setRemoveMember] = useState(null);
  const [payoutMember, setPayoutMember] = useState(null);
  const [approvalMember, setApprovalMember] = useState(null);
  const [payoutDate, setPayoutDate] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => apiGet('/members/' + id).then(data => setMembers(Array.isArray(data) ? data : [])).catch(() => setMembers([]));

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const closeMenu = e => {
      if (!e.target.closest('.member-menu-wrap') && !e.target.closest('.member-menu-portal')) setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    const closeOnViewportChange = () => setOpenMenu(null);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, []);

  const myMember = members.find(m => m.UserId === user?.UserId);
  const isGroupAdmin = myMember?.Role === 'Admin';
  const pending = members.filter(m => m.Status === 'Pending');
  const approved = members.filter(m => m.Status === 'Approved');

  const fullName = m => `${m?.FirstName || ''} ${m?.LastName || ''}`.trim();
  const displayDate = value => value ? new Date(value).toLocaleDateString() : '-';
  const dateInputValue = value => value ? new Date(value).toISOString().slice(0, 10) : '';
  const assignedPayoutDates = excludeMemberId => new Set(
    members
      .filter(member => member.MemberId !== excludeMemberId && member.PayoutDate && member.Status !== 'Rejected' && member.Status !== 'Removed')
      .map(member => dateInputValue(member.PayoutDate))
  );
  const payoutDateTaken = member => Boolean(payoutDate && assignedPayoutDates(member?.MemberId).has(payoutDate));
  const middleDot = ' - ';
  const profileRows = member => {
    const membershipRows = [
      ['Role', member.Role || 'Member'],
      ['Slot', '#' + member.SlotNumber],
      ['Status', member.Status],
      ['Joined', displayDate(member.JoinedAt)],
      ['Payout date', displayDate(member.PayoutDate)]
    ];
    if (!isGroupAdmin) return [['Phone', member.Phone || '-'], ...membershipRows];
    return [
      ['Title', member.Title || '-'],
      ['Email', member.Email || '-'],
      ['Phone', member.Phone || '-'],
      ['Sex', member.Sex || '-'],
      ['Date of birth', displayDate(member.DateOfBirth)],
      ['Occupation', member.Occupation || '-'],
      ['Address', member.Address || '-'],
      ['Country', member.CountryCode || '-'],
      ...membershipRows,
      ['Bank name', member.BankName || '-'],
      ['Account number / IBAN', member.BankAccountNumber || '-'],
      ['Account name', member.BankAccountName || '-'],
      ['Sort code / Routing', member.BankRoutingCode || '-']
    ];
  };

  const openApprovalPayoutDate = member => {
    setApprovalMember(member);
    setPayoutDate(member.PayoutDate ? new Date(member.PayoutDate).toISOString().slice(0, 10) : '');
  };

  const approve = async () => {
    if (!approvalMember || !payoutDate) return;
    if (payoutDateTaken(approvalMember)) {
      showToast('This payout date has already been assigned to another member.', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiPut('/members/' + approvalMember.MemberId + '/approve', { payoutDate });
      showToast(fullName(approvalMember) + ' approved with payout date.');
      setApprovalMember(null);
      setPayoutDate('');
      load();
    } catch (error) {
      showToast(error.message || 'Could not approve member.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reject = async mid => {
    await apiPut('/members/' + mid + '/reject', {});
    showToast('Request rejected');
    load();
  };

  const openProfile = member => {
    setOpenMenu(null);
    navigate(`/group/${id}/members/${member.MemberId}/profile`);
  };

  const openPayoutDate = member => {
    setOpenMenu(null);
    setPayoutMember(member);
    setPayoutDate(member.PayoutDate ? new Date(member.PayoutDate).toISOString().slice(0, 10) : '');
  };

  const assignPayoutDate = async () => {
    if (!payoutMember || !payoutDate) return;
    if (payoutDateTaken(payoutMember)) {
      showToast('This payout date has already been assigned to another member.', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiPut('/members/' + payoutMember.MemberId + '/payout-date', { payoutDate });
      showToast('Payout date assigned to ' + fullName(payoutMember));
      setPayoutMember(null);
      setPayoutDate('');
      load();
    } catch (error) {
      showToast(error.message || 'Could not assign payout date.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openHistory = member => {
    setOpenMenu(null);
    navigate(`/group/${id}/members/${member.MemberId}/transactions`);
  };

  const toggleMemberMenu = (event, member, canRemove) => {
    if (openMenu?.member?.MemberId === member.MemberId) return setOpenMenu(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 104 + (isGroupAdmin ? 48 : 0) + (canRemove ? 48 : 0);
    const top = window.innerHeight - rect.bottom >= menuHeight ? rect.bottom + 6 : Math.max(8, rect.top - menuHeight - 6);
    setOpenMenu({member,canRemove,top,left:Math.max(8,Math.min(window.innerWidth-198,rect.right-190))});
  };

  const openRemove = member => {
    setOpenMenu(null);
    setRemoveMember(member);
    setConfirmName('');
    setMessage('');
  };

  const removeFromGroup = async () => {
    if (!removeMember || confirmName.trim().toLowerCase() !== fullName(removeMember).toLowerCase()) return;
    setBusy(true);
    setMessage('');
    try {
      await apiDelete('/members/' + removeMember.MemberId, { confirmName: fullName(removeMember) });
      setMessage(fullName(removeMember) + ' has been removed from this group.');
      setRemoveMember(null);
      setConfirmName('');
      load();
    } catch (e) {
      setMessage(e.message || 'Could not remove this member.');
    } finally {
      setBusy(false);
    }
  };

  const exportHistoryPdf = async () => {
    if (!historyMember) return;
    const total = history.reduce((sum, c) => sum + Number(c.Amount || 0), 0);
    const toPdfText = value => String(value ?? '')
      .replace(/₦/g, 'NGN ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const escapePdf = value => toPdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const fileSafeName = toPdfText(fullName(historyMember)).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'member';
    const lines = [
      'Contribution Statement',
      `${fullName(historyMember)} - Group #${id}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'Date        Cycle    Method         Status       Amount',
      '----------------------------------------------------------',
      ...(history.length ? history.map(c => {
        const date = new Date(c.PaidAt).toLocaleDateString();
        return `${date}   ${c.CycleNumber || '-'}       ${formatPaymentMethod(c.Method)}   ${c.Status || '-'}   ${fmt(c.Amount)}`;
      }) : ['No contributions found.']),
      '----------------------------------------------------------',
      `Total: ${fmt(total)}`
    ];

    const commands = ['BT', '/F1 18 Tf', '50 750 Td', `(${escapePdf(lines[0])}) Tj`, '/F1 11 Tf', '0 -24 Td'];
    lines.slice(1).forEach(line => {
      commands.push(`(${escapePdf(line)}) Tj`, '0 -17 Td');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach(obj => {
      offsets.push(pdf.length);
      pdf += obj;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => {
      pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    try {
      await saveOrShareBlob({
        blob,
        fileName: `${fileSafeName}-contribution-statement.pdf`,
        title: 'Contribution Statement',
        text: `${fullName(historyMember)} contribution statement`,
      });
      showToast('Contribution statement ready.');
    } catch (error) {
      showToast(error.message || 'Could not export PDF.', 'error');
    }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/" + id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Group Members</div>
          <div className="psub">{approved.length} approved  -  {pending.length} pending</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>{isGroupAdmin && <Link to={'/group/' + id + '/invite-codes'} className="btn btn-g btn-sm"><SvgIcon name="plus" size={15}/> Invite</Link>}</div>
      </div>

      {message && <div className="err-msg" style={{ color: 'var(--deep)', borderColor: 'rgba(200,151,58,.35)', background: 'rgba(200,151,58,.08)' }}>{message}</div>}

      {pending.length > 0 && (
        <div className="card">
          <div className="card-hd"><div className="card-ttl">Pending Requests</div><span className="badge b-gold">{pending.length}</span></div>
          {pending.map(m => (
            <div className="row" key={m.MemberId}>
              <div className="uav" style={{ width: 36, height: 36, fontSize: 13, background: m.AvatarColor || 'var(--sage)', flexShrink: 0 }}>
                {m.ProfilePicture ? <img src={apiAssetUrl(m.ProfilePicture)} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : (m.FirstName?.[0] || '') + (m.LastName?.[0] || '')}
              </div>
              <div style={{ flex: 1 }}><div className="row-name">{fullName(m)}</div><div className="row-sub">Awaiting approval</div></div>
              {isGroupAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-green btn-sm" onClick={() => openApprovalPayoutDate(m)} style={{ background: 'rgba(46,125,50,.1)', color: 'var(--green)', border: '1.5px solid rgba(46,125,50,.2)' }}><SvgIcon name="calendar" size={15} /> Set Date</button>
                  <button className="btn btn-red btn-sm" onClick={() => reject(m.MemberId)}><SvgIcon name="x" size={15} /> Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card member-card">
        <div className="card-hd"><div className="card-ttl">Approved Members</div><span className="badge b-green">{approved.length}</span></div>
        {approved.map(m => {
          const isOwnAccount = m.UserId === user?.UserId;
          const canUseMenu = isGroupAdmin || isOwnAccount;
          const canRemove = isGroupAdmin && !isOwnAccount;
          const deletionStatus = m.AccountDeletionStatus || '';
          const isInactive = m.UserIsActive === false || m.UserIsActive === 0 || deletionStatus === 'PendingSelfDelete' || deletionStatus === 'PendingAdminApproval' || deletionStatus === 'Approved' || deletionStatus === 'Deleted';
          const statusLabel = isInactive ? 'Inactive' : (m.HasReceived ? 'Received' : 'Active');
          const statusClass = isInactive ? 'b-red' : (m.HasReceived ? 'b-gold' : 'b-green');
          const statusNote = deletionStatus && isInactive ? '  -  Account deletion requested' : '';
          return (
            <div className="row member-row" key={m.MemberId}>
              <div className="uav" style={{ width: 36, height: 36, fontSize: 13, background: m.AvatarColor || 'var(--sage)', flexShrink: 0 }}>
                {m.ProfilePicture ? <img src={apiAssetUrl(m.ProfilePicture)} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : (m.FirstName?.[0] || '') + (m.LastName?.[0] || '')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-name">{fullName(m)}</div>
                <div className="row-sub">Slot #{m.SlotNumber}{m.PayoutDate ? '  -  Payout ' + displayDate(m.PayoutDate) : ''}</div>
              </div>
              <span className={`badge ${statusClass}`}>{statusLabel}</span>
              {canUseMenu && (
                <div className={'member-menu-wrap ' + (openMenu?.member?.MemberId === m.MemberId ? 'open' : '')}>
                  <button className="member-arrow" type="button" aria-label="Member actions" aria-expanded={openMenu?.member?.MemberId === m.MemberId} onClick={event => toggleMemberMenu(event,m,canRemove)}><SvgIcon name="chevronDown" size={18} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openMenu && createPortal(
        <div className="member-menu member-menu-portal" style={{top:openMenu.top,left:openMenu.left}} role="menu">
          <button type="button" role="menuitem" onClick={() => openProfile(openMenu.member)}>Profile</button>
          <button type="button" role="menuitem" onClick={() => openHistory(openMenu.member)}>Transaction</button>
          {isGroupAdmin && <button type="button" role="menuitem" onClick={() => openPayoutDate(openMenu.member)}>Assign Payout Date</button>}
          {openMenu.canRemove && <button type="button" role="menuitem" className="danger" onClick={() => openRemove(openMenu.member)}>Remove</button>}
        </div>,document.body
      )}

      {profile && (
        <div className="modal-ov open" onClick={e => e.target === e.currentTarget && setProfile(null)}>
          <div className="modal" style={{maxHeight:'88vh',overflowY:'auto'}}>
            <button className="modal-close" onClick={() => setProfile(null)}><SvgIcon name="x" size={18} /></button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div className="uav" style={{ width: 70, height: 70, fontSize: 24, background: profile.AvatarColor || 'var(--sage)', margin: '0 auto 12px' }}>
                {profile.ProfilePicture ? <img src={apiAssetUrl(profile.ProfilePicture)} style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : (profile.FirstName?.[0] || '') + (profile.LastName?.[0] || '')}
              </div>
              <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 18, fontWeight: 700 }}>{fullName(profile)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{profile.Occupation || 'Member'}</div>
            </div>
            {profileRows(profile).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,.05)', fontSize: 13, gap: 12 }}>
                <span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {historyMember && (
        <div className="modal-ov open" onClick={e => e.target === e.currentTarget && setHistoryMember(null)}>
          <div className="modal member-history-modal">
            <button className="modal-close" onClick={() => setHistoryMember(null)}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl">Contribution Statement</div>
            <div className="modal-sub">{fullName(historyMember)}  -  {history.length} record{history.length === 1 ? '' : 's'}</div>
            <div className="statement-list">
              {history.map(c => (
                <div className="statement-row" key={c.ContributionId}>
                  <div>
                    <div className="row-name">Cycle {c.CycleNumber}</div>
                    <div className="row-sub">{formatPaymentMethod(c.Method)} - {new Date(c.PaidAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--deep)' }}>{fmt(c.Amount)}</div>
                    <span className={"badge " + (c.Status === 'Confirmed' ? 'b-green' : c.Status === 'Pending' ? 'b-gold' : 'b-red')}>{c.Status}</span>
                  </div>
                </div>
              ))}
              {!history.length && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No contribution history found.</div>}
            </div>
            <button className="btn btn-g" style={{ width: '100%', marginTop: 16 }} onClick={exportHistoryPdf}>Export as PDF</button>
          </div>
        </div>
      )}

      {approvalMember && (
        <div className="modal-ov open" onClick={e => e.target === e.currentTarget && !busy && setApprovalMember(null)}>
          <div className="modal">
            <button className="modal-close" type="button" disabled={busy} onClick={() => setApprovalMember(null)}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl">Assign Payout Date</div>
            <div className="modal-sub">Choose the payout date for {fullName(approvalMember)} before approving this member.</div>
            <div className="fg" style={{marginTop:18}}>
              <label className="fl">PAYOUT DATE</label>
              <input className="fi" type="date" required min={new Date().toISOString().slice(0,10)} value={payoutDate} onChange={e => setPayoutDate(e.target.value)} />
              {payoutDateTaken(approvalMember) && <div className="err-msg" style={{marginTop:10}}>This payout date has already been assigned to another member.</div>}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-gh" type="button" disabled={busy} onClick={() => setApprovalMember(null)} style={{flex:1,justifyContent:'center'}}>Cancel</button>
              <button className="btn btn-g" type="button" disabled={busy || !payoutDate || payoutDateTaken(approvalMember)} onClick={approve} style={{flex:1.5,justifyContent:'center'}}>{busy?'Approving...':'Approve Member'}</button>
            </div>
          </div>
        </div>
      )}

      {payoutMember && (
        <div className="modal-ov open" onClick={e => e.target === e.currentTarget && !busy && setPayoutMember(null)}>
          <div className="modal">
            <button className="modal-close" type="button" disabled={busy} onClick={() => setPayoutMember(null)}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl">Assign Payout Date</div>
            <div className="modal-sub">Choose the payout date for {fullName(payoutMember)}.</div>
            <div className="fg" style={{marginTop:18}}>
              <label className="fl">PAYOUT DATE</label>
              <input className="fi" type="date" required min={new Date().toISOString().slice(0,10)} value={payoutDate} onChange={e => setPayoutDate(e.target.value)} />
              {payoutDateTaken(payoutMember) && <div className="err-msg" style={{marginTop:10}}>This payout date has already been assigned to another member.</div>}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-gh" type="button" disabled={busy} onClick={() => setPayoutMember(null)} style={{flex:1,justifyContent:'center'}}>Cancel</button>
              <button className="btn btn-g" type="button" disabled={busy || !payoutDate || payoutDateTaken(payoutMember)} onClick={assignPayoutDate} style={{flex:1.5,justifyContent:'center'}}>{busy?'Saving...':'Assign Date'}</button>
            </div>
          </div>
        </div>
      )}

      {removeMember && (
        <div className="modal-ov open" onClick={e => e.target === e.currentTarget && setRemoveMember(null)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setRemoveMember(null)}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl" style={{ color: 'var(--red)' }}>Remove member?</div>
            <div className="modal-sub">This will remove {fullName(removeMember)} from this group. Type the member name below to confirm.</div>
            <div className="err-msg">Type: <strong>{fullName(removeMember)}</strong></div>
            <div className="fg">
              <label className="fl">MEMBER NAME</label>
              <input className="fi" value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={fullName(removeMember)} />
            </div>
            <button className="btn btn-red" style={{ width: '100%' }} disabled={busy || confirmName.trim().toLowerCase() !== fullName(removeMember).toLowerCase()} onClick={removeFromGroup}>
              {busy ? 'Removing...' : 'Remove from Group'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
