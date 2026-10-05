import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPut } from '../api/appClient.js';
import { currencySymbol, useAuth } from '../context/AuthContext.jsx';
import SvgIcon, { groupIconNameFromValue } from '../components/SvgIcon.jsx';

export default function GroupDetail() {
  const { id } = useParams();
  const { fmt, user, showToast, setUnread } = useAuth();
  const [group, setGroup] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [menuView, setMenuView] = useState(() => localStorage.getItem('myajo:groupMenuView') || 'list');

  useEffect(() => {
    apiGet('/groups/' + id).then(setGroup).catch(() => {});
    let alive = true;
    const loadNotifications = () => apiGet('/notifications')
      .then(rows => { if (alive) setNotifications(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setNotifications([]); });
    const refreshWhenVisible = () => {
      if (!document.hidden) loadNotifications();
    };
    loadNotifications();
    const timer = setInterval(loadNotifications, 10000);
    window.addEventListener('focus', loadNotifications);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', loadNotifications);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [id]);

  if (!group) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Loading group...</div>;

  const isGroupAdmin = group.AdminUserId === user?.UserId;
  const myMember = group.members?.find(m => m.UserId === user?.UserId);
  const expectedCyclePot = Number(group.ContributionAmount || 0) * Number(group.MemberCount || 0);

  const toggleGroupPrivacy = async checked => {
    const previous = !!group.GroupMembersAnonymous;
    setGroup(current => ({ ...current, GroupMembersAnonymous: checked }));
    setPrivacyBusy(true);
    try {
      const saved = await apiPut(`/groups/${id}/privacy`, { groupMembersAnonymous: checked });
      setGroup(current => ({ ...current, GroupMembersAnonymous: !!saved.groupMembersAnonymous }));
    } catch (ex) {
      setGroup(current => ({ ...current, GroupMembersAnonymous: previous }));
      showToast(ex.message, 'error');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const setGroupMenuView = view => {
    setMenuView(view);
    localStorage.setItem('myajo:groupMenuView', view);
  };

  const ViewToggle = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, background: 'var(--white)', borderRadius: 18, padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
      <div>
        <div style={{ fontWeight: 800, color: 'var(--deep)', fontSize: 14 }}>Menu view</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Choose grid or list layout for this group.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, background: 'var(--mist)', borderRadius: 14, padding: 4 }}>
        <button type="button" aria-label="Grid view" onClick={() => setGroupMenuView('grid')} style={{ width: 42, height: 38, borderRadius: 11, border: menuView === 'grid' ? '2px solid var(--deep)' : '1px solid transparent', background: menuView === 'grid' ? 'var(--white)' : 'transparent', color: 'var(--deep)', cursor: 'pointer', fontWeight: 900, fontSize: 18, lineHeight: 1 }}><SvgIcon name="grid" size={18} /></button>
        <button type="button" aria-label="List view" onClick={() => setGroupMenuView('list')} style={{ width: 42, height: 38, borderRadius: 11, border: menuView === 'list' ? '2px solid var(--deep)' : '1px solid transparent', background: menuView === 'list' ? 'var(--white)' : 'transparent', color: 'var(--deep)', cursor: 'pointer', fontWeight: 900, fontSize: 18, lineHeight: 1 }}><SvgIcon name="list" size={18} /></button>
      </div>
    </div>
  );

  const links = [
    { to: `/group/${id}/members`, icon: 'users', label: 'Members', sub: `${group.MemberCount} members`, noticeTypes: ['MemberJoined','MemberApproved','MemberRejected','MemberRemoved','JoinRequest','InviteRequest','AccountDeletionApproved','AccountDeletionDeclined'] },
    { to: `/group/${id}/pay`, icon: 'contribution', label: 'Make Payment', sub: 'Submit contribution', noticeTypes: ['PaymentDue','PaymentOverdue','ContributionDue','ContributionOverdue'] },
    { to: `/group/${id}/payment-info`, icon: 'card', label: 'Payment Info', sub: 'Bank details', admin: true, noticeTypes: ['PaymentInfoMissing','PaymentInfoUpdated','BankDetailsUpdated'] },
    { to: `/group/${id}/payments`, icon: 'clipboard', label: 'Group Contributions', sub: 'Track payments', noticeTypes: ['PaymentSubmitted','PaymentPending','PaymentReceiptUploaded','PaymentConfirmed','PaymentRejected','ContributionConfirmed','ContributionRejected'] },
    { to: `/group/${id}/bank`, icon: 'bank', label: 'My Bank Details', sub: 'Payout account', noticeTypes: ['BankDetailsRequired','BankDetailsRejected'] },
    { to: `/group/${id}/payout-date`, icon: 'calendar', label: 'Payout Date', sub: 'Date and payment information', member: true, noticeTypes: ['PayoutDateAssigned','PayoutScheduled','PayoutPaid','PayoutCancelled','InstantPayoutRecorded'] },
    { to: `/group/${id}/disbursement`, icon: 'bank', label: 'Disbursement', sub: 'Manage payouts', admin: true, noticeTypes: ['PayoutRequested','PayoutScheduled','PayoutPaid','PayoutCancelled','InstantPayoutRecorded'] },
    { to: `/group/${id}/chat`, icon: 'message', label: 'Group Chat', sub: 'Messages', noticeTypes: ['Chat','PrivateChat','Message','AccountDeletionRequest','AccountDeleteRequest','DeletionRequest'] },
    { to: `/group/${id}/statistics`, icon: 'chart', label: 'Statistics', sub: 'Analytics', noticeTypes: ['StatsUpdated','ReportReady'] },
  ];

  const visibleLinks = links.filter(l => (!l.admin || isGroupAdmin) && (!l.member || !isGroupAdmin));
  const mappedNoticeTypes = new Set(visibleLinks.flatMap(link => link.noticeTypes || []));
  const groupUnreadNotifications = notifications.filter(notification =>
    !notification.IsRead && String(notification.GroupId) === String(id)
  );
  const unreadForLink = link => groupUnreadNotifications.filter(notification => {
    if (link.noticeTypes?.includes(notification.Type)) return true;
    return link.label === 'Group Chat' && !mappedNoticeTypes.has(notification.Type);
  });

  const menuLayoutStyle = menuView === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }
    : { display: 'flex', flexDirection: 'column', gap: 12 };

  const menuCardStyle = menuView === 'grid'
    ? { padding: 12, minHeight: 118, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 10, cursor: 'pointer', transition: 'transform .2s', position: 'relative' }
    : { padding: 18, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'transform .2s', position: 'relative' };

  const openNotifiedLink = link => {
    const matches = unreadForLink(link);
    if (!matches.length) return;
    const ids = new Set(matches.map(notification => notification.NotificationId));
    setNotifications(current => current.map(notification => ids.has(notification.NotificationId) ? {...notification,IsRead:true} : notification));
    setUnread?.(current => Math.max(0,current-matches.length));
    Promise.all(matches.map(notification => apiPut('/notifications/'+notification.NotificationId+'/read',{}))).catch(()=>{});
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/groups" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle"><SvgIcon name={groupIconNameFromValue(group.Icon, group.GroupName)} size={22} /> {group.GroupName}</div>
          <div className="psub">{group.CountryCode} {'\u00B7'} {currencySymbol(group.CurrencyCode, group.CurrencySymbol)} {'\u00B7'} {group.Frequency}</div>
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 24 }}>
        <div className="card group-summary-card" style={{ padding: 20 }}>
          <div className="group-detail-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              ['Contribution', fmt(group.ContributionAmount) + '/' + group.Frequency],
              ['Members', group.MemberCount + '/' + group.MaxMembers],
              ['Collected', fmt(expectedCyclePot || group.CollectedThisCycle || 0)],
              ['Status', group.Status],
              ['Cycle', '#' + group.CurrentCycle],
              ['My Slot', '#' + (myMember?.SlotNumber || '-')]
            ].map(([l, v]) => (
              <div className="group-summary-stat" key={l}>
                <div className="group-summary-label">{l.toUpperCase()}</div>
                <div className="group-summary-value">{v}</div>
              </div>
            ))}
          </div>
          <div className="group-summary-progress"><div className="group-summary-progress-head"><span>Cycle payment progress</span><strong>{group.PaidCount}/{group.MemberCount}</strong></div><div className="pw"><div className="pb" style={{ width: `${group.MemberCount ? (group.PaidCount / group.MemberCount) * 100 : 0}%` }} /></div><small>{group.PaidCount}/{group.MemberCount} members paid this cycle</small></div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--deep)' }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to={`/group/${id}/pay`} className="btn btn-g" style={{ justifyContent: 'center', padding: 11 }}><SvgIcon name="contribution" size={16} /> Make Contribution</Link>
            <Link to={`/group/${id}/bank`} className="btn btn-gh" style={{ justifyContent: 'center', padding: 11 }}><SvgIcon name="bank" size={16} /> My Bank Details</Link>
            {!isGroupAdmin ? <Link to={`/group/${id}/payout-date`} className="btn btn-gh" style={{ justifyContent: 'center', padding: 11 }}><SvgIcon name="calendar" size={16} /> Payout Date</Link> : null}
            <Link to={`/group/${id}/chat`} className="btn btn-gh" style={{ justifyContent: 'center', padding: 11 }}><SvgIcon name="message" size={16} /> Open Group Chat</Link>
          </div>
        </div>
      </div>

      {isGroupAdmin ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-hd">
            <div>
              <div className="card-ttl">Group Privacy</div>
              <div className="row-sub" style={{ marginTop: 3 }}>This setting applies only to {group.GroupName}.</div>
            </div>
          </div>
          <div className="row">
            <div className="row-ic" aria-hidden="true" style={{ background: 'rgba(200,151,58,.1)', fontSize: 18 }}><SvgIcon name="lock" size={18} /></div>
            <div style={{ flex: 1 }}>
              <div className="row-name">Group members anonymous</div>
              <div className="row-sub">Members see only their own identity. Group admins can still see everyone.</div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={!!group.GroupMembersAnonymous}
                disabled={privacyBusy}
                onChange={event => toggleGroupPrivacy(event.target.checked)}
              />
              <span className="tslider" />
            </label>
          </div>
        </div>
      ) : null}

      <ViewToggle />

      <div style={menuLayoutStyle}>
        {visibleLinks.map(l => (
          <Link key={l.to} to={l.to} style={{ textDecoration: 'none' }} onClick={() => openNotifiedLink(l)}>
            <div className="card" style={menuCardStyle}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(200,151,58,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}><SvgIcon name={l.icon} size={22} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--deep)' }}>{l.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.sub}</div>
              </div>
              {unreadForLink(l).length > 0 ? <span aria-label={`${unreadForLink(l).length} unread notification${unreadForLink(l).length===1?'':'s'}`} style={{position:'absolute',top:16,right:16,width:10,height:10,borderRadius:'50%',background:'var(--gold)',boxShadow:'0 0 0 4px rgba(200,151,58,.16)'}} /> : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}




