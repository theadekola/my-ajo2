import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SvgIcon from '../components/SvgIcon.jsx';
import { apiAssetUrl, apiGet } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const displayDate=value=>value?new Date(value).toLocaleDateString():'-';
const fullName=member=>`${member?.FirstName||''} ${member?.LastName||''}`.trim();

export default function MemberProfile(){
  const {id,memberId}=useParams();
  const {user}=useAuth();
  const [members,setMembers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    setLoading(true);setError('');
    apiGet(`/members/${id}`).then(data=>setMembers(Array.isArray(data)?data:[]))
      .catch(error=>setError(error.message||'Could not load member profile.')).finally(()=>setLoading(false));
  },[id]);

  const member=members.find(item=>Number(item.MemberId)===Number(memberId));
  const viewer=members.find(item=>Number(item.UserId)===Number(user?.UserId));
  const isAdmin=viewer?.Role==='Admin';
  const rows=member?(isAdmin?[
    ['Title',member.Title||'-'],['Email',member.Email||'-'],['Phone',member.Phone||'-'],['Sex',member.Sex||'-'],
    ['Date of birth',displayDate(member.DateOfBirth)],['Occupation',member.Occupation||'-'],['Address',member.Address||'-'],
    ['Country',member.CountryCode||'-'],['Role',member.Role||'Member'],['Slot',`#${member.SlotNumber}`],
    ['Status',member.Status||'-'],['Joined',displayDate(member.JoinedAt)],['Payout date',displayDate(member.PayoutDate)],
    ['Bank name',member.BankName||'-'],['Account number / IBAN',member.BankAccountNumber||'-'],
    ['Account name',member.BankAccountName||'-'],['Sort code / Routing',member.BankRoutingCode||'-']
  ]:[['Phone',member.Phone||'-'],['Role',member.Role||'Member'],['Slot',`#${member.SlotNumber}`],['Status',member.Status||'-'],['Joined',displayDate(member.JoinedAt)],['Payout date',displayDate(member.PayoutDate)]]):[];

  return <div className="page-enter member-detail-page">
    <div className="topbar"><div><Link to={`/group/${id}/members`} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Members</span></Link><div className="ptitle">Member Profile</div><div className="psub">Group membership and account details</div></div></div>
    {loading&&<div className="card empty-modern">Loading profile...</div>}{error&&<div className="err-msg">{error}</div>}
    {!loading&&!error&&!member&&<div className="card empty-modern">Member not found or no longer available.</div>}
    {member&&<div className="card member-page-card"><div className="member-page-identity"><div className="uav member-page-avatar" style={{background:member.AvatarColor||'var(--sage)'}}>{member.ProfilePicture?<img src={apiAssetUrl(member.ProfilePicture)} alt=""/>:(member.FirstName?.[0]||'')+(member.LastName?.[0]||'')}</div><div><h2>{fullName(member)}</h2><p>{member.Occupation||'Member'}</p></div></div><div className="member-profile-grid">{rows.map(([label,value])=><div className="member-profile-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div>}
  </div>;
}
