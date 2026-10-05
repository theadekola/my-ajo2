import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import SvgIcon from '../components/SvgIcon.jsx';

const SUPPORT_EMAIL = 'support@my-ajo.org';

export default function SupportEmail() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('My Ajo support request');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendMessage = async e => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      await apiPost('/support/email', { subject, message });
      setStatus('Message sent. Support will reply to your account email.');
      setMessage('');
    } catch (ex) {
      setError(ex.message || 'Could not send message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/help" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Email Support</div>
          <div className="psub">Compose a message to {SUPPORT_EMAIL}</div>
        </div>
      </div>

      <form className="card" onSubmit={sendMessage}>
        <div className="card-hd">
          <div>
            <div className="card-ttl">Message Details</div>
            <div className="card-sub">Your message will be sent directly to support</div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {status && <div className="err-msg" style={{ color: 'var(--green)', borderColor: 'rgba(46,125,50,.25)', background: 'rgba(46,125,50,.08)' }}>{status}</div>}
          {error && <div className="err-msg">{error}</div>}
          <div className="fg">
            <label className="fl">TO</label>
            <input className="fi" value={SUPPORT_EMAIL} disabled />
          </div>
          <div className="fg">
            <label className="fl">SUBJECT</label>
            <input className="fi" value={subject} onChange={e => setSubject(e.target.value)} placeholder="What do you need help with?" />
          </div>
          <div className="fg">
            <label className="fl">MESSAGE</label>
            <textarea className="fta" value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the issue, the page you were on, and what you expected to happen." style={{ minHeight: 170 }} />
          </div>
          <button className="btn btn-g" type="submit" disabled={busy || !message.trim()} style={{ width: '100%', justifyContent: 'center' }}>{busy ? 'Sending...' : 'Send Message'}</button>
        </div>
      </form>
    </div>
  );
}
