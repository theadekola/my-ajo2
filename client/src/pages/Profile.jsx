import { useEffect, useRef, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { Link } from 'react-router-dom';
import { State } from 'country-state-city';
import { apiAssetUrl, apiGet, apiPut, apiUpload } from '../api/appClient.js';
import { useAuth, COUNTRIES } from '../context/AuthContext.jsx';
import { NIGERIA_LGAS } from './Auth.jsx';

const NO_POSTCODE_COUNTRIES = new Set(['NG','AE','AG','AO','AW','BF','BI','BJ','BO','BS','BW','BZ','CF','CG','CI','CK','CM','CD','DJ','DM','ER','FJ','GA','GD','GM','GN','GQ','GY','HK','JM','KI','KM','LC','LY','ML','MO','MR','MW','NA','NR','NU','QA','RW','SB','SC','SL','SO','SR','ST','SX','SY','TD','TG','TK','TL','TO','TT','TV','UG','VU','YE','ZW']);
const countryUsesPostcode = countryCode => !NO_POSTCODE_COUNTRIES.has(String(countryCode || '').toUpperCase());

const ADDRESS_FORMATS = {
  NG: { stateLabel: 'STATE', localityLabel: 'LGA', postalLabel: 'POSTAL CODE' },
  GH: { stateLabel: 'REGION', localityLabel: 'DISTRICT', postalLabel: 'POSTAL CODE' },
  KE: { stateLabel: 'COUNTY', localityLabel: 'SUB-COUNTY', postalLabel: 'POSTAL CODE' },
  ZA: { stateLabel: 'PROVINCE', localityLabel: 'MUNICIPALITY', postalLabel: 'POSTAL CODE' },
  US: { stateLabel: 'STATE', localityLabel: 'COUNTY', postalLabel: 'ZIP CODE' },
  GB: { stateLabel: 'COUNTY / LOCAL AUTHORITY', localityLabel: 'BOROUGH / DISTRICT / TOWN', postalLabel: 'POSTCODE' },
  OTHER: { stateLabel: 'STATE / REGION', localityLabel: 'LOCAL AREA', postalLabel: 'POSTAL CODE' },
};

const addressFormatFor = code => ADDRESS_FORMATS[code] || ADDRESS_FORMATS.OTHER;

const isLikelyPostcode = value => {
  const text = String(value || '').trim();
  return text.length > 1 && text.length <= 10 && /\d/.test(text) && /^[A-Z0-9][A-Z0-9 -]*$/i.test(text);
};

const splitProfileAddress = address => {
  const parts = String(address || '').split(',').map(part => part.trim()).filter(Boolean);
  const result = { postcode: '', addressLine1: '', addressLine2: '', state: '', locality: '' };
  if (!parts.length) return result;

  if (parts.length >= 5) {
    result.postcode = parts[0] || '';
    result.addressLine1 = parts[1] || '';
    result.addressLine2 = parts.slice(2, -2).join(', ');
    result.state = parts[parts.length - 2] || '';
    result.locality = parts[parts.length - 1] || '';
    return result;
  }

  if (parts.length === 4 && isLikelyPostcode(parts[0])) {
    result.postcode = parts[0];
    result.addressLine1 = parts[1] || '';
    result.state = parts[2] || '';
    result.locality = parts[3] || '';
    return result;
  }

  if (parts.length === 4) {
    result.addressLine1 = parts[0] || '';
    result.addressLine2 = parts[1] || '';
    result.state = parts[2] || '';
    result.locality = parts[3] || '';
    return result;
  }

  if (parts.length === 3) {
    result.addressLine1 = parts[0] || '';
    result.state = parts[1] || '';
    result.locality = parts[2] || '';
    return result;
  }

  result.addressLine1 = parts.join(', ');
  return result;
};

const buildProfileAddress = form => [
  form.postcode,
  form.addressLine1,
  form.addressLine2,
  form.state,
  form.locality,
].map(value => String(value || '').trim()).filter(Boolean).join(', ');

export default function Profile() {
  const { user, setUser, refreshUser, showToast, sym } = useAuth();
  const [form, setForm] = useState({});
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [localities, setLocalities] = useState([]);
  const [tab, setTab] = useState('overview');
  const [accountData, setAccountData] = useState({ groups:[], contributions:[], payouts:[], activity:[] });
  const fileRef = useRef(null);

  useEffect(() => {
    if (user) {
      const addressParts = splitProfileAddress(user.Address);
      setForm({
      title: user.Title || '',
      firstName: user.FirstName || '',
      lastName: user.LastName || '',
      phone: user.Phone || '',
      sex: user.Sex || '',
      dateOfBirth: user.DateOfBirth ? String(user.DateOfBirth).slice(0, 10) : '',
      address: user.Address || '',
      postcode: addressParts.postcode,
      addressLine1: addressParts.addressLine1,
      addressLine2: addressParts.addressLine2,
      state: addressParts.state,
      locality: addressParts.locality,
      occupation: user.Occupation || '',
      countryCode: user.CountryCode || 'NG',
      currencyCode: user.CurrencyCode || 'NGN',
      currencySymbol: user.CurrencySymbol || sym,
      language: user.Language || 'English',
      avatarColor: user.AvatarColor || '#2D5040',
      bio: user.Bio || '',
      bankName: user.BankName || '',
      bankAccountNumber: user.BankAccountNumber || '',
      bankAccountName: user.BankAccountName || '',
      bankRoutingCode: user.BankRoutingCode || '',
      notifPayment: user.NotifPayment !== 0,
      notifPayout: user.NotifPayout !== 0,
      notifMember: user.NotifMember !== 0,
      notifChat: user.NotifChat !== 0
    });
    }
  }, [user]);

  useEffect(() => {
    Promise.all([
      apiGet('/groups'), apiGet('/contributions'), apiGet('/payouts'), apiGet('/dashboard/activity?limit=8')
    ]).then(([groups, contributions, payouts, activity]) => setAccountData({
      groups:Array.isArray(groups)?groups:[], contributions:Array.isArray(contributions)?contributions:[],
      payouts:Array.isArray(payouts)?payouts:[], activity:Array.isArray(activity?.items)?activity.items:[]
    })).catch(()=>{});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setCountry = event => {
    const next = COUNTRIES.find(c => c.code === event.target.value) || COUNTRIES[0];
    setForm(f => ({
      ...f,
      countryCode: next.code,
      currencyCode: next.cur,
      currencySymbol: next.sym,
      state: '',
      locality: '',
      postcode: '',
    }));
  };
  const setSubdivision = event => setForm(f => ({ ...f, state: event.target.value, locality: '' }));
  const cc = COUNTRIES.find(c => c.code === form.countryCode) || COUNTRIES[0];
  const addressFormat = addressFormatFor(cc.code);
  const usesPostcode = countryUsesPostcode(cc.code);
  const subdivisions = State.getStatesOfCountry(cc.code)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedSubdivision = subdivisions.find(item => item.name === form.state);

  useEffect(() => {
    let active = true;
    if (!selectedSubdivision) {
      setLocalities([]);
      return () => { active = false; };
    }
    if (cc.code === 'NG') {
      setLocalities([...(NIGERIA_LGAS[selectedSubdivision.name] || [])].sort((a, b) => a.localeCompare(b)));
      return () => { active = false; };
    }
    import('country-state-city').then(({ City }) => {
      if (!active) return;
      const places = City.getCitiesOfState(cc.code, selectedSubdivision.isoCode)
        .map(item => item.name)
        .filter((name, index, names) => index === 0 || name !== names[index - 1])
        .sort((a, b) => a.localeCompare(b));
      setLocalities(places);
    }).catch(() => active && setLocalities([]));
    return () => { active = false; };
  }, [cc.code, selectedSubdivision?.name, selectedSubdivision?.isoCode]);

  const pickFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('picture', file);
      const { url } = await apiUpload('/users/me/picture', fd);
      setUser(u => ({ ...u, ProfilePicture: url }));
      showToast('Photo updated!');
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (usesPostcode && !String(form.postcode || '').trim()) {
      setMessage(`Please enter your ${addressFormat.postalLabel.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const normalizedForm = usesPostcode ? { ...form, locality: '' } : { ...form, postcode: '' };
      const result = await apiPut('/users/me', { ...normalizedForm, address: buildProfileAddress(normalizedForm), countryCode: normalizedForm.countryCode, currencyCode: cc.cur, currencySymbol: cc.sym });
      setForm(normalizedForm);
      await refreshUser();
      setUser(u => u ? ({ ...u, ProfileEditedAt: result.profileEditedAt || new Date().toISOString() }) : u);
      setEditing(false);
      setMessage('Profile saved. You can edit your profile again in 30 days.');
    } catch (ex) {
      if (ex.code === 'PROFILE_EDIT_LOCKED' && ex.nextEditAt) {
        setMessage('Profile can only be edited every 30 days. Next edit: ' + new Date(ex.nextEditAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + '.');
      } else {
        setMessage(ex.message || 'Profile could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = async () => {
    if (editing) await save();
    else {
      setMessage('');
      setEditing(true);
    }
  };

  const img = preview || apiAssetUrl(user?.ProfilePicture);
  const initials = user ? (user.FirstName?.[0] || '') + (user.LastName?.[0] || '') : '?';
  const fieldStyle = !editing ? { opacity: .78, cursor: 'default' } : undefined;
  const nextEditDate = user?.ProfileEditedAt ? new Date(new Date(user.ProfileEditedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const editLocked = !editing && nextEditDate && nextEditDate > new Date();
  const lockText = editLocked ? 'You can edit your profile again on ' + nextEditDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + '.' : '';
  const confirmed = accountData.contributions.filter(item => item.Status === 'Confirmed' && Number(item.UserId) === Number(user?.UserId));
  const totalSavings = confirmed.reduce((sum,item)=>sum+Number(item.Amount||0),0);
  const receivedPayouts = accountData.payouts.filter(item => item.Status === 'Paid' && Number(item.RecipientId) === Number(user?.UserId));
  const totalPayouts = receivedPayouts.reduce((sum,item)=>sum+Number(item.TotalPayout??item.Amount??0),0);
  const completedFields = [user?.FirstName,user?.LastName,user?.Email,form.phone,form.sex,form.countryCode,form.occupation,form.addressLine1,form.state,form.locality,user?.ProfilePicture].filter(Boolean).length;
  const completion = Math.round(completedFields / 11 * 100);
  const now = new Date();
  const thisMonthContributions = confirmed.filter(item => { const date=new Date(item.PaidAt); return date.getMonth()===now.getMonth()&&date.getFullYear()===now.getFullYear(); });
  const contributionSummary = [
    ['Total contributions',sym+thisMonthContributions.reduce((sum,item)=>sum+Number(item.Amount||0),0).toLocaleString()],
    ['Total savings',sym+totalSavings.toLocaleString()],
    ...(receivedPayouts.length ? [['Total payouts',sym+totalPayouts.toLocaleString()]] : []),
  ];
  const accountSummary = [
    ['users','Total groups',accountData.groups.length],
    ['contribution','Contributions',confirmed.length],
    ['money','Total savings',sym+totalSavings.toLocaleString()],
    ...(receivedPayouts.length ? [['bank','Total payouts',sym+totalPayouts.toLocaleString()]] : []),
  ];
  const savedForGroup = groupId => confirmed.filter(item=>Number(item.GroupId)===Number(groupId)).reduce((sum,item)=>sum+Number(item.Amount||0),0);

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to="/more" className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link>
          <div className="ptitle">My Profile</div>
          <div className="psub">View and manage your account information</div>
        </div>
        {tab === 'personal' && <button
          className={editing ? 'btn btn-g' : 'btn btn-gh'}
          type="button"
          disabled={busy || editLocked}
          onClick={toggleEdit}
          aria-label={editing ? 'Save profile' : 'Edit profile'}
          title={editing ? 'Save profile' : 'Edit profile'}
          style={{ minWidth: 78, width: 'auto', justifyContent: 'center', fontSize: 13, padding: '8px 14px', flex: '0 0 auto' }}
        >
          {busy ? 'Saving...' : editing ? <><SvgIcon name="check" size={16}/> Save</> : <><SvgIcon name="edit" size={16}/> Edit</>}
        </button>}
      </div>

      <div className="profile-tabs" role="tablist">
        <button type="button" className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><SvgIcon name="chart" size={17}/> Overview</button>
        <button type="button" className={tab==='personal'?'active':''} onClick={()=>setTab('personal')}><SvgIcon name="user" size={17}/> Personal Info</button>
      </div>

      {tab === 'personal' && (message || lockText) && (
        <div style={{ background: message?.startsWith('Profile saved') ? 'rgba(46,125,50,.08)' : 'rgba(200,151,58,.10)', border: '1.5px solid ' + (message?.startsWith('Profile saved') ? 'rgba(46,125,50,.18)' : 'rgba(200,151,58,.25)'), color: message?.startsWith('Profile saved') ? 'var(--green)' : '#8A651D', borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 16, lineHeight: 1.55 }}>
          {message || lockText}
        </div>
      )}

      {tab === 'overview' && <><div className="profile-hero-card">
        <div className="profile-photo-wrap">
          <div className="uav" style={{ width: 80, height: 80, fontSize: 26, background: form.avatarColor || 'var(--sage)' }}>
            {img ? <img src={img} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} alt="" /> : initials}
          </div>
          <button className="profile-photo-edit" type="button" onClick={()=>fileRef.current?.click()} disabled={busy} aria-label="Change profile picture" title="Change profile picture"><SvgIcon name="camera" size={17}/></button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--deep)' }}>{user?.FirstName} {user?.LastName}</div>
          <div className="profile-contact"><span><SvgIcon name="mail" size={15}/>{user?.Email}</span><span><SvgIcon name="phone" size={15}/>{form.phone||'No phone number'}</span><span><SvgIcon name="location" size={15}/>{[form.locality,form.state,cc.name].filter(Boolean).join(', ')}</span></div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span className="badge b-green">{user?.SystemRole || 'Member'}</span>
            {user?.OrganizerStatus === 'Approved' && <span className="badge b-gold">Approved Organiser</span>}
            <span className="badge b-gold"><SvgIcon name="globe" size={13} /> {user?.CountryCode}</span>
            <span className="badge b-blue" title="Currency">{sym}</span>
            {user?.IsEmailVerified && <span className="badge b-green"><SvgIcon name="check" size={13} /> Verified</span>}
          </div>
        </div>
        <div className="profile-account-meta"><span>Account status <b>● Active</b></span><span>Member since <strong>{user?.CreatedAt?new Date(user.CreatedAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'—'}</strong></span><span>Member ID <strong>MYAJO-{String(user?.UserId||0).padStart(6,'0')}</strong></span></div>
      </div>

      <div className="profile-overview-grid">
        <section className="profile-overview-main">
          <article className="profile-section-card"><div className="profile-card-head"><div><h2>My groups ({accountData.groups.length})</h2><p>Your active savings circles</p></div><Link to="/groups">View all groups <SvgIcon name="arrowRight" size={13}/></Link></div><div className="profile-group-list">{accountData.groups.slice(0,5).map(group=>{const saved=savedForGroup(group.GroupId);const goal=Math.max(Number(group.ContributionAmount||0)*Number(group.CurrentCycle||1),Number(group.ContributionAmount||0));const progress=goal?Math.min(100,Math.round(saved/goal*100)):0;return <Link to={`/group/${group.GroupId}`} key={group.GroupId}><span><SvgIcon name={group.Role==='Admin'?'shield':'users'} size={19}/></span><strong>{group.GroupName}</strong><small>{group.Role||'Member'}</small><b>{sym}{saved.toLocaleString()}</b><em><i style={{width:`${progress}%`}}/></em><small>{progress}% of {sym}{goal.toLocaleString()} goal</small></Link>})}{!accountData.groups.length&&<div className="profile-empty">No groups yet</div>}</div></article>
          <div className="profile-contribution-grid"><article className="profile-section-card"><div className="profile-card-head"><div><h2>My contribution summary</h2><p>This month</p></div></div><div className="profile-contribution-summary" style={{gridTemplateColumns:`repeat(${contributionSummary.length},1fr)`}}>{contributionSummary.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><Link className="profile-history-link" to="/contributions">View full contribution history <SvgIcon name="arrowRight" size={14}/></Link></article><article className="profile-section-card"><div className="profile-card-head"><div><h2>Recent contributions</h2><p>Your confirmed payments</p></div><Link to="/contributions">View all</Link></div><div className="profile-activity-list">{confirmed.slice(0,5).map(item=><div key={item.ContributionId}><span><SvgIcon name="contribution" size={17}/></span><div><strong>{item.GroupName}</strong><small>{item.PaidAt?new Date(item.PaidAt).toLocaleDateString():''}</small></div><b>{sym}{Number(item.Amount||0).toLocaleString()}</b></div>)}{!confirmed.length&&<div className="profile-empty">No confirmed contributions yet</div>}</div></article></div>
        </section>
        <aside className="profile-overview-side">
          <article className="profile-section-card"><div className="profile-card-head"><div><h2>Account summary</h2><p>Current totals</p></div></div><div className="profile-summary-list">{accountSummary.map(([icon,label,value])=><div key={label}><span><SvgIcon name={icon} size={17}/>{label}</span><strong>{value}</strong></div>)}</div></article>
          <article className="profile-section-card"><div className="profile-card-head"><div><h2>Account activity</h2><p>Your latest events</p></div><Link to="/notifications">View all</Link></div><div className="profile-activity-list">{accountData.activity.slice(0,5).map(item=><div key={item.Id}><span><SvgIcon name={item.Category==='payouts'?'bank':item.Category==='groups'?'users':'contribution'} size={17}/></span><div><strong>{item.Title}</strong><small>{item.GroupName||item.Description||'Account activity'}</small></div>{item.Amount!=null&&<b>{sym}{Number(item.Amount).toLocaleString()}</b>}</div>)}{!accountData.activity.length&&<div className="profile-empty">No recent activity</div>}</div></article>
          <article className="profile-section-card profile-quick"><div className="profile-card-head"><div><h2>Quick actions</h2></div></div><div><Link to="/contributions"><SvgIcon name="contribution" size={20}/>Contribute</Link><Link to="/groups"><SvgIcon name="users" size={20}/>Groups</Link><Link to="/help"><SvgIcon name="help" size={20}/>Support</Link></div></article>
        </aside>
      </div></>}

      {tab === 'personal' && <div className="profile-personal-grid"><form className="profile-personal" onSubmit={e => e.preventDefault()}>
        <div className="card profile-personal-card">
          <div className="profile-card-head"><div><h2>Personal information</h2><p>Update your personal details and contact information.</p></div></div>
          <div className="form-row">
            <div className="fg">
              <label className="fl">TITLE</label>
              <select className="fs" value={form.title || ''} onChange={set('title')} disabled={!editing} style={fieldStyle}>
                <option value="">-</option>
                <option>Mr</option>
                <option>Mrs</option>
                <option>Ms</option>
                <option>Dr</option>
                <option>Prof</option>
              </select>
            </div>
            <div className="fg"><label className="fl">FIRST NAME</label><input className="fi" value={form.firstName || ''} onChange={set('firstName')} disabled={!editing} style={fieldStyle} /></div>
          </div>
          <div className="fg"><label className="fl">LAST NAME</label><input className="fi" value={form.lastName || ''} onChange={set('lastName')} disabled={!editing} style={fieldStyle} /></div>
          <div className="fg"><label className="fl">EMAIL</label><input className="fi" value={user?.Email || ''} disabled style={{ opacity: .6 }} /></div>
          <div className="fg"><label className="fl">PHONE NUMBER</label><input className="fi" type="tel" value={form.phone || ''} onChange={set('phone')} placeholder={cc.dial + ' 802 345 6789'} disabled={!editing} style={fieldStyle} /></div>
          <div className="fg"><label className="fl">DATE OF BIRTH</label><input className="fi" type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} disabled={!editing} style={fieldStyle} /></div>
          <div className="fg">
            <label className="fl">SEX</label>
            <select className="fs" value={form.sex || ''} onChange={set('sex')} disabled={!editing} style={fieldStyle}>
              <option value="">-</option>
              <option>Male</option>
              <option>Female</option>
              <option>Prefer not to say</option>
            </select>
          </div>
          <div className="fg"><label className="fl">COUNTRY</label><select className="fs" value={form.countryCode || 'NG'} onChange={setCountry} disabled={!editing} style={fieldStyle}>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          <div className="fg"><label className="fl">OCCUPATION</label><input className="fi" value={form.occupation || ''} onChange={set('occupation')} placeholder="e.g. Accountant" disabled={!editing} style={fieldStyle} /></div>
          <div className="fg"><label className="fl">{addressFormat.postalLabel}</label><input className="fi" required={usesPostcode} value={form.postcode || ''} onChange={set('postcode')} placeholder={usesPostcode ? `Enter ${addressFormat.postalLabel.toLowerCase()}` : 'Not used in selected country'} disabled={!editing || !usesPostcode} style={fieldStyle} /></div>
          <div className="fg"><label className="fl">ADDRESS LINE 1</label><input className="fi" value={form.addressLine1 || ''} onChange={set('addressLine1')} placeholder="House no. and street" disabled={!editing} style={fieldStyle} /></div>
          <div className="fg"><label className="fl">ADDRESS LINE 2 (optional)</label><input className="fi" value={form.addressLine2 || ''} onChange={set('addressLine2')} placeholder="Flat, estate, building or area" disabled={!editing} style={fieldStyle} /></div>
          <div className="fg">
            <label className="fl">{addressFormat.stateLabel}</label>
            {subdivisions.length ? (
              <select className="fs" value={form.state || ''} onChange={setSubdivision} disabled={!editing} style={fieldStyle}>
                <option value="">Select {addressFormat.stateLabel.toLowerCase()}</option>
                {subdivisions.map(item => <option key={item.isoCode} value={item.name}>{item.name}</option>)}
              </select>
            ) : (
              <input className="fi" value={form.state || ''} onChange={set('state')} placeholder={addressFormat.stateLabel.toLowerCase()} disabled={!editing} style={fieldStyle} />
            )}
          </div>
          <div className="fg">
            <label className="fl">{addressFormat.localityLabel}</label>
            {localities.length > 0 ? (
              <select className="fs" value={form.locality || ''} onChange={set('locality')} disabled={!editing || usesPostcode} style={fieldStyle}>
                <option value="">Select {addressFormat.localityLabel.toLowerCase()}</option>
                {localities.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : (
              <input className="fi" value={form.locality || ''} onChange={set('locality')} placeholder={usesPostcode ? `Determined by ${addressFormat.postalLabel.toLowerCase()}` : selectedSubdivision ? `Enter ${addressFormat.localityLabel.toLowerCase()}` : `Select ${addressFormat.stateLabel.toLowerCase()} first`} disabled={!editing || usesPostcode} style={fieldStyle} />
            )}
          </div>
          <div className="fg"><label className="fl">BIO</label><textarea className="fta" value={form.bio || ''} onChange={set('bio')} placeholder="Tell your group members about yourself..." disabled={!editing} style={fieldStyle} /></div>
        </div>

      </form><aside className="profile-personal-side"><article className="profile-section-card profile-completion"><div className="profile-card-head"><div><h2>Profile completion</h2><p>Keep your information current</p></div></div><div><span style={{'--completion':`${completion*3.6}deg`}}><strong>{completion}%</strong></span><div><b>{completion===100?'Profile complete!':'Almost there'}</b><small>{11-completedFields} field{11-completedFields===1?'':'s'} remaining</small></div></div></article><article className="profile-section-card profile-help-card"><SvgIcon name="help" size={22}/><div><h2>Need help?</h2><p>If you need assistance updating your profile information, contact support.</p><Link to="/support-email">Contact support <SvgIcon name="arrowRight" size={14}/></Link></div></article><article className="profile-section-card profile-privacy-card"><SvgIcon name="shield" size={22}/><div><h2>Privacy notice</h2><p>Your personal information is protected according to the My Ajo Privacy Policy.</p><Link to="/privacy">View privacy policy <SvgIcon name="arrowRight" size={14}/></Link></div></article></aside></div>}
    </div>
  );
}
