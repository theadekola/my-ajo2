import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import SvgIcon from '../components/SvgIcon.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const NATIVE_PUSH_TOKEN_KEY = 'myajo_native_push_token';
const NATIVE_PUSH_TIMEOUT_MS = 15000;
const isIosBrowser = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandaloneWebApp = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function getNativePushPlugin() {
  const mod = await import('@capacitor/push-notifications');
  return mod.PushNotifications;
}

const readablePushError = error => {
  const message = String(error?.message || error?.error || error || '').trim();
  if (/default firebaseapp is not initialized|google-services|firebase/i.test(message)) {
    return 'Firebase is not configured in the mobile app. Add google-services.json, run cap sync, then rebuild the APK.';
  }
  if (/timeout/i.test(message)) return 'The phone did not return a push token. Check Firebase setup and try again.';
  return message || 'Could not update mobile push notifications.';
};

export default function NotificationSettings() {
  const { user, setUser, showToast } = useAuth();
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform?.() || false;
  const nativePlatform = Capacitor.getPlatform?.() || 'web';
  const [form, setForm] = useState({
    notifPayment: true,
    notifPayout: true,
    notifMember: true,
    notifChat: true
  });
  const [busyKey, setBusyKey] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushState, setPushState] = useState({
    checking: true,
    supported: false,
    permission: 'prompt',
    subscribed: false,
    configured: false,
    status: '',
    mode: isNative ? 'native' : 'web'
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      notifPayment: user.NotifPayment !== 0,
      notifPayout: user.NotifPayout !== 0,
      notifMember: user.NotifMember !== 0,
      notifChat: user.NotifChat !== 0
    });
  }, [user]);

  useEffect(() => {
    let cleanup = [];
    const checkPush = async () => {
      if (isNative) {
        try {
          const PushNotifications = await getNativePushPlugin();
          const permission = await PushNotifications.checkPermissions();
          const serverInfo = await apiGet('/push/public-key').catch(() => ({ nativeEnabled: false }));
          const platformConfigured = Array.isArray(serverInfo.nativePlatforms)
            ? serverInfo.nativePlatforms.includes(nativePlatform)
            : !!serverInfo.nativeEnabled;
          const savedToken = localStorage.getItem(NATIVE_PUSH_TOKEN_KEY);
          const receivedHandle = await PushNotifications.addListener('pushNotificationReceived', notification => {
            showToast(notification?.title || 'New notification');
          });
          const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', event => {
            const url = event?.notification?.data?.url || '/notifications';
            navigate(url);
          });
          cleanup = [receivedHandle, actionHandle];
          setPushState({
            checking: false,
            supported: true,
            permission: permission.receive || 'prompt',
            subscribed: !!savedToken,
            configured: platformConfigured,
            status: platformConfigured ? '' : `${nativePlatform === 'ios' ? 'Apple Push Notification' : 'Firebase Cloud Messaging'} server credentials are not configured.`,
            mode: 'native'
          });
        } catch (error) {
          setPushState({ checking: false, supported: false, permission: 'denied', subscribed: false, configured: false, status: readablePushError(error), mode: 'native' });
        }
        return;
      }

      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) {
        const status = isIosBrowser() && !isStandaloneWebApp()
          ? 'On iPhone or iPad, add My Ajo to the Home Screen, open it there, then enable notifications.'
          : 'This browser does not support web push. Use current Chrome, Edge, Safari, or the My Ajo app.';
        setPushState({ checking: false, supported: false, permission: 'denied', subscribed: false, configured: false, status, mode: 'web' });
        return;
      }
      const keyInfo = await apiGet('/push/public-key').catch(() => ({ enabled: false }));
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      setPushState({
        checking: false,
        supported,
        permission: Notification.permission,
        subscribed: !!subscription,
        configured: !!keyInfo.enabled,
        status: keyInfo.enabled ? '' : 'Server web push keys are not configured.',
        mode: 'web'
      });
    };

    checkPush();
    return () => {
      cleanup.forEach(handle => handle?.remove?.());
    };
  }, [isNative, navigate, showToast]);

  const saveForm = nextForm => apiPut('/users/me/notification-settings', nextForm);

  const toggleSetting = async (key, checked) => {
    const previousForm = form;
    const nextForm = { ...form, [key]: checked };
    setForm(nextForm);
    setBusyKey(key);
    try {
      await saveForm(nextForm);
      setUser(u => u ? ({
        ...u,
        NotifPayment: nextForm.notifPayment ? 1 : 0,
        NotifPayout: nextForm.notifPayout ? 1 : 0,
        NotifMember: nextForm.notifMember ? 1 : 0,
        NotifChat: nextForm.notifChat ? 1 : 0
      }) : u);
      showToast('Notification setting updated.');
    } catch (ex) {
      setForm(previousForm);
      showToast(ex.message || 'Notification setting update failed.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const enableNativePush = async () => {
    const PushNotifications = await getNativePushPlugin();
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      setPushState(s => ({ ...s, permission: permission.receive || 'denied' }));
      throw new Error('Notification permission was not granted.');
    }

    await new Promise((resolve, reject) => {
      let registrationHandle;
      let errorHandle;
      let timeoutId;
      const done = async (fn, value) => {
        clearTimeout(timeoutId);
        await registrationHandle?.remove?.();
        await errorHandle?.remove?.();
        fn(value);
      };
      Promise.all([
        PushNotifications.addListener('registration', token => done(resolve, token)),
        PushNotifications.addListener('registrationError', error => done(reject, error)),
      ]).then(([registration, registrationError]) => {
        registrationHandle = registration;
        errorHandle = registrationError;
        timeoutId = setTimeout(() => done(reject, new Error('Push token registration timeout.')), NATIVE_PUSH_TIMEOUT_MS);
        PushNotifications.register();
      }).catch(reject);
    }).then(async token => {
      const value = token?.value || '';
      if (!value) throw new Error('Device notification token was not returned.');
      localStorage.setItem(NATIVE_PUSH_TOKEN_KEY, value);
      await apiPost('/push/native-subscribe', { token: value, platform: nativePlatform, userAgent: navigator.userAgent });
      setPushState(s => ({ ...s, supported: true, permission: 'granted', subscribed: true, mode: 'native' }));
      await apiPost('/push/test', {}).catch(() => null);
      showToast(pushState.configured ? 'Mobile push notifications enabled!' : 'Device registered. Add FCM server key on the server to send push alerts.');
    });
  };

  const disableNativePush = async () => {
    const token = localStorage.getItem(NATIVE_PUSH_TOKEN_KEY) || '';
    if (token) await apiPost('/push/native-unsubscribe', { token, platform: nativePlatform });
    localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY);
    setPushState(s => ({ ...s, subscribed: false }));
    showToast('Mobile push notifications disabled.');
  };

  const enableWebPush = async () => {
    if (!pushState.supported) throw new Error('Push notifications are not supported on this device/browser.');
    const keyInfo = await apiGet('/push/public-key');
    if (!keyInfo.enabled || !keyInfo.publicKey) throw new Error('Push is not configured on the server yet.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushState(s => ({ ...s, permission }));
      throw new Error('Notification permission was not granted.');
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyInfo.publicKey)
    });
    await apiPost('/push/subscribe', { subscription, userAgent: navigator.userAgent });
    setPushState({ supported: true, permission, subscribed: true, configured: true, mode: 'web' });
    showToast('Mobile push notifications enabled!');
  };

  const disableWebPush = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await apiPost('/push/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    } else {
      await apiPost('/push/unsubscribe', {});
    }
    setPushState(s => ({ ...s, subscribed: false }));
    showToast('Mobile push notifications disabled.');
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushState.checking) throw new Error('Please wait while notification support is checked.');
      if (!pushState.supported) throw new Error(pushState.status || 'Push notifications are not supported on this device.');
      if (!pushState.configured && pushState.mode === 'web') throw new Error(pushState.status || 'Push is not configured on the server yet.');
      if (pushState.mode === 'native') {
        if (pushState.subscribed) await disableNativePush();
        else await enableNativePush();
      } else if (pushState.subscribed) {
        await disableWebPush();
      } else {
        await enableWebPush();
      }
    } catch (ex) {
      showToast(readablePushError(ex), 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const Toggle = ({ k, icon, label, sub }) => (
    <div className="row">
      <div className="row-ic" style={{ background: 'rgba(200,151,58,.1)', fontSize: 17 }}><SvgIcon name={icon} size={18} /></div>
      <div style={{ flex: 1 }}>
        <div className="row-name">{label}</div>
        <div className="row-sub">{sub}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={!!form[k]} disabled={busyKey === k} onChange={e => toggleSetting(k, e.target.checked)} aria-label={label} />
        <span className="tslider" />
      </label>
    </div>
  );

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/more" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Settings</div>
          <div className="psub">Choose which alerts you want to receive</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <Toggle k="notifPayment" icon="card" label="Payments and receipts" sub="Submitted, confirmed, rejected, or overdue contributions" />
        <Toggle k="notifPayout" icon="bank" label="Payouts and disbursements" sub="Scheduled, paid, cancelled, or upcoming payout alerts" />
        <Toggle k="notifMember" icon="users" label="Members and invite requests" sub="Join requests, approvals, rejections, and group membership changes" />
        <Toggle k="notifChat" icon="message" label="Chat messages" sub="Group and private chat messages" />
      </div>

      <div className="card">
        <div className="row">
          <div className="row-ic" style={{ background: 'rgba(200,151,58,.1)', fontSize: 17 }}><SvgIcon name="phone" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="row-name">Mobile push notifications</div>
            <div className="row-sub">{pushState.checking ? 'Checking notification support…' : pushState.subscribed ? 'Enabled on this device' : pushState.status || 'Send alerts even when the app is closed'}</div>
          </div>
          <button
            type="button"
            className={`toggle${pushState.subscribed ? ' is-on' : ''}`}
            role="switch"
            aria-checked={pushState.subscribed}
            aria-label="Mobile push notifications"
            disabled={pushBusy || pushState.checking}
            onClick={togglePush}
          >
            <span className="tslider" />
          </button>
        </div>
      </div>
    </div>
  );
}
