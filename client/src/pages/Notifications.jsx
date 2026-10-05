import { useEffect, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const NOTIFICATION_ICON_BY_TYPE = {
  MemberJoined: 'users',
  JoinRequest: 'users',
  InviteRequest: 'link',
  MemberApproved: 'check',
  MemberRejected: 'x',
  MemberRemoved: 'users',
  PaymentInfoMissing: 'warning',
  PaymentInfoUpdated: 'card',
  BankDetailsUpdated: 'bank',
  BankDetailsRequired: 'warning',
  BankDetailsRejected: 'x',
  PaymentSubmitted: 'card',
  PaymentPending: 'clock',
  PaymentReceiptUploaded: 'receipt',
  PaymentConfirmed: 'check',
  PaymentRejected: 'x',
  ContributionConfirmed: 'check',
  ContributionRejected: 'x',
  PaymentDue: 'clock',
  PaymentOverdue: 'warning',
  ContributionDue: 'clock',
  ContributionOverdue: 'warning',
  PayoutRequested: 'bank',
  PayoutScheduled: 'calendar',
  PayoutDateAssigned: 'calendar',
  PayoutPaid: 'check',
  PayoutCancelled: 'x',
  InstantPayoutRecorded: 'bank',
  Chat: 'message',
  PrivateChat: 'message',
  Message: 'message',
  StatsUpdated: 'chart',
  ReportReady: 'chart',
  AccountDeletionRequest: 'warning',
  AccountDeletionApproved: 'check',
  AccountDeletionDeclined: 'x',
  Default: 'bell'
};

const notificationIconName = type => NOTIFICATION_ICON_BY_TYPE[type] || NOTIFICATION_ICON_BY_TYPE.Default;

export default function Notifications() {
  const { setUnread, showToast } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await apiGet('/notifications');
      const rows = Array.isArray(data) ? data : [];
      setNotifs(rows);
      setUnread(rows.filter(n => !n.IsRead).length);
    } catch {
      setNotifs([]);
      setUnread(0);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async id => {
    await apiPut('/notifications/' + id + '/read', {});
    load();
  };

  const markAll = async () => {
    await apiPut('/notifications/read-all', {});
    showToast('All marked as read');
    load();
  };

  const openNotification = async n => {
    await markRead(n.NotificationId);
    if (n.Link) navigate(n.Link);
    else if (n.GroupId) navigate('/group/' + n.GroupId);
  };

  const unread = notifs.filter(n => !n.IsRead).length;

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/dashboard" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Notifications</div>
          <div className="psub">{unread} unread</div>
        </div>
        {unread > 0 && <button className="btn btn-gh btn-sm" onClick={markAll}>Mark all read</button>}
      </div>

      <div className="card">
        {notifs.map(n => (
          <div key={n.NotificationId} className="row" style={{ background: n.IsRead ? undefined : 'rgba(200,151,58,.04)', cursor: 'pointer', transition: 'background .2s' }}
            onClick={() => openNotification(n)}>
            <div className="row-ic" style={{ background: n.IsRead ? 'var(--mist)' : 'rgba(200,151,58,.12)', fontSize: 18 }}>
              <SvgIcon name={notificationIconName(n.Type)} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="row-name">{n.Title}</div>
                {!n.IsRead && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />}
              </div>
              <div className="row-sub">{n.Body}</div>
              {n.GroupName && <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 1 }}><SvgIcon name="users" size={12} /> {n.GroupName}</div>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, textAlign: 'right' }}>
              {n.CreatedAt ? new Date(n.CreatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}
            </div>
          </div>
        ))}
        {!notifs.length && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ marginBottom: 12, color: 'var(--gold)' }}><SvgIcon name="bell" size={48} /></div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No notifications yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
