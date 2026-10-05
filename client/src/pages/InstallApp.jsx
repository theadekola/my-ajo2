import { Link } from 'react-router-dom';
import SvgIcon from '../components/SvgIcon.jsx';

export default function InstallApp() {
  const steps = {
    ios: [
      ['1', 'Open Safari', 'Open My Ajo (www.my-ajo.org) in Safari - must be Safari, not Chrome.'],
      ['2', 'Tap Share', 'Tap the Share button (box with up arrow) at the bottom of your screen.'],
      ['3', 'Add to Home Screen', 'Scroll down and tap "Add to Home Screen".'],
      ['4', 'Confirm', 'Tap "Add" in the top right corner. My Ajo will appear on your home screen.'],
    ],
    android: [
      ['1', 'Open Chrome', 'Open My Ajo in Google Chrome on your Android device.'],
      ['2', 'Open Menu', 'Tap the three-dot menu in the top right corner.'],
      ['3', 'Install App', 'Tap "Add to Home Screen" or "Install App".'],
      ['4', 'Confirm', 'Tap "Install". My Ajo will appear on your home screen and app drawer.'],
    ],
  };
  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/more" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">Install App</div>
          <div className="psub">Add My Ajo to your home screen</div>
        </div>
      </div>

      <div style={{background:'linear-gradient(135deg,var(--deep),var(--forest))',borderRadius:'var(--r)',padding:'28px 24px',textAlign:'center',marginBottom:24,color:'#fff'}}>
        <img src="/logo.png" alt="My Ajo" style={{width:76,height:76,borderRadius:22,objectFit:'cover',margin:'0 auto 14px',boxShadow:'0 14px 36px rgba(0,0,0,.22)'}} />
        <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:22,fontWeight:800,marginBottom:8}}>My Ajo works as an app!</div>
        <div style={{fontSize:14,color:'rgba(255,255,255,.7)',maxWidth:400,margin:'0 auto'}}>Install it on your phone for a native app experience - works offline too.</div>
      </div>

      <div className="grid-2">
        {[["phone", 'iPhone / iOS', steps.ios], ["monitor", 'Android', steps.android]].map(([icon, title, list]) => (
          <div className="card" key={title}>
            <div className="card-hd"><div className="card-ttl"><SvgIcon name={icon} size={18} /> {title}</div></div>
            <div style={{padding:'8px 18px 16px'}}>
              {list.map(([n,t,s])=>(
                <div key={n} style={{display:'flex',gap:12,marginTop:14}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'var(--gold)',color:'var(--deep)',fontWeight:800,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{n}</div>
                  <div><div style={{fontWeight:600,fontSize:13,color:'var(--deep)'}}>{t}</div><div style={{fontSize:12,color:'var(--muted)',marginTop:2,lineHeight:1.5}}>{s}</div></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:20,marginTop:0}}>
        <div style={{fontFamily:"'Inter','Poppins',sans-serif",fontSize:14,fontWeight:800,marginBottom:12}}>Benefits of installing</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
          {[['lightning','Fast loading','Opens instantly like a native app'],['offline','Works offline','View your data without internet'],['bell','Notifications','Get alerts for payments and payouts'],['monitor','Full screen','No browser bars - immersive experience']].map(([ic,t,s])=>(
            <div key={t} style={{background:'var(--mist)',borderRadius:10,padding:14}}>
              <div style={{marginBottom:6,color:'var(--gold)'}}><SvgIcon name={ic} size={22} /></div>
              <div style={{fontWeight:600,fontSize:13,color:'var(--deep)',marginBottom:3}}>{t}</div>
              <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.5}}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
