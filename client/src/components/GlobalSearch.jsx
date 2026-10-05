import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/appClient.js';
import SvgIcon from './SvgIcon.jsx';
export default function GlobalSearch(){
 const [q,setQ]=useState(''); const [items,setItems]=useState([]); const navigate=useNavigate();
 useEffect(()=>{if(q.trim().length<2){setItems([]);return;}const timer=setTimeout(()=>apiGet(`/insights/search?q=${encodeURIComponent(q)}`).then(d=>setItems(d.items||[])).catch(()=>setItems([])),250);return()=>clearTimeout(timer);},[q]);
 return <div className="global-search"><SvgIcon name="search" size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search groups, members, transactions…" aria-label="Global search"/>{items.length>0&&<div className="global-search-results">{items.map((item,index)=><button key={`${item.Type}-${item.Id}-${index}`} onClick={()=>{setQ('');setItems([]);navigate(item.Link)}}><strong>{item.Title}</strong><span>{item.Type} · {item.Subtitle}</span></button>)}</div>}</div>;
}
