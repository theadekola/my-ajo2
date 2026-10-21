import { useRef,useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
export function useAction(){const {showToast}=useAuth();const locked=useRef(false);const [busy,setBusy]=useState(false);const run=async action=>{if(locked.current)return false;locked.current=true;setBusy(true);try{await action();return true;}catch(error){showToast(error.message||'Action failed. Please retry.','error');return false;}finally{locked.current=false;setBusy(false);}};return {run,busy};}
