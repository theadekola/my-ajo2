import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SvgIcon from './SvgIcon.jsx';

const CONSENT_COOKIE = 'myajo_cookie_consent';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isNativeMobileApp() {
  if (typeof window === 'undefined') return false;
  return window.Capacitor?.isNativePlatform?.() || window.location.hostname === 'localhost';
}

function hasCookieConsent() {
  if (typeof document === 'undefined') return true;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${CONSENT_COOKIE}=`));
}

function saveCookieConsent() {
  document.cookie = `${CONSENT_COOKIE}=accepted; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isNativeMobileApp()) {
      setVisible(false);
      return;
    }
    setVisible(!hasCookieConsent());
  }, []);

  if (!visible) return null;

  const acceptCookies = () => {
    saveCookieConsent();
    setVisible(false);
  };

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie notice">
      <div className="cookie-consent-icon" aria-hidden="true">
        <SvgIcon name="lock" size={20} />
      </div>
      <div className="cookie-consent-body">
        <div className="cookie-consent-title">Cookies and app storage</div>
        <div className="cookie-consent-text">
          My Ajo uses essential cookies and browser storage to keep the app secure, remember your session, and improve your experience.
          Read our <Link to="/privacy">Privacy Policy</Link>.
        </div>
      </div>
      <button type="button" className="btn btn-g cookie-consent-btn" onClick={acceptCookies}>
        Accept
      </button>
    </div>
  );
}
