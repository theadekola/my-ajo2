import { useEffect, useState } from 'react';
import { apiGet } from '../api/appClient.js';

// Private account details stay in the mounted screen, never in shared auth state.
export function useAccountDetails(session, section) {
  const [state, setState] = useState({ data:null, error:'', loading:true });
  useEffect(() => {
    let active=true;
    setState({data:null,error:'',loading:true});
    apiGet(`/auth/me/${section}`).then(data => {
      if(active)setState({owner:session,section,data,error:'',loading:false});
    }).catch(error => {
      if(active)setState({owner:session,section,data:null,error:error.message || 'Could not load account details.',loading:false});
    });
    return () => {active=false;};
  }, [session, section]);
  return state.owner===session && state.section===section ? state : {data:null,error:'',loading:true};
}
