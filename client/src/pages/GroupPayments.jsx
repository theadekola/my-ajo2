import { useEffect, useState } from 'react';
import SvgIcon from '../components/SvgIcon.jsx';
import { useParams, Link } from 'react-router-dom';
import { apiAssetUrl, apiGet, apiPut } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPaymentMethod } from '../utils/textFormat.js';
import { fetchPrivateFile, saveBlobToDevice } from '../utils/nativeActions.js';

const evidenceKind = url => {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(clean)) return 'image';
  if (/\.pdf$/i.test(clean)) return 'pdf';
  return 'file';
};

export default function GroupPayments() {
  const { id } = useParams();
  const { fmt, showToast } = useAuth();
  const [contribs, setContribs] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [evidenceViewer, setEvidenceViewer] = useState(null);
  const [openingEvidence, setOpeningEvidence] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const load = () => apiGet('/contributions/group/'+id).then(data=>setContribs(Array.isArray(data) ? data : [])).catch(()=>setContribs([]));
  useEffect(() => { load(); }, [id]);

  const confirm = async cid => {
    await apiPut('/contributions/'+cid+'/confirm',{}); showToast('Contribution confirmed'); load(); setSelected(null);
  };
  const reject = async cid => {
    await apiPut('/contributions/'+cid+'/reject',{}); showToast('Contribution rejected'); load(); setSelected(null);
  };

  const pending = contribs.filter(c=>c.Status==='Pending');
  const statuses = ['All','Pending','Confirmed','Rejected'];
  const filtered = filter === 'All' ? contribs : contribs.filter(c => c.Status === filter);
  const searchTerm = search.trim().toLowerCase();
  const shown = searchTerm
    ? filtered.filter(c => [
        c.MemberName,
        c.Status,
        c.ReferenceNo,
        c.Method,
        c.Note,
        c.Amount,
        c.PaidAt ? new Date(c.PaidAt).toLocaleDateString() : ''
      ].some(value => String(value || '').toLowerCase().includes(searchTerm)))
    : filtered;
  const selectedReceiptUrl = selected?.ReceiptUrl ? apiAssetUrl(selected.ReceiptUrl) : '';
  useEffect(() => () => {
    if (evidenceViewer?.previewUrl) URL.revokeObjectURL(evidenceViewer.previewUrl);
  }, [evidenceViewer?.previewUrl]);
  const closeEvidenceViewer = () => setEvidenceViewer(null);
  const openEvidenceViewer = async () => {
    if (!selectedReceiptUrl) return;
    setOpeningEvidence(true);
    try {
      const file = await fetchPrivateFile(selectedReceiptUrl, `contribution-${selected.ContributionId}`);
      const kind = file.contentType.startsWith('image/') ? 'image' : file.contentType === 'application/pdf' ? 'pdf' : evidenceKind(file.fileName);
      setEvidenceViewer({ ...file, previewUrl: URL.createObjectURL(file.blob), kind });
    } catch (ex) {
      showToast(ex.message || 'Could not open evidence.', 'error');
    } finally {
      setOpeningEvidence(false);
    }
  };
  const saveEvidence = async () => {
    if (!evidenceViewer?.blob) return;
    setSavingEvidence(true);
    try {
      const name = await saveBlobToDevice(evidenceViewer.blob, evidenceViewer.fileName);
      showToast(`Evidence saved: ${name}`);
    } catch (ex) {
      showToast(ex.message || 'Could not save evidence.', 'error');
    } finally {
      setSavingEvidence(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/"+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link><div className="ptitle">Group Contributions</div><div className="psub">{pending.length} pending  -  {contribs.length} total</div></div>
      </div>

      {pending.length>0 && (
        <div style={{background:'rgba(255,193,7,.08)',border:'1.5px solid rgba(255,193,7,.3)',borderRadius:12,padding:'12px 16px',marginBottom:20,fontSize:13}}>
          <SvgIcon name="warning" size={16} /> {pending.length} contribution{pending.length>1?'s':''} awaiting your review
        </div>
      )}

      <div className="tabs-bar" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:3}}>
        {statuses.map(status => (
          <button key={status} className={'tab-btn' + (filter === status ? ' active' : '')} style={{width:'100%',minWidth:0,padding:'8px 3px',fontSize:'clamp(10px,2.7vw,12.5px)',whiteSpace:'nowrap'}} onClick={() => setFilter(status)}>
            {status} {status !== 'All' && <span className="badge b-gray" style={{marginLeft:2,fontSize:9,padding:'2px 5px'}}>{contribs.filter(c => c.Status === status).length}</span>}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-hd" style={{alignItems:'center',gap:10}}>
          <div className="card-ttl" style={{whiteSpace:'nowrap'}}>{filter}</div>
          <div style={{marginLeft:'auto',minWidth:0,width:'min(220px,46vw)'}}>
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search group contributions"
              style={{width:'100%',height:34,border:'1px solid rgba(0,0,0,.1)',borderRadius:10,background:'var(--mist)',padding:'0 10px',fontSize:12,outline:'none'}}
            />
          </div>
        </div>
        {shown.map(c=>(
          <div className="row" key={c.ContributionId} style={{cursor:'pointer'}} onClick={()=>setSelected(c)}>
            <div className="uav" style={{width:34,height:34,fontSize:12,background:c.AvatarColor||'var(--sage)',flexShrink:0}}>
              {c.ProfilePicture?<img src={apiAssetUrl(c.ProfilePicture)} style={{width:34,height:34,borderRadius:'50%',objectFit:'cover'}} alt=""/>:c.MemberName?.split(' ').map(w=>w[0]).join('')}
            </div>
            <div style={{flex:1}}>
              <div className="row-name">{c.MemberName}</div>
              <div className="row-sub">{formatPaymentMethod(c.Method)} - {c.ReferenceNo||'No ref'} - {new Date(c.PaidAt).toLocaleDateString()}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:700,color:'var(--deep)',fontSize:13}}>{fmt(c.Amount)}</div>
              <span className={"badge "+(c.Status==='Confirmed'?'b-green':c.Status==='Pending'?'b-gold':'b-red')}>{c.Status}</span>
            </div>
          </div>
        ))}
        {!shown.length && <div style={{padding:32,textAlign:'center',color:'var(--muted)',fontSize:13}}>No {filter.toLowerCase()} group contributions</div>}
      </div>

      {selected && (
        <div className="modal-ov open" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="modal">
            <button className="modal-close" onClick={()=>setSelected(null)}><SvgIcon name="x" size={18} /></button>
            <div className="modal-ttl">Contribution Details</div>
            {[['Member',selected.MemberName],['Amount',fmt(selected.Amount)],['Method', formatPaymentMethod(selected.Method)],['Reference',selected.ReferenceNo||'-'],['Date',new Date(selected.PaidAt).toLocaleString()],['Note',selected.Note||'-'],['Status',selected.Status]].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid rgba(0,0,0,.05)',fontSize:13}}>
                <span style={{color:'var(--muted)'}}>{l}</span><span style={{fontWeight:600}}>{v}</span>
              </div>
            ))}
            {selected.ReceiptUrl && (
              <div style={{marginTop:14}}>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:6}}>RECEIPT / EVIDENCE</div>
                <button type="button" className="btn btn-gh" onClick={openEvidenceViewer} disabled={openingEvidence} style={{width:'100%',justifyContent:'center'}}>
                  <SvgIcon name="receipt" size={16} /> {openingEvidence ? 'Opening evidence...' : 'Open receipt evidence'}
                </button>
              </div>
            )}
            {selected.Status==='Pending' && (
              <div style={{display:'flex',gap:10,marginTop:16}}>
                <button className="btn btn-red" onClick={()=>reject(selected.ContributionId)} style={{flex:1,justifyContent:'center'}}><SvgIcon name="x" size={16} /> Reject</button>
                <button className="btn btn-g" onClick={()=>confirm(selected.ContributionId)} style={{flex:2,justifyContent:'center'}}><SvgIcon name="check" size={16} /> Confirm Contribution</button>
              </div>
            )}
          </div>
        </div>
      )}

      {evidenceViewer && (
        <div className="modal-ov open modal-ov-center" style={{zIndex:1200,background:'rgba(14,26,18,.35)',backdropFilter:'blur(3px)',WebkitBackdropFilter:'blur(3px)'}} onClick={e=>e.target===e.currentTarget&&closeEvidenceViewer()}>
          <div className="modal" style={{maxWidth:520,width:'min(520px,calc(100vw - 28px))'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12}}>
              <div>
                <div className="modal-ttl" style={{marginBottom:2}}>Receipt Evidence</div>
                <div className="row-sub" style={{wordBreak:'break-all'}}>{evidenceViewer.fileName}</div>
              </div>
            </div>
            <div style={{border:'1px solid rgba(0,0,0,.08)',borderRadius:12,background:'var(--mist)',minHeight:260,maxHeight:'55vh',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {evidenceViewer.kind === 'image' ? (
                <img src={evidenceViewer.previewUrl} alt="Receipt evidence" style={{width:'100%',height:'100%',maxHeight:'55vh',objectFit:'contain',display:'block'}} />
              ) : evidenceViewer.kind === 'pdf' ? (
                <iframe title="Receipt evidence" src={evidenceViewer.previewUrl} style={{width:'100%',height:'55vh',border:0,background:'var(--white)'}} />
              ) : (
                <div style={{padding:24,textAlign:'center',color:'var(--muted)',fontSize:13,lineHeight:1.5}}>
                  This evidence file can be saved to your device.
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button type="button" className="btn btn-gh" onClick={closeEvidenceViewer} style={{flex:1,justifyContent:'center'}}>Close</button>
              <button type="button" className="btn btn-g" onClick={saveEvidence} disabled={savingEvidence} style={{flex:1,justifyContent:'center'}}>
                {savingEvidence ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
