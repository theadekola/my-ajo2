import { useEffect,useState } from 'react';
import { NavLink,Outlet,useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGet } from '../api/appClient.js';
import ApiErrorNotice from './ApiErrorNotice.jsx';
import SvgIcon from './SvgIcon.jsx';

const NAV=[['/system-admin','grid','Overview'],['/system-admin/users','users','Users'],['/system-admin/groups','groups','Groups'],['/system-admin/transactions','money','Transaction Monitoring'],['/system-admin/security','shield','Security'],['/system-admin/audit-logs','clipboard','Audit Logs'],['/system-admin/support','help','Support'],['/system-admin/administrators','briefcase','Administrators'],['/system-admin/settings','settings','Configuration Status'],['/system-admin/reports','warning','Chat reports']];

export default function SuperAdminLayout(){
  const {user,logout}=useAuth(); const navigate=useNavigate();
  const [health,setHealth]=useState(null);const [access,setAccess]=useState(null);
  useEffect(()=>{apiGet('/system-admin/access').then(setAccess).catch(()=>{});},[]);
  const [navOpen,setNavOpen]=useState(false);
  const [navHovered,setNavHovered]=useState(false);
  const mfaReady=!!user?.MfaEnabled&&!!user?.MfaVerifiedAt;
  useEffect(()=>{if(!mfaReady){setHealth(null);return;}let active=true;apiGet('/health').then(value=>active&&setHealth(value)).catch(()=>active&&setHealth({ok:false}));return()=>{active=false};},[mfaReady]);
  const signOut=async()=>{await logout();navigate('/');};
  return <div className={`sa-shell ${navOpen||navHovered?'sa-nav-expanded':'sa-nav-collapsed'} ${navOpen?'sa-mobile-nav-open':''}`}>
    {!navOpen&&<button type="button" className="sa-nav-open" onClick={()=>setNavOpen(true)} aria-label="Open Super Admin navigation" title="Open navigation"><SvgIcon name="menu" size={22}/></button>}
    <aside className="sa-sidebar" onMouseEnter={()=>setNavHovered(true)} onMouseLeave={()=>setNavHovered(false)} onFocusCapture={()=>setNavHovered(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setNavHovered(false)}}><button type="button" className="sa-nav-close" onClick={()=>setNavOpen(false)} aria-label="Close Super Admin navigation" title="Close navigation"><SvgIcon name="x" size={20}/></button><div className="sa-brand"><img src="/logo.png" alt=""/><div>My Ajo<strong>{user?.SystemRole==='SuperAdmin'?'SUPER ADMIN':'ADMIN'}</strong></div></div><nav>{NAV.filter(([to])=>{if(access?.role==='SuperAdmin')return true;const p={'users':'Manage users','groups':'Review groups','transactions':'Review transactions','security':'Review security alerts','audit-logs':'View audit logs','support':'Handle support tickets','reports':'Handle support tickets'};return to==='/system-admin'||access?.permissions?.includes(p[to.split('/').pop()])||(to==='/system-admin/groups'&&access?.permissions?.includes('Suspend groups'));}).map(([to,icon,label])=>{const security=label==='Security';return mfaReady||security?<NavLink key={to} to={security&&!mfaReady?'/system-admin/security/mfa/setup':to} end={to==='/system-admin'}><SvgIcon name={icon} size={18}/><span>{label}</span></NavLink>:<span key={to} className="sa-nav-disabled" aria-disabled="true"><SvgIcon name={icon} size={18}/><span>{label}</span></span>;})}</nav><div className="sa-side-bottom">{mfaReady&&<button onClick={()=>navigate('/dashboard')}><SvgIcon name="arrowLeft" size={17}/><span>Member Dashboard</span></button>}<button onClick={signOut}><SvgIcon name="logout" size={17}/><span>Sign Out</span></button></div></aside>
    <main className="sa-main"><header className="sa-header"><div>{health?.ok?<><span className="sa-status-dot"/>System operational</>:health?<><span className="sa-status-dot is-down"/>Health check unavailable</>:mfaReady?'Checking system health…':'MFA setup required'}</div><div className="sa-admin-identity"><span>{user?.FirstName} {user?.LastName}</span><small>{user?.SystemRole}</small></div></header><ApiErrorNotice/><Outlet/></main>
  </div>;
}
