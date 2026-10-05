import { useState } from 'react';
import { apiPost } from '../api/appClient.js';

const suggestions = [
  'How do I make a contribution?',
  'Which members owe money?',
  'What payouts are due this week?',
  'How do I join a group?',
  'How do I install the app?',
  'How do I contact support?',
];

export default function AskAI() {
  const [question,setQuestion]=useState('');
  const [messages,setMessages]=useState([]);
  const [busy,setBusy]=useState(false);

  async function ask(value=question) {
    const text=value.trim();
    if(!text||busy)return;
    const history=messages.slice(-8);
    setMessages(current=>[...current,{role:'user',text}]);
    setQuestion(''); setBusy(true);
    try {
      const data=await apiPost('/insights/ask',{question:text,history});
      setMessages(current=>[...current,{role:'ai',text:data.answer,source:data.source}]);
    } catch(error) {
      setMessages(current=>[...current,{role:'ai',text:error.message||'My Ajo AI could not answer right now.'}]);
    } finally { setBusy(false); }
  }

  return <div className="page-enter ai-page">
    <div className="topbar"><div><div className="ptitle">Ask My Ajo AI</div><div className="psub">Help with the full app and answers grounded in data you are authorised to see</div></div></div>
    <div className="ai-suggestions">{suggestions.map(item=><button key={item} onClick={()=>ask(item)}>{item}</button>)}</div>
    <div className="ai-chat" aria-live="polite">
      {!messages.length&&<div className="empty-modern">Ask how to use My Ajo, or ask about your groups, contributions, payouts, calendar, notifications, profile and account activity.</div>}
      {messages.map((item,index)=><div key={index} className={`ai-message ${item.role}`}><div>{item.text}</div>{item.source==='guide-fallback'&&<small>Basic guide mode</small>}</div>)}
      {busy&&<div className="ai-message ai">Thinking…</div>}
    </div>
    <form className="ai-composer" onSubmit={event=>{event.preventDefault();ask()}}><input value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ask anything about My Ajo…" maxLength={500}/><button className="btn btn-p" disabled={busy||!question.trim()}>Ask</button></form>
  </div>;
}
