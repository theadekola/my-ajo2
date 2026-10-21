export function dayKey(value){if(!value)return '';const raw=String(value);if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);const date=new Date(value);if(Number.isNaN(date.getTime()))return '';return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function mergePayoutDates(payouts,assigned){
  return [...payouts,...assigned.filter(item=>!payouts.some(p=>Number(p.GroupId)===Number(item.GroupId)&&Number(p.RecipientId)===Number(item.RecipientId)&&Number(p.CycleNumber)===Number(item.CycleNumber)&&p.Status!=='Cancelled'))];
}
export function upcomingPayouts(rows,today){return rows.filter(p=>['Scheduled','Assigned'].includes(p.Status)&&dayKey(p.ScheduledFor)>=today).sort((a,b)=>dayKey(a.ScheduledFor).localeCompare(dayKey(b.ScheduledFor))).slice(0,5);}
