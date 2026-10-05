import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPost, apiDelete } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { copyText, inviteUrl, shareText } from '../utils/nativeActions.js';
import SvgIcon from '../components/SvgIcon.jsx';

export default function GroupInviteCodes() {
  const { id } = useParams();
  const { showToast } = useAuth();
  const [codes, setCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyCode, setBusyCode] = useState('');
  const load = () => apiGet('/invites/'+id).then(data=>setCodes(Array.isArray(data) ? data : [])).catch(()=>setCodes([]));
  useEffect(() => { load(); }, [id]);

  const create = async () => {
    setBusy(true);
    try { await apiPost('/invites/'+id,{}); showToast('New invite code created'); load(); }
    catch(ex) { showToast(ex.message,'error'); } finally { setBusy(false); }
  };
  const revoke = async cid => {
    setBusyCode(`revoke:${cid}`);
    try {
      await apiDelete('/invites/'+cid);
      showToast('Code revoked');
      load();
    } catch (ex) {
      showToast(ex.message || 'Could not revoke code.', 'error');
    } finally {
      setBusyCode('');
    }
  };
  const inviteLink = code => inviteUrl(code);
  const copy = async code => {
    setBusyCode(`copy:${code}`);
    try {
      await copyText(inviteLink(code));
      showToast('Invite link copied!');
    } catch (ex) {
      showToast(ex.message || 'Copy failed.', 'error');
    } finally {
      setBusyCode('');
    }
  };
  const share = async code => {
    const url = inviteLink(code);
    const text = 'Join my My Ajo savings group with this invite code: ' + code;
    setBusyCode(`share:${code}`);
    try {
      await shareText({ title:'My Ajo Invite', text, url });
      showToast('Invite ready to share.');
    } catch (ex) {
      const cancelled = /cancel/i.test(ex?.message || '');
      if (!cancelled) {
        try {
          await copyText(url);
          showToast('Share was not available, invite link copied.');
        } catch {
          showToast(ex.message || 'Share failed.', 'error');
        }
      }
    } finally {
      setBusyCode('');
    }
  };

  return (
    <div className="page-enter">
      <div className="topbar">
        <div>
          <Link to={"/group/"+id} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Back</span></Link><div className="ptitle">Invite Codes</div><div className="psub">Share these to grow your group</div></div>
        <div style={{display:'flex',gap:10}}><button className="btn btn-g btn-sm" onClick={create} disabled={busy}><SvgIcon name="plus" size={15}/> Generate Code</button></div>
      </div>
      <div className="card">
        {codes.map(c=>(
          <div className="row" key={c.InviteCodeId}>
            <div style={{flex:1}}>
              <div style={{fontFamily:'monospace',fontSize:15,fontWeight:700,letterSpacing:2,color:'var(--deep)'}}>{c.Code}</div>
              <div className="row-sub">Used {c.UsageCount} times  -  {c.IsActive?'Active':'Revoked'}  -  Created {new Date(c.CreatedAt).toLocaleDateString()}</div>
            </div>
            {c.IsActive && (
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-gh btn-sm" onClick={()=>share(c.Code)} disabled={busyCode === `share:${c.Code}`}>{busyCode === `share:${c.Code}` ? 'Sharing...' : 'Share'}</button>
                <button className="btn btn-gh btn-sm" onClick={()=>copy(c.Code)} disabled={busyCode === `copy:${c.Code}`}>Copy</button>
                <button className="btn btn-red btn-sm" onClick={()=>revoke(c.InviteCodeId)} disabled={busyCode === `revoke:${c.InviteCodeId}`}>{busyCode === `revoke:${c.InviteCodeId}` ? 'Revoking...' : 'Revoke'}</button>
              </div>
            )}
          </div>
        ))}
        {!codes.length && <div style={{padding:32,textAlign:'center',color:'var(--muted)',fontSize:13}}>No invite codes yet. Generate one above.</div>}
      </div>
    </div>
  );
}

