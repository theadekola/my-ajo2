import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import SvgIcon from '../components/SvgIcon.jsx';
import { apiAssetUrl } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function More() {
  const { user, initials, logout, startSuperAdminMfa, completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();
  const [mfaTicket, setMfaTicket] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  const beginSuperAdminSwitch = async () => {
    setMfaError('');
    setMfaBusy(true);
    try {
      const response = await startSuperAdminMfa();
      setMfaTicket(response.mfaTicket);
      setMfaCode('');
      setUseRecoveryCode(false);
    } catch (error) {
      if (error?.code === 'MFA_ENROLLMENT_REQUIRED') return navigate('/security/mfa');
      setMfaError(error?.message || 'Could not start Super Admin verification');
    } finally { setMfaBusy(false); }
  };

  const verifySuperAdminSwitch = async event => {
    event.preventDefault();
    setMfaError('');
    setMfaBusy(true);
    try {
      await completeMfaLogin(mfaTicket, useRecoveryCode ? '' : mfaCode, useRecoveryCode ? mfaCode : '');
      setMfaTicket('');
      navigate('/system-admin');
    } catch (error) {
      setMfaError(error?.message || 'The MFA code was not accepted');
    } finally { setMfaBusy(false); }
  };

  const items = [
    { icon: 'user', label: 'Profile', sub: 'Manage your account', to: '/profile' },
    { icon: 'calendar', label: 'Calendar', sub: 'Payouts, meetings and contribution dates', to: '/calendar' },
    { icon: 'calculator', label: 'Calculator', sub: 'Plan your savings', to: '/calculator' },
    { icon: 'settings', label: 'Settings', sub: 'Notification settings', to: '/notification-settings' },
    { icon: 'shield', label: 'Account security', sub: user?.MfaEnabled ? 'MFA enabled' : 'Set up multi-factor authentication', to: '/security/mfa' },
    ...(!isNative ? [{ icon: 'phone', label: 'Install App', sub: 'Add to home screen', to: '/install' }] : []),
    { icon: 'book', label: 'User Guide', sub: 'Learn how to use My Ajo', to: '/user-guide' },
    { icon: 'help', label: 'Support', sub: 'Help, FAQs, terms and privacy', to: '/help' },
  ];

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="page-enter">
      <div className="topbar"><div><div className="ptitle">More</div></div></div>

      <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', padding: 18, marginBottom: 18, boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="uav" style={{ width: 52, height: 52, fontSize: 18, background: user?.AvatarColor || 'var(--sage)' }}>
          {user?.ProfilePicture ? <img src={apiAssetUrl(user.ProfilePicture)} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 17, fontWeight: 800, color: 'var(--deep)' }}>{user?.FirstName} {user?.LastName}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.Email} - {user?.SystemRole}</div>
        </div>
        {user?.SystemRole === 'SuperAdmin' && (
          <button type="button" className="btn btn-g sa-switch" onClick={beginSuperAdminSwitch} disabled={mfaBusy}>
            <SvgIcon name="shield" size={16}/> {mfaBusy ? 'Preparing...' : 'Switch to S.A'}
          </button>
        )}
      </div>

      <div className="card">
        {items.map(item => (
          <div key={item.to} className="row" style={{ cursor: 'pointer' }} onClick={() => navigate(item.to)}>
            <div className="row-ic" aria-hidden="true" style={{ background: 'rgba(200,151,58,.1)', fontSize: 18 }}><SvgIcon name={item.icon} size={18} /></div>
            <div style={{ flex: 1 }}><div className="row-name">{item.label}</div><div className="row-sub">{item.sub}</div></div>
            <SvgIcon name="arrowRight" size={17} style={{color:'var(--muted)'}} />
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <button className="row" style={{ width: '100%', cursor: 'pointer', border: 0, background: 'transparent', textAlign: 'center', justifyContent: 'center' }} onClick={signOut}>
          <SvgIcon name="logout" size={18} style={{color:'var(--red)'}}/><div><div className="row-name" style={{ color: 'var(--red)' }}>Sign Out</div><div className="row-sub">End this session</div></div>
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 4px', fontSize: 11, color: 'var(--muted)' }}>My Ajo v2.0 - {new Date().getFullYear()}</div>

      {mfaTicket && (
        <div role="dialog" aria-modal="true" aria-labelledby="sa-mfa-title" style={{position:'fixed',inset:0,zIndex:10000,display:'grid',placeItems:'center',padding:20,background:'rgba(8,35,24,.55)'}}>
          <form onSubmit={verifySuperAdminSwitch} style={{width:'min(460px,100%)',background:'var(--white)',borderRadius:22,padding:24,boxShadow:'0 24px 70px rgba(0,0,0,.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:8}}>
              <h2 id="sa-mfa-title" style={{margin:0,color:'var(--deep)',fontSize:24}}>Verify Super Admin access</h2>
              <button type="button" aria-label="Close" onClick={()=>setMfaTicket('')} style={{border:0,background:'transparent',cursor:'pointer',color:'var(--muted)',padding:4}}><SvgIcon name="x" size={22}/></button>
            </div>
            <p style={{color:'var(--muted)',fontSize:13,margin:'0 0 18px'}}>For your protection, MFA is required every time you switch to the Super Admin area.</p>
            <div className="fg">
              <label className="fl">{useRecoveryCode ? 'RECOVERY CODE' : 'AUTHENTICATOR CODE'}</label>
              <input className="fi" required autoFocus value={mfaCode} onChange={event=>setMfaCode(event.target.value)} inputMode={useRecoveryCode?'text':'numeric'} autoComplete="one-time-code" maxLength={useRecoveryCode?64:6}/>
            </div>
            {mfaError && <div style={{color:'var(--red)',fontSize:13,marginBottom:12}}>{mfaError}</div>}
            <button type="button" onClick={()=>{setUseRecoveryCode(value=>!value);setMfaCode('');setMfaError('');}} style={{border:0,background:'transparent',color:'var(--gold)',padding:0,marginBottom:18,cursor:'pointer'}}>{useRecoveryCode?'Use authenticator code':'Use a recovery code'}</button>
            <div style={{display:'flex',gap:10}}>
              <button type="button" className="btn btn-gh" onClick={()=>setMfaTicket('')}>Cancel</button>
              <button type="submit" className="btn btn-g" disabled={mfaBusy}>{mfaBusy?'Verifying...':'Verify and switch'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
