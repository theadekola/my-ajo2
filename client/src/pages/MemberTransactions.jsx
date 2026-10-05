import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SvgIcon from '../components/SvgIcon.jsx';
import { apiGet } from '../api/appClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPaymentMethod } from '../utils/textFormat.js';

const fullName=member=>`${member?.FirstName||''} ${member?.LastName||''}`.trim();

export default function MemberTransactions(){
  const {id,memberId}=useParams();
  const {fmt}=useAuth();
  const [member,setMember]=useState(null);
  const [transactions,setTransactions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    setLoading(true);setError('');
    Promise.all([apiGet(`/members/${id}`),apiGet(`/contributions/group/${id}`)])
      .then(([members,rows])=>{const selected=(Array.isArray(members)?members:[]).find(item=>Number(item.MemberId)===Number(memberId));setMember(selected||null);setTransactions(selected?(Array.isArray(rows)?rows:[]).filter(item=>Number(item.UserId)===Number(selected.UserId)):[]);})
      .catch(error=>setError(error.message||'Could not load transactions.')).finally(()=>setLoading(false));
  },[id,memberId]);

  const total=useMemo(()=>transactions.reduce((sum,item)=>sum+Number(item.Amount||0),0),[transactions]);
  return <div className="page-enter member-detail-page">
    <div className="topbar"><div><Link to={`/group/${id}/members`} className="back-link"><SvgIcon name="arrowLeft" size={18}/><span>Members</span></Link><div className="ptitle">Transaction</div><div className="psub">{member?`${fullName(member)} - ${transactions.length} record${transactions.length===1?'':'s'}`:'Contribution history'}</div></div>{member&&<Link className="btn btn-gh" to={`/group/${id}/members/${memberId}/transactions/export`}>Export PDF</Link>}</div>
    {loading&&<div className="card empty-modern">Loading transactions...</div>}{error&&<div className="err-msg">{error}</div>}
    {!loading&&!error&&!member&&<div className="card empty-modern">Member not found or no longer available.</div>}
    {member&&<div className="card member-page-card"><div className="transaction-summary"><div><span>Total contributions</span><strong>{fmt(total)}</strong></div><span className="badge b-green">{transactions.length} record{transactions.length===1?'':'s'}</span></div><div className="statement-list">{transactions.map(item=><div className="statement-row" key={item.ContributionId}><div><div className="row-name">Cycle {item.CycleNumber}</div><div className="row-sub">{formatPaymentMethod(item.Method)} - {new Date(item.PaidAt||item.CreatedAt).toLocaleDateString()}</div></div><div style={{textAlign:'right'}}><div style={{fontWeight:800,color:'var(--deep)'}}>{fmt(item.Amount)}</div><span className={`badge ${item.Status==='Confirmed'?'b-green':item.Status==='Pending'?'b-gold':'b-red'}`}>{item.Status}</span></div></div>)}{!transactions.length&&<div className="empty-modern">No transactions found.</div>}</div></div>}
  </div>;
}
