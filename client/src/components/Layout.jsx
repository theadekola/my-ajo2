import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiAssetUrl } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageErrorBoundary from './PageErrorBoundary.jsx';
import SvgIcon from './SvgIcon.jsx';
import GlobalSearch from './GlobalSearch.jsx';

const NAV = [
  { section: 'Overview', to: '/dashboard', icon: 'home', label: 'Dashboard' },
  { section: 'Money', to: '/contributions', icon: 'contribution', label: 'Contributions' },
  { section: 'Groups', to: '/groups', icon: 'users', label: 'My Groups' },
  { section: 'Communication', to: '/notifications', icon: 'bell', label: 'Notifications' },
  { section: 'Insights', to: '/calendar', icon: 'calendar', label: 'Calendar' },
  { section: 'Insights', to: '/ask-ai', icon: 'ai', label: 'Ask My Ajo AI' },
  { section: 'Support', to: '/help', icon: 'help', label: 'Help & Support' },
  { section: 'Account', to: '/more', icon: 'more', label: 'More' },
];

const PRIMARY_TABS = ['/dashboard', '/groups', '/ask-ai', '/contributions', '/more'];
const NON_REFRESHABLE_PATHS = new Set([]);

const pathIndex = pathname => {
  if (pathname.startsWith('/group/')) return PRIMARY_TABS.indexOf('/groups');
  const exact = PRIMARY_TABS.indexOf(pathname);
  return exact >= 0 ? exact : PRIMARY_TABS.indexOf('/more');
};

export default function Layout() {
  const { user, initials, unread } = useAuth();
  const [open, setOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [pullRefresh, setPullRefresh] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [navMotion, setNavMotion] = useState('nav-idle');
  const mainRef = useRef(null);
  const pullReadyRef = useRef(false);
  const previousPathRef = useRef(null);
  const notificationReturnRef = useRef('/dashboard');
  const location = useLocation();
  const navigate = useNavigate();
  const mobileSection = location.pathname === '/dashboard' ? 'home'
    : location.pathname.startsWith('/groups') || location.pathname.startsWith('/group/') ? 'groups'
    : location.pathname.startsWith('/ask-ai') ? 'ai'
    : location.pathname.startsWith('/contributions') ? 'contributions'
    : 'more';
  const isDashboardHome = location.pathname === '/dashboard';
  const isPrimaryTab = PRIMARY_TABS.includes(location.pathname);
  const canPullRefresh = !NON_REFRESHABLE_PATHS.has(location.pathname);
  const bottomClass = section => `bni ${mobileSection === section ? 'active' : ''}`;
  const bottomIconStyle = section => mobileSection === section ? {
    color:'var(--gold)',width:42,height:42,
    display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,
  } : undefined;
  const close = () => setOpen(false);

  useEffect(() => {
    const className = 'dashboard-no-swipe-back';
    document.documentElement.classList.toggle(className, isDashboardHome);
    document.body.classList.toggle(className, isDashboardHome);
    return () => {
      document.documentElement.classList.remove(className);
      document.body.classList.remove(className);
    };
  }, [isDashboardHome]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const previous = previousPathRef.current;
    previousPathRef.current = location.pathname;
    if (!previous || previous === location.pathname) {
      setNavMotion('nav-idle');
      return;
    }
    const previousIndex = pathIndex(previous);
    const nextIndex = pathIndex(location.pathname);
    if (previousIndex === nextIndex) {
      setNavMotion('nav-forward');
    } else {
      setNavMotion(nextIndex > previousIndex ? 'nav-forward' : 'nav-back');
    }
  }, [location.pathname]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let verticalPulling = false;
    let horizontalDone = false;

    const isMobileTouch = () => {
      const isSmallScreen = window.matchMedia?.('(max-width: 900px)').matches;
      return isSmallScreen && (navigator.maxTouchPoints || 0) > 0;
    };

    const getPageScrollTop = () => mainRef.current?.scrollTop ?? window.scrollY ?? 0;
    const isInteractiveTarget = target => !!target?.closest?.('input,textarea,select,button,a,[role="button"],.modal,.modal-ov,.tabs-bar,.chat-page');

    const onTouchStart = event => {
      if (!isMobileTouch() || pullRefresh || isInteractiveTarget(event.target)) return;
      const touch = event.touches?.[0];
      startX = touch?.clientX || 0;
      startY = touch?.clientY || 0;
      tracking = true;
      verticalPulling = false;
      horizontalDone = false;
    };

    const onTouchMove = event => {
      if (!tracking || pullRefresh) return;
      const touch = event.touches?.[0];
      const currentX = touch?.clientX || 0;
      const currentY = touch?.clientY || 0;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (!horizontalDone && absX > 54 && absX > absY * 1.25) {
        if (isPrimaryTab) {
          const currentIndex = PRIMARY_TABS.indexOf(location.pathname);
          const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
          if (nextIndex >= 0 && nextIndex < PRIMARY_TABS.length) {
            horizontalDone = true;
            tracking = false;
            event.preventDefault();
            setNavMotion(deltaX < 0 ? 'nav-forward' : 'nav-back');
            navigate(PRIMARY_TABS[nextIndex]);
          }
          return;
        }
        if (startX <= 28 && deltaX > 72) {
          horizontalDone = true;
          tracking = false;
          event.preventDefault();
          setNavMotion('nav-back');
          navigate(-1);
          return;
        }
      }

      if (isDashboardHome && deltaX > 16 && absX > absY * 1.1) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        tracking = false;
        return;
      }
      if (absX > 28 && absX > absY) {
        tracking = false;
        verticalPulling = false;
        setPullDistance(0);
        setPullReady(false);
        return;
      }
      if (canPullRefresh && deltaY > 0 && getPageScrollTop() <= 0) {
        verticalPulling = true;
        event.preventDefault();
        const distance = Math.min(Math.round(deltaY * 0.55), 82);
        pullReadyRef.current = deltaY > 95;
        setPullReady(pullReadyRef.current);
        setPullDistance(distance);
      }
    };

    const stopTracking = () => {
      if (verticalPulling && pullReadyRef.current && !pullRefresh) {
        setPullRefresh(true);
        setPullDistance(72);
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('myajo:refresh', { detail: { path: location.pathname } }));
          setNavMotion('nav-refresh');
          setRefreshKey(key => key + 1);
          mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          window.setTimeout(() => {
            setPullRefresh(false);
            setPullDistance(0);
            setPullReady(false);
          }, 260);
        }, 260);
      } else {
        setPullDistance(0);
        setPullReady(false);
      }
      pullReadyRef.current = false;
      verticalPulling = false;
      tracking = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', stopTracking, { passive: true });
    window.addEventListener('touchcancel', stopTracking, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stopTracking);
      window.removeEventListener('touchcancel', stopTracking);
    };
  }, [canPullRefresh, isDashboardHome, isPrimaryTab, location.pathname, navigate, pullRefresh]);
  return (
    <>
      {open && <div className="ov" onClick={close} />}
      {(pullDistance > 0 || pullRefresh) && (
        <div
          className={`pull-refresh-indicator ${pullRefresh ? 'is-refreshing' : ''}`}
          style={{
            '--pull-distance': `${pullDistance}px`,
            opacity: pullRefresh ? 1 : Math.min(1, 0.35 + pullDistance / 120),
          }}
        >
          <SvgIcon name="rotate" size={15} /> {pullRefresh ? 'Refreshing...' : pullReady ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      <aside
        className={`sidebar ${open ? 'open' : ''} ${railExpanded ? 'rail-expanded' : ''}`}
        onMouseEnter={() => setRailExpanded(true)}
        onMouseLeave={() => setRailExpanded(false)}
        onFocusCapture={() => setRailExpanded(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setRailExpanded(false);
        }}
      >
        <div className="brand">
          <div className="brand-ic"><img src="/logo.png" alt="My Ajo" /></div>
          <div className="brand-copy">
            <div className="brand-name">My Ajo</div>
            <div className="brand-sub">Smart Savings Groups</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={close}
            >
              <span style={{ width: 20, textAlign: 'center' }}><SvgIcon name={item.icon} size={18} /></span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sb-foot">
          <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', width: '100%', border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => navigate('/profile')} aria-label="View profile">
            <div className="uav" style={{ width: 34, height: 34, fontSize: 13, background: user?.AvatarColor || 'var(--sage)' }}>
              {user?.ProfilePicture
                ? <img src={apiAssetUrl(user.ProfilePicture)} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                : initials}
            </div>
            <div className="sb-user-copy">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--white)' }}>{user?.FirstName} {user?.LastName}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)' }}>{user?.SystemRole}</div>
            </div>
          </button>
        </div>
      </aside>

      <header className="mob-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter,Poppins,sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--white)' }}>
          <img src="/logo.png" alt="" style={{ width: 28, height: 28, borderRadius: 9, objectFit: 'cover' }} />
          <span>My <span style={{ color: 'var(--gold)' }}>Ajo</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="mobile-header-action" onClick={() => setMobileSearchOpen(value => !value)} aria-label="Search My Ajo" aria-expanded={mobileSearchOpen}>
            <SvgIcon name="search" size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (location.pathname === '/notifications') {
                navigate(notificationReturnRef.current || '/dashboard');
              } else {
                notificationReturnRef.current = `${location.pathname}${location.search || ''}`;
                navigate('/notifications');
              }
              close();
            }}
            aria-label={location.pathname === '/notifications' ? 'Close notifications' : 'Open notifications'}
            aria-pressed={location.pathname === '/notifications'}
            style={{ position: 'relative', width: 34, height: 34, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,.12)', color: 'var(--gold)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            <SvgIcon name="bell" size={18} />
            {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--gold)', color: 'var(--deep)', fontSize: 10, fontWeight: 800, borderRadius: 10, minWidth: 17, height: 17, padding: '1px 4px', display: 'grid', placeItems: 'center' }}>{unread}</span>}
          </button>
        </div>
      </header>
      {mobileSearchOpen && <div className="mobile-search-overlay"><GlobalSearch /></div>}

      <main className={`main ${navMotion} ${railExpanded ? 'sidebar-expanded' : ''}`} ref={mainRef}>
        <GlobalSearch />
        <PageErrorBoundary locationKey={location.key}>
          <div key={`${location.pathname}:${location.search}:${refreshKey}`} className="screen-shell">
            <Outlet />
          </div>
        </PageErrorBoundary>
      </main>

      <nav className="bot-nav">
        <div className="bot-inner">
          <NavLink to="/dashboard" end className={() => bottomClass('home')}>
            <span className="bni-ic" style={bottomIconStyle('home')}><SvgIcon name="home" size={20} /></span><span>Home</span>
          </NavLink>
          <NavLink to="/groups" className={() => bottomClass('groups')}>
            <span className="bni-ic" style={bottomIconStyle('groups')}><SvgIcon name="users" size={20} /></span><span>Groups</span>
          </NavLink>
          <NavLink to="/ask-ai" className={() => bottomClass('ai')}>
            <span className="bni-ic" style={bottomIconStyle('ai')}><SvgIcon name="ai" size={20} /></span><span>My Ajo AI</span>
          </NavLink>
          <NavLink to="/contributions" className={() => bottomClass('contributions')}>
            <span className="bni-ic" style={bottomIconStyle('contributions')}><SvgIcon name="contribution" size={20} /></span><span>Contributions</span>
          </NavLink>
          <NavLink to="/more" className={() => bottomClass('more')}>
            <span className="bni-ic" style={bottomIconStyle('more')}><SvgIcon name="more" size={20} /></span><span>More</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
}
