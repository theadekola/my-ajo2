import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet } from '../api/appClient.js';
import SvgIcon from '../components/SvgIcon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPaymentMethod } from '../utils/textFormat.js';

const fullName=member=>`${member?.FirstName||''} ${member?.LastName||''}`.trim();

export default function MemberTransactionsReport(){
  const {id,memberId}=useParams();
  const {fmt}=useAuth();
  const [member,setMember]=useState(null);
  const [transactions,setTransactions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    setLoading(true);setError('');
    Promise.all([apiGet(`/members/${id}`),apiGet(`/contributions/group/${id}`)])
      .then(([members,rows])=>{
        const selected=(Array.isArray(members)?members:[]).find(item=>Number(item.MemberId)===Number(memberId));
        setMember(selected||null);
        setTransactions(selected?(Array.isArray(rows)?rows:[]).filter(item=>Number(item.UserId)===Number(selected.UserId)):[]);
      })
      .catch(requestError=>setError(requestError.message||'Could not prepare the report.'))
      .finally(()=>setLoading(false));
  },[id,memberId]);

  const total=useMemo(()=>transactions.reduce((sum,item)=>sum+Number(item.Amount||0),0),[transactions]);
  const savePdf=()=>window.print();

  return <div className="page-enter transaction-report-page">
    <div className="transaction-report-actions">
      <Link to={`/group/${id}/members/${memberId}/transactions`} className="btn btn-gh"><SvgIcon name="arrowLeft" size={17}/>Back</Link>
      <button type="button" className="btn btn-g" onClick={savePdf}>Save as PDF</button>
    </div>
    {loading&&<div className="card empty-modern">Preparing report…</div>}
    {error&&<div className="err-msg">{error}</div>}
    {!loading&&!error&&!member&&<div className="card empty-modern">Member not found or no longer available.</div>}
    {member&&<article className="transaction-report-sheet">
      <header><div><h1>Transaction report</h1><p>{fullName(member)}</p></div><div className="transaction-report-brand"><img src="/logo.png" alt=""/><div>My Ajo<span>SMART SAVINGS GROUPS</span></div></div></header>
      <section className="transaction-report-meta"><div><span>Member</span><strong>{fullName(member)}</strong></div><div><span>Total contributions</span><strong>{fmt(total)}</strong></div><div><span>Records</span><strong>{transactions.length}</strong></div></section>
      <div className="transaction-report-table-wrap"><table><thead><tr><th>ID</th><th>Cycle</th><th>Method</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead><tbody>{transactions.map(item=><tr key={item.ContributionId}><td>{item.ContributionId}</td><td>Cycle {item.CycleNumber}</td><td>{formatPaymentMethod(item.Method)}</td><td>{new Date(item.PaidAt||item.CreatedAt).toLocaleDateString()}</td><td>{item.Status}</td><td>{fmt(item.Amount)}</td></tr>)}{!transactions.length&&<tr><td colSpan="6">No transactions found.</td></tr>}</tbody></table></div>
      <footer>Generated securely by My Ajo on {new Date().toLocaleString()}</footer>
    </article>}
  </div>;
}
