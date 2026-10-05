import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiPublicPost, apiUpload } from '../api/appClient.js';
import SvgIcon from '../components/SvgIcon.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const countryFlag = isoCode => String(isoCode || '')
  .toUpperCase()
  .replace(/[A-Z]/g, letter => String.fromCodePoint(127397 + letter.charCodeAt(0)));

const CURRENCY_SYMBOLS = {
  GBP: '\u00A3',
  GHS: 'GH\u20B5',
  NGN: '\u20A6',
  USD: '$',
  ZAR: 'R',
};

export function currencySymbol(currency, fallback = '$') {
  const code = String(currency || '').trim().toUpperCase();
  if (CURRENCY_SYMBOLS[code]) return CURRENCY_SYMBOLS[code];
  try {
    const symbol = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find(part => part.type === 'currency')?.value;
    return symbol && symbol !== code ? symbol : fallback;
  } catch {
    return fallback;
  }
}

const SUPPORTED_COUNTRIES = [
  { code: 'GB', plainName: 'United Kingdom', cur: 'GBP', dial: '+44' },
  { code: 'US', plainName: 'United States', cur: 'USD', dial: '+1' },
  { code: 'NG', plainName: 'Nigeria', cur: 'NGN', dial: '+234' },
  { code: 'GH', plainName: 'Ghana', cur: 'GHS', dial: '+233' },
  { code: 'ZA', plainName: 'South Africa', cur: 'ZAR', dial: '+27' },
];

export const COUNTRIES = SUPPORTED_COUNTRIES
  .map(country => {
    const flag = countryFlag(country.code);
    return {
      ...country,
      flag,
      name: `${flag} ${country.plainName}`,
      sym: currencySymbol(country.cur),
    };
  })
  .sort((a, b) => a.plainName.localeCompare(b.plainName));
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [unread, setUnread] = useState(0);

  const showToast = useCallback((message, type = 'success') => {
    const msg = String(message || '').trim();
    if (!msg) return;
    setToast({ msg, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(current => current?.id === toast.id ? null : current), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await apiGet('/auth/me');
      setUser(u);
      if (u) {
        const dash = await apiGet('/users/dashboard').catch(() => ({}));
        setUnread(dash.UnreadNotifications || 0);
      }
    } catch { setUser(null); }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    const refreshUnread = async () => {
      const dash = await apiGet('/users/dashboard').catch(() => ({}));
      setUnread(dash.UnreadNotifications || 0);
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshUnread();
    };
    refreshUnread();
    const timer = setInterval(refreshUnread, 15000);
    window.addEventListener('focus', refreshUnread);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshUnread);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?.UserId]);

  const login = async (email, password) => {
    // Login is unauthenticated and the API does not require a CSRF cookie for it.
    // Avoid a separate CSRF bootstrap request, which can be blocked by a native WebView.
    const response = await apiPublicPost('/auth/login', { email, password });
    if (response.user) setUser(response.user);
    return response;
  };

  const completeMfaLogin = async (mfaTicket, code, recoveryCode = '') => {
    const response = await apiPost('/auth/mfa/login/verify', { mfaTicket, code, recoveryCode });
    setUser(response.user);
    return response.user;
  };

  const startSuperAdminMfa = async () => apiPost('/auth/mfa/admin/challenge', {});

  const register = async (payload, profilePicture) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => formData.append(key, value ?? ''));
    formData.append('profilePicture', profilePicture);
    await apiUpload('/auth/register', formData);
    const fullUser = await apiGet('/auth/me');
    setUser(fullUser);
    return fullUser;
  };

  const logout = async () => {
    try { await apiPost('/auth/logout', {}); }
    finally { setUser(null); }
  };
  const isAdmin = ['Admin','SuperAdmin'].includes(user?.SystemRole);
  const canCreateGroups = user?.OrganizerStatus === 'Approved' && !!user?.CanCreateGroups;
  const sym = currencySymbol(user?.CurrencyCode, user?.CurrencySymbol || '\u20A6');
  const fmt = n => `${sym}${Number(n || 0).toLocaleString()}`;
  const initials = user ? `${user.FirstName?.[0]||''}${user.LastName?.[0]||''}` : '?';

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, completeMfaLogin, startSuperAdminMfa, register, logout, isAdmin, canCreateGroups, sym, fmt, initials, unread, setUnread, toast, showToast, refreshUser }}>
      {children}
      {toast && (
        <div style={{
          position:'fixed', bottom:'calc(var(--bn,68px) + 14px)', left:'50%',
          transform:'translateX(-50%)',
          background: toast.type==='error' ? '#C62828' : '#0E1A12',
          color:'#fff', padding:'12px 22px', borderRadius:12, fontSize:13,
          fontWeight:500, zIndex:9999, whiteSpace:'nowrap',
          boxShadow:'0 8px 32px rgba(0,0,0,.3)',
          animation:'fadeUp .3s ease'
        }}>
          <SvgIcon name={toast.type==='error' ? 'warning' : 'check'} size={16} /> {toast.msg}
        </div>
      )}
    </AuthCtx.Provider>
  );
}
