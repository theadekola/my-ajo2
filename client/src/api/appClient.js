import { fetchWithDeadline } from '../utils/request.js';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
try { localStorage.removeItem('myajo_token'); } catch { /* Storage may be unavailable. */ }
export const apiUrl = path => `${API_BASE_URL}${path}`;
export const apiAssetUrl = path => !path || typeof path !== 'string' || /^(https?:|data:|blob:)/i.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
let csrfToken = '';
let csrfRequest = null;
let securityVersion = 0;
export function resetApiSecurity() { csrfToken = ''; csrfRequest = null; securityVersion += 1; }
let activeRequests=0;
const announceLoading=()=>{if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('myajo:api-loading',{detail:{active:activeRequests}}));};
const unsafeMethod = method => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || 'GET').toUpperCase());
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    const version = securityVersion;
    const pending = fetchWithDeadline(apiUrl('/api/csrf'), { credentials: 'include' }, async response => {
      const data = await response.json();
      if (!response.ok || !data.csrfToken) throw new Error(data.error || 'Could not establish request security');
      if (version === securityVersion) csrfToken = data.csrfToken;
      return data.csrfToken;
    }, 10000).catch(error => { throw new Error(`Could not establish request security: ${/seconds/.test(error.message) ? 'server timeout' : error.message}`); });
    csrfRequest = pending;
    pending.finally(() => { if (csrfRequest === pending) csrfRequest = null; }).catch(() => {});
  }
  return csrfRequest;
}
async function request(path, opts = {}, multipart = false, retried = false) {
  const { csrf = true, rawResponse = false, ...options } = opts;
  const headers = { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  activeRequests+=1;announceLoading();
  try {
    if (unsafeMethod(options.method) && csrf) headers['X-CSRF-Token'] = await getCsrfToken();
    return await fetchWithDeadline(apiUrl(`/api${path}`), { ...options, headers, credentials: 'include' }, async response => {
      if (rawResponse) return response;
      const text = await response.text();
      let data = {};
      if (text) {
        try { data = JSON.parse(text); } catch { throw new Error('The server returned an invalid response. Please retry.'); }
      }
      if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), data, { status: response.status });
      return data;
    });
  } catch (error) {
    if (error.code === 'CSRF_TOKEN_INVALID' && !retried && csrf) {
      resetApiSecurity();
      return request(path, opts, multipart, true);
    }
    if(typeof window!=='undefined'&&!path.startsWith('/auth/')&&(error.status===401||error.code==='PASSWORD_RESET_REQUIRED'))window.dispatchEvent(new CustomEvent('myajo:session-expired',{detail:{status:error.status,code:error.code}}));
    if (typeof window !== 'undefined' && path !== '/auth/me') window.dispatchEvent(new CustomEvent('myajo:api-error', { detail: { message: error.message, path, status: error.status } }));
    throw error;
  } finally {activeRequests-=1;announceLoading();}
}
export const api = (path, opts) => request(path, opts);
export const apiUpload = (path, body) => request(path, { method: 'POST', body }, true);
export const apiGet = p => api(p);
export const apiPost = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b) });
export const apiPublicPost = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b), csrf: false });
export const apiPut = (p, b) => api(p, { method: 'PUT', body: JSON.stringify(b) });
export const apiDelete = (p, b) => api(p, { method: 'DELETE', body: b ? JSON.stringify(b) : undefined });
