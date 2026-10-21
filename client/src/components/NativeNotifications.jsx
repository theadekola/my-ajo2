import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { routeFromUrl } from '../utils/appRoutes.js';
export default function NativeNotifications(){
  const {user,showToast}=useAuth();const navigate=useNavigate();
  useEffect(()=>{
    if(!user||!Capacitor.isNativePlatform())return;
    let disposed=false;const handles=[];
    const add=async(plugin,event,listener)=>{const handle=await plugin.addListener(event,listener);if(disposed)await handle.remove();else handles.push(handle);};
    import('@capacitor/push-notifications').then(async({PushNotifications})=>{
      await add(PushNotifications,'pushNotificationReceived',notification=>showToast(notification.title||'New notification'));
      await add(PushNotifications,'pushNotificationActionPerformed',event=>navigate(routeFromUrl(event.notification?.data?.url||'/notifications')));
    }).catch(()=>{});
    return()=>{disposed=true;handles.forEach(handle=>handle.remove());};
  },[user?.UserId,navigate,showToast]);
  return null;
}
