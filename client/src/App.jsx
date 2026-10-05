import { Component, lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import CookieConsent from './components/CookieConsent.jsx';
import Landing   from './pages/Landing.jsx';
import Auth      from './pages/Auth.jsx';
import Dashboard  from './pages/Dashboard.jsx';
import SuperAdminLayout from './components/SuperAdminLayout.jsx';
import { inviteJoinPath, readPendingInvite, savePendingInvite } from './utils/pendingInvite.js';

const AskAI = lazy(() => import('./pages/AskAI.jsx'));
const Groups = lazy(() => import('./pages/Groups.jsx'));
const CreateGroup = lazy(() => import('./pages/CreateGroup.jsx'));
const GroupDetail = lazy(() => import('./pages/GroupDetail.jsx'));
const GroupMembers = lazy(() => import('./pages/GroupMembers.jsx'));
const MemberProfile = lazy(() => import('./pages/MemberProfile.jsx'));
const MemberTransactions = lazy(() => import('./pages/MemberTransactions.jsx'));
const MemberTransactionsReport = lazy(() => import('./pages/MemberTransactionsReport.jsx'));
const GroupInviteCodes = lazy(() => import('./pages/GroupInviteCodes.jsx'));
const GroupPayments = lazy(() => import('./pages/GroupPayments.jsx'));
const GroupContributions = lazy(() => import('./pages/GroupContributions.jsx'));
const GroupChat = lazy(() => import('./pages/GroupChat.jsx'));
const GroupStatistics = lazy(() => import('./pages/GroupStatistics.jsx'));
const MakePayment = lazy(() => import('./pages/MakePayment.jsx'));
const GroupBankDetails = lazy(() => import('./pages/GroupBankDetails.jsx'));
const PaymentInformation = lazy(() => import('./pages/PaymentInformation.jsx'));
const Contributions = lazy(() => import('./pages/Contributions.jsx'));
const Disbursement = lazy(() => import('./pages/Disbursement.jsx'));
const MemberPayoutDate = lazy(() => import('./pages/MemberPayoutDate.jsx'));
const DirectDebitSetup = lazy(() => import('./pages/DirectDebitSetup.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Calculator = lazy(() => import('./pages/Calculator.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings.jsx'));
const MfaSettings = lazy(() => import('./pages/MfaSettings.jsx'));
const Help = lazy(() => import('./pages/Help.jsx'));
const More = lazy(() => import('./pages/More.jsx'));
const InstallApp = lazy(() => import('./pages/InstallApp.jsx'));
const UserGuide = lazy(() => import('./pages/UserGuide.jsx'));
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const SupportEmail = lazy(() => import('./pages/SupportEmail.jsx'));
const SystemAdmin = lazy(() => import('./pages/SystemAdmin.jsx'));
const SuperAdminMfaSetup = lazy(() => import('./pages/SuperAdminMfaSetup.jsx'));
const SystemAdminUserDetail = lazy(() => import('./pages/SystemAdminUserDetail.jsx'));

function RouteLoading() {
  return <div style={{display:'grid',placeItems:'center',minHeight:'45vh',fontFamily:'Inter,Poppins,sans-serif',fontSize:18}}>Loading page…</div>;
}

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:24,fontFamily:'Inter,Poppins,sans-serif',textAlign:'center'}}>
        <div>
          <h1 style={{color:'#0D5B3A'}}>This page could not be loaded</h1>
          <p>Please refresh to download the latest application files.</p>
          <button type="button" onClick={() => window.location.reload()} style={{padding:'12px 20px',border:0,borderRadius:10,background:'#DCAA32',color:'#063B27',fontWeight:700}}>Refresh application</button>
        </div>
      </div>
    );
  }
}

function Guard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const savedInvite = savePendingInvite(new URLSearchParams(location.search).get('invite'));
  const inviteCode = savedInvite || readPendingInvite();
  if (loading) return <div style={{display:'grid',placeItems:'center',height:'100vh',fontFamily:'Inter,Poppins,sans-serif',fontSize:20}}><div style={{textAlign:'center'}}><img src="/logo.png" alt="My Ajo" style={{width:64,height:64,borderRadius:18,marginBottom:12}}/><div>Loading...</div></div></div>;
  if (!user) return <Navigate to={inviteCode ? `/auth?invite=${encodeURIComponent(inviteCode)}` : '/auth'} replace />;
  return children;
}

function SuperAdminGuard({children}) {
  const {user,loading}=useAuth();
  if(loading) return <div className="sa-loading">Loading protected administration…</div>;
  if(!user) return <Navigate to="/auth" replace/>;
  if(user.SystemRole!=='SuperAdmin') return <Navigate to="/dashboard" replace/>;
  if(!user.MfaVerifiedAt) return <Navigate to="/more" replace/>;
  return children;
}

function InviteEntry() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const inviteCode = savePendingInvite(code);

  if (loading) return <div style={{display:'grid',placeItems:'center',height:'100vh',fontFamily:'Inter,Poppins,sans-serif',fontSize:20}}><div style={{textAlign:'center'}}><img src="/logo.png" alt="My Ajo" style={{width:64,height:64,borderRadius:18,marginBottom:12}}/><div>Loading invite...</div></div></div>;

  const encodedInvite = encodeURIComponent(inviteCode);
  return <Navigate to={user ? inviteJoinPath(inviteCode) : `/auth?invite=${encodedInvite}`} replace />;
}

function AppLoader({ visible }) {
  return (
    <div
      className={`app-loader ${visible ? 'is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      aria-hidden={!visible}
    >
      <div className="app-loader-mark">
        <span className="app-loader-ring" />
        <img src="/logo.png" alt="" />
      </div>
      <div className="app-loader-name">My <span>Ajo</span></div>
      <div className="app-loader-text">Loading</div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const previousPath = useRef(null);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const pendingInvite = readPendingInvite();
  const authTarget = inviteJoinPath(pendingInvite);

  useLayoutEffect(() => {
    const previous = previousPath.current;
    const isEntryTransition =
      (previous === '/' && location.pathname === '/auth') ||
      (previous === '/auth' && location.pathname === '/dashboard');

    previousPath.current = location.pathname;
    if (!isEntryTransition) {
      setLoaderVisible(false);
      return undefined;
    }

    setLoaderVisible(true);
    const timer = window.setTimeout(() => {
      setLoaderVisible(false);
    }, 360);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  if (loading) return <div style={{display:'grid',placeItems:'center',height:'100vh',fontFamily:'Inter,Poppins,sans-serif',fontSize:20}}><div style={{textAlign:'center'}}><img src="/logo.png" alt="My Ajo" style={{width:64,height:64,borderRadius:18,marginBottom:12}}/><div>Loading...</div></div></div>;

  return (
    <>
      <AppLoader visible={loaderVisible} />
      <CookieConsent />
      <ChunkErrorBoundary key={location.pathname}>
        <Suspense fallback={<RouteLoading />}>
      <Routes>
          <Route path="/"        element={<Landing />} />
          <Route path="/invite/:code" element={<InviteEntry />} />
          <Route path="/auth"    element={user ? <Navigate to={authTarget} replace/> : <Auth />} />
          {!user && <Route path="/terms"   element={<Terms />} />}
          {!user && <Route path="/privacy" element={<Privacy />} />}

          <Route element={<SuperAdminGuard><SuperAdminLayout /></SuperAdminGuard>}>
            <Route path="/system-admin" element={<SystemAdmin />} />
            <Route path="/system-admin/users" element={<SystemAdmin />} />
            <Route path="/system-admin/users/:userId" element={<SystemAdminUserDetail />} />
            <Route path="/system-admin/groups" element={<SystemAdmin />} />
            <Route path="/system-admin/transactions" element={<SystemAdmin />} />
            <Route path="/system-admin/security" element={<SystemAdmin />} />
            <Route path="/system-admin/audit-logs" element={<SystemAdmin />} />
            <Route path="/system-admin/support" element={<SystemAdmin />} />
            <Route path="/system-admin/administrators" element={<SystemAdmin />} />
            <Route path="/system-admin/settings" element={<SystemAdmin />} />
            <Route path="/system-admin/security/mfa/setup" element={<SuperAdminMfaSetup />} />
          </Route>

          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/ask-ai" element={<AskAI />} />
            <Route path="/groups"       element={<Groups />} />
            <Route path="/groups/create" element={<CreateGroup />} />
            <Route path="/group/:id"    element={<GroupDetail />} />
            <Route path="/group/:id/members"      element={<GroupMembers />} />
            <Route path="/group/:id/members/:memberId/profile" element={<MemberProfile />} />
            <Route path="/group/:id/members/:memberId/transactions" element={<MemberTransactions />} />
            <Route path="/group/:id/members/:memberId/transactions/export" element={<MemberTransactionsReport />} />
            <Route path="/group/:id/invite-codes" element={<GroupInviteCodes />} />
            <Route path="/group/:id/payments"     element={<GroupPayments />} />
            <Route path="/group/:id/contributions" element={<GroupContributions />} />
            <Route path="/group/:id/chat"         element={<GroupChat />} />
            <Route path="/group/:id/statistics"   element={<GroupStatistics />} />
            <Route path="/group/:id/pay"          element={<MakePayment />} />
            <Route path="/group/:id/bank"         element={<GroupBankDetails />} />
            <Route path="/group/:id/payment-info" element={<PaymentInformation />} />
            <Route path="/group/:id/disbursement" element={<Disbursement />} />
            <Route path="/group/:id/payout-date" element={<MemberPayoutDate />} />
            <Route path="/group/:id/direct-debit" element={<DirectDebitSetup />} />
            <Route path="/contributions" element={<Contributions />} />
            <Route path="/calendar"      element={<Calendar />} />
            <Route path="/calculator"    element={<Calculator />} />
            <Route path="/profile"       element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/notification-settings" element={<NotificationSettings />} />
            <Route path="/security/mfa" element={<MfaSettings />} />
            <Route path="/help"          element={<Help />} />
            <Route path="/terms"         element={<Terms />} />
            <Route path="/privacy"       element={<Privacy />} />
            <Route path="/more"          element={<More />} />
            <Route path="/install"       element={<InstallApp />} />
            <Route path="/user-guide"    element={<UserGuide />} />
            <Route path="/support-email" element={<SupportEmail />} />
            <Route path="*"              element={<Navigate to="/dashboard" replace/>} />
          </Route>
      </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    </>
  );
}


